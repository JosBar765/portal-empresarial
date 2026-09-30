#!/usr/bin/env node
// scripts/security/pruebas-sesion.js
// Regresión de sesiones (access token corto + refresh token rotativo, socket,
// revocación). Se ejecuta tras cada fase del plan de remediación para
// confirmar que la autenticación no se rompió. Usa una base DESECHABLE y las
// cuentas de users.sql; tarda ~40 s porque espera a que venza la ventana de
// concurrencia del refresh.
//   BASE_URL=http://127.0.0.1:3070 node scripts/security/pruebas-sesion.js
const path = require('path');
const R = path.join(__dirname, '..', '..') + '/';
const mysql = require(R + 'node_modules/mysql2/promise');
const jsonwebtoken = require(R + 'node_modules/jsonwebtoken');
const config = require(R + 'src/config/env');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3070';
let ok = 0, mal = 0;
const chk = (n, c, d = '') => { c ? ok++ : mal++; console.log(`${c ? 'OK   ' : 'FALLA'} ${n} ${c ? '' : d}`); };
const esperar = ms => new Promise(r => setTimeout(r, ms));
const crudas = res => res.headers.getSetCookie ? res.headers.getSetCookie() : [];
const cookiesDe = res => Object.fromEntries(crudas(res).map(c => { const kv = c.split(';')[0]; const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
const pet = (m, r, ck = {}, body) => fetch(BASE + r, { method: m, redirect: 'manual', headers: { 'Content-Type': 'application/json', Cookie: Object.entries(ck).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('; ') }, body: body && JSON.stringify(body) });
const vencido = (payload) => jsonwebtoken.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret, { algorithm: 'HS256' });
const login = async () => { const r = await pet('POST', '/api/auth/login', {}, { email: 'admin@munditrofeos.com', password: process.env.TEST_ADMIN_PASSWORD || 'Admon' }); return { r, c: cookiesDe(r) }; };
const sock = async (ck) => {
  const cab = { Cookie: Object.entries(ck).map(([k, v]) => `${k}=${v}`).join('; ') };
  const u = `${BASE}/socket.io/?EIO=4&transport=polling`;
  const h = await (await fetch(u, { headers: cab })).text();
  const sid = JSON.parse(h.slice(1)).sid;
  await fetch(`${u}&sid=${sid}`, { method: 'POST', headers: { ...cab, 'Content-Type': 'text/plain' }, body: '40' });
  await esperar(300);
  const t = await (await fetch(`${u}&sid=${sid}`, { headers: cab })).text();
  return t.startsWith('40') ? 'conectado' : (t.includes('No autenticado') ? 'rechazado' : t.slice(0, 80));
};
(async () => {
  const db = await mysql.createConnection({ host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password, database: config.db.database });
  await db.query("SET time_zone = '-06:00'");
  const fila = async () => (await db.query('SELECT * FROM sesiones_activas WHERE usuario_id = 1'))[0][0];
  await db.query('DELETE FROM sesiones_activas WHERE usuario_id = 1');

  // 1. Login
  let { r, c } = await login();
  chk('login: 200 con las dos cookies', r.status === 200 && c.token && c.refresh_token, r.status);
  const attrs = crudas(r).find(x => x.startsWith('refresh_token=')) || '';
  chk('refresh_token: HttpOnly, SameSite=Strict, Path=/', /HttpOnly/i.test(attrs) && /SameSite=Strict/i.test(attrs) && /Path=\//.test(attrs), attrs);
  chk('token de acceso: HttpOnly', /HttpOnly/i.test(crudas(r).find(x => x.startsWith('token=')) || ''));
  const acc = jsonwebtoken.decode(c.token);
  chk('access token dura 15 min', acc.exp - acc.iat === 900, acc.exp - acc.iat);
  let f = await fila();
  chk('en la base solo hay el hash (no el token)', f.refresh_hash && f.refresh_hash.length === 64 && f.refresh_hash !== c.refresh_token);
  chk('login con sesion activa sigue dando 409', (await pet('POST', '/api/auth/login', {}, { email: 'admin@munditrofeos.com', password: process.env.TEST_ADMIN_PASSWORD || 'Admon' })).status === 409);
  chk('API con access valido: 200', (await pet('GET', '/api/admin/roles', c)).status === 200);
  chk('sin cookies: API 401', (await pet('GET', '/api/admin/roles')).status === 401);
  const pag = await pet('GET', '/dashboard/');
  chk('sin cookies: pagina redirige a login', pag.status === 302 && /login/.test(pag.headers.get('location')));

  // 2. Access vencido + refresh -> renovacion transparente
  const payload = { id: acc.id, nombre: acc.nombre, email: acc.email, rolId: acc.rolId, rolNombre: acc.rolNombre, modulosPermitidos: acc.modulosPermitidos, permissions: acc.permissions, sid: acc.sid };
  const caducado = vencido(payload);
  chk('access vencido y sin refresh: 401', (await pet('GET', '/api/admin/roles', { token: caducado })).status === 401);
  r = await pet('GET', '/api/admin/roles', { token: caducado, refresh_token: c.refresh_token });
  let n = cookiesDe(r);
  chk('access vencido + refresh: 200 y cookies nuevas', r.status === 200 && n.token && n.refresh_token && n.refresh_token !== c.refresh_token, r.status);
  const viejoRefresh = c.refresh_token; let actual = n;
  chk('el techo de la sesion no se movio al rotar', String((await fila()).expira_en) === String(f.expira_en));

  // 3. Concurrencia
  const cad2 = vencido(payload);
  const rs = await Promise.all(Array.from({ length: 6 }, () => pet('GET', '/api/admin/roles', { token: cad2, refresh_token: actual.refresh_token })));
  const cks = rs.map(cookiesDe);
  chk('6 renovaciones simultaneas: todas 200', rs.every(x => x.status === 200), rs.map(x => x.status).join());
  chk('...y todas reciben el mismo refresh nuevo', new Set(cks.map(x => x.refresh_token)).size === 1 && cks[0].refresh_token !== actual.refresh_token);
  actual = cks[0];
  chk('sesion sigue viva tras la rafaga', !!(await fila()));

  // 4. /refresh
  r = await pet('POST', '/api/auth/refresh', { refresh_token: actual.refresh_token });
  n = cookiesDe(r);
  chk('POST /api/auth/refresh: 200 y rota', r.status === 200 && n.refresh_token && n.refresh_token !== actual.refresh_token, r.status);
  actual = n;

  // 5. Solo refresh
  r = await pet('GET', '/', { refresh_token: actual.refresh_token });
  chk("'/' con solo refresh: redirige a la app, no al login", r.status === 302 && !/login/.test(r.headers.get('location')), r.headers.get('location'));
  actual = { ...actual, ...cookiesDe(r) };
  r = await pet('GET', '/login/', { refresh_token: actual.refresh_token });
  chk("'/login/' con solo refresh: redirige (no muestra login)", r.status === 302 && !/login/.test(r.headers.get('location')), r.status);
  actual = { ...actual, ...cookiesDe(r) };
  r = await pet('GET', '/api/auth/session', { refresh_token: actual.refresh_token });
  const sj = await r.json();
  chk('session_check con solo refresh: autenticado', sj.autenticado === true && sj.user.email === 'admin@munditrofeos.com');
  actual = { ...actual, ...cookiesDe(r) };

  // 6. Socket
  chk('socket con access vencido y sesion viva: conectado', await sock({ token: vencido(payload) }) === 'conectado');
  chk('socket sin cookies: rechazado', await sock({}) === 'rechazado');
  chk('socket con firma falsa: rechazado', await sock({ token: jsonwebtoken.sign(payload, 'otro-secreto') }) === 'rechazado');

  // 7. Manipulacion
  chk('refresh alterado: 401', (await pet('GET', '/api/admin/roles', { token: caducado, refresh_token: actual.refresh_token + 'x' })).status === 401);
  chk('sesion intacta tras un token inventado', !!(await fila()));

  // 8. Reuso tras la ventana
  const anterior = actual.refresh_token;
  r = await pet('POST', '/api/auth/refresh', { refresh_token: anterior });
  actual = cookiesDe(r);
  console.log('...esperando 31 s para salir de la ventana de concurrencia');
  await esperar(31000);
  r = await pet('GET', '/api/admin/roles', { token: caducado, refresh_token: viejoRefresh });
  chk('token de hace varias rotaciones: 401 sin tumbar la sesion', r.status === 401 && !!(await fila()), r.status);
  r = await pet('GET', '/api/admin/roles', { token: caducado, refresh_token: anterior });
  chk('reuso del refresh inmediatamente anterior: 401', r.status === 401, r.status);
  chk('reuso revoca la sesion completa', !(await fila()));
  r = await pet('GET', '/api/admin/roles', { token: caducado, refresh_token: actual.refresh_token });
  chk('el refresh legitimo tambien queda muerto', r.status === 401);
  chk('socket con sesion revocada: rechazado', await sock({ token: vencido(payload) }) === 'rechazado');

  // 8b. Presencia: perder sockets NO borra la sesion; solo un login nuevo puede reemplazar una abandonada
  ({ r, c } = await login());
  const cadP = vencido({ ...payload, sid: jsonwebtoken.decode(c.token).sid });
  await db.query('UPDATE sesiones_activas SET conexiones_activas = 0, sin_conexiones_desde = NOW() WHERE usuario_id = 1');
  chk('sin sockets la fila sigue existiendo y su refresh renueva', (await pet('GET', '/api/admin/roles', { token: cadP, refresh_token: c.refresh_token })).status === 200);
  const rp = await pet('GET', '/api/admin/roles', { token: cadP, refresh_token: c.refresh_token });
  const vig = cookiesDe(rp);
  chk('sin sockets recien perdidos: otro login recibe 409', (await pet('POST', '/api/auth/login', {}, { email: 'admin@munditrofeos.com', password: process.env.TEST_ADMIN_PASSWORD || 'Admon' })).status === 409);
  await db.query('UPDATE sesiones_activas SET sin_conexiones_desde = NOW() - INTERVAL 40 SECOND WHERE usuario_id = 1');
  const otro = await login();
  chk('sesion abandonada (>30 s sin sockets): otro login la reemplaza', otro.r.status === 200, otro.r.status);
  chk('...y el refresh de la sesion reemplazada muere', (await pet('GET', '/api/admin/roles', { token: cadP, refresh_token: vig.refresh_token || c.refresh_token })).status === 401);
  await db.query('UPDATE sesiones_activas SET conexiones_activas = 2, sin_conexiones_desde = NULL WHERE usuario_id = 1');
  chk('con sockets abiertos: otro login recibe 409', (await pet('POST', '/api/auth/login', {}, { email: 'admin@munditrofeos.com', password: process.env.TEST_ADMIN_PASSWORD || 'Admon' })).status === 409);
  await db.query('DELETE FROM sesiones_activas WHERE usuario_id = 1');

  // 9. Login y logout con access vencido
  ({ r, c } = await login());
  chk('tras la revocacion se puede iniciar sesion', r.status === 200, r.status);
  const acc2 = jsonwebtoken.decode(c.token);
  const caducado2 = vencido({ ...payload, sid: acc2.sid });
  r = await pet('POST', '/api/auth/logout', { token: caducado2, refresh_token: c.refresh_token });
  chk('logout con access vencido: 200 y borra la sesion', r.status === 200 && !(await fila()));
  chk('logout limpia ambas cookies', crudas(r).filter(x => /^(token|refresh_token)=;/.test(x)).length === 2, crudas(r).join(' | '));
  chk('refresh de una sesion cerrada ya no sirve', (await pet('GET', '/api/admin/roles', { token: caducado2, refresh_token: c.refresh_token })).status === 401);

  // 10. Techo absoluto
  ({ r, c } = await login());
  await db.query('UPDATE sesiones_activas SET refresh_expira_en = NOW() - INTERVAL 1 MINUTE WHERE usuario_id = 1');
  r = await pet('GET', '/api/admin/roles', { token: vencido({ ...payload, sid: jsonwebtoken.decode(c.token).sid }), refresh_token: c.refresh_token });
  chk('refresh con el techo de sesion vencido: 401', r.status === 401);
  await db.query('DELETE FROM sesiones_activas WHERE usuario_id = 1');

  // 11. Usuario desactivado
  ({ r, c } = await login());
  const sidN = jsonwebtoken.decode(c.token).sid;
  await db.query('UPDATE usuarios SET activo = 0 WHERE id = 1');
  r = await pet('GET', '/api/admin/roles', { token: vencido({ ...payload, sid: sidN }), refresh_token: c.refresh_token });
  chk('usuario desactivado: la renovacion falla (401)', r.status === 401, r.status);
  chk('...y su sesion se elimina', !(await fila()));
  await db.query('UPDATE usuarios SET activo = 1 WHERE id = 1');

  // 12. Permisos frescos
  ({ r, c } = await login());
  const sidP = jsonwebtoken.decode(c.token).sid;
  const [[pm]] = await db.query("SELECT id FROM permisos WHERE codigo = 'vales.crear'");
  await db.query('INSERT INTO rol_permisos (rol_id, permiso_id) VALUES (1, ?)', [pm.id]);
  r = await pet('GET', '/api/auth/session', { token: vencido({ ...payload, sid: sidP }), refresh_token: c.refresh_token });
  const sp = await r.json();
  chk('la renovacion trae los permisos vigentes de la base', sp.user.permissions.includes('vales.crear'));
  await db.query('DELETE FROM rol_permisos WHERE rol_id = 1 AND permiso_id = ?', [pm.id]);
  await pet('POST', '/api/auth/logout', cookiesDe(r));
  await db.query('DELETE FROM sesiones_activas WHERE usuario_id = 1');
  const [[a]] = await db.query('SELECT activo FROM usuarios WHERE id = 1');
  chk('base restaurada (admin activo)', a.activo === 1);
  console.log(`\n${ok} OK, ${mal} fallas`);
  await db.end();
})().catch(e => { console.error('ERROR', e); process.exit(1); });
