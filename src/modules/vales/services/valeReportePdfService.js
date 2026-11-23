// src/modules/vales/services/valeReportePdfService.js
// PDF del reporte de actividad (vertical): vales por persona, taller o tienda, con su paso del pipeline.
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { conSimboloPorcentaje, detalleUrgentes, detalleEfectividad, detalleATiempo } = require('./valeReporteContadores');
const { NOTA_TALLERES } = require('./valeReporteTalleres');
const { NOTA_DISENADORES } = require('./valeReporteDisenadores');

const PAGE_WIDTH = 612; // Carta vertical
const PAGE_HEIGHT = 792;
const MARGIN = 36;
// Todas las páginas dejan abajo el hueco de las firmas, para que no obliguen a crear una hoja nueva.
const LIMITE_INFERIOR = MARGIN + 26;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LOGO_PATH = path.join(__dirname, '../../../../public/assets/logos/LOGO_GP_isotipo.png');

const NEGRO = rgb(0, 0, 0);
const GRIS = rgb(0.45, 0.48, 0.52);
// Dos líneas para que quepa en la página; el desglose se omite sobre el tope de vales del servicio de grupos.
const TEXTO_DESGLOSE_OMITIDO = (n) => [`El período tiene ${n.toLocaleString('es-GT')} vales: son demasiados para listarlos en el PDF.`, 'Acota el período o los filtros para ver el desglose.'];
const LINEA = rgb(0.85, 0.85, 0.85);
const FONDO_CABECERA = rgb(0.95, 0.96, 0.97);
const ROJO = rgb(0.8, 0.1, 0.1);
const AMBAR = rgb(0.85, 0.47, 0.02);
const GRIS_TEXTO = rgb(0.3, 0.33, 0.37);

const SECCIONES_PDF = [
  { clave: 'atrasados', titulo: 'ATRASADOS EN EL PERÍODO' },
  { clave: 'noEntregados', titulo: 'NO ENTREGADOS' },
  { clave: 'entregados', titulo: 'ENTREGADOS' }
];
// Títulos de Reportes 2 (reportes `actividad-*`): sección de atrasados del período, sin entregar y atrasados anteriores al período.
const TITULOS_REPORTES2 = { atrasados: 'ATRASADOS (PERÍODO ACTUAL)', noEntregados: 'POR VENCER', vigentes: 'ATRASADOS (ANTERIORES AL PERÍODO)' };
const TITULOS_PDF = { actividad: 'REPORTE DE ACTIVIDAD', rendimiento: 'REPORTE DE RENDIMIENTO', 'actividad-tienda': 'REPORTE DE ACTIVIDAD DE TIENDAS',
  'actividad-taller': 'REPORTE DE ACTIVIDAD DE TALLERES', 'actividad-disenador': 'REPORTE DE ACTIVIDAD DE DISEÑADORES', 'actividad-asesor': 'REPORTE DE ACTIVIDAD DE ASESORES' };
const COLOR_SERIE_A = rgb(0.145, 0.388, 0.922);
const COLOR_SERIE_B = rgb(0.086, 0.639, 0.29);
// Gráfica de diseñadores: los mismos colores de la pantalla (global.css): --color-primary #2563EB, --color-success #16A34A, --color-danger #DC2626.
const COLOR_DIS_ASIGNADOS = rgb(37 / 255, 99 / 255, 235 / 255);
const COLOR_DIS_ATIEMPO = rgb(22 / 255, 163 / 255, 74 / 255);
const COLOR_DIS_SIN_ASIGNAR = rgb(0.85, 0.47, 0.02); // el ámbar (--color-warning) de la barra «Sin asignar»
const COLOR_DIS_TARDE = rgb(220 / 255, 38 / 255, 38 / 255);
const BLANCO = rgb(1, 1, 1);

