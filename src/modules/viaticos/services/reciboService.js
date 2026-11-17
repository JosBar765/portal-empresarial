// src/modules/viaticos/services/reciboService.js
// Recibos firmados de la liquidación: el solicitante los genera (PDF con su firma) para respaldar comidas, depreciación u otro dinero recibido.
const db = require('../../../config/database');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const { tipoRealCoincide } = require('../../../core/files/fileSignature');
const { excedeElLimiteDePixeles } = require('../../../core/files/imagenDimensiones');
const reciboRepo = require('../repositories/reciboRepository');
const { RECIBOS, IDEMPOTENCIA, LIMITES, MOVIMIENTOS } = require('../constantes');
const { Validador, cuerpoObjeto, vacio, mostrar } = require('../validacion');
const { errorDeValidacion } = require('../errores');
const { msg } = require('../mensajes');
const { llaveDeIdempotencia, ejecutarUnaVez } = require('./idempotenciaService');
const { montoEnLetrasConMoneda } = require('./montoEnLetras');
const { generarPdfRecibo } = require('./pdf/reciboPdfService');
const { erroresDeTextos } = require('./pdf/solicitudPdfService');
const archivosService = require('./archivosViaticoService');
const solicitudService = require('./solicitudService');
const liquidacionService = require('./liquidacionService');
const movimientoService = require('./movimientoService');

const { motivoNoLiquidable, motivoSinCambios, reciboDeVista, conceptoDeRubro } = liquidacionService;
const BYTES_POR_MB = 1024 * 1024;
const RUBROS_UNICOS = [RECIBOS.RUBROS.ALIMENTACION, RECIBOS.RUBROS.DEPRECIACION];

const pipelineDe = fila => solicitudService.pipelineDe(fila, solicitudService.instante().hoy);
const prohibido = mensaje => new ErrorDeNegocio(mensaje, 403);
const monedaDe = fila => ({ nombre: fila.monedaNombre, nombrePlural: fila.monedaNombrePlural });

// 403 explicativo si la solicitud todavía no admite recibos (o ya no): mismas reglas que los comprobantes.
function exigirLiquidable(fila) {
  const bloqueo = motivoNoLiquidable(fila, pipelineDe(fila));
  if (bloqueo) throw prohibido(bloqueo);
}

