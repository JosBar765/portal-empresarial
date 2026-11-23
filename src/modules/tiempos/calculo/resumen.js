// src/modules/tiempos/calculo/resumen.js
// Texto de «Copiar resumen»: listo para pegar en la cotización o en el chat.
const { fechaLarga } = require('./fechas');

const dias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

function lineaDePieza(p, i) {
  const base = `${i + 1}) ${p.producto} · ${p.cantidad} pzs`;
  if (p.estado === 'ok') {
    const incluye = p.extras.length ? ` (incluye ${p.extras.map(e => e.nombre.toLowerCase()).join(', ')})` : '';
    return `${base} → ${dias(p.total)}${incluye}`;
  }
  if (p.estado === 'a_convenir') return `${base} → tiempo a convenir`;
  return `${base} → sin calcular`;
}

function resumenTexto(resultado) {
  if (!resultado || !Array.isArray(resultado.piezas)) return '';
  const v = resultado.version ? ` (tabla v${resultado.version.numero})` : '';
  const lineas = [`Pedido del ${resultado.fechaOrden ? fechaLarga(resultado.fechaOrden) : 'día de la orden'}${v}`];
  resultado.piezas.forEach((p, i) => lineas.push(lineaDePieza(p, i)));
  if (resultado.estado === 'ok') lineas.push(`Entrega: ${fechaLarga(resultado.fechaEntrega)} (${dias(resultado.dias)} hábiles)`);
  else if (resultado.estado === 'a_convenir') lineas.push('Entrega: tiempo a convenir con producción.');
  if (resultado.urgente) lineas.push('Pedido urgente: necesita autorización del gerente.');
  lineas.push('No incluye el diseño del arte interno.');
  return lineas.join('\n');
}

module.exports = { resumenTexto };
