// src/modules/prompts/services/tipos/numero.js
const { msg } = require('../../mensajes');
const { definirTipo } = require('./_base');
const { esNumero, etiquetaDe, sinControl, opcionDe, faltante } = require('./_utilidades');

const aTexto = n => String(Math.round(n * 100) / 100);

module.exports = definirTipo({
  clave: 'numero',
  cuentaParaGrupoVacio: true,

  validarEsquema(p, { parametro, claves, err, tipoDe }) {
    if (p.min !== undefined && !esNumero(p.min)) err(msg('param.minTipo', { parametro }));
    if (p.max !== undefined && !esNumero(p.max)) err(msg('param.maxTipo', { parametro }));
    if (esNumero(p.min) && esNumero(p.max) && p.min > p.max) err(msg('param.minMayorQueMax', { parametro, min: p.min, max: p.max }));
    if (p.defecto !== undefined) {
      if (!esNumero(p.defecto)) err(msg('param.defectoNumero', { parametro }));
      else if ((esNumero(p.min) && p.defecto < p.min) || (esNumero(p.max) && p.defecto > p.max)) err(msg('param.defectoFueraDeRango', { parametro, defecto: p.defecto }));
    }
    if (p.unidad_de !== undefined) {
      const unidad = claves.get(p.unidad_de);
      if (!unidad) err(msg('param.unidadNoExiste', { parametro, destino: String(p.unidad_de) }));
      else if (p.unidad_de === p.clave) err(msg('param.unidadMismo', { parametro }));
      else if (!tipoDe(unidad).ofreceUnidades) err(msg('param.unidadTipo', { parametro, destino: p.unidad_de, tipo: String(unidad.tipo) }));
    }
  },

  validarValor(p, crudo) {
    if (crudo === undefined || crudo === null) return faltante(p);
    const etiqueta = etiquetaDe(p);
    if (!esNumero(crudo)) return { error: msg('valor.numero', { etiqueta }) };
    if ((esNumero(p.min) && crudo < p.min) || (esNumero(p.max) && crudo > p.max)) {
      const clave = esNumero(p.min) && esNumero(p.max) ? 'valor.rangoEntre' : (esNumero(p.min) ? 'valor.rangoMinimo' : 'valor.rangoMaximo');
      return { error: msg(clave, { etiqueta, min: p.min, max: p.max, valor: crudo }) };
    }
    return { valor: crudo };
  },

  // Con «unidad_de», el número lleva el texto de la opción elegida en ese parámetro (visible o no, como siempre).
  formatear(p, crudo, ctx) {
    if (!esNumero(crudo)) return '';
    const unidad = p.unidad_de ? ctx.parametro(p.unidad_de) : null;
    const opcion = unidad && opcionDe(unidad, ctx.crudoDe(unidad.clave));
    return opcion ? ctx.t('numero_unidad', { valor: aTexto(crudo), unidad: sinControl(opcion.texto_prompt) }) : aTexto(crudo);
  },

  referencias: p => (p.unidad_de ? [p.unidad_de] : []),
  acompanantes: p => (p.unidad_de ? [p.unidad_de] : [])
});
