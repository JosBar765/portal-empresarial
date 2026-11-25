// Verificación de los reportes de actividad contra la BASE LOCAL (solo lectura: no escribe ni modifica nada).
// Genera los cuatro reportes (tiendas, talleres, diseñadores, asesores) como Administrador en varios meses y con filtros, y comprueba:
//   1. la identidad de los contadores: Entregados + Atrasados actuales + Por vencer/Sin entregar = Ingresados;
//   2. que el desglose (cada vale una sola vez) cuadre con los contadores, sección por sección;
//   3. que el estado de un vale NO cambie con el filtro (talleres y diseñadores: el vale compartido es del vale completo);
//   4. que la gráfica cuadre (tiendas/asesores: suma = ingresados; talleres/diseñadores: pares vale-taller o vale-diseñador);
//   5. que un vale entregado lo esté para TODOS sus diseñadores (los estados individuales no lo contradicen);
//   6. que el PDF diga lo mismo que la pantalla: tarjetas, títulos de sección con su total, todos los correlativos y la gráfica.
// La base local es siempre la de desarrollo (no se lee ni se comprueba el .env). Uso:   node scripts/reportes/verificarReportesContraBD.mjs
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { PDFDocument, PDFArray, decodePDFRawStream } from 'pdf-lib';

const require = createRequire(import.meta.url);
const raiz = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
process.chdir(raiz);

// Solo lectura: únicamente consulta los reportes (no escribe ni modifica nada).
const valeService = require(`${raiz}/src/modules/vales/services/valeService.js`);
const cargar = (ruta) => import(pathToFileURL(`${raiz}/${ruta}`).href);
const { TEXTOS_TIENDA, TEXTOS_TALLER, TEXTOS_DISENADOR, TEXTOS_ASESOR } = await cargar('public/modules/vales/js/views/reportes2/textos.js');
const { conSimboloPorcentaje } = await cargar('public/modules/vales/js/utils/formatoPorcentaje.js');

const admin = { id: 1, nombre: 'Verificación', rolId: 1, permissions: [] };
const TEXTOS = { tienda: TEXTOS_TIENDA, taller: TEXTOS_TALLER, disenador: TEXTOS_DISENADOR, asesor: TEXTOS_ASESOR };
let fallos = 0; let comprobaciones = 0;
const verifica = (cond, msg, detalle = '') => { comprobaciones++; if (!cond) { fallos++; console.log(`  FALLA  ${msg}${detalle ? `  →  ${detalle}` : ''}`); } };

// ---- texto del PDF ----------------------------------------------------------------------------------------------------------------------------
async function textosDelPdf(buffer) {
  const doc = await PDFDocument.load(buffer);
  const salida = [];
  for (const pagina of doc.getPages()) {
    const c = pagina.node.Contents();
    const flujos = c instanceof PDFArray ? c.asArray().map(r => doc.context.lookup(r)) : [c];
    const contenido = flujos.map(f => Buffer.from(decodePDFRawStream(f).decode()).toString('latin1')).join('\n');
    for (const l of contenido.split('\n').map(s => s.trim()).filter(Boolean)) if (/Tj$/.test(l)) salida.push(Buffer.from(l.replace(/^<|>\s*Tj$/g, ''), 'hex').toString('latin1'));
  }
  return salida;
}
const limpiar = (s) => String(s).normalize('NFC').replace(/—/g, '-').replace(/[^\x20-\x7EÀ-ÿ]/g, '?');

// ---- consultas ------------------------------------------------------------------------------------------------------------------------------
const obtener = (tipo, filtros) => (tipo === 'tienda' ? valeService.obtenerReporteActividadTienda(admin, filtros) : valeService.obtenerReporteActividadEquipo(tipo, admin, filtros));
const pdfDe = (tipo, filtros) => (tipo === 'tienda' ? valeService.generarReporteActividadTiendaPdf(admin, filtros) : valeService.generarReporteActividadEquipoPdf(tipo, admin, filtros));
const valesDe = (R) => {
  const filas = [];
  for (const [clave, sec] of Object.entries(R.grupos?.secciones || {})) for (const g of sec.grupos || []) for (const v of g.vales || []) filas.push({ ...v, clave, grupo: g });
  return filas;
};

