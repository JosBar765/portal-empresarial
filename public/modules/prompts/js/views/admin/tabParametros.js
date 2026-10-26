// Pestaña «Parámetros»: grupos y parámetros del esquema en memoria.
import { h, icono, $ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { abrirModal, mostrarErrorModal, confirmarModal } from '../../components/modal.js';
import { abrirModalParametro } from './modalParametro.js';
import {
  agregarGrupo, renombrarGrupo, eliminarGrupo, moverGrupo, agregarParametro, actualizarParametro,
  eliminarParametro, moverParametro, dependientesDe, renombrarEnPlantilla, etiquetaDeTipo,
  claveDesdeEtiqueta, claveGrupoDisponible
} from './esquemaOps.js';

const TEXTO_DEPENDENCIA = {
  visible_si: (d) => `«${d.etiqueta}» depende de él en «Visible si».`,
  unidad_de: (d) => `«${d.etiqueta}» lo usa como unidad.`,
  igual_a: (d) => `«${d.etiqueta}» se calcula a partir de él.`,
  plantilla: () => 'La plantilla del prompt lo usa.'
};

const valorVisible = (igual) => (igual === true ? 'Sí' : igual === false ? 'No' : String(igual));

function botonIcono(nombre, titulo, onclick, { peligro = false, deshabilitado = false } = {}) {
  return h('button', { type: 'button', class: `btn-icon${peligro ? ' icon-danger' : ''}`, title: titulo, 'aria-label': titulo, disabled: deshabilitado, onclick }, icono(nombre));
}

// Pide etiqueta (y clave si es nuevo) para crear o renombrar un grupo.
function modalGrupo({ titulo, etiqueta = '', conClave, alAceptar }) {
  const cuerpo = `<div class="form-grid">
    <div class="form-field full"><label for="pr-adm-g-etiqueta">Etiqueta</label><input id="pr-adm-g-etiqueta" maxlength="80" value="${escapeHtml(etiqueta)}"></div>
    ${conClave ? '<div class="form-field full"><label for="pr-adm-g-clave">Clave</label><input id="pr-adm-g-clave" class="pr-adm-mono" maxlength="60"><span class="form-hint">Minúsculas, números y guion bajo; empieza con una letra.</span></div>' : ''}
  </div>`;
  const pie = '<button class="btn btn--ghost" type="button" id="pr-adm-g-cancelar">Cancelar</button><button class="btn btn--primary" type="button" id="pr-adm-g-aceptar">Guardar</button>';
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
    try { fn(); } catch (error) { window.toast.warning('No se pudo aplicar', error.message); }
  };

  function eliminarParam(p) {
    const deps = dependientesDe(ed.esquema, ed.plantilla, p.clave);
    if (deps.length) {
      const lista = deps.map(d => `<li>${escapeHtml(TEXTO_DEPENDENCIA[d.tipo](d))}</li>`).join('');
      const { overlay, cerrar } = abrirModal({
        title: 'No se puede eliminar',
        bodyHtml: `<p>«${escapeHtml(p.etiqueta)}» se usa en otros lugares. Quita esas referencias primero:</p><ul class="pr-adm-lista-dep">${lista}</ul>`,
        footerHtml: '<button class="btn btn--primary" type="button" id="pr-adm-dep-ok">Entendido</button>'
      });
      $('#pr-adm-dep-ok', overlay).addEventListener('click', cerrar);
      return;
    }
    confirmarModal({ title: 'Eliminar parámetro', mensaje: `¿Eliminar «${p.etiqueta}»? Esta acción cambia el borrador.`, aceptar: 'Eliminar' })
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
    if (p.requerido) pills.push(h('span', { class: 'pr-adm-pill pr-adm-pill--req', text: 'Obligatorio' }));
    if (p.visible_si) pills.push(h('span', { class: 'pr-adm-pill pr-adm-pill--cond', text: `Visible si ${p.visible_si.parametro} = ${valorVisible(p.visible_si.igual)}` }));
    const bloqueado = !ed.editable;
    return h('div', { class: 'pr-adm-param' },
      h('div', { class: 'pr-adm-flechas' },
        botonIcono('chevron-up-outline', 'Subir', () => seguro(() => aplicar(e => moverParametro(e, p.clave, -1))), { deshabilitado: bloqueado || i === 0 }),
        botonIcono('chevron-down-outline', 'Bajar', () => seguro(() => aplicar(e => moverParametro(e, p.clave, 1))), { deshabilitado: bloqueado || i === g.parametros.length - 1 })),
      h('div', { class: 'pr-adm-param-nombre' },
        h('span', { class: 'pr-adm-param-etiqueta', text: p.etiqueta }),
        h('span', { class: 'pr-adm-mono pr-adm-muted', text: p.clave })),
      h('div', { class: 'pr-adm-pills' }, pills),
      h('div', { class: 'pr-adm-param-acciones' },
        botonIcono('create-outline', 'Editar parámetro', () => abrirParam(p, g.clave), { deshabilitado: bloqueado }),
        botonIcono('trash-outline', 'Eliminar parámetro', () => eliminarParam(p), { peligro: true, deshabilitado: bloqueado })));
  }

  function tarjetaGrupo(g, i, total) {
    const bloqueado = !ed.editable;
    const vacio = g.parametros.length === 0;
    return h('section', { class: 'pr-adm-grupo', 'data-grupo': g.clave },
      h('div', { class: 'pr-adm-grupo-cab' },
        h('div', { class: 'pr-adm-grupo-titulo' },
          h('span', { class: 'pr-adm-grupo-etiqueta', text: g.etiqueta }),
          h('span', { class: 'pr-adm-muted', text: `${g.parametros.length} ${g.parametros.length === 1 ? 'parámetro' : 'parámetros'}` })),
        h('div', { class: 'pr-adm-grupo-acciones' },
          botonIcono('chevron-up-outline', 'Subir grupo', () => seguro(() => aplicar(e => moverGrupo(e, g.clave, -1))), { deshabilitado: bloqueado || i === 0 }),
          botonIcono('chevron-down-outline', 'Bajar grupo', () => seguro(() => aplicar(e => moverGrupo(e, g.clave, 1))), { deshabilitado: bloqueado || i === total - 1 }),
          botonIcono('create-outline', 'Renombrar grupo', () => modalGrupo({ titulo: 'Renombrar grupo', etiqueta: g.etiqueta, conClave: false, alAceptar: ({ etiqueta }) => aplicar(e => renombrarGrupo(e, g.clave, etiqueta)) }), { deshabilitado: bloqueado }),
          botonIcono('trash-outline', vacio ? 'Eliminar grupo' : 'Solo se elimina un grupo vacío', () => seguro(() => aplicar(e => eliminarGrupo(e, g.clave))), { peligro: true, deshabilitado: bloqueado || !vacio }),
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: bloqueado, onclick: () => abrirParam(null, g.clave) }, icono('add-outline'), ' Agregar parámetro'))),
      vacio ? h('p', { class: 'pr-adm-grupo-vacio', text: 'Este grupo no tiene parámetros.' }) : h('div', { class: 'pr-adm-params' }, g.parametros.map((p, k) => filaParametro(g, p, k))));
  }

  function contenido() {
    const grupos = ed.esquema.grupos;
    return [
      ...grupos.map((g, i) => tarjetaGrupo(g, i, grupos.length)),
      h('div', null, h('button', {
        type: 'button', class: 'btn btn--ghost', disabled: !ed.editable,
        onclick: () => modalGrupo({
          titulo: 'Agregar grupo', conClave: true,
          alAceptar: ({ etiqueta, clave }) => {
            if (!claveGrupoDisponible(ed.esquema, clave)) throw new Error('La clave del grupo no es válida o ya existe.');
            aplicar(e => agregarGrupo(e, { clave, etiqueta }));
          }
        })
      }, icono('add-outline'), ' Agregar grupo'))
    ];
  }

  pintar();
}
