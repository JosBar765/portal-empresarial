// src/modules/vales/services/valeReporteContadores.js
// Contadores de Reportes (módulo puro, sin acceso a datos): una sola implementación de las reglas de conteo, para el total del reporte y para cada grupo.
const porcentajeDe = (parte, total) => (total ? Math.round(parte / total * 100) : 0);

// `fichas`: las fichas de vale del período (seccion, urgente, diasTarde); `anteriores`: atrasados anteriores al período, que no son fichas del período.
function contadoresDeFichas({ fichas = [], anteriores = 0 } = {}) {
  const urgentes = fichas.filter(f => f.urgente).length;
  const recibidos = fichas.filter(f => f.seccion === 'entregados');
  // Con atraso = el mismo diasTarde de la sección Entregados; el resto de los recibidos llegó a tiempo.
  const conAtraso = recibidos.filter(f => f.diasTarde > 0).length;
  const actuales = fichas.filter(f => f.seccion === 'atrasados').length;
  return {
    ingresados: fichas.length,
    urgentes: { total: urgentes, porcentaje: porcentajeDe(urgentes, fichas.length) },
    sinEntregar: fichas.filter(f => f.seccion === 'noEntregados').length,
    atrasados: { total: anteriores + actuales, anteriores, actuales },
    recibidos: { total: recibidos.length, conAtraso, sinAtraso: recibidos.length - conAtraso }
  };
}

// `grupos`: Map id -> fichas del grupo. Devuelve { id: { todos, urgentes } }; «urgentes» cuenta solo los vales urgentes del grupo.
function contadoresPorGrupo(grupos) {
  const resultado = {};
  for (const [id, fichas] of grupos) {
    resultado[id] = { todos: contadoresDeFichas({ fichas }), urgentes: contadoresDeFichas({ fichas: fichas.filter(f => f.urgente) }) };
  }
  return resultado;
}

// Suma los atrasados anteriores al período de cada grupo; `anteriores`: { id: { todos, urgentes } } (sin dato = 0).
function completarPorGrupo(porGrupo, anteriores = {}) {
  const resultado = {};
  for (const [id, c] of Object.entries(porGrupo || {})) {
    const previo = anteriores[id] || {};
    const con = (cont, n = 0) => ({ ...cont, atrasados: { total: n + cont.atrasados.actuales, anteriores: n, actuales: cont.atrasados.actuales } });
    resultado[id] = { todos: con(c.todos, previo.todos), urgentes: con(c.urgentes, previo.urgentes) };
  }
  return resultado;
}

module.exports = { contadoresDeFichas, contadoresPorGrupo, completarPorGrupo };
