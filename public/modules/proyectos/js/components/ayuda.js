// Ayuda integrada de las pantallas de Configuración: «¿Cómo funciona?» (desplegable bajo el título) y el icono (i) de los
// ajustes con reglas. Todos los textos salen de ../ayuda/textos.js. En escritorio el (i) abre un recuadro junto al icono; en el
// celular, una hoja desde abajo. Nada de esto cambia lo que la persona está escribiendo.
import { h, icono } from '../utils/dom.js';
import { TEXTOS } from '../ayuda/textos.js';

const CELULAR = '(max-width: 640px)';
let contador = 0;
let abierta = null; // { cerrar } de la ayuda (i) abierta ahora

const recordar = (clave, valor) => { try { sessionStorage.setItem(`proyectos:ayuda:${clave}`, valor ? '1' : '0'); } catch (e) { /* solo comodidad */ } };
const recordada = (clave) => { try { return sessionStorage.getItem(`proyectos:ayuda:${clave}`) === '1'; } catch (e) { return false; } };

const lista = (valor) => (Array.isArray(valor) ? valor : (valor ? [valor] : []));

// Un bloque con título: párrafo o lista de viñetas.
function bloque(titulo, contenido, clase = '') {
  const items = lista(contenido);
  if (!items.length) return null;
  return h('section', { class: `ayuda-bloque ${clase}`.trim() },
    h('h3', { class: 'ayuda-bloque-titulo', text: titulo }),
    items.length === 1 ? h('p', { text: items[0] }) : h('ul', null, items.map(t => h('li', { text: t }))));
}

// El cuerpo de una pantalla: para qué sirve, qué se puede cambiar, qué pasa al cambiarlo, ejemplo y lo importante.
function cuerpoPantalla(t) {
  return [
    bloque('Para qué sirve', t.sirve),
    t.guia ? h('section', { class: 'ayuda-bloque' }, h('h3', { class: 'ayuda-bloque-titulo', text: 'Por dónde empezar' }), h('ol', null, t.guia.map(p => h('li', { text: p })))) : null,
    bloque('Qué puedes cambiar', t.cambias),
    bloque('Qué pasa cuando lo cambias', t.efecto),
    bloque('Ejemplo', t.ejemplo, 'ayuda-bloque--ejemplo'),
    bloque('Ten en cuenta', t.ojo, 'ayuda-bloque--ojo')
  ].filter(Boolean);
}

// Ayuda de la pantalla: botón «¿Cómo funciona?» que despliega la explicación completa, sin salir de la pantalla.
export function comoFunciona(clave) {
  const t = TEXTOS.pantallas[clave];
  if (!t) return null;
  const id = `ayuda-pantalla-${++contador}`;
  const flecha = icono('chevron-down-outline');
  flecha.classList.add('ayuda-flecha');
  const boton = h('button', { class: 'ayuda-boton', type: 'button', 'aria-expanded': 'false', 'aria-controls': id }, icono('help-circle-outline'), h('span', { text: '¿Cómo funciona?' }), flecha);
  const panel = h('div', { class: 'ayuda-panel', id, role: 'region', 'aria-label': '¿Cómo funciona esta pantalla?', hidden: true }, cuerpoPantalla(t));
  const poner = (abierto) => { boton.setAttribute('aria-expanded', String(abierto)); panel.hidden = !abierto; recordar(clave, abierto); };
  boton.addEventListener('click', () => poner(panel.hidden));
  if (recordada(clave)) { boton.setAttribute('aria-expanded', 'true'); panel.hidden = false; }
  return h('div', { class: 'ayuda-pantalla' }, boton, panel);
}

function cerrarAbierta() { if (abierta) abierta.cerrar(); }

function abrirAyuda(t, origen) {
  cerrarAbierta();
  const celular = window.matchMedia(CELULAR).matches;
  const idTitulo = `ayuda-titulo-${++contador}`;
  const cuerpo = [bloque('Qué es', t.que), bloque('Qué pasa cuando lo cambias', t.efecto), bloque('Ejemplo', t.ejemplo, 'ayuda-bloque--ejemplo'), bloque('Ten en cuenta', t.ojo, 'ayuda-bloque--ojo')].filter(Boolean);
  const cerrarBoton = h('button', { class: 'ayuda-cerrar', type: 'button', 'aria-label': 'Cerrar la ayuda' }, icono('close-outline'));
  const entendido = celular ? h('button', { class: 'btn btn--primary ayuda-entendido', type: 'button', text: 'Entendido' }) : null;
  const caja = h('div', { class: celular ? 'ayuda-hoja' : 'ayuda-recuadro', role: 'dialog', 'aria-modal': celular ? 'true' : 'false', 'aria-labelledby': idTitulo },
    h('div', { class: 'ayuda-cabecera' }, h('h2', { class: 'ayuda-titulo', id: idTitulo, text: t.titulo }), cerrarBoton),
    h('div', { class: 'ayuda-cuerpo' }, cuerpo), entendido);
  const fondo = celular ? h('div', { class: 'ayuda-fondo' }, caja) : null;
  document.body.append(fondo || caja);
  if (celular) document.body.classList.add('ayuda-sin-scroll');

  function colocar() {
    if (celular) return;
    const r = origen.getBoundingClientRect();
    const ancho = Math.min(380, window.innerWidth - 24);
    caja.style.width = `${ancho}px`;
    const izquierda = Math.max(12, Math.min(r.left, window.innerWidth - ancho - 12));
    const debajo = r.bottom + 8;
    const alto = caja.offsetHeight;
    const arriba = debajo + alto > window.innerHeight - 12 ? Math.max(12, r.top - alto - 8) : debajo;
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
