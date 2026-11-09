// Campos de formulario de las pantallas de empresas, con validación mientras se escribe:
// - al salir del campo se valida («tocado»); desde ahí, y mientras tenga un error, se revalida con cada tecla;
// - estados: normal, con error (fondo rojo suave y mensaje) y correcto (borde verde, check y mensaje opcional).
// Cada constructor recibe `valores` (el borrador, que se modifica al escribir) y `errores` (por clave, del servidor).
// El nodo devuelto trae `nodo.revisar()` (marca el campo como tocado y lo valida; devuelve true si está bien) y
// `nodo.control` (lo que recibe el foco).
import { h, icono, montar } from '../utils/dom.js';
import { aplicarMascara, digitos, normalizarSitioWeb, paisDelPrefijo, validarTelefonoLocal } from '../utils/validar.js';

const idDe = (prefijoId, clave) => `${prefijoId}-${clave.replace(/\./g, '-')}`;
const IMAGEN = { error: 'alert-circle-outline', ok: 'checkmark-circle-outline' };

// Arma la envoltura común: etiqueta, control y mensaje; y la lógica de cuándo validar y cómo pintar el estado.
function campoBase({ id, etiqueta, obligatorio, control, foco, clave, valores, errores, validar, ayuda, textoOk, icono: conIcono = false, extra }) {
  const mensaje = h('div', { class: 'campo-mensaje', 'aria-live': 'polite' });
  const marca = conIcono ? h('ion-icon', { class: 'campo-icono', 'aria-hidden': 'true' }) : null;
  const envuelto = h('div', { class: `campo-control${conIcono ? ' campo-control--icono' : ''}` }, control, marca);
  const nodo = h('div', { class: 'campo' },
    h('label', { for: id }, etiqueta, obligatorio ? h('span', { class: 'campo-obligatorio', text: ' *' }) : null), envuelto, mensaje);
  let tocado = Boolean(errores[clave]);

  function pintar(tipo, texto) {
    nodo.classList.toggle('campo--error', tipo === 'error');
    nodo.classList.toggle('campo--ok', tipo === 'ok');
    mensaje.className = `campo-mensaje${tipo ? ` campo-mensaje--${tipo}` : ''}`;
    montar(mensaje, texto ? [tipo ? h('ion-icon', { name: IMAGEN[tipo], 'aria-hidden': 'true' }) : null, h('span', { text: texto })] : null);
    if (marca) marca.setAttribute('name', tipo ? IMAGEN[tipo] : '');
    if (foco) foco.setAttribute('aria-invalid', tipo === 'error' ? 'true' : 'false');
  }

  function evaluar() {
    const error = errores[clave] || (tocado && validar ? validar(valores[clave], valores) : '');
    if (error) { pintar('error', error); return false; }
    const lleno = String(valores[clave] == null ? '' : valores[clave]).trim() !== '';
    if (tocado && lleno) pintar('ok', textoOk ? textoOk(valores[clave], valores) : '');
    else pintar('', ayuda || '');
    return true;
  }

  nodo.revisar = () => { tocado = true; return evaluar(); };
  nodo.revisarSiTocado = () => { if (tocado) evaluar(); };
  nodo.alEscribir = () => { delete errores[clave]; if (tocado) evaluar(); };
  nodo.alSalir = () => { tocado = true; evaluar(); };
  nodo.pintar = evaluar;
  nodo.control = foco || control;
  if (extra) extra(nodo);
  evaluar();
  return nodo;
}

export function campoTexto({ clave, etiqueta, valores, errores, alCambiar, maximo = 150, tipo = 'text', ayuda, obligatorio, placeholder, prefijoId = 'f', validar, textoOk }) {
  const id = idDe(prefijoId, clave);
  const control = h('input', { id, type: tipo, maxlength: maximo, autocomplete: 'off', placeholder: placeholder || null });
  control.value = valores[clave] || '';
  const nodo = campoBase({ id, etiqueta, obligatorio, control, foco: control, clave, valores, errores, validar, ayuda, textoOk, icono: true });
  control.addEventListener('input', () => { valores[clave] = control.value; nodo.alEscribir(); if (alCambiar) alCambiar(); });
  control.addEventListener('blur', () => nodo.alSalir());
  return nodo;
}

