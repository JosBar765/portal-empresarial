// src/modules/viaticos/services/pdf/pdfHelpers.js
// Medidas, colores, formatos y dibujo básico del PDF de la solicitud (mismo estilo «recibo» que el vale de arte).
const { rgb } = require('pdf-lib');
const { formatear, aCentavos } = require('../../dinero');

const PAGINA = Object.freeze({ ANCHO: 612, ALTO: 792, MARGEN: 40, LIMITE_INFERIOR: 44, ALTO_PIE: 30 });
const ANCHO_CONTENIDO = PAGINA.ANCHO - PAGINA.MARGEN * 2;

const COLOR = Object.freeze({
  texto: rgb(0, 0, 0),
  etiqueta: rgb(0.45, 0.48, 0.52),
  divisor: rgb(0.85, 0.85, 0.85),
  divisorFuerte: rgb(0.15, 0.15, 0.15),
  marco: rgb(0.6, 0.6, 0.6),
  rojo: rgb(0.8, 0.1, 0.1),
  amarillo: rgb(0.85, 0.62, 0)
});

// Un texto sin espacios o más largo que la celda se parte; si pasa de `maxLineas`, termina en «...».
function partirEnLineas(texto, medir, maxWidth, maxLineas) {
  const lineas = [];
  let actual = '';
  const cerrarLinea = () => { lineas.push(actual); actual = ''; };
  for (const palabra of String(texto ?? '').split(/\s+/).filter(Boolean)) {
    let resto = palabra;
    while (medir(resto) > maxWidth) {
      if (actual) cerrarLinea();
      let n = resto.length;
      while (n > 1 && medir(resto.slice(0, n)) > maxWidth) n -= 1;
      lineas.push(resto.slice(0, n));
      resto = resto.slice(n);
    }
    const tentativa = actual ? `${actual} ${resto}` : resto;
    if (actual && medir(tentativa) > maxWidth) { cerrarLinea(); actual = resto; } else { actual = tentativa; }
  }
  if (actual) lineas.push(actual);
  if (!lineas.length) return ['-'];
  if (lineas.length <= maxLineas) return lineas;
  const visibles = lineas.slice(0, maxLineas);
  let ultima = visibles[maxLineas - 1];
  while (ultima.length > 1 && medir(`${ultima}...`) > maxWidth) ultima = ultima.slice(0, -1);
  visibles[maxLineas - 1] = `${ultima}...`;
  return visibles;
}

// «AAAA-MM-DD[ HH:mm]» (o con «T») -> «dd/mm/aaaa[ HH:mm]».
function formatearFecha(valor, conHora = false) {
  if (!valor) return '-';
  const [f, h] = String(valor).replace('T', ' ').split(' ');
  const [y, m, d] = f.split('-');
  if (!y || !m || !d) return String(valor);
  const hm = (h || '').slice(0, 5);
  return `${d}/${m}/${y}${conHora && hm ? ' ' + hm : ''}`;
}

// 1234.5 -> «1,234.5»; sin ceros sobrantes (km, horas, rendimiento).
function formatearNumero(valor) {
  const [enteros, decimales] = Number(valor).toFixed(2).replace(/\.?0+$/, '').split('.');
  return `${enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${decimales ? '.' + decimales : ''}`;
}

// Importe con el símbolo de la moneda y 2 decimales.
function formatearDinero(simbolo, importe) {
  return `${simbolo} ${formatear(aCentavos(importe))}`;
}

const capitalizar = texto => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '');

// Utilidades de dibujo sobre el contexto { pdfDoc, font, fontBold, page, y, caracteres }.
// Un carácter que Helvetica no dibuja se sustituye por «?» para que el PDF nunca falle por un texto.
function seguro(ctx, texto) {
  return [...String(texto ?? '').replace(/[\r\n\t]+/g, ' ')].map(c => (ctx.caracteres.has(c.codePointAt(0)) ? c : '?')).join('');
}

function ancho(ctx, texto, size, bold = false) {
  return (bold ? ctx.fontBold : ctx.font).widthOfTextAtSize(seguro(ctx, texto), size);
}

function texto(ctx, valor, x, y, { size = 9, bold = false, color = COLOR.texto } = {}) {
  ctx.page.drawText(seguro(ctx, valor), { x, y, size, font: bold ? ctx.fontBold : ctx.font, color });
}

function textoDerecha(ctx, valor, xDerecha, y, opciones = {}) {
  texto(ctx, valor, xDerecha - ancho(ctx, valor, opciones.size || 9, opciones.bold), y, opciones);
}

// Partes de distinto color en una sola línea, alineadas a la derecha: [{ texto, color, bold }].
function textoMulticolor(ctx, partes, xDerecha, y, size = 9) {
  let x = xDerecha - partes.reduce((s, p) => s + ancho(ctx, p.texto, size, p.bold), 0);
  for (const p of partes) {
    texto(ctx, p.texto, x, y, { size, bold: p.bold, color: p.color });
    x += ancho(ctx, p.texto, size, p.bold);
  }
}

function linea(ctx, y, { grosor = 0.75, color = COLOR.divisor } = {}) {
  ctx.page.drawLine({
    start: { x: PAGINA.MARGEN, y }, end: { x: PAGINA.MARGEN + ANCHO_CONTENIDO, y }, thickness: grosor, color
  });
}

module.exports = {
  PAGINA, ANCHO_CONTENIDO, COLOR, partirEnLineas, formatearFecha, formatearNumero, formatearDinero, capitalizar,
  seguro, ancho, texto, textoDerecha, textoMulticolor, linea
};
