// src/modules/vales/services/valeReportePdfService.js
// PDF del reporte de actividad (horizontal, estilo del vale): indicadores, tablas por persona y listado de vales.
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PAGE_WIDTH = 792; // Carta horizontal
const PAGE_HEIGHT = 612;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LOGO_PATH = path.join(__dirname, '../../../../public/assets/logos/LOGO_GP_isotipo.png');

const NEGRO = rgb(0, 0, 0);
const GRIS = rgb(0.45, 0.48, 0.52);
const LINEA = rgb(0.85, 0.85, 0.85);
const FONDO_CABECERA = rgb(0.95, 0.96, 0.97);
const ROJO = rgb(0.8, 0.1, 0.1);

const ETIQUETA_ESTADO = {
  ESPERANDO_AUTORIZACION: 'Esperando autorización', CREADO: 'Creado', APROBADO_DEPARTAMENTO: 'Aprobado por talleres',
  PENDIENTE_CONFIRMACION: 'Pend. confirmación', RECIBIDO: 'Recibido', SOLICITANDO_MODIFICACION: 'Solicitando modificación',
  MODIFICADO: 'Modificado', CONFIRMADO: 'Confirmado', RECHAZADO: 'Rechazado'
};

// Las fuentes estándar del PDF solo cubren Latin-1: lo demás se sustituye en vez de romper la generación.
const limpiar = texto => String(texto ?? '').replace(/[–—]/g, '-').replace(/→/g, 'a').replace(/[^ -ÿ]/g, '?');

function formatear(valor, formato) {
  if (valor == null || valor === '') return '-';
  switch (formato) {
    case 'num': return Number(valor).toLocaleString('es-GT', { maximumFractionDigits: 1 });
    case 'pct': return `${Number(valor).toLocaleString('es-GT', { maximumFractionDigits: 1 })}%`;
    case 'dias': return `${Number(valor).toLocaleString('es-GT', { maximumFractionDigits: 1 })} d`;
    case 'horas': {
      const h = Number(valor);
      if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
      if (h < 48) return `${h.toLocaleString('es-GT', { maximumFractionDigits: 1 })} h`;
      return `${(h / 24).toLocaleString('es-GT', { maximumFractionDigits: 1 })} d`;
    }
    case 'fecha': {
      const [f] = String(valor).split(' ');
      const [y, m, d] = f.split('-');
      return `${d}/${m}/${y}`;
    }
    case 'fechaHora': {
      const [f, hora] = String(valor).split(' ');
      const [, m, d] = f.split('-');
      return `${d}/${m} ${(hora || '').slice(0, 5)}`;
    }
    default: return String(valor);
  }
}

class ValeReportePdfService {
  async generar(reporte, { generadoPor = '', ahora = '' } = {}) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let logo = null;
    try { logo = await pdfDoc.embedPng(await fs.readFile(LOGO_PATH)); } catch { logo = null; }
    const ctx = { pdfDoc, font, fontBold, logo, page: null, y: 0 };

