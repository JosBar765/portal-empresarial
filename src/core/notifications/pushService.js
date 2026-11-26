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

// Registros para diagnosticar en el hosting: nunca llevan claves, direcciones de dispositivos ni textos de avisos.
const MAX_MOTIVO = 200;
const detallado = () => config.nodeEnv !== 'production';
const detalle = (mensaje) => { if (detallado()) console.log(`[Push] ${mensaje}`); };

function servicioDe(endpoint) {
  let host = '';
  try { host = new URL(endpoint).hostname; } catch { return 'desconocido'; }
  if (host.endsWith('googleapis.com')) return 'Google';
  if (host.endsWith('mozilla.com')) return 'Mozilla';
  if (host.endsWith('apple.com')) return 'Apple';
  if (host.endsWith('windows.com')) return 'Microsoft';
  return 'desconocido';
}

// El cuerpo de la respuesta dice por qué se rechazó; se le quitan las direcciones.
const motivoDe = (error) => String((error && (error.body || error.message)) || '')
  .replace(/https?:\/\/\S+/g, '[dirección]').replace(/\s+/g, ' ').trim().slice(0, MAX_MOTIVO);

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
  detalle(`dispositivo registrado: usuario ${usuarioId}, ${suscripcion.dispositivo}, servicio ${servicioDe(endpoint)}`);
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
    url: datos ? `${datos.path}/?aviso=${notificacion.id}` : '/dashboard/',
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
    detalle(`enviado ${JSON.parse(payload).tag} a usuario ${s.usuario_id} por ${servicioDe(s.endpoint)}`);
  } catch (error) {
    if (error && (error.statusCode === 404 || error.statusCode === 410)) {
      contadores.eliminadas++;
      detalle(`suscripción vencida del usuario ${s.usuario_id} (${servicioDe(s.endpoint)}, ${error.statusCode}): se elimina`);
      await pushRepository.eliminarPorId(s.id).catch(() => {});
    } else {
      contadores.fallidos++;
      console.error(`[Push] No se pudo enviar el aviso a usuario ${s.usuario_id} por ${servicioDe(s.endpoint)} (${(error && (error.statusCode || error.code)) || 'error'}): ${motivoDe(error)}`);
    }
  }
}

function razonSinEnvio(f) {
  if (!Number(f.activo)) return 'usuario desactivado';
  if (Number(f.fuera)) return 'tienda no marcada';
  if (!Number(f.marca_escritorio) && !Number(f.marca_movil)) return 'sin casilla';
  if (!Number(f.escritorios) && !Number(f.moviles)) return 'sin dispositivo';
  return 'sin dispositivo de la clase marcada';
}

// Solo fuera de producción: por qué algunos destinatarios no recibieron push. Quien actuó no figura: se excluye antes.
async function explicarSinEnvio(modulo, tipo, categoria, usuariosIds, aviso) {
  try {
    const filas = await pushRepository.diagnostico(modulo, categoria, usuariosIds, aviso);
    if (filas.length) detalle(`${modulo}/${tipo} sin envío: ${filas.map(f => `${f.usuario_id}=${razonSinEnvio(f)}`).join(', ')}`);
  } catch (error) {
    detalle(`no se pudo explicar quién quedó sin envío (${(error && error.code) || 'error'}).`);
  }
}

// `porUsuario`: Map usuario_id -> notificación recién guardada.
async function enviar(modulo, tipo, porUsuario) {
  try {
    if (!habilitado() || !porUsuario.size) return;
    const categoria = categoriaDeTipo(modulo, tipo);
    if (!categoria) {
      detalle(`${modulo}/${tipo} sin categoría: solo campana`);
      return;
    }
    // Todos reciben el mismo aviso: su tienda y asesor deciden, según la selección de cada uno, a quién se envía.
    const { tienda_id: tiendaId = null, asesor_id: asesorId = null } = porUsuario.values().next().value;
    const aviso = { tiendaId, asesorId };
    const destinos = await pushRepository.destinos(modulo, categoria, [...porUsuario.keys()], aviso);
    detalle(`${modulo}/${tipo} categoría=${categoria} destinatarios=${porUsuario.size} dispositivos=${destinos.length} usuarios=${[...porUsuario.keys()].join(',')}`);
    if (detallado()) {
      const alcanzados = new Set(destinos.map(s => s.usuario_id));
      const sinEnvio = [...porUsuario.keys()].filter(id => !alcanzados.has(id));
      if (sinEnvio.length) await explicarSinEnvio(modulo, tipo, categoria, sinEnvio, aviso);
    }
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
