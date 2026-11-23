// src/modules/vales/services/valeReporteDisenadores.js
// Reglas puras (sin acceso a datos) de los reportes de actividad por diseñador y por taller: sección de una ficha, resumen por grupo y contadores únicos.
// Regla del dueño: un vale compartido (varios diseñadores o varios talleres) se entrega, o se atrasa, para TODOS a la vez; no hay estado por parte.
const { contadoresDeFichas, porcentajeONulo } = require('./valeReporteContadores');

// Una sola precedencia de secciones para todas las fichas: atrasados > entregados > no entregados.
function seccionDeEntrega({ abierto, vencido, entregado }) {
  const atrasado = abierto && vencido;
  return { atrasado, seccion: atrasado ? 'atrasados' : (entregado ? 'entregados' : 'noEntregados') };
}

// `grupos`: Map id -> { id, nombre, vales: fichas del vale completo }. Una fila por diseñador, de más a menos asignados.
function resumenPorDisenador(grupos) {
  return [...grupos.values()].map(g => {
    const entregados = g.vales.filter(f => f.terminado);
    const tarde = entregados.filter(f => f.diasTarde > 0).length;
    return { id: g.id, nombre: g.nombre, asignados: g.vales.length, entregados: entregados.length, tarde,
      efectividad: porcentajeONulo(entregados.length, g.vales.length), tardias: porcentajeONulo(tarde, entregados.length) };
  }).sort((a, b) => b.asignados - a.asignados || a.nombre.localeCompare(b.nombre, 'es'));
}

// Aviso de la gráfica por diseñador: en pantalla es la ayuda del ícono y en el PDF va impreso (el mismo texto: lo cruza probarTextosPantallaPdf.mjs).
const NOTA_DISENADORES = 'Un vale compartido cuenta en cada diseñador que lo trabaja y se entrega, o se atrasa, para todos ellos a la vez; por eso la suma de los diseñadores puede superar los totales.';

// Mismo resumen para el reporte de talleres: una fila por taller con el estado del vale completo.
const resumenPorGrupo = resumenPorDisenador;

// Contadores de todo el reporte sobre vales ÚNICOS (las fichas de vale) más efectividad y entregas a tiempo.
function contadoresUnicos(fichasUnicas) {
  const c = contadoresDeFichas({ fichas: fichasUnicas });
  return { ...c, efectividad: porcentajeONulo(c.recibidos.total, c.ingresados), aTiempo: porcentajeONulo(c.recibidos.sinAtraso, c.recibidos.total) };
}

module.exports = { seccionDeEntrega, resumenPorDisenador, resumenPorGrupo, contadoresUnicos, NOTA_DISENADORES };
