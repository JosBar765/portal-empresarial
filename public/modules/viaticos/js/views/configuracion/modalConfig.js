// Modal de alta y edición de Configuración: validación del cliente, envío y errores del servidor junto a cada campo.
import { h } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { abrirModal, mostrarErrorModal } from '../../components/modal.js';
import { enfocarPrimerCampoInvalido, marcarErroresDeCampos, wireLimpiezaValidacionInline } from '../../components/validacion.js';

function limpiarErrores(overlay, form) {
  form.querySelectorAll('.form-field').forEach(contenedor => {
    contenedor.classList.remove('is-invalid');
    const mensaje = contenedor.querySelector('.field-error');
    if (mensaje) mensaje.remove();
  });
  overlay.querySelectorAll('.form-error').forEach(b => b.remove());
}

// `validar()`: { campo: mensaje } del cliente. `enviar()`: llama a la API. `alGuardar(resultado)`: tras el éxito (el modal ya se cerró).
// `erroresDeServidor(error)`: { campo: mensaje } para un error que no es 400 y debe ir junto a un campo (p. ej. un duplicado); si no, va al banner.
export function abrirFormularioConfig({ titulo, hijos, validar, enviar, alGuardar, erroresDeServidor }) {
  const form = h('form', { class: 'form-grid vi-config-form', id: 'vi-cfg-form', novalidate: true, onsubmit: (e) => e.preventDefault() }, hijos);
  const { overlay, cerrar } = abrirModal({
    title: titulo,
    bodyHtml: '',
    clase: 'vi-modal-config',
    footerHtml: `<button class="btn btn--ghost" type="button" data-accion="cancelar">${escapeHtml(t('comun.cancelar'))}</button><button class="btn btn--primary" type="button" id="vi-cfg-guardar" data-accion="guardar">${escapeHtml(t('config.guardar'))}</button>`
  });
  overlay.querySelector('.modal-body').append(form);
  wireLimpiezaValidacionInline(form);

  const botonGuardar = overlay.querySelector('#vi-cfg-guardar');
  let enCurso = false;

  async function guardar() {
    if (enCurso) return;
    limpiarErrores(overlay, form);
    const errores = validar();
    if (Object.keys(errores).length) {
      marcarErroresDeCampos(form, errores);
      enfocarPrimerCampoInvalido(form);
      return;
    }
    enCurso = true;
    botonGuardar.disabled = true;
    try {
      const resultado = await enviar();
      cerrar();
      alGuardar(resultado);
    } catch (error) {
      enCurso = false;
      botonGuardar.disabled = false;
      const deCampos = error.status === 400 && error.campos && Object.keys(error.campos).length ? error.campos : null;
      const campos = deCampos || (erroresDeServidor && erroresDeServidor(error));
      if (campos) {
        marcarErroresDeCampos(form, campos);
        const banner = form.querySelector('[data-banner-campos]');
        if (banner) banner.setAttribute('role', 'alert');
        enfocarPrimerCampoInvalido(form);
      } else {
        mostrarErrorModal(overlay, error.message);
        overlay.querySelector('.form-error').setAttribute('role', 'alert');
      }
    }
  }

  overlay.querySelector('[data-accion="cancelar"]').addEventListener('click', cerrar);
  botonGuardar.addEventListener('click', guardar);
  // Enter dentro de un campo de texto guarda, como el botón (el formulario no tiene botón de envío propio).
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); guardar(); } });

  const primero = form.querySelector('input:not([disabled]), select:not([disabled])');
  if (primero) primero.focus();
  return { overlay, cerrar, form };
}