// `datos` llega como texto JSON (multipart) o como objeto.
function extraerDatos(cuerpo) {
  const objeto = cuerpoObjeto(cuerpo);
  const crudo = objeto[RECIBOS.CAMPO_DATOS];
  if (crudo === undefined) throw new ErrorDeNegocio(msg('recibo.datosFalta'), 400);
  let datos = crudo;
  if (typeof crudo === 'string') {
    try {
      datos = JSON.parse(crudo);
    } catch {
      throw new ErrorDeNegocio(msg('recibo.datosJson'), 400);
    }
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new ErrorDeNegocio(msg('recibo.datosFalta'), 400);
  return datos;
}

// Errores de la firma: obligatoria, PNG de verdad (bytes mágicos), dentro del tamaño y de las dimensiones permitidas.
function erroresDeFirma(archivo) {
  const campo = RECIBOS.CAMPO_FIRMA;
  if (!archivo) return [{ campo, mensaje: msg('recibo.firmaFalta') }];
  if (archivo.mimetype !== RECIBOS.MIME_FIRMA || !tipoRealCoincide(archivo.buffer, RECIBOS.MIME_FIRMA)) {
    return [{ campo, mensaje: msg('recibo.firmaTipo', { tipo: archivo.mimetype || 'desconocido' }) }];
  }
  if (archivo.size > RECIBOS.MAX_FIRMA_MB * BYTES_POR_MB) {
    return [{ campo, mensaje: msg('recibo.firmaGrande', { tamano: (archivo.size / BYTES_POR_MB).toFixed(1), max: RECIBOS.MAX_FIRMA_MB }) }];
  }
  if (excedeElLimiteDePixeles(archivo.buffer, RECIBOS.MIME_FIRMA)) return [{ campo, mensaje: msg('recibo.firmaIlegible') }];
  return [];
}

// Valida la forma del recibo (sin tocar la base); el cupo del rubro se revisa después, con la solicitud bloqueada.
async function validarRecibo(datos, archivo) {
  const v = new Validador();
  const rubros = Object.values(RECIBOS.RUBROS);
  const formas = Object.values(RECIBOS.FORMAS_PAGO);
  let rubro = null;
  if (vacio(datos.rubro)) v.faltante('rubro', msg('recibo.etiquetaRubro'), true);
  else if (!rubros.includes(datos.rubro)) v.falla('rubro', msg('recibo.rubroInvalido', { permitidos: rubros.join(', '), valor: mostrar(datos.rubro) }));
  else rubro = datos.rubro;

  const fecha = v.fecha(datos, 'fecha', msg('recibo.etiquetaFecha'));
  const { hoy } = solicitudService.instante();
  if (fecha && fecha > hoy) v.falla('fecha', msg('recibo.fechaFutura', { fecha, hoy }));
  const monto = v.decimal(datos, 'monto', msg('recibo.etiquetaMonto'), { minExclusivo: true, max: LIMITES.VALOR_MAX });
  const recibiDe = v.texto(datos, 'recibiDe', msg('recibo.etiquetaRecibiDe'), { max: RECIBOS.RECIBI_DE });
  // Solo «otro» trae concepto del usuario; en los demás rubros lo arma el servidor y lo que llegue se ignora.
  const concepto = rubro === RECIBOS.RUBROS.OTRO ? v.texto(datos, 'concepto', msg('recibo.etiquetaConcepto'), { max: RECIBOS.CONCEPTO }) : null;

  let formaPago = null;
  if (vacio(datos.formaPago)) v.faltante('formaPago', msg('recibo.etiquetaFormaPago'), true);
  else if (!formas.includes(datos.formaPago)) v.falla('formaPago', msg('recibo.formaPagoInvalida', { permitidas: formas.join(', '), valor: mostrar(datos.formaPago) }));
  else formaPago = datos.formaPago;
  // El N.º de cheque solo se pide (y se guarda) con cheque; el de cuenta, opcional, solo con transferencia.
  const numeroCheque = formaPago === RECIBOS.FORMAS_PAGO.CHEQUE
    ? v.texto(datos, 'numeroCheque', msg('recibo.etiquetaNumeroCheque'), { max: RECIBOS.NUMERO_CHEQUE }) : null;
  const numeroCuenta = formaPago === RECIBOS.FORMAS_PAGO.TRANSFERENCIA
    ? v.texto(datos, 'numeroCuenta', msg('recibo.etiquetaNumeroCuenta'), { max: RECIBOS.NUMERO_CUENTA, requerido: false }) : null;

  const textos = [
    { campo: 'recibiDe', etiqueta: msg('recibo.etiquetaRecibiDe'), valor: recibiDe },
    { campo: 'concepto', etiqueta: msg('recibo.etiquetaConcepto'), valor: concepto },
    { campo: 'numeroCheque', etiqueta: msg('recibo.etiquetaNumeroCheque'), valor: numeroCheque },
    { campo: 'numeroCuenta', etiqueta: msg('recibo.etiquetaNumeroCuenta'), valor: numeroCuenta }
  ];
  (await erroresDeTextos(textos)).forEach(e => v.falla(e.campo, e.mensaje));
  erroresDeFirma(archivo).forEach(e => v.falla(e.campo, e.mensaje));
  v.lanzar();
  return { rubro, fecha, monto, recibiDe, concepto, formaPago, numeroCheque, numeroCuenta };
}

// Alimentación y depreciación: un solo recibo cada una y solo si se solicitaron; «otro» no tiene tope.
function exigirCupo(rubro, calculo, fila) {
  if (!RUBROS_UNICOS.includes(rubro)) return;
  const nombre = msg(`recibo.rubro.${rubro}`);
  const pendiente = calculo.pendientes.find(r => r.rubroRecibo === rubro);
  if (!pendiente) {
    throw errorDeValidacion(msg('validacion.revisar'), { rubro: msg('recibo.rubroNoSolicitado', { correlativo: fila.correlativo, rubro: nombre }) });
  }
  const existente = calculo.recibos.find(r => r.rubro === rubro);
  if (existente) {
    const mensaje = msg('recibo.rubroCompleto', { correlativo: fila.correlativo, numero: existente.numero, rubro: nombre });
    const error = new ErrorDeNegocio(mensaje, 409);
    error.campos = { rubro: mensaje };
    throw error;
  }
}

class ReciboService {
  // Vista previa del monto en letras con el plural de la moneda de la solicitud.
  async letras(usuario, idCrudo, cuerpo) {
    const fila = await solicitudService.obtenerPropia(usuario, idCrudo);
    exigirLiquidable(fila);
    const v = new Validador();
    const monto = v.decimal(cuerpoObjeto(cuerpo), 'monto', msg('recibo.etiquetaMonto'), { minExclusivo: true, max: LIMITES.VALOR_MAX });
    v.lanzar();
    return { montoLetras: montoEnLetrasConMoneda(monto, monedaDe(fila)) };
  }

  // POST /recibos con reintento seguro: la misma llave devuelve el resultado ya guardado sin generar ni subir otro PDF.
  async agregar(usuario, idCrudo, cuerpo, archivo) {
    const datos = extraerDatos(cuerpo);
    const llave = llaveDeIdempotencia(datos.idempotencyKey ?? cuerpo.idempotencyKey, usuario.id);
    return ejecutarUnaVez({ llave, endpoint: IDEMPOTENCIA.ENDPOINT_RECIBO, accion: () => this.registrar(usuario, idCrudo, datos, archivo) });
  }

  // Valida, genera el PDF firmado, lo sube y registra el recibo en una transacción con la solicitud bloqueada.
  // `externo` (solo pruebas): ejecutor de una transacción ya abierta, sin commit propio.
  async registrar(usuario, idCrudo, datos, archivo, { externo } = {}) {
    const propia = await solicitudService.obtenerPropia(usuario, idCrudo, externo);
    exigirLiquidable(propia);
    const recibo = await validarRecibo(datos, archivo);
    const subidas = [];
    let creado;
    try {
      const persistir = tx => this.persistir(tx, { id: propia.id, usuario, recibo, firma: archivo.buffer, subidas });
      creado = await (externo ? persistir(externo) : db.transaccion(persistir));
    } catch (error) {
      await archivosService.eliminarRecibos(subidas);
      throw error;
    }
    const guardado = await reciboRepo.obtener(creado, externo);
    return { recibo: reciboDeVista(guardado), ...await liquidacionService.obtener(usuario, propia.id, externo) };
  }

  async persistir(tx, { id, usuario, recibo: reciboValidado, firma, subidas }) {
    let recibo = reciboValidado;
    await liquidacionService.bloquear(id, tx);
    const fila = await solicitudService.leerEncabezado(id, tx);
    exigirLiquidable(fila);
    const calculo = await liquidacionService.calcular(fila, tx);
    exigirCupo(recibo.rubro, calculo, fila);
    // El concepto de Alimentación y Depreciación nunca viene del cliente.
    if (recibo.rubro !== RECIBOS.RUBROS.OTRO) recibo = { ...recibo, concepto: conceptoDeRubro(fila, recibo.rubro) };

    const contador = await reciboRepo.siguienteContador(id, tx);
    const numero = `${fila.correlativo}-${RECIBOS.PREFIJO_NUMERO}${contador}`;
    const montoLetras = montoEnLetrasConMoneda(recibo.monto, monedaDe(fila));
    const pdf = await generarPdfRecibo({ ...recibo, numero, montoLetras, simbolo: fila.monedaSimbolo, solicitanteNombre: fila.solicitanteNombre, firma });

    let reciboId = null;
    await archivosService.subirRecibo({
      correlativo: fila.correlativo, rubro: recibo.rubro, pdf, nombreOriginal: `${numero}.pdf`, existentes: calculo.recibos.map(r => r.ruta), subidas,
      registrar: async subida => {
        reciboId = await reciboRepo.insertar(id, { ...recibo, contador, numero, montoLetras, ruta: subida.ruta, tamano: subida.tamano }, tx);
        await movimientoService.registrar(MOVIMIENTOS.RECIBO_CREADO, fila, usuario, {
          numero, rubro: msg(`recibo.rubro.${recibo.rubro}`), monto: movimientoService.monto(fila.monedaSimbolo, recibo.monto)
        }, tx);
      }
    });
    return reciboId;
  }

  // Quitar solo se puede antes de liquidar; el PDF se borra de Storage después del commit (solo actúa en producción).
  async quitar(usuario, idCrudo, reciboIdCrudo, { externo } = {}) {
    const reciboId = idObligatorio(reciboIdCrudo, 'Identificador del recibo');
    const propia = await solicitudService.obtenerPropia(usuario, idCrudo, externo);
    const borrar = async tx => {
      await liquidacionService.bloquear(propia.id, tx);
      const fila = await solicitudService.leerEncabezado(propia.id, tx);
      const sinCambios = motivoSinCambios(fila, pipelineDe(fila));
      if (sinCambios) throw prohibido(sinCambios);
      const recibo = await reciboRepo.obtener(reciboId, tx);
      if (!recibo || recibo.solicitudId !== propia.id) {
        throw new ErrorDeNegocio(msg('recibo.noExiste', { id: reciboId, correlativo: fila.correlativo }), 404);
      }
      await reciboRepo.eliminar(reciboId, tx);
      await movimientoService.registrar(MOVIMIENTOS.RECIBO_QUITADO, fila, usuario, { numero: recibo.numero }, tx);
      return recibo.ruta;
    };
    const ruta = await (externo ? borrar(externo) : db.transaccion(borrar));
    if (!externo) await archivosService.eliminarRecibos([ruta]);
    return liquidacionService.obtener(usuario, propia.id, externo);
  }
}

module.exports = new ReciboService();
