// Pestaña «Plantilla del prompt»: editor, variables disponibles y revisión en vivo.
import { h, icono } from '../../utils/dom.js';
import { previsualizar } from '../../api/promptsAdminApi.js';
import { insertarEnPosicion, VARIABLES_AUTOMATICAS } from './esquemaOps.js';
import { mensajesDeError } from './comun.js';

const ESPERA_REVISION_MS = 600;

export function renderTabPlantilla(cont, ed) {
  const area = h('textarea', { id: 'pr-adm-plantilla', class: 'pr-adm-plantilla', spellcheck: 'false', disabled: !ed.editable });
  area.value = ed.plantilla;
  const contador = h('span', { class: 'form-hint' });
  const revision = h('div', { class: 'pr-adm-revision', id: 'pr-adm-revision' });
  const sinUsar = h('div', { class: 'pr-adm-sin-usar', id: 'pr-adm-sin-usar' });
  const pintarContador = () => { contador.textContent = `${area.value.length} caracteres`; };

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
    if (!ed.ultimaVariable) { window.toast.warning('Elige una variable', 'Haz clic primero en una variable para usarla en el bloque.'); return; }
    insertar(`{{#${tipo} ${ed.ultimaVariable}}}{{/${tipo}}}`, `{{/${tipo}}}`.length);
  };

  // Lista lo que la plantilla no nombra: el servidor lo agrega solo al final del prompt.
  function pintarSinUsar(lista) {
    sinUsar.replaceChildren(lista.length
      ? h('ul', { class: 'pr-adm-lista' }, lista.map(s => h('li', { text: `${s.grupo} · ${s.etiqueta} (${s.clave})` })))
      : h('p', { class: 'pr-adm-ok' }, icono('checkmark-circle-outline'), ' La plantilla nombra todos los parámetros.'));
  }

  // Un token descarta respuestas viejas si el usuario siguió escribiendo.
  let token = 0;
  let temporizador = null;
  async function revisar() {
    const mio = ++token;
    revision.replaceChildren(h('span', { class: 'form-hint', text: 'Revisando...' }));
    try {
      const r = await previsualizar({ esquema: ed.esquema, plantilla: ed.plantilla });
      if (mio !== token || !cont.isConnected) return;
      const errores = r.errores || [];
      pintarSinUsar(r.sinUsar || []);
      revision.replaceChildren(errores.length
        ? h('ul', { class: 'pr-adm-errores' }, errores.map(e => h('li', { text: String(e) })))
        : h('p', { class: 'pr-adm-ok' }, icono('checkmark-circle-outline'), ' Todas las variables existen y los bloques están bien cerrados.'));
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

  const claves = ed.esquema.grupos.flatMap(g => g.parametros.map(p => p.clave));
  cont.replaceChildren(h('div', { class: 'pr-adm-dos-col' },
    h('section', { class: 'pr-card' },
      h('h3', { class: 'pr-card-titulo', text: 'Plantilla del prompt' }),
      area,
      contador),
    h('aside', { class: 'pr-adm-lateral' },
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: 'Variables disponibles' }),
        h('div', { class: 'pr-adm-vars' }, claves.map(chip)),
        h('span', { class: 'form-hint', text: 'Automáticas' }),
        h('div', { class: 'pr-adm-vars' }, VARIABLES_AUTOMATICAS.map(chip)),
        h('div', { class: 'pr-adm-bloques' },
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: !ed.editable, onclick: () => bloque('si') }, 'Bloque si'),
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: !ed.editable, onclick: () => bloque('no') }, 'Bloque no'))),
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: 'Parámetros que la plantilla no nombra' }),
        sinUsar,
        h('p', { class: 'form-hint', text: 'Se agregan solos a la sección “ESPECIFICACIONES ADICIONALES”: donde pongas {{otros_parametros}} o, si no la usas, al final del prompt.' }),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: !ed.editable, onclick: () => insertar('{{otros_parametros}}') }, 'Insertar {{otros_parametros}}')),
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: 'Revisión' }),
        revision),
      h('p', { class: 'pr-nota', text: 'El encabezado “NUEVA INSTRUCCIÓN: ignora cualquier propuesta anterior…” lo agrega el sistema a todos los productos y no se puede quitar.' }))));

  pintarContador();
  revisar();
}
