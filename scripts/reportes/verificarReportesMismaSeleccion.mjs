// Verificación cruzada de los cuatro reportes de actividad sobre la MISMA ventana y la MISMA selección, contra la base local (solo lectura).
// Complementa a verificarReportesContraBD.mjs. Comprueba:
//   A. misma ventana sin filtro: los cuatro reportes muestran los mismos vales (y tienda = asesor y taller = diseñador en todos sus contadores);
//   B. misma selección: un taller (talleres y diseñadores) y una tienda (tiendas y asesores) dan los mismos vales y contadores;
//   C. vista enfocada (barra de la gráfica) en TODAS las barras: los contadores de la barra cuadran con el desglose enfocado de la pantalla
//      y el PDF imprime exactamente los mismos vales que la pantalla;
//   D. filtro por cada contador: el desglose filtrado cuadra con el número del contador, y pantalla y PDF muestran los mismos vales;
//   E. el PDF se genera sin error en cada variante y trae sus correlativos y totales de sección.
// Uso:   node scripts/reportes/verificarReportesMismaSeleccion.mjs
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { PDFDocument, PDFArray, decodePDFRawStream } from 'pdf-lib';

const require = createRequire(import.meta.url);
const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
process.chdir(raiz);
const valeService = require(`${raiz}/src/modules/vales/services/valeService.js`);
const cargar = (ruta) => import(pathToFileURL(`${raiz}/${ruta}`).href);
const { enfocarPayload } = await cargar('public/modules/vales/js/views/reportes2/enfoque.js');
const { aplicarFiltroContador, ESTADOS_FILTRO } = await cargar('public/modules/vales/js/views/reportes2/filtroContadores.js');
const { TEXTOS_TIENDA, TEXTOS_TALLER, TEXTOS_DISENADOR, TEXTOS_ASESOR } = await cargar('public/modules/vales/js/views/reportes2/textos.js');
const { conSimboloPorcentaje } = await cargar('public/modules/vales/js/utils/formatoPorcentaje.js');
const TEXTOS = { tienda: TEXTOS_TIENDA, asesor: TEXTOS_ASESOR, taller: TEXTOS_TALLER, disenador: TEXTOS_DISENADOR };
// Etiqueta de un filtro por contador: la de la pantalla (ROTULO_FILTRO).
const rotuloEstado = (T, e) => ({ sinEntregar: T.contSinEntregar, atrasados: T.contAtrasados, entregados: T.contEntregados, atrasadosAnteriores: T.filtroCategoria(T.contAtrasados, T.contAnteriores), atrasadosActuales: T.filtroCategoria(T.contAtrasados, T.contActuales), entregadosConAtraso: T.filtroCategoria(T.contEntregados, T.contConAtraso), entregadosSinAtraso: T.filtroCategoria(T.contEntregados, T.contSinAtraso) })[e];

const admin = { id: 1, nombre: 'Verificación', rolId: 1, permissions: [] };
let fallos = 0; let comprobaciones = 0;
const verifica = (cond, msg, detalle = '') => { comprobaciones++; if (!cond) { fallos++; console.log(`  FALLA  ${msg}${detalle ? `  →  ${detalle}` : ''}`); } };
const limpiar = (s) => String(s).normalize('NFC').replace(/—/g, '-').replace(/[^\x20-\x7EÀ-ÿ]/g, '?');

async function textosDelPdf(buffer) {
  const doc = await PDFDocument.load(buffer);
  const salida = [];
  for (const pagina of doc.getPages()) {
    const c = pagina.node.Contents();
    const flujos = c instanceof PDFArray ? c.asArray().map(r => doc.context.lookup(r)) : [c];
    const contenido = flujos.map(f => Buffer.from(decodePDFRawStream(f).decode()).toString('latin1')).join('\n');
    for (const l of contenido.split('\n').map(s => s.trim()).filter(Boolean)) if (/Tj$/.test(l)) salida.push(Buffer.from(l.replace(/^<|>\s*Tj$/g, ''), 'hex').toString('latin1'));
  }
  return { textos: salida, paginas: doc.getPageCount() };
}

