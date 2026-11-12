// Validación inline de formularios: reemplaza los globos nativos del navegador por un mensaje propio junto a cada campo.
// Se apoya en la Constraint Validation API nativa (required/type/min/max); aquí solo está su presentación.
import { h } from '../utils/dom.js';
import { t } from '../textos.js';

export function limpiarErrorCampo(campo) {
  const wrapper = campo.closest('.form-field');
  if (!wrapper) return;
  wrapper.classList.remove('is-invalid');
  const msg = wrapper.querySelector('.field-error');
  if (msg) msg.remove();
}

export function marcarErrorCampo(campo, mensaje) {
  const wrapper = campo.closest('.form-field');
  if (!wrapper) return;
  wrapper.classList.add('is-invalid');
  let msg = wrapper.querySelector('.field-error');
  if (!msg) {
    msg = document.createElement('span');
    msg.className = 'field-error';
    msg.innerHTML = '<ion-icon name="alert-circle-outline"></ion-icon><span></span>';
    wrapper.appendChild(msg);
  }
  msg.querySelector('span').textContent = mensaje;
}

export function mensajeValidezCampo(campo) {
  const v = campo.validity;
  if (v.valueMissing) return t(campo.tagName === 'SELECT' ? 'validacion.obligatorioLista' : 'validacion.obligatorio');
  if (v.typeMismatch) return t(campo.type === 'email' ? 'validacion.correo' : 'validacion.formato');
  if (v.rangeUnderflow) return t('validacion.minimo', { min: campo.min });
  if (v.rangeOverflow) return t('validacion.maximo', { max: campo.max });
  if (v.badInput) return t('validacion.numerico');
  if (v.tooLong) return t('validacion.largo', { max: campo.maxLength });
  return t('validacion.revisa');
}

// Un campo oculto «válido» es simplemente uno con .value; los normales usan la Constraint Validation API tal cual.
export function campoEsValido(campo) {
  return campo.type === 'hidden' ? !!campo.value : campo.checkValidity();
}

// Marca cada campo nativo inválido con su mensaje (sin tocar los hidden ni los file). Devuelve true si todos pasan.
export function validarCamposNativos(form) {
  let ok = true;
  form.querySelectorAll('input, select, textarea').forEach(campo => {
    if (campo.type === 'hidden' || campo.type === 'file') return;
    limpiarErrorCampo(campo);
    if (campo.checkValidity()) return;
    marcarErrorCampo(campo, mensajeValidezCampo(campo));
    ok = false;
  });
  return ok;
}

// Tras el primer envío fallido, cada campo se limpia apenas el usuario lo corrige; un solo listener delegado cubre todo.
export function wireLimpiezaValidacionInline(form) {
  const onCambio = (e) => {
    const campo = e.target.closest('input, select, textarea');
    if (!campo) return;
    const wrapper = campo.closest('.form-field');
    // Solo re-evalúa un campo que ya tenía un error visible; uno «virgen» no se marca hasta el próximo envío.
    if (!wrapper || !wrapper.classList.contains('is-invalid')) return;
    if (campoEsValido(campo)) { limpiarErrorCampo(campo); return; }
    if (campo.type !== 'hidden') marcarErrorCampo(campo, mensajeValidezCampo(campo));
  };
  form.addEventListener('input', onCambio);
  form.addEventListener('change', onCambio);
}

// Scroll y foco al primer campo inválido en orden de documento, sea cual sea el validador que lo marcó.
export function enfocarPrimerCampoInvalido(root) {
  const wrapper = root.querySelector('.form-field.is-invalid');
  if (!wrapper) return;
  wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const foco = wrapper.querySelector('input:not([type="hidden"]), select, textarea, button');
  if (foco) foco.focus({ preventScroll: true });
}

// «tramos[0].destinoId» -> «tramos[0].destinoId», «tramos[0]», «tramos»: del más específico al más general.
function claves(clave) {
  const lista = [clave];
  let actual = clave;
  while (/(\.[^.[\]]+|\[\d+\])$/.test(actual)) {
    actual = actual.replace(/(\.[^.[\]]+|\[\d+\])$/, '');
    lista.push(actual);
  }
  return lista;
}

function buscarCampo(root, clave) {
  for (const candidata of claves(clave)) {
    const valor = CSS.escape(candidata);
    const campo = root.querySelector(`[name="${valor}"], [data-campo="${valor}"]`);
    if (campo && campo.closest('.form-field')) return campo;
  }
  return null;
}

// Mapea el objeto `campos` del servidor a los `.form-field` por `name` o `data-campo`; lo que no encuentra
// campo va a un banner al inicio de `root`. Devuelve { marcados, sueltos }.
export function marcarErroresDeCampos(root, campos) {
  root.querySelectorAll('[data-banner-campos]').forEach(b => b.remove());
  const sueltos = [];
  let marcados = 0;
  for (const [clave, mensaje] of Object.entries(campos || {})) {
    const campo = buscarCampo(root, clave);
    if (campo) { marcarErrorCampo(campo, String(mensaje)); marcados += 1; } else sueltos.push(String(mensaje));
  }
  if (sueltos.length) {
    root.prepend(h('div', { class: 'form-error', 'data-banner-campos': true }, sueltos.map(m => h('p', { text: m }))));
  }
  return { marcados, sueltos };
}
