// Los ids del estado son número o '' (sin elegir); un <select> entrega texto.
export function aId(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  const n = Number(valor);
  return Number.isInteger(n) ? n : '';
}
