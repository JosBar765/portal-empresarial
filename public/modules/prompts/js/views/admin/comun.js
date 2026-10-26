// Piezas compartidas por la lista y el editor de productos.
import { h } from '../../utils/dom.js';

const ESTADOS = { borrador: 'Borrador', activo: 'Activo', inactivo: 'Inactivo' };

export const etiquetaEstado = (estado) => ESTADOS[estado] || estado;

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
