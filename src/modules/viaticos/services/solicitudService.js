// src/modules/viaticos/services/solicitudService.js
// Casos de uso del solicitante que solo leen: catálogos del formulario, cálculo en vivo, lista y detalle.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const { ahoraUTC6 } = require('../../../core/calendario/calendarioLaboral');
const catalogoRepo = require('../repositories/catalogoSolicitudRepository');
const solicitudRepo = require('../repositories/solicitudRepository');
const personaRepo = require('../repositories/personaRepository');
const ajusteRepo = require('../repositories/ajusteRepository');
const { MODALIDADES, ORDEN_FASES, NIVEL_NO_APLICA } = require('../constantes');
const { Validador, cuerpoObjeto } = require('../validacion');
const { parsearJson } = require('../utilidades');
const { msg } = require('../mensajes');
const { calcularSolicitud } = require('./calculoService');
const { calcularPipeline, formatearFecha } = require('./pipelineService');
const { normalizarDatos, evaluar, erroresDeLicencia, rangoDelViaje, claveDePar } = require('./validacionSolicitudService');

const MAX_BUSQUEDA = 50;
const MS_DIA = 24 * 60 * 60 * 1000;
const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_LATINA_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
// Los errores de estos campos impiden armar el desglose; los demás (licencia, fechas…) no.
const CAMPOS_DEL_CALCULO = ['tramos', 'comidas', 'gastos', 'depreciacionPorKm'];

// «Ahora» de Guatemala como textos comparables: hoy «AAAA-MM-DD» y ahora «AAAA-MM-DD HH:mm».
function instante() {
  const iso = ahoraUTC6().toISOString();
  return { hoy: iso.slice(0, 10), ahora: `${iso.slice(0, 10)} ${iso.slice(11, 16)}` };
}

const sumarDias = (iso, dias) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * MS_DIA).toISOString().slice(0, 10);

