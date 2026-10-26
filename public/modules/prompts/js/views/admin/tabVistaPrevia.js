// Pestaña «Vista previa»: el servidor renderiza el borrador con valores por defecto y una imagen de ejemplo por parámetro.
import { h, icono } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { previsualizar } from '../../api/promptsAdminApi.js';
import { imagenesDeEjemplo } from './esquemaOps.js';
import { mensajesDeError } from './comun.js';

// Cada elemento sigue la numeración real del servidor: del asesor (con su grupo) o recurso fijo.
const textoImagen = (i) => (i.origen === 'recurso'
  ? t('admin.vistaPrevia.imagenRecurso', { numero: i.numero, etiqueta: i.etiqueta })
  : t('admin.vistaPrevia.imagenAsesor', { numero: i.numero, descripcion: i.descripcion || t('admin.vistaPrevia.sinDescripcion'), grupo: i.grupo }));

function listaImagenes(r) {
  const filas = (r.imagenes || []).map(i => h('li', { text: textoImagen(i) }));
  return filas.length
    ? h('div', null, h('ol', { class: 'pr-adm-imagenes' }, filas), h('span', { class: 'form-hint', text: t('admin.vistaPrevia.totalImagenes', { n: r.totalImagenes ?? filas.length }) }))
    : h('p', { class: 'form-hint', text: t('admin.vistaPrevia.sinImagenes') });
}

export function renderTabVistaPrevia(cont, ed) {
  const resultado = h('div', { class: 'pr-adm-vp-resultado' }, h('p', { class: 'form-hint', text: t('admin.vistaPrevia.inicial') }));
  const numeracion = h('div', { id: 'pr-adm-vp-numeracion' }, h('p', { class: 'form-hint', text: t('admin.vistaPrevia.numeracionInicial') }));
  const boton = h('button', { type: 'button', class: 'btn btn--primary', id: 'pr-adm-vp-actualizar' }, icono('refresh-outline'), ` ${t('admin.vistaPrevia.actualizar')}`);

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    resultado.replaceChildren(h('p', { class: 'form-hint', text: t('admin.vistaPrevia.generando') }));
    try {
      const r = await previsualizar({ esquema: ed.esquema, plantilla: ed.plantilla, imagenes: imagenesDeEjemplo(ed.esquema) });
      const errores = r.errores || [];
      const sinUsar = r.sinUsar || [];
      resultado.replaceChildren(...[
        errores.length ? h('ul', { class: 'pr-adm-errores' }, errores.map(e => h('li', { text: String(e) }))) : null,
        h('div', { class: 'pr-prompt-texto', text: r.prompt || '' }),
        h('span', { class: 'form-hint', text: t('admin.vistaPrevia.caracteres', { n: (r.prompt || '').length }) }),
        sinUsar.length ? h('p', { class: 'pr-nota', text: t('admin.vistaPrevia.sinUsar', { lista: sinUsar.map(s => s.etiqueta).join(', ') }) }) : null
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
      h('div', { class: 'pr-adm-vp-cab' }, h('h3', { class: 'pr-card-titulo', text: t('admin.vistaPrevia.titulo') }), boton),
      resultado),
    h('aside', { class: 'pr-adm-lateral' },
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: t('admin.vistaPrevia.numeracionTitulo') }),
        numeracion,
        h('span', { class: 'form-hint', text: t('admin.vistaPrevia.numeracionNota') })))));
}
