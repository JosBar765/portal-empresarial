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

// Mismas palabras que los contadores de la pantalla y los títulos del PDF.
const ETIQUETAS = {
  sinEntregar: 'Sin entregar',
  atrasados: 'Atrasados',
  atrasadosAnteriores: 'Atrasados (anteriores al período)',
  atrasadosActuales: 'Atrasados (período actual)',
  entregados: 'Entregados',
  entregadosConAtraso: 'Entregados con atraso',
  entregadosSinAtraso: 'Entregados sin atraso'
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

// Para el PDF: filtra el desglose, anota el filtro en la línea de filtros y deja `filtroDesglose` (el PDF distingue «filtro sin vales»).
function aplicarFiltroPdf(reporte, { desgloseEstado = null, desgloseUrgentes = false } = {}) {
  const filtro = { estado: desgloseEstado, urgentes: desgloseUrgentes };
  const etiqueta = etiquetaFiltroDesglose(filtro);
  if (!etiqueta) return reporte;
  return { ...filtrarDesglose(reporte, filtro), filtroDesglose: etiqueta, resumenFiltros: [...(reporte.resumenFiltros || []), `Desglose filtrado: ${etiqueta}`] };
}

module.exports = { ESTADOS_DESGLOSE, filtrarDesglose, etiquetaFiltroDesglose, aplicarFiltroPdf };
