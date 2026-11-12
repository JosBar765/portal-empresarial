// Visor emergente de documentos: casi pantalla completa en escritorio y pantalla completa en celular, con pestañas si hay más de uno.
// «Abrir en pestaña» y «Descargar» quedan de respaldo porque algunos celulares no muestran PDFs integrados.
import { $, h, icono } from '../utils/dom.js';
import { obtenerDocumentosGestion, obtenerDocumentosSolicitud, mensajesDeError } from '../api/viaticosApi.js';
import { tipoDeDocumento, tituloVisorSolicitud, urlSegura } from '../utils/documentos.js';
import { abrirModal } from './modal.js';
import { crearAviso } from './aviso.js';
import { escapeHtml } from '../utils/formato.js';
import { t } from '../textos.js';

const FOCALIZABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

let visorAbierto = null;

// `documentos`: [{ etiqueta, url, tipo? }]; `tipo` ('pdf' | 'imagen') se deduce de la URL si falta; `activo`: índice que se muestra primero.
// `alCerrar` se ejecuta una vez al cerrar (X, Escape o fondo), no cuando otro visor lo reemplaza; `origen` es el elemento que recupera el foco.
export function abrirVisor({ titulo, subtitulo = '', documentos, activo = 0, alCerrar = null, origen = null }) {
  if (!documentos || !documentos.length) return null;
  if (visorAbierto) { visorAbierto.descartarAlCerrar(); visorAbierto.cerrar(); }
  const volverA = origen || document.activeElement;
  let actual = Math.min(Math.max(activo, 0), documentos.length - 1);
  let alCerrarPendiente = alCerrar;

  const overlay = h('div', { class: 'vi-visor-overlay' });
  overlay.innerHTML = `
    <div class="vi-visor" role="dialog" aria-modal="true" aria-labelledby="vi-visor-titulo">
      <header class="vi-visor__cab">
        <div class="vi-visor__titulos">
          <h3 id="vi-visor-titulo">${escapeHtml(titulo)}</h3>
          ${subtitulo ? `<p>${escapeHtml(subtitulo)}</p>` : ''}
        </div>
        <div class="vi-visor__acciones">
          <a class="btn btn--ghost btn--sm" data-visor-pestana target="_blank" rel="noopener"><ion-icon name="open-outline" aria-hidden="true"></ion-icon><span>${escapeHtml(t('visor.abrirEnPestana'))}</span></a>
          <a class="btn btn--ghost btn--sm" data-visor-descarga download><ion-icon name="download-outline" aria-hidden="true"></ion-icon><span>${escapeHtml(t('visor.descargar'))}</span></a>
          <button type="button" class="vi-visor__cerrar" data-visor-cerrar aria-label="${escapeHtml(t('comun.cerrar'))}"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </div>
      </header>
      ${documentos.length > 1 ? `
      <div class="vi-visor__pestanas" role="tablist" aria-label="${escapeHtml(t('visor.pestanasAria'))}">
        ${documentos.map((d, i) => `<button type="button" class="vi-visor__pestana" role="tab" data-visor-pestana-i="${i}" aria-selected="false">${escapeHtml(d.etiqueta)}</button>`).join('')}
      </div>` : ''}
      <div class="vi-visor__cuerpo" role="tabpanel">
        <div class="vi-visor__cargando" data-visor-cargando role="status"><ion-icon name="sync-outline" class="spin-animation" aria-hidden="true"></ion-icon><span>${escapeHtml(t('visor.cargando'))}</span></div>
        <div class="vi-visor__error" data-visor-error role="alert" hidden>
          <ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>
          <p>${escapeHtml(t('visor.error'))}</p>
          <a class="btn btn--primary btn--sm" data-visor-pestana-error target="_blank" rel="noopener">${escapeHtml(t('visor.abrirEnUnaPestana'))}</a>
        </div>
        <div class="vi-visor__contenido" data-visor-contenido></div>
      </div>
      <div class="vi-visor__pie"><p class="vi-visor__ayuda">${escapeHtml(t('visor.ayuda'))}</p></div>
    </div>`;
  ($('#modals-root') || document.body).appendChild(overlay);
  const sobreflujoPrevio = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const contenido = overlay.querySelector('[data-visor-contenido]');
  const cargando = overlay.querySelector('[data-visor-cargando]');
  const error = overlay.querySelector('[data-visor-error]');

  function crearElemento(doc) {
    const imagen = tipoDeDocumento(doc) === 'imagen';
    const elemento = h(imagen ? 'img' : 'iframe', { class: imagen ? 'vi-visor__imagen' : 'vi-visor__marco', title: doc.etiqueta });
    if (imagen) elemento.alt = doc.etiqueta;
    elemento.addEventListener('load', () => { cargando.hidden = true; });
    elemento.addEventListener('error', () => { cargando.hidden = true; error.hidden = false; });
    elemento.src = doc.url;
    return elemento;
  }

  function fijarEnlaces(url) {
    const pestana = overlay.querySelector('[data-visor-pestana]');
    const descarga = overlay.querySelector('[data-visor-descarga]');
    const errorEnlace = overlay.querySelector('[data-visor-pestana-error]');
    [pestana, descarga, errorEnlace].forEach(a => { a.hidden = !url; if (url) a.href = url; });
  }

  function mostrar(indice) {
    actual = indice;
    const doc = documentos[actual];
    overlay.querySelectorAll('[data-visor-pestana-i]').forEach(b => {
      const activa = Number(b.dataset.visorPestanaI) === actual;
      b.classList.toggle('is-activa', activa);
      b.setAttribute('aria-selected', String(activa));
      b.tabIndex = activa ? 0 : -1;
    });
    contenido.replaceChildren();
    // Una URL que no es de Storage ni del sitio nunca se incrusta ni se enlaza.
    if (!urlSegura(doc.url)) {
      fijarEnlaces(null);
      cargando.hidden = true;
      error.hidden = false;
      return;
    }
    error.hidden = true;
    cargando.hidden = false;
    fijarEnlaces(doc.url);
    contenido.appendChild(crearElemento(doc));
  }

  function cerrar() {
    document.removeEventListener('keydown', alTeclear, true);
    document.body.style.overflow = sobreflujoPrevio;
    overlay.remove();
    if (visorAbierto && visorAbierto.overlay === overlay) visorAbierto = null;
    if (volverA && volverA.isConnected && typeof volverA.focus === 'function') volverA.focus();
    const despues = alCerrarPendiente;
    alCerrarPendiente = null;
    if (despues) despues();
  }

  // Escape cierra solo el visor (no el modal que haya debajo); Tab se queda dentro; las flechas cambian de pestaña.
  function alTeclear(e) {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(); return; }
    if (e.key === 'Tab') {
      const lista = [...overlay.querySelectorAll(FOCALIZABLES)].filter(el => !el.hidden && !el.closest('[hidden]'));
      if (!lista.length) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      else if (!overlay.contains(document.activeElement)) { e.preventDefault(); primero.focus(); }
      return;
    }
    if (documentos.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(e.key) && document.activeElement && document.activeElement.matches('[data-visor-pestana-i]')) {
      e.preventDefault();
      const siguiente = (actual + (e.key === 'ArrowRight' ? 1 : -1) + documentos.length) % documentos.length;
      mostrar(siguiente);
      overlay.querySelector(`[data-visor-pestana-i="${siguiente}"]`).focus();
    }
  }

  overlay.querySelector('[data-visor-cerrar]').addEventListener('click', cerrar);
  overlay.querySelectorAll('[data-visor-pestana-i]').forEach(b => b.addEventListener('click', () => mostrar(Number(b.dataset.visorPestanaI))));
  // Se cierra solo si el clic empezó y terminó sobre el fondo (arrastrar una selección hasta fuera no lo cierra).
  let mousedownEnFondo = false;
  overlay.addEventListener('mousedown', (e) => { mousedownEnFondo = (e.target === overlay); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay && mousedownEnFondo) cerrar(); mousedownEnFondo = false; });
  document.addEventListener('keydown', alTeclear, true);

  mostrar(actual);
  (overlay.querySelector('.vi-visor__pestana.is-activa') || overlay.querySelector('[data-visor-cerrar]')).focus();
  visorAbierto = { overlay, cerrar, descartarAlCerrar: () => { alCerrarPendiente = null; } };
  return visorAbierto;
}

