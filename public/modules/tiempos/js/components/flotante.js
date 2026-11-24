// public/modules/tiempos/js/components/flotante.js
// Un botón con un panel que se despliega debajo (computadora) o sube desde abajo como hoja (celular). Se cierra al elegir algo,
// al tocar fuera o con Escape. `construir(cerrar)` arma el contenido cada vez que se abre.
import { h, icono } from '../utils/dom.js';

const cerradores = new Set();
document.addEventListener('click', () => cerradores.forEach(c => c()));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerradores.forEach(c => c()); });

export function crearFlotante({ boton, titulo, subtitulo, construir, clase = '' }) {
  const panel = h('div', { class: `tm-flotante ${clase}`.trim(), hidden: '', role: 'dialog', 'aria-label': titulo });
  const fondo = h('div', { class: 'tm-flotante-fondo', hidden: '' });
  const cerrar = () => {
    if (panel.hidden) return;
    panel.hidden = true; fondo.hidden = true; boton.setAttribute('aria-expanded', 'false');
  };
  const abrir = () => {
    cerradores.forEach(c => { if (c !== cerrar) c(); });
    panel.replaceChildren(
      h('div', { class: 'tm-flotante-cabecera' },
        h('div', null, h('div', { class: 'tm-flotante-titulo', text: titulo }), subtitulo ? h('div', { class: 'tm-tenue', text: subtitulo }) : null),
        h('button', { class: 'btn btn--ghost btn--solo-icono tm-flotante-cerrar', type: 'button', 'aria-label': 'Cerrar', onclick: cerrar }, icono('close-outline'))),
      construir(cerrar));
    panel.hidden = false; fondo.hidden = false; boton.setAttribute('aria-expanded', 'true');
    const foco = panel.querySelector('input, button.tm-opcion, button:not(.tm-flotante-cerrar)');
    if (foco) foco.focus({ preventScroll: true });
  };
  boton.setAttribute('aria-haspopup', 'dialog');
  boton.setAttribute('aria-expanded', 'false');
  boton.addEventListener('click', (e) => { e.stopPropagation(); if (panel.hidden) abrir(); else cerrar(); });
  fondo.addEventListener('click', cerrar);
  panel.addEventListener('click', (e) => e.stopPropagation());
  cerradores.add(cerrar);
  return { nodo: h('div', { class: 'tm-flotante-contenedor' }, boton, fondo, panel), cerrar, abrir };
}
