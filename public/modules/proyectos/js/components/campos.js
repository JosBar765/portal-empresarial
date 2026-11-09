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
// Con `textoIds` los identificadores son textos (las opciones de un campo propio); si no, números.
export function campoLista({ clave, etiqueta, valores, errores, opciones, alCambiar, vacio = 'Elige…', obligatorio, prefijoId = 'f', validar, textoIds = false }) {
  const id = idDe(prefijoId, clave);
  const control = h('select', { id }, h('option', { value: '', text: vacio }), opciones.map(o => h('option', { value: String(o.id), text: o.nombre })));
  if (!valores[clave] && opciones.length === 1 && obligatorio) valores[clave] = opciones[0].id;
  control.value = valores[clave] ? String(valores[clave]) : '';
  const nodo = campoBase({ id, etiqueta, obligatorio, control, foco: control, clave, valores, errores, validar });
  control.addEventListener('change', () => { valores[clave] = control.value ? (textoIds ? control.value : Number(control.value)) : ''; nodo.alEscribir(); nodo.alSalir(); if (alCambiar) alCambiar(); });
  control.addEventListener('blur', () => nodo.alSalir());
  return nodo;
}

// Campo sí/no (un interruptor): siempre tiene respuesta, así que nunca queda «sin llenar».
export function campoSiNo({ clave, etiqueta, ayuda = 'Sí / No', valores, prefijoId = 'f' }) {
  const id = idDe(prefijoId, clave);
  const entrada = h('input', { id, type: 'checkbox', role: 'switch', 'aria-label': etiqueta });
  entrada.checked = valores[clave] === true;
  valores[clave] = entrada.checked;
  entrada.addEventListener('change', () => { valores[clave] = entrada.checked; });
  const nodo = h('div', { class: 'campo campo--sino' },
    h('label', { class: 'sino', for: id }, h('span', { class: 'sino-texto' }, h('span', { class: 'sino-etiqueta', text: etiqueta }), h('span', { class: 'sino-ayuda', text: ayuda })),
      h('span', { class: 'interruptor' }, entrada, h('span', { class: 'interruptor-pista' }))));
  nodo.revisar = () => true;
  nodo.revisarSiTocado = () => {};
  nodo.control = entrada;
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

// --- Fecha y hora con calendario propio ---
// Reemplaza el selector nativo del navegador: un campo con ícono de calendario («Jue 12 nov · 10:00») que abre un calendario
// (no deja elegir días pasados) y la hora en pasos de 15 minutos. `valores[clave]` guarda «AAAA-MM-DDTHH:mm» o vacío.
const MESES_FECHA = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const dos = (n) => String(n).padStart(2, '0');

function leerFechaHora(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(texto || ''));
  return m ? { y: +m[1], m: +m[2], d: +m[3], hh: m[4] ? +m[4] : 9, mi: m[5] ? +m[5] : 0 } : null;
}

