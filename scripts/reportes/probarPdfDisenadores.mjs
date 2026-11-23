// Prueba del PDF del reporte de actividad de diseñadores (franja con Efectividad y Entregas a tiempo, y gráfica por diseñador con columnas E y T).
// Genera PDF de prueba en memoria, decodifica sus flujos de contenido y comprueba textos, colores y que nada se salga de los márgenes.
// NO renderiza el PDF a imagen: el aspecto se revisa a ojo. Sin base de datos ni servidor. Sale con código distinto de 0 si algo falla:
//   node scripts/reportes/probarPdfDisenadores.mjs
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const require = createRequire(raiz + '/package.json');
const pdfSvc = require(raiz + '/src/modules/vales/services/valeReportePdfService.js');
const C = require(raiz + '/src/modules/vales/services/valeReporteContadores.js');
const { PDFDocument, StandardFonts, PDFName, PDFArray, decodePDFRawStream } = require(raiz + '/node_modules/pdf-lib');

const ANCHO = 612; const ALTO = 792; const MARGEN = 36; const TOL = 0.05;
const AZUL = [37 / 255, 99 / 255, 235 / 255]; const MARINO = [22 / 255, 163 / 255, 74 / 255]; const ROJO = [220 / 255, 38 / 255, 38 / 255];
const igual = (a, b) => a && a.every((v, i) => Math.abs(v - b[i]) < 0.002);

// ---- inspección del PDF -------------------------------------------------------------------------------------------------------------
const medidor = await PDFDocument.create();
const fuentesMedida = { normal: await medidor.embedFont(StandardFonts.Helvetica), negrita: await medidor.embedFont(StandardFonts.HelveticaBold) };

async function inspeccionar(buffer) {
  const doc = await PDFDocument.load(buffer);
  const paginas = doc.getPages().map((pagina) => {
    const fuentes = {};
    const dic = pagina.node.Resources().lookup(PDFName.of('Font'));
    for (const [nombre, ref] of dic.dict.entries()) fuentes[nombre.decodeText()] = doc.context.lookup(ref).lookup(PDFName.of('BaseFont')).decodeText();
    const c = pagina.node.Contents();
    const flujos = c instanceof PDFArray ? c.asArray().map(r => doc.context.lookup(r)) : [c];
    const contenido = flujos.map(f => Buffer.from(decodePDFRawStream(f).decode()).toString('latin1')).join('\n');
    const pila = []; let e = { tx: 0, ty: 0, fill: [0, 0, 0] };
    let puntos = []; let fuente = null; let tam = 0; let pos = [0, 0];
    const rects = []; const lineas = []; const textos = [];
    for (const l of contenido.split('\n').map(s => s.trim()).filter(Boolean)) {
      const p = l.split(/\s+/); const op = p[p.length - 1];
      if (op === 'q') pila.push({ ...e });
      else if (op === 'Q') e = pila.pop();
      else if (op === 'cm') { e.tx += Number(p[4]); e.ty += Number(p[5]); }
      else if (op === 'rg') e.fill = p.slice(0, 3).map(Number);
      else if (op === 'm' || op === 'l') puntos.push([Number(p[0]) + e.tx, Number(p[1]) + e.ty]);
      else if (op === 'f' || op === 'S') {
        const xs = puntos.map(q => q[0]); const ys = puntos.map(q => q[1]);
        const caja = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), fill: e.fill };
        (op === 'f' ? rects : lineas).push(caja); puntos = [];
      } else if (op === 'Tf') { fuente = fuentes[p[0].slice(1)]; tam = Number(p[1]); }
      else if (op === 'Tm') pos = [Number(p[4]) + e.tx, Number(p[5]) + e.ty];
      else if (op === 'Tj') {
        const texto = Buffer.from(l.replace(/^<|>\s*Tj$/g, ''), 'hex').toString('latin1');
        const negrita = /Bold/.test(fuente);
        const ancho = fuentesMedida[negrita ? 'negrita' : 'normal'].widthOfTextAtSize(texto, tam);
        textos.push({ texto, x: pos[0], y: pos[1], size: tam, negrita, fill: e.fill, ancho });
      }
    }
    return { rects, lineas, textos };
  });
  return { paginas, textos: paginas.flatMap(p => p.textos), rects: paginas.flatMap(p => p.rects) };
}

