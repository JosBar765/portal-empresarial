// src/modules/vales/services/valeReportePdfService.js
// PDF del reporte de actividad (vertical): vales por persona, taller o tienda, con su paso del pipeline.
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PAGE_WIDTH = 612; // Carta vertical
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LOGO_PATH = path.join(__dirname, '../../../../public/assets/logos/LOGO_GP_isotipo.png');

const NEGRO = rgb(0, 0, 0);
const GRIS = rgb(0.45, 0.48, 0.52);
const LINEA = rgb(0.85, 0.85, 0.85);
const FONDO_CABECERA = rgb(0.95, 0.96, 0.97);
const ROJO = rgb(0.8, 0.1, 0.1);
const GRIS_TEXTO = rgb(0.3, 0.33, 0.37);

// Celda de estado: «Paso N de 5 - Nombre del paso | Estado actual | Quién tiene el turno» (el atraso va en su propia columna).
function celdaEstado(pipeline) {
  const nombrePaso = pipeline.pasos[Math.min(pipeline.paso, pipeline.pasos.length) - 1];
  const total = pipeline.pasos.length;
  const segmentos = [pipeline.terminado ? `Paso ${total} de ${total} - Completado` : `Paso ${pipeline.paso} de ${total} - ${nombrePaso}`, pipeline.etiqueta];
  if (!pipeline.terminado && !pipeline.alerta && pipeline.detalle) segmentos.push(pipeline.detalle);
  return { segmentos };
}

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

