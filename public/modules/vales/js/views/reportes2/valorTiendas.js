// Valor del selector de tiendas de los reportes (puro: sin DOM ni estado, para probarse aislado).
// El selector en modo múltiple entrega ids sueltos («3,7,9»; vacío = todas) y ya no entrega «pais:X» ni «grupo:Y». Lo guardado en el navegador
// antes del cambio sí puede traerlos: se convierten a la lista de sus tiendas, y los ids que ya no están en el catálogo se descartan.
import { resolverTiendaIds } from '/js/filtroCascada.js';

export function normalizarValorTiendas(valor, tiendas = []) {
  const conocidos = new Set(tiendas.map(t => Number(t.id)));
  return resolverTiendaIds(valor, tiendas).filter(id => conocidos.has(id)).join(',');
}
