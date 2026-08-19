// src/modules/vales/services/valePdfService.js
// Genera el PDF de un vale de arte y fusiona al final los documentos PDF adjuntos.
// El binario nunca se persiste en BD: solo se sube vía fileStorage y se guarda su URL.
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const catalogoRepository = require('../repositories/catalogoRepository');

const PAGE_WIDTH = 612; // Carta
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');
const LOGO_PATH = path.join(__dirname, '../../../../public/assets/logos/LOGO_GP_isotipo.png');

function formatFecha(valor) {
  if (!valor) return '-';
  return String(valor).replace('T', ' ').slice(0, 16);
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
  async generarPdfVale(vale, documentos = []) {
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

    const catalogos = await Promise.all([
      catalogoRepository.listarProductos(),
      catalogoRepository.listarMateriales(),
      catalogoRepository.listarTecnicas(),
      catalogoRepository.listarAcabados()
    ]);
    const [productos, materiales, tecnicas, acabados] = catalogos;
    const nombreCatalogo = (lista, id) => (lista.find(x => x.id === id) || {}).nombre || (lista.find(x => x.id === id) || {}).codigo || '-';

    const ctx = { pdfDoc, font, fontBold, logoImage, page: null, y: 0 };
    this._nuevaPagina(ctx);

    this._dibujarEncabezado(ctx, vale);
    this._dibujarSeccionAsesor(ctx, vale);
    this._dibujarSeccionCliente(ctx, vale);
    this._dibujarSeccionVenta(ctx, vale, {
      producto: nombreCatalogo(productos, vale.producto_id),
      material: nombreCatalogo(materiales, vale.material_id),
      tecnica: nombreCatalogo(tecnicas, vale.tecnica_id),
      acabado: nombreCatalogo(acabados, vale.acabado_id)
    });

    const imagenes = documentos.filter(d => d.tipo === 'imagen');
    const docsAdjuntos = documentos.filter(d => d.tipo === 'documento');

    if (vale.modificado && vale.descripcion_original) {
      await this._dibujarBocetoDescripcion(ctx, '********** MODIFICACION **********', vale.descripcion, imagenes.filter(i => i.es_modificacion), true);
      await this._dibujarBocetoDescripcion(ctx, null, vale.descripcion_original, imagenes.filter(i => !i.es_modificacion), false);
    } else {
      await this._dibujarBocetoDescripcion(ctx, null, vale.descripcion, imagenes, false);
    }

    if (docsAdjuntos.length > 0) {
      this._escribirLinea(ctx, 'Hay documentos adjuntos.', ctx.fontBold, 10);
    }

    this._dibujarNumeracionPaginas(ctx);

    // Fusionar documentos PDF adjuntos al final (nunca se re-almacenan, solo se copian sus páginas)
    for (const doc of docsAdjuntos) {
      if (doc.mime_type !== 'application/pdf') continue;
      try {
        const bytes = await fs.readFile(path.join(UPLOADS_DIR, path.basename(doc.ruta)));
        const externo = await PDFDocument.load(bytes);
        const paginas = await pdfDoc.copyPages(externo, externo.getPageIndices());
        paginas.forEach(p => pdfDoc.addPage(p));
      } catch (error) {
        console.warn(`[ValePdfService] No se pudo fusionar el documento adjunto ${doc.nombre_original}:`, error.message);
      }
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
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

    ctx.y = y - 16;
  }

  _dibujarCajaSeccion(ctx, titulo, filas) {
    const altoTitulo = 18;
    const altoFila = 26;
    const alto = altoTitulo + filas.length * altoFila;
    this._asegurarEspacio(ctx, alto + 12);

    const yTop = ctx.y;
    this._rect(ctx, MARGIN, yTop - altoTitulo, CONTENT_WIDTH, altoTitulo);
    this._texto(ctx, titulo, MARGIN + 8, yTop - altoTitulo + 5, { size: 9, bold: true });

    filas.forEach((fila, idx) => {
      const yFila = yTop - altoTitulo - (idx + 1) * altoFila;
      let x = MARGIN;
      const anchoTotal = CONTENT_WIDTH;
      fila.forEach(campo => {
        const w = anchoTotal * campo.proporcion;
        this._rect(ctx, x, yFila, w, altoFila);
        this._texto(ctx, campo.etiqueta, x + 6, yFila + altoFila - 10, { size: 7, bold: true });
        this._texto(ctx, campo.valor, x + 6, yFila + 7, { size: 9 });
        x += w;
      });
    });

    ctx.y = yTop - alto - 12;
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
        { etiqueta: 'FECHA Y HORA INGRESO', valor: `${vale.fecha_creacion} ${vale.hora_creacion}`, proporcion: 3 / 8 },
        { etiqueta: 'FECHA ENTREGA', valor: formatFecha(vale.fecha_entrega), proporcion: 2 / 8 },
        { etiqueta: 'FECHA EVENTO', valor: formatFecha(vale.fecha_evento), proporcion: 2 / 8 },
        { etiqueta: 'URGENTE', valor: vale.urgente ? 'SÍ' : 'NO', proporcion: 1 / 8 }
      ],
      [
        { etiqueta: 'COD. PRODUCTO', valor: nombres.producto, proporcion: 2 / 8 },
        { etiqueta: 'MATERIAL', valor: nombres.material, proporcion: 2 / 8 },
        { etiqueta: 'TÉCNICA', valor: nombres.tecnica, proporcion: 2 / 8 },
        { etiqueta: 'ACABADO', valor: nombres.acabado, proporcion: 2 / 8 }
      ],
      [
        { etiqueta: 'CANTIDAD', valor: String(vale.cantidad), proporcion: 2 / 8 },
        { etiqueta: 'COTIZACIÓN', valor: `Q${Number(vale.cotizacion).toFixed(2)}`, proporcion: 2 / 8 },
        { etiqueta: '', valor: '', proporcion: 2 / 8 },
        { etiqueta: '', valor: '', proporcion: 2 / 8 }
      ]
    ]);
  }

  async _dibujarBocetoDescripcion(ctx, marcador, descripcion, imagenes, esModificacion) {
    if (marcador) {
      this._escribirLinea(ctx, marcador, ctx.fontBold, 10);
    }

    this._asegurarEspacio(ctx, 20);
    this._texto(ctx, 'BOCETO Y DESCRIPCIÓN', MARGIN, ctx.y, { size: 9, bold: true });
    ctx.y -= 16;

    const lineas = wrapText(descripcion || 'Sin descripción.', ctx.font, 9, CONTENT_WIDTH);
    lineas.forEach(linea => {
      this._asegurarEspacio(ctx, 14);
      this._texto(ctx, linea, MARGIN, ctx.y, { size: 9 });
      ctx.y -= 14;
    });
    ctx.y -= 6;

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

  _dibujarNumeracionPaginas(ctx) {
    const total = ctx.pdfDoc.getPageCount();
    if (total <= 1) return;
    ctx.pdfDoc.getPages().forEach((page, idx) => {
      page.drawText(`${idx + 1}/${total}`, {
        x: PAGE_WIDTH - MARGIN - 30,
        y: MARGIN / 2,
        size: 8,
        font: ctx.font,
        color: rgb(0.4, 0.4, 0.4)
      });
    });
  }
}

module.exports = new ValePdfService();