// Todo lo dibujado queda entre los márgenes laterales y dentro de la página (el pie de página va a 18 pt y es lo único por debajo del margen inferior).
function dentroDeMargenes(info, etiqueta) {
  info.paginas.forEach((pag, i) => {
    const donde = `${etiqueta} p${i + 1}`;
    for (const r of [...pag.rects, ...pag.lineas]) {
      assert.ok(r.x0 >= MARGEN - TOL && r.x1 <= ANCHO - MARGEN + TOL, `${donde}: figura fuera de margen X ${r.x0.toFixed(1)}-${r.x1.toFixed(1)}`);
      assert.ok(r.y0 >= MARGEN - 10 - TOL && r.y1 <= ALTO - MARGEN + 6 + TOL, `${donde}: figura fuera de margen Y ${r.y0.toFixed(1)}-${r.y1.toFixed(1)}`);
    }
    for (const t of pag.textos) {
      if (/^Vales de Arte/.test(t.texto)) continue;
      assert.ok(t.x >= MARGEN - TOL && t.x + t.ancho <= ANCHO - MARGEN + TOL, `${donde}: texto fuera de margen X «${t.texto}» ${t.x.toFixed(1)}-${(t.x + t.ancho).toFixed(1)}`);
      assert.ok(t.y >= MARGEN - 10 - TOL && t.y <= ALTO - MARGEN + TOL, `${donde}: texto fuera de margen Y «${t.texto}» ${t.y.toFixed(1)}`);
    }
  });
}

// ---- datos de prueba ----------------------------------------------------------------------------------------------------------------
const d = (id, nombre, asignados, entregados, tarde) => ({
  id, nombre, asignados, entregados, tarde,
  efectividad: asignados ? Math.round(entregados / asignados * 10000) / 100 : null,
  tardias: entregados ? Math.round(tarde / entregados * 10000) / 100 : null
});
let n = 0;
const vale = (extra) => ({ id: ++n, correlativo: `V-${n}`, esMod: false, urgente: false, autorizado: true, creadoEn: '2026-10-01 09:00:00', fechaEntrega: '2026-10-20', pipeline: { pasos: ['A', 'B', 'C'], paso: 2, terminado: false }, ...extra });
const seccion = (vales, nombre = 'Ana', id = 1) => ({ total: vales.length, grupos: vales.length ? [{ id, nombre, total: vales.length, vales }] : [] });
const gruposVacios = () => ({ agruparPor: 'disenador', desgloseOmitido: false, totalVales: 0, secciones: { atrasados: seccion([]), noEntregados: seccion([]), entregados: seccion([]) } });
const gruposConVales = () => {
  const compartido = vale({ diasTarde: 2 });
  return { agruparPor: 'disenador', desgloseOmitido: false, totalVales: 4, secciones: { atrasados: seccion([vale({ atrasado: true, diasAtraso: 3 })]), noEntregados: seccion([vale({})]), entregados: seccion([compartido, vale({ diasTarde: 0 })]) } };
};
const contadoresDis = (lista, extra = {}) => ({
  ingresados: 10, urgentes: { total: 2, porcentaje: 33.333 }, sinEntregar: 3, atrasados: { total: 2, anteriores: 1, actuales: 1 },
  recibidos: { total: 6, conAtraso: 2, sinAtraso: 4 }, efectividad: 60, aTiempo: 66.6666, porTienda: [{ id: 1, nombre: 'T1', total: 10, urgentes: 2 }],
  porDisenador: lista, porGrupo: {}, ...extra
});
const reporteDis = (lista, extra = {}, contExtra = {}) => ({
  tipo: 'actividad-disenador', rol: 'disenador', titulo: 'Actividad de diseñadores', periodo: { etiqueta: 'Octubre 2026', titulo: 'Fecha de entrega: Octubre 2026' },
  resumenFiltros: ['Diseñadores: Todos'], evaluados: [], tablas: [], incluirDesglose: true,
  contadores: contadoresDis(lista, contExtra), grupos: gruposConVales(), ...extra
});
const generar = (r) => pdfSvc.generar(r, { generadoPor: 'Prueba', ahora: '21/11/2026 10:00' });

