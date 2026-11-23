// Enfoque local de Reportes: de un reporte ya generado saca la vista de una tienda o asesor sin consultar al servidor. Funciones puras (sin DOM ni estado).
import { aplicarFiltroContador } from './filtroContadores.js';
const mismoId = (a, b) => String(a) === String(b);

export const existeGrupo = (data, id) => id != null && !!data?.contadores?.porGrupo?.[id];

// Deja el grupo `id` (y, con `urgentes`, solo sus vales urgentes); los totales se recalculan con lo que queda.
function enfocarGrupos(grupos, id, urgentes) {
  const out = [];
  for (const g of grupos || []) {
    // Talleres: un grupo unido (varios talleres de un vale compartido) también cuenta si incluye el taller enfocado (`ids`).
    if (!mismoId(g.id, id) && !(Array.isArray(g.ids) && g.ids.some(x => mismoId(x, id)))) continue;
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

// Barras del diseñador: estado del desglose por modo (la MISMA regla vive en el servidor: valeReporteFiltroDesglose.js; la cruza probarEnfoqueDisenador.mjs).
export const ESTADO_DE_MODO = { entregados: 'entregados', tarde: 'entregadosConAtraso' };

// `modo` (todos | urgentes | entregados | tarde) manda sobre `urgentes`; los contadores salen de `porGrupo[id][modo]`.
export function enfocarPayload(data, { id, urgentes = false, modo = null } = {}) {
  if (!existeGrupo(data, id)) return data;
  const variante = modo || (urgentes ? 'urgentes' : 'todos');
  const C = data.contadores.porGrupo[id][variante];
  if (!C) return data;
  const soloUrgentes = variante === 'urgentes';
  const secciones = {};
  for (const [clave, sec] of Object.entries(data.grupos?.secciones || {})) {
    const grupos = enfocarGrupos(sec.grupos, id, soloUrgentes);
    secciones[clave] = { ...sec, total: sumaTotales(grupos), grupos };
  }
  // Efectividad y Entregas a tiempo (talleres y diseñadores) se recalculan con la barra elegida (la misma cuenta del servidor: valeReporteFiltroDesglose.js).
  const contadores = { ...data.contadores, ...C };
  if (data.contadores.efectividad !== undefined && C.recibidos) {
    contadores.efectividad = C.ingresados ? Math.round(C.recibidos.total / C.ingresados * 10000) / 100 : null;
    contadores.aTiempo = C.recibidos.total ? Math.round(C.recibidos.sinAtraso / C.recibidos.total * 10000) / 100 : null;
  }
  const resultado = { ...data, contadores, grupos: { ...data.grupos, secciones } };
  if (data.atrasadosVigentes) {
    const grupos = enfocarGrupos(data.atrasadosVigentes.grupos, id, soloUrgentes);
    resultado.atrasadosVigentes = { ...data.atrasadosVigentes, total: sumaTotales(grupos), grupos };
  }
  // Entregados / tarde: encima del grupo, el estado de la barra (mismo filtro que el de los contadores).
  return ESTADO_DE_MODO[variante] ? aplicarFiltroContador(resultado, { estado: ESTADO_DE_MODO[variante] }) : resultado;
}
