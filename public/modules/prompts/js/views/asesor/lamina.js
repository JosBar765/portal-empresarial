// Lámina de referencia: cuadrícula numerada de imágenes + logo como último recuadro.
// calcularLayout es puro (sin DOM); el dibujo en canvas va aparte.
export const CELDA = 320;
export const HUECO = 16;
export const MARGEN = 24;
export const ALTO_PIE = 30; // espacio para el nombre del archivo bajo cada recuadro
const RELLENO = 12;

export function calcularLayout(n) {
  const columnas = n <= 4 ? Math.max(n, 1) : n <= 8 ? 4 : 5;
  const filas = Math.max(Math.ceil(n / columnas), 1);
  const altoFila = CELDA + ALTO_PIE;
  const ancho = MARGEN * 2 + columnas * CELDA + (columnas - 1) * HUECO;
  const alto = MARGEN * 2 + filas * altoFila + (filas - 1) * HUECO;
  const celdas = Array.from({ length: n }, (_, i) => ({
    x: MARGEN + (i % columnas) * (CELDA + HUECO),
    y: MARGEN + Math.floor(i / columnas) * (altoFila + HUECO)
  }));
  return { columnas, filas, ancho, alto, celdas };
}

const FUENTE = "'Inter', 'Segoe UI', Arial, sans-serif";

// Resuelve null si la imagen no carga: la lámina se dibuja igual con un marcador.
function cargarImagen(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function recortarTexto(ctx, texto, anchoMax) {
  if (ctx.measureText(texto).width <= anchoMax) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > anchoMax) t = t.slice(0, -1);
  return `${t}…`;
}

function dibujarImagen(ctx, img, x, y) {
  const caja = CELDA - RELLENO * 2;
  const iw = img.naturalWidth || caja; // SVG sin tamaño propio: llena la caja
  const ih = img.naturalHeight || caja;
  const escala = Math.min(caja / iw, caja / ih);
  const w = iw * escala;
  const h = ih * escala;
  ctx.drawImage(img, x + RELLENO + (caja - w) / 2, y + RELLENO + (caja - h) / 2, w, h);
}

function dibujarMarcadorFallido(ctx, x, y) {
  const lado = 96;
  const bx = x + (CELDA - lado) / 2;
  const by = y + (CELDA - lado) / 2;
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(bx, by, lado, lado);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx + 28, by + 28); ctx.lineTo(bx + lado - 28, by + lado - 28);
  ctx.moveTo(bx + lado - 28, by + 28); ctx.lineTo(bx + 28, by + lado - 28);
  ctx.stroke();
}

function dibujarInsignia(ctx, numero, x, y) {
  ctx.fillStyle = '#1B2130';
  ctx.beginPath();
  ctx.arc(x + 26, y + 26, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 16px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(numero), x + 26, y + 27);
}

// recuadros: [{numero, nombre, url, esLogo}] en orden; resuelve { canvas, blob }.
export async function dibujarLamina(recuadros) {
  const layout = calcularLayout(recuadros.length);
  const canvas = document.createElement('canvas');
  canvas.width = layout.ancho;
  canvas.height = layout.alto;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const imagenes = await Promise.all(recuadros.map(r => cargarImagen(r.url)));
  recuadros.forEach((r, i) => {
    const { x, y } = layout.celdas[i];
    ctx.fillStyle = r.esLogo ? '#F1F5F9' : '#FFFFFF';
    ctx.fillRect(x, y, CELDA, CELDA);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, CELDA - 1, CELDA - 1);
    if (imagenes[i]) dibujarImagen(ctx, imagenes[i], x, y);
    else dibujarMarcadorFallido(ctx, x, y);
    dibujarInsignia(ctx, r.numero, x, y);
    ctx.fillStyle = '#475569';
    ctx.font = `14px ${FUENTE}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(recortarTexto(ctx, r.esLogo ? 'Logo Grupo Premia' : r.nombre, CELDA), x, y + CELDA + 20);
  });

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo crear la lámina.');
  return { canvas, blob };
}

// Une la respuesta de /generar con los archivos del asesor (clave + orden).
export function armarRecuadros(lamina, archivosPorClave) {
  const usados = {};
  const recuadros = lamina.items.map((it) => {
    const i = usados[it.parametro] = (usados[it.parametro] ?? -1) + 1;
    const archivo = (archivosPorClave[it.parametro] || [])[i];
    return { numero: it.numero, nombre: it.nombre, url: archivo ? archivo.url : '', parametro: it.parametro, esLogo: false };
  });
  recuadros.push({ numero: lamina.logo.numero, nombre: 'Logo Grupo Premia', url: lamina.logo.url, esLogo: true });
  return recuadros;
}
