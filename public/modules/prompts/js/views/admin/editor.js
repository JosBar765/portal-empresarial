// Editor de un producto: borrador en memoria con pestañas, guardado, descarte y publicación.
import { state } from '../../state.js';
import { h, icono } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { cargarConfig } from '../../config.js';
import { abrirModal, confirmarModal } from '../../components/modal.js';
import { obtenerProducto, crearBorrador, guardarBorrador, descartarBorrador, publicar } from '../../api/promptsAdminApi.js';
import { clavesDelEsquema, clavesDeRecursos, clavesDeReglas, contarParametros, contarRecursos, contarReglas } from './esquemaOps.js';
import { ESQUEMA_VERSION } from './reglasEsquema.js';
import { badgeEstado, mensajesDeError } from './comun.js';
import { renderTabParametros } from './tabParametros.js';
import { renderTabRecursos } from './tabRecursos.js';
import { renderTabReglas } from './tabReglas.js';
import { renderTabVistaPrevia } from './tabVistaPrevia.js';
import { renderTabEsquemaJson } from './tabEsquemaJson.js';

const clonar = (x) => JSON.parse(JSON.stringify(x));
const ESQUEMA_VACIO = { esquema_version: ESQUEMA_VERSION, grupos: [], recursos: [], reglas: [] };

function modalErroresPublicar(errores) {
  const lista = errores.map(e => `<li>${escapeHtml(e)}</li>`).join('');
  const { overlay, cerrar } = abrirModal({
    title: t('admin.editor.noPublicadoTitulo'),
    bodyHtml: `<p>${escapeHtml(t('admin.editor.noPublicadoIntro'))}</p><ul class="pr-adm-lista-dep">${lista}</ul>`,
    footerHtml: `<button class="btn btn--primary" type="button" id="pr-adm-pub-ok">${escapeHtml(t('comun.entendido'))}</button>`
  });
  overlay.querySelector('#pr-adm-pub-ok').addEventListener('click', cerrar);
}

export async function renderEditor(cont, { id, alVolver }) {
  let data;
  let config;
  try {
    [data, config] = await Promise.all([obtenerProducto(id), cargarConfig()]);
  } catch (error) {
    cont.replaceChildren(
      h('div', { class: 'buzon-vacio buzon-vacio-error' }, icono('alert-circle-outline'), h('h3', { text: t('admin.editor.cargaError') }), h('p', { text: error.message }),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: alVolver }, t('admin.editor.volverProductos'))));
    return;
  }
  montar(cont, data, { id, alVolver, config });
}

