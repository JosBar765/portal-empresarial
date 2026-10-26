// Portapapeles y canvas: imagen a PNG en su resolución natural, texto con respaldo.
const LADO_SVG = 1024; // un SVG sin tamaño propio se dibuja con este lado mayor

export const puedeCopiarImagen = () => !!(window.isSecureContext && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);

function cargarImagen(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen no legible')); };
    img.src = url;
  });
}

// Convierte cualquier formato a PNG sin redimensionar (resolución natural).
export async function aPng(blob) {
  const img = await cargarImagen(blob);
  let ancho = img.naturalWidth;
  let alto = img.naturalHeight;
  if (!ancho || !alto) { ancho = LADO_SVG; alto = LADO_SVG; }
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d').drawImage(img, 0, 0, ancho, alto);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('sin PNG'))), 'image/png'));
}

export async function copiarImagen(blob) {
  if (!puedeCopiarImagen()) throw new Error('portapapeles de imágenes no disponible');
  const png = await aPng(blob);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

// Respaldo sin API de portapapeles: deja el texto seleccionado para Ctrl+C.
function seleccionarTexto(nodo) {
  const rango = document.createRange();
  rango.selectNodeContents(nodo);
  const seleccion = window.getSelection();
  seleccion.removeAllRanges();
  seleccion.addRange(rango);
  try { return document.execCommand('copy'); } catch (e) { return false; }
}

// Devuelve true si copió; false si solo quedó seleccionado para copiar a mano.
export async function copiarTexto(texto, nodoRespaldo) {
  try {
    if (!(navigator.clipboard && navigator.clipboard.writeText)) throw new Error('sin portapapeles');
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    return seleccionarTexto(nodoRespaldo);
  }
}

export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