// `opciones`: [{ id, nombre }]. Si hay una sola y es obligatoria, queda elegida.
export function campoLista({ clave, etiqueta, valores, errores, opciones, alCambiar, vacio = 'Elige…', obligatorio, prefijoId = 'f', validar }) {
  const id = idDe(prefijoId, clave);
  const control = h('select', { id }, h('option', { value: '', text: vacio }), opciones.map(o => h('option', { value: String(o.id), text: o.nombre })));
  if (!valores[clave] && opciones.length === 1 && obligatorio) valores[clave] = opciones[0].id;
  control.value = valores[clave] ? String(valores[clave]) : '';
  const nodo = campoBase({ id, etiqueta, obligatorio, control, foco: control, clave, valores, errores, validar });
  control.addEventListener('change', () => { valores[clave] = control.value ? Number(control.value) : ''; nodo.alEscribir(); nodo.alSalir(); if (alCambiar) alCambiar(); });
  control.addEventListener('blur', () => nodo.alSalir());
  return nodo;
}

export function campoArea({ clave, etiqueta, valores, errores, maximo = 500, ayuda, prefijoId = 'f', validar }) {
  const id = idDe(prefijoId, clave);
  const control = h('textarea', { id, rows: 3, maxlength: maximo });
  control.value = valores[clave] || '';
  const nodo = campoBase({ id, etiqueta, control, foco: control, clave, valores, errores, validar, ayuda });
  control.addEventListener('input', () => { valores[clave] = control.value; nodo.alEscribir(); });
  control.addEventListener('blur', () => nodo.alSalir());
  return nodo;
}

// --- Teléfono con código de país ---
// `valores[clave]` guarda el número local con su máscara; `valores[clave__pais]`, el país del prefijo; `valores[clave__manual]`,
// si la persona lo eligió a mano (entonces ya no sigue al país de la empresa).

export function telefonoCompleto(valores, clave, prefijos) {
  const numero = String(valores[clave] || '').trim();
  const pais = prefijos.find(p => p.id === valores[`${clave}__pais`]);
  return numero && pais ? `${pais.prefijoTelefono} ${numero}` : numero;
}

