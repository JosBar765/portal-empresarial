// Editor de un producto: borrador en memoria con pestañas, guardado, descarte y publicación.
import { state } from '../../state.js';
import { h, icono } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { abrirModal, confirmarModal } from '../../components/modal.js';
import { obtenerProducto, crearBorrador, guardarBorrador, descartarBorrador, publicar } from '../../api/promptsAdminApi.js';
import { clavesDelEsquema, contarParametros } from './esquemaOps.js';
import { badgeEstado, mensajesDeError } from './comun.js';
import { renderTabParametros } from './tabParametros.js';
import { renderTabPlantilla } from './tabPlantilla.js';
import { renderTabVistaPrevia } from './tabVistaPrevia.js';
import { renderTabEsquemaJson } from './tabEsquemaJson.js';

const clonar = (x) => JSON.parse(JSON.stringify(x));
const ESQUEMA_VACIO = { esquema_version: 1, grupos: [] };

function modalErroresPublicar(errores) {
  const lista = errores.map(e => `<li>${escapeHtml(e)}</li>`).join('');
  const { overlay, cerrar } = abrirModal({
    title: 'No se pudo publicar',
    bodyHtml: `<p>Corrige lo siguiente y vuelve a publicar:</p><ul class="pr-adm-lista-dep">${lista}</ul>`,
    footerHtml: '<button class="btn btn--primary" type="button" id="pr-adm-pub-ok">Entendido</button>'
  });
  overlay.querySelector('#pr-adm-pub-ok').addEventListener('click', cerrar);
}

export async function renderEditor(cont, { id, alVolver }) {
  let data;
  try {
    data = await obtenerProducto(id);
  } catch (error) {
    cont.replaceChildren(
      h('div', { class: 'buzon-vacio buzon-vacio-error' }, icono('alert-circle-outline'), h('h3', { text: 'No se pudo cargar el producto' }), h('p', { text: error.message }),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: alVolver }, 'Volver a productos')));
    return;
  }
  montar(cont, data, { id, alVolver });
}

