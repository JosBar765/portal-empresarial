import { t } from '../textos.js';

// Marcador: F4.3 lo reemplaza por el formulario de solicitud (`modo`: 'crear' | 'modificar'; `solicitud` solo al modificar).
export function abrirFormularioSolicitud({ modo, solicitud } = {}) {
  window.toast?.info(t('tab.solicitudes'), t('solicitudes.proximamente'));
}
