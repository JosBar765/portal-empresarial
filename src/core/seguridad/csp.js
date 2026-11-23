// src/core/seguridad/csp.js
// Política de seguridad de contenido (CSP). El navegador solo ejecuta scripts de esta misma página, del CDN de los íconos y los scripts en
// línea que ya existen en los HTML del portal, identificados por su hash: un script inyectado por un atacante (XSS) no coincide con ninguno
// y no se ejecuta. Sin `unsafe-inline` ni `unsafe-eval` en `script-src`.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CDN_ICONOS = 'https://unpkg.com';
const FUENTES_CSS = 'https://fonts.googleapis.com';
const FUENTES_ARCHIVOS = 'https://fonts.gstatic.com';

// Hashes SHA-256 de los <script> sin `src` de todos los HTML de `carpeta` (el login y, tras el despliegue, el importmap con las versiones).
// Se calculan al arrancar: un script en línea nuevo en un HTML queda cubierto solo; uno que no está en los archivos, no.
function hashesDeScriptsEnLinea(carpeta) {
  const hashes = new Set();
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') recorrer(ruta); continue; }
      if (!e.name.endsWith('.html')) continue;
      const html = fs.readFileSync(ruta, 'utf8');
      const patron = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
      let m;
      while ((m = patron.exec(html))) {
        if (/\bsrc\s*=/i.test(m[1]) || !m[2].trim()) continue;
        // El navegador convierte CRLF en LF al leer el HTML, y el hash se calcula sobre ese texto ya normalizado.
        const texto = m[2].replace(/\r\n?/g, '\n');
        hashes.add(`'sha256-${crypto.createHash('sha256').update(texto, 'utf8').digest('base64')}'`);
      }
    }
  };
  if (fs.existsSync(carpeta)) recorrer(carpeta);
  return [...hashes].sort();
}

// `urlAlmacenamiento`: la URL de Supabase Storage (de donde vienen las imágenes y los PDF de los vales); puede estar vacía.
function directivas({ carpetaPublica, urlAlmacenamiento }) {
  let almacenamiento = null;
  try { almacenamiento = urlAlmacenamiento ? new URL(urlAlmacenamiento).origin : null; } catch (e) { almacenamiento = null; }
  const conAlmacenamiento = (lista) => (almacenamiento ? [...lista, almacenamiento] : lista);
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", CDN_ICONOS, ...hashesDeScriptsEnLinea(carpetaPublica)],
    scriptSrcAttr: ["'none'"],                                       // sin onclick="" ni similares
    // Los estilos en línea (atributos style) los usa la interfaz para barras y anchos; no ejecutan código.
    styleSrc: ["'self'", "'unsafe-inline'", FUENTES_CSS],
    fontSrc: ["'self'", FUENTES_ARCHIVOS, 'data:'],
    imgSrc: conAlmacenamiento(["'self'", 'data:', 'blob:']),
    // `'self'` cubre también el WebSocket de Socket.IO del mismo sitio; unpkg sirve los íconos SVG.
    connectSrc: conAlmacenamiento(["'self'", CDN_ICONOS]),
    frameSrc: conAlmacenamiento(["'self'", 'blob:']),
    mediaSrc: conAlmacenamiento(["'self'", 'blob:']),
    workerSrc: ["'self'", 'blob:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"]
  };
}

module.exports = { directivas, hashesDeScriptsEnLinea };
