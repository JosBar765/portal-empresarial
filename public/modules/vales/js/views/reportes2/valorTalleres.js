// Valor del selector de talleres del reporte de talleres (puro: sin DOM ni estado, para probarse aislado).
// El selector en modo múltiple entrega ids sueltos («3,7,9»; vacío = todos) y ya no entrega «pais:X». Lo guardado en el navegador antes del cambio
// sí puede traerlo: se convierte a la lista de sus talleres, y los ids que ya no están en el catálogo se descartan.
import { resolverTallerIds } from '/js/filtroCascada.js';

export function normalizarValorTalleres(valor, talleres = []) {
  const conocidos = new Set(talleres.map(t => Number(t.id)));
  return resolverTallerIds(valor, talleres).filter(id => conocidos.has(id)).join(',');
}
