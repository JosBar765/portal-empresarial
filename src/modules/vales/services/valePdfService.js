// src/modules/vales/services/valePdfService.js
// Genera el PDF de un vale de arte y fusiona al final los documentos PDF adjuntos
// (y, cuando el Encargado General fusiona un vale multi-taller, también las
// propuestas de cada taller). El binario nunca se persiste en BD: solo se sube
// vía fileStorage y se guarda su URL. Se regenera por completo en cada cambio
// relevante (no se anexa sobre el PDF existente) para poder mantener el orden:
// contenido -> bloque de modificación (si aplica) -> adjuntos -> propuestas fusionadas.
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const catalogoRepository = require('../repositories/catalogoRepository');

const PAGE_WIDTH = 612; // Carta
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 30;
const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');
const LOGO_PATH = path.join(__dirname, '../../../../public/assets/logos/LOGO_GP_isotipo.png');

// Paleta del layout tipo "recibo" (etiqueta gris pequeña sobre valor en negro,
// líneas divisorias finas en vez de cajas con borde) — ver comentario sobre
// _dibujarSeccionCampos más abajo para el origen del patrón.
const COLOR_TEXTO = rgb(0, 0, 0);
const COLOR_ETIQUETA = rgb(0.45, 0.48, 0.52);
const COLOR_DIVISOR = rgb(0.85, 0.85, 0.85);
const COLOR_DIVISOR_FUERTE = rgb(0.15, 0.15, 0.15);

// Fechas siempre dd/mm/aaaa; solo la fecha de ingreso muestra también hora (dd/mm/aaaa hh:mm).
function formatFechaSolo(valor) {
  if (!valor) return '-';
  const [f] = String(valor).split(/[ T]/);
  const [y, m, d] = f.split('-');
  if (!y || !m || !d) return String(valor);
  return `${d}/${m}/${y}`;
}

