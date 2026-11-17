// Ayuda integrada de las pantallas de Configuración: «¿Cómo funciona?» (franja desplegable bajo el título) y el icono (i) de los
// ajustes con reglas. Todos los textos salen de ../ayuda/textos.js. En escritorio el (i) abre un recuadro junto al icono; en el
// celular, una hoja desde abajo. Nada de esto cambia lo que la persona está escribiendo.
import { h, icono } from '../utils/dom.js';
import { TEXTOS } from '../ayuda/textos.js';

const CELULAR = '(max-width: 640px)';
let contador = 0;
let abierta = null; // { cerrar, caja } de la ayuda (i) abierta ahora

const lista = (valor) => (Array.isArray(valor) ? valor : (valor ? [valor] : []));

// Cada tipo de bloque lleva su icono y su color, para que se reconozca de un vistazo.
const TIPOS = {
  sirve: { titulo: 'Para qué sirve', icono: 'help-circle-outline' },
  cambias: { titulo: 'Qué puedes cambiar', icono: 'create-outline' },
  efecto: { titulo: 'Qué pasa cuando lo cambias', icono: 'flash-outline' },
  ejemplo: { titulo: 'Ejemplo', icono: 'bulb-outline' },
  ojo: { titulo: 'Ten en cuenta', icono: 'alert-circle-outline' },
  que: { titulo: 'Qué es', icono: 'help-circle-outline' }
};

// Un bloque: icono + título + párrafo o viñetas. `ancho` lo estira a todo el ancho de la rejilla.
function bloque(tipo, contenido, { ancho = false } = {}) {
  const items = lista(contenido);
  if (!items.length) return null;
  const t = TIPOS[tipo];
  return h('section', { class: `ayuda-bloque ayuda-bloque--${tipo}${ancho ? ' ayuda-bloque--ancho' : ''}` },
    h('div', { class: 'ayuda-bloque-icono', 'aria-hidden': 'true' }, icono(t.icono)),
    h('div', { class: 'ayuda-bloque-cuerpo' },
      h('h3', { class: 'ayuda-bloque-titulo', text: t.titulo }),
      items.length === 1 ? h('p', { text: items[0] }) : h('ul', null, items.map(x => h('li', { text: x })))));
}

// «Por dónde empezar»: pasos numerados, cada uno lleva a su pantalla.
function pasos(guia) {
  return h('section', { class: 'ayuda-bloque ayuda-bloque--guia ayuda-bloque--ancho' },
    h('div', { class: 'ayuda-bloque-icono', 'aria-hidden': 'true' }, icono('rocket-outline')),
    h('div', { class: 'ayuda-bloque-cuerpo' },
      h('h3', { class: 'ayuda-bloque-titulo', text: 'Por dónde empezar' }),
      h('ol', { class: 'ayuda-pasos' }, guia.map((p, i) => h('li', null,
        h('a', { class: 'ayuda-paso', href: p.ruta },
          h('span', { class: 'ayuda-paso-numero', text: String(i + 1), 'aria-hidden': 'true' }),
          h('span', { class: 'ayuda-paso-texto' }, h('strong', { text: p.titulo }), h('span', { text: p.texto })),
          icono('arrow-forward-outline')))))));
}

function cuerpoPantalla(t) {
  return [
    bloque('sirve', t.sirve, { ancho: true }),
    t.guia ? pasos(t.guia) : null,
    bloque('cambias', t.cambias),
    bloque('efecto', t.efecto),
    bloque('ejemplo', t.ejemplo, { ancho: true }),
    bloque('ojo', t.ojo, { ancho: true })
  ].filter(Boolean);
}

// Ayuda de la pantalla: franja «¿Cómo funciona?» que despliega la explicación completa, sin salir de la pantalla.
// Siempre empieza cerrada: la explicación aparece solo cuando la persona la pide.
export function comoFunciona(clave) {
  const t = TEXTOS.pantallas[clave];
  if (!t) return null;
  const id = `ayuda-pantalla-${++contador}`;
  const accion = h('span', { class: 'ayuda-franja-accion', text: 'Ver explicación' });
  const flecha = icono('chevron-down-outline');
  flecha.classList.add('ayuda-flecha');
  const boton = h('button', { class: 'ayuda-franja', type: 'button', 'aria-expanded': 'false', 'aria-controls': id },
    h('span', { class: 'ayuda-franja-icono', 'aria-hidden': 'true' }, icono('help-circle-outline')),
    h('span', { class: 'ayuda-franja-texto' },
      h('strong', { text: '¿Cómo funciona?' }),
      h('span', { text: 'Para qué sirve, qué puedes cambiar y un ejemplo.' })),
    accion, flecha);
  const cerrarAlFinal = h('button', { class: 'btn btn--ghost ayuda-cerrar-panel', type: 'button' }, icono('chevron-up-outline'), 'Cerrar explicación');
  const panel = h('div', { class: 'ayuda-panel', id, role: 'region', 'aria-label': '¿Cómo funciona esta pantalla?', hidden: true },
    h('div', { class: 'ayuda-panel-interior' }, cuerpoPantalla(t), h('div', { class: 'ayuda-panel-pie' }, cerrarAlFinal)));
  const poner = (abierto) => {
    boton.setAttribute('aria-expanded', String(abierto));
    accion.textContent = abierto ? 'Ocultar' : 'Ver explicación';
    animar(panel, abierto);
  };
  boton.addEventListener('click', () => poner(boton.getAttribute('aria-expanded') !== 'true'));
  // Al terminar de leer, se cierra sin tener que subir hasta la franja.
  cerrarAlFinal.addEventListener('click', () => {
    poner(false);
    boton.scrollIntoView({ block: 'nearest', behavior: sinMovimiento() ? 'auto' : 'smooth' });
    boton.focus();
  });
  return h('div', { class: 'ayuda-pantalla' }, boton, panel);
}

