// Pestaña «Vista previa»: el servidor renderiza el borrador con valores por defecto.
import { h, icono } from '../../utils/dom.js';
import { previsualizar } from '../../api/promptsAdminApi.js';
import { parametrosDeImagenes } from './esquemaOps.js';
import { mensajesDeError } from './comun.js';

// El servidor no recibe imágenes aquí: se lista el orden en que se numerarían.
function listaLamina(esquema) {
  const filas = parametrosDeImagenes(esquema).map(({ grupo, parametro }) =>
    h('li', { text: `${grupo} · ${parametro.etiqueta} (${parametro.clave}), hasta ${parametro.max || 1} recuadros${parametro.visible_si ? ', según «Visible si»' : ''}` }));
  filas.push(h('li', { text: 'Logo de marca de agua: siempre el último recuadro' }));
  return h('ol', { class: 'pr-adm-lamina' }, filas);
}

export function renderTabVistaPrevia(cont, ed) {
  const resultado = h('div', { class: 'pr-adm-vp-resultado' }, h('p', { class: 'form-hint', text: 'Pulsa «Actualizar vista previa» para ver el prompt con los valores por defecto.' }));
  const boton = h('button', { type: 'button', class: 'btn btn--primary', id: 'pr-adm-vp-actualizar' }, icono('refresh-outline'), ' Actualizar vista previa');

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    resultado.replaceChildren(h('p', { class: 'form-hint', text: 'Generando vista previa...' }));
    try {
      const r = await previsualizar({ esquema: ed.esquema, plantilla: ed.plantilla });
      const errores = r.errores || [];
      resultado.replaceChildren(
        errores.length ? h('ul', { class: 'pr-adm-errores' }, errores.map(e => h('li', { text: String(e) }))) : null,
        h('div', { class: 'pr-prompt-texto', text: r.prompt || '' }),
        h('span', { class: 'form-hint', text: `${(r.prompt || '').length} caracteres` }));
    } catch (error) {
      resultado.replaceChildren(h('ul', { class: 'pr-adm-errores' }, mensajesDeError(error).map(m => h('li', { text: m }))));
    } finally {
      boton.disabled = false;
    }
  });

  cont.replaceChildren(h('div', { class: 'pr-adm-dos-col' },
    h('section', { class: 'pr-card' },
      h('div', { class: 'pr-adm-vp-cab' }, h('h3', { class: 'pr-card-titulo', text: 'Prompt de ejemplo' }), boton),
      resultado),
    h('aside', { class: 'pr-adm-lateral' },
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: 'Numeración de la lámina' }),
        listaLamina(ed.esquema),
        h('span', { class: 'form-hint', text: 'Los recuadros se numeran en este orden, según las imágenes que cargue el asesor.' })))));
}