function revisaReporte(tipo, R, etiqueta) {
  const c = R.contadores;
  const por = R.grupos;
  verifica(!!c, `${etiqueta}: trae contadores`);
  if (c) {
    const compartidos = valesDe(R).filter(v => (v.talleresDelVale || []).length > 1 || (v.disenadoresDelVale || []).length > 1).length;
    console.log(`  ingresados ${c.ingresados} · entregados ${c.recibidos.total} · atrasados ${c.atrasados.actuales}+${c.atrasados.anteriores} · por vencer ${c.sinEntregar} · vales compartidos ${compartidos}`);
  }
  if (!c) return new Map();
  const sin = 'Por vencer';
  // 1) identidad
  verifica(c.ingresados === c.recibidos.total + c.atrasados.actuales + c.sinEntregar,
    `${etiqueta}: Entregados + Atrasados actuales + ${sin} = Ingresados`, `${c.recibidos.total} + ${c.atrasados.actuales} + ${c.sinEntregar} ≠ ${c.ingresados}`);
  verifica(c.atrasados.total === c.atrasados.anteriores + c.atrasados.actuales, `${etiqueta}: Atrasados = anteriores + actuales`);
  verifica(c.recibidos.total === c.recibidos.conAtraso + c.recibidos.sinAtraso, `${etiqueta}: Entregados = con atraso + sin atraso`);
  // 2) el desglose cuadra con los contadores
  const omitido = !!por?.desgloseOmitido;
  const filas = valesDe(R);
  if (!omitido) {
    const ids = filas.map(v => `${v.id}`);
    verifica(new Set(ids).size === ids.length || tipo === 'tienda' || tipo === 'asesor', `${etiqueta}: cada vale sale una sola vez en el desglose`, `${ids.length - new Set(ids).size} repetidos`);
    const total = (clave) => R.grupos.secciones[clave]?.total ?? 0;
    verifica(total('entregados') === c.recibidos.total, `${etiqueta}: desglose Entregados = contador`, `${total('entregados')} vs ${c.recibidos.total}`);
    verifica(total('atrasados') === c.atrasados.actuales, `${etiqueta}: desglose Atrasados (período actual) = contador`, `${total('atrasados')} vs ${c.atrasados.actuales}`);
    verifica(total('noEntregados') === c.sinEntregar, `${etiqueta}: desglose ${sin} = contador`, `${total('noEntregados')} vs ${c.sinEntregar}`);
    verifica((R.atrasadosVigentes?.total ?? 0) === c.atrasados.anteriores, `${etiqueta}: desglose Atrasados anteriores = contador`, `${R.atrasadosVigentes?.total} vs ${c.atrasados.anteriores}`);
    verifica(R.conteos.entregados === c.recibidos.total && R.conteos.noEntregados === c.sinEntregar && R.conteos.atrasados === c.atrasados.actuales, `${etiqueta}: «conteos» del servidor = contadores`);
  }
  // 4) la gráfica
  if (tipo === 'tienda' || tipo === 'asesor') {
    const lista = tipo === 'tienda' ? c.porTienda : c.porAsesor;
    verifica((lista || []).reduce((s, x) => s + x.total, 0) === c.ingresados, `${etiqueta}: suma de la gráfica = Ingresados`);
  }
  if (tipo === 'taller' && !omitido) {
    const ids = new Set((c.porTaller || []).map(t => t.id));
    const pares = filas.reduce((s, v) => s + (v.talleresDelVale || []).filter(t => ids.has(t.id)).length, 0);
    verifica((c.porTaller || []).reduce((s, t) => s + t.asignados, 0) === pares, `${etiqueta}: asignados por taller = pares vale-taller del desglose`, `${(c.porTaller || []).reduce((s, t) => s + t.asignados, 0)} vs ${pares}`);
    verifica((c.porTaller || []).every(t => t.entregados <= t.asignados && t.tarde <= t.entregados), `${etiqueta}: en cada taller tarde ≤ entregados ≤ asignados`);
  }
  if (tipo === 'disenador') {
    verifica((c.porDisenador || []).every(d => d.entregados <= d.asignados && d.tarde <= d.entregados), `${etiqueta}: en cada diseñador tarde ≤ entregados ≤ asignados`);
    // 5) enfocar cada barra deja exactamente sus vales (con filtro de talleres la fila también muestra a diseñadores sin barra)
    if (!omitido) {
      const filasDeBarra = (id) => new Set(Object.values(R.grupos.secciones).flatMap(sec => sec.grupos.filter(g => g.id === id || (g.ids || []).includes(id)).flatMap(g => g.vales.map(v => v.id)))).size;
      const malas = (c.porDisenador || []).filter(d => filasDeBarra(d.id) !== d.asignados);
      verifica(malas.length === 0, `${etiqueta}: cada barra de diseñador = sus filas del desglose`, malas.slice(0, 3).map(d => `${d.nombre}: ${d.asignados} vs ${filasDeBarra(d.id)}`).join('; '));
    }
  }
  return new Map(filas.map(v => [v.id, v.clave]));
}

