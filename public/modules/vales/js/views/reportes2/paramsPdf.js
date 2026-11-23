// Parámetros de consulta del PDF según lo que se eligió en el modal del desglose. Función pura (sin DOM ni estado).
// `modo`: 'sin' | 'completo' | 'filtrado'; `enfoque`: { id, parametro, urgentes, modo } (modo: todos | urgentes | entregados | tarde) de la barra enfocada o null;
// `contador`: { estado, urgente } de los filtros por contador. Nunca devuelve parámetros vacíos o falsos.
export function paramsDesglosePdf({ modo, enfoque = null, contador = null } = {}) {
  if (modo === 'sin') return { desglose: '0' };
  if (modo !== 'filtrado') return {};
  const params = {};
  if (enfoque && enfoque.id != null) {
    params[enfoque.parametro || 'tiendaDesglose'] = String(enfoque.id);
    if (enfoque.urgentes || enfoque.modo === 'urgentes') params.soloUrgentes = '1';
    if (enfoque.modo === 'entregados' || enfoque.modo === 'tarde') params[enfoque.parametro === 'tallerDesglose' ? 'tallerModo' : 'disenadorModo'] = enfoque.modo;
  }
  if (contador?.estado) params.desgloseEstado = contador.estado;
  if (contador?.urgente) params.desgloseUrgentes = '1';
  return params;
}
