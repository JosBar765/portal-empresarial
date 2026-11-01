// src/modules/prompts/services/tipos/texto.js
const { definirTipo } = require('./_base');
const { crearTipoTexto } = require('./_texto');

module.exports = definirTipo(crearTipoTexto({ clave: 'texto', limiteDefecto: 'texto_max_largo_defecto' }));
