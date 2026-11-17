// src/modules/viaticos/services/pdf/reportePdfService.js
// PDF del reporte de viáticos: hoja carta en blanco y negro con resumen, ranking, pastel y tabla por solicitante.
// Es una función pura de los datos del reporte (los mismos del JSON): no lee la base.
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { REPORTES } = require('../../constantes');
const { msg } = require('../../mensajes');
const {
  PAGINA, ANCHO_CONTENIDO, COLOR, partirEnLineas, formatearFecha, formatearDinero, ancho, texto, textoDerecha, linea
} = require('./pdfHelpers');

const RUTA_LOGO = path.join(__dirname, '../../../../../public/assets/logos/LOGO_GP_isotipo.png');
const t = (clave, params) => msg(`reportePdf.${clave}`, params);

const ALTO_LOGO = 40;
const ALTO_FILA = 15;
const ALTO_BARRA = 9;
const ANCHO_NOMBRE_BARRA = 150;
const ANCHO_MAX_BARRA = 230;
const RADIO_PASTEL = 62;
// Colores de las categorías = los de la pantalla (tokens de global.css), en el orden hospedaje, combustible, alimentación, depreciación y otros.
const hexARgb = (hex) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
const COLORES = ['#1B2130', '#2563EB', '#E85D04', '#16A34A', '#94A3B8'].map(hexARgb);
const COLOR_BARRA = COLORES[1];
const X_DER = PAGINA.MARGEN + ANCHO_CONTENIDO;
// Columnas de la tabla por solicitante: [clave, ancho, alineación].
const COLUMNAS = [['numero', 24, 'izq'], ['solicitante', 190, 'izq'], ['solicitudes', 70, 'der'], ['total', 100, 'der'], ['porcentaje', 50, 'der'], ['promedio', 98, 'der']];

const porcentaje = valor => `${Number(valor).toFixed(1)} %`;

function nuevaPagina(ctx) {
  ctx.page = ctx.pdfDoc.addPage([PAGINA.ANCHO, PAGINA.ALTO]);
  ctx.y = PAGINA.ALTO - PAGINA.MARGEN;
  cabecera(ctx);
}

// Mismo encabezado en cada página: logo, título y los filtros de la ventana.
function cabecera(ctx) {
  const { datos, page } = ctx;
  let xTexto = PAGINA.MARGEN;
  if (ctx.logo) {
    const dims = ctx.logo.scaleToFit(ALTO_LOGO, ALTO_LOGO);
    page.drawImage(ctx.logo, { x: PAGINA.MARGEN, y: ctx.y - dims.height, width: dims.width, height: dims.height });
    xTexto += dims.width + 12;
  }
  texto(ctx, t('titulo'), xTexto, ctx.y - 18, { size: 18, bold: true });
  textoDerecha(ctx, t('generado', { fecha: formatearFecha(datos.generado) }), X_DER, ctx.y - 16, { size: 8, color: COLOR.etiqueta });
  const moneda = datos.moneda ? `${datos.moneda.nombre} (${datos.moneda.simbolo})` : '-';
  const pais = datos.pais ? datos.pais.nombre : t('paisTodos');
  const detalle = [t('ventana', { desde: formatearFecha(datos.desde), hasta: formatearFecha(datos.hasta) }), t('moneda', { moneda }), t('pais', { pais })].join('   |   ');
  texto(ctx, detalle, xTexto, ctx.y - 32, { size: 8.5 });
  ctx.y -= ALTO_LOGO + 8;
  linea(ctx, ctx.y, { grosor: 1, color: COLOR.divisorFuerte });
  ctx.y -= 14;
}

// Salta de página si lo que viene no cabe; devuelve true cuando saltó (para repetir encabezados de tabla).
function asegurar(ctx, alto) {
  if (ctx.y - alto >= PAGINA.LIMITE_INFERIOR) return false;
  nuevaPagina(ctx);
  return true;
}

function titulo(ctx, valor) {
  asegurar(ctx, 40);
  texto(ctx, valor, PAGINA.MARGEN, ctx.y - 10, { size: 11, bold: true });
  ctx.y -= 18;
}

function dibujarResumen(ctx) {
  const { resumen, moneda } = ctx.datos;
  const dinero = valor => (moneda ? formatearDinero(moneda.simbolo, valor) : '-');
  const cifras = [
    [t('resumenTotal'), dinero(resumen.total)],
    [t('resumenSolicitudes'), String(resumen.solicitudes)],
    [t('resumenSolicitantes'), String(resumen.solicitantes)],
    [t('resumenPromedio'), dinero(resumen.promedio)]
  ];
  const separacion = 8;
  const anchoCaja = (ANCHO_CONTENIDO - separacion * 3) / 4;
  const altoCaja = 40;
  cifras.forEach(([etiqueta, valor], i) => {
    const x = PAGINA.MARGEN + i * (anchoCaja + separacion);
    ctx.page.drawRectangle({ x, y: ctx.y - altoCaja, width: anchoCaja, height: altoCaja, borderColor: COLOR.marco, borderWidth: 0.8 });
    texto(ctx, etiqueta, x + 6, ctx.y - 13, { size: 6.5, bold: true, color: COLOR.etiqueta });
    const [linea1] = partirEnLineas(valor, s => ancho(ctx, s, 11, true), anchoCaja - 12, 1);
    texto(ctx, linea1, x + 6, ctx.y - 31, { size: 11, bold: true });
  });
  ctx.y -= altoCaja + 4;
  texto(ctx, t('nota'), PAGINA.MARGEN, ctx.y - 8, { size: 7.5, color: COLOR.etiqueta });
  ctx.y -= 22;
}

