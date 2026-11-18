// Historial de movimientos de una solicitud (solo Gestiones): modal de solo lectura, sin tiempo real.
import { abrirModal } from '../components/modal.js';
import { escapeHtml, formatearFechaCorta } from '../utils/formato.js';
import { obtenerHistorialGestion } from '../api/viaticosApi.js';
import { t } from '../textos.js';

// «17 nov 2026 10:19»: el servidor manda «AAAA-MM-DD HH:mm:ss» ya en hora de Guatemala (dateStrings), así que se lee como texto y no con Date (Safari no lo entiende).
export function formatearMomento(valor) {
  if (!valor) return '-';
  const [dia, hora] = String(valor).replace('T', ' ').split(' ');
  return `${formatearFechaCorta(dia)}${hora ? ` ${hora.slice(0, 5)}` : ''}`;
}

// HTML puro (sin DOM): todo texto del servidor pasa por escapeHtml.
export function htmlListaHistorial(movimientos) {
  const filas = (movimientos || []).map(m => `<li><span class="fecha">${escapeHtml(formatearMomento(m.creadoEn))} ·</span> <strong>${escapeHtml(m.usuarioNombre)}:</strong> ${escapeHtml(m.accion)}</li>`).join('');
  return `<ul class="vi-historial-lista">${filas || `<li>${escapeHtml(t('historial.vacio'))}</li>`}</ul>`;
}

const htmlError = (mensaje, conReintento) => `<div class="vi-historial-error" role="alert"><p>${escapeHtml(mensaje)}</p>${conReintento ? `<button type="button" class="btn btn--ghost" data-reintentar>${escapeHtml(t('comun.reintentar'))}</button>` : ''}</div>`;

export async function abrirHistorial(solicitud) {
  const { overlay } = abrirModal({
    title: t('historial.titulo', { correlativo: solicitud.correlativo }),
    bodyHtml: `<p class="vi-historial-cargando">${escapeHtml(t('comun.cargando'))}</p>`,
    clase: 'vi-modal-historial'
  });
  const cuerpo = overlay.querySelector('.modal-body');
  const cargar = async () => {
    cuerpo.innerHTML = `<p class="vi-historial-cargando">${escapeHtml(t('comun.cargando'))}</p>`;
    try {
      const { movimientos } = await obtenerHistorialGestion(solicitud.id);
      cuerpo.innerHTML = htmlListaHistorial(movimientos);
    } catch (error) {
      // 403 y 404 no se arreglan reintentando.
      cuerpo.innerHTML = htmlError(error.message, ![403, 404].includes(error.status));
      cuerpo.querySelector('[data-reintentar]')?.addEventListener('click', cargar);
    }
  };
  await cargar();
}
