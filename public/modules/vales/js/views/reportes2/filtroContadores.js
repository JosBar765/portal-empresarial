// Filtro por contador de Reportes 2: de la vista ya enfocada deja solo los vales del contador elegido, sin consultar. Funciones puras (sin DOM ni estado).
// ATENCIÓN: la MISMA regla vive en el servidor (src/modules/vales/services/valeReporteFiltroDesglose.js, la usa el PDF con filtros): si cambias una, cambia la otra
// y corre `node scripts/reportes/probarFiltroDesglose.mjs` antes y después (falla si difieren).
export const ESTADOS_FILTRO = ['sinEntregar', 'atrasados', 'atrasadosAnteriores', 'atrasadosActuales', 'entregados', 'entregadosConAtraso', 'entregadosSinAtraso'];

// Qué secciones del período y si los atrasados anteriores entran en cada filtro de estado; `vale` afina dentro de la sección.
const REGLAS = {
  sinEntregar: { secciones: ['noEntregados'], vigentes: false },
  atrasados: { secciones: ['atrasados'], vigentes: true },
  atrasadosAnteriores: { secciones: [], vigentes: true },
  atrasadosActuales: { secciones: ['atrasados'], vigentes: false },
  entregados: { secciones: ['entregados'], vigentes: false },
  entregadosConAtraso: { secciones: ['entregados'], vigentes: false, vale: v => Number(v.diasTarde) > 0 },
  entregadosSinAtraso: { secciones: ['entregados'], vigentes: false, vale: v => !(Number(v.diasTarde) > 0) }
};

const VACIA = (sec) => ({ ...sec, total: 0, grupos: [] });

// Los grupos que no pierden vales se dejan tal cual (su total exacto viene del servidor, aunque el listado esté recortado).
function filtrarGrupos(grupos, predicado) {
  const out = [];
  for (const g of grupos || []) {
    const vales = (g.vales || []).filter(predicado);
    if (!vales.length) continue;
    out.push(vales.length === g.vales.length ? g : { ...g, vales, total: vales.length, autorizados: vales.filter(v => v.autorizado).length, atrasados: vales.filter(v => v.atrasado).length });
  }
  return out;
}

const filtrarSeccion = (sec, predicado) => {
  const grupos = filtrarGrupos(sec.grupos, predicado);
  return { ...sec, total: grupos.reduce((s, g) => s + g.total, 0), grupos };
};

export function aplicarFiltroContador(vista, { estado = null, urgente = false } = {}) {
  const regla = estado ? REGLAS[estado] : null;
  if (!vista || (!regla && !urgente)) return vista;
  const predicado = (v) => (!urgente || v.urgente === true) && (!regla?.vale || regla.vale(v));
  const secciones = {};
  for (const [clave, sec] of Object.entries(vista.grupos?.secciones || {})) {
    secciones[clave] = !regla || regla.secciones.includes(clave) ? filtrarSeccion(sec, predicado) : VACIA(sec);
  }
  const resultado = { ...vista, grupos: { ...vista.grupos, secciones } };
  if (vista.atrasadosVigentes) {
    // Los anteriores quedan fuera de «Ingresados»: con «urgente» no cuentan.
    resultado.atrasadosVigentes = urgente || (regla && !regla.vigentes) ? VACIA(vista.atrasadosVigentes) : vista.atrasadosVigentes;
  }
  return resultado;
}

// Hay al menos un vale por listar en la vista.
export function hayVales(vista) {
  const hay = (grupos) => (grupos || []).some(g => g.vales?.length);
  return Object.values(vista?.grupos?.secciones || {}).some(s => hay(s.grupos)) || hay(vista?.atrasadosVigentes?.grupos);
}
