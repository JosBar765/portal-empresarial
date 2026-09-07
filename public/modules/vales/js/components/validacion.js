// Validación inline de formularios — reemplaza los globos nativos del
// navegador (form.reportValidity()) por un mensaje propio junto a cada campo.
// Se apoya en la Constraint Validation API nativa (required/type/min/max)
// para no reinventar las reglas, solo su presentación.

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
  if (v.valueMissing) return campo.tagName === 'SELECT' ? 'Selecciona una opción.' : 'Este campo es obligatorio.';
  if (v.typeMismatch) return campo.type === 'email' ? 'Ingresa un correo válido.' : 'El valor no tiene un formato válido.';
  if (v.rangeUnderflow) return `El valor mínimo permitido es ${campo.min}.`;
  if (v.rangeOverflow) return `El valor máximo permitido es ${campo.max}.`;
  if (v.badInput) return 'Ingresa un valor numérico válido.';
  if (v.tooLong) return `Escribe como máximo ${campo.maxLength} caracteres.`;
  return 'Revisa este campo.';
}

// Un campo de fecha "válido" es simplemente uno con .value; los normales usan
// la Constraint Validation API tal cual.
export function campoEsValido(campo) {
  return campo.type === 'hidden' ? !!campo.value : campo.checkValidity();
}

// Recorre los campos nativos del formulario (sin tocar los <input hidden> de
// fecha ni los <input type=file>, que tienen su propio validador) y marca
// cada uno inválido con su mensaje. Devuelve true si todos pasan.
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

// Al primer intento de envío fallido, cada campo se limpia apenas el usuario
// lo corrige, en vez de esperar a que vuelva a hacer clic en guardar — el
// input/change del hidden de fecha también dispara 'change', así que un solo
// listener delegado cubre todo.
export function wireLimpiezaValidacionInline(form) {
  const onCambio = (e) => {
    const campo = e.target.closest('input, select, textarea');
    if (!campo) return;
    const wrapper = campo.closest('.form-field');
    // Solo re-evalúa un campo que ya tenía un error visible; uno "virgen" no
    // se marca hasta el próximo intento de envío.
    if (!wrapper || !wrapper.classList.contains('is-invalid')) return;
    if (campoEsValido(campo)) { limpiarErrorCampo(campo); return; }
    // Sigue inválido, pero puede que ahora sea por otra razón — se refresca el
    // mensaje en vivo en vez de dejar el de la última vez.
    if (campo.type !== 'hidden') marcarErrorCampo(campo, mensajeValidezCampo(campo));
  };
  form.addEventListener('input', onCambio);
  form.addEventListener('change', onCambio);
}

// Al fallar el envío, se hace scroll + foco al primer campo marcado inválido
// en orden de documento — sea cual sea el validador que lo marcó (nativo,
// fecha o talleres). Los campos de fecha no son enfocables (son un <input
// hidden>), así que se enfoca su botón visible.
export function enfocarPrimerCampoInvalido(root) {
  const wrapper = root.querySelector('.form-field.is-invalid');
  if (!wrapper) return;
  wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const foco = wrapper.querySelector('.date-field-trigger')
    || wrapper.querySelector('input:not([type="hidden"]), select, textarea');
  if (foco) foco.focus({ preventScroll: true });
}
