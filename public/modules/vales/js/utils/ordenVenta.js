// Número de orden de venta (OV) en la pantalla (puro: sin DOM ni estado). El servidor vuelve a validar.
const BLANCOS = /[\s\p{Cc}\p{Cf}ᅟᅠ⠀ㅤﾠ]/gu;

export const limpiarOv = (texto) => String(texto ?? '').replace(BLANCOS, '');

// La cotización se sugiere solo si es un entero que sirve de OV (1 a 12 dígitos).
export function ovDeCotizacion(cotizacion) {
  const numero = Number(cotizacion);
  return Number.isInteger(numero) && numero > 0 && numero < 1e12 ? String(numero) : null;
}