// Barras horizontales de los solicitantes con mayor inversión (la tabla de abajo trae a todos).
function dibujarRanking(ctx) {
  const { solicitantes, moneda } = ctx.datos;
  const barras = solicitantes.slice(0, REPORTES.PDF_MAX_BARRAS);
  titulo(ctx, solicitantes.length > barras.length ? t('tituloRankingTop', { max: REPORTES.PDF_MAX_BARRAS }) : t('tituloRanking'));
  const mayor = Math.max(...barras.map(s => s.total), 0);
  const xBarra = PAGINA.MARGEN + ANCHO_NOMBRE_BARRA + 6;
  for (const s of barras) {
    asegurar(ctx, ALTO_FILA);
    const [nombre] = partirEnLineas(s.nombre, m => ancho(ctx, m, 8.5), ANCHO_NOMBRE_BARRA, 1);
    texto(ctx, nombre, PAGINA.MARGEN, ctx.y - 10, { size: 8.5 });
    const largo = mayor > 0 ? Math.max(1, (s.total / mayor) * ANCHO_MAX_BARRA) : 0;
    ctx.page.drawRectangle({ x: xBarra, y: ctx.y - 11, width: largo, height: ALTO_BARRA, color: COLOR_BARRA });
    textoDerecha(ctx, `${formatearDinero(moneda.simbolo, s.total)}  ·  ${porcentaje(s.porcentaje)}`, X_DER, ctx.y - 10, { size: 8.5 });
    ctx.y -= ALTO_FILA;
  }
  ctx.y -= 12;
}

