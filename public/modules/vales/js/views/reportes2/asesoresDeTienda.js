// Asesores que se ofrecen en el selector del reporte de asesores según la tienda elegida (puro: sin DOM ni estado, para probarse aislado).
// `tiendaIds`: ids que resuelve el selector de tienda (una tienda, o las de un país o grupo); vacío = todas, así que no se filtra.
// Quien no trae tienda (p. ej. el supervisor como «(yo)») se ofrece siempre.
export function asesoresDeLaTienda(asesores = [], tiendaIds = []) {
  const ids = new Set(tiendaIds.map(String));
  if (!ids.size) return asesores;
  return asesores.filter(a => a.tiendaId == null || ids.has(String(a.tiendaId)));
}
