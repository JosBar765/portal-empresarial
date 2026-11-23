// Lo que se ve en la pantalla es lo que se imprime: textos de las tarjetas, notas de la gráfica y orden/valores de la gráfica por diseñador o taller.
// Compara el PDF (decodificando su contenido) con lo que calcula la pantalla (textos.js, contadoresActividad.js, graficaDisenadores.js). Sin BD ni servidor:
//   node scripts/reportes/probarTextosPantallaPdf.mjs
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFArray, StandardFonts, decodePDFRawStream } from 'pdf-lib';

const require = createRequire(import.meta.url);
const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const C = require(`${raiz}/src/modules/vales/services/valeReporteContadores.js`);
const { NOTA_TALLERES } = require(`${raiz}/src/modules/vales/services/valeReporteTalleres.js`);
const { NOTA_DISENADORES } = require(`${raiz}/src/modules/vales/services/valeReporteDisenadores.js`);
const pdfSvc = require(`${raiz}/src/modules/vales/services/valeReportePdfService.js`);
const cargar = (ruta) => import(pathToFileURL(`${raiz}/${ruta}`).href);
const { TEXTOS_TIENDA, TEXTOS_TALLER, TEXTOS_DISENADOR, TEXTOS_ASESOR } = await cargar('public/modules/vales/js/views/reportes2/textos.js');
const { conSimboloPorcentaje } = await cargar('public/modules/vales/js/utils/formatoPorcentaje.js');
const { filasGraficaDisenadores } = await cargar('public/modules/vales/js/views/reportes2/graficaDisenadores.js');

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; console.log('OK  ', msg); };

// ---- inspección del PDF (como en probarPdfDisenadores.mjs) ---------------------------------------------------------------------------
async function textosDelPdf(buffer) {
  const doc = await PDFDocument.load(buffer);
  const salida = [];
  doc.getPages().forEach((pagina, pi) => {
    const c = pagina.node.Contents();
    const flujos = c instanceof PDFArray ? c.asArray().map(r => doc.context.lookup(r)) : [c];
    const contenido = flujos.map(f => Buffer.from(decodePDFRawStream(f).decode()).toString('latin1')).join('\n');
    let pos = [0, 0]; const pila = []; let e = { tx: 0, ty: 0 };
    for (const l of contenido.split('\n').map(s => s.trim()).filter(Boolean)) {
      const p = l.split(/\s+/); const op = p[p.length - 1];
      if (op === 'q') pila.push({ ...e }); else if (op === 'Q') e = pila.pop();
      else if (op === 'cm') { e.tx += Number(p[4]); e.ty += Number(p[5]); }
      else if (op === 'Tm') pos = [Number(p[4]) + e.tx, Number(p[5]) + e.ty];
      else if (op === 'Tj') salida.push({ texto: Buffer.from(l.replace(/^<|>\s*Tj$/g, ''), 'hex').toString('latin1'), x: pos[0], y: pos[1], pagina: pi });
    }
  });
  return salida;
}
const limpiar = (s) => String(s).normalize('NFC').replace(/—/g, '-').replace(/[^\x20-\x7EÀ-ÿ]/g, '?'); // lo que el PDF puede escribir (WinAnsi)
const tiene = (textos, esperado, msg) => assert.ok(textos.some(t => t.texto === limpiar(esperado)), msg || `el PDF no trae «${esperado}»`);

// ---- 1) funciones de texto: el servidor da lo mismo que la pantalla en todos los casos (0, 1, varios) -----------------------------------------
const casos = [[0, 0], [1, 1], [1, 5], [2, 2], [5, 58], [35, 58], [34, 35], [0, 3]];
for (const [a, b] of casos) {
  assert.equal(C.detalleUrgentes(a, b), TEXTOS_TIENDA.contDetalleUrgentes(a, b), `urgentes ${a}/${b}`);
  assert.equal(C.detalleATiempo(a, b), TEXTOS_DISENADOR.contDetalleATiempo(a, b), `a tiempo ${a}/${b}`);
  for (const at of [0, 1, 18]) assert.equal(C.detalleEfectividad(a, b, at), TEXTOS_DISENADOR.contDetalleEfectividad(a, b, at), `efectividad ${a}/${b}/${at}`);
}
ok(true, 'detalles de las tarjetas (Urgentes, Efectividad, Entregas a tiempo): servidor = pantalla en 8 pares × variantes');
ok(NOTA_TALLERES === TEXTOS_TALLER.gdInfo, 'la nota de la gráfica de talleres: ícono de la pantalla = nota impresa');
ok(NOTA_DISENADORES === TEXTOS_DISENADOR.gdInfo, 'la nota de la gráfica de diseñadores: ícono de la pantalla = nota impresa');

