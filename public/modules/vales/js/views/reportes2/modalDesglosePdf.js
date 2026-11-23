// Modal previo a descargar el PDF de los reportes de actividad: ¿incluir el desglose de vales?
// Devuelve una promesa con 'completo' | 'sin' | 'filtrado' | null (cerró sin elegir: no se descarga nada).
// Sin filtros de vista: dos botones (completo / sin). Con filtros (barra enfocada o contadores): tres opciones, cada una con sus vales y el aviso de PDF largo.
import { abrirModal } from '../../components/modal.js';
import { escapeHtml } from '../../utils/formato.js';

// Desde cuántos vales en el desglose el modal avisa que el PDF será largo (solo informa).
export const UMBRAL_FILAS_PDF = 100;

const avisoFilas = (filas, T) => (filas > UMBRAL_FILAS_PDF
  ? `<p class="rep-aviso-pdf" role="note"><ion-icon name="warning-outline" aria-hidden="true"></ion-icon><span>${escapeHtml(T.pdfModalFilasMuchas(filas))}</span></p>` : '');

// Una opción del modal con filtros: botón con título, vales que imprimiría (si se conocen) y aviso si son muchos.
function htmlOpcion(modo, titulo, filas, T) {
  const conteo = filas == null ? '' : `<span class="rep-opcion-pdf-conteo">${escapeHtml(T.pdfModalVales(filas))}</span>`;
  return `<div class="rep-opcion-pdf"><button type="button" class="btn btn--ghost" data-desglose="${modo}"><span class="rep-opcion-pdf-titulo">${escapeHtml(titulo)}</span>${conteo}</button>${filas == null ? '' : avisoFilas(filas, T)}</div>`;
}

// `ctx`: { filtros: [texto de cada filtro activo], filasFiltradas: vales de la opción filtrada (null = se desconoce),
// filasCompleto: vales del desglose general (null = el servidor lo omitió: no se ofrece el completo) }. Sin `filtros`, modal de dos botones.
export function preguntarDesglosePdf(T, { filtros = [], filasFiltradas = null, filasCompleto = 0 } = {}) {
  return new Promise((resolve) => {
    let respondida = false;
    const responder = (valor) => {
      if (respondida) return;
      respondida = true;
      resolve(valor);
    };
    const conFiltros = filtros.length > 0;
    const bodyHtml = conFiltros
      ? `<p style="font-size:14px;font-weight:600;margin-bottom:8px;">${escapeHtml(T.pdfModalPregunta)}</p>
        <p style="font-size:13px;">${escapeHtml(T.pdfModalFiltrosActivos)}</p>
        <ul class="rep-opcion-pdf-filtros">${filtros.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
        <div class="rep-opciones-pdf">
          ${htmlOpcion('filtrado', T.pdfModalConFiltros, filasFiltradas, T)}
          ${filasCompleto == null ? '' : htmlOpcion('completo', T.pdfModalTodo, filasCompleto, T)}
          ${htmlOpcion('sin', T.pdfModalNo, null, T)}
        </div>`
      : `<p style="font-size:14px;font-weight:600;margin-bottom:8px;">${escapeHtml(T.pdfModalPregunta)}</p>
        <p style="font-size:13px;">${escapeHtml(T.pdfModalDetalle)}</p>
        ${avisoFilas(filasCompleto || 0, T)}`;
    const { overlay, cerrar } = abrirModal({
      title: T.pdfModalTitulo,
      bodyHtml,
      footerHtml: conFiltros ? '' : `<button type="button" class="btn btn--ghost" data-desglose="sin">${escapeHtml(T.pdfModalNo)}</button><button type="button" class="btn btn--primary" data-desglose="completo">${escapeHtml(T.pdfModalSi)}</button>`,
      // X, Escape, clic fuera o «atrás» del celular: se cancela la descarga.
      alCerrar: () => responder(null)
    });
    overlay.querySelectorAll('[data-desglose]').forEach(boton => boton.addEventListener('click', () => {
      responder(boton.dataset.desglose);
      cerrar();
    }));
    overlay.querySelector(`[data-desglose="${conFiltros ? 'filtrado' : 'completo'}"]`).focus();
  });
}
