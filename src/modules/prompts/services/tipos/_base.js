// src/modules/prompts/services/tipos/_base.js
// Contrato de un tipo de parámetro: cada definición declara solo lo que le es propio y hereda el resto de estos valores.
//
//   clave                   nombre del tipo en el esquema JSON
//   destino                 dónde viaja el valor del asesor: 'valores', 'imagenes' (además aporta imágenes numeradas al prompt) o 'ninguno' (no se envía)
//   cuentaParaGrupoVacio    si su valor cuenta para grupo_<clave>_vacio
//   enOtrosParametros       si aparece en la sección generada otros_parametros
//   ofreceUnidades          si un parámetro «numero» puede usarlo como «unidad_de»
//   valorAusente(p)         valor efectivo cuando el asesor no envía nada y el parámetro no tiene defecto
//   validarEsquema(p, ctx)  errores de los campos propios (ctx: parametro, claves, ajustes, err, tipoDe)
//   validarValor(p, crudo, ctx) -> { valor?, error? } valor limpio o error para el asesor (ctx: ajustes, aviso)
//   formatear(p, crudo, ctx, profundidad) -> texto del valor en el prompt ('' si no hay)
//   tieneValor(p, crudo, ctx, profundidad) -> bool para {{#si}}, {{#no}}, grupo_<g>_vacio y otros_parametros
//   adjuntos(p, crudo)      imágenes que el parámetro aporta al prompt (solo los tipos con destino 'imagenes')
//   referencias(p)          claves que el parámetro referencia: si se nombra, ellas también cuentan como nombradas
//   acompanantes(p)         claves que ya acompañan al valor y la sección generada no repite
const POR_DEFECTO = {
  destino: 'valores',
  cuentaParaGrupoVacio: false,
  enOtrosParametros: true,
  ofreceUnidades: false,
  valorAusente: () => undefined,
  validarEsquema: () => {},
  validarValor: () => ({}),
  formatear: () => '',
  tieneValor: (p, crudo, ctx, profundidad) => ctx.formatear(p.clave, profundidad) !== '',
  adjuntos: () => [],
  referencias: () => [],
  acompanantes: () => []
};

const definirTipo = definicion => Object.freeze({ ...POR_DEFECTO, ...definicion });

module.exports = { definirTipo };
