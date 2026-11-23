// Modal al presionar el nombre de una tienda en la gráfica del reporte de tiendas: ¿ir al reporte de actividad de asesores de esa tienda?
// Devuelve una promesa con true (sí) o false (no, o cerró el modal sin elegir).
import { abrirModal } from '../../components/modal.js';
import { escapeHtml } from '../../utils/formato.js';

export function preguntarIrAAsesores(T, nombreTienda) {
  return new Promise((resolve) => {
    let respondida = false;
    const responder = (valor) => {
      if (respondida) return;
      respondida = true;
      resolve(valor);
    };
    const { overlay, cerrar } = abrirModal({
      title: T.irAsesoresTitulo,
      bodyHtml: `
        <p style="font-size:14px;font-weight:600;margin-bottom:8px;">${escapeHtml(T.irAsesoresPregunta(nombreTienda))}</p>
        <p style="font-size:13px;">${escapeHtml(T.irAsesoresDetalle)}</p>`,
      footerHtml: `<button type="button" class="btn btn--ghost" data-ir="no">${escapeHtml(T.irAsesoresNo)}</button><button type="button" class="btn btn--primary" data-ir="si">${escapeHtml(T.irAsesoresSi)}</button>`,
      // X, Escape, clic fuera o «atrás» del celular: se queda en el reporte actual.
      alCerrar: () => responder(false)
    });
    overlay.querySelectorAll('[data-ir]').forEach(boton => boton.addEventListener('click', () => {
      responder(boton.dataset.ir === 'si');
      cerrar();
    }));
    overlay.querySelector('[data-ir="si"]').focus();
  });
}
