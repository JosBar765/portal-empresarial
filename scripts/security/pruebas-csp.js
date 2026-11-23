#!/usr/bin/env node
// scripts/security/pruebas-csp.js
// Verifica la política de seguridad de contenido (src/core/seguridad/csp.js): sin unsafe-inline ni unsafe-eval en scripts, cada script en línea
// de los HTML cubierto por su hash (calculado como lo hace el navegador, con CRLF convertido en LF) y, si se da BASE_URL, que el servidor
// envíe la cabecera con esos hashes.   Uso:  node scripts/security/pruebas-csp.js   [BASE_URL=http://127.0.0.1:3030 ...]
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const RAIZ = path.join(__dirname, '..', '..');
const { directivas, hashesDeScriptsEnLinea } = require(path.join(RAIZ, 'src', 'core', 'seguridad', 'csp.js'));

let ok = 0; let mal = 0;
const chk = (n, c, d = '') => { if (c) ok++; else mal++; console.log(`${c ? 'OK   ' : 'FALLA'} ${n}${c ? '' : '  -> ' + d}`); };
const hashDe = (texto) => `'sha256-${crypto.createHash('sha256').update(texto.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`;

(async () => {
  const publica = path.join(RAIZ, 'public');
  const d = directivas({ carpetaPublica: publica, urlAlmacenamiento: 'https://ejemplo.supabase.co/storage/v1' });
  chk('script-src no admite unsafe-inline ni unsafe-eval', !d.scriptSrc.includes("'unsafe-inline'") && !d.scriptSrc.includes("'unsafe-eval'"), d.scriptSrc.join(' '));
  chk('no hay onclick="" ni similares (script-src-attr none)', d.scriptSrcAttr.join() === "'none'");
  chk('object-src none, base-uri y form-action solo del sitio, frame-ancestors del sitio', d.objectSrc.join() === "'none'" && d.baseUri.join() === "'self'" && d.formAction.join() === "'self'" && d.frameAncestors.join() === "'self'");
  chk('las imágenes y los marcos admiten el almacenamiento configurado, y solo ese', d.imgSrc.includes('https://ejemplo.supabase.co') && d.frameSrc.includes('https://ejemplo.supabase.co') && !d.imgSrc.includes('*'));
  chk('sin almacenamiento configurado no se abre ningún origen extra', !directivas({ carpetaPublica: publica, urlAlmacenamiento: '' }).imgSrc.some(x => /^https/.test(x)));

  // Cada <script> en línea de cada HTML está cubierto por su hash
  const faltantes = [];
  let total = 0;
  const recorrer = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const r = path.join(dir, e.name); if (e.isDirectory()) { recorrer(r); continue; } if (!e.name.endsWith('.html')) continue; const html = fs.readFileSync(r, 'utf8'); for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) { if (/\bsrc\s*=/i.test(m[1]) || !m[2].trim()) continue; total++; if (!d.scriptSrc.includes(hashDe(m[2]))) faltantes.push(path.relative(publica, r)); } } };
  recorrer(publica);
  chk(`los ${total} scripts en línea de los HTML tienen su hash`, total > 0 && !faltantes.length, faltantes.join(', '));

  // Regresión: el navegador normaliza CRLF a LF antes de calcular el hash; con CRLF sin normalizar el hash no coincidía y el login no corría
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'csp-'));
  fs.writeFileSync(path.join(tmp, 'a.html'), '<script>\r\nconsole.log(1);\r\n</script>');
  fs.writeFileSync(path.join(tmp, 'b.html'), '<script>\nconsole.log(1);\n</script>');
  const hashes = hashesDeScriptsEnLinea(tmp);
  chk('un script con CRLF y el mismo con LF dan el mismo hash', hashes.length === 1, hashes.join(' '));
  fs.rmSync(tmp, { recursive: true, force: true });

  if (process.env.BASE_URL) {
    const r = await fetch(process.env.BASE_URL + '/login/');
    const cab = r.headers.get('content-security-policy') || '';
    chk('el servidor envía Content-Security-Policy en /login/', /default-src 'self'/.test(cab), cab.slice(0, 80));
    chk('la cabecera trae el hash del script del login', d.scriptSrc.filter(x => x.startsWith("'sha256-")).every(h => cab.includes(h)));
    chk('la cabecera no admite unsafe-eval ni unsafe-inline en scripts', !/script-src[^;]*'unsafe-(eval|inline)'/.test(cab));
  }
  console.log(`\n${ok} OK, ${mal} fallas`);
  process.exit(mal ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
