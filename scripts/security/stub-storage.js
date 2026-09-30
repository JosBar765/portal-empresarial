// scripts/security/stub-storage.js
// SOLO PARA PRUEBAS. Sustituye Supabase Storage por un almacén en memoria con un
// servidor HTTP local, para poder verificar el flujo completo de un vale (subida
// de adjuntos → registro → generación del PDF con fetch de esos adjuntos) sin
// depender de internet ni de tocar un bucket real.
//
// Se carga al arrancar el servidor de prueba:
//   node --require ./scripts/security/stub-storage.js src/server.js
// y nunca en producción (se niega a cargarse con NODE_ENV=production).
const path = require('path');
const http = require('http');
const crypto = require('crypto');

if (process.env.NODE_ENV === 'production') {
  throw new Error('stub-storage.js es solo para pruebas y no puede cargarse con NODE_ENV=production.');
}

const RAIZ = path.join(__dirname, '..', '..');
const PUERTO = Number(process.env.STORAGE_STUB_PORT || 3075);
const almacen = new Map();

http.createServer((req, res) => {
  const objeto = almacen.get(req.url);
  if (!objeto) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', objeto.tipo);
  return res.end(objeto.buffer);
}).listen(PUERTO, '127.0.0.1');

const supabaseStorage = require(path.join(RAIZ, 'src', 'core', 'files', 'supabaseStorage'));
const { extensionParaTipo } = require(path.join(RAIZ, 'src', 'core', 'files', 'fileSignature'));

supabaseStorage.subir = async (buffer, nombreOriginal, mimeType) => {
  const objeto = crypto.randomBytes(16).toString('hex') + (extensionParaTipo(mimeType) || '');
  almacen.set(`/${objeto}`, { buffer, tipo: mimeType });
  return { path: objeto, url: `http://127.0.0.1:${PUERTO}/${objeto}`, size: buffer.length };
};
supabaseStorage.eliminar = async (url) => { almacen.delete(new URL(url).pathname); return true; };
console.log(`[stub-storage] Storage de pruebas en memoria, sirviendo en http://127.0.0.1:${PUERTO}`);
