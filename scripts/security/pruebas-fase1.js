#!/usr/bin/env node
// scripts/security/pruebas-fase1.js
// Pruebas de seguridad de la Fase 1 del plan de remediación (plan_remediacion_30.md).
// NO destructivas para datos reales: están pensadas para correr contra un
// servidor local con una base DESECHABLE (schema.sql + seed.sql + users.sql) —
// nunca contra la base de desarrollo con datos de verdad ni contra producción.
// Crean un usuario de prueba y lo borran al terminar.
//
// Uso (con las mismas variables de entorno que el servidor, más BASE_URL):
//   BASE_URL=http://127.0.0.1:3070 node scripts/security/pruebas-fase1.js
//
// El límite de intentos de login vive en memoria del servidor: reiniciar el
// servidor entre corridas (las pruebas de fuerza bruta lo agotan a propósito).
const path = require('path');
const http = require('http');
const zlib = require('zlib');

const RAIZ = path.join(__dirname, '..', '..');
const mysql = require(path.join(RAIZ, 'node_modules', 'mysql2', 'promise'));
const jsonwebtoken = require(path.join(RAIZ, 'node_modules', 'jsonwebtoken'));
const jwtHelper = require(path.join(RAIZ, 'src', 'core', 'auth', 'jwtHelper'));
const config = require(path.join(RAIZ, 'src', 'config', 'env'));

const BASE = new URL(process.env.BASE_URL || 'http://127.0.0.1:3070');
const ADMIN = { email: 'admin@munditrofeos.com', password: process.env.TEST_ADMIN_PASSWORD || 'Admon' };

let ok = 0;
let mal = 0;
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const chk = (nombre, condicion, detalle = '') => {
  if (condicion) ok++; else mal++;
  console.log(`${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : '  -> ' + detalle}`);
};
const seccion = (t) => console.log(`\n=== ${t} ===`);

// HTTP crudo: conserva rutas con %xx, ./ y // tal cual (fetch las normalizaría).
function pedir(metodo, ruta, { cookies = {}, json, cuerpo, tipo } = {}) {
  return new Promise((resolve, reject) => {
    const cabeceras = {};
    const c = Object.entries(cookies).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('; ');
    if (c) cabeceras.Cookie = c;
    let datos = cuerpo;
    if (json !== undefined) { datos = Buffer.from(typeof json === 'string' ? json : JSON.stringify(json)); cabeceras['Content-Type'] = 'application/json'; }
    if (tipo) cabeceras['Content-Type'] = tipo;
    if (datos) cabeceras['Content-Length'] = Buffer.byteLength(datos);
    const req = http.request({ host: BASE.hostname, port: BASE.port, path: ruta, method: metodo, headers: cabeceras }, (res) => {
      const partes = [];
      res.on('data', d => partes.push(d));
      res.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        let cuerpoJson = null;
        try { cuerpoJson = JSON.parse(texto); } catch { /* no era JSON */ }
        const nuevas = {};
        (res.headers['set-cookie'] || []).forEach(sc => { const kv = sc.split(';')[0]; const i = kv.indexOf('='); nuevas[kv.slice(0, i)] = kv.slice(i + 1); });
        resolve({ s: res.statusCode, h: res.headers, t: texto, j: cuerpoJson, cookies: nuevas });
      });
    });
    req.on('error', reject);
    if (datos) req.write(datos);
    req.end();
  });
}
const login = (email, password) => pedir('POST', '/api/auth/login', { json: { email, password } });
const token = (rolId, permissions, id = 1) => jwtHelper.generateToken({ id, nombre: 'Prueba', email: 'p@p', rolId, rolNombre: 'X', modulosPermitidos: [], permissions });

