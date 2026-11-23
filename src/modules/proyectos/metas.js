// src/modules/proyectos/metas.js
// Reglas puras de las metas de ventas (sin base de datos): la meta del proyecto se reparte en partes iguales entre los asesores, el supervisor
// puede ajustar la de cada uno, la de cada tienda es la suma de sus asesores y el avance es lo vendido (confirmado) en la moneda de la meta.
const redondear = (n) => Math.round(n * 100) / 100;
const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

// `asesores`: [{ id, tiendaId }]  `ajustadas`: Map asesorId → meta fijada a mano  `vendido`: Map asesorId → vendido en la moneda de la meta.
// Ajustar la meta de uno no cambia la de los demás: la suma puede pasar (o quedar por debajo) de la meta del proyecto.
function calcular({ metaTotal, asesores, ajustadas = new Map(), vendido = new Map() }) {
  const parte = asesores.length ? redondear(metaTotal / asesores.length) : 0;
  const filas = asesores.map((a) => {
    const ajustada = ajustadas.has(a.id);
    const meta = ajustada ? ajustadas.get(a.id) : parte;
    const total = redondear(vendido.get(a.id) || 0);
    return { asesorId: a.id, tiendaId: a.tiendaId, meta, ajustada, vendido: total, avance: porcentaje(total, meta), falta: Math.max(0, redondear(meta - total)), enMeta: meta > 0 && total >= meta };
  });
  const porTienda = new Map();
  for (const f of filas) {
    const t = porTienda.get(f.tiendaId) || { tiendaId: f.tiendaId, meta: 0, vendido: 0 };
    t.meta = redondear(t.meta + f.meta);
    t.vendido = redondear(t.vendido + f.vendido);
    porTienda.set(f.tiendaId, t);
  }
  const tiendas = [...porTienda.values()].map(t => ({ ...t, avance: porcentaje(t.vendido, t.meta), falta: Math.max(0, redondear(t.meta - t.vendido)), enMeta: t.meta > 0 && t.vendido >= t.meta }));
  const vendidoTotal = redondear(filas.reduce((s, f) => s + f.vendido, 0));
  return {
    parte, filas, tiendas,
    total: { meta: metaTotal, vendido: vendidoTotal, avance: porcentaje(vendidoTotal, metaTotal), falta: Math.max(0, redondear(metaTotal - vendidoTotal)) },
    asesoresEnMeta: filas.filter(f => f.enMeta).length, tiendasEnMeta: tiendas.filter(t => t.enMeta).length
  };
}

module.exports = { calcular, redondear, porcentaje };
