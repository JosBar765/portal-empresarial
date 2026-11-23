// Texto corto de un cambio del historial, igual en el inicio y en la pantalla de historial.
export function textoDeCambio(cambio) {
  if (cambio.accionCodigo === 'crear') return `Nuevo: ${cambio.objeto}`;
  const [primero, ...resto] = cambio.cambios;
  if (!primero) return cambio.objeto;
  const base = primero.campo === 'Valor'
    ? `${cambio.objeto}: ${primero.antes} → ${primero.despues}`
    : `${cambio.objeto} · ${primero.campo}: ${primero.antes} → ${primero.despues}`;
  return resto.length ? `${base} (+${resto.length} más)` : base;
}