// Un solo archivo (comprobante o foto de un defecto): `tipo` es 'imagen' o 'pdf' y, si falta, se deduce de la URL.
export function abrirVisorArchivo({ titulo, url, tipo, origen = null }) {
  return abrirVisor({ titulo, documentos: [{ etiqueta: titulo, url, tipo }], origen });
}

export const abrirVisorImagen = ({ titulo, url, origen = null }) => abrirVisorArchivo({ titulo, url, tipo: 'imagen', origen });

// Documentos de una solicitud: pide la lista al servidor (PDF primero y, ya liquidada, los comprobantes al final) con su cargando y su error.
// `gestion`: la consulta es de Gestiones (cualquier solicitud) y no la del propio usuario.
export function abrirVisorSolicitud(solicitud, { gestion = false } = {}) {
  const titulo = tituloVisorSolicitud(solicitud.correlativo);
  const origen = document.activeElement;
  let abierto = true;
  let numero = 0;
  const { overlay, cerrar } = abrirModal({
    title: titulo,
    bodyHtml: '',
    footerHtml: `<button class="btn btn--ghost" type="button" data-visor-espera-cerrar>${escapeHtml(t('comun.cerrar'))}</button>`,
    alCerrar: () => { abierto = false; }
  });
  overlay.querySelector('[data-visor-espera-cerrar]').addEventListener('click', cerrar);
  const cuerpo = overlay.querySelector('.modal-body');

  async function cargar() {
    const miNumero = ++numero;
    cuerpo.replaceChildren(h('div', { class: 'vi-visor-espera', role: 'status' }, icono('sync-outline'), h('span', { text: t('visor.cargandoDocumentos') })));
    cuerpo.querySelector('ion-icon').classList.add('spin-animation');
    let documentos;
    try {
      documentos = await (gestion ? obtenerDocumentosGestion : obtenerDocumentosSolicitud)(solicitud.id);
    } catch (error) {
      if (!abierto || miNumero !== numero) return;
      cuerpo.replaceChildren(
        crearAviso({ tipo: 'error', titulo: t('visor.errorCarga'), texto: mensajesDeError(error).join(' ') }),
        h('button', { class: 'btn btn--primary btn--sm vi-visor-reintentar', type: 'button', text: t('comun.reintentar'), onclick: cargar }));
      return;
    }
    if (!abierto || miNumero !== numero) return;
    const lista = Array.isArray(documentos) ? documentos : [];
    if (!lista.length) {
      cuerpo.replaceChildren(crearAviso({ tipo: 'info', titulo: t('visor.sinDocumentos.titulo'), texto: t('visor.sinDocumentos.texto') }));
      return;
    }
    cerrar();
    abrirVisor({ titulo, subtitulo: solicitud.pipeline && solicitud.pipeline.etiqueta ? solicitud.pipeline.etiqueta : '', documentos: lista.map(d => ({ etiqueta: d.titulo, url: d.url, tipo: d.tipo })), origen });
  }
  cargar();
}
