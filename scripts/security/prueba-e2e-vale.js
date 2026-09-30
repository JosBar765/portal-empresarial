#!/usr/bin/env node
// scripts/security/prueba-e2e-vale.js
// Verificación de extremo a extremo tras cada fase del plan de remediación:
// login real → crear un vale con imagen y PDF adjuntos (sube a Supabase Storage)
// → se genera el PDF del vale → se descarga con el dueño → otro asesor NO puede
// verlo (IDOR) → se limpia todo (base y bucket).
//
// Escribe en Storage: por seguridad SOLO corre si el bucket configurado termina
// en "_TEST", o si el servidor de prueba se arrancó con el sustituto local
// (`node --require ./scripts/security/stub-storage.js src/server.js` y
// STORAGE_STUB=1 aquí). Usa una base DESECHABLE y las cuentas de users.sql.
//   BASE_URL=http://127.0.0.1:3070 node scripts/security/prueba-e2e-vale.js
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const mysql = require(path.join(RAIZ, 'node_modules', 'mysql2', 'promise'));
const sharp = require(path.join(RAIZ, 'node_modules', 'sharp'));
const { PDFDocument } = require(path.join(RAIZ, 'node_modules', 'pdf-lib'));
const config = require(path.join(RAIZ, 'src', 'config', 'env'));
const supabaseStorage = require(path.join(RAIZ, 'src', 'core', 'files', 'supabaseStorage'));

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3070';
const CON_STUB = process.env.STORAGE_STUB === '1';
let ok = 0;
let mal = 0;
const chk = (n, c, d = '') => { c ? ok++ : mal++; console.log(`${c ? 'OK   ' : 'FALLA'} ${n}${c ? '' : '  -> ' + d}`); };

