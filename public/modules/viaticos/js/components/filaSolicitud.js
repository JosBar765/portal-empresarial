// Fila de la tabla «Mis solicitudes»: HTML puro (sin DOM) para poder probarlo; todo texto del servidor pasa por escapeHtml.
import { ACCIONES, MODALIDADES } from '../config/constantes.js';
import { escapeHtml, formatearFechaCorta, formatearRangoViaje } from '../utils/formato.js';
import { htmlPipeline } from './pipeline.js';
import { t } from '../textos.js';

// Orden fijo de los botones; solo se dibujan los que el servidor deja en `pipeline.acciones`.
const BOTONES = [
  { accion: ACCIONES.VER, icono: 'eye-outline', texto: 'solicitudes.accion.ver' },
  { accion: ACCIONES.MODIFICAR, icono: 'settings-outline', texto: 'solicitudes.accion.modificar' },
  { accion: ACCIONES.DAR_DE_BAJA, icono: 'ban-outline', texto: 'solicitudes.accion.darDeBaja', clase: 'icon-danger' },
  { accion: ACCIONES.LIQUIDAR, icono: 'cash-outline', texto: 'solicitudes.accion.liquidar' }
];

export function htmlAcciones(solicitud) {
  const permitidas = (solicitud.pipeline && solicitud.pipeline.acciones) || [];
  return BOTONES.filter(b => permitidas.includes(b.accion)).map(b => {
    const texto = escapeHtml(t(b.texto));
    return `<button type="button" class="btn-icon${b.clase ? ` ${b.clase}` : ''}" data-accion="${b.accion}" data-id="${Number(solicitud.id)}" title="${texto}" aria-label="${texto}"><ion-icon name="${b.icono}"></ion-icon></button>`;
  }).join('');
}

const celda = (clave, contenido, clase = '') => `<td data-label="${escapeHtml(t(clave))}"${clase ? ` class="${clase}"` : ''}>${contenido}</td>`;

export function htmlFilaSolicitud(s) {
  const tipo = t(s.modalidad === MODALIDADES.MAS_DE_UN_DIA ? 'solicitudes.tipo.mas_de_un_dia' : 'solicitudes.tipo.hasta_un_dia');
  return `<tr data-id="${Number(s.id)}">
    ${celda('solicitudes.col.correlativo', `<strong>${escapeHtml(s.correlativo)}</strong>`)}
    ${celda('solicitudes.col.fechaCreacion', escapeHtml(formatearFechaCorta(s.fechaCreacion)), 'vi-celda-secundaria')}
    ${celda('solicitudes.col.fechaViaticos', escapeHtml(formatearRangoViaje(s)))}
    ${celda('solicitudes.col.tipo', escapeHtml(tipo), 'vi-celda-secundaria')}
    ${celda('solicitudes.col.estado', htmlPipeline(s.pipeline))}
    <td class="acciones-cell"><div class="acciones-wrap">${htmlAcciones(s)}</div></td>
  </tr>`;
}
