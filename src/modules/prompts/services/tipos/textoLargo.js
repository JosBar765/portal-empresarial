// src/modules/prompts/services/tipos/textoLargo.js
const { definirTipo } = require('./_base');
const { crearTipoTexto } = require('./_texto');
const { sinControl } = require('./_utilidades');

const base = crearTipoTexto({ clave: 'texto_largo', limiteDefecto: 'texto_largo_max_largo_defecto' });

// Con «separador», cada frase va entre comillas y se une con el conector de `textos_prompt`.
function formatear(p, crudo, ctx) {
  if (typeof crudo !== 'string') return '';
  const texto = sinControl(crudo).trim();
  if (!p.separador) return texto;
  return texto.split(p.separador).map(f => f.trim()).filter(Boolean).map(f => ctx.t('frase_comillas', { frase: f })).join(ctx.T.frases_union);
}

module.exports = definirTipo({ ...base, formatear });