const cookiesDe = (res) => Object.fromEntries((res.headers.getSetCookie ? res.headers.getSetCookie() : []).map((c) => { const kv = c.split(';')[0]; const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
const cab = (ck) => ({ Cookie: Object.entries(ck).map(([k, v]) => `${k}=${v}`).join('; ') });
const login = async (email, password) => { const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); return { r, ck: cookiesDe(r), j: await r.json().catch(() => ({})) }; };
const fecha = (dias) => new Date(Date.now() - 6 * 3600 * 1000 + dias * 86400000).toISOString().slice(0, 10);

(async () => {
  if (!CON_STUB && !/_TEST$/.test(config.supabase.bucket)) {
    console.error(`Se niega a correr: el bucket "${config.supabase.bucket}" no termina en _TEST (y no se indicó STORAGE_STUB=1).`);
    process.exit(2);
  }
  const db = await mysql.createConnection({ host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password, database: config.db.database });
  let valeId = null;
  try {
    const a1 = await login('ventas2@grupopremia.com', 'asesor123');
    chk('login del asesor dueño', a1.r.status === 200 && a1.ck.refresh_token, `${a1.r.status} ${JSON.stringify(a1.j)}`);

    const imagen = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 30, g: 90, b: 200 } } }).png().toBuffer();
    const pdfAdjunto = await (async () => { const d = await PDFDocument.create(); d.addPage([400, 300]); d.addPage([400, 300]); return Buffer.from(await d.save()); })();
    const fd = new FormData();
    Object.entries({
      clienteEmpresa: 'Empresa de prueba', clienteNombre: 'Cliente de prueba', clienteTelefono: '+502 5555 1234', clienteCorreo: 'cliente@pruebas.local',
      producto: 'TRF-PRUEBA', material: 'Acrílico', tecnica: 'Grabado', acabado: 'Brillante', cantidad: '5', cotizacion: '250',
      fechaEntrega: fecha(6), fechaEvento: fecha(12), urgente: 'false', descripcion: 'Vale creado por la prueba de extremo a extremo.',
      talleresIds: JSON.stringify([1]), idempotencyKey: `e2e-${Date.now()}`
    }).forEach(([k, v]) => fd.append(k, v));
    fd.append('imagenes', new Blob([imagen], { type: 'image/png' }), 'foto.png');
    fd.append('documentos', new Blob([pdfAdjunto], { type: 'application/pdf' }), 'adjunto.pdf');
    const c = await fetch(`${BASE}/api/vales`, { method: 'POST', headers: cab(a1.ck), body: fd });
    const vale = await c.json().catch(() => ({}));
    valeId = vale.id || null;
    chk('crear vale con imagen + PDF (sube a Supabase): 201', c.status === 201 && valeId, `${c.status} ${JSON.stringify(vale).slice(0, 200)}`);

    if (valeId) {
      const [[fila]] = await db.query('SELECT correlativo, pdf_url FROM vales WHERE id = ?', [valeId]);
      chk(`el vale ${fila.correlativo} guardó la URL de su PDF`, !!fila.pdf_url, JSON.stringify(fila));
      const [docs] = await db.query('SELECT ruta, mime_type FROM vale_documentos WHERE vale_id = ?', [valeId]);
      chk('se registraron los 2 adjuntos (imagen y PDF) en Storage', docs.length === 2 && docs.every((d) => /^https?:\/\//.test(d.ruta)), JSON.stringify(docs));
      chk('los nombres en Storage son aleatorios (no contienen el nombre original)', docs.every((d) => !/foto|adjunto/i.test(d.ruta)), JSON.stringify(docs));

      const pdfRes = await fetch(`${BASE}/api/vales/${valeId}/pdf`, { headers: cab(a1.ck), redirect: 'manual' });
      chk('GET /pdf del dueño → 302 a la URL del PDF', pdfRes.status === 302 && pdfRes.headers.get('location'), `${pdfRes.status}`);
      const bytes = Buffer.from(await (await fetch(pdfRes.headers.get('location'))).arrayBuffer());
      chk('la URL entrega un PDF real (%PDF)', bytes.slice(0, 4).toString() === '%PDF', bytes.slice(0, 20).toString());
      const doc = await PDFDocument.load(bytes);
      chk(`el PDF del vale incluye las páginas del adjunto (${doc.getPageCount()} páginas, se esperan ≥ 3)`, doc.getPageCount() >= 3, doc.getPageCount());

      const det = await fetch(`${BASE}/api/vales/${valeId}`, { headers: cab(a1.ck) });
      chk('el dueño ve el detalle (200)', det.status === 200, det.status);

      const a2 = await login('ventas3@grupopremia.com', 'asesor123');
      chk('login de otro asesor', a2.r.status === 200, a2.r.status);
      if (a2.r.status === 200) {
        const ajeno = await fetch(`${BASE}/api/vales/${valeId}`, { headers: cab(a2.ck) });
        chk('IDOR: otro asesor NO ve el detalle (404)', ajeno.status === 404, ajeno.status);
        const ajenoPdf = await fetch(`${BASE}/api/vales/${valeId}/pdf`, { headers: cab(a2.ck), redirect: 'manual' });
        chk('IDOR: otro asesor NO obtiene el PDF (404, sin redirección)', ajenoPdf.status === 404 && !ajenoPdf.headers.get('location'), ajenoPdf.status);
        await fetch(`${BASE}/api/auth/logout`, { method: 'POST', headers: cab(a2.ck) });
      }
    }
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', headers: cab(a1.ck) });
  } finally {
    if (valeId) {
      const [[v]] = await db.query('SELECT pdf_url FROM vales WHERE id = ?', [valeId]);
      const [docs] = await db.query('SELECT ruta FROM vale_documentos WHERE vale_id = ?', [valeId]);
      for (const url of [v && v.pdf_url, ...docs.map((d) => d.ruta)].filter(Boolean)) {
        if (CON_STUB) continue; // el almacén de prueba vive en la memoria del servidor
        try { await supabaseStorage.eliminar(url); } catch (e) { console.warn('No se pudo borrar de Storage:', e.message); }
      }
      await db.query('DELETE FROM vales WHERE id = ?', [valeId]);
      await db.query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'e2e-%'");
      console.log(`(limpieza: vale ${valeId} borrado de la base${CON_STUB ? '' : ' y sus archivos del bucket ' + config.supabase.bucket})`);
    }
    await db.end();
  }
  console.log(`\n${ok} OK, ${mal} fallas`);
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