// ---- 2) PDF generado: tarjetas y gráfica con los textos de la pantalla ------------------------------------------------------------------------
const gruposVacios = (agruparPor) => ({ agruparPor, desgloseOmitido: false, totalVales: 0, secciones: { atrasados: { total: 0, grupos: [] }, noEntregados: { total: 0, grupos: [] }, entregados: { total: 0, grupos: [] } } });
const generar = (r) => pdfSvc.generar(r, { generadoPor: 'Prueba', ahora: '23/11/2026 10:00' });
const base = (extra) => ({ ingresados: 58, urgentes: { total: 1, porcentaje: 1.72 }, sinEntregar: 5, atrasados: { total: 41, anteriores: 23, actuales: 18 }, recibidos: { total: 35, conAtraso: 1, sinAtraso: 34 }, efectividad: 60.34, aTiempo: 97.14, porTienda: [], porGrupo: {}, ...extra });

for (const [etiqueta, tipo, T, contadores, tieneEfectividad] of [
  ['tiendas', 'actividad-tienda', TEXTOS_TIENDA, base({ efectividad: undefined, aTiempo: undefined, porTienda: [{ id: 1, nombre: 'T1', total: 58, urgentes: 1 }] }), false],
  ['asesores', 'actividad-asesor', TEXTOS_ASESOR, base({ efectividad: undefined, aTiempo: undefined, porAsesor: [{ id: 1, nombre: 'Ana', total: 58, urgentes: 1 }] }), false],
  ['talleres', 'actividad-taller', TEXTOS_TALLER, base({ porTaller: [{ id: 1, nombre: 'Diseño', asignados: 48, entregados: 30, tarde: 0, efectividad: 62.5, tardias: 0 }] }), true],
  ['diseñadores', 'actividad-disenador', TEXTOS_DISENADOR, base({ porDisenador: [{ id: 1, nombre: 'Ana Pérez', asignados: 9, entregados: 8, tarde: 1, efectividad: 88.89, tardias: 12.5 }] }), true]
]) {
  const rol = tipo.replace('actividad-', '');
  const r = { tipo, rol, titulo: `Actividad de ${etiqueta}`, periodo: { etiqueta: 'Noviembre 2026', titulo: 'Fecha de entrega: Noviembre 2026' }, resumenFiltros: ['Todos'], evaluados: [], tablas: [], incluirDesglose: true, contadores, grupos: gruposVacios(rol) };
  const textos = await textosDelPdf(await generar(r));
  const rotuloSin = 'Por vencer'; // el mismo rótulo en los cuatro reportes
  assert.equal(T.contSinEntregar, rotuloSin, `${etiqueta}: la pantalla dice «${T.contSinEntregar}»`);
  tiene(textos, T.contIngresados); tiene(textos, String(contadores.ingresados)); tiene(textos, rotuloSin); tiene(textos, String(contadores.sinEntregar));
  tiene(textos, T.contAtrasados); tiene(textos, `Anteriores ${contadores.atrasados.anteriores}`); tiene(textos, `Actuales ${contadores.atrasados.actuales}`);
  tiene(textos, T.contEntregados); tiene(textos, `Con atraso ${contadores.recibidos.conAtraso}`); tiene(textos, `Sin atraso ${contadores.recibidos.sinAtraso}`);
  if (tieneEfectividad) {
    tiene(textos, T.contEfectividad); tiene(textos, conSimboloPorcentaje(contadores.efectividad));
    tiene(textos, T.contDetalleEfectividad(35, 58, 18), 'el PDF debe traer el mismo detalle de Efectividad que la pantalla (con los atrasados)');
    tiene(textos, T.contATiempo); tiene(textos, conSimboloPorcentaje(contadores.aTiempo)); tiene(textos, T.contDetalleATiempo(34, 35));
    assert.ok(!textos.some(t => t.texto === 'Urgentes'), 'sin Urgentes');
  } else {
    tiene(textos, T.contUrgentes); tiene(textos, conSimboloPorcentaje(contadores.urgentes.porcentaje)); tiene(textos, T.contDetalleUrgentes(1, 58));
  }
  ok(true, `${etiqueta}: las tarjetas del PDF dicen lo mismo que las de la pantalla`);
}

