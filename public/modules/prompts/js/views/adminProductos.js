import { h, icono } from '../utils/dom.js';

// Hook de T4: esta vista se reemplaza por la administración real de productos.
export function renderAdminProductos(contenedor) {
  contenedor.replaceChildren(
    h('div', { class: 'buzon-vacio' }, icono('cube-outline'), h('p', { text: 'Administración de productos: próximamente' }))
  );
}
