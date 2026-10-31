// src/modules/prompts/services/recursoService.js
// Proxy de solo lectura de los recursos fijos de un producto. Leer un recurso externo no es una acción crítica (reglas_entornos.md).
const config = require('../../../config/env');
const productoRepository = require('../repositories/productoRepository');
const versionRepository = require('../repositories/versionRepository');
const ajustesService = require('./ajustesService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const { leerJson } = require('./documento');
const { recursosDelEsquema } = require('./esquemaService');
const { decidirOrigen } = require('./recursos');
const { ESTADOS_PRODUCTO, ESTADOS_VERSION } = require('../constantes');
const { msg } = require('../mensajes');

const BAD_GATEWAY = 502;
const MB = 1024 * 1024;

// Lee el cuerpo sin pasar del límite aunque el servidor no declare Content-Length.
async function leerConLimite(respuesta, maxBytes) {
  const reader = respuesta.body.getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { await reader.cancel(); return null; }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

class RecursoService {
  /** @returns {Promise<{redirigir: string} | {contentType: string, cuerpo: Buffer}>} */
  async obtener(productoIdCrudo, clave) {
    const productoId = idObligatorio(productoIdCrudo, 'Producto');
    const producto = await productoRepository.obtenerPorId(productoId);
    const version = producto && producto.estado === ESTADOS_PRODUCTO.ACTIVO
      ? await versionRepository.obtenerPorEstado(productoId, ESTADOS_VERSION.PUBLICADA)
      : null;
    if (!version) throw new ErrorDeNegocio(msg('recursoLectura.productoNoDisponible'), 404);

    const recurso = recursosDelEsquema(leerJson(version.esquema)).find(r => r.clave === clave && r.activo === true);
    if (!recurso) throw new ErrorDeNegocio(msg('recursoLectura.noExiste', { clave }), 404);

    const nombre = recurso.etiqueta || recurso.clave;
    const origen = decidirOrigen(recurso.url, config.supabase.url);
    if (origen.tipo === 'local') return { redirigir: origen.ruta };
    if (origen.tipo === 'rechazada') throw new ErrorDeNegocio(this._mensajeDeRechazo(origen, nombre), BAD_GATEWAY);

    const { limites } = await ajustesService.obtenerTodos();
    return this._descargar(origen.url, nombre, limites);
  }

  _mensajeDeRechazo(origen, recurso) {
    switch (origen.motivo) {
      case 'sin_almacenamiento': return msg('recursoLectura.sinAlmacenamiento', { recurso });
      case 'protocolo': return msg('recursoLectura.protocolo', { recurso });
      case 'host': return msg('recursoLectura.hostNoPermitido', { recurso, host: origen.host, hostPermitido: origen.hostPermitido });
      default: return msg('recursoLectura.urlInvalida', { recurso });
    }
  }

  async _descargar(url, recurso, limites) {
    let respuesta;
    try {
      // redirect:'error' evita que una redirección saque la petición del host permitido.
      respuesta = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(limites.recurso_timeout_ms) });
    } catch (error) {
      if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new ErrorDeNegocio(msg('recursoLectura.timeout', { recurso, segundos: Math.round(limites.recurso_timeout_ms / 1000) }), BAD_GATEWAY);
      }
      throw new ErrorDeNegocio(msg('recursoLectura.sinConexion', { recurso }), BAD_GATEWAY);
    }
    if (!respuesta.ok) {
      await respuesta.body?.cancel();
      throw new ErrorDeNegocio(msg('recursoLectura.respuestaHttp', { recurso, estado: respuesta.status }), BAD_GATEWAY);
    }
    const contentType = respuesta.headers.get('content-type') || '';
    if (!/^image\//i.test(contentType)) {
      await respuesta.body?.cancel();
      throw new ErrorDeNegocio(msg('recursoLectura.noImagen', { recurso, tipo: contentType || 'sin tipo' }), BAD_GATEWAY);
    }

    const maxBytes = limites.recurso_max_mb * MB;
    const declarado = Number(respuesta.headers.get('content-length'));
    const cuerpo = declarado > maxBytes ? null : await this._leerCuerpo(respuesta, maxBytes, recurso, limites);
    if (!cuerpo) throw new ErrorDeNegocio(msg('recursoLectura.grande', { recurso, maxMb: limites.recurso_max_mb }), BAD_GATEWAY);
    return { contentType, cuerpo };
  }

  async _leerCuerpo(respuesta, maxBytes, recurso, limites) {
    try {
      return await leerConLimite(respuesta, maxBytes);
    } catch (error) {
      // El plazo también cubre la lectura del cuerpo.
      if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new ErrorDeNegocio(msg('recursoLectura.timeout', { recurso, segundos: Math.round(limites.recurso_timeout_ms / 1000) }), BAD_GATEWAY);
      }
      throw new ErrorDeNegocio(msg('recursoLectura.sinConexion', { recurso }), BAD_GATEWAY);
    }
  }
}

module.exports = new RecursoService();
