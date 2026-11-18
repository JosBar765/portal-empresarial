// Orden por encabezado de las tablas de Solicitudes y Gestiones: se aplica en el navegador sobre la lista ya cargada.
import { escapeHtml } from './formato.js';
import { t } from '../textos.js';

// «Fecha viáticos» ordena por la fecha de salida (ISO, así que el texto ya ordena bien).
const VALOR = {
  correlativo: (s) => String(s.correlativo || ''),
  fechaCreacion: (s) => String(s.fechaCreacion || ''),
  fechaViaticos: (s) => String(s.fechaSalida || '')
};

const ARIA = { asc: 'ascending', desc: 'descending' };
const ICONO = { asc: 'arrow-up-outline', desc: 'arrow-down-outline' };

// Ciclo por columna: ascendente, descendente y sin orden (vuelve al orden por estados del servidor).
export function siguienteOrden(actual, clave) {
  if (!actual || actual.clave !== clave) return { clave, direccion: 'asc' };
  return actual.direccion === 'asc' ? { clave, direccion: 'desc' } : null;
}

// numeric: «VIA-GT-26» va después de «VIA-GT-000025» aunque los correlativos viejos lleven ceros.
export function ordenar(lista, orden) {
  const valor = orden && VALOR[orden.clave];
  if (!valor) return lista;
  const signo = orden.direccion === 'asc' ? 1 : -1;
  return [...lista].sort((a, b) => signo * valor(a).localeCompare(valor(b), 'es', { numeric: true }));
}

export function htmlCabecera(clave, texto, orden) {
  const etiqueta = escapeHtml(texto);
  if (!VALOR[clave]) return `<th>${etiqueta}</th>`;
  const direccion = orden && orden.clave === clave ? orden.direccion : null;
  const titulo = escapeHtml(t('orden.ordenarPor', { columna: texto }));
  return `<th aria-sort="${ARIA[direccion] || 'none'}"><button type="button" class="vi-th-orden${direccion ? ' vi-th-orden--activo' : ''}" data-orden="${clave}" title="${titulo}" aria-label="${titulo}"><span>${etiqueta}</span><ion-icon name="${ICONO[direccion] || 'swap-vertical-outline'}"></ion-icon></button></th>`;
}
