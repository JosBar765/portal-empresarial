// Fila de una regla de licencia como HTML puro (sin DOM); la regla no tiene id: sus botones llevan la clave (licencia y placa).
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { celda } from './filas.js';
import { nombreRegla, textoPasajeros, textoTipoLicencia, textoTipoPlaca, textoTonelaje } from './reglasModelo.js';

const boton = ({ accion, regla, icono, texto, clase = '' }) => `<button type="button" class="btn-icon${clase ? ` ${clase}` : ''}" data-accion="${accion}" data-licencia="${Number(regla.tipoLicenciaId)}" data-placa="${Number(regla.tipoPlacaId)}" title="${escapeHtml(texto)}" aria-label="${escapeHtml(texto)}"><ion-icon name="${icono}"></ion-icon></button>`;

export function htmlFilaRegla(regla) {
  const nombre = nombreRegla(regla);
  const c = (clave, contenido, clase) => celda(t(`config.reglas.col.${clave}`), contenido, clase);
  return `<tr data-licencia="${Number(regla.tipoLicenciaId)}" data-placa="${Number(regla.tipoPlacaId)}">
    ${c('licencia', `<strong>${escapeHtml(textoTipoLicencia(regla))}</strong>`)}
    ${c('placa', escapeHtml(textoTipoPlaca(regla)))}
    ${c('tonelaje', escapeHtml(textoTonelaje(regla.tonelajeMax)), regla.tonelajeMax == null ? 'vi-celda-secundaria' : '')}
    ${c('pasajeros', escapeHtml(textoPasajeros(regla.pasajerosMax)), regla.pasajerosMax == null ? 'vi-celda-secundaria' : '')}
    <td class="acciones-cell"><div class="acciones-wrap">
      ${boton({ accion: 'editar', regla, icono: 'create-outline', texto: t('config.accion.editarAria', { nombre }) })}
      ${boton({ accion: 'eliminar', regla, icono: 'trash-outline', texto: t('config.reglas.eliminarAria', { nombre }), clase: 'icon-danger' })}
    </div></td>
  </tr>`;
}
