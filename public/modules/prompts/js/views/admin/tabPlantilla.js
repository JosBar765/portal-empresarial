// Pestaña «Plantilla del prompt»: editor, variables disponibles y revisión en vivo.
import { h, icono } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { previsualizar } from '../../api/promptsAdminApi.js';
import { insertarEnPosicion, clavesDelEsquema, variableGrupoVacio } from './esquemaOps.js';
import { recursosDe, variableDeRecurso } from './recursosOps.js';
import { mensajesDeError } from './comun.js';

const ESPERA_REVISION_MS = 600;

export function renderTabPlantilla(cont, ed) {
  const area = h('textarea', { id: 'pr-adm-plantilla', class: 'pr-adm-plantilla', spellcheck: 'false', disabled: !ed.editable });
  area.value = ed.plantilla;
  const contador = h('span', { class: 'form-hint' });
  const revision = h('div', { class: 'pr-adm-revision', id: 'pr-adm-revision' });
  const sinUsar = h('div', { class: 'pr-adm-sin-usar', id: 'pr-adm-sin-usar' });
  const pintarContador = () => { contador.textContent = t('admin.plantilla.caracteres', { n: area.value.length }); };

  const insertar = (fragmento, retroceso = 0) => {
    if (!ed.editable) return;
    const r = insertarEnPosicion(area.value, area.selectionStart, area.selectionEnd, fragmento);
    area.value = r.texto;
    area.focus();
    area.setSelectionRange(r.cursor - retroceso, r.cursor - retroceso);
    alEscribir();
  };

  const chip = (clave) => h('button', {
    type: 'button', class: 'pr-adm-var', disabled: !ed.editable,
    onclick: () => { ed.ultimaVariable = clave; insertar(`{{${clave}}}`); }
  }, `{{${clave}}}`);

  const bloque = (tipo) => {
    if (!ed.ultimaVariable) { window.toast.warning(t('admin.plantilla.toastEligeVariable'), t('admin.plantilla.toastEligeVariableTexto')); return; }
    insertar(`{{#${tipo} ${ed.ultimaVariable}}}{{/${tipo}}}`, `{{/${tipo}}}`.length);
  };

  // Lista lo que la plantilla no nombra: el servidor lo agrega solo al final del prompt.
  function pintarSinUsar(lista) {
    sinUsar.replaceChildren(lista.length
      ? h('ul', { class: 'pr-adm-lista' }, lista.map(s => h('li', { text: t('admin.plantilla.sinUsarItem', { grupo: s.grupo, etiqueta: s.etiqueta, clave: s.clave }) })))
      : h('p', { class: 'pr-adm-ok' }, icono('checkmark-circle-outline'), ` ${t('admin.plantilla.todosNombrados')}`));
  }

  // Un token descarta respuestas viejas si el usuario siguió escribiendo.
  let token = 0;
  let temporizador = null;
  async function revisar() {
    const mio = ++token;
    revision.replaceChildren(h('span', { class: 'form-hint', text: t('admin.plantilla.revisando') }));
    try {
      const r = await previsualizar({ esquema: ed.esquema, plantilla: ed.plantilla });
      if (mio !== token || !cont.isConnected) return;
      const errores = r.errores || [];
      pintarSinUsar(r.sinUsar || []);
      revision.replaceChildren(errores.length
        ? h('ul', { class: 'pr-adm-errores' }, errores.map(e => h('li', { text: String(e) })))
        : h('p', { class: 'pr-adm-ok' }, icono('checkmark-circle-outline'), ` ${t('admin.plantilla.revisionOk')}`));
    } catch (error) {
      if (mio !== token || !cont.isConnected) return;
      sinUsar.replaceChildren();
      revision.replaceChildren(h('ul', { class: 'pr-adm-errores' }, mensajesDeError(error).map(m => h('li', { text: m }))));
    }
  }

  function alEscribir() {
    ed.cambiarPlantilla(area.value);
    pintarContador();
    clearTimeout(temporizador);
    temporizador = setTimeout(revisar, ESPERA_REVISION_MS);
  }
  area.addEventListener('input', alEscribir);

  const claves = clavesDelEsquema(ed.esquema);
  const recursos = recursosDe(ed.esquema).map(r => variableDeRecurso(r.clave));
  const gruposVacios = ed.esquema.grupos.map(g => variableGrupoVacio(g.clave));
  cont.replaceChildren(h('div', { class: 'pr-adm-dos-col' },
    h('section', { class: 'pr-card' },
      h('h3', { class: 'pr-card-titulo', text: t('admin.plantilla.titulo') }),
      area,
      contador),
    h('aside', { class: 'pr-adm-lateral' },
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: t('admin.plantilla.variables') }),
        h('div', { class: 'pr-adm-vars' }, claves.map(chip)),
        recursos.length ? h('span', { class: 'form-hint', text: t('admin.plantilla.variablesRecursos') }) : null,
        recursos.length ? h('div', { class: 'pr-adm-vars' }, recursos.map(chip)) : null,
        gruposVacios.length ? h('span', { class: 'form-hint', text: t('admin.plantilla.variablesGrupos') }) : null,
        gruposVacios.length ? h('div', { class: 'pr-adm-vars' }, gruposVacios.map(chip)) : null,
        gruposVacios.length ? h('span', { class: 'form-hint', text: t('admin.plantilla.variablesGruposAyuda', { variable: 'grupo_<clave>_vacio', ejemplo: '{{#si grupo_<clave>_vacio}}' }) }) : null,
        h('span', { class: 'form-hint', text: t('admin.plantilla.variablesAutomaticas') }),
        h('div', { class: 'pr-adm-vars' }, ed.config.variablesAutomaticas.map(chip)),
        h('div', { class: 'pr-adm-bloques' },
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: !ed.editable, onclick: () => bloque('si') }, t('admin.plantilla.bloqueSi')),
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: !ed.editable, onclick: () => bloque('no') }, t('admin.plantilla.bloqueNo')))),
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: t('admin.plantilla.sinUsarTitulo') }),
        sinUsar,
        h('p', { class: 'form-hint', text: t('admin.plantilla.sinUsarAyuda', { variable: '{{otros_parametros}}' }) }),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: !ed.editable, onclick: () => insertar('{{otros_parametros}}') }, t('admin.plantilla.insertarOtros', { variable: '{{otros_parametros}}' }))),
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: t('admin.plantilla.revisionTitulo') }),
        revision),
      h('p', { class: 'pr-nota', text: t('admin.plantilla.notaEncabezado') }))));

  pintarContador();
  revisar();
}
