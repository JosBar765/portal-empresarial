// src/modules/vales/services/valeReporteFiltroDesglose.js
// Filtro del desglose del PDF por contador: espejo en servidor de `public/modules/vales/js/views/reportes2/filtroContadores.js`.
// Funciones puras (sin repositorios ni BD). ATENCIÓN: si cambia una regla, cambia también la del frontend; `node scripts/reportes/probarFiltroDesglose.mjs` las cruza con los mismos datos
// (corre antes y después de tocar cualquiera de las dos: falla si difieren).
const ESTADOS_DESGLOSE = ['sinEntregar', 'atrasados', 'atrasadosAnteriores', 'atrasadosActuales', 'entregados', 'entregadosConAtraso', 'entregadosSinAtraso'];

// Qué secciones del período y si los atrasados anteriores entran en cada estado; `vale` afina dentro de la sección.
const REGLAS = {
  sinEntregar: { secciones: ['noEntregados'], vigentes: false },
  atrasados: { secciones: ['atrasados'], vigentes: true },
  atrasadosAnteriores: { secciones: [], vigentes: true },
  atrasadosActuales: { secciones: ['atrasados'], vigentes: false },
  entregados: { secciones: ['entregados'], vigentes: false },
  entregadosConAtraso: { secciones: ['entregados'], vigentes: false, vale: v => Number(v.diasTarde) > 0 },
  entregadosSinAtraso: { secciones: ['entregados'], vigentes: false, vale: v => !(Number(v.diasTarde) > 0) }
};

// Mismas palabras que las etiquetas de filtro de la pantalla (ROTULO_FILTRO en reportes2/actividadReporte.js): lo que se ve es lo que se imprime.
const ETIQUETAS = {
  sinEntregar: 'Por vencer',
  atrasados: 'Atrasados',
  atrasadosAnteriores: 'Atrasados: Anteriores',
  atrasadosActuales: 'Atrasados: Actuales',
  entregados: 'Entregados',
  entregadosConAtraso: 'Entregados: Con atraso',
  entregadosSinAtraso: 'Entregados: Sin atraso'
};

const vacia = (sec) => ({ ...sec, total: 0, grupos: [] });

// Un grupo que no pierde vales se deja tal cual (su total exacto viene de la consulta).
function filtrarGrupos(grupos, predicado) {
  const salida = [];
  for (const g of grupos || []) {
    const vales = (g.vales || []).filter(predicado);
    if (!vales.length) continue;
    salida.push(vales.length === g.vales.length ? g : { ...g, vales, total: vales.length, autorizados: vales.filter(v => v.autorizado).length, atrasados: vales.filter(v => v.atrasado).length });
  }
  return salida;
}

const filtrarSeccion = (sec, predicado) => {
  const grupos = filtrarGrupos(sec.grupos, predicado);
  return { ...sec, total: grupos.reduce((s, g) => s + g.total, 0), grupos };
};

// Devuelve un reporte nuevo con el desglose filtrado (el resto, contadores incluidos, se comparte); sin filtro, el mismo objeto.
function filtrarDesglose(reporte, { estado = null, urgentes = false } = {}) {
  const regla = estado ? REGLAS[estado] : null;
  if (!reporte || (!regla && !urgentes)) return reporte;
  const predicado = (v) => (!urgentes || v.urgente === true) && (!regla?.vale || regla.vale(v));
  const secciones = {};
  for (const [clave, sec] of Object.entries(reporte.grupos?.secciones || {})) {
    secciones[clave] = !regla || regla.secciones.includes(clave) ? filtrarSeccion(sec, predicado) : vacia(sec);
  }
  const resultado = { ...reporte, grupos: { ...reporte.grupos, secciones } };
  if (reporte.atrasadosVigentes) {
    // Los anteriores quedan fuera de «Ingresados»: con «urgentes» no cuentan.
    resultado.atrasadosVigentes = urgentes || (regla && !regla.vigentes) ? vacia(reporte.atrasadosVigentes) : reporte.atrasadosVigentes;
  }
  return resultado;
}

