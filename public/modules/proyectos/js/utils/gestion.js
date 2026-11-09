// Piezas que comparten las pantallas del asesor: estados, fechas, montos y enlaces de llamada, WhatsApp y correo.
import { h } from './dom.js';
import { digitos } from './validar.js';

export const ETIQUETA_GESTION = { pendiente: 'Pendiente', en_gestion: 'En gestión', interesada: 'Interesada', cotizada: 'Cotizada', vendida: 'Vendida', perdida: 'Perdida', descartada: 'Descartada' };
export const chipGestion = (estado) => h('span', { class: `chip-gestion chip-gestion--${estado}`, text: ETIQUETA_GESTION[estado] || estado });

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreDelMes = (anio, mes) => `${MESES_LARGOS[mes - 1][0].toUpperCase()}${MESES_LARGOS[mes - 1].slice(1)} ${anio}`;

// Toda la región usa UTC-6: «hoy» se calcula con ese reloj, igual que en el servidor.
export const hoyGT = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

// «2026-11-12 10:00:00» → «12 nov» y «10:00»
export const diaCorto = (fecha) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha || ''));
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]}` : '';
};
export const horaDe = (fecha) => {
  const m = /[ T](\d{2}:\d{2})/.exec(String(fecha || ''));
  return m ? m[1] : '';
};

// «Hoy 10:00», «12 nov 10:00» o «6 nov (vencido)».
export function textoSeguimiento(proxima, vencido) {
  if (!proxima) return 'Sin fecha';
  const dia = String(proxima).slice(0, 10);
  if (vencido) return `${diaCorto(proxima)} (vencido)`;
  return dia === hoyGT() ? `Hoy ${horaDe(proxima)}` : `${diaCorto(proxima)} ${horaDe(proxima)}`;
}

export function textoUltimaGestion(ultima, dias) {
  if (!ultima) return 'Sin gestión';
  if (dias <= 0) return `Hoy ${horaDe(ultima)}`;
  return dias === 1 ? 'Ayer' : `Hace ${dias} días`;
}

const SIMBOLOS = { GTQ: 'Q', USD: 'US$', HNL: 'L', NIO: 'C$', CRC: '₡' };
export const simboloDe = (codigo, monedas = []) => (monedas.find(m => m.codigo === codigo) || {}).simbolo || SIMBOLOS[codigo] || codigo;
export const formatoMonto = (monto, moneda, monedas) => `${simboloDe(moneda, monedas)} ${Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const hrefLlamar = (telefono) => (telefono ? `tel:${String(telefono).replace(/[^\d+]/g, '')}` : null);
export const hrefWhatsApp = (telefono) => (digitos(telefono) ? `https://wa.me/${digitos(telefono)}` : null);
