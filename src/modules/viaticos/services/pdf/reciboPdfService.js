// src/modules/viaticos/services/pdf/reciboPdfService.js
// PDF del recibo firmado de la liquidación: hoja carta en blanco y negro con el recibo arriba, como el formato en papel.
// Es una función pura de los datos del recibo y la firma (PNG): no lee la base ni Storage.
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { RECIBOS } = require('../../constantes');
const { aCentavos, formatear } = require('../../dinero');
const { msg } = require('../../mensajes');
const { errorDeValidacion } = require('../../errores');
const { PAGINA, ANCHO_CONTENIDO, COLOR, partirEnLineas, ancho, texto, textoDerecha } = require('./pdfHelpers');

const RUTA_LOGO = path.join(__dirname, '../../../../../public/assets/logos/LOGO_GP_isotipo.png');
const t = (clave, params) => msg(`reciboPdf.${clave}`, params);

const RELLENO = 16;
const ALTO_LOGO = 54;
const ANCHO_CAJA_DIA = 40;
const ANCHO_CAJA_ANIO = 56;
const ALTO_CAJA = 22;
const SEPARACION_CAJAS = 6;
const ALTO_RENGLON = 22;
const TAMANO_VALOR = 10;
const LADO_CASILLA = 11;
const ANCHO_FIRMA = 230;
const ALTO_FIRMA = 64;

// Etiqueta en negrita y, a su derecha, el valor sobre una línea que llega al borde; los renglones extra empiezan en el margen.
function dibujarRenglones(ctx, etiqueta, valor, { maxLineas = 1 } = {}) {
  const xIzq = ctx.xIzq;
  const xDer = ctx.xDer;
  const anchoEtiqueta = ancho(ctx, etiqueta, 9, true) + 6;
  const medir = s => ancho(ctx, s, TAMANO_VALOR);
  // Primero se parte con el ancho del primer renglón; lo que sobra se reparte en renglones completos (un valor vacío deja la línea en blanco).
  const [primera, ...resto] = String(valor ?? '').trim() ? partirEnLineas(valor, medir, xDer - xIzq - anchoEtiqueta, maxLineas === 1 ? 1 : Infinity) : [''];
  const siguientes = resto.length && maxLineas > 1 ? partirEnLineas(resto.join(' '), medir, xDer - xIzq, maxLineas - 1) : [];
  [primera, ...siguientes].forEach((lineaTexto, i) => {
    ctx.y -= ALTO_RENGLON;
    const xValor = i === 0 ? xIzq + anchoEtiqueta : xIzq;
    if (i === 0) texto(ctx, etiqueta, xIzq, ctx.y, { size: 9, bold: true });
    texto(ctx, lineaTexto, xValor + 2, ctx.y + 2, { size: TAMANO_VALOR });
    ctx.page.drawLine({ start: { x: xValor, y: ctx.y - 3 }, end: { x: xDer, y: ctx.y - 3 }, thickness: 0.6, color: COLOR.guia });
  });
}

// Cajas DÍA/MES/AÑO y, debajo, la caja del monto con el símbolo de la moneda; alineadas al borde derecho.
function dibujarFechaYMonto(ctx, yTop, datos) {
  const [anio, mes, dia] = datos.fecha.split('-');
  const anchoTotal = ANCHO_CAJA_DIA * 2 + ANCHO_CAJA_ANIO + SEPARACION_CAJAS * 2;
  let x = ctx.xDer - anchoTotal;
  [[t('dia'), dia, ANCHO_CAJA_DIA], [t('mes'), mes, ANCHO_CAJA_DIA], [t('anio'), anio, ANCHO_CAJA_ANIO]].forEach(([etiqueta, valor, anchoCaja]) => {
    texto(ctx, etiqueta, x + (anchoCaja - ancho(ctx, etiqueta, 6.5, true)) / 2, yTop - 7, { size: 6.5, bold: true, color: COLOR.etiqueta });
    const yCaja = yTop - 11 - ALTO_CAJA;
    ctx.page.drawRectangle({ x, y: yCaja, width: anchoCaja, height: ALTO_CAJA, borderColor: COLOR.texto, borderWidth: 1 });
    texto(ctx, valor, x + (anchoCaja - ancho(ctx, valor, 11, true)) / 2, yCaja + 7, { size: 11, bold: true });
    x += anchoCaja + SEPARACION_CAJAS;
  });
  const yMonto = yTop - 11 - ALTO_CAJA - 8 - 26;
  const xMonto = ctx.xDer - anchoTotal;
  ctx.page.drawRectangle({ x: xMonto, y: yMonto, width: anchoTotal, height: 26, borderColor: COLOR.texto, borderWidth: 1.2 });
  texto(ctx, datos.simbolo, xMonto + 8, yMonto + 9, { size: 11, bold: true });
  textoDerecha(ctx, formatear(aCentavos(datos.monto)), ctx.xDer - 8, yMonto + 9, { size: 12, bold: true });
  return yMonto;
}

// Una casilla por forma de pago con una «X» en la elegida.
function dibujarFormasDePago(ctx, formaPago) {
  ctx.y -= ALTO_RENGLON + 4;
  let x = ctx.xIzq;
  Object.values(RECIBOS.FORMAS_PAGO).forEach(forma => {
    ctx.page.drawRectangle({ x, y: ctx.y - 2, width: LADO_CASILLA, height: LADO_CASILLA, borderColor: COLOR.texto, borderWidth: 1 });
    if (forma === formaPago) texto(ctx, t('marca'), x + 2.2, ctx.y + 0.6, { size: 10, bold: true });
    const etiqueta = t(forma);
    texto(ctx, etiqueta, x + LADO_CASILLA + 5, ctx.y, { size: 9, bold: true });
    x += LADO_CASILLA + 5 + ancho(ctx, etiqueta, 9, true) + 28;
  });
}