function montar(cont, { producto, borrador, publicada }, { id, alVolver, config }) {
  const base = borrador || publicada;
  const ed = {
    producto, borrador, publicada, config,
    esquema: base ? clonar(base.esquema) : clonar(ESQUEMA_VACIO),
    editable: !!borrador,
    // Las claves ya publicadas (parámetros y recursos) no se renombran.
    clavesPublicadas: new Set(publicada ? clavesDelEsquema(publicada.esquema) : []),
    clavesRecursosPublicadas: new Set(publicada ? clavesDeRecursos(publicada.esquema) : []),
    clavesReglasPublicadas: new Set(publicada ? clavesDeReglas(publicada.esquema) : []),
    sucio: false,
    cambiarEsquema(esquema) { this.esquema = esquema; marcar(); },
    // Guarda los cambios pendientes antes de una acción que depende del borrador; false si no se pudo.
    guardarPendientes: async () => !ed.sucio || guardar()
  };

  let ocupado = false;
  let tabActiva = 'parametros';

  const confirmarSalida = async () => !ed.sucio || confirmarModal({
    title: t('admin.editor.salirTitulo'),
    mensaje: t('admin.editor.salirMensaje'),
    aceptar: t('admin.editor.salirAceptar'),
    cancelar: t('admin.editor.salirCancelar')
  });
  const alCerrarPagina = (e) => { if (ed.sucio) { e.preventDefault(); e.returnValue = ''; } };
  const liberar = () => window.removeEventListener('beforeunload', alCerrarPagina);
  state.salidaVista = { confirmar: confirmarSalida, liberar };
  window.addEventListener('beforeunload', alCerrarPagina);

  const recargar = async () => { liberar(); state.salidaVista = null; await renderEditor(cont, { id, alVolver }); };

  const aviso = h('span', { class: 'pr-adm-sucio', id: 'pr-adm-sucio', hidden: true, text: t('admin.editor.sucio') });
  const etiquetaTabParametros = h('span');
  const etiquetaTabRecursos = h('span');
  const etiquetaTabReglas = h('span');
  const botonGuardar = h('button', { type: 'button', class: 'btn btn--ghost', id: 'pr-adm-guardar', text: t('admin.editor.guardar') });
  const botonDescartar = h('button', { type: 'button', class: 'btn btn--ghost', id: 'pr-adm-descartar', text: t('admin.editor.descartar') });
  const botonPublicar = h('button', { type: 'button', class: 'btn btn--primary', id: 'pr-adm-publicar', text: borrador ? t('admin.editor.publicarVersion', { numero: borrador.numero }) : t('admin.editor.publicar') });
  const panel = h('div', { class: 'pr-adm-tab-panel', id: 'pr-adm-tab-panel' });

  function actualizarControles() {
    const sinBorrador = !ed.editable;
    botonGuardar.disabled = sinBorrador || ocupado;
    botonPublicar.disabled = sinBorrador || ocupado;
    botonDescartar.disabled = sinBorrador || ocupado || !publicada;
    botonDescartar.title = !sinBorrador && !publicada ? t('admin.editor.unicaVersion') : '';
    aviso.hidden = !ed.sucio;
    etiquetaTabParametros.textContent = t('admin.editor.tabParametros', { n: contarParametros(ed.esquema) });
    etiquetaTabRecursos.textContent = t('admin.editor.tabRecursos', { n: contarRecursos(ed.esquema) });
    etiquetaTabReglas.textContent = t('admin.editor.tabReglas', { n: contarReglas(ed.esquema) });
  }

  function marcar() {
    ed.sucio = true;
    actualizarControles();
  }

  async function ejecutar(fn) {
    ocupado = true;
    actualizarControles();
    try { return await fn(); } finally { ocupado = false; actualizarControles(); }
  }

  const guardar = () => ejecutar(async () => {
    try {
      await guardarBorrador(id, { esquema: ed.esquema });
      ed.sucio = false;
      return true;
    } catch (error) {
      window.toast.error(t('admin.editor.toastNoGuardado'), mensajesDeError(error).join(' · '));
      return false;
    }
  });

  botonGuardar.addEventListener('click', async () => { if (await guardar()) window.toast.success(t('admin.editor.toastGuardado'), t('admin.editor.toastGuardadoTexto')); });

  botonDescartar.addEventListener('click', async () => {
    const ok = await confirmarModal({ title: t('admin.editor.descartarTitulo'), mensaje: t('admin.editor.descartarMensaje'), aceptar: t('admin.editor.descartarAceptar') });
    if (!ok) return;
    try {
      await ejecutar(() => descartarBorrador(id));
      window.toast.success(t('admin.editor.toastDescartado'), t('admin.editor.toastDescartadoTexto'));
      await recargar();
    } catch (error) {
      window.toast.error(t('admin.editor.toastNoDescartado'), error.message);
    }
  });

  botonPublicar.addEventListener('click', async () => {
    if (!(await guardar())) return;
    try {
      await ejecutar(() => publicar(id));
      window.toast.success(t('admin.editor.toastPublicado'), t('admin.editor.toastPublicadoTexto', { numero: borrador.numero }));
      await recargar();
    } catch (error) {
      modalErroresPublicar(mensajesDeError(error));
    }
  });

  const pintadores = {
    parametros: renderTabParametros,
    recursos: renderTabRecursos,
    reglas: renderTabReglas,
    vista: renderTabVistaPrevia,
    esquema: renderTabEsquemaJson
  };
  const tabs = [
    { id: 'parametros', contenido: etiquetaTabParametros },
    { id: 'recursos', contenido: etiquetaTabRecursos },
    { id: 'reglas', contenido: etiquetaTabReglas },
    { id: 'vista', contenido: t('admin.editor.tabVistaPrevia') },
    { id: 'esquema', contenido: t('admin.editor.tabEsquema') }
  ];
  const botonesTab = tabs.map(tab => h('button', {
    type: 'button', role: 'tab', class: 'pr-adm-tab', id: `pr-adm-tab-${tab.id}`,
    onclick: () => { tabActiva = tab.id; pintarTab(true); }
  }, tab.contenido));
  const barraTabs = h('div', { class: 'pr-adm-tabs', role: 'tablist' }, botonesTab);
  // Desvanece el borde derecho mientras queden pestañas ocultas a la derecha.
  const marcarDesborde = () => barraTabs.classList.toggle('is-mas-derecha', barraTabs.scrollLeft + barraTabs.clientWidth < barraTabs.scrollWidth - 1);
  barraTabs.addEventListener('scroll', marcarDesborde, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(marcarDesborde).observe(barraTabs);
  function pintarTab(animar = false) {
    panel.classList.toggle('pr-adm-tab-panel--vista', tabActiva === 'vista');
    tabs.forEach((tab, i) => botonesTab[i].classList.toggle('is-activo', tab.id === tabActiva));
    // En celular la barra se desliza: la pestaña activa siempre queda a la vista.
    const suave = animar && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    botonesTab[tabs.findIndex(tab => tab.id === tabActiva)].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: suave ? 'smooth' : 'auto' });
    marcarDesborde();
    pintadores[tabActiva](panel, ed);
  }

  const subtitulo = borrador
    ? t(publicada ? 'admin.editor.subtituloBorradorConVigente' : 'admin.editor.subtituloBorradorSinVigente', { numero: borrador.numero, vigente: publicada ? publicada.numero : '' })
    : t('admin.editor.subtituloVigente', { numero: publicada ? publicada.numero : '—' });

  const bannerSinBorrador = ed.editable ? null : h('div', { class: 'pr-banner pr-adm-banner-borrador' },
    icono('information-circle-outline'),
    h('span', { text: t('admin.editor.sinBorrador') }),
    h('button', {
      type: 'button', class: 'btn btn--primary btn--sm', id: 'pr-adm-crear-borrador', text: t('admin.editor.crearBorrador'),
      onclick: async () => {
        try { await crearBorrador(id); await recargar(); } catch (error) { window.toast.error(t('admin.editor.toastNoCreadoBorrador'), error.message); }
      }
    }));

  cont.replaceChildren(
    h('button', {
      type: 'button', class: 'pr-adm-volver', id: 'pr-adm-volver', text: t('admin.editor.volver'),
      onclick: async () => { if (await confirmarSalida()) { liberar(); state.salidaVista = null; alVolver(); } }
    }),
    h('div', { class: 'panel-toolbar' },
      h('div', null,
        h('div', { class: 'pr-adm-titulo' }, h('h2', { text: producto.nombre }), badgeEstado(producto.estado), aviso),
        h('p', { class: 'pr-subtitulo', text: subtitulo })),
      h('div', { class: 'pr-adm-acciones' }, botonDescartar, botonGuardar, botonPublicar)),
    ...(bannerSinBorrador ? [bannerSinBorrador] : []),
    barraTabs,
    panel);

  actualizarControles();
  pintarTab();
}
