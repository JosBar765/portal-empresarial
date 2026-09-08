// Fechas siempre dd/mm/aaaa; solo la fecha de ingreso (y los logs de
// historial) muestran también la hora, como dd/mm/aaaa hh:mm.
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

export function iconoParaArchivo(file) {
  if (file.type.startsWith('image/')) return 'image-outline';
  if (file.type === 'application/pdf') return 'document-text-outline';
  return 'document-outline';
}

// Iniciales del avatar de cuenta (p. ej. "Asesor Comercial" -> "AC") — misma
// lógica duplicada en public/js/dashboard.js (no hay sistema de módulos
// compartido entre páginas en este proyecto).
export function inicialesAvatar(nombreCompleto) {
  const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '--';
  const iniciales = palabras.length === 1 ? palabras[0][0] : palabras[0][0] + palabras[1][0];
  return iniciales.toUpperCase();
}

// "Diseño, Diseño UV/3D" en texto plano se leía como una sola frase larga en
// vez de dos talleres distintos — reusa el mismo chip .taller-tag del
// selector de talleres del formulario de creación (solo lectura).
export function celdaTaller(v) {
  const texto = v.taller || '-';
  if (texto === '-') return '-';
  return `<div class="taller-tags-cell">${texto.split(', ').map(t => `<span class="taller-tag">${t}</span>`).join('')}</div>`;
}

// En Trabajo Realizado un mismo vale puede traer 2 filas (fusión + propuesta
// propia) con el mismo `id` — una clave por fila evita que ambas colisionen
// en el DOM/estado de acciones en curso.
export function claveFila(v) {
  return v._rowKey || String(v.id);
}

export function marcadorTipoRegistro(v) {
  if (v._tipoRegistro === 'FUSION') {
    return ' <span class="tag-tipo-registro" title="Fusión final de las propuestas de los talleres">(F)</span>';
  }
  if (v._tipoRegistro === 'PROPUESTA') {
    return ' <span class="tag-tipo-registro" title="Propuesta realizada por su taller">(P)</span>';
  }
  return '';
}
