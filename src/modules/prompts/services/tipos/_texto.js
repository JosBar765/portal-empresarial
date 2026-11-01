// src/modules/prompts/services/tipos/_texto.js
// Lo que comparten `texto` y `texto_largo`; se diferencian en el límite por defecto y en cómo se formatean.
const { msg } = require('../../mensajes');
const { etiquetaDe, sinControl, faltante } = require('./_utilidades');

function crearTipoTexto({ clave, limiteDefecto }) {
  return {
    clave,
    cuentaParaGrupoVacio: true,

    validarEsquema(p, { parametro, ajustes, err }) {
      const L = ajustes.limites;
      if (p.max_largo !== undefined && !(Number.isInteger(p.max_largo) && p.max_largo >= 1 && p.max_largo <= L.max_largo_tope)) {
        err(msg('param.maxLargo', { parametro, tope: L.max_largo_tope, valor: JSON.stringify(p.max_largo) }));
      }
      if (p.separador !== undefined && !(typeof p.separador === 'string' && p.separador.length >= 1 && p.separador.length <= L.separador_max)) {
        err(msg('param.separador', { parametro, max: L.separador_max }));
      }
    },

    validarValor(p, crudo, { ajustes }) {
      if (crudo === undefined || crudo === null) return faltante(p);
      const etiqueta = etiquetaDe(p);
      if (typeof crudo !== 'string') return { error: msg('valor.texto', { etiqueta }) };
      const texto = crudo.trim();
      if (!texto) return faltante(p);
      const max = p.max_largo || ajustes.limites[limiteDefecto];
      if (texto.length > max) return { error: msg('valor.textoLargo', { etiqueta, max, largo: texto.length }) };
      return { valor: texto };
    },

    formatear: (p, crudo) => (typeof crudo === 'string' ? sinControl(crudo).trim() : '')
  };
}

module.exports = { crearTipoTexto };
