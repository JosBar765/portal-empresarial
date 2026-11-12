// Fila de la tabla de Gestiones: HTML puro (sin DOM) para poder probarlo; todo texto del servidor pasa por escapeHtml.
import { ACCIONES, MODALIDADES } from '../config/constantes.js';
import { escapeHtml, formatearFechaCorta, formatearRangoViaje } from '../utils/formato.js';
import { htmlPipeline } from './pipeline.js';
import { celda } from './filaSolicitud.js';
import { t } from '../textos.js';

// Orden fijo de los botones; solo se dibujan los que el servidor deja en `pipeline.acciones` (ya filtradas por los permisos del usuario).
const BOTONES = [
  { accion: ACCIONES.VER, icono: 'eye-outline', texto: 'gestiones.accion.ver' },
  { accion: ACCIONES.AUTORIZAR, icono: 'checkmark-done-outline', texto: 'gestiones.accion.autorizar', clase: 'icon-success' },
  { accion: ACCIONES.RECHAZAR, icono: 'close-outline', texto: 'gestiones.accion.rechazar', clase: 'icon-danger' },
  { accion: ACCIONES.LIQUIDAR, icono: 'cash-outline', texto: 'gestiones.accion.liquidar' }
];

export function htmlAccionesGestion(solicitud) {
  const permitidas = (solicitud.pipeline && solicitud.pipeline.acciones) || [];
  return BOTONES.filter(b => permitidas.includes(b.accion)).map(b => {
    const texto = escapeHtml(t(b.texto));
    return `<button type="button" class="btn-icon${b.clase ? ` ${b.clase}` : ''}" data-accion="${b.accion}" data-id="${Number(solicitud.id)}" title="${texto}" aria-label="${texto}"><ion-icon name="${b.icono}"></ion-icon></button>`;
  }).join('');
}

const htmlSolicitante = (s) => {
  const nombre = (s.solicitante && s.solicitante.nombre) || '-';
  const pais = s.pais && s.pais.nombre;
  return `<div class="vi-solicitante"><strong>${escapeHtml(nombre)}</strong>${pais ? `<span class="vi-solicitante__pais">${escapeHtml(pais)}</span>` : ''}</div>`;
};

export function htmlFilaGestion(s) {
  const tipo = t(s.modalidad === MODALIDADES.MAS_DE_UN_DIA ? 'solicitudes.tipo.mas_de_un_dia' : 'solicitudes.tipo.hasta_un_dia');
  return `<tr data-id="${Number(s.id)}">
    ${celda('gestiones.col.correlativo', `<strong>${escapeHtml(s.correlativo)}</strong>`)}
    ${celda('gestiones.col.solicitante', htmlSolicitante(s))}
    ${celda('gestiones.col.fechaCreacion', escapeHtml(formatearFechaCorta(s.fechaCreacion)), 'vi-celda-secundaria')}
    ${celda('gestiones.col.fechaViaticos', escapeHtml(formatearRangoViaje(s)))}
    ${celda('gestiones.col.tipo', escapeHtml(tipo), 'vi-celda-secundaria')}
    ${celda('gestiones.col.estado', htmlPipeline(s.pipeline))}
    <td class="acciones-cell"><div class="acciones-wrap">${htmlAccionesGestion(s)}</div></td>
  </tr>`;
}
