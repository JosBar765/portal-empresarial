import { $ } from '../utils/dom.js';

// Menú desplegable de cuenta (avatar) — abre/cierra con clic, se cierra al
// hacer clic afuera o con Escape. Mismo patrón que public/js/dashboard.js.
export function wireAccountMenu() {
  const widget = $('#account-widget');
  const dropdown = $('#account-dropdown');
  const cerrar = () => {
    dropdown.classList.remove('visible');
    widget.setAttribute('aria-expanded', 'false');
  };
  widget.addEventListener('click', (e) => {
    e.stopPropagation();
    const abierto = dropdown.classList.toggle('visible');
    widget.setAttribute('aria-expanded', String(abierto));
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !widget.contains(e.target)) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
  });
}
