// Diseñadores que se ofrecen en el selector del reporte de diseñadores según los talleres elegidos (puro: sin DOM ni estado, para probarse aislado).
// `tallerIds`: ids que resuelve el selector de talleres (uno, varios, o los de un país); vacío = todos, así que no se filtra.
// Un diseñador entra si trabaja en alguno de esos talleres.
export function disenadoresDeLosTalleres(disenadores = [], tallerIds = []) {
  const ids = new Set(tallerIds.map(String));
  if (!ids.size) return disenadores;
  return disenadores.filter(d => (d.tallerIds || []).some(id => ids.has(String(id))));
}
