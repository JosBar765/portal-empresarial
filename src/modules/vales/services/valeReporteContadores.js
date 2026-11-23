// src/modules/vales/services/valeReporteContadores.js
// Contadores de Reportes (módulo puro, sin acceso a datos): una sola implementación de las reglas de conteo, para el total del reporte y para cada grupo.
// Hasta dos decimales en todos los porcentajes de Reportes; `porcentajeONulo` distingue «sin base» (null) de un 0 real.
const porcentajeDe = (parte, total) => (total ? Math.round(parte / total * 10000) / 100 : 0);
const porcentajeONulo = (parte, total) => (total ? Math.round(parte / total * 10000) / 100 : null);

// Texto de un porcentaje para el PDF: mismo resultado que public/modules/vales/js/utils/formatoPorcentaje.js (hay un cruce en probarEnfoqueDisenador).
const formatearPorcentaje = (n) => {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '—';
  const redondeado = Math.round(Number(n) * 100) / 100;
  return String(Object.is(redondeado, -0) ? 0 : redondeado);
};
const conSimboloPorcentaje = (n) => {
  const texto = formatearPorcentaje(n);
  return texto === '—' ? texto : `${texto} %`;
};

// Textos de detalle de las tarjetas, IGUALES a los de la pantalla (TEXTOS_* de reportes2/textos.js; los cruza probarTextosPantallaPdf.mjs).
const plural = (n, uno, varios) => (n === 1 ? uno : varios);
const detalleUrgentes = (total, ingresados) => `${total} de ${ingresados} ${plural(ingresados, 'vale', 'vales')}`;
const detalleEfectividad = (entregados, ingresados, atrasados = 0) => `${entregados} de ${ingresados} ${plural(ingresados, 'vale entregado', 'vales entregados')}${atrasados > 0 ? ` (${atrasados} ${plural(atrasados, 'atrasado', 'atrasados')})` : ''}`;
const detalleATiempo = (aTiempo, entregas) => `${aTiempo} de ${entregas} ${plural(entregas, 'entrega', 'entregas')}`;

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
// Con `conEntrega` (diseñadores) se añaden las variantes «entregados» y «tarde», según la parte de cada diseñador.
function contadoresPorGrupo(grupos, { conEntrega = false } = {}) {
  const resultado = {};
  for (const [id, fichas] of grupos) {
    resultado[id] = { todos: contadoresDeFichas({ fichas }), urgentes: contadoresDeFichas({ fichas: fichas.filter(f => f.urgente) }) };
    if (conEntrega) {
      resultado[id].entregados = contadoresDeFichas({ fichas: fichas.filter(f => f.terminado) });
      resultado[id].tarde = contadoresDeFichas({ fichas: fichas.filter(f => f.terminado && f.diasTarde > 0) });
    }
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
    // Un «anterior» está abierto por definición: las variantes entregados y tarde no lo tienen.
    for (const variante of ['entregados', 'tarde']) if (c[variante]) resultado[id][variante] = con(c[variante], 0);
  }
  return resultado;
}

module.exports = { contadoresDeFichas, contadoresPorGrupo, completarPorGrupo, porcentajeDe, porcentajeONulo, formatearPorcentaje, conSimboloPorcentaje, detalleUrgentes, detalleEfectividad, detalleATiempo };
