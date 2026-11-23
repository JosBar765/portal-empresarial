// Barra inferior del celular para quien gestiona empresas (Mi proyecto, Para hoy, Cartera y Más). En escritorio no se ve:
// ahí manda el menú lateral. «Más» abre ese mismo menú.
import { h, icono, $ } from '../utils/dom.js';

const ITEMS = [
  ['miproyecto', 'home-outline', 'Mi proyecto'],
  ['parahoy', 'time-outline', 'Para hoy'],
  ['clientes', 'business-outline', 'Cartera']
];

export function montarBarraInferior() {
  const barra = h('nav', { class: 'barra-inferior', 'aria-label': 'Navegación principal' },
    ITEMS.map(([ruta, nombre, texto]) => h('a', { class: 'barra-item', href: `#/${ruta}`, 'data-ruta': ruta }, icono(nombre), h('span', { text: texto }))),
    h('button', { class: 'barra-item', type: 'button', 'data-ruta': 'mas', onclick: () => $('#sidebar-toggle-mobile').click() }, icono('menu-outline'), h('span', { text: 'Más' })));
  document.body.append(barra);
  document.body.classList.add('con-barra-inferior');
}

// «Más» queda marcado en las pantallas que no tienen su propio botón (por ejemplo, Mis proyectos anteriores).
export function marcarBarraInferior(ruta) {
  const propia = ITEMS.some(([r]) => r === ruta);
  document.querySelectorAll('.barra-item[data-ruta]').forEach(item => item.classList.toggle('barra-item--activo', propia ? item.dataset.ruta === ruta : item.dataset.ruta === 'mas'));
}