const obtener = (tipo, filtros) => (tipo === 'tienda' ? valeService.obtenerReporteActividadTienda(admin, filtros) : valeService.obtenerReporteActividadEquipo(tipo, admin, filtros));
const pdfDe = (tipo, filtros) => (tipo === 'tienda' ? valeService.generarReporteActividadTiendaPdf(admin, filtros) : valeService.generarReporteActividadEquipoPdf(tipo, admin, filtros));
// Vales de la sección del período y de los atrasados anteriores de un reporte (o de una vista ya enfocada/filtrada).
const valesDe = (R) => {
  const filas = [];
  for (const sec of Object.values(R.grupos?.secciones || {})) for (const g of sec.grupos || []) for (const v of g.vales || []) filas.push(v);
  for (const g of R.atrasadosVigentes?.grupos || []) for (const v of g.vales || []) filas.push({ ...v, anterior: true });
  return filas;
};
const idsPeriodo = (R) => new Set(Object.values(R.grupos?.secciones || {}).flatMap(s => (s.grupos || []).flatMap(g => (g.vales || []).map(v => v.id))));
const correlativos = (R) => new Set(valesDe(R).map(v => v.correlativo));
const igualesSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
const diferencia = (a, b) => [...a].filter(x => !b.has(x)).slice(0, 5).join(', ');

