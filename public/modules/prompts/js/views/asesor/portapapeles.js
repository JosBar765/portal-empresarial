// Portapapeles y canvas: imagen a PNG en su resolución natural, texto con respaldo.
import { t } from '../../textos.js';

// Constantes técnicas del canvas (no son reglas de negocio).
const LADO_SVG = 1024; // un SVG sin tamaño propio se dibuja con este lado mayor
const MIME_COPIA = 'image/png';

export const puedeCopiarImagen = () => !!(window.isSecureContext && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);

export function cargarImagen(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('asesor.errores.imagenNoLegible'))); };
    img.src = url;
  });
}

// Tamaño natural en píxeles; un SVG sin tamaño propio usa LADO_SVG.
export const tamanoNatural = (img) => (img.naturalWidth && img.naturalHeight
  ? { ancho: img.naturalWidth, alto: img.naturalHeight }
  : { ancho: LADO_SVG, alto: LADO_SVG });

// Convierte cualquier formato a PNG sin redimensionar (resolución natural).
export async function aPng(blob) {
  const img = await cargarImagen(blob);
  const { ancho, alto } = tamanoNatural(img);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d').drawImage(img, 0, 0, ancho, alto);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error(t('asesor.errores.imagenNoLegible')))), MIME_COPIA));
}

// Los errores ya vienen explicados: quien llama solo los muestra.
export async function copiarImagen(blob) {
  if (!puedeCopiarImagen()) throw new Error(t('asesor.errores.copiaImagenNoPermitida'));
  const png = await aPng(blob);
  try {
    await navigator.clipboard.write([new ClipboardItem({ [MIME_COPIA]: png })]);
  } catch (e) {
    throw new Error(t('asesor.errores.copiaImagenNoPermitida'));
  }
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