async function revisaPdf(tipo, R, filtros, etiqueta) {
  const T = TEXTOS[tipo]; const c = R.contadores;
  const { pdf } = await pdfDe(tipo, filtros);
  const textos = (await textosDelPdf(pdf)).map(t => t);
  const tiene = (esperado, msg) => verifica(textos.includes(limpiar(esperado)), `${etiqueta} PDF: ${msg || `trae «${esperado}»`}`);
  const conEfectividad = tipo === 'taller' || tipo === 'disenador';
  tiene(T.contIngresados); tiene(String(c.ingresados));
  tiene('Por vencer'); tiene(String(c.sinEntregar));
  tiene(`Anteriores ${c.atrasados.anteriores}`); tiene(`Actuales ${c.atrasados.actuales}`);
  tiene(`Con atraso ${c.recibidos.conAtraso}`); tiene(`Sin atraso ${c.recibidos.sinAtraso}`);
  if (conEfectividad) {
    tiene(conSimboloPorcentaje(c.efectividad), 'Efectividad'); tiene(T.contDetalleEfectividad(c.recibidos.total, c.ingresados, c.atrasados.actuales), 'detalle de Efectividad como en pantalla');
    tiene(conSimboloPorcentaje(c.aTiempo), 'Entregas a tiempo'); tiene(T.contDetalleATiempo(c.recibidos.total - c.recibidos.conAtraso, c.recibidos.total), 'detalle de Entregas a tiempo como en pantalla');
  } else {
    tiene(conSimboloPorcentaje(c.urgentes.porcentaje), 'Urgentes'); tiene(T.contDetalleUrgentes(c.urgentes.total, c.ingresados), 'detalle de Urgentes como en pantalla');
  }
  if (!R.grupos?.desgloseOmitido) {
    const titulos = { atrasados: 'ATRASADOS (PERÍODO ACTUAL)', noEntregados: 'POR VENCER', entregados: 'ENTREGADOS' };
    for (const [clave, titulo] of Object.entries(titulos)) {
      const total = R.grupos.secciones[clave]?.total ?? 0;
      if (total > 0) verifica(textos.some(t => t.includes(limpiar(titulo)) && t.includes(`(${total})`)), `${etiqueta} PDF: sección ${titulo} con su total (${total})`);
    }
    const correlativos = [...new Set(valesDe(R).map(v => v.correlativo))];
    const faltan = correlativos.filter(co => !textos.some(t => t.includes(limpiar(co))));
    verifica(faltan.length === 0, `${etiqueta} PDF: imprime todos los vales del desglose (${correlativos.length})`, faltan.slice(0, 5).join(', '));
  }
  const lista = tipo === 'taller' ? c.porTaller : (tipo === 'disenador' ? c.porDisenador : (tipo === 'asesor' ? c.porAsesor : c.porTienda));
  const nombre = (x) => String(x.nombre).replace(/ · (Encargado|Asistente)$/, '');
  const visibles = lista || []; // el PDF imprime todas las barras
  const sinNombre = visibles.filter(x => !textos.some(t => t.includes(limpiar(nombre(x)))));
  verifica(sinNombre.length === 0, `${etiqueta} PDF: la gráfica trae a quienes muestra la pantalla`, sinNombre.map(nombre).join(', '));
}

