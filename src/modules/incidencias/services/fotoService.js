// src/modules/incidencias/services/fotoService.js
// Las fotos de las incidencias: se validan por su tipo REAL (no por lo que declara el cliente), se optimizan y se suben al
// Storage; en la base solo se guarda la URL. Si algo falla después de subir, las fotos subidas se borran (solo en producción).
const crypto = require('crypto');
const { tipoRealCoincide } = require('../../../core/files/fileSignature');
const { excedeElLimiteDePixeles } = require('../../../core/files/imagenDimensiones');
const imageOptimizer = require('../../../core/files/imageOptimizer');
const storage = require('../../../core/files/supabaseStorage');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

const TIPOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

class FotoService {
  // `files`: lo que entrega multer. `min`/`max`: cuántas fotos se aceptan; `minimoMensaje`: qué decir si faltan.
  validar(files, { min, max, minimoMensaje }) {
    const lista = files || [];
    if (lista.length < min) throw new ErrorDeNegocio(minimoMensaje || `Agrega al menos ${min} foto${min === 1 ? '' : 's'}.`, 400);
    if (lista.length > max) throw new ErrorDeNegocio(`Puedes agregar hasta ${max} foto${max === 1 ? '' : 's'}.`, 400);
    for (const f of lista) {
      const nombre = String(f.originalname || 'la foto').replace(/[<>"'&]/g, '').slice(0, 60);
      if (!TIPOS.includes(f.mimetype) || !tipoRealCoincide(f.buffer, f.mimetype)) throw new ErrorDeNegocio(`«${nombre}» no es una foto válida. Usa JPG, PNG o WebP.`, 400);
      if (f.size > MAX_BYTES) throw new ErrorDeNegocio(`«${nombre}» pesa más de 5 MB.`, 400);
      if (excedeElLimiteDePixeles(f.buffer, f.mimetype)) throw new ErrorDeNegocio(`«${nombre}» es demasiado grande o no se puede leer.`, 400);
    }
    return lista;
  }

  async subir(files) {
    const urls = [];
    try {
      for (const f of files || []) {
        const buffer = await imageOptimizer.optimizar(f.buffer, f.mimetype);
        const subida = await storage.subir(buffer, f.originalname, f.mimetype, `inc-${crypto.randomBytes(12).toString('hex')}`);
        urls.push(subida.url);
      }
    } catch (error) {
      await this.descartar(urls);
      throw error;
    }
    return urls;
  }

  // Borra fotos ya subidas cuando la operación no terminó (fuera de producción no borra nada: lo decide supabaseStorage.eliminar).
  async descartar(urls) {
    for (const url of urls || []) {
      try { await storage.eliminar(url); } catch (error) { console.error('[Incidencias] No se pudo borrar una foto huérfana:', error.message); }
    }
  }
}

module.exports = new FotoService();
