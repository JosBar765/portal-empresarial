// «← Volver a <pantalla>»: aparece arriba de la pantalla a la que se llegó desde un aviso de la campana, para regresar a donde se estaba.
// Se quita sola al usarla o al seguir navegando (lo decide app.js).
import { h, icono } from '../utils/dom.js';

export function barraVolver({ texto, alVolver }) {
  return h('div', { class: 'barra-volver', role: 'navigation', 'aria-label': 'Volver' },
    h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: alVolver }, icono('arrow-back-outline'), `Volver a ${texto}`));
}
