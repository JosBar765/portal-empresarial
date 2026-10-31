// Piezas compartidas por las vistas de administración.
import { h } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { urlRecursoValida } from './recursosOps.js';

export const etiquetaEstado = (estado) => (['borrador', 'activo', 'inactivo'].includes(estado) ? t(`admin.estados.${estado}`) : estado);

export const badgeEstado = (estado) => h('span', { class: `pr-adm-badge pr-adm-badge--${estado}`, text: etiquetaEstado(estado) });

export function fechaGt(valor) {
  if (!valor) return '—';
  const f = new Date(String(valor).replace(' ', 'T'));
  return Number.isNaN(f.getTime()) ? '—' : f.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Mensajes legibles de un error de la API (errores[] o campos{} o el texto).
export function mensajesDeError(error) {
  if (Array.isArray(error.errores) && error.errores.length) return error.errores.map(String);
  const campos = error.campos && typeof error.campos === 'object' ? Object.values(error.campos).map(String) : [];
  return campos.length ? campos : [error.message];
}

// Copia al portapapeles; lanza si el navegador no lo permite (el llamador avisa).
export async function copiarTexto(texto) {
  if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texto); return; }
  throw new Error(t('admin.errores.sinPortapapeles'));
}

// Miniatura de la URL de un recurso; si no carga, explica qué revisar. Solo carga URLs https o /assets/.
export function miniaturaRecurso(url) {
  const limpia = String(url || '').trim();
  const caja = h('div', { class: 'pr-adm-rec-miniatura' });
  if (!limpia) { caja.textContent = t('admin.recursos.miniaturaSinUrl'); return caja; }
  if (!urlRecursoValida(limpia)) { caja.textContent = t('admin.recursos.miniaturaUrlInvalida'); return caja; }
  const img = h('img', { alt: t('admin.recursos.miniaturaAlt'), src: limpia });
  img.addEventListener('error', () => caja.replaceChildren(h('span', { class: 'pr-adm-rec-miniatura-error', text: t('admin.recursos.miniaturaError') })));
  caja.append(img);
  return caja;
}
