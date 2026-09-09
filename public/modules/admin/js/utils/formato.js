export function escapeHtml(texto) {
  return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Iniciales del avatar de cuenta (p. ej. "Asesor Comercial" -> "AC") — misma
// lógica duplicada en public/js/dashboard.js y public/modules/vales/js/utils/formato.js
// (no hay sistema de módulos compartido entre módulos en este proyecto).
export function inicialesAvatar(nombreCompleto) {
  const partes = (nombreCompleto || '').trim().split(/\s+/);
  const iniciales = partes.slice(0, 2).map(p => p[0]).join('');
  return iniciales.toUpperCase() || '--';
}
