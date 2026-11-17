// Fila de «Vehículos» como HTML puro (sin DOM); todo texto del servidor pasa por escapeHtml.
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { celda, celdaAcciones, conValor, htmlEstado, htmlVigencia } from './filas.js';
import { nombreVehiculo, propietarioTexto } from './vehiculosModelo.js';

export function htmlFilaVehiculo(v, hoyIso) {
  const c = (clave, contenido, clase) => celda(t(`config.vehiculos.col.${clave}`), contenido, clase);
  return `<tr data-id="${Number(v.id)}"${v.activo ? '' : ' class="is-inactiva"'}>
    ${c('placa', `<strong>${escapeHtml(v.placa)}</strong>`)}
    ${c('vehiculo', escapeHtml(nombreVehiculo(v)))}
    ${c('pais', conValor(v.paisNombre))}
    ${c('propietario', escapeHtml(propietarioTexto(v)))}
    ${c('tipoPlaca', conValor(v.tipoPlacaNombre))}
    ${c('combustible', conValor(v.combustibleNombre))}
    ${c('tarjeta', htmlVigencia(v.tarjetaVenceEl, hoyIso))}
    ${c('poliza', htmlVigencia(v.polizaVenceEl, hoyIso))}
    ${celda(t('config.col.estado'), htmlEstado(v.activo))}
    ${celdaAcciones({ id: v.id, nombre: v.placa, activo: v.activo })}
  </tr>`;
}
