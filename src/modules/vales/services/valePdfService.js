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
      this._asegurarEspacio(ctx, 20);
      this._texto(ctx, 'BOCETO Y DESCRIPCIÓN', MARGIN, ctx.y, { size: 9, bold: true });
      ctx.y -= 16;
      this._dibujarTextoLargo(ctx, vale.descripcion_original);
      await this._dibujarGridImagenes(ctx, imagenes.filter(i => !i.es_modificacion));

      this._escribirLinea(ctx, '********** MODIFICACION **********', ctx.fontBold, 10);
      this._asegurarEspacio(ctx, 20);
      this._texto(ctx, 'BOCETO Y DESCRIPCIÓN (MODIFICACIÓN)', MARGIN, ctx.y, { size: 9, bold: true });
      ctx.y -= 16;
      this._dibujarTextoLargo(ctx, vale.descripcion);
      await this._dibujarGridImagenes(ctx, imagenes.filter(i => i.es_modificacion));
      this._escribirLinea(ctx, '********** MODIFICACION **********', ctx.fontBold, 10);
    } else {
      this._asegurarEspacio(ctx, 20);
      this._texto(ctx, 'BOCETO Y DESCRIPCIÓN', MARGIN, ctx.y, { size: 9, bold: true });
      ctx.y -= 16;
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
      x, y, size: opts.size || 9, font: opts.bold ? ctx.fontBold : ctx.font, color: rgb(0, 0, 0)
    });
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

  _dibujarEncabezado(ctx, vale) {
    const alto = 40;
    this._asegurarEspacio(ctx, alto + 10);
    const y = ctx.y - alto;
    const col1 = CONTENT_WIDTH * (3 / 6);
    const col2 = CONTENT_WIDTH * (2 / 6);
    const col3 = CONTENT_WIDTH * (1 / 6);

    this._rect(ctx, MARGIN, y, col1, alto);
    this._rect(ctx, MARGIN + col1, y, col2, alto);
    this._rect(ctx, MARGIN + col1 + col2, y, col3, alto);

    this._texto(ctx, 'VALE DE ARTE', MARGIN + 10, y + alto / 2 - 5, { size: 14, bold: true });
    this._texto(ctx, `CORRELATIVO:`, MARGIN + col1 + 10, y + alto / 2 + 6, { size: 8, bold: true });
    this._texto(ctx, vale.correlativo, MARGIN + col1 + 10, y + alto / 2 - 6, { size: 10, bold: true });

    if (ctx.logoImage) {
      const dims = ctx.logoImage.scaleToFit(col3 - 10, alto - 10);
      ctx.page.drawImage(ctx.logoImage, {
        x: MARGIN + col1 + col2 + (col3 - dims.width) / 2,
        y: y + (alto - dims.height) / 2,
        width: dims.width,
        height: dims.height
      });
    }

    // Corrección #8: el espaciado EXTERIOR (entre secciones) se reduce un 50% respecto
    // al original (16 → 8); el espaciado INTERIOR de cada sección (altoTitulo/altoFila,
    // en _dibujarCajaSeccion) se revierte a su valor original para mantener la
    // legibilidad — la compactación de corrección #6 fue demasiado agresiva.
    ctx.y = y - 8;
  }

  // Corrección #6: sin bordes en las cajas de sección, campo en una sola línea
  // "ETIQUETA: valor" (en vez de dos líneas apiladas). Corrección #8: altoTitulo/altoFila
  // (espaciado INTERIOR, necesario para la legibilidad) vuelven a su valor original;
  // solo el espaciado EXTERIOR (antes/después de la caja) se redujo un 50%.
  _dibujarCajaSeccion(ctx, titulo, filas) {
    const altoTitulo = 18;
    const altoFila = 26;
    const alto = altoTitulo + filas.length * altoFila;
    this._asegurarEspacio(ctx, alto + 6);

    const yTop = ctx.y;
    this._texto(ctx, titulo, MARGIN, yTop - altoTitulo + 3, { size: 8, bold: true });

    filas.forEach((fila, idx) => {
      const yFila = yTop - altoTitulo - (idx + 1) * altoFila;
      let x = MARGIN;
      const anchoTotal = CONTENT_WIDTH;
      fila.forEach(campo => {
        const w = anchoTotal * campo.proporcion;
        if (campo.etiqueta === '__FIRMA__') {
          // Corrección #8: la línea se baja respecto al diseño original (que dejaba solo
          // 4px libres arriba) para dar espacio real donde firmar a mano; la etiqueta
          // sube al mismo nivel base que los demás campos (yFila+3) para no quedar
          // pegada al límite inferior de la sección (evita que se encime con el título
          // de la sección siguiente).
          const lineaY = yFila + 14;
          ctx.page.drawLine({
            start: { x: x + 4, y: lineaY }, end: { x: x + w - 4, y: lineaY },
            thickness: 0.5, color: rgb(0.4, 0.4, 0.4)
          });
          this._texto(ctx, 'FIRMA AUTORIZACIÓN', x + 4, yFila + 3, { size: 6 });
        } else if (campo.etiqueta) {
          // Centrado verticalmente dentro de la fila (ahora más alta tras revertir
          // altoFila a su valor original — corrección #8).
          const yTexto = yFila + altoFila / 2 - 3;
          const prefijo = `${campo.etiqueta}: `;
          this._texto(ctx, prefijo, x + 4, yTexto, { size: 7, bold: true });
          const anchoPrefijo = ctx.fontBold.widthOfTextAtSize(prefijo, 7);
          this._texto(ctx, campo.valor, x + 4 + anchoPrefijo, yTexto, { size: 8 });
        }
        x += w;
      });
    });

    ctx.y = yTop - alto - 6;
  }

  _dibujarSeccionAsesor(ctx, vale) {
    this._dibujarCajaSeccion(ctx, 'INFORMACIÓN DE ASESOR DE VENTAS', [
      [
        { etiqueta: 'NOMBRE', valor: vale.__asesorNombre || `Asesor #${vale.asesor_id}`, proporcion: 0.5 },
        { etiqueta: 'CORREO', valor: vale.__asesorCorreo || '-', proporcion: 0.5 }
      ],
      [
        { etiqueta: 'TELÉFONO', valor: vale.__asesorTelefono || '-', proporcion: 1 }
      ]
    ]);
  }

  _dibujarSeccionCliente(ctx, vale) {
    this._dibujarCajaSeccion(ctx, 'INFORMACIÓN DE CLIENTE', [
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
    this._dibujarCajaSeccion(ctx, 'INFORMACIÓN DE VENTA', [
      [
        { etiqueta: 'FECHA Y HORA INGRESO', valor: formatFechaHora(`${vale.fecha_creacion} ${vale.hora_creacion}`), proporcion: 3 / 8 },
        { etiqueta: 'FECHA ENTREGA', valor: formatFechaSolo(vale.fecha_entrega), proporcion: 2 / 8 },
        { etiqueta: 'FECHA EVENTO', valor: formatFechaSolo(vale.fecha_evento), proporcion: 2 / 8 },
        { etiqueta: 'URGENTE', valor: vale.urgente ? 'SÍ' : 'NO', proporcion: 1 / 8 }
      ],
      [
        { etiqueta: 'COD. PRODUCTO', valor: nombres.producto, proporcion: 2 / 8 },
        { etiqueta: 'MATERIAL', valor: nombres.material, proporcion: 2 / 8 },
        { etiqueta: 'TÉCNICA', valor: nombres.tecnica, proporcion: 2 / 8 },
        { etiqueta: 'ACABADO', valor: nombres.acabado, proporcion: 2 / 8 }
      ],
      [
        // Corrección #2: revertido el label a "Cotización (Q)".
        { etiqueta: 'CANTIDAD', valor: String(vale.cantidad), proporcion: 2 / 8 },
        { etiqueta: 'COTIZACIÓN (Q)', valor: `Q${Number(vale.cotizacion).toFixed(2)}`, proporcion: 2 / 8 },
        { etiqueta: '', valor: '', proporcion: 2 / 8 },
        // Corrección #5: línea en blanco para firma, no un campo de datos.
        { etiqueta: '__FIRMA__', valor: '', proporcion: 2 / 8 }
      ]
    ]);
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
