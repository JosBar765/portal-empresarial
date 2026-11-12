// Necesario para toda interpolación en innerHTML de texto que venga de otra persona.
export function escapeHtml(texto) {
  return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Fechas siempre dd/mm/aaaa; las del servidor llegan como texto «AAAA-MM-DD» o «AAAA-MM-DD HH:mm:ss».
export function formatearFecha(valor) {
  if (!valor) return '-';
  const [f] = String(valor).split(/[ T]/);
  const [y, m, d] = f.split('-');
  if (!y || !m || !d) return String(valor);
  return `${d}/${m}/${y}`;
}

export function formatearFechaHora(valor) {
  if (!valor) return '-';
  const [f, h] = String(valor).replace('T', ' ').split(' ');
  const [y, m, d] = f.split('-');
  if (!y || !m || !d) return String(valor);
  const hm = (h || '').slice(0, 5);
  return `${d}/${m}/${y}${hm ? ' ' + hm : ''}`;
}

export function formatearTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// «Q 2,212.86»: miles con coma y dos decimales; el servidor ya redondeó, aquí solo se presenta.
export function formatearDinero(simbolo, importe) {
  const numero = Number(importe);
  if (importe == null || importe === '' || !Number.isFinite(numero)) return '-';
  const [entero, decimales] = Math.abs(numero).toFixed(2).split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const negativo = numero < 0 && (entero !== '0' || decimales !== '00');
  return `${negativo ? '-' : ''}${simbolo ? `${simbolo} ` : ''}${miles}.${decimales}`;
}

// Iniciales del avatar de cuenta (p. ej. "Asesor Comercial" -> "AC").
export function inicialesAvatar(nombreCompleto) {
  const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '--';
  const iniciales = palabras.length === 1 ? palabras[0][0] : palabras[0][0] + palabras[1][0];
  return iniciales.toUpperCase();
}