export function campoFechaHora({ clave, etiqueta, valores, errores, obligatorio, ayuda, validar, alCambiar, prefijoId = 'f' }) {
  const id = idDe(prefijoId, clave);
  const valor = h('span', { class: 'fecha-valor' });
  const boton = h('button', { id, class: 'fecha-disparador', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, valor, icono('calendar-outline'));
  const panel = h('div', { class: 'fecha-panel', role: 'dialog', 'aria-label': etiqueta, hidden: '' });
  const control = h('div', { class: 'fecha-campo' }, boton, panel);
  const nodo = campoBase({ id, etiqueta, obligatorio, control, foco: boton, clave, valores, errores, validar, ayuda });
  const hoy = leerFechaHora(new Date(Date.now() - 6 * 3600 * 1000).toISOString());
  let seleccion = leerFechaHora(valores[clave]);
  let vista = { y: (seleccion || hoy).y, m: (seleccion || hoy).m };

  const guardar = () => {
    valores[clave] = seleccion ? `${seleccion.y}-${dos(seleccion.m)}-${dos(seleccion.d)}T${dos(seleccion.hh)}:${dos(seleccion.mi)}` : '';
    pintarValor();
    nodo.alEscribir();
    if (alCambiar) alCambiar();
  };
  function pintarValor() {
    const hay = Boolean(seleccion);
    valor.textContent = hay ? `${DIAS_CORTOS[new Date(seleccion.y, seleccion.m - 1, seleccion.d).getDay()]} ${seleccion.d} ${MESES_FECHA[seleccion.m - 1].slice(0, 3).toLowerCase()} · ${dos(seleccion.hh)}:${dos(seleccion.mi)}` : 'Elige fecha y hora';
    valor.classList.toggle('fecha-valor--vacio', !hay);
  }
  const esPasado = (y, m, d) => y < hoy.y || (y === hoy.y && (m < hoy.m || (m === hoy.m && d < hoy.d)));

  function dibujar() {
    const primero = new Date(vista.y, vista.m - 1, 1);
    const desfase = (primero.getDay() + 6) % 7;
    const total = new Date(vista.y, vista.m, 0).getDate();
    const celdas = [...Array(desfase).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
    const mover = (delta) => { const f = new Date(vista.y, vista.m - 1 + delta, 1); vista = { y: f.getFullYear(), m: f.getMonth() + 1 }; dibujar(); };
    const anterior = h('button', { class: 'fecha-mes-boton', type: 'button', 'aria-label': 'Mes anterior', onclick: () => mover(-1) }, icono('chevron-back-outline'));
    anterior.disabled = vista.y === hoy.y && vista.m === hoy.m;
    const opcionesHora = (n, paso, actual) => Array.from({ length: n / paso }, (_, i) => h('option', { value: String(i * paso), selected: i * paso === actual ? '' : null, text: dos(i * paso) }));
    const hora = h('select', { 'aria-label': 'Hora' }, opcionesHora(24, 1, seleccion ? seleccion.hh : 9));
    const minuto = h('select', { 'aria-label': 'Minutos' }, opcionesHora(60, 15, seleccion ? seleccion.mi - (seleccion.mi % 15) : 0));
    const cambiarHora = () => { if (seleccion) { seleccion.hh = Number(hora.value); seleccion.mi = Number(minuto.value); guardar(); } };
    hora.addEventListener('change', cambiarHora);
    minuto.addEventListener('change', cambiarHora);
    montar(panel,
      h('div', { class: 'fecha-mes' }, anterior, h('strong', { text: `${MESES_FECHA[vista.m - 1]} ${vista.y}` }),
        h('button', { class: 'fecha-mes-boton', type: 'button', 'aria-label': 'Mes siguiente', onclick: () => mover(1) }, icono('chevron-forward-outline'))),
      h('div', { class: 'fecha-rejilla fecha-rejilla--semana', 'aria-hidden': 'true' }, ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(t => h('span', { text: t }))),
      h('div', { class: 'fecha-rejilla' }, celdas.map(d => {
        if (!d) return h('span');
        const elegido = seleccion && seleccion.y === vista.y && seleccion.m === vista.m && seleccion.d === d;
        const esHoy = hoy.y === vista.y && hoy.m === vista.m && hoy.d === d;
        const dia = h('button', { class: `fecha-dia${elegido ? ' fecha-dia--elegido' : ''}${esHoy ? ' fecha-dia--hoy' : ''}`, type: 'button', text: String(d), 'aria-pressed': String(Boolean(elegido)) });
        dia.disabled = esPasado(vista.y, vista.m, d);
        dia.addEventListener('click', () => { seleccion = { y: vista.y, m: vista.m, d, hh: seleccion ? seleccion.hh : 9, mi: seleccion ? seleccion.mi : 0 }; guardar(); dibujar(); });
        return dia;
      })),
      h('div', { class: 'fecha-hora' }, h('span', { text: 'Hora' }), hora, h('span', { text: ':' }), minuto),
      h('div', { class: 'fecha-pie' },
        h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => { seleccion = null; guardar(); cerrar(); } }, 'Quitar'),
        h('button', { class: 'btn btn--primary btn--chico', type: 'button', onclick: cerrar }, 'Listo')));
  }

  function abrir() { dibujar(); panel.hidden = false; boton.setAttribute('aria-expanded', 'true'); }
  function cerrar() { if (panel.hidden) return; panel.hidden = true; boton.setAttribute('aria-expanded', 'false'); nodo.alSalir(); }
  boton.addEventListener('click', () => (panel.hidden ? abrir() : cerrar()));
  const afuera = (e) => { if (!control.isConnected) { document.removeEventListener('mousedown', afuera); return; } if (!control.contains(e.target)) cerrar(); };
  document.addEventListener('mousedown', afuera);
  control.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); cerrar(); boton.focus(); } });
  pintarValor();
  return nodo;
}
