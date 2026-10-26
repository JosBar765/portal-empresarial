// Pestaña «Parámetros»: grupos y parámetros del esquema en memoria.
import { h, icono, $ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { abrirModal, mostrarErrorModal, confirmarModal } from '../../components/modal.js';
import { abrirModalParametro } from './modalParametro.js';
import { LARGOS, CLAVE_LARGO_MAX } from './reglasEsquema.js';
import {
  agregarGrupo, renombrarGrupo, eliminarGrupo, moverGrupo, agregarParametro, actualizarParametro,
  eliminarParametro, moverParametro, dependientesDe, renombrarEnPlantilla, etiquetaDeTipo,
  claveDesdeEtiqueta, claveGrupoDisponible, errorClaveGrupo
} from './esquemaOps.js';

const TEXTO_DEPENDENCIA = {
  visible_si: (d) => t('admin.parametros.depVisibleSi', { etiqueta: d.etiqueta }),
  unidad_de: (d) => t('admin.parametros.depUnidad', { etiqueta: d.etiqueta }),
  igual_a: (d) => t('admin.parametros.depCalculado', { etiqueta: d.etiqueta }),
  plantilla: () => t('admin.parametros.depPlantilla')
};

const valorVisible = (igual) => (igual === true ? t('comun.si') : igual === false ? t('comun.no') : String(igual));

function botonIcono(nombre, titulo, onclick, { peligro = false, deshabilitado = false } = {}) {
  return h('button', { type: 'button', class: `btn-icon${peligro ? ' icon-danger' : ''}`, title: titulo, 'aria-label': titulo, disabled: deshabilitado, onclick }, icono(nombre));
}

// Pide etiqueta (y clave si es nuevo) para crear o renombrar un grupo.
function modalGrupo({ titulo, etiqueta = '', conClave, alAceptar }) {
  const cuerpo = `<div class="form-grid">
    <div class="form-field full"><label for="pr-adm-g-etiqueta">${escapeHtml(t('admin.parametros.grupoEtiqueta'))}</label><input id="pr-adm-g-etiqueta" maxlength="${LARGOS.grupoEtiqueta}" value="${escapeHtml(etiqueta)}"></div>
    ${conClave ? `<div class="form-field full"><label for="pr-adm-g-clave">${escapeHtml(t('admin.parametros.grupoClave'))}</label><input id="pr-adm-g-clave" class="pr-adm-mono" maxlength="${CLAVE_LARGO_MAX}"><span class="form-hint">${escapeHtml(t('admin.parametros.grupoClaveAyuda'))}</span></div>` : ''}
  </div>`;
  const pie = `<button class="btn btn--ghost" type="button" id="pr-adm-g-cancelar">${escapeHtml(t('comun.cancelar'))}</button><button class="btn btn--primary" type="button" id="pr-adm-g-aceptar">${escapeHtml(t('admin.parametros.guardar'))}</button>`;
  const { overlay, cerrar } = abrirModal({ title: titulo, bodyHtml: cuerpo, footerHtml: pie });
  let claveTocada = false;
  const inputClave = $('#pr-adm-g-clave', overlay);
  if (inputClave) inputClave.addEventListener('input', () => { claveTocada = true; });
  $('#pr-adm-g-etiqueta', overlay).addEventListener('input', (e) => { if (inputClave && !claveTocada) inputClave.value = claveDesdeEtiqueta(e.target.value); });
  $('#pr-adm-g-cancelar', overlay).addEventListener('click', cerrar);
  $('#pr-adm-g-aceptar', overlay).addEventListener('click', () => {
    try {
      alAceptar({ etiqueta: $('#pr-adm-g-etiqueta', overlay).value, clave: inputClave ? inputClave.value.trim() : null });
      cerrar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
  });
  $('#pr-adm-g-etiqueta', overlay).focus();
}

export function renderTabParametros(cont, ed) {
  const pintar = () => cont.replaceChildren(...contenido());
  const aplicar = (fn) => {
    ed.cambiarEsquema(fn(ed.esquema));
    pintar();
  };
  const seguro = (fn) => {
    try { fn(); } catch (error) { window.toast.warning(t('admin.parametros.toastNoAplicado'), error.message); }
  };

  function eliminarParam(p) {
    const deps = dependientesDe(ed.esquema, ed.plantilla, p.clave);
    if (deps.length) {
      const lista = deps.map(d => `<li>${escapeHtml(TEXTO_DEPENDENCIA[d.tipo](d))}</li>`).join('');
      const { overlay, cerrar } = abrirModal({
        title: t('admin.parametros.noEliminarTitulo'),
        bodyHtml: `<p>${escapeHtml(t('admin.parametros.noEliminarIntro', { etiqueta: p.etiqueta }))}</p><ul class="pr-adm-lista-dep">${lista}</ul>`,
        footerHtml: `<button class="btn btn--primary" type="button" id="pr-adm-dep-ok">${escapeHtml(t('comun.entendido'))}</button>`
      });
      $('#pr-adm-dep-ok', overlay).addEventListener('click', cerrar);
      return;
    }
    confirmarModal({ title: t('admin.parametros.eliminarTitulo'), mensaje: t('admin.parametros.eliminarMensaje', { etiqueta: p.etiqueta }), aceptar: t('admin.parametros.eliminarAceptar') })
      .then((ok) => { if (ok) seguro(() => aplicar(e => eliminarParametro(e, p.clave))); });
  }

  function abrirParam(original, grupoClave) {
    abrirModalParametro(ed, {
      original,
      grupoClave,
      alGuardar: (parametro, grupoDestino) => {
        if (!original) { aplicar(e => agregarParametro(e, grupoDestino, parametro)); return; }
        const renombrada = parametro.clave !== original.clave;
        aplicar(e => actualizarParametro(e, original.clave, parametro, grupoDestino));
        if (renombrada) ed.cambiarPlantilla(renombrarEnPlantilla(ed.plantilla, original.clave, parametro.clave));
      }
    });
  }

  function filaParametro(g, p, i) {
    const pills = [h('span', { class: 'pr-adm-pill', text: etiquetaDeTipo(p.tipo) })];
    if (p.requerido) pills.push(h('span', { class: 'pr-adm-pill pr-adm-pill--req', text: t('admin.parametros.obligatorio') }));
    if (p.visible_si) pills.push(h('span', { class: 'pr-adm-pill pr-adm-pill--cond', text: t('admin.parametros.visibleSi', { parametro: p.visible_si.parametro, valor: valorVisible(p.visible_si.igual) }) }));
    const bloqueado = !ed.editable;
    return h('div', { class: 'pr-adm-param' },
      h('div', { class: 'pr-adm-flechas' },
        botonIcono('chevron-up-outline', t('admin.parametros.subir'), () => seguro(() => aplicar(e => moverParametro(e, p.clave, -1))), { deshabilitado: bloqueado || i === 0 }),
        botonIcono('chevron-down-outline', t('admin.parametros.bajar'), () => seguro(() => aplicar(e => moverParametro(e, p.clave, 1))), { deshabilitado: bloqueado || i === g.parametros.length - 1 })),
      h('div', { class: 'pr-adm-param-nombre' },
        h('span', { class: 'pr-adm-param-etiqueta', text: p.etiqueta }),
        h('span', { class: 'pr-adm-mono pr-adm-muted', text: p.clave })),
      h('div', { class: 'pr-adm-pills' }, pills),
      h('div', { class: 'pr-adm-param-acciones' },
        botonIcono('create-outline', t('admin.parametros.editarParametro'), () => abrirParam(p, g.clave), { deshabilitado: bloqueado }),
        botonIcono('trash-outline', t('admin.parametros.eliminarParametro'), () => eliminarParam(p), { peligro: true, deshabilitado: bloqueado })));
  }

  function tarjetaGrupo(g, i, total) {
    const bloqueado = !ed.editable;
    const vacio = g.parametros.length === 0;
    return h('section', { class: 'pr-adm-grupo', 'data-grupo': g.clave },
      h('div', { class: 'pr-adm-grupo-cab' },
        h('div', { class: 'pr-adm-grupo-titulo' },
          h('span', { class: 'pr-adm-grupo-etiqueta', text: g.etiqueta }),
          h('span', { class: 'pr-adm-muted', text: t(g.parametros.length === 1 ? 'admin.parametros.cuentaUno' : 'admin.parametros.cuentaVarios', { n: g.parametros.length }) })),
        h('div', { class: 'pr-adm-grupo-acciones' },
          botonIcono('chevron-up-outline', t('admin.parametros.subirGrupo'), () => seguro(() => aplicar(e => moverGrupo(e, g.clave, -1))), { deshabilitado: bloqueado || i === 0 }),
          botonIcono('chevron-down-outline', t('admin.parametros.bajarGrupo'), () => seguro(() => aplicar(e => moverGrupo(e, g.clave, 1))), { deshabilitado: bloqueado || i === total - 1 }),
          botonIcono('create-outline', t('admin.parametros.renombrarGrupo'), () => modalGrupo({ titulo: t('admin.parametros.renombrarGrupo'), etiqueta: g.etiqueta, conClave: false, alAceptar: ({ etiqueta }) => aplicar(e => renombrarGrupo(e, g.clave, etiqueta)) }), { deshabilitado: bloqueado }),
          botonIcono('trash-outline', vacio ? t('admin.parametros.eliminarGrupo') : t('admin.parametros.soloGrupoVacio'), () => seguro(() => aplicar(e => eliminarGrupo(e, g.clave))), { peligro: true, deshabilitado: bloqueado || !vacio }),
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: bloqueado, onclick: () => abrirParam(null, g.clave) }, icono('add-outline'), ` ${t('admin.parametros.agregarParametro')}`))),
      vacio ? h('p', { class: 'pr-adm-grupo-vacio', text: t('admin.parametros.grupoVacio') }) : h('div', { class: 'pr-adm-params' }, g.parametros.map((p, k) => filaParametro(g, p, k))));
  }

  function contenido() {
    const grupos = ed.esquema.grupos;
    return [
      ...grupos.map((g, i) => tarjetaGrupo(g, i, grupos.length)),
      h('div', null, h('button', {
        type: 'button', class: 'btn btn--ghost', disabled: !ed.editable,
        onclick: () => modalGrupo({
          titulo: t('admin.parametros.agregarGrupo'), conClave: true,
          alAceptar: ({ etiqueta, clave }) => {
            if (!claveGrupoDisponible(ed.esquema, clave)) throw new Error(errorClaveGrupo(ed.esquema, clave));
            aplicar(e => agregarGrupo(e, { clave, etiqueta }));
          }
        })
      }, icono('add-outline'), ` ${t('admin.parametros.agregarGrupo')}`))
    ];
  }

  pintar();
}