// ---- 3) gráfica por diseñador/taller: mismo orden, nombres y E/T que la pantalla -----------------------------------------------------------------
const lista = [
  { id: 3, nombre: 'Carla · Encargado', asignados: 5, entregados: 5, tarde: 0, efectividad: 100, tardias: 0 },
  { id: 0, nombre: 'Sin asignar', asignados: 6, entregados: 0, tarde: 0, efectividad: 0, tardias: null },
  { id: 1, nombre: 'Ana Pérez · Asistente', asignados: 9, entregados: 8, tarde: 1, efectividad: 88.89, tardias: 12.5 },
  { id: 2, nombre: 'Beto López', asignados: 9, entregados: 3, tarde: 0, efectividad: 33.33, tardias: 0 }
];
const pantalla = filasGraficaDisenadores(lista).filas;
const r = { tipo: 'actividad-disenador', rol: 'disenador', titulo: 'x', periodo: { etiqueta: 'x', titulo: 'x' }, resumenFiltros: ['x'], evaluados: [], tablas: [], incluirDesglose: true, contadores: base({ porDisenador: lista }), grupos: gruposVacios('disenador') };
const textos = await textosDelPdf(await generar(r));
const yDe = (nombre) => { const t = textos.find(x => x.texto === limpiar(nombre)); assert.ok(t, `el PDF no trae el nombre «${nombre}»`); return t.y; };
const ordenPdf = pantalla.map(f => f.nombre).sort((a, b) => yDe(b) - yDe(a));
ok(ordenPdf.join('|') === pantalla.map(f => f.nombre).join('|'), `mismo orden que la pantalla (Sin asignar primero, sin rol): ${pantalla.map(f => f.nombre).join(' | ')}`);
ok(!textos.some(t => /Encargado|Asistente/.test(t.texto)), 'ni la pantalla ni el PDF llevan el rol en la gráfica');
for (const f of pantalla.filter(x => !x.sinAsignar)) {
  const y = yDe(f.nombre);
  const mismaFila = textos.filter(t => Math.abs(t.y - (y + 3)) < 6 || Math.abs(t.y - y) < 1);
  assert.ok(mismaFila.some(t => t.texto === conSimboloPorcentaje(f.efectividad)), `E de ${f.nombre}: ${conSimboloPorcentaje(f.efectividad)}`);
  assert.ok(mismaFila.some(t => t.texto === conSimboloPorcentaje(f.tardias)), `T de ${f.nombre}: ${conSimboloPorcentaje(f.tardias)}`);
}
ok(true, 'E y T de cada fila: mismos valores en la pantalla y en el PDF');
const sinFila = textos.filter(t => Math.abs(t.y - yDe('Sin asignar')) < 6 && / %$/.test(t.texto));
ok(sinFila.length === 0, '«Sin asignar» no lleva E ni T, ni en pantalla ni en el PDF');

// ---- 4) filtros: las etiquetas y los contadores de una barra elegida son los mismos en pantalla y en el PDF ------------------------------------
const FD = require(`${raiz}/src/modules/vales/services/valeReporteFiltroDesglose.js`);
const { enfocarPayload } = await cargar('public/modules/vales/js/views/reportes2/enfoque.js');
for (const [tipo, T] of [['Tienda', TEXTOS_TIENDA], ['Asesor', TEXTOS_ASESOR], ['Taller', TEXTOS_TALLER], ['Diseñador', TEXTOS_DISENADOR]]) {
  assert.equal(T.columna, tipo, `columna de ${tipo}`);
  // Tiendas no tienen variantes; asesores, urgentes; talleres y diseñadores, entregados y tarde (las que existen en la pantalla).
  const variantes = tipo === 'Tienda' ? [[null, false]] : (tipo === 'Asesor' ? [[null, false], [null, true]] : [[null, false], ['entregados', false], ['tarde', false]]);
  for (const [modo, urgentes] of variantes) {
    assert.equal(FD.etiquetaEnfoque(tipo, 'Nombre', { modo, urgentes }), T.pdfFiltroGrupo(T.columna, 'Nombre', urgentes, modo), `etiqueta de ${tipo} ${modo || ''}${urgentes ? ' urgentes' : ''}`);
  }
}
ok(true, 'etiqueta de la barra elegida (chip de la pantalla = línea «Filtrado por» del PDF) en los 4 reportes y sus modos');
const esperadasEstados = {
  sinEntregar: TEXTOS_DISENADOR.contSinEntregar, atrasados: TEXTOS_DISENADOR.contAtrasados, entregados: TEXTOS_DISENADOR.contEntregados,
  atrasadosAnteriores: TEXTOS_DISENADOR.filtroCategoria(TEXTOS_DISENADOR.contAtrasados, TEXTOS_DISENADOR.contAnteriores), atrasadosActuales: TEXTOS_DISENADOR.filtroCategoria(TEXTOS_DISENADOR.contAtrasados, TEXTOS_DISENADOR.contActuales),
  entregadosConAtraso: TEXTOS_DISENADOR.filtroCategoria(TEXTOS_DISENADOR.contEntregados, TEXTOS_DISENADOR.contConAtraso), entregadosSinAtraso: TEXTOS_DISENADOR.filtroCategoria(TEXTOS_DISENADOR.contEntregados, TEXTOS_DISENADOR.contSinAtraso)
};
for (const [estado, texto] of Object.entries(esperadasEstados)) assert.equal(FD.etiquetaFiltroDesglose({ estado }), texto, `etiqueta de «${estado}»`);
assert.equal(FD.etiquetaFiltroDesglose({ urgentes: true }), TEXTOS_TIENDA.contUrgentes);
ok(true, 'etiquetas de los filtros por contador: las mismas palabras en pantalla y PDF (7 estados + urgentes)');

