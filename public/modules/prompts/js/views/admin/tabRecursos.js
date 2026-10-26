// Pestaña «Recursos»: imágenes fijas del producto (p. ej. la plantilla guardada en Supabase).
import { h, icono, $ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { abrirModal, confirmarModal } from '../../components/modal.js';
import { abrirModalRecurso } from './modalRecurso.js';
import { copiarTexto, miniaturaRecurso } from './comun.js';
import {
  recursosDe, variableDeRecurso, agregarRecurso, actualizarRecurso, eliminarRecurso, moverRecurso,
  usosEnPlantilla, renombrarRecursoEnPlantilla
} from './recursosOps.js';

function botonIcono(nombre, titulo, onclick, { peligro = false, deshabilitado = false } = {}) {
  return h('button', { type: 'button', class: `btn-icon${peligro ? ' icon-danger' : ''}`, title: titulo, 'aria-label': titulo, disabled: deshabilitado, onclick }, icono(nombre));
}

async function copiarVariable(variable) {
  try {
    await copiarTexto(variable);
    window.toast.success(t('admin.recursos.toastVariableCopiada'), variable);
  } catch (e) {
    window.toast.warning(t('admin.recursos.toastNoCopiada'), t('admin.recursos.toastNoCopiadaTexto'));
  }
}

export function renderTabRecursos(cont, ed) {
  const { limites, variablesAutomaticas } = ed.config;
  const pintar = () => cont.replaceChildren(...contenido());
  const aplicar = (fn) => {
    ed.cambiarEsquema(fn(ed.esquema));
    pintar();
  };
  const seguro = (fn) => {
    try { fn(); } catch (error) { window.toast.warning(t('admin.recursos.toastNoAplicado'), error.message); }
  };

  function eliminar(r) {
    const usos = usosEnPlantilla(ed.plantilla, r.clave);
    if (usos.length) {
      const lista = usos.map(u => `<li><code>${escapeHtml(u)}</code></li>`).join('');
      const { overlay, cerrar } = abrirModal({
        title: t('admin.recursos.noEliminarTitulo'),
        bodyHtml: `<p>${escapeHtml(t('admin.recursos.noEliminarIntro', { etiqueta: r.etiqueta }))}</p><ul class="pr-adm-lista-dep">${lista}</ul>`,
        footerHtml: `<button class="btn btn--primary" type="button" id="pr-adm-rec-dep-ok">${escapeHtml(t('comun.entendido'))}</button>`
      });
      $('#pr-adm-rec-dep-ok', overlay).addEventListener('click', cerrar);
      return;
    }
    confirmarModal({ title: t('admin.recursos.eliminarTitulo'), mensaje: t('admin.recursos.eliminarMensaje', { etiqueta: r.etiqueta }), aceptar: t('admin.recursos.eliminarAceptar') })
      .then((ok) => { if (ok) seguro(() => aplicar(e => eliminarRecurso(e, r.clave))); });
  }

  function abrir(original) {
    abrirModalRecurso(ed, {
      original,
      alGuardar: (recurso) => {
        if (!original) { aplicar(e => agregarRecurso(e, recurso, { automaticas: variablesAutomaticas, limites })); return; }
        aplicar(e => actualizarRecurso(e, original.clave, recurso, { automaticas: variablesAutomaticas }));
        // Si la clave cambió, la plantilla sigue nombrando el recurso.
        if (recurso.clave !== original.clave) ed.cambiarPlantilla(renombrarRecursoEnPlantilla(ed.plantilla, original.clave, recurso.clave));
      }
    });
  }

  function tarjeta(r, i, total) {
    const bloqueado = !ed.editable;
    const variable = `{{${variableDeRecurso(r.clave)}}}`;
    return h('section', { class: 'pr-adm-rec', 'data-recurso': r.clave },
      miniaturaRecurso(r.url),
      h('div', { class: 'pr-adm-rec-cuerpo' },
        h('div', { class: 'pr-adm-rec-cab' },
          h('span', { class: 'pr-adm-grupo-etiqueta', text: r.etiqueta }),
          h('span', { class: 'pr-adm-pill', text: t(r.posicion === 'fin' ? 'admin.recursos.posicionFin' : 'admin.recursos.posicionInicio') }),
          h('span', { class: `pr-adm-pill ${r.activo ? 'pr-adm-pill--req' : ''}`, text: t(r.activo ? 'admin.recursos.estadoActivo' : 'admin.recursos.estadoInactivo') })),
        r.descripcion ? h('p', { class: 'pr-adm-rec-desc', text: r.descripcion }) : null,
        h('div', { class: 'pr-adm-rec-variable' },
          h('code', { class: 'pr-adm-mono', text: variable }),
          botonIcono('copy-outline', t('admin.recursos.copiarVariable'), () => copiarVariable(variable)))),
      h('div', { class: 'pr-adm-param-acciones' },
        botonIcono('chevron-up-outline', t('admin.parametros.subir'), () => seguro(() => aplicar(e => moverRecurso(e, r.clave, -1))), { deshabilitado: bloqueado || i === 0 }),
        botonIcono('chevron-down-outline', t('admin.parametros.bajar'), () => seguro(() => aplicar(e => moverRecurso(e, r.clave, 1))), { deshabilitado: bloqueado || i === total - 1 }),
        botonIcono('create-outline', t('admin.recursos.editar'), () => abrir(r), { deshabilitado: bloqueado }),
        botonIcono('trash-outline', t('admin.recursos.eliminar'), () => eliminar(r), { peligro: true, deshabilitado: bloqueado })));
  }

  function contenido() {
    const recursos = recursosDe(ed.esquema);
    const lleno = recursos.length >= limites.recursos_max;
    return [
      h('div', { class: 'pr-banner' }, icono('information-circle-outline'), h('span', { text: t('admin.recursos.intro', { max: limites.recursos_max }) })),
      recursos.length
        ? h('div', { class: 'pr-adm-recursos' }, recursos.map((r, i) => tarjeta(r, i, recursos.length)))
        : h('div', { class: 'buzon-vacio' }, icono('image-outline'), h('p', { text: t('admin.recursos.vacio') })),
      h('div', null, h('button', {
        type: 'button', class: 'btn btn--ghost', id: 'pr-adm-rec-agregar', disabled: !ed.editable || lleno,
        title: lleno ? t('admin.recursos.limiteAlcanzado', { max: limites.recursos_max }) : '',
        onclick: () => abrir(null)
      }, icono('add-outline'), ` ${t('admin.recursos.agregar')}`))
    ];
  }

  pintar();
}
