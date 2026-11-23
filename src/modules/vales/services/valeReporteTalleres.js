// src/modules/vales/services/valeReporteTalleres.js
// Reglas puras (sin acceso a datos) del desglose de los reportes de actividad de talleres y de diseñadores (mismo tratamiento: un vale compartido sale una vez).
// Un vale compartido (varios talleres) se entrega, o se atrasa, para todos sus talleres a la vez; por eso el desglose general lo muestra UNA sola vez,
// con todos sus talleres juntos en la columna, y no una fila por taller.

const SEPARADOR = ', ';

// Aviso de la gráfica por taller: en pantalla es la ayuda del ícono y en el PDF va impreso (el mismo texto: lo cruza probarTextosPantallaPdf.mjs).
const NOTA_TALLERES = 'Un vale que pasa por varios talleres cuenta una sola vez en los contadores de arriba y una vez en cada taller de la gráfica; por eso la suma de las barras puede ser mayor que los totales.';

// Cada grupo unido lleva `nombres` (los talleres que lo forman: la pantalla dibuja una píldora por taller y el PDF imprime `nombre`) e `ids` (los mismos
// talleres por id: enfocar un taller deja los grupos que lo incluyen, y el vale se sigue viendo con TODOS sus talleres).

// `seccion`: { total, grupos: [{ id, nombre, vales }] } con un grupo por taller (el mismo vale puede estar en varios).
// Devuelve la misma forma con un grupo por conjunto de talleres («Diseño, Diseño UV/3D») y cada vale una sola vez.
function unirSeccionPorVale(seccion) {
  const grupos = (seccion && seccion.grupos) || [];
  if (!grupos.length) return seccion;
  const porVale = new Map(); // id del vale -> { vale, nombres: nombre -> id del taller }
  for (const g of grupos) {
    for (const v of g.vales || []) {
      if (!porVale.has(v.id)) porVale.set(v.id, { vale: v, nombres: new Map() });
      const entrada = porVale.get(v.id);
      // Los talleres (o diseñadores) de un vale son TODOS a los que fue (`talleresDelVale` / `disenadoresDelVale`), no solo el del grupo: filtrar por uno no esconde a los demás.
      // Las filas del reporte de diseñadores traen las dos listas: ahí manda la de diseñadores (aunque esté vacía: «Sin asignar»); en talleres solo hay la de talleres.
      const todos = Array.isArray(v.disenadoresDelVale) ? v.disenadoresDelVale : v.talleresDelVale;
      if (Array.isArray(todos) && todos.length) todos.forEach(t => entrada.nombres.set(t.nombre, t.id));
      else entrada.nombres.set(g.nombre, g.id);
    }
  }
  const porConjunto = new Map(); // «Diseño, Diseño UV/3D» -> { vales (en el orden en que ya venían), ids }
  for (const { vale, nombres } of porVale.values()) {
    const ordenados = [...nombres].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es'));
    const nombre = ordenados.map(([n]) => n).join(SEPARADOR);
    if (!porConjunto.has(nombre)) porConjunto.set(nombre, { vales: [], ids: ordenados.map(([, id]) => id) });
    porConjunto.get(nombre).vales.push(vale);
  }
  // Todo el desglose va por fecha de entrega: los vales de cada fila y las filas por su primer vale.
  const porFecha = (a, b) => String(a.fechaEntrega).localeCompare(String(b.fechaEntrega)) || a.id - b.id;
  const unidos = [...porConjunto].map(([nombre, { vales: sinOrden, ids }]) => ({ vales: sinOrden.sort(porFecha), nombre, ids })).map(({ nombre, ids, vales }) => ({
    clave: `taller:${nombre}`, id: nombre, nombre, nombres: nombre.split(SEPARADOR), ids, vales, total: vales.length,
    autorizados: vales.filter(v => v.autorizado).length, atrasados: vales.filter(v => v.atrasado).length
  })).sort((a, b) => porFecha(a.vales[0], b.vales[0]) || a.nombre.localeCompare(b.nombre, 'es'));
  return { ...seccion, total: unidos.reduce((s, g) => s + g.total, 0), grupos: unidos };
}

// `secciones`: { atrasados, noEntregados, entregados } -> las mismas con cada vale una sola vez.
function unirSeccionesPorVale(secciones) {
  const resultado = {};
  for (const [clave, sec] of Object.entries(secciones || {})) resultado[clave] = unirSeccionPorVale(sec);
  return resultado;
}

module.exports = { unirSeccionPorVale, unirSeccionesPorVale, NOTA_TALLERES };
