// Pestaña «Esquema JSON»: solo lectura, útil para revisar o copiar.
import { h } from '../../utils/dom.js';

async function copiar(texto) {
  if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texto); return; }
  throw new Error('sin portapapeles');
}

export function renderTabEsquemaJson(cont, ed) {
  const json = JSON.stringify(ed.esquema, null, 2);
  const boton = h('button', { type: 'button', class: 'btn btn--ghost', id: 'pr-adm-json-copiar', text: 'Copiar JSON' });
  boton.addEventListener('click', async () => {
    try {
      await copiar(json);
      window.toast.success('JSON copiado', 'El esquema quedó en tu portapapeles.');
    } catch (e) {
      window.toast.warning('No se pudo copiar', 'Selecciona el texto y cópialo con Ctrl+C.');
    }
  });
  cont.replaceChildren(h('section', { class: 'pr-card' },
    h('div', { class: 'pr-adm-vp-cab' }, h('h3', { class: 'pr-card-titulo', text: 'Esquema JSON' }), boton),
    h('pre', { class: 'pr-adm-json', id: 'pr-adm-json', text: json })));
}