function etiquetaFiltroDesglose({ estado = null, urgentes = false } = {}) {
  return [ETIQUETAS[estado], urgentes ? 'Urgentes' : null].filter(Boolean).join(' + ');
}

// Etiqueta de la barra elegida en la gráfica: la misma de la pantalla (T.pdfFiltroGrupo en reportes2/textos.js; lo cruza probarEnfoqueDisenador.mjs).
function etiquetaEnfoque(columna, nombre, { modo = null, urgentes = false } = {}) {
  return `${columna}: ${nombre}${modo === 'entregados' ? ' (solo entregados)' : modo === 'tarde' ? ' (solo entregas tarde)' : urgentes ? ' (solo vales urgentes)' : ''}`;
}

// Contadores de la barra elegida: los que muestra la pantalla al enfocarla (espejo de `enfocarPayload`, enfoque.js), con Efectividad y Entregas a tiempo propias.
function contadoresEnfocados(contadores, id, { modo = null, urgentes = false } = {}) {
  const variante = modo || (urgentes ? 'urgentes' : 'todos');
  const C = contadores?.porGrupo?.[id]?.[variante];
  if (!C) return contadores;
  const resultado = { ...contadores, ...C };
  if (contadores.efectividad !== undefined && C.recibidos) {
    resultado.efectividad = C.ingresados ? Math.round(C.recibidos.total / C.ingresados * 10000) / 100 : null;
    resultado.aTiempo = C.recibidos.total ? Math.round(C.recibidos.sinAtraso / C.recibidos.total * 10000) / 100 : null;
  }
  return resultado;
}

// Para el PDF: filtra el desglose y anota los filtros en la línea de filtros, en el orden y con las palabras de las etiquetas de la pantalla
// (barra elegida, urgentes, estado). Deja `filtroDesglose` solo si hay filtro por contador (el PDF distingue «filtro sin vales»).
function aplicarFiltroPdf(reporte, { desgloseEstado = null, desgloseUrgentes = false } = {}) {
  const filtro = { estado: desgloseEstado, urgentes: desgloseUrgentes };
  const etiqueta = etiquetaFiltroDesglose(filtro);
  const partes = [reporte.enfoqueEtiqueta, desgloseUrgentes ? 'Urgentes' : null, ETIQUETAS[desgloseEstado]].filter(Boolean);
  if (!partes.length) return reporte;
  const base = etiqueta ? filtrarDesglose(reporte, filtro) : reporte;
  return { ...base, filtroDesglose: etiqueta || reporte.enfoqueEtiqueta, resumenFiltros: [...(reporte.resumenFiltros || []), `Filtrado por: ${partes.join(' · ')}`] };
}

// Deja solo el grupo `id` en el desglose (espejo de `enfocarPayload` sin urgentes); el id 0 es un grupo válido y el total del grupo se conserva.
function soloGrupoDesglose(reporte, id) {
  if (!reporte || id === null || id === undefined) return reporte;
  const enfocar = (sec) => {
    const grupos = (sec.grupos || []).filter(g => (String(g.id) === String(id) || (Array.isArray(g.ids) && g.ids.some(x => String(x) === String(id)))) && (g.vales || []).length).map(g => ({ ...g }));
    return { ...sec, total: grupos.reduce((s, g) => s + g.total, 0), grupos };
  };
  const secciones = {};
  for (const [clave, sec] of Object.entries(reporte.grupos?.secciones || {})) secciones[clave] = enfocar(sec);
  const resultado = { ...reporte, grupos: { ...reporte.grupos, secciones } };
  if (reporte.atrasadosVigentes) resultado.atrasadosVigentes = { ...reporte.atrasadosVigentes, ...enfocar(reporte.atrasadosVigentes) };
  return resultado;
}

// Barras del diseñador: estado del desglose por modo (espejo de `ESTADO_DE_MODO` del frontend, enfoque.js).
const ESTADO_DE_MODO = { entregados: 'entregados', tarde: 'entregadosConAtraso' };

module.exports = { ESTADOS_DESGLOSE, ESTADO_DE_MODO, filtrarDesglose, etiquetaFiltroDesglose, aplicarFiltroPdf, soloGrupoDesglose, etiquetaEnfoque, contadoresEnfocados };
