// Pestaña «Vista previa»: el servidor renderiza el borrador con valores por defecto y una imagen de ejemplo por parámetro.
import { h, icono } from '../../utils/dom.js';
import { previsualizar } from '../../api/promptsAdminApi.js';
import { imagenesDeEjemplo } from './esquemaOps.js';
import { mensajesDeError } from './comun.js';

const textoImagen = (i) => `Imagen ${i.numero}: ` + [i.grupo, i.nombre, i.descripcion, i.ubicacion ? `ubicación: ${i.ubicacion}` : ''].filter(Boolean).join(' · ');

// Numeración real que devolvió el servidor, con el logo siempre al final.
function listaImagenes(r) {
  const filas = (r.imagenes || []).map(i => h('li', { text: textoImagen(i) }));
  if (r.logo) filas.push(h('li', { text: `Logo de marca de agua: imagen ${r.logo.numero}` }));
  return filas.length ? h('ol', { class: 'pr-adm-imagenes' }, filas) : h('p', { class: 'form-hint', text: 'Sin imágenes.' });
}

export function renderTabVistaPrevia(cont, ed) {
  const resultado = h('div', { class: 'pr-adm-vp-resultado' }, h('p', { class: 'form-hint', text: 'Pulsa «Actualizar vista previa» para ver el prompt con los valores por defecto.' }));
  const numeracion = h('div', { id: 'pr-adm-vp-numeracion' }, h('p', { class: 'form-hint', text: 'Aparece al generar la vista previa.' }));
  const boton = h('button', { type: 'button', class: 'btn btn--primary', id: 'pr-adm-vp-actualizar' }, icono('refresh-outline'), ' Actualizar vista previa');

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    resultado.replaceChildren(h('p', { class: 'form-hint', text: 'Generando vista previa...' }));
    try {
      const r = await previsualizar({ esquema: ed.esquema, plantilla: ed.plantilla, imagenes: imagenesDeEjemplo(ed.esquema) });
      const errores = r.errores || [];
      const sinUsar = r.sinUsar || [];
      resultado.replaceChildren(...[
        errores.length ? h('ul', { class: 'pr-adm-errores' }, errores.map(e => h('li', { text: String(e) }))) : null,
        h('div', { class: 'pr-prompt-texto', text: r.prompt || '' }),
        h('span', { class: 'form-hint', text: `${(r.prompt || '').length} caracteres` }),
        sinUsar.length ? h('p', { class: 'pr-nota', text: `La plantilla no nombra: ${sinUsar.map(s => s.etiqueta).join(', ')}. Se agregan en «ESPECIFICACIONES ADICIONALES».` }) : null
      ].filter(Boolean));
      numeracion.replaceChildren(listaImagenes(r));
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
        h('h3', { class: 'pr-card-titulo', text: 'Numeración de las imágenes' }),
        numeracion,
        h('span', { class: 'form-hint', text: 'Con una imagen de ejemplo por parámetro visible; el asesor carga las suyas.' })))));
}
