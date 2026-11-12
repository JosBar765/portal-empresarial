// src/modules/viaticos/services/liquidacionService.js
// Liquidación de viajes de más de 1 día: el solicitante adjunta comprobantes y liquida; contabilidad solo lee.
const db = require('../../../config/database');
const notificacionService = require('../../../core/notifications/notificacionService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const solicitudRepo = require('../repositories/solicitudRepository');
const escrituraRepo = require('../repositories/solicitudEscrituraRepository');
const comprobanteRepo = require('../repositories/comprobanteRepository');
const catalogoRepo = require('../repositories/catalogoSolicitudRepository');
const destinatarioRepo = require('../repositories/destinatarioRepository');
const {
  ESTADOS, FASES, MODALIDADES, PERMISOS, NOTIFICACION, TIEMPO_REAL, IDEMPOTENCIA, LIMITES, LIMITES_SOLICITUD, ARCHIVOS, RUBROS_FIJOS
} = require('../constantes');
const events = require('../events');
const { Validador, cuerpoObjeto, vacio } = require('../validacion');
const { msg } = require('../mensajes');
const { formatearFecha } = require('./pipelineService');
const { combustibleSolicitado, calcularRubros, solicitadoALiquidar, calcularLiquidacion } = require('./liquidacionCalculoService');
const { llaveDeIdempotencia, ejecutarUnaVez } = require('./idempotenciaService');
const archivosService = require('./archivosViaticoService');
const solicitudService = require('./solicitudService');

const esLargo = fila => fila.modalidad === MODALIDADES.MAS_DE_UN_DIA;
const pipelineDe = fila => solicitudService.pipelineDe(fila, solicitudService.instante().hoy);
const prohibido = mensaje => new ErrorDeNegocio(mensaje, 403);

// Por qué una solicitud ya no admite agregar ni quitar comprobantes; null si todavía los admite (autorizada).
function motivoSinCambios(fila, pipeline) {
  const datos = { correlativo: fila.correlativo, estado: pipeline.etiqueta };
  if (!esLargo(fila)) return msg('liquidacion.soloLargo', datos);
  if (fila.estado === ESTADOS.LIQUIDADA) return msg('liquidacion.yaLiquidada', datos);
  if (fila.estado !== ESTADOS.AUTORIZADA) return msg('liquidacion.noAutorizada', datos);
  return null;
}

// Por qué todavía no se pueden agregar comprobantes ni liquidar; null si ya se puede (autorizada y con el viaje terminado).
function motivoNoLiquidable(fila, pipeline) {
  const sinCambios = motivoSinCambios(fila, pipeline);
  if (sinCambios) return sinCambios;
  if (pipeline.fase !== FASES.TERMINADA) return msg('liquidacion.viajeNoTermina', { correlativo: fila.correlativo, fecha: formatearFecha(fila.fechaRegreso) });
  return null;
}

const detalleFaltante = pendientes => pendientes
  .filter(r => r.liquidados < r.solicitados)
  .map(r => msg('liquidacion.faltaRubro', { nombre: r.nombre, faltan: r.solicitados - r.liquidados, solicitados: r.solicitados }))
  .join('; ');

const comprobanteDeVista = c => ({
  id: c.id,
  tipoGastoId: c.tipoGastoId,
  rubro: c.tipoGastoNombre,
  descripcion: c.descripcion,
  monto: c.monto,
  nombreArchivo: c.nombreOriginal,
  tipoArchivo: c.mimeType,
  tamano: c.tamano,
  url: c.ruta,
  subidoEn: c.subidoEn
});

class LiquidacionService {
  // Rubros, resumen en dinero y comprobantes de la solicitud; solo lecturas (`ejecutor` permite leer dentro de una transacción).
  async calcular(fila, ejecutor) {
    const id = fila.id;
    const [hospedajes, gastos, tramos, comprobantes, fijos] = await Promise.all([
      solicitudRepo.listarHospedajes(id, ejecutor), solicitudRepo.listarGastos(id, ejecutor), solicitudRepo.listarTramos(id, ejecutor),
      comprobanteRepo.listar(id, ejecutor), catalogoRepo.tiposGastoPorNombres(Object.values(RUBROS_FIJOS), ejecutor)
    ]);
    const fijo = nombre => {
      const tipo = fijos.find(f => f.nombre === nombre);
      if (!tipo) throw new ErrorDeNegocio(msg('liquidacion.rubroFijoFalta', { nombre }), 409);
      return tipo;
    };
    const tipoHospedaje = fijo(RUBROS_FIJOS.HOSPEDAJE);
    const tipoCombustible = fijo(RUBROS_FIJOS.COMBUSTIBLE);
    const tipos = await catalogoRepo.tiposGastoPorIds([...new Set(gastos.map(g => g.tipoGastoId))], ejecutor);
    const combustible = combustibleSolicitado({ tramos, rendimientoKmGalon: fila.rendimientoKmGalon, precioGalon: fila.precioGalon });
    const rubros = calcularRubros({ hospedajes, gastos, combustible, tipoHospedaje, tipoCombustible, tiposGasto: new Map(tipos.map(t => [t.id, t])) });
    return { ...calcularLiquidacion({ rubros, solicitado: solicitadoALiquidar({ hospedajes, gastos, combustible }), comprobantes }), comprobantes };
  }

  // Liquidación del propio solicitante: resumen, pendientes por rubro, comprobantes y si ya puede liquidar (y si no, por qué).
  async obtener(usuario, idCrudo, ejecutor) {
    const fila = await solicitudService.obtenerPropia(usuario, idCrudo, ejecutor);
    const pipeline = pipelineDe(fila);
    if (!esLargo(fila) || (fila.estado !== ESTADOS.AUTORIZADA && fila.estado !== ESTADOS.LIQUIDADA)) throw prohibido(motivoSinCambios(fila, pipeline));
    const calculo = await this.calcular(fila, ejecutor);
    const bloqueo = motivoNoLiquidable(fila, pipeline);
    const avisoFaltantes = calculo.faltanComprobantes > 0 ? msg('liquidacion.faltan', { correlativo: fila.correlativo, detalle: detalleFaltante(calculo.pendientes) }) : null;
    return {
      solicitudId: fila.id,
      correlativo: fila.correlativo,
      estado: fila.estado,
      moneda: { id: fila.monedaId, codigo: fila.monedaCodigo, nombre: fila.monedaNombre, simbolo: fila.monedaSimbolo },
      resumen: calculo.resumen,
      pendientes: calculo.pendientes,
      faltanComprobantes: calculo.faltanComprobantes,
      comprobantes: calculo.comprobantes.map(comprobanteDeVista),
      editable: bloqueo === null,
      puedeLiquidar: bloqueo === null,
      motivoNoPuedeLiquidar: bloqueo,
      avisoFaltantes
    };
  }

  // Vista de solo lectura para contabilidad: cualquier solicitud de más de 1 día autorizada o liquidada, con o sin comprobantes.
  async obtenerDeGestion(idCrudo) {
    const fila = await solicitudService.leerEncabezado(idCrudo);
    const pipeline = pipelineDe(fila);
    if (!esLargo(fila)) throw prohibido(msg('liquidacion.soloLargo', { correlativo: fila.correlativo }));
    if (fila.estado !== ESTADOS.AUTORIZADA && fila.estado !== ESTADOS.LIQUIDADA) {
      throw prohibido(msg('liquidacion.gestionNoDisponible', { correlativo: fila.correlativo, estado: pipeline.etiqueta }));
    }
    const calculo = await this.calcular(fila);
    return {
      solicitudId: fila.id,
      correlativo: fila.correlativo,
      estado: fila.estado,
      pipeline: { fase: pipeline.fase, etiqueta: pipeline.etiqueta },
      solicitante: { id: fila.solicitanteId, nombre: fila.solicitanteNombre },
      pais: { codigo: fila.paisCodigo, nombre: fila.paisNombre },
      moneda: { id: fila.monedaId, codigo: fila.monedaCodigo, nombre: fila.monedaNombre, simbolo: fila.monedaSimbolo },
      resumen: calculo.resumen,
      diferencia: calculo.diferencia,
      pendientes: calculo.pendientes,
      faltanComprobantes: calculo.faltanComprobantes,
      comprobantes: calculo.comprobantes.map(comprobanteDeVista),
      pdf: fila.pdfRuta ? { titulo: msg('documento.tituloPdf', { correlativo: fila.correlativo }), tipo: 'pdf', url: fila.pdfRuta } : null
    };
  }

  // POST /comprobantes con reintento seguro: la misma llave devuelve el resultado ya guardado sin subir otra vez el archivo.
  async agregarComprobante(usuario, idCrudo, cuerpo, archivo) {
    const llave = llaveDeIdempotencia(cuerpoObjeto(cuerpo).idempotencyKey, usuario.id);
    return ejecutarUnaVez({
      llave, endpoint: IDEMPOTENCIA.ENDPOINT_COMPROBANTE, accion: () => this.registrarComprobante(usuario, idCrudo, cuerpo, archivo)
    });
  }

  // Valida, sube el archivo y registra el comprobante en una transacción con la solicitud bloqueada.
  // `externo` (solo pruebas): ejecutor de una transacción ya abierta, sin commit propio.
  async registrarComprobante(usuario, idCrudo, cuerpo, archivo, { externo } = {}) {
    const datos = cuerpoObjeto(cuerpo);
    const propia = await solicitudService.obtenerPropia(usuario, idCrudo, externo);
    const ajustes = await archivosService.leerAjustes();
    const subidas = [];
    let creado;
    try {
      const persistir = tx => this.persistirComprobante(tx, { id: propia.id, datos, archivo, ajustes, subidas });
      creado = await (externo ? persistir(externo) : db.transaccion(persistir));
    } catch (error) {
      await archivosService.eliminarArchivos(subidas);
      throw error;
    }
    const comprobante = await comprobanteRepo.obtener(creado, externo);
    return { comprobante: comprobanteDeVista(comprobante), ...await this.obtener(usuario, propia.id, externo) };
  }

  async persistirComprobante(tx, { id, datos, archivo, ajustes, subidas }) {
    await this.bloquear(id, tx);
    const fila = await solicitudService.leerEncabezado(id, tx);
    const bloqueo = motivoNoLiquidable(fila, pipelineDe(fila));
    if (bloqueo) throw prohibido(bloqueo);
    const calculo = await this.calcular(fila, tx);

    const v = new Validador();
    const tipoGastoId = v.id(datos, 'tipoGastoId', msg('liquidacion.etiquetaRubro'));
    const monto = v.decimal(datos, 'monto', msg('liquidacion.etiquetaMonto'), { minExclusivo: true, max: LIMITES.VALOR_MAX });
    const rubro = tipoGastoId === null ? null : calculo.pendientes.find(r => r.tipoGastoId === tipoGastoId);
    if (tipoGastoId !== null && !rubro) {
      const lista = calculo.pendientes.map(r => `${r.nombre} (${r.solicitados})`).join(', ') || msg('liquidacion.sinRubros');
      v.falla('tipoGastoId', msg('liquidacion.rubroNoSolicitado', { rubros: lista }));
    } else if (rubro && rubro.liquidados >= rubro.solicitados) {
      v.falla('tipoGastoId', msg('liquidacion.rubroCompleto', { nombre: rubro.nombre, solicitados: rubro.solicitados, liquidados: rubro.liquidados }));
    }
    let descripcion = null;
    if (rubro && rubro.esOtros) {
      if (vacio(datos.descripcion)) v.falla('descripcion', msg('liquidacion.descripcionObligatoria', { rubro: rubro.nombre, max: LIMITES_SOLICITUD.DESCRIPCION }));
      else descripcion = v.texto(datos, 'descripcion', msg('liquidacion.etiquetaDescripcion'), { max: LIMITES_SOLICITUD.DESCRIPCION });
    }
    if (!archivo) v.falla(ARCHIVOS.CAMPO_ARCHIVO, msg('liquidacion.archivoFalta'));
    else archivosService.erroresDeArchivo(archivo, ajustes, ARCHIVOS.CAMPO_ARCHIVO).forEach(e => v.falla(e.campo, e.mensaje));
    v.lanzar();

    let comprobanteId = null;
    await archivosService.subirComprobante({
      correlativo: fila.correlativo, rubro: rubro.nombre, archivo, existentes: calculo.comprobantes.map(c => c.ruta), subidas,
      registrar: async subida => {
        comprobanteId = await comprobanteRepo.insertar(id, { tipoGastoId, descripcion, monto, nombreOriginal: String(archivo.originalname || '').slice(0, 255), ...subida }, tx);
      }
    });
    return comprobanteId;
  }

  // Quitar solo se puede antes de liquidar; el archivo se borra de Storage después del commit (solo actúa en producción).
  async quitarComprobante(usuario, idCrudo, comprobanteIdCrudo, { externo } = {}) {
    const comprobanteId = idObligatorio(comprobanteIdCrudo, 'Identificador del comprobante');
    const propia = await solicitudService.obtenerPropia(usuario, idCrudo, externo);
    const borrar = async tx => {
      await this.bloquear(propia.id, tx);
      const fila = await solicitudService.leerEncabezado(propia.id, tx);
      const sinCambios = motivoSinCambios(fila, pipelineDe(fila));
      if (sinCambios) throw prohibido(sinCambios);
      const comprobante = await comprobanteRepo.obtener(comprobanteId, tx);
      if (!comprobante || comprobante.solicitudId !== propia.id) {
        throw new ErrorDeNegocio(msg('liquidacion.comprobanteNoExiste', { id: comprobanteId, correlativo: fila.correlativo }), 404);
      }
      await comprobanteRepo.eliminar(comprobanteId, tx);
      return comprobante.ruta;
    };
    const ruta = await (externo ? borrar(externo) : db.transaccion(borrar));
    if (!externo) await archivosService.eliminarArchivos([ruta]);
    return this.obtener(usuario, propia.id, externo);
  }

  // Liquida en una transacción con la fila bloqueada: se vuelve a comprobar estado y fin del viaje. No exige todos los comprobantes: el solicitante decide cuándo marcarla.
  // `externo` (solo pruebas): ejecutor de una transacción ya abierta; sin commit propio ni efectos posteriores.
  async liquidar(usuario, idCrudo, { externo } = {}) {
    const propia = await solicitudService.obtenerPropia(usuario, idCrudo, externo);
    const aplicar = async tx => {
      await this.bloquear(propia.id, tx);
      const fila = await solicitudService.leerEncabezado(propia.id, tx);
      const bloqueo = motivoNoLiquidable(fila, pipelineDe(fila));
      if (bloqueo) throw prohibido(bloqueo);
      const estadoId = await escrituraRepo.estadoId(ESTADOS.LIQUIDADA, tx);
      await escrituraRepo.actualizarEstado(propia.id, estadoId, tx);
      await escrituraRepo.insertarHistorial(propia.id, estadoId, usuario.id, null, tx);
    };
    await (externo ? aplicar(externo) : db.transaccion(aplicar));
    if (!externo) await this.despuesDelCommit(usuario, propia);
    return solicitudService.obtener(usuario, propia.id, externo);
  }

  // Bloquea la solicitud hasta el fin de la transacción: dos cambios simultáneos no pueden ver el mismo estado.
  async bloquear(id, tx) {
    if ((await escrituraRepo.bloquear(id, tx)) === null) throw new ErrorDeNegocio(msg('solicitud.noExiste', { id }), 404);
  }

  // Aviso a contabilidad y tiempo real; un fallo se registra y no deshace la liquidación.
  async despuesDelCommit(usuario, fila) {
    try {
      const destinatarios = await destinatarioRepo.listarConPermiso(PERMISOS.LIQUIDAR);
      await notificacionService.registrar(destinatarios, {
        modulo: NOTIFICACION.MODULO,
        tipo: NOTIFICACION.TIPO_LIQUIDADA,
        nivel: NOTIFICACION.NIVEL,
        mensaje: msg('notificacion.solicitudLiquidada', { correlativo: fila.correlativo, solicitante: fila.solicitanteNombre })
      });
    } catch (error) {
      console.error('[Viáticos] No se pudo notificar la liquidación de la solicitud:', error.message);
    }
    events.emitirActualizacion({
      id: fila.id, correlativo: fila.correlativo, estado: ESTADOS.LIQUIDADA, solicitanteId: usuario.id, accion: TIEMPO_REAL.ACCION_LIQUIDADA
    });
  }
}

module.exports = new LiquidacionService();
module.exports.motivoNoLiquidable = motivoNoLiquidable;