function formatFechaHora(valor) {
  if (!valor) return '-';
  const [f, h] = String(valor).replace('T', ' ').split(' ');
  const [y, m, d] = f.split('-');
  if (!y || !m || !d) return String(valor);
  const hm = (h || '').slice(0, 5);
  return `${d}/${m}/${y}${hm ? ' ' + hm : ''}`;
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const tentative = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(tentative, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = tentative;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

class ValePdfService {
  // `propuestasParaFusionar`: rutas de propuestas PDF a fusionar al final (solo
  // usado por el Encargado General al fusionar un vale multi-taller, ver
  // valeService.aprobarGeneral()).
  async generarPdfVale(vale, documentos = [], propuestasParaFusionar = []) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let logoImage = null;
    try {
      const logoBytes = await fs.readFile(LOGO_PATH);
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch {
      logoImage = null; // El logo es decorativo; su ausencia no debe romper la generación del PDF
    }

    const [productos, materiales] = await Promise.all([
      catalogoRepository.listarProductos(),
      catalogoRepository.listarMateriales()
    ]);
    const nombreCatalogo = (lista, id) => (lista.find(x => x.id === id) || {}).nombre || (lista.find(x => x.id === id) || {}).codigo || '-';

    const ctx = { pdfDoc, font, fontBold, logoImage, page: null, y: 0 };
    this._nuevaPagina(ctx);

    this._dibujarEncabezado(ctx, vale);
    this._dibujarSeccionAsesor(ctx, vale);
    this._dibujarSeccionCliente(ctx, vale);
    this._dibujarSeccionVenta(ctx, vale, {
      producto: nombreCatalogo(productos, vale.producto_id),
      material: nombreCatalogo(materiales, vale.material_id),
      // Corrección #1: técnica y acabado ya no son catálogo, son texto libre en el vale.
      tecnica: vale.tecnica || '-',
      acabado: vale.acabado || '-'
    });

    const imagenes = documentos.filter(d => d.tipo === 'imagen');
    const docsAdjuntos = documentos.filter(d => d.tipo === 'documento');

    if (vale.modificado && vale.descripcion_original) {
      // Orden: contenido original primero, bloque de modificación después (envuelto en
      // marcadores al inicio y al final), documentos adjuntos al final de todo.
      this._dibujarTituloBloque(ctx, 'BOCETO Y DESCRIPCIÓN');
      this._dibujarTextoLargo(ctx, vale.descripcion_original);
      await this._dibujarGridImagenes(ctx, imagenes.filter(i => !i.es_modificacion));

      this._escribirLinea(ctx, '********** MODIFICACION **********', ctx.fontBold, 10);
      this._dibujarTituloBloque(ctx, 'BOCETO Y DESCRIPCIÓN (MODIFICACIÓN)');
      this._dibujarTextoLargo(ctx, vale.descripcion);
      await this._dibujarGridImagenes(ctx, imagenes.filter(i => i.es_modificacion));
      this._escribirLinea(ctx, '********** MODIFICACION **********', ctx.fontBold, 10);
    } else {
      this._dibujarTituloBloque(ctx, 'BOCETO Y DESCRIPCIÓN');
      this._dibujarTextoLargo(ctx, vale.descripcion);
      await this._dibujarGridImagenes(ctx, imagenes);
    }

    // Fusionar documentos PDF adjuntos al final (nunca se re-almacenan, solo se copian sus páginas)
    for (const doc of docsAdjuntos) {
      if (doc.mime_type !== 'application/pdf') continue;
      await this._fusionarPdfExterno(pdfDoc, path.join(UPLOADS_DIR, path.basename(doc.ruta)), doc.nombre_original);
    }

    // Fusionar las propuestas de cada taller (solo cuando el Encargado General
    // fusiona un vale multi-taller — ver valeService.aprobarGeneral()).
    for (const rutaPropuesta of propuestasParaFusionar) {
      await this._fusionarPdfExterno(pdfDoc, path.join(UPLOADS_DIR, path.basename(rutaPropuesta)), 'propuesta de taller');
    }

    // El checkbox de "ADJUNTOS" ya no se calcula: lo marca a mano el técnico al
    // imprimir el vale (corrección #8) — siempre se dibuja vacío.
    this._dibujarPiesDePagina(pdfDoc, font, fontBold, { modificado: !!vale.modificado });

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  async _fusionarPdfExterno(pdfDoc, rutaAbsoluta, nombreParaLog) {
    try {
      const bytes = await fs.readFile(rutaAbsoluta);
      const externo = await PDFDocument.load(bytes);
      const paginas = await pdfDoc.copyPages(externo, externo.getPageIndices());
      paginas.forEach(p => pdfDoc.addPage(p));
    } catch (error) {
      console.warn(`[ValePdfService] No se pudo fusionar "${nombreParaLog}":`, error.message);
    }
  }

  _nuevaPagina(ctx) {
    ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN;
  }

  _asegurarEspacio(ctx, alto) {
    if (ctx.y - alto < MARGIN + 20) {
      this._nuevaPagina(ctx);
    }
  }

  // Solo se usa para los marcos de imágenes — las cajas de las secciones de
  // información ya no llevan borde (corrección #6).
  _rect(ctx, x, y, width, height) {
    ctx.page.drawRectangle({ x, y, width, height, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 1 });
  }

  _texto(ctx, texto, x, y, opts = {}) {
    ctx.page.drawText(String(texto ?? ''), {
      x, y, size: opts.size || 9, font: opts.bold ? ctx.fontBold : ctx.font, color: opts.color || COLOR_TEXTO
    });
  }

  // Título de bloque reutilizado por "Boceto y descripción" y su variante de
  // modificación — mismo tratamiento tipográfico que el título de cada
  // _dibujarSeccionCampos, para que todo el documento comparta una sola
  // jerarquía de títulos.
  _dibujarTituloBloque(ctx, texto) {
    this._asegurarEspacio(ctx, 26);
    this._texto(ctx, texto, MARGIN, ctx.y - 10, { size: 10.5, bold: true });
    ctx.y -= 22;
  }

  _escribirLinea(ctx, texto, font, size) {
    this._asegurarEspacio(ctx, size + 8);
    ctx.page.drawText(texto, { x: MARGIN, y: ctx.y, size, font, color: rgb(0, 0, 0) });
    ctx.y -= size + 8;
  }

  _dibujarTextoLargo(ctx, descripcion) {
    const lineas = wrapText(descripcion || 'Sin descripción.', ctx.font, 9, CONTENT_WIDTH);
    lineas.forEach(linea => {
      this._asegurarEspacio(ctx, 14);
      this._texto(ctx, linea, MARGIN, ctx.y, { size: 9 });
      ctx.y -= 14;
    });
    ctx.y -= 6;
  }

  async _dibujarGridImagenes(ctx, imagenes) {
    // Imágenes, máximo 3 por fila horizontal
    const columnas = 3;
    const gap = 10;
    const anchoImg = (CONTENT_WIDTH - gap * (columnas - 1)) / columnas;
    const altoImg = anchoImg;

    for (let i = 0; i < imagenes.length; i += columnas) {
      this._asegurarEspacio(ctx, altoImg + 10);
      const fila = imagenes.slice(i, i + columnas);
      for (let j = 0; j < fila.length; j++) {
        const doc = fila[j];
        const x = MARGIN + j * (anchoImg + gap);
        try {
          const bytes = await fs.readFile(path.join(UPLOADS_DIR, path.basename(doc.ruta)));
          let embedded;
          if (doc.mime_type === 'image/png') {
            embedded = await ctx.pdfDoc.embedPng(bytes);
          } else if (doc.mime_type === 'image/jpeg' || doc.mime_type === 'image/jpg') {
            embedded = await ctx.pdfDoc.embedJpg(bytes);
          } else {
            throw new Error('Formato no soportado para incrustar directamente en el PDF (ej. webp).');
          }
          const dims = embedded.scaleToFit(anchoImg, altoImg);
          ctx.page.drawImage(embedded, {
            x: x + (anchoImg - dims.width) / 2,
            y: ctx.y - altoImg + (altoImg - dims.height) / 2,
            width: dims.width,
            height: dims.height
          });
          this._rect(ctx, x, ctx.y - altoImg, anchoImg, altoImg);
        } catch (error) {
          this._rect(ctx, x, ctx.y - altoImg, anchoImg, altoImg);
          this._texto(ctx, doc.nombre_original, x + 4, ctx.y - altoImg / 2, { size: 7 });
        }
      }
      ctx.y -= altoImg + gap;
    }
    ctx.y -= 10;
  }

  // Encabezado tipo "recibo": título + subtítulo a la izquierda, correlativo
  // destacado al centro, logo a la derecha, y una sola línea divisoria abajo
  // — sin cajas con borde (diseño tomado de un recibo/solicitud de referencia
  // con esa misma jerarquía: título grande, subtítulo gris, campos etiqueta-
  // sobre-valor y líneas finas en vez de tablas con bordes).
  _dibujarEncabezado(ctx, vale) {
    const alto = 46;
    this._asegurarEspacio(ctx, alto + 20);
    const yTop = ctx.y;
    const hoy = new Date();
    const fechaHoy = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;

    this._texto(ctx, 'VALE DE ARTE', MARGIN, yTop - 16, { size: 18, bold: true });
    this._texto(ctx, `MundiTrofeos S.A. · Generado ${fechaHoy}`, MARGIN, yTop - 30, { size: 8, color: COLOR_ETIQUETA });

    const xCorrelativo = MARGIN + CONTENT_WIDTH * 0.44;
    this._texto(ctx, 'CORRELATIVO', xCorrelativo, yTop - 11, { size: 7, bold: true, color: COLOR_ETIQUETA });
    this._texto(ctx, vale.correlativo, xCorrelativo, yTop - 27, { size: 13, bold: true });

    if (ctx.logoImage) {
      const anchoLogo = CONTENT_WIDTH * 0.14;
      const dims = ctx.logoImage.scaleToFit(anchoLogo, alto - 8);
      ctx.page.drawImage(ctx.logoImage, {
        x: MARGIN + CONTENT_WIDTH - dims.width,
        y: yTop - alto + (alto - dims.height) / 2,
        width: dims.width,
        height: dims.height
      });
    }

    const yLinea = yTop - alto;
    ctx.page.drawLine({
      start: { x: MARGIN, y: yLinea }, end: { x: MARGIN + CONTENT_WIDTH, y: yLinea },
      thickness: 1, color: COLOR_DIVISOR_FUERTE
    });
    ctx.y = yLinea - 18;
  }

  // Grilla de campos "etiqueta pequeña en gris, encima del valor en negro"
  // con una línea divisoria fina después de cada fila — el mismo lenguaje
  // visual en todo el documento (título en negro + campos apilados + líneas
  // finas, sin cajas con borde), tomado de un recibo/solicitud de referencia
  // con ese mismo patrón de legibilidad.
  _dibujarSeccionCampos(ctx, titulo, filas) {
    const altoTitulo = 24;
    const altoFila = 30;
    const alto = altoTitulo + filas.length * altoFila;
    this._asegurarEspacio(ctx, alto + 14);

    this._texto(ctx, titulo, MARGIN, ctx.y - 10, { size: 10.5, bold: true });
    ctx.y -= altoTitulo;

    filas.forEach(fila => {
      let x = MARGIN;
      fila.forEach(campo => {
        const w = CONTENT_WIDTH * campo.proporcion;
        if (campo.etiqueta) {
          this._texto(ctx, campo.etiqueta, x, ctx.y - 7, { size: 6.5, bold: true, color: COLOR_ETIQUETA });
          this._texto(ctx, campo.valor ?? '-', x, ctx.y - 20, { size: 9 });
        }
        x += w;
      });
      ctx.y -= altoFila;
      ctx.page.drawLine({
        start: { x: MARGIN, y: ctx.y }, end: { x: MARGIN + CONTENT_WIDTH, y: ctx.y },
        thickness: 0.75, color: COLOR_DIVISOR
      });
    });

    ctx.y -= 14;
  }

  // Recuadro destacado para el monto de la cotización — mismo tratamiento que
  // el total de un recibo (etiqueta a la izquierda, cifra grande a la
  // derecha, dentro de un marco simple) en vez de un campo más de la grilla.
  _dibujarCajaDestacada(ctx, etiqueta, valor) {
    const alto = 17; // reducido ~50% (antes 34) para liberar espacio vertical hacia BOCETO Y DESCRIPCIÓN
    this._asegurarEspacio(ctx, alto + 18);
    const y = ctx.y - alto;

    ctx.page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: alto, borderColor: COLOR_DIVISOR_FUERTE, borderWidth: 1 });
    this._texto(ctx, etiqueta, MARGIN + 14, y + alto / 2 - 3, { size: 8, bold: true });
    const anchoValor = ctx.fontBold.widthOfTextAtSize(valor, 11);
    this._texto(ctx, valor, MARGIN + CONTENT_WIDTH - 14 - anchoValor, y + alto / 2 - 4, { size: 11, bold: true });

    ctx.y = y - 18; // margen hacia la firma sin cambios
  }

  // Línea de firma independiente (ya no es un campo más dentro de la grilla)
  // — mismo patrón del recibo de referencia: una línea fina con la etiqueta
  // centrada justo debajo.
  _dibujarLineaFirma(ctx, etiqueta) {
    const anchoLinea = 220;
    this._asegurarEspacio(ctx, 40);
    const yLinea = ctx.y - 20;
    ctx.page.drawLine({
      start: { x: MARGIN, y: yLinea }, end: { x: MARGIN + anchoLinea, y: yLinea },
      thickness: 0.75, color: rgb(0.3, 0.3, 0.3)
    });
    this._texto(ctx, etiqueta, MARGIN, yLinea - 12, { size: 8, color: COLOR_ETIQUETA });
    ctx.y = yLinea - 28;
  }

  _dibujarSeccionAsesor(ctx, vale) {
    this._dibujarSeccionCampos(ctx, 'INFORMACIÓN DE ASESOR DE VENTAS', [
      [
        { etiqueta: 'NOMBRE', valor: vale.__asesorNombre || `Asesor #${vale.asesor_id}`, proporcion: 0.4 },
        { etiqueta: 'CORREO', valor: vale.__asesorCorreo || '-', proporcion: 0.35 },
        { etiqueta: 'TELÉFONO', valor: vale.__asesorTelefono || '-', proporcion: 0.25 }
      ]
    ]);
  }

  _dibujarSeccionCliente(ctx, vale) {
    this._dibujarSeccionCampos(ctx, 'INFORMACIÓN DE CLIENTE', [
      [
        { etiqueta: 'EMPRESA', valor: vale.cliente_empresa || '-', proporcion: 0.5 },
        { etiqueta: 'CLIENTE', valor: vale.cliente_nombre, proporcion: 0.5 }
      ],
      [
        { etiqueta: 'TELÉFONO', valor: vale.cliente_telefono, proporcion: 0.5 },
        { etiqueta: 'CORREO', valor: vale.cliente_correo, proporcion: 0.5 }
      ]
    ]);
  }

  _dibujarSeccionVenta(ctx, vale, nombres) {
    this._dibujarSeccionCampos(ctx, 'INFORMACIÓN DE VENTA', [
      [
        { etiqueta: 'FECHA Y HORA INGRESO', valor: formatFechaHora(`${vale.fecha_creacion} ${vale.hora_creacion}`), proporcion: 3 / 8 },
        { etiqueta: 'FECHA ENTREGA', valor: formatFechaSolo(vale.fecha_entrega), proporcion: 2 / 8 },
        { etiqueta: 'FECHA EVENTO', valor: formatFechaSolo(vale.fecha_evento), proporcion: 2 / 8 },
        { etiqueta: 'URGENTE', valor: vale.urgente ? 'SÍ' : 'NO', proporcion: 1 / 8 }
      ],
      [
        { etiqueta: 'COD. PRODUCTO', valor: nombres.producto, proporcion: 1 / 5 },
        { etiqueta: 'MATERIAL', valor: nombres.material, proporcion: 1 / 5 },
        { etiqueta: 'TÉCNICA', valor: nombres.tecnica, proporcion: 1 / 5 },
        { etiqueta: 'ACABADO', valor: nombres.acabado, proporcion: 1 / 5 },
        { etiqueta: 'CANTIDAD', valor: String(vale.cantidad), proporcion: 1 / 5 }
      ]
    ]);

    // La cotización y la firma dejan de ser un campo más de la grilla: la
    // cotización es el dato económico principal del vale (recuadro
    // destacado, como el total de un recibo) y la firma necesita espacio
    // real para firmarse a mano.
    this._dibujarCajaDestacada(ctx, 'COTIZACIÓN', `Q ${Number(vale.cotizacion).toFixed(2)}`);
    this._dibujarLineaFirma(ctx, 'FIRMA AUTORIZACIÓN');
  }

  /**
   * Dibuja el pie de página en TODAS las páginas del documento final (incluidas las de
   * documentos/propuestas fusionados): numeración actual/total, el checkbox de
   * "ADJUNTOS" (corrección #8: siempre vacío, lo marca a mano el técnico al imprimir),
   * y el indicador "MODIFICAR" abajo-izquierda si aplica.
   */
  _dibujarPiesDePagina(pdfDoc, font, fontBold, { modificado }) {
    const total = pdfDoc.getPageCount();
    pdfDoc.getPages().forEach((page, idx) => {
      page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: FOOTER_HEIGHT, color: rgb(1, 1, 1) });

      if (modificado) {
        page.drawText('MODIFICAR', { x: MARGIN, y: 10, size: 8, font: fontBold, color: rgb(0.72, 0.1, 0.1) });
      }

      const pageNumText = `${idx + 1}/${total}`;
      const pageNumWidth = font.widthOfTextAtSize(pageNumText, 8);
      const boxSize = 8;
      const boxX = PAGE_WIDTH - MARGIN - pageNumWidth - 16;
      const boxY = 9;
      const etiqueta = 'ADJUNTOS';
      const etiquetaWidth = font.widthOfTextAtSize(etiqueta, 7);
      page.drawText(etiqueta, { x: boxX - etiquetaWidth - 6, y: boxY + 1, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
      page.drawRectangle({ x: boxX, y: boxY, width: boxSize, height: boxSize, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 1 });

      page.drawText(pageNumText, { x: PAGE_WIDTH - MARGIN - pageNumWidth, y: 10, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    });
  }
}

module.exports = new ValePdfService();
