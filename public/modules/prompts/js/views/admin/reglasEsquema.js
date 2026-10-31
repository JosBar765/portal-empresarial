// ÚNICO lugar con reglas ESTRUCTURALES que reflejan las del backend (src/modules/prompts/constantes.js y esquemaService.js).
// Límites numéricos, formatos y variables automáticas NO van aquí: vienen de GET /api/prompts/config.
export const ESQUEMA_VERSION = 1;
export const CLAVE_RE = /^[a-z][a-z0-9_]{1,59}$/;
export const CODIGO_PRODUCTO_RE = /^[a-z][a-z0-9_]{1,49}$/;
export const CODIGO_PRODUCTO_LARGO_MAX = 50;
export const CLAVE_LARGO_MAX = 60;
export const PREFIJO_RECURSO = 'recurso_';
export const PREFIJO_GRUPO = 'grupo_';
export const SUFIJO_GRUPO_VACIO = '_vacio';
export const POSICIONES = ['inicio', 'fin'];
export const URL_RECURSO_RE = /^(https:\/\/\S+|\/assets\/\S+)$/;

// Valores de tipo; su texto visible sale de textos.js (admin.tipos.<valor>).
export const TIPOS = ['texto', 'texto_largo', 'numero', 'opciones', 'si_no', 'imagenes', 'calculado'];

// Largos de columnas y campos estructurales (no son ajustes editables).
export const LARGOS = { parametroEtiqueta: 120, ayuda: 200, grupoEtiqueta: 80, opcionValor: 60, opcionEtiqueta: 80, opcionTexto: 120 };