export function campoTelefono({ clave, etiqueta, valores, errores, prefijos, paisPorDefecto, obligatorio, alCambiar, ayuda, prefijoId = 'f' }) {
  const id = idDe(prefijoId, clave);
  const clavePais = `${clave}__pais`;
  const claveManual = `${clave}__manual`;
  const porDefecto = () => prefijos.find(p => p.id === paisPorDefecto()) || prefijos[0];
  const sincronizar = () => { if (!valores[claveManual] || !prefijos.some(p => p.id === valores[clavePais])) valores[clavePais] = (porDefecto() || {}).id; };
  sincronizar();
  const paisActual = () => prefijos.find(p => p.id === valores[clavePais]) || porDefecto() || { prefijoTelefono: '+', formatoTelefono: '' };

  const insignia = h('span', { class: 'telefono-insignia' });
  const codigo = h('span', { class: 'telefono-codigo' });
  const boton = h('button', { class: 'telefono-prefijo', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': `Código de país de ${etiqueta}` }, insignia, codigo, icono('chevron-down-outline'));
  const entrada = h('input', { id, type: 'tel', inputmode: 'tel', autocomplete: 'off', maxlength: 20 });
  entrada.value = valores[clave] || '';
  const lista = h('ul', { class: 'telefono-lista', role: 'listbox', hidden: '' });
  const control = h('div', { class: 'telefono' }, boton, entrada, lista);

  const pintarPrefijo = () => {
    const p = paisActual();
    insignia.textContent = p.codigo || '';
    codigo.textContent = p.prefijoTelefono || '+';
    entrada.placeholder = p.formatoTelefono ? p.formatoTelefono.replace(/#/g, '0') : 'Número';
    [...lista.children].forEach(li => li.setAttribute('aria-selected', String(Number(li.dataset.id) === p.id)));
  };

  const nodo = campoBase({
    id, etiqueta, obligatorio, control, foco: entrada, clave, valores, errores, icono: true,
    ayuda: ayuda || undefined,
    validar: (v) => validarTelefonoLocal(v, paisActual(), obligatorio),
    textoOk: (v) => `Se guardará como ${paisActual().prefijoTelefono} ${v}.`
  });
  nodo.classList.add('campo--telefono');

  const cerrar = () => { lista.hidden = true; boton.setAttribute('aria-expanded', 'false'); };
  const elegir = (pais) => {
    valores[clavePais] = pais.id;
    valores[claveManual] = true;
    valores[clave] = aplicarMascara(digitos(valores[clave]), pais.formatoTelefono);
    entrada.value = valores[clave];
    pintarPrefijo();
    cerrar();
    nodo.alEscribir();
    if (valores[clave]) nodo.alSalir();
    if (alCambiar) alCambiar();
    entrada.focus();
  };
  prefijos.forEach(p => {
    const li = h('li', { role: 'option', 'data-id': String(p.id), tabindex: '-1' },
      h('span', { class: 'telefono-insignia', text: p.codigo }), h('span', { class: 'telefono-pais', text: p.nombre }), h('span', { class: 'telefono-numero', text: p.prefijoTelefono }));
    li.addEventListener('click', () => elegir(p));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(p); }
      if (e.key === 'ArrowDown') { e.preventDefault(); (li.nextElementSibling || li).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (li.previousElementSibling || li).focus(); }
      if (e.key === 'Escape') { cerrar(); boton.focus(); }
    });
    lista.append(li);
  });
  boton.addEventListener('click', () => {
    const abrir = lista.hidden;
    lista.hidden = !abrir;
    boton.setAttribute('aria-expanded', String(abrir));
    if (abrir) (lista.querySelector('[aria-selected="true"]') || lista.firstElementChild)?.focus();
  });
  boton.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); boton.click(); } });
  document.addEventListener('click', (e) => { if (!control.contains(e.target)) cerrar(); });

  entrada.addEventListener('input', () => {
    let crudo = entrada.value.trim();
    // Si pegan o escriben «+503 …», el selector cambia solo al país de ese prefijo.
    if (crudo.startsWith('+') || crudo.startsWith('00')) {
      const d = digitos(crudo.startsWith('00') ? crudo.slice(2) : crudo);
      const p = paisDelPrefijo(d, prefijos);
      if (p) { valores[clavePais] = p.id; valores[claveManual] = true; crudo = d.slice(digitos(p.prefijoTelefono).length); pintarPrefijo(); }
    }
    valores[clave] = aplicarMascara(digitos(crudo), paisActual().formatoTelefono);
    entrada.value = valores[clave];
    nodo.alEscribir();
    if (alCambiar) alCambiar();
  });
  entrada.addEventListener('blur', () => nodo.alSalir());
  entrada.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

  // El formulario avisa cuando cambia el país de la empresa: el prefijo lo sigue mientras no se haya elegido a mano.
  nodo.sincronizarPais = () => {
    if (valores[claveManual]) return;
    sincronizar();
    valores[clave] = aplicarMascara(digitos(valores[clave]), paisActual().formatoTelefono);
    entrada.value = valores[clave];
    pintarPrefijo();
    nodo.revisarSiTocado();
    if (!entrada.value) nodo.pintar();
  };
  pintarPrefijo();
  return nodo;
}

// --- Sitio web como enlace ---

export function campoSitioWeb({ clave, etiqueta, valores, errores, obligatorio, alCambiar, prefijoId = 'f' }) {
  const id = idDe(prefijoId, clave);
  const entrada = h('input', { id, type: 'text', inputmode: 'url', maxlength: 255, autocomplete: 'off', placeholder: 'banco.com' });
  entrada.value = valores[clave] || '';
  const abrir = h('button', { class: 'btn btn--ghost btn--chico', type: 'button' }, icono('open-outline'), 'Abrir enlace');
  const control = h('div', { class: 'sitio-web' }, icono('link-outline'), entrada, abrir);
  const direccion = () => normalizarSitioWeb(valores[clave]);
  const nodo = campoBase({
    id, etiqueta, obligatorio, control, foco: entrada, clave, valores, errores,
    ayuda: obligatorio ? 'Escribe banco.com o https://banco.com.' : 'Opcional. Escribe banco.com o https://banco.com.',
    validar: (v) => {
      const url = normalizarSitioWeb(v);
      if (url === null) return 'Escribe una dirección web válida, por ejemplo banco.com.';
      return !url && obligatorio ? 'Escribe el sitio web.' : '';
    },
    textoOk: () => `Enlace válido · se guardará como ${direccion()}`
  });
  const actualizarBoton = () => { abrir.disabled = !direccion(); };
  actualizarBoton();
  entrada.addEventListener('input', () => { valores[clave] = entrada.value; nodo.alEscribir(); actualizarBoton(); if (alCambiar) alCambiar(); });
  entrada.addEventListener('blur', () => nodo.alSalir());
  // Se abre en otra pestaña, sin darle a ese sitio acceso a este portal.
  abrir.addEventListener('click', () => { const url = direccion(); if (url) window.open(url, '_blank', 'noopener,noreferrer'); });
  return nodo;
}