// contadores de una barra: la pantalla (enfocarPayload) y el servidor/PDF (contadoresEnfocados) dan lo mismo, con Efectividad y Entregas a tiempo propias
const variante = (ingresados, entregados, conAtraso) => ({ ingresados, urgentes: { total: 0, porcentaje: 0 }, sinEntregar: 1, atrasados: { total: 2, anteriores: 1, actuales: 1 }, recibidos: { total: entregados, conAtraso, sinAtraso: entregados - conAtraso } });
const general = { ingresados: 71, efectividad: 59.15, aTiempo: 97.62, porGrupo: { 7: { todos: variante(13, 10, 1), entregados: variante(10, 10, 1), tarde: variante(1, 1, 1) } } };
for (const modo of [null, 'entregados', 'tarde']) {
  const pantalla = enfocarPayload({ contadores: general, grupos: { secciones: {} }, atrasadosVigentes: null }, { id: 7, modo }).contadores;
  const servidor = FD.contadoresEnfocados(general, 7, { modo });
  assert.deepEqual(pantalla, servidor, `contadores de la barra ${modo || 'todos'}`);
}
ok(FD.contadoresEnfocados(general, 7).efectividad === 76.92 && FD.contadoresEnfocados(general, 7).aTiempo === 90, 'Efectividad (10 de 13) y Entregas a tiempo (9 de 10) son las de la barra, no las generales');

// el PDF de una barra elegida imprime sus contadores y la línea «Filtrado por»
const rFiltro = { tipo: 'actividad-disenador', rol: 'disenador', titulo: 'x', periodo: { etiqueta: 'x', titulo: 'x' }, resumenFiltros: ['Diseñadores: Todos'], evaluados: [], tablas: [], incluirDesglose: true,
  contadores: FD.contadoresEnfocados({ ...base({ porDisenador: lista }), porGrupo: general.porGrupo }, 7, { modo: 'entregados' }), grupos: gruposVacios('disenador'), enfoqueEtiqueta: FD.etiquetaEnfoque('Diseñador', 'Giancarlo Hernández', { modo: 'entregados' }) };
const impreso = await textosDelPdf(await generar(FD.aplicarFiltroPdf(rFiltro, { desgloseEstado: 'entregadosSinAtraso' })));
assert.ok(impreso.map(t => t.texto).join(' ').includes('Filtrado por: Diseñador: Giancarlo Hernández (solo entregados) · Entregados: Sin atraso'), 'el PDF dice por qué filtro se imprimió, con las palabras de la pantalla (completo, sin recortar)');
assert.ok(!impreso.some(t => t.texto.includes('...')), 'ninguna línea se recorta con puntos suspensivos');
tiene(impreso, '10', 'el PDF imprime los Ingresados de la barra (no los generales)');
assert.ok(!impreso.some(t => t.texto === '71'), 'y no los 71 generales');
ok(true, 'el PDF de una barra elegida imprime los contadores de esa barra y la línea «Filtrado por» con las etiquetas de la pantalla');

console.log(`\nTODO OK (${n} comprobaciones)`);