// Firma (PNG) sobre la línea de «RECIBÍ CONFORME», con el nombre del solicitante impreso debajo.
async function dibujarFirma(ctx, firma, nombre) {
  let imagen;
  try {
    imagen = await ctx.pdfDoc.embedPng(firma);
  } catch {
    throw errorDeValidacion(msg('validacion.revisar'), { [RECIBOS.CAMPO_FIRMA]: msg('recibo.firmaIlegible') });
  }
  const xLinea = ctx.xDer - ANCHO_FIRMA;
  const yLinea = ctx.y - ALTO_FIRMA - 10;
  const dims = imagen.scaleToFit(ANCHO_FIRMA, ALTO_FIRMA);
  ctx.page.drawImage(imagen, { x: xLinea + (ANCHO_FIRMA - dims.width) / 2, y: yLinea + 2, width: dims.width, height: dims.height });
  ctx.page.drawLine({ start: { x: xLinea, y: yLinea }, end: { x: ctx.xDer, y: yLinea }, thickness: 1, color: COLOR.texto });
  const etiqueta = t('recibiConforme');
  texto(ctx, etiqueta, xLinea + (ANCHO_FIRMA - ancho(ctx, etiqueta, 7, true)) / 2, yLinea - 10, { size: 7, bold: true, color: COLOR.etiqueta });
  const [nombreLinea] = partirEnLineas(nombre, s => ancho(ctx, s, 9), ANCHO_FIRMA, 1);
  texto(ctx, nombreLinea, xLinea + (ANCHO_FIRMA - ancho(ctx, nombreLinea, 9)) / 2, yLinea - 22, { size: 9 });
  ctx.y = yLinea - 22;
}

/**
 * @param {{ numero: string, fecha: string, monto: number, simbolo: string, montoLetras: string, recibiDe: string, concepto: string,
 *   formaPago: string, numeroCheque?: string|null, numeroCuenta?: string|null, solicitanteNombre: string, firma: Buffer }} datos
 *   `montoLetras` ya incluye el plural de la moneda; aquí se escribe en mayúsculas.
 * @returns {Promise<Buffer>}
 */
async function generarPdfRecibo(datos) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let logo = null;
  try {
    logo = await pdfDoc.embedPng(await fs.readFile(RUTA_LOGO));
  } catch {
    logo = null; // El logo es decorativo: sin él el PDF se genera igual.
  }
  const page = pdfDoc.addPage([PAGINA.ANCHO, PAGINA.ALTO]);
  const yMarco = PAGINA.ALTO - PAGINA.MARGEN;
  const ctx = {
    pdfDoc, font, fontBold, page, caracteres: new Set(font.getCharacterSet()),
    xIzq: PAGINA.MARGEN + RELLENO, xDer: PAGINA.MARGEN + ANCHO_CONTENIDO - RELLENO, y: yMarco - RELLENO
  };

  // Encabezado: logo del trofeo, «RECIBO» y su número a la izquierda; fecha y monto a la derecha.
  const yTop = ctx.y;
  let xTitulo = ctx.xIzq;
  if (logo) {
    const dims = logo.scaleToFit(ALTO_LOGO, ALTO_LOGO);
    page.drawImage(logo, { x: ctx.xIzq, y: yTop - dims.height, width: dims.width, height: dims.height });
    xTitulo += dims.width + 14;
  }
  texto(ctx, t('titulo'), xTitulo, yTop - 24, { size: 24, bold: true });
  texto(ctx, t('numero', { numero: datos.numero }), xTitulo, yTop - 44, { size: 11, bold: true });
  const yMonto = dibujarFechaYMonto(ctx, yTop, datos);
  ctx.y = Math.min(yMonto, yTop - ALTO_LOGO) - 8;

  dibujarRenglones(ctx, t('recibiDe'), datos.recibiDe, { maxLineas: 2 });
  dibujarRenglones(ctx, t('cantidad'), datos.montoLetras.toUpperCase(), { maxLineas: 2 });
  dibujarRenglones(ctx, t('concepto'), datos.concepto, { maxLineas: 3 });

  dibujarFormasDePago(ctx, datos.formaPago);
  const conCheque = datos.formaPago === RECIBOS.FORMAS_PAGO.CHEQUE;
  const conCuenta = datos.formaPago === RECIBOS.FORMAS_PAGO.TRANSFERENCIA;
  dibujarRenglones(ctx, t('numeroCheque'), conCheque ? datos.numeroCheque : '');
  dibujarRenglones(ctx, t('numeroCuenta'), conCuenta ? datos.numeroCuenta || '' : '');

  await dibujarFirma(ctx, datos.firma, datos.solicitanteNombre);

  const yBase = ctx.y - RELLENO;
  page.drawRectangle({ x: PAGINA.MARGEN, y: yBase, width: ANCHO_CONTENIDO, height: yMarco - yBase, borderColor: COLOR.texto, borderWidth: 1.5 });
  return Buffer.from(await pdfDoc.save());
}

module.exports = { generarPdfRecibo };