// Lunes a domingo de la semana que contiene `hoy`.
function semanaDe(hoy) {
  const diaSemana = (new Date(`${hoy}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
  const desde = sumarDias(hoy, -diaSemana);
  return { desde, hasta: sumarDias(desde, 6) };
}

// La búsqueda acepta un correlativo parcial o una fecha de viáticos (AAAA-MM-DD o DD/MM/AAAA).
function interpretarBusqueda(texto) {
  const latina = FECHA_LATINA_RE.exec(texto);
  if (latina) return { fecha: `${latina[3]}-${latina[2]}-${latina[1]}`, correlativo: null };
  if (FECHA_ISO_RE.test(texto)) return { fecha: texto, correlativo: null };
  return { fecha: null, correlativo: texto };
}

// Viaje largo: solo el día; corto: día y hora sin segundos.
function fechaDeViaje(valor, modalidad) {
  if (valor === null || valor === undefined) return null;
  return modalidad === MODALIDADES.MAS_DE_UN_DIA ? String(valor).slice(0, 10) : String(valor).slice(0, 16);
}

function pipelineDe(fila, hoy) {
  return calcularPipeline({
    estado: fila.estado,
    modalidad: fila.modalidad,
    fechaSalida: fila.fechaSalida,
    fechaRegreso: fila.fechaRegreso,
    hoy,
    motivoRechazo: fila.motivoRechazo,
    fechaLiquidacion: fila.liquidadaEn
  });
}

class SolicitudService {
  // Países del solicitante; exige que el elegido esté entre ellos.
  async paisDelSolicitante(usuarioId, paisId) {
    const paises = await personaRepo.listarPaisesDe(usuarioId);
    if (paises.length === 0) throw new ErrorDeNegocio(msg('solicitud.sinPaises'), 403);
    const pais = paises.find(p => p.id === paisId);
    if (!pais) throw new ErrorDeNegocio(msg('solicitud.paisNoAsignado'), 403);
    return { id: pais.id, codigo: pais.codigo, nombre: pais.nombre };
  }

  async catalogosSolicitud(usuario, query) {
    const v = new Validador();
    const paisId = v.id(cuerpoObjeto(query), 'paisId', 'País');
    v.lanzar();
    const pais = await this.paisDelSolicitante(usuario.id, paisId);
    const { hoy } = instante();
    const licencia = await personaRepo.obtenerLicencia(usuario.id);
    const [
      motivos, vehiculos, ubicaciones, tramos, monedas, valoresComida, tiposComida, tiposGasto, tiposDefecto,
      fluidos, niveles, kit, reglas, ajustes
    ] = await Promise.all([
      catalogoRepo.listarMotivosActivos(),
      catalogoRepo.listarVehiculosDisponibles(paisId, usuario.id),
      catalogoRepo.listarUbicacionesActivas(),
      catalogoRepo.listarTramosActivos(),
      catalogoRepo.listarMonedasActivas(),
      catalogoRepo.listarValoresComida(),
      catalogoRepo.listarTiposComida(),
      catalogoRepo.listarTiposGastoSeleccionables(),
      catalogoRepo.listarTiposDefectoActivos(),
      catalogoRepo.listarFluidos(),
      catalogoRepo.listarNiveles(),
      catalogoRepo.listarKit(),
      licencia ? catalogoRepo.listarReglasDeLicencia(paisId, licencia.tipoLicenciaId) : [],
      ajusteRepo.listar()
    ]);
    const ajuste = clave => {
      const fila = ajustes.find(a => a.clave === clave);
      return fila ? parsearJson(fila.valor) : null;
    };
    return {
      pais,
      motivos,
      vehiculos: vehiculos.map(veh => this.marcarVehiculo(veh, { licencia, reglas, pais, hoy })),
      ubicaciones,
      tramos,
      monedas,
      valoresComida,
      tiposComida,
      tiposGasto,
      tiposDefecto,
      fluidos: fluidos.map(f => ({
        ...f,
        niveles: niveles.filter(n => f.permiteNoAplica || n.nombre !== NIVEL_NO_APLICA)
      })),
      kit,
      ajustesArchivo: { tiposArchivoPermitidos: ajuste('tipos_archivo_permitidos'), maxArchivoMb: ajuste('max_archivo_mb') }
    };
  }

  // `bloqueo`: motivo por el que el solicitante no puede usar el vehículo en ningún viaje; `bloqueoViajeCorto`: solo en uno corto.
  marcarVehiculo(veh, { licencia, reglas, pais, hoy }) {
    const regla = reglas.find(r => r.tipoPlacaId === veh.tipoPlacaId) || null;
    const [errorLicencia] = erroresDeLicencia({ licencia, vehiculo: veh, regla, paisNombre: pais.nombre, hoy });
    let bloqueoViajeCorto = null;
    if (veh.propietarioId !== null) bloqueoViajeCorto = msg('solicitud.vehiculoPropioViajeCorto', { placa: veh.placa });
    else if (veh.tarjetaVenceEl < hoy) bloqueoViajeCorto = msg('solicitud.tarjetaVencida', { placa: veh.placa, fecha: formatearFecha(veh.tarjetaVenceEl) });
    return {
      id: veh.id,
      marca: veh.marca,
      modelo: veh.modelo,
      anio: veh.anio,
      placa: veh.placa,
      tipoPlaca: veh.tipoPlacaNombre,
      combustible: veh.combustibleNombre,
      esPropio: veh.propietarioId !== null,
      tarjetaVenceEl: veh.tarjetaVenceEl,
      polizaVenceEl: veh.polizaVenceEl,
      bloqueo: errorLicencia ? errorLicencia.mensaje : null,
      bloqueoViajeCorto
    };
  }

  // Lee de la base lo que `evaluar` necesita según la modalidad. Solo lecturas.
  async cargarContexto(usuarioId, datos, { excluirSolicitudId = null } = {}) {
    const esLargo = datos.modalidad === MODALIDADES.MAS_DE_UN_DIA;
    const [paises, licencia, moneda, motivo, vehiculo, salvedades] = await Promise.all([
      personaRepo.listarPaisesDe(usuarioId),
      personaRepo.obtenerLicencia(usuarioId),
      esLargo ? catalogoRepo.monedaPorId(datos.monedaId) : null,
      catalogoRepo.motivoPorId(datos.motivoId),
      catalogoRepo.vehiculoPorId(datos.vehiculoId),
      catalogoRepo.listarSalvedades()
    ]);
    const { desde, hasta } = rangoDelViaje(datos);
    const ctx = {
      usuarioId,
      paisIds: paises.map(p => p.id),
      pais: paises.find(p => p.id === datos.paisId) || null,
      licencia, moneda, motivo, vehiculo,
      regla: null,
      salvedades: new Map(salvedades.map(s => [s.nombre, s.id])),
      traslapes: await solicitudRepo.buscarTraslapes(usuarioId, desde, hasta, excluirSolicitudId),
      ubicaciones: new Map(), tramosPorPar: new Map(), tiposComida: [], valoresPorTipo: {}, tiposGasto: new Map(),
      fluidos: [], niveles: new Map(), kitItems: new Map(), tiposDefecto: new Map()
    };
    if (licencia && vehiculo) {
      const reglas = await catalogoRepo.listarReglasDeLicencia(datos.paisId, licencia.tipoLicenciaId);
      ctx.regla = reglas.find(r => r.tipoPlacaId === vehiculo.tipoPlacaId) || null;
    }
    if (esLargo) await this.cargarContextoLargo(datos, ctx);
    else await this.cargarContextoCorto(datos, ctx);
    return ctx;
  }

  async cargarContextoLargo(datos, ctx) {
    const ubicacionIds = [...new Set(datos.tramos.flatMap(t => [t.origenId, t.destinoId]))];
    const [ubicaciones, tramos, tiposComida, tiposGasto, valores] = await Promise.all([
      catalogoRepo.ubicacionesPorIds(ubicacionIds),
      catalogoRepo.tramosEntre(ubicacionIds),
      catalogoRepo.listarTiposComida(),
      catalogoRepo.tiposGastoPorIds([...new Set(datos.gastos.map(g => g.tipoGastoId))]),
      ctx.moneda ? catalogoRepo.valoresComidaDeMoneda(ctx.moneda.id) : []
    ]);
    ctx.ubicaciones = new Map(ubicaciones.map(u => [u.id, u]));
    ctx.tramosPorPar = new Map(tramos.map(t => [claveDePar(t.ubicacionAId, t.ubicacionBId), t]));
    ctx.tiposComida = tiposComida;
    ctx.tiposGasto = new Map(tiposGasto.map(t => [t.id, t]));
    ctx.valoresPorTipo = Object.fromEntries(valores.map(x => [x.tipoComidaId, x.valor]));
  }

  async cargarContextoCorto(datos, ctx) {
    const defectos = datos.inspeccion ? datos.inspeccion.defectos : [];
    const [fluidos, niveles, kit, tiposDefecto] = await Promise.all([
      catalogoRepo.listarFluidos(),
      catalogoRepo.listarNiveles(),
      catalogoRepo.listarKit(),
      catalogoRepo.tiposDefectoPorIds([...new Set(defectos.map(d => d.tipoDefectoId))])
    ]);
    ctx.fluidos = fluidos;
    ctx.niveles = new Map(niveles.map(n => [n.id, { ...n, esNoAplica: n.nombre === NIVEL_NO_APLICA }]));
    ctx.kitItems = new Map(kit.map(k => [k.id, k]));
    ctx.tiposDefecto = new Map(tiposDefecto.map(t => [t.id, t]));
  }

  // Valida y calcula sin guardar. Los errores bloqueantes viajan en la respuesta (200), no como excepción.
  async calcular(usuario, cuerpo) {
    const { datos, errores: erroresForma } = normalizarDatos(cuerpo);
    if (erroresForma.length > 0) return respuestaDeCalculo(datos.modalidad, { errores: erroresForma });
    const { hoy, ahora } = instante();
    const ctx = await this.cargarContexto(usuario.id, datos);
    const evaluacion = evaluar({ datos, ctx, hoy, ahora });
    const puedeCalcular = Boolean(ctx.vehiculo)
      && (datos.modalidad !== MODALIDADES.MAS_DE_UN_DIA || Boolean(ctx.moneda))
      && !evaluacion.errores.some(e => CAMPOS_DEL_CALCULO.some(c => e.campo.startsWith(c)));
    if (!puedeCalcular) return respuestaDeCalculo(datos.modalidad, { errores: evaluacion.errores, advertencias: evaluacion.advertencias });
    const calculo = calcularSolicitud({
      datos,
      tramos: evaluacion.tramos,
      vehiculoPropio: evaluacion.vehiculoPropio,
      tiposComida: ctx.tiposComida,
      valoresPorTipo: ctx.valoresPorTipo,
      monedaNombre: ctx.moneda ? ctx.moneda.nombre : ''
    });
    return respuestaDeCalculo(datos.modalidad, { errores: evaluacion.errores, advertencias: evaluacion.advertencias, ...calculo });
  }

  async listar(usuario, query) {
    const parametros = cuerpoObjeto(query);
    const v = new Validador();
    const { hoy } = instante();
    const semana = semanaDe(hoy);
    const desde = v.fecha(parametros, 'desde', 'Desde', { requerido: false }) || semana.desde;
    const hasta = v.fecha(parametros, 'hasta', 'Hasta', { requerido: false }) || semana.hasta;
    const texto = typeof parametros.q === 'string' ? parametros.q.trim() : '';
    if (texto.length > MAX_BUSQUEDA) v.falla('q', msg('solicitud.busquedaLarga', { max: MAX_BUSQUEDA, largo: texto.length }));
    if (!v.campos.desde && !v.campos.hasta && desde > hasta) v.falla('desde', msg('solicitud.rangoFechas', { desde, hasta }));
    v.lanzar();
    const filas = await solicitudRepo.listarDelSolicitante(usuario.id, { desde, hasta, ...(texto ? interpretarBusqueda(texto) : {}) });
    const items = filas.map(fila => {
      const pipeline = pipelineDe(fila, hoy);
      return {
        id: fila.id,
        correlativo: fila.correlativo,
        fechaCreacion: fila.creadoEn,
        modalidad: fila.modalidad,
        fechaSalida: fechaDeViaje(fila.fechaSalida, fila.modalidad),
        fechaRegreso: fila.fechaRegreso,
        totalSolicitado: fila.totalSolicitado,
        pipeline
      };
    });
    items.sort((a, b) => ORDEN_FASES[a.pipeline.fase] - ORDEN_FASES[b.pipeline.fase]
      || (a.fechaCreacion < b.fechaCreacion ? 1 : a.fechaCreacion > b.fechaCreacion ? -1 : b.id - a.id));
    return { desde, hasta, solicitudes: items };
  }

  async obtener(usuario, idCrudo) {
    const id = idObligatorio(idCrudo, 'Identificador de la solicitud');
    const fila = await solicitudRepo.obtenerEncabezado(id);
    if (!fila) throw new ErrorDeNegocio(msg('solicitud.noExiste', { id }), 404);
    if (fila.solicitanteId !== usuario.id) throw new ErrorDeNegocio(msg('solicitud.ajena'), 403);
    const [tramos, hospedajes, comidas, gastos, salvedades, fluidos, kit, defectos, historial] = await Promise.all([
      solicitudRepo.listarTramos(id), solicitudRepo.listarHospedajes(id), solicitudRepo.listarComidas(id),
      solicitudRepo.listarGastos(id), solicitudRepo.listarSalvedades(id), solicitudRepo.listarFluidos(id),
      solicitudRepo.listarKit(id), solicitudRepo.listarDefectos(id), solicitudRepo.listarHistorial(id)
    ]);
    const { hoy } = instante();
    const esLargo = fila.modalidad === MODALIDADES.MAS_DE_UN_DIA;
    return {
      id: fila.id,
      correlativo: fila.correlativo,
      modalidad: fila.modalidad,
      estado: fila.estado,
      fechaCreacion: fila.creadoEn,
      pais: { id: fila.paisId, codigo: fila.paisCodigo, nombre: fila.paisNombre },
      moneda: fila.monedaId ? { id: fila.monedaId, codigo: fila.monedaCodigo, nombre: fila.monedaNombre, simbolo: fila.monedaSimbolo } : null,
      solicitante: { id: fila.solicitanteId, nombre: fila.solicitanteNombre },
      motivo: { id: fila.motivoId, nombre: fila.motivoNombre },
      vehiculo: {
        id: fila.vehiculoId, marca: fila.vehiculoMarca, modelo: fila.vehiculoModelo, anio: fila.vehiculoAnio,
        placa: fila.vehiculoPlaca, esPropio: fila.vehiculoPropietarioId !== null
      },
      fechaSalida: fechaDeViaje(fila.fechaSalida, fila.modalidad),
      fechaRegreso: fila.fechaRegreso,
      rendimientoKmGalon: esLargo ? fila.rendimientoKmGalon : null,
      precioGalon: esLargo ? fila.precioGalon : null,
      depreciacionPorKm: fila.depreciacionPorKm,
      odometro: fila.odometro,
      totalSolicitado: fila.totalSolicitado,
      tramos: tramos.map(t => this.tramoDeDetalle(t)),
      hospedajes: hospedajes.map(h => ({ ...h, total: h.noches * h.valorNoche })),
      comidas,
      gastos,
      salvedades,
      inspeccion: esLargo ? null : { odometro: fila.odometro, fluidos, kit, defectos },
      historial,
      pipeline: pipelineDe(fila, hoy)
    };
  }

  // «ida» recorre el par guardado de A hacia B; «vuelta», de B hacia A.
  tramoDeDetalle(t) {
    const ida = t.sentido === 'ida';
    return {
      orden: t.orden,
      tramoId: t.tramoId,
      sentido: t.sentido,
      origenId: ida ? t.ubicacionAId : t.ubicacionBId,
      origenNombre: ida ? t.ubicacionANombre : t.ubicacionBNombre,
      destinoId: ida ? t.ubicacionBId : t.ubicacionAId,
      destinoNombre: ida ? t.ubicacionBNombre : t.ubicacionANombre,
      km: t.km,
      horas: t.horas
    };
  }
}

// Forma única de la respuesta de /solicitudes/calcular.
function respuestaDeCalculo(modalidad, { errores = [], advertencias = [], desglose = null, totales = null }) {
  return {
    modalidad,
    valido: errores.length === 0,
    errores,
    advertencias,
    salvedadIds: [...new Set(advertencias.map(a => a.salvedadId).filter(id => id !== null))],
    desglose,
    totales
  };
}

module.exports = new SolicitudService();
module.exports.semanaDe = semanaDe;
module.exports.interpretarBusqueda = interpretarBusqueda;
