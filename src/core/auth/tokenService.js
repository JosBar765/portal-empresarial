// src/core/auth/tokenService.js
// Sesión = access token corto (JWT, cookie `token`) + refresh token opaco y
// rotativo (cookie `refresh_token`). Ambas cookies son httpOnly + sameSite
// strict. El refresh token solo existe en su cookie y, hasheado, en
// sesiones_activas; cada renovación lo cambia y relee rol/permisos/`activo`
// de la base, así un cambio de permisos o una cuenta desactivada surten
// efecto en minutos aunque el usuario no tenga el socket abierto.
const crypto = require('crypto');
const config = require('../../config/env');
const authService = require('./authService');
const jwtHelper = require('./jwtHelper');
const sesionRepository = require('./sesionRepository');

const ACCESS_COOKIE = 'token';
const REFRESH_COOKIE = 'refresh_token';

function duracionEnMs(expresion) {
  if (typeof expresion === 'number') return expresion * 1000;
  const match = /^(\d+)(s|m|h|d)$/.exec(String(expresion).trim());
  if (!match) return 12 * 60 * 60 * 1000; // formato no reconocido: fallback conservador
  const unidadEnMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(match[1]) * unidadEnMs[match[2]];
}
const ACCESS_MAX_AGE = duracionEnMs(config.jwtExpiresIn);
const REFRESH_MAX_AGE = duracionEnMs(config.refreshExpiresIn);

// Varias peticiones paralelas (una página que dispara 5 fetch justo cuando el
// access token venció) llegan con el MISMO refresh token. La primera lo rota;
// las demás reciben el mismo resultado en vez de tropezar con un token "ya
// usado", que se trataría como robo. Un token viejo presentado DESPUÉS de esta
// ventana sí revoca la sesión. Vive en memoria: el sistema es un solo proceso
// Node (monolito modular), no hay que compartirlo entre instancias.
const VENTANA_CONCURRENCIA_MS = 30 * 1000;
const renovacionesRecientes = new Map();

const hashDe = (token) => crypto.createHash('sha256').update(token).digest('hex');
const nuevoRefreshToken = () => crypto.randomBytes(32).toString('base64url');

function armarPayload(authData, sid) {
  return {
    id: authData.user.id,
    nombre: authData.user.nombre,
    email: authData.user.email,
    rolId: authData.user.rolId,
    rolNombre: authData.user.rolNombre,
    modulosPermitidos: authData.user.modulosPermitidos,
    permissions: authData.permissions,
    sid
  };
}

function opcionesCookie(maxAge) {
  return {
    httpOnly: true,                              // el JavaScript de la página nunca lo lee (XSS)
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',                          // protección CSRF real de este proyecto
    path: '/',
    maxAge
  };
}

/** Login: crea la sesión y devuelve ambos tokens listos para fijar en cookies. */
async function emitirSesion(authData) {
  const sid = crypto.randomUUID();
  const refresh = nuevoRefreshToken();
  const access = jwtHelper.generateToken(armarPayload(authData, sid));
  await sesionRepository.crear(authData.user.id, sid, hashDe(refresh), new Date(Date.now() + REFRESH_MAX_AGE));
  return { access, refresh, refreshMaxAge: REFRESH_MAX_AGE, user: authData.user };
}

async function _renovar(hashActual) {
  const sesion = await sesionRepository.buscarPorRefresh(hashActual);
  if (!sesion) {
    const reusada = await sesionRepository.buscarPorRefreshAnterior(hashActual);
    if (reusada) {
      // Token ya rotado que reaparece: o lo robaron o el cliente lo guardó de
      // más. Se cierra la sesión completa — el dueño real vuelve a iniciar.
      await sesionRepository.eliminarSiCoincide(reusada.usuario_id, reusada.token_id);
      console.warn(`[Auth] Reuso de refresh token detectado (usuario ${reusada.usuario_id}); sesión revocada.`);
      return { ok: false, motivo: 'reuso' };
    }
    return { ok: false, motivo: 'invalido' };
  }

  let authData;
  try {
    authData = await authService.reautorizar(sesion.usuario_id);
  } catch (error) {
    // Usuario desactivado o inexistente mientras tenía sesión.
    await sesionRepository.eliminarSiCoincide(sesion.usuario_id, sesion.token_id);
    return { ok: false, motivo: 'usuario' };
  }

  const refresh = nuevoRefreshToken();
  const rotado = await sesionRepository.rotarRefresh(sesion.usuario_id, sesion.token_id, hashActual, hashDe(refresh));
  if (!rotado) return { ok: false, motivo: 'invalido' };

  return {
    ok: true,
    access: jwtHelper.generateToken(armarPayload(authData, sesion.token_id)),
    refresh,
    // El techo de la sesión no se mueve: la cookie nueva vence cuando vence el original.
    refreshMaxAge: Math.max(1, sesion.restante_seg) * 1000,
    user: authData.user
  };
}

/** Cambia un refresh token por un par nuevo. Nunca lanza: devuelve { ok:false, motivo }. */
function renovar(refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    return Promise.resolve({ ok: false, motivo: 'invalido' });
  }
  const hash = hashDe(refreshToken);
  if (renovacionesRecientes.has(hash)) return renovacionesRecientes.get(hash);

  const promesa = _renovar(hash).catch((error) => {
    console.error('[Auth] Error al renovar sesión:', error.message);
    return { ok: false, motivo: 'error' };
  });
  renovacionesRecientes.set(hash, promesa);
  setTimeout(() => renovacionesRecientes.delete(hash), VENTANA_CONCURRENCIA_MS).unref();
  return promesa;
}

function fijarCookies(res, { access, refresh, refreshMaxAge }) {
  res.cookie(ACCESS_COOKIE, access, opcionesCookie(ACCESS_MAX_AGE));
  res.cookie(REFRESH_COOKIE, refresh, opcionesCookie(refreshMaxAge));
}

function limpiarCookies(res) {
  const base = { httpOnly: true, path: '/', expires: new Date(0) };
  res.cookie(ACCESS_COOKIE, '', base);
  res.cookie(REFRESH_COOKIE, '', base);
}

/**
 * Resuelve quién es el usuario de la petición: access token válido, o — si
 * venció o falta — se renueva con el refresh token (fijando las cookies
 * nuevas en `res`). Devuelve el payload o null.
 */
async function autenticar(req, res) {
  const access = req.cookies ? req.cookies[ACCESS_COOKIE] : null;
  const decoded = access ? jwtHelper.verifyToken(access) : null;
  if (decoded) return decoded;

  const refresh = req.cookies ? req.cookies[REFRESH_COOKIE] : null;
  if (!refresh) return null;

  const resultado = await renovar(refresh);
  if (!resultado.ok) {
    limpiarCookies(res);
    return null;
  }
  fijarCookies(res, resultado);
  return jwtHelper.verifyToken(resultado.access);
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  emitirSesion,
  renovar,
  hashDe,
  fijarCookies,
  limpiarCookies,
  autenticar
};
