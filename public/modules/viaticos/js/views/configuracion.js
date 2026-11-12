import { renderEnConstruccion } from '../components/enConstruccion.js';

// Marcador: una fase siguiente lo reemplaza por las subpestañas de configuración.
export function renderConfiguracion(contenedor) {
  renderEnConstruccion(contenedor, 'tab.configuracion.titulo');
}