const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Abre o cierra el panel con una transición de altura corta, para que se note que el contenido se mueve y no que «salta».
function animar(panel, abrir) {
  if (sinMovimiento()) { panel.hidden = !abrir; return; }
  const terminar = () => {
    panel.removeEventListener('transitionend', alTerminar);
    panel.style.height = '';
    panel.style.overflow = '';
    panel.style.transition = '';
    panel.hidden = !abrir;
  };
  const alTerminar = (e) => { if (e.target === panel && e.propertyName === 'height') terminar(); };
  panel.addEventListener('transitionend', alTerminar);
  panel.style.overflow = 'hidden';
  if (abrir) {
    const desde = panel.hidden ? 0 : panel.offsetHeight; // si se abre a mitad de un cierre, sigue desde donde iba
    panel.hidden = false;
    const alto = panel.scrollHeight;
    panel.style.height = `${desde}px`;
    panel.getBoundingClientRect();
    panel.style.transition = 'height .26s ease';
    panel.style.height = `${alto}px`;
  } else {
    panel.style.height = `${panel.offsetHeight}px`;
    panel.getBoundingClientRect();
    panel.style.transition = 'height .22s ease';
    panel.style.height = '0px';
  }
  setTimeout(terminar, 450); // por si el navegador no avisa del fin de la transición
}

function cerrarAbierta() { if (abierta) abierta.cerrar(); }

function abrirAyuda(t, origen) {
  cerrarAbierta();
  const celular = window.matchMedia(CELULAR).matches;
  const idTitulo = `ayuda-titulo-${++contador}`;
  const cuerpo = [bloque('que', t.que), bloque('efecto', t.efecto), bloque('ejemplo', t.ejemplo), bloque('ojo', t.ojo)].filter(Boolean);
  const cerrarBoton = h('button', { class: 'ayuda-cerrar', type: 'button', 'aria-label': 'Cerrar la ayuda' }, icono('close-outline'));
  const entendido = celular ? h('button', { class: 'btn btn--primary ayuda-entendido', type: 'button', text: 'Entendido' }) : null;
  const caja = h('div', { class: celular ? 'ayuda-hoja' : 'ayuda-recuadro', role: 'dialog', 'aria-modal': celular ? 'true' : 'false', 'aria-labelledby': idTitulo },
    celular ? h('div', { class: 'ayuda-agarre', 'aria-hidden': 'true' }) : null,
    h('div', { class: 'ayuda-cabecera' },
      h('span', { class: 'ayuda-franja-icono ayuda-franja-icono--chico', 'aria-hidden': 'true' }, icono('information-circle-outline')),
      h('h2', { class: 'ayuda-titulo', id: idTitulo, text: t.titulo }), cerrarBoton),
    h('div', { class: 'ayuda-cuerpo' }, cuerpo), entendido);
  const fondo = celular ? h('div', { class: 'ayuda-fondo' }, caja) : null;
  document.body.append(fondo || caja);
  if (celular) document.body.classList.add('ayuda-sin-scroll');

  function colocar() {
    if (celular) return;
    const r = origen.getBoundingClientRect();
    const ancho = Math.min(400, window.innerWidth - 24);
    caja.style.width = `${ancho}px`;
    const izquierda = Math.max(12, Math.min(r.left - 8, window.innerWidth - ancho - 12));
    const debajo = r.bottom + 10;
    const alto = caja.offsetHeight;
    const arriba = debajo + alto > window.innerHeight - 12 ? Math.max(12, r.top - alto - 10) : debajo;
    caja.style.left = `${izquierda}px`;
    caja.style.top = `${arriba}px`;
  }

  const enfocables = () => Array.from(caja.querySelectorAll('button:not([disabled])'));
  function alTeclear(e) {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(); return; }
    if (e.key !== 'Tab' || !celular) return;
    const lista2 = enfocables();
    if (!lista2.length) return;
    if (e.shiftKey && document.activeElement === lista2[0]) { e.preventDefault(); lista2[lista2.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === lista2[lista2.length - 1]) { e.preventDefault(); lista2[0].focus(); }
  }
  function fuera(e) { if (!caja.contains(e.target) && !origen.contains(e.target)) cerrar(); }
  function cerrar() {
    document.removeEventListener('keydown', alTeclear, true);
    document.removeEventListener('pointerdown', fuera, true);
    window.removeEventListener('resize', colocar);
    (fondo || caja).remove();
    document.body.classList.remove('ayuda-sin-scroll');
    origen.setAttribute('aria-expanded', 'false');
    if (abierta && abierta.caja === caja) abierta = null;
    if (origen.isConnected) origen.focus();
  }
  cerrarBoton.addEventListener('click', cerrar);
  if (entendido) entendido.addEventListener('click', cerrar);
  if (fondo) fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
  document.addEventListener('keydown', alTeclear, true);
  if (!celular) document.addEventListener('pointerdown', fuera, true);
  window.addEventListener('resize', colocar);
  origen.setAttribute('aria-expanded', 'true');
  abierta = { cerrar, caja };
  colocar();
  (entendido || cerrarBoton).focus();
}

// El icono (i) junto a la etiqueta de un ajuste. Devuelve null si ese ajuste no tiene ayuda (no pasa nada si falta).
export function iconoAyuda(clave) {
  const t = TEXTOS.campos[clave];
  if (!t) return null;
  const boton = h('button', { class: 'ayuda-i', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-label': `Ayuda: ${t.titulo}`, title: 'Qué es y qué pasa si lo cambias' }, icono('information-circle-outline'));
  boton.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); abrirAyuda(t, boton); });
  return boton;
}
