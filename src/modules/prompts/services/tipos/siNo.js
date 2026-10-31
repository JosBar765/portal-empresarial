// src/modules/prompts/services/tipos/siNo.js
const { msg } = require('../../mensajes');
const { definirTipo } = require('./_base');
const { etiquetaDe } = require('./_utilidades');

module.exports = definirTipo({
  clave: 'si_no',
  valorAusente: () => false, // un interruptor sin enviar vale «no»

  validarEsquema(p, { parametro, err }) {
    if (p.defecto !== undefined && typeof p.defecto !== 'boolean') err(msg('param.defectoBooleano', { parametro }));
  },

  validarValor(p, crudo) {
    if (typeof crudo !== 'boolean') return { error: msg('valor.siNo', { etiqueta: etiquetaDe(p) }) };
    return { valor: crudo };
  },

  formatear: (p, crudo, ctx) => (crudo === true ? ctx.T.si : ctx.T.no),

  // Solo cuenta como «con valor» cuando es verdadero.
  tieneValor: (p, crudo) => crudo === true
});