// Rebanada del pastel: de `desde` a `hasta` radianes, en sentido horario desde las 12 en punto. drawSvgPath trabaja con y hacia abajo.
function rebanada(ctx, cx, cy, desde, hasta, color) {
  const punto = angulo => [cx + RADIO_PASTEL * Math.sin(angulo), PAGINA.ALTO - cy - RADIO_PASTEL * Math.cos(angulo)];
  const [x1, y1] = punto(desde);
  const [x2, y2] = punto(hasta);
  const grande = hasta - desde > Math.PI ? 1 : 0;
  const d = `M ${cx} ${PAGINA.ALTO - cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${RADIO_PASTEL} ${RADIO_PASTEL} 0 ${grande} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
  ctx.page.drawSvgPath(d, { x: 0, y: PAGINA.ALTO, color, borderColor: rgb(1, 1, 1), borderWidth: 1 });
}

function dibujarReparto(ctx) {
  const { reparto, moneda } = ctx.datos;
  const alcance = reparto.alcance.nombre || t('alcanceTodos');
  const alto = RADIO_PASTEL * 2 + 16;
  asegurar(ctx, alto + 40);
  titulo(ctx, `${t('tituloReparto')}: ${alcance}`);
  if (reparto.categorias.length === 0) {
    texto(ctx, t('sinMovimientos'), PAGINA.MARGEN, ctx.y - 10, { size: 9, color: COLOR.etiqueta });
    ctx.y -= 26;
    return;
  }
  const cx = PAGINA.MARGEN + RADIO_PASTEL + 8;
  const cy = ctx.y - RADIO_PASTEL - 4;
  const conMonto = reparto.categorias.map((c, i) => ({ ...c, color: COLORES[i % COLORES.length] })).filter(c => c.monto > 0);
  if (conMonto.length === 1) {
    ctx.page.drawCircle({ x: cx, y: cy, size: RADIO_PASTEL, color: conMonto[0].color });
  } else {
    let angulo = 0;
    for (const c of conMonto) {
      const barrido = (c.monto / reparto.total) * Math.PI * 2;
      rebanada(ctx, cx, cy, angulo, angulo + barrido, c.color);
      angulo += barrido;
    }
  }
  // Leyenda: cuadro de color, categoría, monto y porcentaje.
  const xLeyenda = PAGINA.MARGEN + RADIO_PASTEL * 2 + 40;
  const xMonto = X_DER - 70;
  let y = ctx.y - 6;
  texto(ctx, t('colCategoria'), xLeyenda + 18, y - 8, { size: 7, bold: true, color: COLOR.etiqueta });
  textoDerecha(ctx, t('colMonto'), xMonto, y - 8, { size: 7, bold: true, color: COLOR.etiqueta });
  textoDerecha(ctx, t('colPorcentaje'), X_DER, y - 8, { size: 7, bold: true, color: COLOR.etiqueta });
  y -= 18;
  reparto.categorias.forEach((c, i) => {
    ctx.page.drawRectangle({ x: xLeyenda, y: y - 9, width: 9, height: 9, color: COLORES[i % COLORES.length], borderColor: COLOR.marco, borderWidth: 0.5 });
    texto(ctx, c.nombre, xLeyenda + 18, y - 8, { size: 9 });
    textoDerecha(ctx, formatearDinero(moneda.simbolo, c.monto), xMonto, y - 8, { size: 9 });
    textoDerecha(ctx, porcentaje(c.porcentaje), X_DER, y - 8, { size: 9 });
    y -= 17;
  });
  textoDerecha(ctx, formatearDinero(moneda.simbolo, reparto.total), xMonto, y - 8, { size: 9, bold: true });
  texto(ctx, t('totalFila'), xLeyenda + 18, y - 8, { size: 9, bold: true });
  ctx.y -= alto + 8;
}

function celdas(ctx, valores, y, { bold = false, color = COLOR.texto } = {}) {
  let x = PAGINA.MARGEN;
  COLUMNAS.forEach(([clave, anchoCol, alinear], i) => {
    const valor = valores[i];
    if (alinear === 'der') {
      textoDerecha(ctx, valor, x + anchoCol - 4, y, { size: 8.5, bold, color });
    } else {
      const [recortado] = partirEnLineas(valor, m => ancho(ctx, m, 8.5, bold), anchoCol - 6, 1);
      texto(ctx, recortado, x + 2, y, { size: 8.5, bold, color });
    }
    x += anchoCol;
  });
}

function encabezadoTabla(ctx) {
  celdas(ctx, [t('colNumero'), t('colSolicitante'), t('colSolicitudes'), t('colTotal'), t('colPorcentaje'), t('colPromedio')], ctx.y - 9, { bold: true, color: COLOR.etiqueta });
  ctx.y -= ALTO_FILA;
  linea(ctx, ctx.y + 2, { grosor: 0.75, color: COLOR.divisorFuerte });
}

function dibujarTabla(ctx) {
  const { solicitantes, resumen, moneda } = ctx.datos;
  if (solicitantes.length === 0) return;
  titulo(ctx, t('tituloTabla'));
  encabezadoTabla(ctx);
  solicitantes.forEach((s, i) => {
    if (asegurar(ctx, ALTO_FILA * 2)) encabezadoTabla(ctx);
    celdas(ctx, [String(i + 1), s.nombre, String(s.solicitudes), formatearDinero(moneda.simbolo, s.total), porcentaje(s.porcentaje), formatearDinero(moneda.simbolo, s.promedio)], ctx.y - 9);
    ctx.y -= ALTO_FILA;
    linea(ctx, ctx.y + 2);
  });
  if (asegurar(ctx, ALTO_FILA * 2)) encabezadoTabla(ctx);
  linea(ctx, ctx.y + 2, { grosor: 1, color: COLOR.divisorFuerte });
  celdas(ctx, ['', t('totalFila'), String(resumen.solicitudes), formatearDinero(moneda.simbolo, resumen.total), porcentaje(100), formatearDinero(moneda.simbolo, resumen.promedio)], ctx.y - 9, { bold: true });
  ctx.y -= ALTO_FILA;
}

// «n/total» al pie de cada página, una vez que se conoce el total.
function numerarPaginas(ctx) {
  const paginas = ctx.pdfDoc.getPages();
  paginas.forEach((pagina, i) => {
    ctx.page = pagina;
    textoDerecha(ctx, t('pagina', { n: i + 1, total: paginas.length }), X_DER, PAGINA.LIMITE_INFERIOR - 22, { size: 8, color: COLOR.etiqueta });
  });
}

/**
 * @param {{ desde: string, hasta: string, generado: string, moneda: object|null, pais: object|null, resumen: object,
 *   solicitantes: object[], reparto: { alcance: object, total: number, categorias: object[] } }} datos El JSON del reporte más `generado` (AAAA-MM-DD).
 * @returns {Promise<Buffer>}
 */
async function generarPdfReporte(datos) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let logo = null;
  try {
    logo = await pdfDoc.embedPng(await fs.readFile(RUTA_LOGO));
  } catch {
    logo = null; // El logo es decorativo: sin él el PDF se genera igual.
  }
  const ctx = { pdfDoc, font, fontBold, caracteres: new Set(font.getCharacterSet()), logo, datos, page: null, y: 0 };
  nuevaPagina(ctx);
  dibujarResumen(ctx);
  if (datos.solicitantes.length > 0) dibujarRanking(ctx);
  dibujarReparto(ctx);
  dibujarTabla(ctx);
  numerarPaginas(ctx);
  return Buffer.from(await pdfDoc.save());
}

module.exports = { generarPdfReporte };
