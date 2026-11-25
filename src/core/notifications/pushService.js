// Web Push: se envía a los dispositivos que pidieron la categoría; el service worker decide si lo muestra.
// Nunca lanza ni bloquea a quien registra la notificación.
const config = require('../../config/env');
const pushRepository = require('./pushRepository');
const { categoriaDeTipo } = require('./categorias');
const { MODULOS } = require('../permissions/modulesCatalog');
const { ErrorDeNegocio } = require('../utils/erroresHttp');

const TTL_SEGUNDOS = 86400;
const MAX_ENDPOINT = 500;
const MAX_CLAVE = 255;
const MAX_SIMULTANEOS = 10;
const TIMEOUT_MS = 8000;
const CADA_HORA_MS = 60 * 60 * 1000;
const DISPOSITIVOS = ['escritorio', 'movil'];
// El servidor hace la petición al endpoint que manda el navegador: solo se aceptan los servicios push conocidos.
const HOSTS_PUSH = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

// Cola simple: como máximo MAX_SIMULTANEOS envíos a la vez (ráfagas de alertas).
let activos = 0;
const espera = [];
function conCupo(tarea) {
  return new Promise((resolve, reject) => {
    const correr = () => {
      activos++;
      tarea().then(resolve, reject).finally(() => {
        activos--;
        const siguiente = espera.shift();
        if (siguiente) siguiente();
      });
    };
    if (activos < MAX_SIMULTANEOS) correr(); else espera.push(correr);
  });
}

// Una sola línea por hora y solo si hubo actividad.
const contadores = { enviados: 0, fallidos: 0, eliminadas: 0 };
setInterval(() => {
  if (contadores.enviados || contadores.fallidos || contadores.eliminadas) {
    console.log(`[Push] última hora: enviados ${contadores.enviados}, fallidos ${contadores.fallidos}, suscripciones eliminadas ${contadores.eliminadas}`);
  }
  contadores.enviados = contadores.fallidos = contadores.eliminadas = 0;
}, CADA_HORA_MS).unref();

let sender = null;

const habilitado = () => Boolean(config.push && config.push.habilitado);
const clavePublica = () => (habilitado() ? config.push.publicKey : null);

function enviarConWebPush(suscripcion, payload, opciones) {
  const webpush = require('web-push');
  webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
  return webpush.sendNotification(suscripcion, payload, opciones);
}

const claveValida = (valor) => typeof valor === 'string' && valor.length > 0 && valor.length <= MAX_CLAVE;

function validarEndpoint(endpoint) {
  const invalida = () => new ErrorDeNegocio('La suscripción no es válida: este navegador no usa un servicio de avisos reconocido.');
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > MAX_ENDPOINT) throw invalida();
  let url;
  try { url = new URL(endpoint); } catch { throw invalida(); }
  const reconocido = HOSTS_PUSH.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`));
  if (url.protocol !== 'https:' || url.port || !reconocido) throw invalida();
  return endpoint;
}

async function suscribir(usuarioId, suscripcion, userAgent) {
  const endpoint = validarEndpoint(suscripcion && suscripcion.endpoint);
  const keys = suscripcion.keys;
  if (!keys || !claveValida(keys.p256dh) || !claveValida(keys.auth)) throw new ErrorDeNegocio('La suscripción no es válida: faltan sus claves.');
  if (!DISPOSITIVOS.includes(suscripcion.dispositivo)) throw new ErrorDeNegocio('El tipo de dispositivo debe ser «escritorio» o «movil».');
  await pushRepository.upsertPorEndpoint(usuarioId, {
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    dispositivo: suscripcion.dispositivo,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 255) : null
  });
}

async function desuscribir(usuarioId, endpoint) {
  await pushRepository.eliminarPorEndpoint(usuarioId, validarEndpoint(endpoint));
}

// Usuario desactivado, contraseña cambiada o sesión revocada: sus dispositivos dejan de recibir avisos.
async function revocarUsuario(usuarioId) {
  try {
    await pushRepository.eliminarPorUsuario(usuarioId);
  } catch (error) {
    console.error(`[Push] No se pudieron borrar los dispositivos del usuario ${usuarioId} (${(error && error.code) || 'error'}).`);
  }
}

function armarPayload(modulo, notificacion) {
  const datos = MODULOS.find(m => m.id === modulo);
  return JSON.stringify({
    titulo: datos ? datos.nombre : 'Portal Empresarial',
    cuerpo: notificacion.mensaje,
    url: datos ? `${datos.path}/` : '/dashboard/',
    tag: `notif-${notificacion.id}`,
    nivel: notificacion.nivel,
    modulo
  });
}

async function enviarUno(s, payload, opciones) {
  const emisor = sender || enviarConWebPush;
  try {
    await conCupo(() => emisor({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, opciones));
    contadores.enviados++;
  } catch (error) {
    if (error && (error.statusCode === 404 || error.statusCode === 410)) {
      contadores.eliminadas++;
      await pushRepository.eliminarPorId(s.id).catch(() => {});
    } else {
      contadores.fallidos++;
      console.error(`[Push] No se pudo enviar el aviso (${(error && (error.statusCode || error.code)) || 'error'}).`);
    }
  }
}

// `porUsuario`: Map usuario_id -> notificación recién guardada.
async function enviar(modulo, tipo, porUsuario) {
  try {
    if (!habilitado() || !porUsuario.size) return;
    const categoria = categoriaDeTipo(modulo, tipo);
    if (!categoria) return;
    const destinos = await pushRepository.destinos(modulo, categoria, [...porUsuario.keys()]);
    await Promise.all(destinos.map(s => {
      const notificacion = porUsuario.get(s.usuario_id);
      const opciones = { TTL: TTL_SEGUNDOS, urgency: notificacion.nivel === 'alerta' ? 'high' : 'normal', timeout: TIMEOUT_MS };
      return enviarUno(s, armarPayload(modulo, notificacion), opciones);
    }));
  } catch (error) {
    console.error(`[Push] Fallo al procesar el aviso: ${(error && (error.code || error.message)) || error}`);
  }
}

module.exports = {
  habilitado,
  clavePublica,
  suscribir,
  desuscribir,
  revocarUsuario,
  enviar,
  // Costura para las pruebas.
  _setSender: (fn) => { sender = fn; }
};
