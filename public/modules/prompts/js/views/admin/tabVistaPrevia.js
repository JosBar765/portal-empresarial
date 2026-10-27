// Pestaña «Vista previa»: solo lectura; el servidor autogenera el prompt completo del borrador con valores e imágenes de ejemplo (los nombres ejemplo-N.png los inventa esta vista, no vienen del formulario del asesor).
import { h, icono, montar } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { previsualizar } from '../../api/promptsAdminApi.js';
import { imagenesDeEjemplo, valoresDeEjemplo } from './esquemaOps.js';
import { mensajesDeError } from './comun.js';

// Una regla inactiva no se incluye; una activa que quedó vacía tampoco (sus variables no tenían datos).
const motivoOmitida = (r) => t(r.activo ? 'admin.vistaPrevia.reglaOmitidaVacia' : 'admin.vistaPrevia.reglaOmitidaInactiva');

function filaRegla(r, n) {
  return h('li', { class: `pr-adm-vp-fila ${r.incluida ? '' : 'is-omitida'}`, 'data-regla': r.clave },
    h('span', { class: 'pr-adm-vp-orden', text: String(n) }),
    h('span', { class: 'pr-adm-vp-etiqueta', text: r.etiqueta }),
    r.incluida
      ? h('span', { class: 'pr-adm-vp-ok', title: t('admin.vistaPrevia.reglaIncluida') }, icono('checkmark-circle-outline'))
      : h('span', { class: 'pr-adm-pill pr-adm-pill--cond', text: motivoOmitida(r) }));
}

// Las reglas se agrupan por posición; el número conserva el orden en que se aplican.
function listaReglas(reglas) {
  if (!reglas.length) return h('p', { class: 'form-hint', text: t('admin.vistaPrevia.sinReglas') });
  const grupos = [['inicio', 'admin.vistaPrevia.grupoInicio'], ['fin', 'admin.vistaPrevia.grupoFin']]
    .map(([pos, clave]) => ({ clave, filas: reglas.map((r, i) => ({ r, n: i + 1 })).filter(x => (x.r.posicion === 'fin' ? 'fin' : 'inicio') === pos) }))
    .filter(g => g.filas.length);
  return h('div', { class: 'pr-adm-vp-grupos' }, grupos.map(g => h('div', null,
    h('h4', { class: 'pr-adm-vp-subtitulo', text: t(g.clave) }),
    h('ul', { class: 'pr-adm-vp-lista' }, g.filas.map(x => filaRegla(x.r, x.n))))));
}

// Recursos fijos tal como están en el borrador del editor (no dependen de la respuesta del servidor).
function listaRecursos(recursos, minimo) {
  if (!recursos.length) return h('p', { class: 'form-hint', text: t('admin.vistaPrevia.recursosVacio', { min: minimo }) });
  return h('ul', { class: 'pr-adm-vp-lista' }, recursos.map(r => h('li', { class: `pr-adm-vp-fila ${r.activo ? '' : 'is-omitida'}`, 'data-recurso': r.clave },
    h('span', { class: 'pr-adm-vp-etiqueta', text: r.etiqueta }),
    h('div', { class: 'pr-adm-vp-pills' },
      h('span', { class: `pr-adm-pill ${r.activo ? 'pr-adm-pill--req' : ''}`, text: t(r.activo ? 'admin.recursos.estadoActivo' : 'admin.recursos.estadoInactivo') }),
      h('span', { class: 'pr-adm-pill', text: t(r.posicion === 'fin' ? 'admin.recursos.posicionFin' : 'admin.recursos.posicionInicio') }),
      String(r.url || '').trim() ? null : h('span', { class: 'pr-adm-pill pr-adm-pill--cond', text: t('admin.vistaPrevia.recursoSinUrl') })))));
}

export function renderTabVistaPrevia(cont, ed) {
  const resultado = h('div', { class: 'pr-adm-vp-resultado' }, h('p', { class: 'form-hint', text: t('admin.vistaPrevia.inicial') }));
  const recursos = h('div', { id: 'pr-adm-vp-recursos' }, h('p', { class: 'form-hint', text: t('admin.vistaPrevia.recursosInicial') }));
  const reglas = h('div', { id: 'pr-adm-vp-reglas' }, h('p', { class: 'form-hint', text: t('admin.vistaPrevia.reglasInicial') }));
  const boton = h('button', { type: 'button', class: 'btn btn--primary', id: 'pr-adm-vp-actualizar' }, icono('refresh-outline'), ` ${t('admin.vistaPrevia.actualizar')}`);

  async function actualizar() {
    boton.disabled = true;
    montar(resultado, h('p', { class: 'form-hint', text: t('admin.vistaPrevia.generando') }));
    try {
      // Si hay cambios sin guardar se guardan primero; si no se pueden guardar, el aviso ya explica por qué.
      if (!(await ed.guardarPendientes())) {
        montar(resultado, h('p', { class: 'form-hint', text: t('admin.vistaPrevia.sinGuardar') }));
        return;
      }
      const r = await previsualizar({ esquema: ed.esquema, valores: valoresDeEjemplo(ed.esquema), imagenes: imagenesDeEjemplo(ed.esquema) });
      const errores = r.errores || [];
      montar(resultado,
        errores.length ? h('ul', { class: 'pr-adm-errores' }, errores.map(e => h('li', { text: typeof e === 'string' ? e : (e && e.mensaje) || '' }))) : null,
        r.prompt ? h('div', { class: 'pr-prompt-texto', text: r.prompt }) : null,
        r.prompt ? h('span', { class: 'form-hint', text: t('admin.vistaPrevia.caracteres', { n: r.prompt.length }) }) : null);
      montar(reglas, listaReglas(r.reglas || []));
      montar(recursos, listaRecursos(ed.esquema.recursos || [], ed.config.limites.recursos_min_publicar));
    } catch (error) {
      montar(resultado, h('ul', { class: 'pr-adm-errores' }, mensajesDeError(error).map(m => h('li', { text: m }))));
    } finally {
      boton.disabled = false;
    }
  }

  boton.addEventListener('click', actualizar);

  montar(cont, h('div', { class: 'pr-adm-dos-col pr-adm-vp-layout' },
    h('section', { class: 'pr-card' },
      h('div', { class: 'pr-adm-vp-cab' }, h('h3', { class: 'pr-card-titulo', text: t('admin.vistaPrevia.titulo') }), boton),
      h('p', { class: 'form-hint', text: t('admin.vistaPrevia.nota') }),
      h('div', { class: 'pr-adm-vp-scroll' }, resultado)),
    h('aside', { class: 'pr-adm-lateral' },
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: t('admin.vistaPrevia.reglasTitulo') }),
        h('div', { class: 'pr-adm-vp-scroll' }, reglas),
        h('span', { class: 'form-hint', text: t('admin.vistaPrevia.reglasNota') })),
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: t('admin.vistaPrevia.recursosTitulo') }),
        h('div', { class: 'pr-adm-vp-scroll' }, recursos),
        h('span', { class: 'form-hint', text: t('admin.vistaPrevia.recursosNota') })))));

  // Al abrir la pestaña se genera sola.
  actualizar();
}
