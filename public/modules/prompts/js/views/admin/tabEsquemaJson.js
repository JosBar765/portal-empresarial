// Pestaña «Esquema JSON»: solo lectura, útil para revisar o copiar.
import { h } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { copiarTexto } from './comun.js';

export function renderTabEsquemaJson(cont, ed) {
  const json = JSON.stringify(ed.esquema, null, 2);
  const boton = h('button', { type: 'button', class: 'btn btn--ghost', id: 'pr-adm-json-copiar', text: t('admin.json.copiar') });
  boton.addEventListener('click', async () => {
    try {
      await copiarTexto(json);
      window.toast.success(t('admin.json.toastCopiado'), t('admin.json.toastCopiadoTexto'));
    } catch (e) {
      window.toast.warning(t('admin.json.toastNoCopiado'), t('admin.json.toastNoCopiadoTexto'));
    }
  });
  cont.replaceChildren(h('section', { class: 'pr-card' },
    h('div', { class: 'pr-adm-vp-cab' }, h('h3', { class: 'pr-card-titulo', text: t('admin.json.titulo') }), boton),
    h('pre', { class: 'pr-adm-json', id: 'pr-adm-json', text: json })));
}
