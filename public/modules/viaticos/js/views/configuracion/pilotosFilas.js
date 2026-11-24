// Fila de «Pilotos» como HTML puro (sin DOM); todo texto del servidor pasa por escapeHtml.
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { celda, celdaAcciones, htmlEstado, htmlVigencia } from './filas.js';

export function htmlFilaPiloto(p, hoyIso) {
  const c = (clave, contenido) => celda(t(`config.pilotos.col.${clave}`), contenido);
  return `<tr data-id="${Number(p.id)}"${p.activo ? '' : ' class="is-inactiva"'}>
    ${c('nombre', `<strong>${escapeHtml(p.nombre)}</strong>`)}
    ${c('licencia', escapeHtml(`${p.tipoLicenciaCodigo} · ${p.tipoLicenciaNombre}`))}
    ${c('numero', escapeHtml(p.numero))}
    ${c('vence', htmlVigencia(p.venceEl, hoyIso))}
    ${celda(t('config.col.estado'), htmlEstado(p.activo))}
    ${celdaAcciones({ id: p.id, nombre: p.nombre, activo: p.activo })}
  </tr>`;
}
