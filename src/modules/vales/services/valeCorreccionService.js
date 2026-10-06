// src/modules/vales/services/valeCorreccionService.js
// El asesor corrige los datos de un vale propio que aún no fue autorizado.
const crypto = require('crypto');
const valeRepository = require('../repositories/valeRepository');
const valeCorreccionRepository = require('../repositories/valeCorreccionRepository');
const documentoRepository = require('../repositories/documentoRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const supabaseStorage = require('../../../core/files/supabaseStorage');
const imageOptimizer = require('../../../core/files/imageOptimizer');
const { StorageUploadError } = require('../../../core/files/errores');
const idempotencyRepository = require('../../../core/idempotency/idempotencyRepository');
const capacidadEntregaService = require('./capacidadEntregaService');
const valeCreacionService = require('./valeCreacionService');
const valeEvents = require('../events');
const valeMutex = require('./valeMutex');
const { ROL, ESTADOS_EDITABLES_ASESOR, hoyISO, enriquecer, requerirVale } = require('./valeHelpers');

const MAX_IMAGENES = 10;
const MAX_DOCUMENTOS = 5;

class ValeCorreccionService {
  // Orden pensado para no dejar archivos huérfanos: (1) se sube todo lo nuevo, incluido el
  // PDF regenerado; (2) una transacción actualiza la base; (3) solo si esa transacción
  // termina bien se borran los archivos reemplazados. Si falla antes del paso 3, se borra
  // lo recién subido y la base queda intacta.
  async corregirVale(usuario, valeId, payload, archivos) {
    return valeMutex.conLockDeVale(valeId, async () => {
      const key = payload.idempotencyKey || crypto.randomUUID();
      const previo = await idempotencyRepository.buscar(key);
      if (previo) return previo.resultado;

      if (usuario.rolId !== ROL.ASESOR) {
        throw new Error('Solo el asesor de ventas puede corregir un vale.');
      }
      const vale = await requerirVale(valeId);
      if (vale.asesor_id !== usuario.id) {
        throw new Error('Solo puedes corregir tus propios vales.');
      }
      if (!ESTADOS_EDITABLES_ASESOR.includes(vale.estado)) {
        throw new Error('Este vale ya fue autorizado, así que ya no se puede corregir.');
      }

      const datos = await valeCreacionService.validarDatosVale(payload, { tiendaIdAsesor: vale.tienda_id });
      const fechaCreacion = new Date(`${hoyISO()}T00:00:00`);
      if (!(datos.fechaEventoDate > datos.fechaEntregaDate && datos.fechaEntregaDate >= fechaCreacion)) {
        throw new Error('Revisa las fechas: el evento debe ser posterior a la entrega, y la entrega no puede ser anterior a hoy.');
      }
      const fechaEntregaISO = datos.fechaEntregaNorm.slice(0, 10);
      await capacidadEntregaService.validarLimiteDiario(datos.talleresIds, fechaEntregaISO);

      const documentosActuales = await documentoRepository.listarPorVale(valeId);
      const quitarIds = this._idsAQuitar(payload.documentosQuitar, documentosActuales);
      const conservados = documentosActuales.filter(d => !quitarIds.includes(d.id));
      const nuevosImagenes = (archivos && archivos.imagenes) || [];
      const nuevosDocumentos = (archivos && archivos.documentos) || [];
      if (conservados.filter(d => d.tipo === 'imagen').length + nuevosImagenes.length > MAX_IMAGENES
        || conservados.filter(d => d.tipo === 'documento').length + nuevosDocumentos.length > MAX_DOCUMENTOS) {
        throw new Error(`Un vale admite hasta ${MAX_IMAGENES} imágenes y ${MAX_DOCUMENTOS} documentos.`);
      }

      const subidos = [];
      let documentosNuevos;
      try {
        documentosNuevos = await this._subirNuevos(nuevosImagenes, nuevosDocumentos, subidos);
        const valeCorregido = this._valeConDatos(vale, datos);
        const pdfBuffer = await valeCreacionService.generarBufferPdf(valeCorregido, [...conservados, ...documentosNuevos]);
        const pdf = await supabaseStorage.subir(pdfBuffer, `${vale.correlativo}.pdf`, 'application/pdf');
        subidos.push(pdf.url);

        // El cupo se revalida y la base se actualiza en el mismo turno de la cola de capacidad.
        await valeMutex.conColaDeCapacidad(async () => {
          await capacidadEntregaService.validarLimiteDiario(datos.talleresIds, fechaEntregaISO);
          await valeCorreccionRepository.aplicar({
            valeId, usuarioId: usuario.id, datos, pdfUrl: pdf.url, estado: vale.estado,
            documentosQuitarIds: quitarIds, documentosNuevos,
            accionHistorial: 'Asesor corrigió los datos del vale de arte antes de su autorización'
          });
        });
      } catch (error) {
        await this._borrarDeStorage(subidos);
        throw error;
      }

      const aReemplazar = [
        ...documentosActuales.filter(d => quitarIds.includes(d.id)).map(d => d.ruta),
        vale.pdf_url
      ].filter(Boolean);
      await this._borrarDeStorage(aReemplazar);

      const actualizado = await valeRepository.obtenerPorId(valeId);
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
      valeEvents.notificar({
        vale: actualizado, accion: 'corregido', tipo: 'CORREGIDO', actor: usuario.nombre, actorId: usuario.id,
        // Un vale rechazado no está en manos del supervisor: solo el asesor se entera.
        salas: [`asesor:${vale.asesor_id}`, ...(vale.estado === 'RECHAZADO' ? [] : supervisores.map(s => `supervisor:${s.id}`))]
      });
      const resultado = enriquecer(actualizado);
      await idempotencyRepository.registrar(key, 'vales.corregir', resultado);
      return resultado;
    });
  }

  _idsAQuitar(crudo, documentosActuales) {
    let ids;
    try {
      ids = Array.isArray(crudo) ? crudo : JSON.parse(crudo || '[]');
    } catch {
      throw new Error('No se pudo leer la lista de archivos a quitar. Actualiza la página e inténtalo de nuevo.');
    }
    ids = [...new Set((ids || []).map(Number))];
    if (!ids.every(id => documentosActuales.some(d => d.id === id))) {
      throw new Error('Alguno de los archivos que quieres quitar ya no existe en este vale. Actualiza la página e inténtalo de nuevo.');
    }
    return ids;
  }

  _valeConDatos(vale, datos) {
    return {
      ...vale,
      fecha_entrega: datos.fechaEntregaNorm, fecha_evento: datos.fechaEventoNorm, urgente: datos.urgente ? 1 : 0,
      cliente_empresa: datos.clienteEmpresa || null, cliente_nombre: datos.clienteNombre,
      cliente_telefono: datos.clienteTelefono, cliente_correo: datos.clienteCorreo,
      producto: datos.producto, material: datos.material, tecnica: datos.tecnica, acabado: datos.acabado,
      cantidad: datos.cantidad, cotizacion: datos.cotizacion, descripcion: datos.descripcion || null,
      talleres_solicitados: datos.talleresIds.join(',')
    };
  }

  // Cada URL subida se anota en `subidos` apenas existe, para poder borrarla si algo falla después.
  async _subirNuevos(imagenes, documentos, subidos) {
    const nuevos = [];
    for (const [lista, tipo] of [[imagenes, 'imagen'], [documentos, 'documento']]) {
      for (const file of lista) {
        let subida;
        try {
          const buffer = await imageOptimizer.optimizar(file.buffer, file.mimetype);
          subida = await supabaseStorage.subir(buffer, file.originalname, file.mimetype);
        } catch (error) {
          throw new StorageUploadError(`No se pudo subir "${file.originalname}": ${error.message}`);
        }
        subidos.push(subida.url);
        nuevos.push({ nombre_original: file.originalname, ruta: subida.url, tipo, mime_type: file.mimetype, tamano: subida.size });
      }
    }
    return nuevos;
  }

  // Borra de Storage con un reintento; si aún falla, queda en el log para limpiarlo a mano.
  async _borrarDeStorage(urls) {
    for (const url of urls) {
      for (let intento = 1; intento <= 2; intento++) {
        try {
          await supabaseStorage.eliminar(url);
          break;
        } catch (error) {
          if (intento === 2) console.error(`[Storage] Archivo huérfano sin borrar: ${url} (${error.message})`);
        }
      }
    }
  }
}

module.exports = new ValeCorreccionService();
