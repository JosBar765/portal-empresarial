// Números escritos a mano (sin DOM). El servidor decide si el valor es válido; aquí solo se unifica el formato.

// Deja solo lo que puede formar un número: dígitos y, en los decimales, «,» y «.».
export function limpiarEntradaNumerica(texto, { entero = false } = {}) {
  return String(texto ?? '').replace(entero ? /[^0-9]/g : /[^0-9.,]/g, '');
}

// «1,234.50», «1.234,50», «12,5» y «12.5» -> texto canónico con punto («1234.50», «12.5»).
// Devuelve '' si está vacío y null si no es un número. El último separador es el decimal; los anteriores
// solo valen como miles (grupos de 3). Los decimales sobrantes no se recortan: el servidor los rechaza con su regla.
export function normalizarDecimal(texto) {
  const s = String(texto ?? '').replace(/\s+/g, '');
  if (s === '') return '';
  if (!/^[0-9.,]+$/.test(s)) return null;
  const comas = (s.match(/,/g) || []).length;
  const puntos = (s.match(/\./g) || []).length;
  const mezcla = comas > 0 && puntos > 0;
  let entera = s;
  let decimal = '';
  if (mezcla || comas + puntos === 1) {
    const ultimo = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    entera = s.slice(0, ultimo);
    decimal = s.slice(ultimo + 1);
  }
  if (!/^(\d{1,3}([.,]\d{3})+|\d*)$/.test(entera)) return null;
  entera = entera.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '') || '0';
  return decimal ? `${entera}.${decimal}` : entera;
}

// Número para mostrar o comparar; null si está vacío o no es un número.
export function aNumero(texto) {
  const canonico = normalizarDecimal(texto);
  if (canonico === '' || canonico === null) return null;
  return Number(canonico);
}

// Cantidad sin dinero (km, horas, noches): entera si lo es, con dos decimales si no; con coma para los miles.
export function formatearCantidad(valor) {
  const n = Number(valor);
  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(n)) return '0';
  const [entero, decimales] = (Number.isInteger(n) ? String(n) : n.toFixed(2)).split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimales ? `${miles}.${decimales}` : miles;
}
