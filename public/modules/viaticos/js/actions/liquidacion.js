import { t } from '../textos.js';

// Marcador: F4.4 lo reemplaza por la pantalla de liquidación con comprobantes.
export function abrirLiquidacion(solicitud) {
  window.toast?.info(t('tab.solicitudes'), t('solicitudes.proximamente'));
}