// Celda de estado: «Paso N de 5 · Nombre del paso» (el atraso va en su propia columna).
function celdaEstado(pipeline) {
  const total = pipeline.pasos.length;
  const nombrePaso = pipeline.terminado ? 'Completado' : pipeline.pasos[Math.min(pipeline.paso, total) - 1];
  return `Paso ${pipeline.terminado ? total : pipeline.paso} de ${total} · ${nombrePaso}`;
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
const COLOR_SEMAFORO = { ambar: AMBAR, rojo: rgb(0.78, 0.1, 0.1), naranja: rgb(0.85, 0.4, 0), amarillo: rgb(0.7, 0.5, 0), verde: rgb(0.09, 0.5, 0.2), gris: rgb(0.45, 0.48, 0.52) };
// Rendimiento: color de un porcentaje (efectividad o a tiempo): rojo por debajo de 50 %, ámbar por debajo de 90 % (como los contadores).
const tonoPct = (n) => (n == null ? null : (n < 50 ? 'rojo' : (n < 90 ? 'ambar' : null)));
const celdaPct = (num, den) => {
  if (!(den > 0)) return '-';
  const n = Math.round((num / den) * 100);
  const tono = tonoPct(n);
  return tono ? { semaforo: { texto: `${n} %`, tono } } : `${n} %`;
};
// Conteos del comparativo: ámbar las entregas tarde, rojo las sin entregar (solo si hay).
const celdaConteo = (n, tono) => (n > 0 ? { semaforo: { texto: String(n), tono } } : String(n));
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
    if (reporte.tipo === 'rendimiento' && reporte.grupos && reporte.grupos.rendimiento) {
      // Administrador y Gerente traen Ventas y Taller; se imprime el enfoque elegido y los contadores solo con el de Taller.
      const { vistas } = reporte.grupos.rendimiento;
      const enTaller = vistas ? reporte.enfoque === 'taller' : !!reporte.grupos.indicadoresTaller;
      const bloque = vistas ? vistas[enTaller ? 'taller' : 'ventas'] : reporte.grupos.rendimiento;
      if (enTaller) this._contadores(ctx, reporte.grupos.indicadoresTaller);
      this._grafica(ctx, bloque);
      this._tablaRendimiento(ctx, bloque);
    } else {
      this._actividad(ctx, reporte);
    }
    this._firmas(ctx, generadoPor);
    this._pies(pdfDoc, font);
    return Buffer.from(await pdfDoc.save());
  }

  // Reporte de actividad: atrasados antes del período y las tres secciones del período (o la lista del Asesor y del Diseñador).
  _actividad(ctx, reporte) {
    if (reporte.contadores) {
      this._contadoresActividad(ctx, reporte.contadores);
      // La gráfica es por asesor en el reporte de asesores y por tienda en el de tiendas.
      if (reporte.tipo === 'actividad-disenador') this._graficaDisenadores(ctx, reporte.contadores.porDisenador, { notaArriba: NOTA_DISENADORES, notaFinal: null });
      // Talleres: el mismo diseño; la nota de los vales en varios talleres va impresa bajo el título (en pantalla es un ícono con ayuda).
      else if (reporte.tipo === 'actividad-taller') this._graficaDisenadores(ctx, reporte.contadores.porTaller, { titulo: 'VALES ASIGNADOS Y ENTREGADOS POR TALLER', notaArriba: NOTA_TALLERES, notaFinal: null, unidad: 'talleres' });
      else if (reporte.tipo === 'actividad-asesor') this._graficaBarras(ctx, reporte.contadores.porAsesor, 'VALES INGRESADOS POR ASESOR', 'asesores', { apilada: true });
      else this._graficaBarras(ctx, reporte.contadores.porTienda, 'VALES INGRESADOS POR TIENDA', 'tiendas');
    }
    if (reporte.incluirDesglose === false) return; // sin desglose: solo los contadores y la gráfica (el dueño lo elige al descargar)
    if (reporte.contadores) this._divisionDesglose(ctx);
    if (reporte.desgloseDe) this._titulo(ctx, `DESGLOSE DE VALES DE ARTE: ${String(reporte.desgloseDe).toUpperCase()}`); // desglose de la tienda enfocada
    const desgloseOmitido = !!(reporte.grupos && reporte.grupos.desgloseOmitido);
    if (!desgloseOmitido && reporte.atrasadosVigentes && reporte.atrasadosVigentes.total) this._vigentes(ctx, reporte.atrasadosVigentes, reporte.rol === 'encargado', String(reporte.tipo).startsWith('actividad-') ? TITULOS_REPORTES2.vigentes : undefined);
    if (reporte.grupos) this._secciones(ctx, reporte);
    else {
      reporte.tablas.forEach(t => this._tablaPersonas(ctx, t));
      this._listado(ctx, reporte);
    }
  }

  // Franja de contadores del reporte de actividad de tienda, en dos filas (maqueta aprobada en Figma, ~9 % de la página):
  // Ingresados · Urgentes · Sin entregar / Atrasados (anteriores, actuales) · Entregados (con atraso, sin atraso).
  // Reporte de diseñadores (trae `efectividad`): sin Urgentes, y la primera fila es Ingresados · Efectividad · Entregas a tiempo · Sin entregar.
  _contadoresActividad(ctx, c) {
    const conEfectividad = c.efectividad !== undefined;
    const ALTO = 72; const FILA = 36;
    const top = ctx.y + 6;
    ctx.page.drawRectangle({ x: MARGIN, y: top - ALTO, width: CONTENT_WIDTH, height: ALTO, color: FONDO_CABECERA });
    const verde = COLOR_SEMAFORO.verde;
    const num = (n) => String(Number(n) || 0);
    const linea = (x1, y1, x2, y2) => ctx.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.75, color: LINEA });
    const separador = (x, fila) => linea(MARGIN + x, top - fila * FILA - 6, MARGIN + x, top - fila * FILA - 30);
    // `extras`: textos a la derecha del valor ({ texto, color, size, bold, hueco }); la altura de la fila es la del valor.
    const celda = (x, fila, etiqueta, valor, extras = []) => {
      const x0 = MARGIN + x; const base = top - fila * FILA - 27.5;
      this._texto(ctx, etiqueta, x0, top - fila * FILA - 11.7, { size: 7, color: GRIS });
      this._texto(ctx, valor, x0, base, { size: 12, bold: true });
      let cx = x0 + ctx.fontBold.widthOfTextAtSize(limpiar(valor), 12);
      extras.forEach(({ texto, color, size = 8.5, bold = true, hueco = 12 }) => {
        cx += hueco;
        this._texto(ctx, texto, cx, base, { size, bold, color });
        cx += (bold ? ctx.fontBold : ctx.font).widthOfTextAtSize(limpiar(texto), size);
      });
    };
    const u = c.urgentes || {}; const a = c.atrasados || {}; const r = c.recibidos || {};
    celda(10, 0, 'Ingresados', num(c.ingresados));
    if (conEfectividad) {
      const recibidos = Number(r.total) || 0; const aTiempo = recibidos - (Number(r.conAtraso) || 0);
      const detalle = (texto) => [{ texto, color: GRIS, size: 7.5, bold: false, hueco: 5 }];
      // Textos de detalle iguales a los de la pantalla; la tarjeta de Efectividad es más ancha porque lleva «(N atrasados)».
      separador(80, 0);
      celda(90, 0, 'Por vencer', num(c.sinEntregar));
      separador(150, 0);
      celda(160, 0, 'Efectividad', conSimboloPorcentaje(c.efectividad), detalle(detalleEfectividad(recibidos, Number(c.ingresados) || 0, Number(a.actuales) || 0)));
      separador(370, 0);
      celda(380, 0, 'Entregas a tiempo', conSimboloPorcentaje(c.aTiempo), detalle(detalleATiempo(aTiempo, recibidos)));
    } else {
      separador(180, 0);
      celda(192, 0, 'Urgentes', conSimboloPorcentaje(u.porcentaje), [{ texto: detalleUrgentes(Number(u.total) || 0, Number(c.ingresados) || 0), color: GRIS, size: 7.5, bold: false, hueco: 5 }]);
      separador(360, 0);
      celda(372, 0, 'Por vencer', num(c.sinEntregar));
    }
    linea(MARGIN + 10, top - FILA, MARGIN + CONTENT_WIDTH - 10, top - FILA);
    celda(10, 1, 'Atrasados', num(a.total), [{ texto: `Anteriores ${num(a.anteriores)}`, color: ROJO }, { texto: `Actuales ${num(a.actuales)}`, color: ROJO }]);
    separador(270, 1);
    celda(282, 1, 'Entregados', num(r.total), [{ texto: `Con atraso ${num(r.conAtraso)}`, color: ROJO }, { texto: `Sin atraso ${num(r.sinAtraso)}`, color: verde }]);
    ctx.y = top - ALTO - 8;
  }

  // Línea que separa el resumen (contadores y gráfica) del desglose de vales. Si el desglose arranca en una página nueva no hace falta.
  _divisionDesglose(ctx) {
    const pagina = ctx.page;
    this._espacio(ctx, 40);
    if (ctx.page !== pagina) return;
    ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y - 2 }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y - 2 }, thickness: 0.75, color: rgb(0.6, 0.6, 0.6) });
    ctx.y -= 14;
  }

  // «Vales ingresados por tienda» (o por asesor): barras horizontales de mayor a menor (las 10 primeras y el resto sumado en «Otras»); la que
  // más mete en azul y las demás en gris. `lista` es [{ nombre, total }]; llega en null si no corresponde (una sola tienda en el filtro).
  // `apilada` (reporte de asesores): cada barra se divide en vales no urgentes (azul) y urgentes (ámbar, como en pantalla) con su leyenda;
  // como el color pasa a significar «urgente», no se resalta la mayor. `lista` trae entonces `urgentes`.
  _graficaBarras(ctx, lista, titulo, unidadOtras, { apilada = false } = {}) {
    const porTienda = lista;
    if (!Array.isArray(porTienda) || !porTienda.length) return; // basta una con vales
    const total = porTienda.reduce((s, t) => s + (Number(t.total) || 0), 0);
    if (!total) return;
    const FILA = 13; const ALTO_BARRA = 8.75; const ANCHO_VALOR = 24; const TOPE_NOMBRE = 260;
    const maximo = Number(porTienda[0].total) || 0;
    const pct = (n) => { const p = n / total * 100; return n > 0 && p < 1 ? '<1' : String(Math.round(p)); };
    // Salen todas las tiendas o asesores (sin «Otras»), como en la pantalla desplegada; si no caben en la página, las filas siguen en la siguiente.
    const filas = porTienda.map(t => ({ nombre: t.nombre, total: Number(t.total) || 0, urgentes: Number(t.urgentes) || 0, lider: !apilada && Number(t.total) === maximo }));
    this._espacio(ctx, 30 + Math.min(filas.length, 6) * FILA + (apilada ? 12 : 0));
    this._titulo(ctx, titulo); // mismo estilo de título que las demás secciones del PDF
    if (apilada) {
      // Leyenda: los dos colores de la barra con su nombre (el color no se interpreta solo).
      let lx = MARGIN;
      [[COLOR_SERIE_A, 'No urgentes'], [AMBAR, 'Urgentes']].forEach(([color, texto]) => {
        ctx.page.drawRectangle({ x: lx, y: ctx.y + 1.5, width: 7, height: 7, color });
        this._texto(ctx, texto, lx + 10, ctx.y + 2, { size: 7.5, color: GRIS_TEXTO });
        lx += 10 + ctx.font.widthOfTextAtSize(texto, 7.5) + 14;
      });
      ctx.y -= 10;
    }
    // La columna de nombres mide lo que el nombre más largo (con un tope) y los nombres van a la derecha, junto al arranque de las barras.
    const anchoDe = (f) => ctx.font.widthOfTextAtSize(limpiar(f.nombre), 7.5);
    const anchoNombre = Math.min(TOPE_NOMBRE, Math.max(...filas.map(anchoDe)));
    // El porcentaje va en la punta de cada barra (se reserva su ancho al final de la pista) y la columna de la derecha lleva la cantidad.
    const reservaPct = ctx.font.widthOfTextAtSize('100 %', 7.5) + 5;
    const x0 = MARGIN + anchoNombre + 8; const anchoPista = CONTENT_WIDTH - anchoNombre - ANCHO_VALOR - 16 - reservaPct;
    // «Otras» suma varias tiendas: no lleva barra (no es comparable con una sola) y no escala a las demás.
    const maxFila = Math.max(maximo, 1);
    filas.forEach((f) => {
      this._espacio(ctx, FILA);
      const base = ctx.y - FILA + 3.5;
      const nombre = this._ajustar(ctx, f.nombre, anchoNombre, 7.5);
      const anchoTexto = ctx.font.widthOfTextAtSize(limpiar(nombre), 7.5);
      this._texto(ctx, nombre, MARGIN + anchoNombre - anchoTexto, base, { size: 7.5 });
      const ancho = Math.max(f.total / maxFila * anchoPista, f.total > 0 ? 1.5 : 0);
      const yBarra = ctx.y - FILA + (FILA - ALTO_BARRA) / 2;
      if (ancho > 0 && !f.otras && apilada) {
        // Dos tramos con un hueco de 1,5 pt: el azul (no urgentes) y, a continuación, el ámbar (urgentes) con su cantidad, siempre visible.
        const HUECO = 1.5;
        const n = String(f.urgentes);
        const wN = ctx.fontBold.widthOfTextAtSize(n, 6.5);
        // Mínimo de wN + 4 para que quepa la cifra aunque sea un solo vale.
        const anchoUrg = f.urgentes > 0 ? Math.max(f.urgentes / maxFila * anchoPista, wN + 4) : 0;
        const anchoBase = Math.max(ancho - anchoUrg - (anchoUrg ? HUECO : 0), 0);
        if (anchoBase > 0) ctx.page.drawRectangle({ x: x0, y: yBarra, width: anchoBase, height: ALTO_BARRA, color: COLOR_SERIE_A });
        if (anchoUrg > 0) {
          ctx.page.drawRectangle({ x: x0 + anchoBase + (anchoBase ? HUECO : 0), y: yBarra, width: anchoUrg, height: ALTO_BARRA, color: AMBAR });
          this._texto(ctx, n, x0 + anchoBase + (anchoBase ? HUECO : 0) + (anchoUrg - wN) / 2, yBarra + 2.3, { size: 6.5, bold: true, color: BLANCO });
        }
      } else if (ancho > 0 && !f.otras) ctx.page.drawRectangle({ x: x0, y: yBarra, width: ancho, height: ALTO_BARRA, color: f.lider ? COLOR_SERIE_A : rgb(0.58, 0.64, 0.72) });
      // «Otras» no lleva barra: su porcentaje arranca donde empezaría una.
      this._texto(ctx, `${pct(f.total)} %`, x0 + (f.otras ? 0 : ancho) + 4, base, { size: 7.5 });
      const cantidad = String(f.total);
      this._texto(ctx, cantidad, PAGE_WIDTH - MARGIN - ctx.font.widthOfTextAtSize(limpiar(cantidad), 7.5), base, { size: 7.5 });
      ctx.y -= FILA;
    });
    ctx.y -= 8;
  }

  // «Vales asignados y entregados por diseñador»: por diseñador, una barra de asignados y otra de entregados (a tiempo en verde y
  // tarde en rojo con su cantidad), ambas en una misma escala, y a la derecha las columnas E (efectividad) y T (entregas tardías).
  // `lista`: [{ nombre, asignados, entregados, tarde, efectividad, tardias }]. Salen todos, de más a menos asignados
  // (un vale compartido cuenta en cada diseñador, la suma no es comparable).
  _graficaDisenadores(ctx, lista, { titulo = 'VALES ASIGNADOS Y ENTREGADOS POR DISEÑADOR', notaArriba = null, notaFinal = null } = {}) {
    const base = (Array.isArray(lista) ? lista : []).filter(d => (Number(d.asignados) || 0) > 0);
    if (!base.length) return;
    const FILA = 23; const ALTO_BARRA = 8; const HUECO = 1.5; const TOPE_NOMBRE = 260; const ANCHO_COL = 46;
    // «Sin asignar» (id 0) siempre primero; el resto de más a menos asignados y, a igualdad, por nombre (la misma regla de la pantalla).
    const esSin = (d) => d.id != null && Number(d.id) === 0;
    const nombreSinRol = (d) => String(d.nombre ?? '').replace(/ · (Encargado|Asistente)$/, '');
    const ordenada = [...base].sort((a, b) => (esSin(b) - esSin(a)) || ((Number(b.asignados) || 0) - (Number(a.asignados) || 0)) || nombreSinRol(a).localeCompare(nombreSinRol(b), 'es'));
    // Salen todos los diseñadores (sin «Otros»); si no caben en la página, las filas siguen en la siguiente.
    const filas = ordenada.map(d => ({
      nombre: String(d.nombre ?? '').replace(/ · (Encargado|Asistente)$/, ''), asignados: Number(d.asignados) || 0, entregados: Number(d.entregados) || 0, tarde: Number(d.tarde) || 0, efectividad: d.efectividad, tardias: d.tardias,
      sinAsignar: d.id != null && Number(d.id) === 0 // solo la barra de asignados, sin E ni T y con el nombre alineado a ella
    }));
    // La efectividad más baja y las entregas tardías más altas (con empates) van en rojo y negrita, como en la pantalla: sin dato no cuentan, con todas iguales o con un máximo de 0 no se resalta nada.
    const valores = (clave) => filas.filter(f => !f.sinAsignar && f[clave] != null).map(f => Number(f[clave]));
    const ve = valores('efectividad'); const minE = Math.min(...ve); const maxE = Math.max(...ve);
    const maxT = Math.max(0, ...valores('tardias'));
    const rojo = { bold: true, color: ROJO };
    const resaltaE = (f) => (f.efectividad != null && minE < maxE && Number(f.efectividad) === minE ? rojo : {});
    const resaltaT = (f) => (maxT > 0 && f.tardias != null && Number(f.tardias) === maxT ? rojo : {});
    // La nota de arriba (si la hay) se parte en líneas del ancho de la página.
    const lineasNota = [];
    if (notaArriba) {
      let actual = '';
      for (const palabra of notaArriba.split(' ')) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (actual && ctx.font.widthOfTextAtSize(limpiar(prueba), 7.5) > CONTENT_WIDTH) { lineasNota.push(actual); actual = palabra; } else actual = prueba;
      }
      if (actual) lineasNota.push(actual);
    }
    this._espacio(ctx, 30 + 34 + lineasNota.length * 10 + Math.min(filas.length, 6) * FILA);
    this._titulo(ctx, titulo);
    lineasNota.forEach((linea) => { this._texto(ctx, linea, MARGIN, ctx.y, { size: 7.5, color: GRIS_TEXTO }); ctx.y -= 10; });
    if (lineasNota.length) ctx.y -= 2;
    // Leyenda: los tres colores con su nombre y, en otra línea, qué significan las letras de las columnas.
    let lx = MARGIN;
    [[COLOR_DIS_ASIGNADOS, 'Asignados'], [COLOR_DIS_ATIEMPO, 'Entregados a tiempo'], [COLOR_DIS_TARDE, 'Entregados tarde']].forEach(([color, texto]) => {
      ctx.page.drawRectangle({ x: lx, y: ctx.y - 0.5, width: 7, height: 7, color });
      this._texto(ctx, texto, lx + 10, ctx.y, { size: 7.5, color: GRIS_TEXTO });
      lx += 10 + ctx.font.widthOfTextAtSize(texto, 7.5) + 14;
    });
    ctx.y -= 11;
    // Qué significan las letras de las columnas, con E y T en negrita y sin el cálculo (va en las notas de la pantalla).
    let letrasX = MARGIN;
    [['E', true], [' = Efectividad  ·  ', false], ['T', true], [' = Entregas tardías', false]].forEach(([texto, bold]) => {
      this._texto(ctx, texto, letrasX, ctx.y, { size: 7.5, color: GRIS, bold });
      letrasX += (bold ? ctx.fontBold : ctx.font).widthOfTextAtSize(limpiar(texto), 7.5);
    });
    ctx.y -= 12;
    const derechaT = PAGE_WIDTH - MARGIN; const derechaE = derechaT - ANCHO_COL;
    const derecha = (texto, xDerecha, y, opciones) => {
      const f = opciones.bold ? ctx.fontBold : ctx.font;
      this._texto(ctx, texto, xDerecha - f.widthOfTextAtSize(limpiar(texto), opciones.size), y, opciones);
    };
    derecha('E', derechaE, ctx.y - 3, { size: 8, bold: true, color: GRIS });
    derecha('T', derechaT, ctx.y - 3, { size: 8, bold: true, color: GRIS });
    ctx.y -= 12;
    const anchoNombre = Math.min(TOPE_NOMBRE, Math.max(...filas.map(f => ctx.font.widthOfTextAtSize(limpiar(f.nombre), 7.5))));
    const maximo = Math.max(1, ...filas.map(f => f.asignados));
    // Se reserva el ancho de la cantidad más larga para que el número del extremo no invada la columna E.
    const reservaCant = Math.max(...filas.map(f => ctx.font.widthOfTextAtSize(String(Math.max(f.asignados, f.entregados || 0)), 7.5))) + 12;
    const x0 = MARGIN + anchoNombre + 8; const anchoPista = derechaE - ANCHO_COL - x0 - reservaCant;
    filas.forEach((f) => {
      this._espacio(ctx, FILA);
      const nombre = this._ajustar(ctx, f.nombre, anchoNombre, 7.5);
      const yA = ctx.y - 10; const yE = ctx.y - 19;
      this._texto(ctx, nombre, MARGIN + anchoNombre - ctx.font.widthOfTextAtSize(limpiar(nombre), 7.5), f.sinAsignar ? yA + 1.2 : ctx.y - 13, { size: 7.5 });
      const escala = (n) => (n > 0 ? Math.max(n / maximo * anchoPista, 1.5) : 0);
      {
        const anchoA = escala(f.asignados);
        ctx.page.drawRectangle({ x: x0, y: yA, width: anchoA, height: ALTO_BARRA, color: f.sinAsignar ? COLOR_DIS_SIN_ASIGNAR : COLOR_DIS_ASIGNADOS });
        this._texto(ctx, String(f.asignados), x0 + anchoA + 4, yA + 1.2, { size: 7.5 });
        if (f.sinAsignar) { ctx.y -= FILA; return; }
        // Entregados en dos tramos con un hueco de 1,5 pt: a tiempo y tarde, esta con su cantidad (mínimo para que quepa la cifra, incluso un 1).
        const anchoTotal = escala(f.entregados);
        const n = String(f.tarde); const wN = ctx.fontBold.widthOfTextAtSize(n, 6.5);
        const anchoTarde = f.tarde > 0 ? Math.max(f.tarde / maximo * anchoPista, wN + 4) : 0;
        const anchoBase = Math.max(anchoTotal - anchoTarde - (anchoTarde ? HUECO : 0), 0);
        if (anchoBase > 0) ctx.page.drawRectangle({ x: x0, y: yE, width: anchoBase, height: ALTO_BARRA, color: COLOR_DIS_ATIEMPO });
        const xTarde = x0 + anchoBase + (anchoBase ? HUECO : 0);
        if (anchoTarde > 0) {
          ctx.page.drawRectangle({ x: xTarde, y: yE, width: anchoTarde, height: ALTO_BARRA, color: COLOR_DIS_TARDE });
          this._texto(ctx, n, xTarde + (anchoTarde - wN) / 2, yE + 1.6, { size: 6.5, bold: true, color: BLANCO });
        }
        this._texto(ctx, String(f.entregados), xTarde + anchoTarde + 4, yE + 1.2, { size: 7.5 });
      }
      derecha(conSimboloPorcentaje(f.efectividad), derechaE, ctx.y - 13, { size: 7.5, ...resaltaE(f) });
      derecha(conSimboloPorcentaje(f.tardias), derechaT, ctx.y - 13, { size: 7.5, ...resaltaT(f) });
      ctx.y -= FILA;
    });
    if (notaFinal) this._texto(ctx, notaFinal, MARGIN, ctx.y - 4, { size: 7, color: GRIS });
    ctx.y -= notaFinal ? 18 : 8;
  }

  // Pie de la última página de todo reporte: dos líneas de firma, la de quien lo imprimió (con su nombre) y la de su jefe inmediato.
  _firmas(ctx, generadoPor) {
    const y = 40;
    const ancho = (CONTENT_WIDTH - 60) / 2;
    [[MARGIN, generadoPor || ' '], [MARGIN + ancho + 60, 'Jefe Inmediato']].forEach(([x, rotulo]) => {
      ctx.page.drawLine({ start: { x, y }, end: { x: x + ancho, y }, thickness: 0.8, color: NEGRO });
      const w = ctx.fontBold.widthOfTextAtSize(limpiar(rotulo), 7);
      this._texto(ctx, rotulo, x + (ancho - w) / 2, y - 10, { size: 7, bold: true });
    });
  }

  _nuevaPagina(ctx) {
    ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN;
  }

  _espacio(ctx, alto) {
    if (ctx.y - alto < LIMITE_INFERIOR) this._nuevaPagina(ctx);
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
    this._texto(ctx, TITULOS_PDF[reporte.tipo] || TITULOS_PDF.actividad, x0 + 30, ctx.y - 9, { size: 12, bold: true });
    this._texto(ctx, reporte.titulo, x0 + 30, ctx.y - 20, { size: 8.5, color: GRIS });
    const derecha = [reporte.periodo.titulo || `Período: ${reporte.periodo.etiqueta}`, `Generado: ${ahora}${generadoPor ? ` por ${generadoPor}` : ''}`];
    // «Fecha de entrega: …» (reportes de actividad) va en negrita; se mide con la fuente en negrita para alinearla a la derecha.
    const negritaFecha = !!reporte.periodo.titulo;
    derecha.forEach((linea, i) => {
      const negrita = negritaFecha && i === 0;
      const t = this._ajustar(ctx, linea, 330, 7.5, negrita);
      const fuente = negrita ? ctx.fontBold : ctx.font;
      this._texto(ctx, t, PAGE_WIDTH - MARGIN - fuente.widthOfTextAtSize(t, 7.5), ctx.y - 9 - i * 10, negrita ? { size: 7.5, bold: true } : { size: 7.5, color: GRIS });
    });
    ctx.y -= 28;
    // «Agrupar por» no aplica al reporte de rendimiento.
    const filtrosVisibles = (reporte.resumenFiltros || []).filter(t => reporte.tipo !== 'rendimiento' || !/^Agrupado por/.test(t));
    if (filtrosVisibles.length) {
      // Reportes 2: la línea de filtros va en negrita (antes, resaltada en amarillo); se mide con la fuente en negrita para que quepa.
      const destacar = String(reporte.tipo).startsWith('actividad-');
      // Las líneas se parten por palabras: una barra elegida y filtros largos se imprimen completos, no recortados con «…».
      const fuente = destacar ? ctx.fontBold : ctx.font;
      const partir = (partes) => {
        const salida = [];
        let actual = '';
        for (const palabra of partes.join('  ·  ').split(' ')) {
          const prueba = actual ? `${actual} ${palabra}` : palabra;
          if (actual && fuente.widthOfTextAtSize(limpiar(prueba), 7.5) > CONTENT_WIDTH) { salida.push(actual); actual = palabra; } else actual = prueba;
        }
        if (actual) salida.push(actual);
        return salida;
      };
      // «Filtrado por» (barra elegida, urgentes, estado) va en su propia línea, debajo de la selección de los combos.
      const esFiltrado = (t) => /^Filtrado por/.test(t);
      const lineas = [...partir(filtrosVisibles.filter(t => !esFiltrado(t))), ...partir(filtrosVisibles.filter(esFiltrado))];
      lineas.forEach((linea, i) => this._texto(ctx, linea, MARGIN, ctx.y - 5 - i * 10, destacar ? { size: 7.5, bold: true } : { size: 7.5, color: GRIS }));
      ctx.y -= 13 + (lineas.length - 1) * 10;
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
  // Una celda es texto o un semáforo `{ semaforo }` (el atraso).
  _tabla(ctx, columnas, filas, { altoFila = 14, tamano = 7.5, altoCabecera = 14, resaltadas = [] } = {}) {
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
    filas.forEach((fila, indice) => {
      if (ctx.y - altoFila < LIMITE_INFERIOR) { this._nuevaPagina(ctx); cabecera(); }
      // Fila resaltada (entregado con atraso): amarillo fluorescente al 60 % de opacidad, detrás del texto.
      if (resaltadas.includes(indice)) ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - altoFila, width: CONTENT_WIDTH, height: altoFila, color: rgb(1, 1, 0), opacity: 0.6 });
      let x = MARGIN;
      fila.forEach((celda, i) => {
        if (celda && celda.semaforo) {
          this._dibujarSemaforo(ctx, celda.semaforo, x + 2, anchos[i] - 4, tamano, altoFila);
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

  // Secciones del período (atrasados, no entregados y entregados): en cada una, cada persona (o taller/tienda) con sus vales, del más urgente al menos.
  _secciones(ctx, reporte) {
    const g = reporte.grupos;
    const nombre = { asesor: 'ASESOR', disenador: 'DISEÑADOR', taller: 'TALLER', tienda: 'TIENDA' }[g.agruparPor];
    const esTaller = reporte.rol === 'encargado';
    const hayVales = SECCIONES_PDF.some(sec => g.secciones[sec.clave].total > 0);
    // Filtro solo con atrasados anteriores: ya se imprimieron arriba, no hay nada vacío que avisar.
    if (!hayVales && reporte.filtroDesglose && reporte.atrasadosVigentes && reporte.atrasadosVigentes.total) return;
    if (!hayVales) {
      this._titulo(ctx, `VALES POR ${nombre} (0)`);
      // Con filtro del desglose el vacío es del filtro, no del período.
      this._texto(ctx, reporte.filtroDesglose ? 'Ningún vale cumple el filtro del desglose.' : 'No hubo vales con entrega en este período.', MARGIN, ctx.y - 8, { size: 9, color: GRIS });
      ctx.y -= 20;
      return;
    }
    if (g.desgloseOmitido) {
      this._titulo(ctx, `VALES POR ${nombre} (${g.totalVales})`);
      TEXTO_DESGLOSE_OMITIDO(g.totalVales).forEach((linea, i) => this._texto(ctx, linea, MARGIN, ctx.y - 8 - i * 12, { size: 9, color: GRIS }));
      ctx.y -= 32;
      return;
    }
    for (const sec of SECCIONES_PDF) {
      const datos = g.secciones[sec.clave];
      if (!datos.total) continue;
      // Los reportes de actividad de Reportes 2 renombran estas secciones; Actividad y Rendimiento conservan sus títulos.
      // En el reporte de diseñadores «Sin entregar» se llama «Por vencer».
      const titulo = (String(reporte.tipo).startsWith('actividad-') && TITULOS_REPORTES2[sec.clave]) || sec.titulo;
      this._titulo(ctx, `${titulo} (${datos.total})`);
      this._gruposPdf(ctx, datos.grupos, sec.clave, esTaller);
    }
  }

  // Parte un texto en líneas por palabras para que quepa en `ancho` (nunca se recorta con «…»).
  _partirEnLineas(ctx, texto, ancho, size, bold = false) {
    const fuente = bold ? ctx.fontBold : ctx.font;
    const lineas = [];
    let actual = '';
    for (const palabra of String(texto).split(' ')) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (actual && fuente.widthOfTextAtSize(limpiar(prueba), size) > ancho) { lineas.push(actual); actual = palabra; } else actual = prueba;
    }
    if (actual) lineas.push(actual);
    return lineas;
  }

  // Cada persona (o taller/tienda) con sus vales. «Atraso» solo en las secciones de atrasados; «Con atraso» solo en entregados, donde la
  // fila completa se remarca si se entregó con atraso.
  _gruposPdf(ctx, grupos, clave, esTaller) {
    const columnas = [
      { label: 'Vale', ancho: 1.8 }, ...(esTaller ? [{ label: 'Ingreso', ancho: 1.3 }] : []), { label: 'Estado', ancho: 2.6 },
      { label: 'Entrega', ancho: 1, centro: true },
      ...(clave === 'atrasados' ? [{ label: 'Atraso', ancho: 1, centro: true }] : []),
      ...(clave === 'entregados' ? [{ label: 'Con atraso', ancho: 1.1, centro: true }] : [])
    ];
    const ingreso = (v) => {
      const [fecha, hora] = String(v.creadoEn).split(' ');
      return `${formatear(fecha, 'fecha')} ${(hora || '').slice(0, 5)}`;
    };
    for (const grupo of grupos) {
      const resumen = `${grupo.total} vale${grupo.total === 1 ? '' : 's'}`;
      // El nombre del grupo se imprime completo: si no cabe en la columna de 200 pt (varios diseñadores o talleres), se parte en líneas y el conteo pasa al borde derecho.
      const cabe = ctx.fontBold.widthOfTextAtSize(limpiar(grupo.nombre), 9) <= 200;
      const lineasNombre = cabe ? [grupo.nombre] : this._partirEnLineas(ctx, grupo.nombre, CONTENT_WIDTH - 110, 9, true);
      const alto = 18 + (lineasNombre.length - 1) * 11;
      this._espacio(ctx, 62 + alto);
      ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - alto, width: CONTENT_WIDTH, height: alto, color: FONDO_CABECERA });
      lineasNombre.forEach((linea, i) => this._texto(ctx, linea, MARGIN + 6, ctx.y - 13 - i * 11, { size: 9, bold: true }));
      const xResumen = cabe ? MARGIN + 214 : PAGE_WIDTH - MARGIN - 6 - ctx.font.widthOfTextAtSize(limpiar(resumen), 7.5);
      this._texto(ctx, resumen, xResumen, ctx.y - 13, { size: 7.5, color: GRIS });
      ctx.y -= alto + 4;
      const filas = grupo.vales.map(v => [
        `${v.correlativo}${v.esMod && !/^MOD\d*-/.test(v.correlativo) ? ' (MOD)' : ''}`,
        ...(esTaller ? [ingreso(v)] : []),
        celdaEstado(v.pipeline),
        formatear(v.fechaEntrega, 'fecha'),
        ...(clave === 'atrasados' ? [semaforoAtraso(v)] : []),
        ...(clave === 'entregados' ? [v.diasTarde > 0 ? { semaforo: { texto: `Sí · ${v.diasTarde}d`, tono: 'rojo' } } : 'No'] : [])
      ]);
      const resaltadas = clave === 'entregados' ? grupo.vales.map((v, i) => (v.diasTarde > 0 ? i : -1)).filter(i => i >= 0) : [];
      this._tabla(ctx, columnas, filas, { altoFila: 22, tamano: 7.5, resaltadas });
    }
  }

  // Tabla comparativa del reporte de rendimiento, con fila de totales. Taller: Asignados, Entregados, % efectividad, % a tiempo,
  // Entregas tarde y Sin entregar; Supervisor: creados, autorizados, % de autorización, recibidos sin/con atraso y sin recibir.
  _tablaRendimiento(ctx, r) {
    const [serieA, serieB] = r.series;
    this._titulo(ctx, r.clave === 'disenadores' ? 'COMPARATIVO POR DISEÑADOR' : 'COMPARATIVO POR PERSONA');
    const pct = (a, b) => (a > 0 ? `${Math.round((b / a) * 100)} %` : '-');
    const esTaller = r.clave === 'disenadores';
    const columnas = esTaller
      ? [
        { label: r.persona || 'Persona', ancho: 2.4 }, { label: serieA.etiqueta, ancho: 1, centro: true }, { label: serieB.etiqueta, ancho: 1, centro: true },
        { label: '% efect.', ancho: 1, centro: true }, { label: '% a tiempo', ancho: 1.1, centro: true }, { label: 'Entregas tarde', ancho: 1.2, centro: true },
        { label: 'Sin entregar', ancho: 1.1, centro: true }
      ]
      : [
        { label: r.persona || 'Persona', ancho: 2 }, { label: serieA.etiqueta, ancho: 1, centro: true }, { label: serieB.etiqueta, ancho: 1.1, centro: true },
        { label: '% autoriz.', ancho: 1.1, centro: true }, { label: '% a tiempo', ancho: 1.1, centro: true }, { label: 'Recib. sin atraso', ancho: 1.7, centro: true },
        { label: 'Recib. con atraso', ancho: 1.7, centro: true }, { label: 'Sin recibir', ancho: 1.1, centro: true }
      ];
    // En la fila de total los porcentajes van en guion (sumar porcentajes de personas confunde; los contadores dan el global).
    const fila = (nombre, f, esTotal = false) => (esTaller
      ? [nombre, String(f.a), String(f.b), esTotal ? '-' : celdaPct(f.b, f.a), esTotal ? '-' : celdaPct(f.b - f.tarde, f.b), celdaConteo(f.tarde, 'ambar'), celdaConteo(f.sinEntregar, 'rojo')]
      : [nombre, String(f.a), String(f.b), esTotal ? '-' : pct(f.a, f.b), esTotal ? '-' : pct(f.recibidosATiempo + f.recibidosTarde, f.recibidosATiempo), String(f.recibidosATiempo), celdaConteo(f.recibidosTarde, 'ambar'), celdaConteo(f.sinRecibir, 'rojo')]);
    const filas = (r.sinAsignar ? [r.sinAsignar, ...r.filas] : r.filas).map(f => fila(f.nombre, f));
    filas.push(fila('TOTAL', r.totales, true));
    this._tabla(ctx, columnas, filas, { altoFila: 16, tamano: 8 });
  }

  // Barras dobles por persona (diseñadores: asignados vs entregados; asesores: creados vs autorizados).
  _grafica(ctx, grafica) {
    if (!grafica.filas.length) return;
    this._titulo(ctx, grafica.titulo.toUpperCase());
    const [serieA, serieB] = grafica.series;
    // Leyenda
    this._espacio(ctx, 18);
    let x = MARGIN;
    [[serieA, COLOR_SERIE_A], [serieB, COLOR_SERIE_B]].forEach(([serie, color]) => {
      ctx.page.drawRectangle({ x, y: ctx.y - 9, width: 8, height: 8, color });
      this._texto(ctx, serie.etiqueta, x + 12, ctx.y - 8, { size: 8, color: GRIS_TEXTO });
      x += 12 + ctx.font.widthOfTextAtSize(limpiar(serie.etiqueta), 8) + 18;
    });
    this._texto(ctx, `% = ${serieB.etiqueta.toLowerCase()} entre ${serieA.etiqueta.toLowerCase()}`, x, ctx.y - 8, { size: 7.5, color: GRIS });
    ctx.y -= 18;
    const anchoNombre = 140;
    const x0 = MARGIN + anchoNombre + 6;
    const anchoMax = CONTENT_WIDTH - anchoNombre - 6 - 62;
    const maximo = Math.max(1, ...grafica.filas.map(f => Math.max(f.a, f.b)));
    for (const f of grafica.filas) {
      this._espacio(ctx, 24);
      this._texto(ctx, this._ajustar(ctx, f.nombre, anchoNombre, 8, true), MARGIN, ctx.y - 14, { size: 8, bold: true, color: f.a === 0 ? GRIS : NEGRO });
      [[f.a, COLOR_SERIE_A, 0], [f.b, COLOR_SERIE_B, 1]].forEach(([valor, color, i]) => {
        const y = ctx.y - 10 - i * 9;
        ctx.page.drawRectangle({ x: x0, y, width: anchoMax, height: 6, color: FONDO_CABECERA });
        if (valor > 0) ctx.page.drawRectangle({ x: x0, y, width: Math.max(2, (valor / maximo) * anchoMax), height: 6, color });
        this._texto(ctx, String(valor), x0 + anchoMax + 6, y - 1, { size: 7.5, bold: true });
      });
      // En el de diseñadores, el % de efectividad lleva el color de los contadores (rojo < 50 %, ámbar < 90 %).
      const n = f.a > 0 ? Math.round((f.b / f.a) * 100) : null;
      const pct = n == null ? '-' : `${n} %`;
      const tono = grafica.clave === 'disenadores' ? tonoPct(n) : null;
      const fuente = tono ? ctx.fontBold : ctx.font;
      this._texto(ctx, pct, PAGE_WIDTH - MARGIN - fuente.widthOfTextAtSize(pct, 8), ctx.y - 14, { size: 8, bold: !!tono, color: tono ? COLOR_SEMAFORO[tono] : GRIS_TEXTO });
      ctx.y -= 24;
    }
    ctx.y -= 6;
  }

  // «Atrasados vigentes»: vales atrasados y abiertos con entrega fuera del período, del más atrasado al menos.
  _vigentes(ctx, av, esTaller = false, titulo = 'ATRASADOS ANTES DEL PERÍODO') {
    this._titulo(ctx, `${titulo} (${av.total})`);
    if (av.grupos) {
      // Agrupados como las demás secciones (por diseñador, asesor, taller o tienda), del más atrasado al menos.
      this._gruposPdf(ctx, av.grupos, 'atrasados', esTaller);
      if (av.truncado) { this._texto(ctx, `Se muestran los ${av.grupos.reduce((s, g) => s + g.vales.length, 0)} más atrasados de ${av.total}.`, MARGIN, ctx.y - 2, { size: 8, color: GRIS }); ctx.y -= 14; }
      return;
    }
    const conResponsable = av.vales.some(v => v.responsable);
    const columnas = [
      { label: 'Vale', ancho: 1.8 },
      ...(conResponsable ? [{ label: 'Responsable', ancho: 1.7 }] : []),
      { label: 'Estado', ancho: 3 }, { label: 'Entrega', ancho: 1, centro: true }, { label: 'Atraso', ancho: 1, centro: true }
    ];
    const filas = av.vales.map(v => [
      v.esMod && !/^MOD\d*-/.test(v.correlativo) ? `${v.correlativo} (MOD)` : v.correlativo,
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
  // Franja de contadores de la vista Taller (Encargado/Asistente).
  _contadores(ctx, i) {
    const pct = (n) => (n == null ? '-' : `${String(n).replace('.', ',')} %`);
    // Rojo por debajo de 50 %, amarillo por debajo de 90 % (mismo criterio que la pantalla).
    const tono = (n) => (n == null ? NEGRO : (n < 50 ? ROJO : (n < 90 ? AMBAR : NEGRO)));
    const items = [
      ['Entrantes', i.entrantes, NEGRO], ['Entregados', i.entregados, NEGRO], ['Sin entregar', i.sinEntregar, NEGRO],
      ['Atrasados sin entregar', i.atrasadosSinEntregar, i.atrasadosSinEntregar > 0 ? ROJO : NEGRO],
      ['Efectividad', pct(i.efectividad), tono(i.efectividad)], ['A tiempo', pct(i.aTiempo), tono(i.aTiempo)]
    ];
    const size = 8.5; const sep = '  ·  ';
    const ancho = (t) => ctx.fontBold.widthOfTextAtSize(limpiar(t), size);
    let x = MARGIN; let y = ctx.y - 9;
    items.forEach(([etiqueta, valor, color], k) => {
      const texto = `${etiqueta} ${valor}`;
      if (k && x + ancho(sep) + ancho(texto) > MARGIN + CONTENT_WIDTH) { x = MARGIN; y -= 12; ctx.y -= 12; }
      else if (k) { this._texto(ctx, sep, x, y, { size, bold: true, color: GRIS }); x += ancho(sep); }
      this._texto(ctx, texto, x, y, { size, bold: true, color });
      x += ancho(texto);
    });
    ctx.y -= 22;
  }

  _listado(ctx, reporte) {
    const v = reporte.vales;
    if (!v.filas.length) {
      this._titulo(ctx, 'VALES DEL PERÍODO (0)');
      this._texto(ctx, 'No hubo vales con entrega en este período.', MARGIN, ctx.y - 8, { size: 9, color: GRIS });
      ctx.y -= 20;
      return;
    }
    for (const sec of SECCIONES_PDF) {
      const datos = v.secciones[sec.clave];
      if (!datos.total) continue;
      this._titulo(ctx, `${sec.titulo} (${datos.total})`);
      // «Atraso» solo en las secciones de atrasados; «Con atraso» solo en entregados, con la fila remarcada si se entregó con atraso.
      const enAtraso = sec.clave === 'atrasados';
      const entregados = sec.clave === 'entregados';
      const columnas = [
        { label: 'Correlativo', ancho: 1.7 }, { label: 'Estado', ancho: 2.7 }, { label: 'Entrega', ancho: 0.9, centro: true },
        ...(enAtraso ? [{ label: 'Atraso', ancho: 0.9, centro: true }] : []),
        ...(entregados ? [{ label: 'Con atraso', ancho: 1, centro: true }] : []),
        ...v.columnas.map(c => ({ label: c.label, ancho: 1.35, derecha: c.formato === 'horas' }))
      ];
      const filas = datos.filas.map(f => [
        `${f.correlativo}${f.esMod ? ' (MOD)' : ''}`, celdaEstado(f.pipeline),
        `${f.fechaEntrega.slice(8, 10)}/${f.fechaEntrega.slice(5, 7)}`,
        ...(enAtraso ? [semaforoAtraso(f)] : []),
        ...(entregados ? [f.diasTarde > 0 ? { semaforo: { texto: `Sí · ${f.diasTarde}d`, tono: 'rojo' } } : 'No'] : []),
        ...v.columnas.map(c => formatear(f[c.clave], c.formato))
      ]);
      const resaltadas = entregados ? datos.filas.map((f, i) => (f.diasTarde > 0 ? i : -1)).filter(i => i >= 0) : [];
      this._tabla(ctx, columnas, filas, { altoFila: 22, tamano: 7.5, resaltadas });
    }
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
