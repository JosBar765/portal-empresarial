// src/modules/vales/services/valeModificacionService.js
// Modificación de un vale ya entregado: al solicitarla nace el vale MOD-, un vale nuevo que sigue el flujo normal
// (esperando al supervisor, rechazo con motivo, corrección, baja, vigencia de 24 h). El original no cambia de estado;
// al autorizarse el MOD- se reparte a los mismos talleres y el original queda RECIBIDO.
const crypto = require('crypto');
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const valeModificacionRepository = require('../repositories/valeModificacionRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const documentoRepository = require('../repositories/documentoRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const historialRepository = require('../repositories/historialRepository');
const supabaseStorage = require('../../../core/files/supabaseStorage');
const idempotencyRepository = require('../../../core/idempotency/idempotencyRepository');
const capacidadEntregaService = require('./capacidadEntregaService');
const valeCreacionService = require('./valeCreacionService');
const valeCorreccionService = require('./valeCorreccionService');
const valeVistoService = require('./valeVistoService');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const {
  ESTADOS, ROL, hoyISO, horaActual, vencimiento24h, enriquecer, registrarHistorial,
  esAdministrador, esValeDeModificacion, requerirVale, assertPropioDelAsesor, puedeActuarComoAsesor
} = require('./valeHelpers');

const MAX_IMAGENES = 10;
const MAX_DOCUMENTOS = 5;

class ValeModificacionService {
  async solicitarModificacion(usuario, valeId, payload, archivos) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const key = payload.idempotencyKey || crypto.randomUUID();
      const previo = await idempotencyRepository.buscar(key);
      if (previo) return previo.resultado;

      valeCreacionService.exigirDiaHabil('solicitar modificaciones');
      if (!puedeActuarComoAsesor(usuario)) throw new Error('Solo un asesor o un supervisor de ventas puede solicitar una modificación.');
      const original = await requerirVale(valeId);
      assertPropioDelAsesor(usuario, original);
      if (![ESTADOS.RECIBIDO, ESTADOS.PENDIENTE_CONFIRMACION].includes(original.estado)) {
        throw new Error('Solo se puede solicitar una modificación de un vale que ya fue entregado o recibido.');
      }
      if (esValeDeModificacion(original) || original.modificado) {
        throw new Error('Este vale ya usó su única modificación permitida.');
      }
      const justificacion = String(payload.descripcion || '').trim();
      if (!justificacion) throw new Error('Escribe la justificación de la modificación.');
      const datos = await valeCreacionService.validarDatosVale({ ...payload, descripcion: justificacion }, { requiereTalleres: false });
      // La modificación va a los mismos talleres del original.
      const filasOriginal = await valeTallerRepository.listarPorVale(valeId);
      const talleresIds = [...new Set(filasOriginal.map(f => f.taller_id))];
      await capacidadEntregaService.validarLimiteDiario(talleresIds, datos.fechaEntregaNorm.slice(0, 10));

      const correlativo = original.correlativo.startsWith('MOD-') ? original.correlativo : `MOD-${original.correlativo}`;
      if (await valeRepository.obtenerModificacionEnTramite(valeId) || await valeRepository.obtenerPorCorrelativo(correlativo)) {
        throw new Error('Ya hay una solicitud de modificación en curso para este vale.');
      }
      const documentosOriginal = await documentoRepository.listarPorVale(valeId);
      const quitarIds = valeCorreccionService._idsAQuitar(payload.documentosQuitar, documentosOriginal);
      const conservados = documentosOriginal.filter(d => !quitarIds.includes(d.id)).map(d => ({ ...d, nuevo: false }));
      const nuevasImagenes = (archivos && archivos.imagenes) || [];
      const nuevosDocumentos = (archivos && archivos.documentos) || [];
      if (conservados.filter(d => d.tipo === 'imagen').length + nuevasImagenes.length > MAX_IMAGENES
        || conservados.filter(d => d.tipo === 'documento').length + nuevosDocumentos.length > MAX_DOCUMENTOS) {
        throw new Error(`Un vale admite hasta ${MAX_IMAGENES} imágenes y ${MAX_DOCUMENTOS} documentos.`);
      }

      // Se sube todo lo nuevo primero; si algo falla antes de que la base confirme, se borra lo recién subido.
      const subidos = [];
      let modId;
      try {
        const nuevos = (await valeCorreccionService._subirNuevos(nuevasImagenes, nuevosDocumentos, subidos)).map(d => ({ ...d, nuevo: true }));
        const documentos = [...conservados, ...nuevos];
        const fecha = hoyISO();
        const hora = horaActual();
        const valeMod = {
          ...valeCorreccionService._valeConDatos(original, { ...datos, talleresIds }),
          correlativo, vale_original_id: original.id, fecha_creacion: fecha, hora_creacion: hora,
          autorizado_por: null, autorizacion_tipo: null, modificado: 0
        };
        const pdfBuffer = await valeCreacionService.generarBufferPdf(valeMod, documentos);
        const pdf = await supabaseStorage.subir(pdfBuffer, `${correlativo}.pdf`, 'application/pdf');
        subidos.push(pdf.url);
        modId = await valeModificacionRepository.crear({
          original, datos, correlativo, fechaCreacion: fecha, horaCreacion: hora, pdfUrl: pdf.url,
          documentos, usuarioId: usuario.id, talleresIds, vigenciaHasta: vencimiento24h()
        });
      } catch (error) {
        await valeCorreccionService._borrarDeStorage(subidos);
        throw error;
      }

      const actualizado = await valeRepository.obtenerPorId(valeId);
      const nuevoMod = await valeRepository.obtenerPorId(modId);
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id);
      valeEvents.notificar({
        vale: nuevoMod, accion: `creado, esperando autorización (modificación de ${original.correlativo})`, actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${usuario.id}`, ...supervisores.map(s => `supervisor:${s.id}`)]
      });
      const resultado = { ...enriquecer(actualizado), modificacionId: modId };
      await idempotencyRepository.registrar(key, 'vales.solicitarModificacion', resultado);
      return resultado;
    });
  }

  async _validarSupervisor(usuario, vale) {
    if (esAdministrador(usuario)) return;
    const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
    if (!supervisores.some(s => s.id === usuario.id)) throw new Error('Este vale es de un asesor que no está a tu cargo.');
  }

  // `valeId` es el del vale MOD-: se autoriza como cualquier vale pendiente y el original queda RECIBIDO.
  async aprobarModificacion(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
      valeCreacionService.exigirNoDomingo('aprobar modificaciones');
      const mod = await requerirVale(valeId);
      if (!esValeDeModificacion(mod)) throw new Error('Este vale no es una solicitud de modificación.');
      if (mod.estado === ESTADOS.MODIFICADO) {
        throw new Error('La modificación de este vale ya fue aprobada.');
      } else if (mod.estado !== ESTADOS.SOLICITANDO_MODIFICACION) {
        throw new Error('Esta modificación no está esperando autorización.');
      }
      await this._validarSupervisor(usuario, mod);
      return valeMutex.conLockDeVale(mod.vale_original_id, async () => {
        const original = await requerirVale(mod.vale_original_id);
        if (![ESTADOS.RECIBIDO, ESTADOS.PENDIENTE_CONFIRMACION].includes(original.estado)) {
          throw new Error('El vale original ya no está en un estado que permita aprobar la modificación.');
        }
        valeCreacionService.exigirFechaAutorizable(mod);
        await valeVistoService.exigirVisto(usuario, mod.id);
        const talleresIds = (mod.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);

        // El vale MOD- recién ocupa cupo al autorizarse; si varios supervisores compiten por el último lugar, gana uno.
        await valeMutex.conColaDeCapacidad(async () => {
          await capacidadEntregaService.validarLimiteDiario(talleresIds, String(mod.fecha_entrega).slice(0, 10), { paraSupervisor: true });
          await valeCreacionService.fanOutTalleres(mod.id, talleresIds);
        });
        const ahora = `${hoyISO()} ${horaActual()}`;
        await valeRepository.sellarAutorizacion(mod.id, { autorizadoPor: usuario.id, autorizadoEn: ahora, autorizacionTipo: 'MODIFICACION' });
        await valeRepository.actualizarEstado(mod.id, ESTADOS.MODIFICADO);

        // El documento adjunto al vale MOD- incluye la propuesta ya aprobada del original.
        const propuestaOriginal = original.propuesta_general_url
          || (await propuestaRepository.obtenerUltimaPorVale(original.id))?.url;
        if (propuestaOriginal) {
          await documentoRepository.crear({
            valeId: mod.id, nombreOriginal: `Propuesta original - ${original.correlativo}.pdf`, ruta: propuestaOriginal,
            tipo: 'documento', mimeType: 'application/pdf', tamano: 0, esModificacion: true, subidoPor: usuario.id
          });
        }
        await valeRepository.marcarModificado(original.id);
        const estadoPrevio = original.estado;
        await valeRepository.actualizarEstado(original.id, ESTADOS.RECIBIDO);
        // Si el original llegó aquí sin haber sido confirmado, este es el único momento en que su atraso se congela.
        await valeRepository.congelarAtraso(original.id, ahora);

        const nombresTalleres = await valeCreacionService.nombresDeTalleres(talleresIds);
        await registrarHistorial(original.id, usuario.id, null, estadoPrevio, ESTADOS.RECIBIDO,
          `Supervisor aprobó la solicitud de modificación — se creó el vale ${mod.correlativo}`);
        await registrarHistorial(mod.id, usuario.id, null, ESTADOS.SOLICITANDO_MODIFICACION, ESTADOS.MODIFICADO,
          `Supervisor autorizó la modificación de ${original.correlativo} — enviado a taller${talleresIds.length > 1 ? 'es' : ''}: ${nombresTalleres}`);
        await valeCreacionService.regenerarPdf(mod.id);

        const nuevoVale = await valeRepository.obtenerPorId(mod.id);
        const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(original.asesor_id);
        valeEvents.notificar({
          vale: nuevoVale, accion: 'autorizado (modificación)', actor: usuario.nombre, actorId: usuario.id,
          salas: [`asesor:${original.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`), ...talleresIds.map(id => `taller:${id}`)]
        });
        return enriquecer(nuevoVale);
      });
    });
  }

  // Rechazar la modificación sigue el flujo normal: el MOD- pasa a RECHAZADO con el motivo y vuelve al asesor.
  rechazarModificacion(usuario, valeId, motivo) {
    return valeCreacionService.rechazarCreacion(usuario, valeId, motivo, { modificacion: true });
  }
}

module.exports = new ValeModificacionService();
