import { t } from '../textos.js';

// Marcador: F4.4 lo reemplaza por el visor con el PDF y las fotos de la solicitud.
export function abrirVisorSolicitud(solicitud) {
  window.toast?.info(t('tab.solicitudes'), t('solicitudes.proximamente'));
}