    this._nuevaPagina(ctx);
    this._encabezado(ctx, reporte, generadoPor, ahora);
    if (reporte.grupos) this._grupos(ctx, reporte);
    else {
      reporte.tablas.forEach(t => this._tablaPersonas(ctx, t));
      this._listado(ctx, reporte);
    }
    this._pies(pdfDoc, font);
    return Buffer.from(await pdfDoc.save());
  }

  _nuevaPagina(ctx) {
    ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN;
  }

  _espacio(ctx, alto) {
    if (ctx.y - alto < MARGIN + 18) this._nuevaPagina(ctx);
  }

  _texto(ctx, texto, x, y, { size = 9, bold = false, color = NEGRO } = {}) {
    ctx.page.drawText(limpiar(texto), { x, y, size, font: bold ? ctx.fontBold : ctx.font, color });
  }

  _ajustar(ctx, texto, ancho, size, bold = false) {
    const f = bold ? ctx.fontBold : ctx.font;
    let t = limpiar(texto);
    if (f.widthOfTextAtSize(t, size) <= ancho) return t;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}...`, size) > ancho) t = t.slice(0, -1);
    return `${t}...`;
  }

  _encabezado(ctx, reporte, generadoPor, ahora) {
    const x0 = MARGIN;
    if (ctx.logo) ctx.page.drawImage(ctx.logo, { x: x0, y: ctx.y - 22, width: 22, height: 22 });
    this._texto(ctx, 'REPORTE DE ACTIVIDAD', x0 + 30, ctx.y - 9, { size: 12, bold: true });
    this._texto(ctx, reporte.titulo, x0 + 30, ctx.y - 20, { size: 8.5, color: GRIS });
    const derecha = [`Período: ${reporte.periodo.etiqueta}`, `Generado: ${ahora}${generadoPor ? ` por ${generadoPor}` : ''}`];
    derecha.forEach((linea, i) => {
      const t = limpiar(linea);
      this._texto(ctx, t, PAGE_WIDTH - MARGIN - ctx.font.widthOfTextAtSize(t, 7.5), ctx.y - 9 - i * 10, { size: 7.5, color: GRIS });
    });
    ctx.y -= 28;
    if ((reporte.resumenFiltros || []).length) {
      this._texto(ctx, this._ajustar(ctx, reporte.resumenFiltros.join('  ·  '), CONTENT_WIDTH, 7.5), MARGIN, ctx.y - 5, { size: 7.5, color: GRIS });
      ctx.y -= 13;
    }
    const evaluados = reporte.evaluados || [];
    if (evaluados.length) {
      const nombres = evaluados.map(p => p.nombre);
      let texto = nombres.join(', ');
      let mostrados = nombres.length;
      while (mostrados > 1 && ctx.font.widthOfTextAtSize(limpiar(`Evaluados (${nombres.length}): ${texto}`), 8.5) > CONTENT_WIDTH) {
        mostrados -= 1;
        texto = `${nombres.slice(0, mostrados).join(', ')} y ${nombres.length - mostrados} más`;
      }
      const linea = evaluados.length === 1 ? `Evaluado: ${texto}` : `Evaluados (${nombres.length}): ${texto}`;
      this._texto(ctx, this._ajustar(ctx, linea, CONTENT_WIDTH, 7.5, true), MARGIN, ctx.y - 5, { size: 7.5, bold: true });
      ctx.y -= 14;
    }
    ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y }, thickness: 0.75, color: NEGRO });
    ctx.y -= 14;
  }

  _titulo(ctx, texto) {
    this._espacio(ctx, 30);
    this._texto(ctx, texto, MARGIN, ctx.y - 9, { size: 10, bold: true });
    ctx.y -= 20;
  }

  // Tabla genérica: `columnas` [{ label, ancho (proporción), derecha }], `filas` [[texto, ...]].
  _tabla(ctx, columnas, filas, { altoFila = 14, tamano = 7.5 } = {}) {
    const total = columnas.reduce((s, c) => s + c.ancho, 0);
    const anchos = columnas.map(c => (c.ancho / total) * CONTENT_WIDTH);
    const cabecera = () => {
      this._espacio(ctx, altoFila * 2);
      ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - altoFila, width: CONTENT_WIDTH, height: altoFila, color: FONDO_CABECERA });
      let x = MARGIN;
      columnas.forEach((c, i) => {
        const t = this._ajustar(ctx, c.label, anchos[i] - 8, tamano, true);
        const tx = c.derecha ? x + anchos[i] - 4 - ctx.fontBold.widthOfTextAtSize(t, tamano) : x + 4;
        this._texto(ctx, t, tx, ctx.y - altoFila + 4, { size: tamano, bold: true, color: GRIS });
        x += anchos[i];
      });
      ctx.y -= altoFila;
    };
    cabecera();
    filas.forEach(fila => {
      if (ctx.y - altoFila < MARGIN + 18) { this._nuevaPagina(ctx); cabecera(); }
      let x = MARGIN;
      fila.forEach((celda, i) => {
        const t = this._ajustar(ctx, celda, anchos[i] - 8, tamano);
        const tx = columnas[i].derecha ? x + anchos[i] - 4 - ctx.font.widthOfTextAtSize(t, tamano) : x + 4;
        this._texto(ctx, t, tx, ctx.y - altoFila + 4, { size: tamano });
        x += anchos[i];
      });
      ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y - altoFila }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y - altoFila }, thickness: 0.5, color: LINEA });
      ctx.y -= altoFila;
    });
    ctx.y -= 12;
  }

  _tablaPersonas(ctx, tabla) {
    if (!tabla.filas.length) return;
    this._titulo(ctx, tabla.titulo.toUpperCase());
    const columnas = [{ label: 'Nombre', ancho: 3 }, ...tabla.columnas.map(c => ({ label: c.label, ancho: 1.2, derecha: true }))];
    const filas = tabla.filas.map(f => [f.nombre, ...tabla.columnas.map(c => formatear(f[c.clave], c.formato))]);
    this._tabla(ctx, columnas, filas);
  }

  // Tabla unificada: cada persona (o taller/tienda) con sus vales creados en el período, del más urgente al menos.
  _grupos(ctx, reporte) {
    const g = reporte.grupos;
    const nombre = { asesor: 'ASESOR', disenador: 'DISEÑADOR', taller: 'TALLER', tienda: 'TIENDA' }[g.agruparPor];
    this._titulo(ctx, `VALES POR ${nombre} (${g.totalVales})`);
    if (!g.grupos.length) {
      this._texto(ctx, 'No hubo vales creados en este período.', MARGIN, ctx.y - 8, { size: 9, color: GRIS });
      ctx.y -= 20;
      return;
    }
    const columnas = [
      { label: 'Vale', ancho: 1.5 }, { label: 'Cliente', ancho: 2 }, { label: 'Estado', ancho: 2.4 },
      { label: 'Entrega', ancho: 0.9 }, { label: 'Atraso', ancho: 0.8 }, { label: 'Propuesta', ancho: 0.9 }
    ];
    for (const grupo of g.grupos) {
      this._espacio(ctx, 60);
      const resumen = `Creados ${grupo.creados}  ·  Autorizados ${grupo.autorizados}`
        + (grupo.atrasados ? `  ·  ${grupo.atrasados} atrasado${grupo.atrasados === 1 ? '' : 's'}` : '')
        + (grupo.sinPropuesta ? `  ·  ${grupo.sinPropuesta} sin propuesta` : '');
      ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 18, width: CONTENT_WIDTH, height: 18, color: FONDO_CABECERA });
      this._texto(ctx, this._ajustar(ctx, grupo.nombre, 200, 9, true), MARGIN + 6, ctx.y - 13, { size: 9, bold: true });
      this._texto(ctx, this._ajustar(ctx, resumen, CONTENT_WIDTH - 220, 7.5), MARGIN + 214, ctx.y - 13, { size: 7.5, color: GRIS });
      ctx.y -= 22;
      if (!grupo.vales.length) { this._texto(ctx, 'Sin vales creados en este período.', MARGIN + 6, ctx.y - 6, { size: 8, color: GRIS }); ctx.y -= 16; continue; }
      const filas = grupo.vales.map(v => [
        `${v.correlativo}${v.esMod ? ' (MOD)' : ''}`, v.cliente,
        `${v.pipeline.etiqueta}${v.pipeline.detalle ? ` · ${v.pipeline.detalle}` : ''}`,
        formatear(v.fechaEntrega, 'fecha'),
        v.atrasado ? `${v.diasAtraso} d` : (v.venceHoy ? 'Vence hoy' : 'Al día'),
        v.tienePropuesta ? 'Sí' : (v.sinPropuesta ? 'No' : '-')
      ]);
      this._tabla(ctx, columnas, filas, { altoFila: 13, tamano: 7 });
    }
    if (g.truncado) {
      this._espacio(ctx, 16);
      this._texto(ctx, `Hay ${g.totalVales} vales; se muestran los más urgentes. Acota el período o los filtros para ver el resto.`, MARGIN, ctx.y - 8, { size: 8, color: GRIS });
    }
  }

  _listado(ctx, reporte) {
    const v = reporte.vales;
    this._titulo(ctx, `VALES DEL PERÍODO (${v.total})`);
    if (!v.filas.length) {
      this._texto(ctx, 'No hubo actividad en este período.', MARGIN, ctx.y - 8, { size: 9, color: GRIS });
      ctx.y -= 20;
      return;
    }
    const columnas = [
      { label: 'Correlativo', ancho: 1.6 }, { label: 'Cliente', ancho: 2 }, { label: 'Entrega', ancho: 0.9 }, { label: 'Estado', ancho: 1.6 },
      ...v.columnas.map(c => ({ label: c.label, ancho: 1.1, derecha: c.formato === 'horas' }))
    ];
    const filas = v.filas.map(f => [
      `${f.correlativo}${f.esMod ? ' (MOD)' : ''}`, f.cliente, `${f.fechaEntrega.slice(8, 10)}/${f.fechaEntrega.slice(5, 7)}${f.atrasado && f.diasAtraso >= 1 ? ` (+${f.diasAtraso}d)` : ''}`,
      ETIQUETA_ESTADO[f.estado] || f.estado, ...v.columnas.map(c => formatear(f[c.clave], c.formato))
    ]);
    this._tabla(ctx, columnas, filas, { altoFila: 13, tamano: 7 });
    if (v.truncado) {
      this._espacio(ctx, 16);
      this._texto(ctx, `Se muestran los primeros ${v.filas.length} de ${v.total} vales. Acota el período para ver el resto.`, MARGIN, ctx.y - 8, { size: 8, color: GRIS });
    }
  }

  _pies(pdfDoc, font) {
    const paginas = pdfDoc.getPages();
    paginas.forEach((p, i) => {
      const texto = `Vales de Arte  ·  Página ${i + 1} de ${paginas.length}`;
      p.drawText(limpiar(texto), { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(limpiar(texto), 7.5), y: 18, size: 7.5, font, color: GRIS });
    });
  }
}

module.exports = new ValeReportePdfService();
