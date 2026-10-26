// src/modules/prompts/services/recursos.js
// Funciones puras sobre los recursos fijos de un producto (imágenes que siempre acompañan al prompt).
const PREFIJO_LOCAL = '/assets/';

const esRutaLocal = url => typeof url === 'string' && url.startsWith(PREFIJO_LOCAL) && !/\.\.|\\|[\u0000-\u001F]/.test(url);

function esUrlHttps(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Una URL guardada es válida si es una ruta local de /assets/ o una dirección https. */
const urlDeRecursoValida = url => typeof url === 'string' && (esRutaLocal(url) || esUrlHttps(url));

/** URL que recibe el navegador: la ruta local tal cual y lo demás pasa por el proxy de solo lectura. */
function urlParaCliente(recurso, productoId) {
  return esRutaLocal(recurso.url) ? recurso.url : `/api/prompts/recursos/${productoId}/${recurso.clave}`;
}

/**
 * Decide de dónde se lee un recurso. Solo se acepta https en el mismo host que SUPABASE_URL (comparación exacta del host).
 * @returns {{tipo: 'local', ruta: string} | {tipo: 'remoto', url: string} |
 *   {tipo: 'rechazada', motivo: 'sin_almacenamiento'|'invalida'|'protocolo'|'host', host?: string, hostPermitido?: string}}
 */
function decidirOrigen(url, urlSupabase) {
  if (esRutaLocal(url)) return { tipo: 'local', ruta: url };
  let destino;
  try {
    destino = new URL(url);
  } catch {
    return { tipo: 'rechazada', motivo: 'invalida' };
  }
  if (destino.protocol !== 'https:') return { tipo: 'rechazada', motivo: 'protocolo' };
  let permitido = '';
  try {
    permitido = new URL(urlSupabase).host;
  } catch {
    return { tipo: 'rechazada', motivo: 'sin_almacenamiento' };
  }
  if (destino.username || destino.password || destino.host !== permitido) {
    return { tipo: 'rechazada', motivo: 'host', host: destino.host, hostPermitido: permitido };
  }
  return { tipo: 'remoto', url: destino.href };
}

module.exports = { esRutaLocal, urlDeRecursoValida, urlParaCliente, decidirOrigen };