// Semáforo de la columna Atraso, solo con el color de la letra: rojo si está atrasado, naranja si vence hoy y amarillo si va al día.
const COLOR_SEMAFORO = { rojo: rgb(0.78, 0.1, 0.1), naranja: rgb(0.85, 0.4, 0), amarillo: rgb(0.7, 0.5, 0), verde: rgb(0.09, 0.5, 0.2), gris: rgb(0.45, 0.48, 0.52) };
function semaforoAtraso({ atrasado, diasAtraso, venceHoy }) {
  if (atrasado) return { semaforo: { texto: diasAtraso >= 1 ? `${diasAtraso} ${diasAtraso === 1 ? 'día' : 'días'}` : 'Atrasado', tono: 'rojo' } };
  if (venceHoy) return { semaforo: { texto: 'Vence hoy', tono: 'naranja' } };
  return { semaforo: { texto: 'Al día', tono: 'amarillo' } };
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
    if (reporte.atrasadosVigentes && reporte.atrasadosVigentes.total) this._vigentes(ctx, reporte.atrasadosVigentes);
    if (reporte.grupos && reporte.grupos.indicadoresTaller) this._taller(ctx, reporte);
    else if (reporte.grupos) this._grupos(ctx, reporte);
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
    const derecha = [reporte.periodo.titulo || `Período: ${reporte.periodo.etiqueta}`, `Generado: ${ahora}${generadoPor ? ` por ${generadoPor}` : ''}`];
    derecha.forEach((linea, i) => {
      const t = this._ajustar(ctx, linea, 330, 7.5);
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
  // Una celda puede ser texto o un estado `{ segmentos, alerta }` (ver `celdaEstado`).
  _tabla(ctx, columnas, filas, { altoFila = 14, tamano = 7.5, altoCabecera = 14 } = {}) {
    const total = columnas.reduce((s, c) => s + c.ancho, 0);
    const anchos = columnas.map(c => (c.ancho / total) * CONTENT_WIDTH);
    const cabecera = () => {
      this._espacio(ctx, altoCabecera + altoFila);
      ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - altoCabecera, width: CONTENT_WIDTH, height: altoCabecera, color: FONDO_CABECERA });
      let x = MARGIN;
      columnas.forEach((c, i) => {
        const t = this._ajustar(ctx, c.label, anchos[i] - 8, tamano, true);
        const tx = c.derecha ? x + anchos[i] - 4 - ctx.fontBold.widthOfTextAtSize(t, tamano) : (c.centro ? x + (anchos[i] - ctx.fontBold.widthOfTextAtSize(t, tamano)) / 2 : x + 4);
        this._texto(ctx, t, tx, ctx.y - altoCabecera + 4, { size: tamano, bold: true, color: GRIS });
        x += anchos[i];
      });
      ctx.y -= altoCabecera;
    };
    cabecera();
    filas.forEach(fila => {
      if (ctx.y - altoFila < MARGIN + 18) { this._nuevaPagina(ctx); cabecera(); }
      let x = MARGIN;
      fila.forEach((celda, i) => {
        if (celda && celda.semaforo) {
          this._dibujarSemaforo(ctx, celda.semaforo, x + 2, anchos[i] - 4, tamano, altoFila);
        } else if (celda && typeof celda === 'object') {
          this._dibujarEstado(ctx, celda, x + 4, anchos[i] - 8, tamano, altoFila);
        } else {
          const t = this._ajustar(ctx, celda, anchos[i] - 8, tamano);
          const c = columnas[i];
          const tx = c.derecha ? x + anchos[i] - 4 - ctx.font.widthOfTextAtSize(t, tamano) : (c.centro ? x + (anchos[i] - ctx.font.widthOfTextAtSize(t, tamano)) / 2 : x + 4);
          this._texto(ctx, t, tx, ctx.y - altoFila / 2 - tamano * 0.35, { size: tamano });
        }
        x += anchos[i];
      });
      ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y - altoFila }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y - altoFila }, thickness: 0.5, color: LINEA });
      ctx.y -= altoFila;
    });
    ctx.y -= 12;
  }

  // Segmentos separados por «|»: el primero en negrita; si no caben en una línea pasan a una segunda.
  _dibujarEstado(ctx, { segmentos }, x, ancho, tamano, altoFila) {
    const sep = ' | ';
    const anchoDe = (t, negrita) => (negrita ? ctx.fontBold : ctx.font).widthOfTextAtSize(limpiar(t), tamano);
    const lineas = [[]];
    let usado = 0;
    segmentos.forEach((seg, i) => {
      const w = anchoDe(seg, i === 0) + (usado ? anchoDe(sep) : 0);
      if (usado && usado + w > ancho && lineas.length < 2) { lineas.push([]); usado = 0; }
      lineas[lineas.length - 1].push({ seg, i });
      usado += w;
    });
    const interlineado = tamano + 2.5;
    const base = ctx.y - altoFila / 2 - tamano * 0.35 + (lineas.length - 1) * interlineado / 2;
    lineas.forEach((linea, l) => {
      let cx = x;
      linea.forEach(({ seg, i }, k) => {
        if (k > 0) { this._texto(ctx, sep, cx, base - l * interlineado, { size: tamano, color: GRIS }); cx += anchoDe(sep); }
        const texto = this._ajustar(ctx, seg, Math.max(20, x + ancho - cx), tamano, i === 0);
        this._texto(ctx, texto, cx, base - l * interlineado, { size: tamano, bold: i === 0, color: i === 0 ? NEGRO : GRIS_TEXTO });
        cx += anchoDe(texto, i === 0);
      });
    });
  }

  // Texto en negrita, centrado en la celda y con el color del semáforo.
  _dibujarSemaforo(ctx, { texto, tono }, x, ancho, tamano, altoFila) {
    const t = this._ajustar(ctx, texto, ancho - 4, tamano, true);
    const w = ctx.fontBold.widthOfTextAtSize(limpiar(t), tamano);
    this._texto(ctx, t, x + (ancho - w) / 2, ctx.y - altoFila / 2 - tamano * 0.35, { size: tamano, bold: true, color: COLOR_SEMAFORO[tono] });
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
      this._texto(ctx, 'No hubo vales con entrega en este período.', MARGIN, ctx.y - 8, { size: 9, color: GRIS });
      ctx.y -= 20;
      return;
    }
    // «Vales por diseñador»: sin Autorizados en el resumen y «Terminado» (Sí/No) en lugar de «Propuesta».
    const porDisenador = g.agruparPor === 'disenador';
    const columnas = [
      { label: 'Vale', ancho: 1.8 }, { label: 'Estado', ancho: 3.4 },
      { label: 'Entrega', ancho: 1, centro: true }, { label: 'Atraso', ancho: 1, centro: true }, { label: porDisenador ? 'Terminado' : 'Propuesta', ancho: 1, centro: true }
    ];
    for (const grupo of g.grupos) {
      this._espacio(ctx, 80);
      const sinTerminar = grupo.vales.filter(v => !v.terminado).length;
      const resumen = `Vales ${grupo.total}${porDisenador ? '' : `  ·  Autorizados ${grupo.autorizados}`}`
        + (grupo.atrasados ? `  ·  ${grupo.atrasados} atrasado${grupo.atrasados === 1 ? '' : 's'}` : '')
        + (porDisenador
          ? (sinTerminar ? `  ·  ${sinTerminar} sin terminar` : '')
          : (grupo.sinPropuesta ? `  ·  ${grupo.sinPropuesta} sin propuesta` : ''));
      ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 18, width: CONTENT_WIDTH, height: 18, color: FONDO_CABECERA });
      this._texto(ctx, this._ajustar(ctx, grupo.nombre, 200, 9, true), MARGIN + 6, ctx.y - 13, { size: 9, bold: true });
      this._texto(ctx, this._ajustar(ctx, resumen, CONTENT_WIDTH - 220, 7.5), MARGIN + 214, ctx.y - 13, { size: 7.5, color: GRIS });
      ctx.y -= 22;
      if (!grupo.vales.length) { this._texto(ctx, 'Sin vales con entrega en este período.', MARGIN + 6, ctx.y - 6, { size: 8, color: GRIS }); ctx.y -= 16; continue; }
      const filas = grupo.vales.map(v => [
        `${v.correlativo}${v.esMod ? ' (MOD)' : ''}`,
        celdaEstado(v.pipeline),
        formatear(v.fechaEntrega, 'fecha'),
        semaforoAtraso(v),
        porDisenador
          ? { semaforo: { texto: v.terminado ? 'Sí' : 'No', tono: v.terminado ? 'verde' : 'gris' } }
          : (v.tienePropuesta ? 'Sí' : (v.sinPropuesta ? 'No' : '-'))
      ]);
      this._tabla(ctx, columnas, filas, { altoFila: 22, tamano: 7.5 });
    }
    if (g.truncado) {
      this._espacio(ctx, 16);
      this._texto(ctx, `Hay ${g.totalVales} vales; se muestran los más urgentes. Acota el período o los filtros para ver el resto.`, MARGIN, ctx.y - 8, { size: 8, color: GRIS });
    }
  }

  // «Atrasados vigentes»: vales atrasados y abiertos con entrega fuera del período, del más atrasado al menos.
  _vigentes(ctx, av) {
    this._titulo(ctx, `ATRASADOS VIGENTES (${av.total}) - entrega anterior al período`);
    const conResponsable = av.vales.some(v => v.responsable);
    const columnas = [
      { label: 'Vale', ancho: 1.8 },
      ...(conResponsable ? [{ label: 'Responsable', ancho: 1.7 }] : []),
      { label: 'Estado', ancho: 3 }, { label: 'Entrega', ancho: 1, centro: true }, { label: 'Atraso', ancho: 1, centro: true }
    ];
    const filas = av.vales.map(v => [
      v.esMod && !/^MOD-/.test(v.correlativo) ? `${v.correlativo} (MOD)` : v.correlativo,
      ...(conResponsable ? [v.responsable || '-'] : []),
      celdaEstado(v.pipeline),
      formatear(v.fechaEntrega, 'fecha'),
      semaforoAtraso(v)
    ]);
    this._tabla(ctx, columnas, filas, { altoFila: 22, tamano: 7.5 });
    if (av.truncado) this._texto(ctx, `Se muestran los ${av.vales.length} más atrasados de ${av.total}.`, MARGIN, ctx.y - 2, { size: 8, color: GRIS });
    if (av.truncado) ctx.y -= 14;
  }

  // Vista Taller (Encargado/Asistente): resumen de indicadores y dos listas planas, primero los atrasados y luego los demás,
  // cada una por fecha de entrega (la más antigua primero).
  _taller(ctx, reporte) {
    const g = reporte.grupos;
    const i = g.indicadoresTaller;
    const pct = (n) => (n == null ? '-' : `${String(n).replace('.', ',')} %`);
    const resumen = `Entrantes ${i.entrantes}  ·  Entregados ${i.entregados}  ·  Efectividad ${pct(i.efectividad)}  ·  A tiempo ${pct(i.aTiempo)}  ·  Atrasados ${i.atrasados}`;
    this._texto(ctx, this._ajustar(ctx, resumen, CONTENT_WIDTH, 8.5, true), MARGIN, ctx.y - 9, { size: 8.5, bold: true });
    ctx.y -= 22;

    const unicos = new Map();
    g.grupos.forEach(gr => gr.vales.forEach(v => { if (!unicos.has(v.id)) unicos.set(v.id, v); }));
    const porEntrega = (a, b) => String(a.fechaEntrega).localeCompare(String(b.fechaEntrega)) || String(a.correlativo).localeCompare(String(b.correlativo));
    const lista = [...unicos.values()];
    const atrasados = lista.filter(v => v.atrasado).sort(porEntrega);
    const demas = lista.filter(v => !v.atrasado).sort(porEntrega);

    const columnas = [
      { label: 'Vale', ancho: 1.75 }, { label: 'Fecha de ingreso', ancho: 1.5 }, { label: 'Estado', ancho: 2.8 },
      { label: 'Entrega', ancho: 1, centro: true }, { label: 'Atraso', ancho: 0.9, centro: true },
      { label: 'Diseñador', ancho: 1.4 }, { label: 'Terminado', ancho: 0.95, centro: true }
    ];
    const ingreso = (v) => {
      const [fecha, hora] = String(v.creadoEn).split(' ');
      return `${formatear(fecha, 'fecha')} ${(hora || '').slice(0, 5)}`;
    };
    const filasDe = (vales) => vales.map(v => [
      v.esMod && !/^MOD-/.test(v.correlativo) ? `${v.correlativo} (MOD)` : v.correlativo,
      ingreso(v),
      celdaEstado(v.pipeline),
      formatear(v.fechaEntrega, 'fecha'),
      semaforoAtraso(v),
      v.disenadores,
      { semaforo: { texto: v.terminado ? 'Sí' : 'No', tono: v.terminado ? 'verde' : 'gris' } }
    ]);
    const seccion = (titulo, vales, vacio) => {
      this._titulo(ctx, `${titulo} (${vales.length})`);
      if (!vales.length) { this._texto(ctx, vacio, MARGIN, ctx.y - 6, { size: 8, color: GRIS }); ctx.y -= 18; return; }
      this._tabla(ctx, columnas, filasDe(vales), { altoFila: 22, tamano: 7 });
    };
    seccion('ATRASADOS', atrasados, 'No hay vales atrasados en este período.');
    seccion('DEMÁS VALES', demas, 'No hay otros vales en este período.');
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
      { label: 'Correlativo', ancho: 1.7 }, { label: 'Estado', ancho: 2.7 }, { label: 'Entrega', ancho: 0.9, centro: true }, { label: 'Atraso', ancho: 0.9, centro: true },
      ...v.columnas.map(c => ({ label: c.label, ancho: 1.35, derecha: c.formato === 'horas' }))
    ];
    const filas = v.filas.map(f => [
      `${f.correlativo}${f.esMod ? ' (MOD)' : ''}`, celdaEstado(f.pipeline),
      `${f.fechaEntrega.slice(8, 10)}/${f.fechaEntrega.slice(5, 7)}`, semaforoAtraso(f), ...v.columnas.map(c => formatear(f[c.clave], c.formato))
    ]);
    this._tabla(ctx, columnas, filas, { altoFila: 22, tamano: 7.5 });
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
