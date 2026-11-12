// Reglas puras de las acciones de Gestiones (sin DOM): motivo del rechazo, diferencia de la liquidación y armado de títulos.
import { LIMITES_SOLICITUD, MODALIDADES } from '../config/constantes.js';
import { formatearDinero, formatearRangoViaje } from '../utils/formato.js';
import { t } from '../textos.js';

// El servidor recorta el motivo y exige 1 a `max` caracteres: se valida igual para que el botón solo se habilite con algo enviable.
export function validarMotivo(texto, max = LIMITES_SOLICITUD.MOTIVO_RECHAZO) {
  const motivo = String(texto == null ? '' : texto).trim();
  const longitud = motivo.length;
  if (longitud === 0) return { valido: false, estado: 'vacio', motivo, longitud, sobran: 0 };
  if (longitud > max) return { valido: false, estado: 'excedido', motivo, longitud, sobran: longitud - max };
  return { valido: true, estado: 'ok', motivo, longitud, sobran: 0 };
}

// Un céntimo de tolerancia: el servidor ya redondeó, pero un -0 o un 1e-14 no debe leerse como diferencia.
export function signoDiferencia(diferencia) {
  const n = Number(diferencia);
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return 'cero';
  return n > 0 ? 'mas' : 'menos';
}

// «+Q 307.86», «-Q 100.00» o «Q 0.00»: la diferencia siempre se lee con su signo.
export function textoDiferencia(simbolo, diferencia) {
  const signo = signoDiferencia(diferencia);
  if (signo === 'cero') return formatearDinero(simbolo, 0);
  const texto = formatearDinero(simbolo, diferencia);
  return signo === 'mas' ? `+${texto}` : texto;
}

export const claveTextoDiferencia = (diferencia) => `gestiones.liq.diferencia.${signoDiferencia(diferencia)}`;

export const tituloAutorizar = (correlativo) => t('gestiones.autorizar.titulo', { correlativo });
export const tituloRechazar = (correlativo) => t('gestiones.rechazar.titulo', { correlativo });
export const tituloLiquidacionGestion = (correlativo) => t('gestiones.liq.titulo', { correlativo });

const nombreSolicitante = (s) => (s && s.solicitante && s.solicitante.nombre) || '';
const nombrePais = (s) => (s && s.pais && s.pais.nombre) || '';

// «Luis Morales · Guatemala», con la moneda cuando la liquidación ya llegó.
export function subtituloLiquidacion(solicitud, liq) {
  const solicitante = (liq && liq.solicitante && liq.solicitante.nombre) || nombreSolicitante(solicitud);
  const pais = (liq && liq.pais && liq.pais.nombre) || nombrePais(solicitud);
  if (liq && liq.moneda) return t('gestiones.liq.subtituloMoneda', { solicitante, pais, moneda: liq.moneda.nombre, simbolo: liq.moneda.simbolo });
  return t('gestiones.liq.subtitulo', { solicitante, pais });
}

// Filas del resumen de la confirmación de autorizar. La lista de Gestiones no trae la moneda, así que el total va sin símbolo;
// un viaje de 1 día o menos no tiene importes y no muestra total.
export function detallesAutorizar(solicitud) {
  const detalles = [
    { etiqueta: t('gestiones.detalle.correlativo'), valor: solicitud.correlativo },
    { etiqueta: t('gestiones.detalle.solicitante'), valor: [nombreSolicitante(solicitud), nombrePais(solicitud)].filter(Boolean).join(' · ') },
    { etiqueta: t('gestiones.detalle.fechas'), valor: formatearRangoViaje(solicitud) }
  ];
  const total = Number(solicitud.totalSolicitado);
  if (solicitud.modalidad === MODALIDADES.MAS_DE_UN_DIA && Number.isFinite(total) && total > 0) {
    detalles.push({ etiqueta: t('gestiones.detalle.total'), valor: formatearDinero('', total), destacado: true });
  }
  return detalles;
}