function montar(cont, { producto, borrador, publicada }, { id, alVolver }) {
  const base = borrador || publicada;
  const ed = {
    producto, borrador, publicada,
    esquema: base ? clonar(base.esquema) : clonar(ESQUEMA_VACIO),
    plantilla: base ? base.plantilla || '' : '',
    editable: !!borrador,
    // Las claves ya publicadas no se renombran.
    clavesPublicadas: new Set(publicada ? clavesDelEsquema(publicada.esquema) : []),
    sucio: false,
    ultimaVariable: null,
    cambiarEsquema(esquema) { this.esquema = esquema; marcar(); },
    cambiarPlantilla(plantilla) { this.plantilla = plantilla; marcar(); }
  };

  let ocupado = false;
  let tabActiva = 'parametros';

  const confirmarSalida = async () => !ed.sucio || confirmarModal({
    title: 'Cambios sin guardar',
    mensaje: 'Tienes cambios sin guardar en el borrador. Si sales, se perderán.',
    aceptar: 'Salir sin guardar',
    cancelar: 'Seguir editando'
  });
  const alCerrarPagina = (e) => { if (ed.sucio) { e.preventDefault(); e.returnValue = ''; } };
  const liberar = () => window.removeEventListener('beforeunload', alCerrarPagina);
  state.salidaVista = { confirmar: confirmarSalida, liberar };
  window.addEventListener('beforeunload', alCerrarPagina);

  const recargar = async () => { liberar(); state.salidaVista = null; await renderEditor(cont, { id, alVolver }); };

  const aviso = h('span', { class: 'pr-adm-sucio', id: 'pr-adm-sucio', hidden: true, text: 'Cambios sin guardar' });
  const etiquetaTabParametros = h('span');
  const botonGuardar = h('button', { type: 'button', class: 'btn btn--ghost', id: 'pr-adm-guardar', text: 'Guardar borrador' });
  const botonDescartar = h('button', { type: 'button', class: 'btn btn--ghost', id: 'pr-adm-descartar', text: 'Descartar cambios' });
  const botonPublicar = h('button', { type: 'button', class: 'btn btn--primary', id: 'pr-adm-publicar', text: borrador ? `Publicar versión ${borrador.numero}` : 'Publicar' });
  const panel = h('div', { class: 'pr-adm-tab-panel', id: 'pr-adm-tab-panel' });

  function actualizarControles() {
    const sinBorrador = !ed.editable;
    botonGuardar.disabled = sinBorrador || ocupado;
    botonPublicar.disabled = sinBorrador || ocupado;
    botonDescartar.disabled = sinBorrador || ocupado || !publicada;
    botonDescartar.title = !sinBorrador && !publicada ? 'Es la única versión del producto' : '';
    aviso.hidden = !ed.sucio;
    etiquetaTabParametros.textContent = `Parámetros (${contarParametros(ed.esquema)})`;
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
      await guardarBorrador(id, { esquema: ed.esquema, plantilla: ed.plantilla });
      ed.sucio = false;
      return true;
    } catch (error) {
      window.toast.error('No se pudo guardar el borrador', mensajesDeError(error).join(' · '));
      return false;
    }
  });

  botonGuardar.addEventListener('click', async () => { if (await guardar()) window.toast.success('Borrador guardado', 'Tus cambios quedaron guardados.'); });

  botonDescartar.addEventListener('click', async () => {
    const ok = await confirmarModal({ title: 'Descartar cambios', mensaje: 'Se eliminará el borrador y volverás a la versión vigente. ¿Continuar?', aceptar: 'Descartar' });
    if (!ok) return;
    try {
      await ejecutar(() => descartarBorrador(id));
      window.toast.success('Borrador descartado', 'Volviste a la versión vigente.');
      await recargar();
    } catch (error) {
      window.toast.error('No se pudo descartar', error.message);
    }
  });

  botonPublicar.addEventListener('click', async () => {
    if (!(await guardar())) return;
    try {
      await ejecutar(() => publicar(id));
      window.toast.success('Versión publicada', `La versión ${borrador.numero} ya está vigente.`);
      await recargar();
    } catch (error) {
      modalErroresPublicar(mensajesDeError(error));
    }
  });

  const pintadores = {
    parametros: renderTabParametros,
    plantilla: renderTabPlantilla,
    vista: renderTabVistaPrevia,
    esquema: renderTabEsquemaJson
  };
  const tabs = [
    { id: 'parametros', contenido: etiquetaTabParametros },
    { id: 'plantilla', contenido: 'Plantilla del prompt' },
    { id: 'vista', contenido: 'Vista previa' },
    { id: 'esquema', contenido: 'Esquema JSON' }
  ];
  const botonesTab = tabs.map(t => h('button', {
    type: 'button', role: 'tab', class: 'pr-adm-tab', id: `pr-adm-tab-${t.id}`,
    onclick: () => { tabActiva = t.id; pintarTab(); }
  }, t.contenido));
  function pintarTab() {
    tabs.forEach((t, i) => botonesTab[i].classList.toggle('is-activo', t.id === tabActiva));
    pintadores[tabActiva](panel, ed);
  }

  const subtitulo = borrador
    ? `Editando el borrador de la versión ${borrador.numero}${publicada ? ` (vigente: v${publicada.numero})` : ' (sin versión vigente)'}`
    : `Versión vigente: v${publicada ? publicada.numero : '—'}`;

  const bannerSinBorrador = ed.editable ? null : h('div', { class: 'pr-banner pr-adm-banner-borrador' },
    icono('information-circle-outline'),
    h('span', { text: 'Este producto no tiene un borrador. Crea uno para editarlo.' }),
    h('button', {
      type: 'button', class: 'btn btn--primary btn--sm', id: 'pr-adm-crear-borrador', text: 'Crear borrador',
      onclick: async () => {
        try { await crearBorrador(id); await recargar(); } catch (error) { window.toast.error('No se pudo crear el borrador', error.message); }
      }
    }));

  cont.replaceChildren(
    h('button', {
      type: 'button', class: 'pr-adm-volver', id: 'pr-adm-volver', text: '‹ Productos',
      onclick: async () => { if (await confirmarSalida()) { liberar(); state.salidaVista = null; alVolver(); } }
    }),
    h('div', { class: 'panel-toolbar' },
      h('div', null,
        h('div', { class: 'pr-adm-titulo' }, h('h2', { text: producto.nombre }), badgeEstado(producto.estado), aviso),
        h('p', { class: 'pr-subtitulo', text: subtitulo })),
      h('div', { class: 'pr-adm-acciones' }, botonDescartar, botonGuardar, botonPublicar)),
    bannerSinBorrador,
    h('div', { class: 'pr-adm-tabs', role: 'tablist' }, botonesTab),
    panel);

  actualizarControles();
  pintarTab();
}