// ---- PNG "bomba": pocos bytes que declaran muchísimos píxeles ----
function crc32(buf) { let c; let crc = 0xFFFFFFFF; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function chunk(tipo, datos) { const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const t = Buffer.from(tipo); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, datos]))); return Buffer.concat([l, t, datos, c]); }
function png(ancho, alto) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.alloc(10))), chunk('IEND', Buffer.alloc(0))]);
}
function multipart(archivos) {
  const b = '----prueba' + Date.now();
  const partes = archivos.map(a => Buffer.concat([Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${a.campo}"; filename="${a.nombre}"\r\nContent-Type: ${a.tipo}\r\n\r\n`), a.datos, Buffer.from('\r\n')]));
  partes.push(Buffer.from(`--${b}--\r\n`));
  return { cuerpo: Buffer.concat(partes), tipo: `multipart/form-data; boundary=${b}` };
}

(async () => {
  const db = await mysql.createConnection({ host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password, database: config.db.database });
  await db.query("SET time_zone = '-06:00'");
  const creados = []; // usuarios de prueba a borrar al final

  try {
    // ------------------------------------------------------------------
    seccion('T-01 Sin sesión');
    for (const r of ['/api/vales', '/api/admin/usuarios', '/api/modules', '/api/vales/1/pdf']) {
      const x = await pedir('GET', r); chk(`GET ${r} → 401`, x.s === 401, x.s);
    }
    for (const r of ['/dashboard/', '/modules/admin/']) {
      const x = await pedir('GET', r); chk(`GET ${r} → 302 a login`, x.s === 302 && /login/.test(x.h.location || ''), `${x.s} ${x.h.location}`);
    }

    // ------------------------------------------------------------------
    seccion('T-04 Compuerta de módulos: ninguna variante de ruta la evita (usuario SIN vales.ver/admin.ver)');
    const sinVer = { token: token(2, ['vales.crear']) };
    const variantes = ['/modules/vales/', '/modules/vales/index.html', '/modules/%76ales/', '/modules/%76ales/js/app.js', '/modules/./vales/',
      '/modules//vales/', '/modules/VALES/', '/modules/Vales/js/app.js', '/modules/%61dmin/', '/modules/ADMIN/', '/modules/x/../vales/',
      '/modules/%2e/vales/', '/modules/vales./', '/modules/vales%20/', '/modules/%76ales%2fjs%2fapp.js', '/modules/vales\\js\\app.js', '/modules/vales/js/app.js'];
    for (const r of variantes) {
      const x = await pedir('GET', r, { cookies: sinVer });
      chk(`sin permiso: GET ${r} → 302/403/400/404 (nunca 200)`, [302, 403, 400, 404].includes(x.s), `${x.s}`);
    }
    const conVer = { token: token(2, ['vales.ver']) };
    let x = await pedir('GET', '/modules/vales/', { cookies: conVer });
    chk('con vales.ver: /modules/vales/ → 200', x.s === 200, x.s);
    x = await pedir('GET', '/modules/%76ales/', { cookies: conVer });
    chk('con vales.ver: /modules/%76ales/ → 200 (el gate no rompe rutas legítimas)', x.s === 200, x.s);
    x = await pedir('GET', '/modules/%ZZ/', { cookies: conVer });
    chk('ruta con codificación inválida → 400', x.s === 400, x.s);

    // ------------------------------------------------------------------
    seccion('T-06/T-07 Tipos de entrada y errores internos (sin texto de MySQL ni rutas)');
    const filtra = (t) => /sql|mysql|syntax|unknown column|ER_|table|bucket|supabase|\\\\|node_modules/i.test(t);
    for (const [n, email] of [['email = arreglo', ['a', 'b']], ['email = objeto', { email: 1 }], ['email = número', 12345], ['email de 5000 caracteres', 'a'.repeat(5000) + '@x.com']]) {
      x = await login(email, 'x');
      chk(`login con ${n}: 401 genérico`, x.s === 401 && x.j && x.j.error === 'Correo o contraseña incorrectos.' && !filtra(x.t), `${x.s} ${x.t.slice(0, 100)}`);
    }
    x = await login('a@b.com', 'p'.repeat(5000));
    chk('login con contraseña de 5000 caracteres: 401 genérico', x.s === 401 && x.j.error === 'Correo o contraseña incorrectos.', `${x.s}`);
    x = await pedir('POST', '/api/auth/login', { json: '{"email":' });
    chk('JSON malformado: 400 con mensaje fijo', x.s === 400 && !/unexpected|json input/i.test(x.t), x.t.slice(0, 100));
    const admin = { token: token(1, ['admin.ver', 'vales.ver', 'admin.usuarios.gestionar', 'admin.roles.gestionar']) };
    for (const r of ['/api/vales/abc', '/api/vales/1e999', '/api/vales/-1', '/api/vales/0', '/api/vales/1.5', '/api/vales/%20', '/api/vales/9999999999999']) {
      x = await pedir('GET', r, { cookies: admin });
      chk(`GET ${r}: sin texto de MySQL`, !filtra(x.t) && [400, 404].includes(x.s), `${x.s} ${x.t.slice(0, 100)}`);
    }
    x = await pedir('GET', '/api/vales/abc', { cookies: admin });
    chk('GET /api/vales/abc → 400 "Identificador inválido"', x.s === 400 && /inválido/i.test(x.t), `${x.s} ${x.t}`);
    for (const r of ['/api/admin/usuarios/abc/tiendas-supervisadas', '/api/admin/roles/abc/permisos', '/api/admin/talleres/abc/personal']) {
      x = await pedir('GET', r, { cookies: admin });
      chk(`GET ${r} → 400`, x.s === 400 && !filtra(x.t), `${x.s} ${x.t}`);
    }
    const asignador = { token: token(4, ['vales.ver', 'vales.asignar'], 5) };
    x = await pedir('POST', '/api/vales/1/asignar', { cookies: asignador, json: { tecnicoId: 'abc' } });
    chk('POST asignar con tecnicoId="abc" → 400 sin SQL', x.s === 400 && !filtra(x.t), `${x.s} ${x.t}`);
    x = await pedir('POST', '/api/vales/1/asignar', { cookies: asignador, json: { tecnicoId: [1, 2] } });
    chk('POST asignar con tecnicoId=[1,2] → 400 sin SQL', x.s === 400 && !filtra(x.t), `${x.s} ${x.t}`);
    x = await pedir('POST', '/api/vales/1/revisar', { cookies: { token: token(4, ['vales.ver', 'vales.revisar'], 5) }, json: { aprobar: false, tecnicoReasignadoId: { a: 1 } } });
    chk('POST revisar con tecnicoReasignadoId=objeto → 400 sin SQL', x.s === 400 && !filtra(x.t), `${x.s} ${x.t}`);
    x = await pedir('POST', '/api/vales/999999/confirmar', { cookies: { token: token(2, ['vales.ver', 'vales.confirmar'], 63) } });
    chk('error de negocio se conserva (vale inexistente → mensaje legible)', [400, 404].includes(x.s) && x.j && /vale/i.test(x.j.error), `${x.s} ${x.t}`);

    // ------------------------------------------------------------------
    seccion('T-21 Imágenes bomba de descompresión (asesor)');
    const asesor = { token: token(2, ['vales.ver', 'vales.crear'], 63) };
    let m = multipart([{ campo: 'imagenes', nombre: 'bomba.png', tipo: 'image/png', datos: png(50000, 50000) }]);
    x = await pedir('POST', '/api/vales', { cookies: asesor, cuerpo: m.cuerpo, tipo: m.tipo });
    chk('PNG 50000x50000 en ~100 bytes → 400 por dimensiones', x.s === 400 && /dimensiones/i.test(x.t), `${x.s} ${x.t}`);
    m = multipart([{ campo: 'imagenes', nombre: 'justo-arriba.png', tipo: 'image/png', datos: png(8001, 5000) }]);
    x = await pedir('POST', '/api/vales', { cookies: asesor, cuerpo: m.cuerpo, tipo: m.tipo });
    chk('PNG 8001x5000 (un píxel de fila sobre el tope) → 400', x.s === 400 && /dimensiones/i.test(x.t), `${x.s} ${x.t}`);
    m = multipart([{ campo: 'imagenes', nombre: 'normal.png', tipo: 'image/png', datos: png(800, 600) }]);
    x = await pedir('POST', '/api/vales', { cookies: asesor, cuerpo: m.cuerpo, tipo: m.tipo });
    chk('PNG 800x600 pasa la validación de imagen (falla después por datos del cliente, no por la imagen)', x.s === 400 && /cliente/i.test(x.t) && !/dimensiones/i.test(x.t), `${x.s} ${x.t}`);

    // ------------------------------------------------------------------
    seccion('T-05 / T-10 / T-11 Usuarios sin password_hash y sesiones cerradas al cambiar contraseña o desactivar');
    const a = await login(ADMIN.email, ADMIN.password);
    chk('login del Administrador de la base de pruebas', a.s === 200 && a.cookies.token && a.cookies.refresh_token, `${a.s} ${a.t.slice(0, 100)}`);
    const cAdmin = { token: a.cookies.token, refresh_token: a.cookies.refresh_token };
    x = await pedir('GET', '/api/admin/usuarios', { cookies: cAdmin });
    const lista = (x.j && x.j.usuarios) || [];
    chk(`GET /api/admin/usuarios: ${lista.length} usuarios y ninguno con password_hash/intentos_fallidos/bloqueado_hasta`,
      x.s === 200 && lista.length > 0 && lista.every(u => !('password_hash' in u) && !('intentos_fallidos' in u) && !('bloqueado_hasta' in u)), `${x.s} ${Object.keys(lista[0] || {}).join(',')}`);
    chk('el listado conserva los campos que usa el panel', lista.length > 0 && ['id', 'nombre', 'email', 'rol_id', 'activo', 'rol_nombre'].every(k => k in lista[0]), Object.keys(lista[0] || {}).join(','));
    const correoPrueba = `seguridad.prueba.${Date.now()}@pruebas.local`;
    x = await pedir('POST', '/api/admin/usuarios', { cookies: cAdmin, json: { nombre: 'Usuario de prueba', email: correoPrueba, password: 'Clave-Inicial-1', rolId: 6 } });
    chk('POST crear usuario: 201 sin password_hash en la respuesta', x.s === 201 && x.j && !('password_hash' in x.j), `${x.s} ${x.t.slice(0, 120)}`);
    const uid = x.j && x.j.id; if (uid) creados.push(uid);
    const u1 = await login(correoPrueba, 'Clave-Inicial-1');
    chk('el usuario nuevo inicia sesión', u1.s === 200 && u1.cookies.refresh_token, `${u1.s}`);
    const sidUsuario = jwtHelper.verifyToken(u1.cookies.token).sid;
    const vencido = jsonwebtoken.sign({ id: uid, sid: sidUsuario, exp: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret, { algorithm: 'HS256' });
    x = await pedir('GET', '/api/vales', { cookies: { token: vencido, refresh_token: u1.cookies.refresh_token } });
    chk('antes del cambio: su refresh token renueva la sesión (200)', x.s === 200 || x.s === 403, `${x.s}`);
    const refrescado = x.cookies.refresh_token || u1.cookies.refresh_token;
    x = await pedir('PUT', `/api/admin/usuarios/${uid}`, { cookies: cAdmin, json: { nombre: 'Usuario de prueba', email: correoPrueba, password: 'Clave-Nueva-2' } });
    chk('PUT cambiar contraseña: 200 sin password_hash', x.s === 200 && x.j && !('password_hash' in x.j), `${x.s} ${x.t.slice(0, 120)}`);
    x = await pedir('GET', '/api/vales', { cookies: { token: vencido, refresh_token: refrescado } });
    chk('T-10 tras cambiar la contraseña, el refresh token anterior YA NO sirve (401)', x.s === 401, `${x.s}`);
    const [filaSesion] = (await db.query('SELECT 1 FROM sesiones_activas WHERE usuario_id = ?', [uid]))[0];
    chk('...y su fila de sesión fue eliminada', !filaSesion, JSON.stringify(filaSesion));
    const u2 = await login(correoPrueba, 'Clave-Inicial-1');
    chk('la contraseña vieja ya no entra', u2.s === 401, u2.s);
    const u3 = await login(correoPrueba, 'Clave-Nueva-2');
    chk('la contraseña nueva entra', u3.s === 200, u3.s);
    const vencido3 = jsonwebtoken.sign({ id: uid, sid: jwtHelper.verifyToken(u3.cookies.token).sid, exp: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret, { algorithm: 'HS256' });
    x = await pedir('PATCH', `/api/admin/usuarios/${uid}/activo`, { cookies: cAdmin, json: { activo: false } });
    chk('PATCH desactivar usuario: 200', x.s === 200, `${x.s} ${x.t}`);
    x = await pedir('GET', '/api/vales', { cookies: { token: vencido3, refresh_token: u3.cookies.refresh_token } });
    chk('T-11 tras desactivarlo, su refresh token no sirve (401) de inmediato', x.s === 401, `${x.s}`);
    const [filaDesact] = (await db.query('SELECT 1 FROM sesiones_activas WHERE usuario_id = ?', [uid]))[0];
    chk('...y su fila de sesión fue eliminada', !filaDesact, JSON.stringify(filaDesact));
    await pedir('POST', '/api/auth/logout', { cookies: cAdmin });

    // ------------------------------------------------------------------
    seccion('Bloqueo de cuenta tras 5 contraseñas malas (encargado de diseño de la base de pruebas)');
    const tecnico = 'encargado.diseno@munditrofeos.com'; // contraseña de users.sql: disenoenc123
    await db.query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE email = ?', [tecnico]);
    for (let i = 0; i < 5; i++) await login(tecnico, 'mala-' + i);
    let [[fila]] = await db.query('SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE email = ?', [tecnico]);
    chk('al 5.º fallo la cuenta queda bloqueada (bloqueado_hasta en el futuro) y el contador se reinicia', fila.bloqueado_hasta !== null && fila.intentos_fallidos === 0, JSON.stringify(fila));
    x = await login(tecnico, 'disenoenc123');
    chk('con la cuenta bloqueada, ni la contraseña correcta entra (401 genérico, sin revelar el bloqueo)', x.s === 401 && x.j.error === 'Correo o contraseña incorrectos.', `${x.s} ${x.t}`);
    await db.query("UPDATE usuarios SET bloqueado_hasta = NOW() - INTERVAL 1 MINUTE WHERE email = ?", [tecnico]);
    x = await login(tecnico, 'disenoenc123');
    chk('vencido el bloqueo, la contraseña correcta vuelve a entrar', x.s === 200, `${x.s} ${x.t}`);
    if (x.s === 200) await pedir('POST', '/api/auth/logout', { cookies: x.cookies });
    [[fila]] = await db.query('SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE email = ?', [tecnico]);
    chk('un acierto reinicia el contador y limpia el bloqueo', fila.intentos_fallidos === 0 && fila.bloqueado_hasta === null, JSON.stringify(fila));
    await login(tecnico, 'mala'); await login(tecnico, 'mala');
    x = await login(tecnico, 'disenoenc123');
    chk('2 fallos seguidos de un acierto NO bloquean', x.s === 200, `${x.s}`);
    if (x.s === 200) await pedir('POST', '/api/auth/logout', { cookies: x.cookies });
    await db.query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE email = ?', [tecnico]);

    // ------------------------------------------------------------------
    seccion('T-09 Tiempo de respuesta del login: correo inexistente vs. real (15 muestras c/u, cuentas distintas)');
    const medir = async (correos) => { const t = []; for (const c of correos) { const i = process.hrtime.bigint(); await login(c, 'clave-incorrecta-1'); t.push(Number(process.hrtime.bigint() - i) / 1e6); } t.sort((p, q) => p - q); return t[Math.floor(t.length / 2)]; };
    const reales = (await db.query("SELECT email FROM usuarios WHERE activo = 1 AND email NOT IN (?, ?) LIMIT 15", [ADMIN.email, tecnico]))[0].map(r => r.email);
    const mediana = { inexistente: await medir(Array.from({ length: 15 }, (_, i) => `no.existe.${i}@pruebas.local`)), real: await medir(reales) };
    const diferencia = Math.abs(mediana.real - mediana.inexistente) / Math.max(mediana.real, mediana.inexistente);
    chk(`diferencia de mediana < 35 % (inexistente ${mediana.inexistente.toFixed(1)} ms, real ${mediana.real.toFixed(1)} ms, dif ${(diferencia * 100).toFixed(0)} %)`, diferencia < 0.35, `${(diferencia * 100).toFixed(0)} %`);
    await db.query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL');

    // ------------------------------------------------------------------
    seccion('T-08 Fuerza bruta y credential stuffing (al final: agota los límites del servidor)');
    let codigos = [];
    for (let i = 0; i < 14; i++) codigos.push((await login('gerente@munditrofeos.com', 'mala' + i)).s);
    chk(`14 intentos con el mismo correo: 429 desde el 11.º (${codigos.join(',')})`, codigos.slice(0, 10).every(c => c === 401) && codigos.slice(10).every(c => c === 429), codigos.join(','));
    codigos = [];
    for (const v of ['Gerente@munditrofeos.com', 'GERENTE@MUNDITROFEOS.COM', ' gerente@munditrofeos.com ', 'gErEnTe@munditrofeos.com']) codigos.push((await login(v, 'mala')).s);
    chk(`el mismo correo con otras mayúsculas/espacios sigue bloqueado (${codigos.join(',')})`, codigos.every(c => c === 429), codigos.join(','));
    codigos = [];
    for (let i = 0; i < 120; i++) codigos.push((await login(`stuffing.${i}@pruebas.local`, 'mala')).s);
    const primero429 = codigos.indexOf(429);
    chk(`credential stuffing: 120 correos distintos desde una IP → 429 tras el umbral por IP (primer 429 en el intento ${primero429 + 1})`, primero429 > 0 && primero429 <= 100, `primer 429: ${primero429}`);
    x = await login(ADMIN.email, ADMIN.password);
    chk('con el límite por IP agotado, incluso un login correcto recibe 429 (y responde JSON)', x.s === 429 && x.j && x.j.ok === false, x.s);
  } finally {
    for (const id of creados) { await db.query('DELETE FROM sesiones_activas WHERE usuario_id = ?', [id]); await db.query('DELETE FROM usuarios WHERE id = ?', [id]); }
    await db.query('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL');
    await db.end();
  }
  console.log(`\n${ok} OK, ${mal} fallas`);
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
