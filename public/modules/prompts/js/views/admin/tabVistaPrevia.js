// Pestaña «Vista previa»: solo lectura; el servidor autogenera el prompt completo del borrador con valores e imágenes de ejemplo (los nombres ejemplo-N.png los inventa esta vista, no vienen del formulario del asesor).
import { h, icono, montar } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { previsualizar } from '../../api/promptsAdminApi.js';
import { imagenesDeEjemplo, valoresDeEjemplo } from './esquemaOps.js';
import { mensajesDeError } from './comun.js';

// Una regla inactiva no se incluye; una activa que quedó vacía tampoco (sus variables no tenían datos).
function estadoRegla(r) {
  if (r.incluida) return { texto: t('admin.vistaPrevia.reglaIncluida'), incluida: true };
  return { texto: t(r.activo ? 'admin.vistaPrevia.reglaOmitidaVacia' : 'admin.vistaPrevia.reglaOmitidaInactiva'), incluida: false };
}

function listaReglas(reglas) {
  if (!reglas.length) return h('p', { class: 'form-hint', text: t('admin.vistaPrevia.sinReglas') });
  return h('ul', { class: 'pr-adm-vp-reglas' }, reglas.map(r => {
    const estado = estadoRegla(r);
    return h('li', { class: 'pr-adm-vp-regla', 'data-regla': r.clave },
      h('span', { class: 'pr-adm-vp-regla-etiqueta', text: r.etiqueta }),
      h('div', { class: 'pr-adm-vp-regla-pills' },
        h('span', { class: 'pr-adm-pill', text: t(r.posicion === 'fin' ? 'admin.reglas.posicionFin' : 'admin.reglas.posicionInicio') }),
        h('span', { class: `pr-adm-pill ${estado.incluida ? 'pr-adm-pill--req' : ''}`, text: estado.texto })));
  }));
}

// Recursos fijos tal como están en el borrador del editor (no dependen de la respuesta del servidor).
function listaRecursos(recursos, minimo) {
  if (!recursos.length) return h('p', { class: 'form-hint', text: t('admin.vistaPrevia.recursosVacio', { min: minimo }) });
  return h('ul', { class: 'pr-adm-vp-reglas' }, recursos.map(r => h('li', { class: 'pr-adm-vp-regla', 'data-recurso': r.clave },
    h('span', { class: 'pr-adm-vp-regla-etiqueta', text: r.etiqueta }),
    r.descripcion ? h('span', { class: 'pr-adm-vp-regla-desc', text: r.descripcion }) : null,
    h('div', { class: 'pr-adm-vp-regla-pills' },
      h('span', { class: 'pr-adm-pill', text: t(r.posicion === 'fin' ? 'admin.recursos.posicionFin' : 'admin.recursos.posicionInicio') }),
      h('span', { class: `pr-adm-pill ${r.activo ? 'pr-adm-pill--req' : ''}`, text: t(r.activo ? 'admin.recursos.estadoActivo' : 'admin.recursos.estadoInactivo') }),
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

  montar(cont, h('div', { class: 'pr-adm-dos-col' },
    h('section', { class: 'pr-card' },
      h('div', { class: 'pr-adm-vp-cab' }, h('h3', { class: 'pr-card-titulo', text: t('admin.vistaPrevia.titulo') }), boton),
      h('p', { class: 'form-hint', text: t('admin.vistaPrevia.nota') }),
      resultado),
    h('aside', { class: 'pr-adm-lateral' },
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: t('admin.vistaPrevia.reglasTitulo') }),
        reglas,
        h('span', { class: 'form-hint', text: t('admin.vistaPrevia.reglasNota') })),
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: t('admin.vistaPrevia.recursosTitulo') }),
        recursos,
        h('span', { class: 'form-hint', text: t('admin.vistaPrevia.recursosNota') })))));

  // Al abrir la pestaña se genera sola.
  actualizar();
}