const hoy = new Date(); const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-15`;
const ventana = { ventana: 'mes', fecha };
const TIPOS = ['tienda', 'asesor', 'taller', 'disenador'];
const PARAMETRO = { tienda: 'tiendaDesglose', asesor: 'asesorDesglose', taller: 'tallerDesglose', disenador: 'disenadorDesglose' };
const LISTA = { tienda: 'porTienda', asesor: 'porAsesor', taller: 'porTaller', disenador: 'porDisenador' };

console.log(`== Ventana: ${fecha.slice(0, 7)} (mes), sin filtro`);
const base = {};
for (const tipo of TIPOS) base[tipo] = await obtener(tipo, ventana);

// ---- A) misma ventana -----------------------------------------------------------------------------------------------------------------------
{
  const ref = idsPeriodo(base.tienda);
  for (const tipo of TIPOS.slice(1)) {
    const ids = idsPeriodo(base[tipo]);
    verifica(igualesSet(ref, ids), `A: ${tipo} muestra los mismos vales de la ventana que tiendas`, `${ids.size} vs ${ref.size}; solo en tiendas: ${diferencia(ref, ids)}; solo en ${tipo}: ${diferencia(ids, ref)}`);
  }
  const igualCont = (a, b, etiqueta, campos) => campos.forEach(k => verifica(JSON.stringify(base[a].contadores[k]) === JSON.stringify(base[b].contadores[k]), `A: ${etiqueta}: contador «${k}» igual`, `${JSON.stringify(base[a].contadores[k])} vs ${JSON.stringify(base[b].contadores[k])}`));
  igualCont('tienda', 'asesor', 'tiendas = asesores (misma definición de «entregado»)', ['ingresados', 'urgentes', 'sinEntregar', 'atrasados', 'recibidos']);
  igualCont('taller', 'disenador', 'talleres = diseñadores (misma definición de «entregado»)', ['ingresados', 'sinEntregar', 'atrasados', 'recibidos', 'efectividad', 'aTiempo']);
  // Los grupos del desglose de talleres y diseñadores se nombran con los talleres / diseñadores REALES de cada vale (en ese orden alfabético).
  for (const tipo of ['taller', 'disenador']) {
    const malos = [];
    for (const sec of Object.values(base[tipo].grupos?.secciones || {})) for (const g of sec.grupos || []) for (const v of g.vales || []) {
      const lista = tipo === 'disenador' ? v.disenadoresDelVale : v.talleresDelVale;
      const esperado = (lista || []).map(x => x.nombre).sort((x, y) => x.localeCompare(y, 'es')).join(', ') || 'Sin asignar';
      if (g.nombre !== esperado) malos.push(`${v.correlativo}: grupo «${g.nombre}» vs «${esperado}»`);
    }
    verifica(malos.length === 0, `A: ${tipo}: cada grupo del desglose lleva los ${tipo === 'disenador' ? 'diseñadores' : 'talleres'} reales del vale`, malos.slice(0, 3).join(' | '));
  }
  console.log(`  ingresados: tiendas ${base.tienda.contadores.ingresados} · asesores ${base.asesor.contadores.ingresados} · talleres ${base.taller.contadores.ingresados} · diseñadores ${base.disenador.contadores.ingresados}`);
}

// ---- B) misma selección ---------------------------------------------------------------------------------------------------------------------
{
  const taller = [...(base.taller.contadores.porTaller || [])].sort((a, b) => b.asignados - a.asignados)[0];
  if (taller) {
    console.log(`\n== Selección: taller «${taller.nombre}»`);
    const T = await obtener('taller', { ...ventana, tallerIds: [taller.id] });
    const D = await obtener('disenador', { ...ventana, tallerIds: [taller.id] });
    verifica(igualesSet(idsPeriodo(T), idsPeriodo(D)), 'B: talleres y diseñadores, filtrados por el mismo taller, muestran los mismos vales');
    for (const k of ['ingresados', 'sinEntregar', 'atrasados', 'recibidos']) verifica(JSON.stringify(T.contadores[k]) === JSON.stringify(D.contadores[k]), `B: mismo taller: contador «${k}» igual en talleres y diseñadores`, `${JSON.stringify(T.contadores[k])} vs ${JSON.stringify(D.contadores[k])}`);
    verifica(T.contadores.ingresados === taller.asignados, 'B: ingresados del filtro = asignados de ese taller en la gráfica general', `${T.contadores.ingresados} vs ${taller.asignados}`);
    verifica(valesDe(T).every(v => (v.talleresDelVale || []).some(t => t.id === taller.id)), 'B: todo vale del filtro pasó por ese taller');
    const generalPorId = new Map(valesDe(base.taller).map(v => [v.id, v.seccion]));
    verifica(valesDe(T).filter(v => !v.anterior).every(v => !generalPorId.has(v.id) || generalPorId.get(v.id) === v.seccion), 'B: el filtro no cambia la sección de ningún vale');
  }
  const tienda = [...(base.tienda.contadores.porTienda || [])].sort((a, b) => b.total - a.total)[0];
  if (tienda) {
    console.log(`\n== Selección: tienda «${tienda.nombre}»`);
    const Tn = await obtener('tienda', { ...ventana, tiendaIds: [tienda.id] });
    const A = await obtener('asesor', { ...ventana, tiendaIds: [tienda.id] });
    verifica(igualesSet(idsPeriodo(Tn), idsPeriodo(A)), 'B: tiendas y asesores, filtrados por la misma tienda, muestran los mismos vales');
    for (const k of ['ingresados', 'urgentes', 'sinEntregar', 'atrasados', 'recibidos']) verifica(JSON.stringify(Tn.contadores[k]) === JSON.stringify(A.contadores[k]), `B: misma tienda: contador «${k}» igual en tiendas y asesores`, `${JSON.stringify(Tn.contadores[k])} vs ${JSON.stringify(A.contadores[k])}`);
    verifica(Tn.contadores.ingresados === tienda.total, 'B: ingresados del filtro = total de esa tienda en la gráfica general', `${Tn.contadores.ingresados} vs ${tienda.total}`);
  }
}

// ---- C) vista enfocada en cada barra: contadores = desglose enfocado = PDF ---------------------------------------------------------------------
const sumaSecciones = (V, clave) => V.grupos?.secciones?.[clave]?.total ?? 0;
async function revisaPdfDeVista(etiqueta, tipo, params, vistaPantalla, filtroEsperado = '') {
  const { reporte, pdf } = await pdfDe(tipo, { ...ventana, incluirDesglose: true, ...params });
  const esperados = correlativos(vistaPantalla); const impresos = correlativos(reporte);
  verifica(igualesSet(esperados, impresos), `${etiqueta}: el PDF imprime los mismos vales que la pantalla`, `pantalla ${esperados.size} vs PDF ${impresos.size}; solo en pantalla: ${diferencia(esperados, impresos)}; solo en PDF: ${diferencia(impresos, esperados)}`);
  const { textos } = await textosDelPdf(pdf);
  // Los contadores impresos son los que muestra la pantalla en esa vista (los de la barra elegida, si la hay) y la línea «Filtrado por» dice cuál es.
  const T = TEXTOS[tipo]; const c = vistaPantalla.contadores;
  const hay = (texto, msg) => verifica(textos.some(t => t === limpiar(texto)), `${etiqueta}: el PDF imprime ${msg}`, texto);
  hay(String(c.ingresados), `Ingresados de la vista (${c.ingresados})`);
  hay(`Anteriores ${c.atrasados.anteriores}`, 'Atrasados anteriores de la vista'); hay(`Actuales ${c.atrasados.actuales}`, 'Atrasados actuales de la vista');
  hay(`Con atraso ${c.recibidos.conAtraso}`, 'Entregados con atraso de la vista'); hay(`Sin atraso ${c.recibidos.sinAtraso}`, 'Entregados sin atraso de la vista');
  if (c.efectividad !== undefined) { hay(conSimboloPorcentaje(c.efectividad), `Efectividad de la vista (${conSimboloPorcentaje(c.efectividad)})`); hay(conSimboloPorcentaje(c.aTiempo), 'Entregas a tiempo de la vista'); }
  if (filtroEsperado) verifica(textos.join(' ').includes(limpiar(`Filtrado por: ${filtroEsperado}`)), `${etiqueta}: el PDF dice «Filtrado por: ${filtroEsperado}»`);
  const faltan = [...esperados].filter(c => !textos.includes(limpiar(c)) && !textos.some(t => t.includes(limpiar(c))));
  verifica(faltan.length === 0, `${etiqueta}: todos esos vales están realmente escritos en el PDF`, faltan.slice(0, 5).join(', '));
}
for (const tipo of TIPOS) {
  const R = base[tipo];
  if (R.grupos?.desgloseOmitido) continue;
  const grupos = [...(R.contadores[LISTA[tipo]] || [])].filter(g => (g.total ?? g.asignados) > 0);
  const elegidos = [...grupos.slice(0, 3), ...(grupos.length > 3 ? [grupos[grupos.length - 1]] : [])];
  const variantes = tipo === 'asesor' ? [{ modo: null, urgentes: false }, { modo: null, urgentes: true }]
    : (tipo === 'taller' || tipo === 'disenador' ? [{ modo: null }, { modo: 'entregados' }, { modo: 'tarde' }] : [{ modo: null }]);
  console.log(`\n== Vista enfocada: ${tipo} (${elegidos.length} barras × ${variantes.length} variantes; ${grupos.length} barras en total)`);
  // los contadores de TODAS las barras deben cuadrar con su desglose enfocado (solo pantalla: barato)
  for (const g of grupos) {
    for (const v of variantes) {
      const vista = enfocarPayload(R, { id: g.id, urgentes: !!v.urgentes, modo: v.modo });
      if (vista === R) continue;
      const c = vista.contadores;
      const etq = `C: ${tipo} «${g.nombre}»${v.modo ? ` [${v.modo}]` : ''}${v.urgentes ? ' [urgentes]' : ''}`;
      verifica(sumaSecciones(vista, 'entregados') === c.recibidos.total, `${etq}: Entregados del desglose = contador`, `${sumaSecciones(vista, 'entregados')} vs ${c.recibidos.total}`);
      verifica(sumaSecciones(vista, 'atrasados') === c.atrasados.actuales, `${etq}: Atrasados (período actual) del desglose = contador`, `${sumaSecciones(vista, 'atrasados')} vs ${c.atrasados.actuales}`);
      verifica(sumaSecciones(vista, 'noEntregados') === c.sinEntregar, `${etq}: Por vencer del desglose = contador`, `${sumaSecciones(vista, 'noEntregados')} vs ${c.sinEntregar}`);
      verifica((vista.atrasadosVigentes?.total ?? 0) === c.atrasados.anteriores, `${etq}: Atrasados anteriores del desglose = contador`, `${vista.atrasadosVigentes?.total} vs ${c.atrasados.anteriores}`);
      verifica(c.ingresados === c.recibidos.total + c.atrasados.actuales + c.sinEntregar, `${etq}: identidad Entregados + Atrasados actuales + Por vencer = Ingresados`, `${c.recibidos.total} + ${c.atrasados.actuales} + ${c.sinEntregar} vs ${c.ingresados}`);
    }
  }
  // y el PDF de algunas barras imprime lo mismo que la pantalla
  for (const g of elegidos) {
    for (const v of variantes) {
      const vista = enfocarPayload(R, { id: g.id, urgentes: !!v.urgentes, modo: v.modo });
      const params = { [PARAMETRO[tipo]]: g.id };
      if (v.modo) params[tipo === 'taller' ? 'tallerModo' : 'disenadorModo'] = v.modo;
      if (v.urgentes) params.soloUrgentes = true;
      const nombreSinRol = String(g.nombre).replace(/ · (Encargado|Asistente)$/, '');
      try { await revisaPdfDeVista(`E: PDF de ${tipo} «${g.nombre}»${v.modo ? ` [${v.modo}]` : ''}${v.urgentes ? ' [urgentes]' : ''}`, tipo, params, vista, TEXTOS[tipo].pdfFiltroGrupo(TEXTOS[tipo].columna, nombreSinRol, !!v.urgentes, v.modo)); } catch (e) { verifica(false, `E: PDF de ${tipo} «${g.nombre}»: error al generar`, String(e.message || e)); }
    }
  }
}

// ---- D) filtro por cada contador ------------------------------------------------------------------------------------------------------------
console.log('\n== Filtro por contador (cada estado) y su PDF');
for (const tipo of TIPOS) {
  const R = base[tipo]; const c = R.contadores;
  if (R.grupos?.desgloseOmitido) continue;
  const esperado = {
    sinEntregar: c.sinEntregar, atrasados: c.atrasados.total, atrasadosAnteriores: c.atrasados.anteriores, atrasadosActuales: c.atrasados.actuales,
    entregados: c.recibidos.total, entregadosConAtraso: c.recibidos.conAtraso, entregadosSinAtraso: c.recibidos.sinAtraso
  };
  for (const estado of ESTADOS_FILTRO) {
    const vista = aplicarFiltroContador(R, { estado, urgente: false });
    const n = valesDe(vista).length;
    verifica(esperado[estado] === undefined || n === esperado[estado], `D: ${tipo} filtro «${estado}»: vales del desglose = contador`, `${n} vs ${esperado[estado]}`);
    try { await revisaPdfDeVista(`D: PDF de ${tipo} filtro «${estado}»`, tipo, { desgloseEstado: estado }, vista, rotuloEstado(TEXTOS[tipo], estado)); } catch (e) { verifica(false, `D: PDF de ${tipo} filtro «${estado}»: error al generar`, String(e.message || e)); }
  }
  if (tipo === 'tienda' || tipo === 'asesor') {
    const vista = aplicarFiltroContador(R, { estado: null, urgente: true });
    verifica(valesDe(vista).filter(v => !v.anterior).length === c.urgentes.total || valesDe(vista).length >= c.urgentes.total, `D: ${tipo} filtro «urgentes»: vales del desglose ≥ contador`, `${valesDe(vista).length} vs ${c.urgentes.total}`);
    try { await revisaPdfDeVista(`D: PDF de ${tipo} filtro «urgentes»`, tipo, { desgloseUrgentes: true }, vista, TEXTOS[tipo].contUrgentes); } catch (e) { verifica(false, `D: PDF de ${tipo} filtro «urgentes»: error al generar`, String(e.message || e)); }
  }
}

// ---- E) PDF general sin desglose y con él ------------------------------------------------------------------------------------------------------
console.log('\n== PDF general');
for (const tipo of TIPOS) {
  try {
    const sin = await pdfDe(tipo, { ...ventana, incluirDesglose: false });
    const con = await pdfDe(tipo, { ...ventana, incluirDesglose: true });
    const tSin = await textosDelPdf(sin.pdf); const tCon = await textosDelPdf(con.pdf);
    const hay = [...correlativos(base[tipo])].slice(0, 5);
    verifica(hay.every(c => !tSin.textos.some(t => t.includes(limpiar(c)))), `E: ${tipo}: el PDF sin desglose no imprime vales`);
    verifica(hay.every(c => tCon.textos.some(t => t.includes(limpiar(c)))), `E: ${tipo}: el PDF con desglose imprime los vales`);
    console.log(`  ${tipo}: ${tSin.paginas} pág. sin desglose · ${tCon.paginas} pág. con desglose`);
  } catch (e) { verifica(false, `E: ${tipo}: error al generar el PDF general`, String(e.message || e)); }
}

console.log(`\n${fallos ? `${fallos} FALLA(S)` : 'TODO OK'} en ${comprobaciones} comprobaciones (solo lectura; el PDF se comprueba por su contenido, no se ve renderizado).`);
process.exit(fallos ? 1 : 0);
