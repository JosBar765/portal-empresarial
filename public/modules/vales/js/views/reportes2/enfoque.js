// Enfoque local de Reportes: de un reporte ya generado saca la vista de una tienda o asesor sin consultar al servidor. Funciones puras (sin DOM ni estado).
const mismoId = (a, b) => String(a) === String(b);

export const existeGrupo = (data, id) => id != null && !!data?.contadores?.porGrupo?.[id];

// Deja el grupo `id` (y, con `urgentes`, solo sus vales urgentes); los totales se recalculan con lo que queda.
function enfocarGrupos(grupos, id, urgentes) {
  const out = [];
  for (const g of grupos || []) {
    if (!mismoId(g.id, id)) continue;
    const vales = urgentes ? g.vales.filter(v => v.urgente === true) : g.vales;
    if (!vales.length) continue;
    // Sin filtro de urgentes el total del grupo ya viene exacto del servidor (aunque el listado esté recortado).
    out.push(urgentes ? { ...g, vales, total: vales.length, autorizados: vales.filter(v => v.autorizado).length, atrasados: vales.filter(v => v.atrasado).length } : { ...g, vales });
  }
  return out;
}

const sumaTotales = (grupos) => grupos.reduce((s, g) => s + g.total, 0);

// Vales que se imprimirían en el desglose de la vista (secciones del período y atrasados anteriores); sirve para avisar si el PDF será largo.
export function contarFilasDesglose(vista) {
  const suma = (grupos) => (grupos || []).reduce((s, g) => s + (g.vales ? g.vales.length : 0), 0);
  const delPeriodo = Object.values(vista?.grupos?.secciones || {}).reduce((s, sec) => s + suma(sec.grupos), 0);
  return delPeriodo + suma(vista?.atrasadosVigentes?.grupos);
}

export function enfocarPayload(data, { id, urgentes = false } = {}) {
  if (!existeGrupo(data, id)) return data;
  const C = data.contadores.porGrupo[id][urgentes ? 'urgentes' : 'todos'];
  if (!C) return data;
  const secciones = {};
  for (const [clave, sec] of Object.entries(data.grupos?.secciones || {})) {
    const grupos = enfocarGrupos(sec.grupos, id, urgentes);
    secciones[clave] = { ...sec, total: sumaTotales(grupos), grupos };
  }
  const resultado = { ...data, contadores: { ...data.contadores, ...C }, grupos: { ...data.grupos, secciones } };
  if (data.atrasadosVigentes) {
    const grupos = enfocarGrupos(data.atrasadosVigentes.grupos, id, urgentes);
    resultado.atrasadosVigentes = { ...data.atrasadosVigentes, total: sumaTotales(grupos), grupos };
  }
  return resultado;
}
