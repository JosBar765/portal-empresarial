// src/modules/viaticos/services/solicitudGuardadoService.js
// Casos de uso del solicitante que escriben: crear, modificar y dar de baja. El servidor recalcula todo y
// valida antes de tocar la base; la solicitud y sus partes se guardan en una sola transacción.
const db = require('../../../config/database');
const notificacionService = require('../../../core/notifications/notificacionService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const solicitudRepo = require('../repositories/solicitudRepository');
const escrituraRepo = require('../repositories/solicitudEscrituraRepository');
const destinatarioRepo = require('../repositories/destinatarioRepository');
const {
  MODALIDADES, ESTADOS, ESTADOS_EDITABLES, ACCIONES, PERMISOS, SENTIDOS_TRAMO, IDEMPOTENCIA, NOTIFICACION, TIEMPO_REAL, CORRELATIVO, ETAPAS_DOCUMENTO
} = require('../constantes');
const events = require('../events');
const { errorDeValidacion } = require('../errores');
const { msg } = require('../mensajes');
const { calcularSolicitud } = require('./calculoService');
const { normalizarDatos, evaluar, claveDePar } = require('./validacionSolicitudService');
const archivosService = require('./archivosViaticoService');
const { llaveDeIdempotencia, ejecutarUnaVez } = require('./idempotenciaService');
const documentoService = require('./documentoService');
const { erroresDeTextos } = require('./pdf/solicitudPdfService');
const solicitudService = require('./solicitudService');

// `datos` llega como texto JSON (multipart), como objeto envuelto o como el payload directo (JSON puro).
function extraerDatos(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new ErrorDeNegocio(msg('solicitud.datosFalta'), 400);
  let datos = cuerpo;
  if (typeof cuerpo.datos === 'string') {
    try {
      datos = JSON.parse(cuerpo.datos);
    } catch {
      throw new ErrorDeNegocio(msg('solicitud.datosJson'), 400);
    }
  } else if (cuerpo.datos !== undefined) {
    datos = cuerpo.datos;
  } else if (cuerpo.modalidad === undefined) {
    throw new ErrorDeNegocio(msg('solicitud.datosFalta'), 400);
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new ErrorDeNegocio(msg('solicitud.datosFalta'), 400);
  return datos;
}

// Lista de errores {campo, mensaje} a mapa por campo; el primero de cada campo gana.
function aCampos(errores) {
  const campos = {};
  errores.forEach(e => { if (!Object.prototype.hasOwnProperty.call(campos, e.campo)) campos[e.campo] = e.mensaje; });
  return campos;
}

// Textos escritos a mano que terminan en el PDF: se rechazan los caracteres que su fuente no dibuja.
function textosLibres(datos) {
  const defectos = datos.inspeccion ? datos.inspeccion.defectos : [];
  return [
    ...datos.hospedajes.flatMap((h, i) => [
      { campo: `hospedajes[${i}].hotel`, etiqueta: `Hotel del renglón ${i + 1}`, valor: h.hotel },
      { campo: `hospedajes[${i}].lugar`, etiqueta: `Lugar del renglón ${i + 1}`, valor: h.lugar }
    ]),
    ...datos.gastos.map((g, i) => ({ campo: `gastos[${i}].descripcion`, etiqueta: `Descripción del gasto ${i + 1}`, valor: g.descripcion })),
    ...defectos.map((d, i) => ({ campo: `inspeccion.defectos[${i}].descripcion`, etiqueta: `Descripción del defecto ${i + 1}`, valor: d.descripcion }))
  ];
}

const formatearCorrelativo = (codigoPais, numero) => `${CORRELATIVO.PREFIJO}-${codigoPais}-${String(numero).padStart(CORRELATIVO.DIGITOS, '0')}`;

// Todo lo que se guarda, derivado de los datos validados y del cálculo del servidor: nada del cliente que sea un importe.
function armarPartes({ datos, ctx, evaluacion, calculo }) {
  const esLargo = datos.modalidad === MODALIDADES.MAS_DE_UN_DIA;
  const inspeccion = datos.inspeccion;
  return {
    encabezado: {
      paisId: datos.paisId,
      monedaId: esLargo ? datos.monedaId : null,
      modalidad: datos.modalidad,
      motivoId: datos.motivoId,
      vehiculoId: datos.vehiculoId,
      fechaSalida: datos.fechaSalida,
      fechaRegreso: esLargo ? datos.fechaRegreso : null,
      rendimientoKmGalon: esLargo ? datos.rendimientoKmGalon : null,
      precioGalon: esLargo ? datos.precioGalon : null,
      depreciacionPorKm: esLargo && evaluacion.vehiculoPropio ? datos.depreciacionPorKm : null,
      odometro: esLargo ? null : inspeccion.odometro,
      totalSolicitado: calculo.totales.totalSolicitado
    },
    // «ida» si el origen es la ubicación A del par guardado; «vuelta» si es la B.
    tramos: evaluacion.tramos.map(t => ({
      orden: t.orden,
      tramoId: t.tramoId,
      sentido: t.origenId === ctx.tramosPorPar.get(claveDePar(t.origenId, t.destinoId)).ubicacionAId ? SENTIDOS_TRAMO.IDA : SENTIDOS_TRAMO.VUELTA,
      km: t.km,
      horas: t.horas
    })),
    hospedajes: datos.hospedajes,
    comidas: datos.comidas.map(c => ({ ...c, valorUnitario: ctx.valoresPorTipo[c.tipoComidaId] })),
    gastos: datos.gastos,
    salvedadIds: [...new Set(evaluacion.advertencias.map(a => a.salvedadId).filter(id => id !== null))],
    fluidos: inspeccion ? inspeccion.fluidos : [],
    kit: inspeccion ? inspeccion.kit : [],
    defectos: inspeccion ? inspeccion.defectos : []
  };
}

class SolicitudGuardadoService {
  async crear(usuario, cuerpo, archivos = []) {
    const datos = extraerDatos(cuerpo);
    const llave = llaveDeIdempotencia(datos.idempotencyKey, usuario.id);
    return ejecutarUnaVez({ llave, endpoint: IDEMPOTENCIA.ENDPOINT_CREAR, accion: () => this.guardar(usuario, datos, archivos) });
  }

  async modificar(usuario, idCrudo, cuerpo, archivos = []) {
    const previa = await solicitudService.obtenerPropia(usuario, idCrudo);
    const pipeline = solicitudService.pipelineDe(previa, solicitudService.instante().hoy);
    if (!pipeline.acciones.includes(ACCIONES.MODIFICAR)) {
      throw new ErrorDeNegocio(msg('solicitud.noModificable', { correlativo: previa.correlativo, estado: pipeline.etiqueta }), 403);
    }
    return this.guardar(usuario, extraerDatos(cuerpo), archivos, { previa });
  }

  // Valida, guarda en una transacción y después del commit regenera el PDF y notifica (sus fallos no deshacen nada).
  // `externo` (solo pruebas): ejecutor de una transacción ya abierta; sin commit propio, no hay pasos posteriores y devuelve { id, correlativo }.
  async guardar(usuario, datosCrudos, archivos, { previa = null, externo } = {}) {
    const { datos, errores: erroresForma } = normalizarDatos(datosCrudos);
    const errores = [...erroresForma];
    let ctx = null;
    let evaluacion = null;
    if (erroresForma.length === 0) {
      const { hoy, ahora } = solicitudService.instante();
      ctx = await solicitudService.cargarContexto(usuario.id, datos, { excluirSolicitudId: previa ? previa.id : null, ejecutor: externo });
      evaluacion = evaluar({ datos, ctx, hoy, ahora });
      // Al modificar, los defectos cuya foto se puede conservar son los que la solicitud tiene hoy.
      const previos = previa ? new Set((await solicitudRepo.listarArchivosDefectos(previa.id, externo)).map(d => d.id)) : null;
      errores.push(...evaluacion.errores, ...archivosService.validarDefectos({ datos, archivos, ajustes: await archivosService.leerAjustes(), previos }));
      errores.push(...await erroresDeTextos(textosLibres(datos)));
    }
    if (errores.length > 0) throw errorDeValidacion(msg('validacion.revisar'), aCampos(errores));

    const calculo = calcularSolicitud({
      datos,
      tramos: evaluacion.tramos,
      vehiculoPropio: evaluacion.vehiculoPropio,
      tiposComida: ctx.tiposComida,
      valoresPorTipo: ctx.valoresPorTipo,
      monedaNombre: ctx.moneda ? ctx.moneda.nombre : ''
    });
    const partes = armarPartes({ datos, ctx, evaluacion, calculo });

    const subidas = [];
    let guardado;
    try {
      const persistir = tx => this.persistir(tx, { usuario, ctx, partes, archivos, previa, subidas });
      guardado = await (externo ? persistir(externo) : db.transaccion(persistir));
    } catch (error) {
      await archivosService.eliminarArchivos(subidas);
      throw error;
    }
    if (externo) return { id: guardado.id, correlativo: guardado.correlativo };

    await archivosService.eliminarArchivos(guardado.fotosDescartadas);
    return this.despuesDelCommit(usuario, guardado.id, Boolean(previa));
  }

  async persistir(tx, { usuario, ctx, partes, archivos, previa, subidas }) {
    const estadoId = await escrituraRepo.estadoId(ESTADOS.ESPERANDO_AUTORIZACION, tx);
    let id;
    let correlativo;
    let fotosAnteriores = [];
    let previos = [];
    if (previa) {
      await this.bloquearEditable(previa.id, previa.correlativo, 'solicitud.noModificable', tx);
      id = previa.id;
      correlativo = previa.correlativo;
      previos = await solicitudRepo.listarArchivosDefectos(id, tx);
      fotosAnteriores = previos.map(d => d.ruta);
      // Se revalida con la fila bloqueada: los defectos pudieron cambiar desde la lectura previa.
      const invalidos = archivosService.validarConservados(partes.defectos, new Set(previos.map(d => d.id)));
      if (invalidos.length > 0) throw errorDeValidacion(msg('validacion.revisar'), aCampos(invalidos));
      await escrituraRepo.borrarPartes(id, tx);
      await escrituraRepo.actualizarEncabezado(id, { ...partes.encabezado, estadoId }, tx);
    } else {
      correlativo = formatearCorrelativo(ctx.pais.codigo, await escrituraRepo.siguienteNumero(partes.encabezado.paisId, tx));
      id = await escrituraRepo.insertarEncabezado({ ...partes.encabezado, correlativo, solicitanteId: usuario.id, estadoId }, tx);
    }
    await escrituraRepo.insertarTramos(id, partes.tramos, tx);
    await escrituraRepo.insertarHospedajes(id, partes.hospedajes, tx);
    await escrituraRepo.insertarComidas(id, partes.comidas, tx);
    await escrituraRepo.insertarGastos(id, partes.gastos, tx);
    await escrituraRepo.insertarSalvedades(id, partes.salvedadIds, tx);
    await escrituraRepo.insertarFluidos(id, partes.fluidos, tx);
    await escrituraRepo.insertarKit(id, partes.kit, tx);
    const conservados = new Map(previos.map(d => [d.id, d]));
    await archivosService.subirDefectos({
      correlativo, etapa: previa ? ETAPAS_DOCUMENTO.CORRECCION : ETAPAS_DOCUMENTO.CREACION,
      defectos: partes.defectos, archivos, existentes: fotosAnteriores, conservados, subidas,
      registrar: defecto => escrituraRepo.insertarDefecto(id, defecto, tx)
    });
    await escrituraRepo.insertarHistorial(id, estadoId, usuario.id, null, tx);
    // Solo se borran de Storage las fotos de los defectos que ya no están; las conservadas siguen en uso.
    const enUso = new Set(partes.defectos.filter(d => conservados.has(d.defectoId)).map(d => conservados.get(d.defectoId).ruta));
    return { id, correlativo, fotosDescartadas: fotosAnteriores.filter(ruta => !enUso.has(ruta)) };
  }

  // Bloquea la fila y confirma que sigue en un estado editable (pudo cambiar desde la lectura previa).
  async bloquearEditable(id, correlativo, claveMensaje, tx) {
    const estado = await escrituraRepo.bloquear(id, tx);
    if (estado === null) throw new ErrorDeNegocio(msg('solicitud.noExiste', { id }), 404);
    if (!ESTADOS_EDITABLES.includes(estado)) throw new ErrorDeNegocio(msg(claveMensaje, { correlativo, estado }), 403);
  }

  async despuesDelCommit(usuario, id, esModificacion) {
    try {
      await documentoService.regenerarPdf(id, { etapa: esModificacion ? ETAPAS_DOCUMENTO.CORRECCION : ETAPAS_DOCUMENTO.CREACION });
    } catch (error) {
      console.error('[Viáticos] No se pudo regenerar el PDF de la solicitud:', error.message);
    }
    const detalle = await solicitudService.obtener(usuario, id);
    try {
      const destinatarios = await destinatarioRepo.listarConPermiso(PERMISOS.AUTORIZAR);
      await notificacionService.registrar(destinatarios, {
        modulo: NOTIFICACION.MODULO,
        tipo: esModificacion ? NOTIFICACION.TIPO_MODIFICADA : NOTIFICACION.TIPO_NUEVA,
        nivel: NOTIFICACION.NIVEL,
        mensaje: msg(esModificacion ? 'notificacion.solicitudModificada' : 'notificacion.solicitudNueva', {
          correlativo: detalle.correlativo, solicitante: detalle.solicitante.nombre
        })
      });
    } catch (error) {
      console.error('[Viáticos] No se pudo notificar la solicitud:', error.message);
    }
    events.emitirActualizacion({
      id: detalle.id, correlativo: detalle.correlativo, estado: detalle.estado, solicitanteId: usuario.id,
      accion: esModificacion ? TIEMPO_REAL.ACCION_MODIFICADA : TIEMPO_REAL.ACCION_CREADA
    });
    return detalle;
  }

  // Borra el registro (las partes caen por CASCADE) y después los archivos de Storage.
  async darDeBaja(usuario, idCrudo, { externo } = {}) {
    const fila = await solicitudService.obtenerPropia(usuario, idCrudo, externo);
    const pipeline = solicitudService.pipelineDe(fila, solicitudService.instante().hoy);
    if (!pipeline.acciones.includes(ACCIONES.DAR_DE_BAJA)) {
      throw new ErrorDeNegocio(msg('solicitud.noSeDaDeBaja', { correlativo: fila.correlativo, estado: pipeline.etiqueta }), 403);
    }
    const borrar = async tx => {
      await this.bloquearEditable(fila.id, fila.correlativo, 'solicitud.noSeDaDeBaja', tx);
      const urls = (await solicitudRepo.listarArchivosDefectos(fila.id, tx)).map(d => d.ruta);
      const actual = await solicitudRepo.obtenerEncabezado(fila.id, tx);
      await escrituraRepo.eliminar(fila.id, tx);
      return [...urls, actual.pdfRuta];
    };
    const urls = await (externo ? borrar(externo) : db.transaccion(borrar));
    if (!externo) {
      await archivosService.eliminarArchivos(urls);
      events.emitirActualizacion({
        id: fila.id, correlativo: fila.correlativo, estado: null, solicitanteId: usuario.id, accion: TIEMPO_REAL.ACCION_DADA_DE_BAJA
      });
    }
    return { id: fila.id, correlativo: fila.correlativo };
  }
}

module.exports = new SolicitudGuardadoService();
module.exports.extraerDatos = extraerDatos;
module.exports.formatearCorrelativo = formatearCorrelativo;
