// Modal con un formulario armado con nodos (no con HTML): botones Cancelar y Aceptar, y el aceptar queda
// «ocupado» mientras se guarda. Si `enviar` lanza un error, `alError` lo pinta y el modal sigue abierto.
import { abrirModal } from './modal.js';

export function modalFormulario({ title, nodo, aceptar = 'Guardar', peligro = false, enviar, alError }) {
  const { overlay, cerrar } = abrirModal({
    title,
    bodyHtml: '',
    footerHtml: `<button class="btn btn--ghost" type="button" data-accion="cancelar">Cancelar</button><button class="btn ${peligro ? 'btn--danger' : 'btn--primary'}" type="button" data-accion="aceptar"></button>`
  });
  overlay.querySelector('.modal-body').append(nodo);
  const botonAceptar = overlay.querySelector('[data-accion="aceptar"]');
  botonAceptar.textContent = aceptar;
  overlay.querySelector('[data-accion="cancelar"]').addEventListener('click', cerrar);

  let ocupado = false;
  const confirmar = async () => {
    if (ocupado) return;
    ocupado = true;
    botonAceptar.classList.add('btn--loading');
    botonAceptar.disabled = true;
    try {
      await enviar();
      cerrar();
    } catch (error) {
      if (alError) alError(error);
    } finally {
      ocupado = false;
      botonAceptar.classList.remove('btn--loading');
      botonAceptar.disabled = false;
    }
  };
  botonAceptar.addEventListener('click', confirmar);
  nodo.addEventListener('submit', (e) => { e.preventDefault(); confirmar(); });
  return { cerrar, overlay };
}