// A quiénes muestra cada fila del desglose (diseñadores en su reporte, talleres en el de talleres): el filtro de talleres no puede esconder a ninguno.
const mostradosPorVale = (tipo, R) => {
  const campo = tipo === 'disenador' ? 'disenadoresDelVale' : 'talleresDelVale';
  const m = new Map();
  for (const sec of Object.values(R.grupos.secciones)) for (const g of sec.grupos) for (const v of g.vales) m.set(v.correlativo, (v[campo] || []).map(x => x.nombre).sort().join(' + '));
  return m;
};

// ---- recorrido -------------------------------------------------------------------------------------------------------------------------------
const hoy = new Date(); const meses = [0, 1, 2, 3].map(k => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - k, 15); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`; });
const guardado = new Map(); // «tipo|fecha» -> estado de cada vale sin filtro
for (const tipo of ['tienda', 'taller', 'disenador', 'asesor']) {
  for (const fecha of meses) {
    const filtros = { ventana: 'mes', fecha };
    const etiqueta = `${tipo} ${fecha.slice(0, 7)}`;
    console.log(`\n== ${etiqueta}`);
    try {
      const R = await obtener(tipo, filtros);
      guardado.set(`${tipo}|${fecha}`, revisaReporte(tipo, R, etiqueta));
      if (tipo !== 'tienda' || R.contadores) await revisaPdf(tipo, R, filtros, etiqueta);
      // 3) el filtro no cambia el estado de un vale (talleres y diseñadores)
      if (tipo === 'taller' || tipo === 'disenador') {
        const ofrecidos = (R.filtros?.talleres || []).slice(0, 3);
        for (const t of ofrecidos) {
          const F = await obtener(tipo, { ...filtros, tallerIds: [t.id] });
          const estadoFiltrado = revisaReporte(tipo, F, `${etiqueta} · filtrado por ${t.nombre}`);
          const base = guardado.get(`${tipo}|${fecha}`);
          const distintos = [...estadoFiltrado].filter(([id, clave]) => base.has(id) && base.get(id) !== clave);
          verifica(distintos.length === 0, `${etiqueta}: el filtro «${t.nombre}» no cambia el estado de ningún vale`, `${distintos.length} vales cambian de sección: ${distintos.slice(0, 5).map(([id]) => id).join(', ')}`);
          const completos = mostradosPorVale(tipo, R);
          const recortados = [...mostradosPorVale(tipo, F)].filter(([vale, quienes]) => completos.has(vale) && completos.get(vale) !== quienes);
          verifica(recortados.length === 0, `${etiqueta}: el filtro «${t.nombre}» muestra a todos los de cada vale`, `${recortados.length} filas recortadas: ${recortados.slice(0, 3).map(([vale, quienes]) => `${vale} «${completos.get(vale)}» -> «${quienes}»`).join('; ')}`);
        }
      }
    } catch (error) {
      verifica(false, `${etiqueta}: error al generar`, String(error.message || error));
    }
  }
}
console.log(`\n${fallos ? `${fallos} FALLA(S)` : 'TODO OK'} en ${comprobaciones} comprobaciones (solo lectura; el PDF se comprueba por su contenido, no se ve renderizado).`);
process.exit(fallos ? 1 : 0);