let checks = 0;
const prueba = async (nombre, fn) => { await fn(); checks++; console.log('OK  ', nombre); };
const tiene = (info, texto, msg) => assert.ok(info.textos.some(t => t.texto === texto), msg || `falta el texto «${texto}»`);
const tieneParte = (info, parte) => assert.ok(info.textos.some(t => t.texto.includes(parte)), `falta un texto con «${parte}»`);
const alturas = (info) => info.rects.filter(r => igual(r.fill, [0.95, 0.96, 0.97]) && Math.abs(r.x1 - r.x0 - (ANCHO - MARGEN * 2)) < 0.1).map(r => Math.round(r.y1 - r.y0));
const PORCENTAJE = /^\d+(\.\d{1,2})? %$/;

function afirmarGrafica(info, lista, etiqueta) {
  tiene(info, 'VALES ASIGNADOS Y ENTREGADOS POR DISEÑADOR');
  for (const t of ['Asignados', 'Entregados a tiempo', 'Entregados tarde', 'E', 'T']) tiene(info, t);
  // Leyenda de letras: E y T en negrita, sin el cálculo.
  assert.ok(info.textos.some(t => t.texto === 'E' && t.negrita && t.size === 7.5), 'la E de la leyenda va en negrita');
  assert.ok(info.textos.some(t => t.texto === 'T' && t.negrita && t.size === 7.5), 'la T de la leyenda va en negrita');
  assert.ok(info.textos.some(t => /= Efectividad/.test(t.texto)) && info.textos.some(t => /= Entregas tardías/.test(t.texto)), 'falta el significado de E y T');
  assert.ok(!info.textos.some(t => /entregas tarde ÷|entregados ÷ asignados/.test(t.texto)), 'la leyenda no lleva el cálculo');
  assert.ok(info.textos.map(t => t.texto).join(' ').includes('Un vale compartido cuenta en cada diseñador que lo trabaja y se entrega, o se atrasa, para todos ellos a la vez; por eso la suma de los diseñadores puede superar los totales.'), 'la nota de la gráfica va impresa (ajustada en líneas bajo el título)');
  // Las tres series con los colores de pantalla.
  assert.ok(info.rects.some(r => igual(r.fill, AZUL)), 'falta una barra azul de Asignados');
  assert.ok(info.rects.some(r => igual(r.fill, MARINO)), 'falta una barra verde (a tiempo)');
  // La cantidad de tarde va dentro de su segmento rojo, en blanco, también cuando es 1.
  const rojos = info.rects.filter(r => igual(r.fill, ROJO));
  for (const f of lista.slice(0, 10).filter(x => x.tarde > 0)) {
    const dentro = info.textos.some(t => t.texto === String(f.tarde) && t.negrita && t.size === 6.5 && igual(t.fill, [1, 1, 1])
      && rojos.some(r => t.x >= r.x0 - TOL && t.x + t.ancho <= r.x1 + TOL && t.y >= r.y0 - TOL && t.y <= r.y1));
    assert.ok(dentro, `${etiqueta}: falta la cantidad ${f.tarde} dentro de su segmento rojo (${f.nombre})`);
  }
  // Las barras y las cantidades no invaden las columnas E y T.
  const limite = ANCHO - MARGEN - 92;
  for (const r of info.rects.filter(r => [AZUL, MARINO, ROJO].some(c => igual(r.fill, c)) && r.y1 - r.y0 < 10)) assert.ok(r.x1 <= limite + TOL, `${etiqueta}: una barra invade la columna E`);
  // Los nombres de la lista salen completos (o con «...» por el tope) y el nombre del id 0 se imprime como cualquier otro.
  for (const f of lista.slice(0, 10)) assert.ok(info.textos.some(t => t.texto === f.nombre || (t.texto.endsWith('...') && f.nombre.startsWith(t.texto.slice(0, -3)))), `${etiqueta}: falta el nombre ${f.nombre}`);
  // Porcentajes: como mucho dos decimales y con « %»; los nulos salen con guion (el PDF sustituye la raya larga).
  for (const t of info.textos.filter(t => / %$/.test(t.texto))) assert.match(t.texto, PORCENTAJE, `porcentaje mal formado «${t.texto}»`);
  assert.ok(!info.textos.some(t => /\d\.\d{3,}/.test(t.texto)), 'hay un número con más de dos decimales');
}

