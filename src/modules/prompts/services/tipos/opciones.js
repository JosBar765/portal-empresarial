// src/modules/prompts/services/tipos/opciones.js
const { msg } = require('../../mensajes');
const { definirTipo } = require('./_base');
const { esObjeto, esTextoNoVacio, etiquetaDe, verValor, sinControl, opcionDe, faltante } = require('./_utilidades');

module.exports = definirTipo({
  clave: 'opciones',
  cuentaParaGrupoVacio: true,
  ofreceUnidades: true,

  validarEsquema(p, { parametro, err }) {
    const opciones = Array.isArray(p.opciones) ? p.opciones : [];
    if (!opciones.length) return err(msg('param.opcionesVacio', { parametro }));
    const vistos = new Set();
    opciones.forEach(o => {
      if (!esObjeto(o) || !esTextoNoVacio(o.valor)) return err(msg('param.opcionValor', { parametro }));
      if (vistos.has(o.valor)) err(msg('param.opcionRepetida', { parametro, valor: o.valor }));
      vistos.add(o.valor);
      if (!esTextoNoVacio(o.etiqueta)) err(msg('param.opcionEtiqueta', { parametro, valor: o.valor }));
      if (!esTextoNoVacio(o.texto_prompt)) err(msg('param.opcionTexto', { parametro, valor: o.valor }));
    });
    if (p.defecto !== undefined && !vistos.has(p.defecto)) err(msg('param.defectoOpcion', { parametro }));
  },

  validarValor(p, crudo) {
    if (crudo === undefined || crudo === null || crudo === '') return faltante(p);
    const permitidas = (p.opciones || []).map(o => o.valor);
    if (!permitidas.includes(crudo)) return { error: msg('valor.opcion', { etiqueta: etiquetaDe(p), valor: verValor(crudo), permitidas: permitidas.join(', ') }) };
    return { valor: crudo };
  },

  formatear(p, crudo) {
    const opcion = opcionDe(p, crudo);
    return opcion ? sinControl(opcion.texto_prompt) : '';
  }
});
