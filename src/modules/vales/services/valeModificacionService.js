// src/modules/vales/services/valeModificacionService.js
// Modificación de un vale ya entregado: al solicitarla el original queda RECIBIDO y nace el vale MOD-, completo y con la
// propuesta del original al final de su PDF (esperando al supervisor, baja, vigencia de 24 h). Autorizarlo lo reparte a
// los mismos talleres; rechazarlo o vencerlo lo elimina (el original y sus archivos no se tocan).
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
  ESTADOS, ROL, hoyISO, horaActual, enriquecer, registrarHistorial,
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
      // La propuesta del original va al final del PDF del MOD-; sin ella no se arma la solicitud.
      const propuestaOriginal = original.propuesta_general_url
        || (await propuestaRepository.obtenerUltimaPorVale(original.id))?.url;
      if (!propuestaOriginal) {
        throw new Error('Este vale no tiene una propuesta registrada, así que no se puede armar la solicitud de modificación.');
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
        const documentos = [...conservados, ...nuevos, {
          nombre_original: `Propuesta original - ${original.correlativo}.pdf`, ruta: propuestaOriginal,
          tipo: 'documento', mime_type: 'application/pdf', tamano: 0, nuevo: true
        }];
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
          documentos, usuarioId: usuario.id, talleresIds
        });
      } catch (error) {
        await valeCorreccionService._borrarDeStorage(subidos);
        throw error;
      }

      const actualizado = await valeRepository.obtenerPorId(valeId);
      const nuevoMod = await valeRepository.obtenerPorId(modId);
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id);
      valeEvents.notificar({
        vale: nuevoMod, accion: `creado, esperando autorización (modificación de ${original.correlativo}, que quedó como Recibido)`, actor: usuario.nombre, actorId: usuario.id,
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

  // `valeId` es el del vale MOD-: solo lo manda a los talleres y estampa la firma del supervisor en su PDF.
  async aprobarModificacion(usuario, valeId) {
    return valeMutex.conLockDeVale(valeId, async () => {
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
        await valeVistoService.exigirVisto(usuario, mod.id);
        const talleresIds = (mod.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);

        // El PDF con la firma se genera y sube ANTES de tocar la base: si falla, nada cambió.
        const ahora = `${hoyISO()} ${horaActual()}`;
        const nombresTalleres = await valeCreacionService.nombresDeTalleres(talleresIds);
        const documentos = await documentoRepository.listarPorVale(mod.id);
        const pdfBuffer = await valeCreacionService.generarBufferPdf(mod, documentos,
          { autorizado_por: usuario.id, autorizado_en: ahora, autorizacion_tipo: 'MODIFICACION' });
        const pdf = await supabaseStorage.subir(pdfBuffer, `${mod.correlativo}.pdf`, 'application/pdf');
        try {
          // El vale MOD- recién ocupa cupo al autorizarse; si varios supervisores compiten por el último lugar, gana uno.
          await valeMutex.conColaDeCapacidad(async () => {
            await capacidadEntregaService.validarLimiteDiario(talleresIds, String(mod.fecha_entrega).slice(0, 10), { paraSupervisor: true });
            await valeRepository.autorizarCreacionAtomico({
              valeId: mod.id, usuarioId: usuario.id, talleresIds, autorizadoEn: ahora, tipo: 'MODIFICACION', pdfUrl: pdf.url,
              estadoAnterior: ESTADOS.SOLICITANDO_MODIFICACION, estadoNuevo: ESTADOS.MODIFICADO,
              accionHistorial: `Supervisor autorizó la modificación de ${original.correlativo} — enviado a taller${talleresIds.length > 1 ? 'es' : ''}: ${nombresTalleres}`,
              valeOriginalId: original.id,
              accionHistorialOriginal: `Supervisor aprobó la solicitud de modificación — se autorizó el vale ${mod.correlativo}`
            });
          });
        } catch (error) {
          try { await supabaseStorage.eliminar(pdf.url); } catch (e) { console.error(`[Storage] PDF huérfano sin borrar: ${pdf.url} (${e.message})`); }
          throw error;
        }
        // Recién con la base confirmada se borra el PDF anterior.
        if (mod.pdf_url) {
          try { await supabaseStorage.eliminar(mod.pdf_url); } catch (e) { console.error(`[Storage] PDF anterior sin borrar: ${mod.pdf_url} (${e.message})`); }
        }

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

  // Rechazar la modificación elimina el vale MOD- (con el motivo al asesor); el original ya quedó como Recibido.
  rechazarModificacion(usuario, valeId, motivo) {
    return valeCreacionService.rechazarCreacion(usuario, valeId, motivo, { modificacion: true });
  }
}

module.exports = new ValeModificacionService();
