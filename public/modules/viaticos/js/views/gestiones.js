import { renderEnConstruccion } from '../components/enConstruccion.js';

// Marcador: una fase siguiente lo reemplaza por la lista de gestiones.
export function renderGestiones(contenedor) {
  renderEnConstruccion(contenedor, 'tab.gestiones.titulo');
}
