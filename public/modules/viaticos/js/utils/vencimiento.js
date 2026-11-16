// Tiempo que le queda a una solicitud rechazada antes de pasar a Borradores (sin DOM). Los minutos los calcula el servidor con su reloj.
import { t } from '../textos.js';

const MINUTOS_POR_HORA = 60;
// Desde aquí el tiempo se pinta como urgente (rojo).
export const MINUTOS_URGENTE = 60;

// «3 h 20 min», «45 min» o «menos de 1 min» (con 0 minutos).
export function tiempoRestante(minutos) {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  if (total < 1) return t('vencimiento.menosDeUnMinuto');
  const horas = Math.floor(total / MINUTOS_POR_HORA);
  const resto = total % MINUTOS_POR_HORA;
  if (horas === 0) return t('vencimiento.minutos', { minutos: resto });
  return resto === 0 ? t('vencimiento.horas', { horas }) : t('vencimiento.horasMinutos', { horas, minutos: resto });
}

// `vencimiento`: { venceEn, minutosRestantes } del servidor, o null si la solicitud no tiene plazo.
export function textoVencimiento(vencimiento) {
  return vencimiento ? t('vencimiento.en', { tiempo: tiempoRestante(vencimiento.minutosRestantes) }) : '';
}

export const esUrgente = (vencimiento) => !!vencimiento && Number(vencimiento.minutosRestantes) < MINUTOS_URGENTE;
