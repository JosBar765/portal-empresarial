// Vigencia de un documento (licencia, tarjeta de circulación, póliza) a partir de su vencimiento; sin DOM.
import { esIsoValido, hoyMedianoche, isoLocal } from '../../utils/fechas.js';

// Misma ventana que usa el servidor para advertir vencimientos cercanos.
export const DIAS_POR_VENCER = 30;

export const VIGENCIA = Object.freeze({ VENCIDA: 'vencida', POR_VENCER: 'por_vencer', VIGENTE: 'vigente' });

const aDias = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };

// `hoyIso` se inyecta en las pruebas; el día de vencimiento todavía es vigente (como `vence_el >= hoy` en el servidor).
export function estadoVigencia(venceEl, hoyIso = isoLocal(hoyMedianoche())) {
  const iso = venceEl ? String(venceEl).slice(0, 10) : '';
  if (!esIsoValido(iso) || !esIsoValido(hoyIso)) return null;
  const faltan = aDias(iso) - aDias(hoyIso);
  if (faltan < 0) return VIGENCIA.VENCIDA;
  return faltan < DIAS_POR_VENCER ? VIGENCIA.POR_VENCER : VIGENCIA.VIGENTE;
}
