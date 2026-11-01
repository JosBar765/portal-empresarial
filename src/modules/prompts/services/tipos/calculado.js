// src/modules/prompts/services/tipos/calculado.js
const { msg } = require('../../mensajes');
const { definirTipo } = require('./_base');

const MAX_PROFUNDIDAD = 5; // cadenas de calculados más largas se cortan en vez de recorrerse sin fin

module.exports = definirTipo({
  clave: 'calculado',
  destino: 'ninguno', // el asesor no lo envía: toma el valor de otro parámetro
  enOtrosParametros: false,

  validarEsquema(p, { parametro, claves, err }) {
    if (!claves.has(p.igual_a)) err(msg('param.igualANoExiste', { parametro, destino: String(p.igual_a) }));
    else if (p.igual_a === p.clave) err(msg('param.igualAMismo', { parametro }));
  },

  formatear: (p, crudo, ctx, profundidad) => (profundidad < MAX_PROFUNDIDAD ? ctx.formatear(p.igual_a, profundidad + 1) : ''),
  tieneValor: (p, crudo, ctx, profundidad) => profundidad < MAX_PROFUNDIDAD && ctx.tieneValor(p.igual_a, profundidad + 1),
  referencias: p => (p.igual_a ? [p.igual_a] : [])
});