// ---- (a) tres diseñadores, uno con vale compartido, entregas tarde y el id 0 ------------------------------------------------------------
const listaA = [d(1, 'Ana Pérez', 6, 4, 2), d(2, 'Beto López', 5, 3, 1), d(0, 'Sin diseñador asignado', 1, 0, 0)];
let infoA;
await prueba('(a) 3 diseñadores: franja de tres filas, gráfica, colores, cantidad roja, márgenes', async () => {
  const buf = await generar(reporteDis(listaA));
  infoA = await inspeccionar(buf);
  console.log('     páginas:', infoA.paginas.length, '· alto de franja:', alturas(infoA).join(','));
  assert.deepEqual(alturas(infoA).slice(0, 1), [72], 'la franja del reporte de diseñadores mide 72 pt (dos filas, sin Urgentes)');
  for (const t of ['Efectividad', 'Entregas a tiempo', 'Ingresados', 'Por vencer', 'Atrasados', 'Entregados']) tiene(infoA, t);
  assert.ok(!infoA.textos.some(t => t.texto === 'Urgentes'), 'el reporte de diseñadores no lleva el contador de Urgentes');
  // Primera fila: Ingresados · Por vencer · Efectividad · Entregas a tiempo, en ese orden y a la misma altura.
  const xDe = (texto) => infoA.textos.find(t => t.texto === texto);
  const fila1 = ['Ingresados', 'Por vencer', 'Efectividad', 'Entregas a tiempo'].map(xDe);
  assert.ok(fila1.every((t, k) => t && Math.abs(t.y - fila1[0].y) < 0.5 && (k === 0 || t.x > fila1[k - 1].x)), 'primera fila: Ingresados, Por vencer, Efectividad, Entregas a tiempo');
  tiene(infoA, '60 %', 'valor de Efectividad'); tiene(infoA, '66.67 %', 'valor de Entregas a tiempo (2 decimales)');
  tiene(infoA, '6 de 10 vales entregados (1 atrasado)'); tiene(infoA, '4 de 6 entregas');
  afirmarGrafica(infoA, listaA, '(a)');
  assert.ok(!infoA.textos.some(t => /^Otros \(/.test(t.texto)), 'con 3 diseñadores no hay fila «Otros»');
  // Valores por diseñador en E y T.
  for (const t of ['66.67 %', '60 %', '50 %', '33.33 %']) tiene(infoA, t);
  // Sin diseñador asignado: una sola barra (la de asignados), sin segunda barra verde y sin E ni T, con el nombre a la altura de su barra.
  const sin = infoA.textos.find(t => t.texto === 'Sin diseñador asignado');
  assert.ok(sin, 'falta el nombre de Sin diseñador asignado');
  assert.ok(!infoA.textos.some(t => / %$/.test(t.texto) && Math.abs(t.y - sin.y) < 10), 'Sin diseñador asignado no lleva E ni T');
  assert.ok(!infoA.rects.some(r => igual(r.fill, MARINO) && Math.abs(r.y0 - (sin.y - 10.2)) < 1.5), 'Sin diseñador asignado no lleva la segunda barra');
  assert.ok(infoA.rects.some(r => igual(r.fill, [0.85, 0.47, 0.02]) && Math.abs(r.y0 - (sin.y - 1.2)) < 1.5), 'la barra de Sin asignar es ámbar y queda a la altura de su nombre');
  tieneParte(infoA, 'POR VENCER ('); // el desglose sigue después de la gráfica
  dentroDeMargenes(infoA, '(a)');
});

// ---- (b) 12 diseñadores: salen todos, sin fila «Otros» ------------------------------------------------------------------------------------
const listaB = Array.from({ length: 12 }, (_, i) => d(i + 1, `Diseñador número ${i + 1}`, 30 - i, 20 - i, i % 3));
await prueba('(b) 12 diseñadores: salen los 12 con su barra, sin «Otros»', async () => {
  const info = await inspeccionar(await generar(reporteDis(listaB)));
  console.log('     páginas:', info.paginas.length);
  afirmarGrafica(info, listaB, '(b)');
  assert.ok(!info.textos.some(t => t.texto.startsWith('Otros (')), 'ya no hay fila «Otros»');
  for (let n = 1; n <= 12; n += 1) tiene(info, `Diseñador número ${n}`);
  // Una barra azul de asignados por diseñador (los 12).
  const azules = info.rects.filter(r => igual(r.fill, AZUL) && r.y1 - r.y0 < 10 && r.y1 - r.y0 > 6);
  assert.ok(azules.length >= 12, `faltan barras de asignados: ${azules.length}`);
  dentroDeMargenes(info, '(b)');
});

// ---- (c) todo en nulo (período sin vales) ----------------------------------------------------------------------------------------------
await prueba('(c) porcentajes nulos: franja con guiones y sin gráfica', async () => {
  const vacio = reporteDis([], { grupos: gruposVacios() }, { ingresados: 0, urgentes: { total: 0, porcentaje: 0 }, sinEntregar: 0, atrasados: { total: 0, anteriores: 0, actuales: 0 }, recibidos: { total: 0, conAtraso: 0, sinAtraso: 0 }, efectividad: null, aTiempo: null });
  const info = await inspeccionar(await generar(vacio));
  tiene(info, 'Efectividad'); tiene(info, 'Entregas a tiempo'); tiene(info, '0 de 0 vales entregados'); tiene(info, '0 de 0 entregas');
  assert.ok(info.textos.filter(t => t.texto === '-').length >= 2, 'Efectividad y Entregas a tiempo llevan guion');
  assert.ok(!info.textos.some(t => t.texto === 'VALES ASIGNADOS Y ENTREGADOS POR DISEÑADOR'), 'sin diseñadores con asignados no hay gráfica');
  // Con diseñadores pero todos en nulo en E y T: guiones en la gráfica.
  const sinBase = [{ id: 1, nombre: 'Ana', asignados: 2, entregados: 0, tarde: 0, efectividad: null, tardias: null }];
  const info2 = await inspeccionar(await generar(reporteDis(sinBase, {}, { efectividad: null, aTiempo: null })));
  afirmarGrafica(info2, sinBase, '(c2)');
  assert.ok(info2.textos.filter(t => t.texto === '-').length >= 4, 'guiones en la franja y en E y T');
  dentroDeMargenes(info, '(c)'); dentroDeMargenes(info2, '(c2)');
});

// ---- (d) desglose omitido -------------------------------------------------------------------------------------------------------------
await prueba('(d) desgloseOmitido: franja y gráfica generales y el aviso en lugar del desglose', async () => {
  const g = { ...gruposConVales(), desgloseOmitido: true, totalVales: 5000 };
  const info = await inspeccionar(await generar(reporteDis(listaA, { grupos: g })));
  afirmarGrafica(info, listaA, '(d)'); tiene(info, 'Efectividad'); tieneParte(info, 'son demasiados para listarlos');
  dentroDeMargenes(info, '(d)');
});

// ---- (e) desglose enfocado/filtrado ----------------------------------------------------------------------------------------------------
await prueba('(e) desgloseDe y filtroDesglose: la franja y la gráfica siguen siendo las generales', async () => {
  const g = { agruparPor: 'disenador', desgloseOmitido: false, totalVales: 1, secciones: { atrasados: seccion([]), noEntregados: seccion([]), entregados: seccion([vale({ diasTarde: 1 })]) } };
  const info = await inspeccionar(await generar(reporteDis(listaA, { grupos: g, desgloseDe: 'Ana Pérez', filtroDesglose: { estado: 'entregados' }, resumenFiltros: ['Diseñadores: Todos', 'Desglose: Ana Pérez, entregados'] })));
  tiene(info, 'DESGLOSE DE VALES DE ARTE: ANA PÉREZ');
  afirmarGrafica(info, listaA, '(e)'); tiene(info, 'Efectividad'); tiene(info, '66.67 %');
  assert.deepEqual(alturas(info).slice(0, 1), [72]);
  dentroDeMargenes(info, '(e)');
});

// ---- (f) regresión: tiendas y asesores ------------------------------------------------------------------------------------------------
await prueba('(f) tienda y asesor: se generan, la franja sigue en dos filas y no hay gráfica de diseñadores', async () => {
  const base = { rol: 'asesor', periodo: { etiqueta: 'Octubre 2026', titulo: 'Fecha de entrega: Octubre 2026' }, resumenFiltros: [], evaluados: [], tablas: [], incluirDesglose: true, grupos: gruposVacios() };
  const cont = { ingresados: 12, urgentes: { total: 6, porcentaje: 50 }, sinEntregar: 3, atrasados: { total: 2, anteriores: 1, actuales: 1 }, recibidos: { total: 5, conAtraso: 2, sinAtraso: 3 } };
  const tienda = { ...base, tipo: 'actividad-tienda', titulo: 'Tiendas', contadores: { ...cont, porTienda: [{ id: 1, nombre: 'Tienda 1', total: 12, urgentes: 6 }] } };
  const asesor = { ...base, tipo: 'actividad-asesor', titulo: 'Asesores', contadores: { ...cont, porTienda: [], porAsesor: [{ id: 1, nombre: 'Asesor 1', total: 12, urgentes: 6 }] } };
  for (const [r, titulo] of [[tienda, 'VALES INGRESADOS POR TIENDA'], [asesor, 'VALES INGRESADOS POR ASESOR']]) {
    const info = await inspeccionar(await generar(r));
    console.log('     ', r.tipo, 'páginas:', info.paginas.length, '· alto de franja:', alturas(info).join(','));
    assert.deepEqual(alturas(info).slice(0, 1), [72], 'la franja de tiendas/asesores mide 72 pt');
    tiene(info, titulo); tiene(info, '50 %', 'Urgentes con el formato nuevo');
    assert.ok(!info.textos.some(t => t.texto === 'Efectividad' || t.texto === 'Entregas a tiempo'), 'sin tarjetas de diseñadores');
    assert.ok(!info.textos.some(t => /^VALES ASIGNADOS Y ENTREGADOS/.test(t.texto)), 'sin gráfica de diseñadores');
    dentroDeMargenes(info, `(f) ${r.tipo}`);
  }
});

// ---- (g) formato del servidor ---------------------------------------------------------------------------------------------------------
await prueba('formatearPorcentaje / conSimboloPorcentaje del servidor', async () => {
  const casos = [[50, '50', '50 %'], [33.333, '33.33', '33.33 %'], [66.6666, '66.67', '66.67 %'], [0, '0', '0 %'], [null, '—', '—'], [undefined, '—', '—'], [NaN, '—', '—']];
  for (const [v, t, s] of casos) { assert.equal(C.formatearPorcentaje(v), t); assert.equal(C.conSimboloPorcentaje(v), s); }
});

// ---- (h) reporte de talleres: mismo diseño, sin «Sin asignar» y con la nota impresa bajo el título ------------------------------------------
const listaT = [d(3, 'Diseño Central', 8, 6, 1), d(1, 'UV 3D', 5, 5, 0), d(2, 'ProTextil', 2, 1, 0)];
await prueba('(h) talleres: gráfica por taller, nota visible bajo el título, sin «Sin asignar» ni «Urgentes»', async () => {
  const r = reporteDis([], { tipo: 'actividad-taller', rol: 'taller', titulo: 'Actividad de talleres', resumenFiltros: ['Talleres: Todos'] }, {});
  r.contadores = { ...r.contadores, porDisenador: undefined, porTaller: listaT };
  const info = await inspeccionar(await generar(r));
  tiene(info, 'VALES ASIGNADOS Y ENTREGADOS POR TALLER');
  for (const t of ['Diseño Central', 'UV 3D', 'ProTextil']) tiene(info, t);
  assert.ok(!info.textos.some(t => t.texto === 'Urgentes'), 'talleres no lleva Urgentes');
  assert.ok(!info.textos.some(t => t.texto === 'Sin asignar'), 'talleres no lleva Sin asignar');
  // La nota va impresa (no hay hover en el PDF): sus líneas están entre el título y la leyenda de colores.
  const titulo = info.textos.find(t => t.texto === 'VALES ASIGNADOS Y ENTREGADOS POR TALLER');
  const leyenda = info.textos.find(t => t.texto === 'Asignados');
  const lineasNota = info.textos.filter(t => t.y < titulo.y && t.y > leyenda.y && /vale|taller|barras|totales/.test(t.texto));
  assert.ok(lineasNota.length >= 2, 'la nota se imprime en varias líneas bajo el título');
  const textoNota = lineasNota.sort((a, b) => b.y - a.y).map(t => t.texto).join(' ');
  assert.ok(textoNota.includes('cuenta una sola vez en los contadores de arriba') && textoNota.includes('puede ser mayor que los totales'), 'la nota completa está impresa');
  assert.ok(!info.textos.some(t => t.texto.startsWith('Un vale compartido cuenta para cada')), 'no lleva la nota final de diseñadores');
  tieneParte(info, 'POR VENCER (');
  dentroDeMargenes(info, '(h)');
});

// ---- (i) tiendas y asesores: el PDF imprime TODAS las barras (sin «Otras»), como la pantalla desplegada -----------------------------------------
await prueba('(i) 14 tiendas: salen las 14 y no hay fila «Otras»', async () => {
  const porTienda = Array.from({ length: 14 }, (_, k) => ({ id: k + 1, nombre: `Tienda ${k + 1}`, total: 20 - k, urgentes: k % 3 }));
  const r = reporteDis([], { tipo: 'actividad-tienda', rol: 'tienda', titulo: 'Actividad de tiendas', resumenFiltros: ['Todas'] }, {});
  r.contadores = { ...r.contadores, efectividad: undefined, aTiempo: undefined, porDisenador: undefined, porTienda };
  const info = await inspeccionar(await generar(r));
  for (let k = 1; k <= 14; k += 1) tiene(info, `Tienda ${k}`);
  assert.ok(!info.textos.some(t => t.texto.startsWith('Otras (')), 'ya no hay fila «Otras»');
  tiene(info, 'Por vencer'); assert.ok(!info.textos.some(t => t.texto === 'Sin entregar'), 'el rótulo es «Por vencer» también en tiendas');
  dentroDeMargenes(info, '(i)');
});


console.log(`\nTODO OK (${checks} bloques). El PDF NO se vio renderizado: solo se comprobaron textos, colores y márgenes decodificando el contenido.`);
