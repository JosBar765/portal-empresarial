// Reglas puras de los documentos que se muestran en el visor (sin DOM).
import { t } from '../textos.js';

const ES_IMAGEN = /\.(png|jpe?g|webp|gif)$/i;
const ES_PDF = /\.pdf$/i;

// Solo se pintan como imagen, marco o enlace las URLs de Storage (https), las relativas del propio sitio o las temporales del navegador.
export const urlSegura = (url) => /^(https?:|blob:|\/(?!\/))/i.test(String(url || ''));

// La extensión se mira en la ruta, sin querystring ni ancla: «foto.PNG?token=1» sigue siendo una imagen.
function extensionDe(url) {
  return String(url || '').split(/[?#]/)[0];
}

// 'imagen' | 'pdf'. El `tipo` que declara el servidor manda; sin él se deduce de la extensión y, en lo desconocido, se trata como PDF (marco).
export function tipoDeDocumento({ tipo, url } = {}) {
  if (tipo === 'imagen' || tipo === 'pdf') return tipo;
  if (/^image\//.test(String(tipo || ''))) return 'imagen';
  if (ES_IMAGEN.test(extensionDe(url))) return 'imagen';
  if (ES_PDF.test(extensionDe(url))) return 'pdf';
  return 'pdf';
}

// Título de la cabecera del visor de una solicitud: «Solicitud VIA-GT-000123».
export const tituloVisorSolicitud = (correlativo) => t('visor.tituloSolicitud', { correlativo: correlativo || '' }).trim();

// Título del visor de un comprobante: «Comprobante — Hospedaje».
export const tituloVisorComprobante = (rubro) => t('visor.tituloComprobante', { rubro: rubro || '' }).trim();
