import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { obtenerPropuestaVale } from '../api/valesApi.js';
import { htmlPropuestaExtras, hayExtras } from './propuestaInfo.js';

// -----------------------------------------------------------------------
// Visor emergente de documentos (vale de arte y propuesta): reemplaza a abrir una pestaña nueva. Casi pantalla completa en
// escritorio y pantalla completa en celular; con pestañas cuando hay más de un documento. «Abrir en pestaña» y «Descargar»
// quedan como respaldo, porque algunos celulares no muestran PDFs integrados.
// -----------------------------------------------------------------------
const ES_IMAGEN = /\.(png|jpe?g|webp|gif)(\?|#|$)/i;
const FOCALIZABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

let visorAbierto = null;

// `documentos`: [{ etiqueta, url }] o, para la propuesta, [{ etiqueta, cargar }] donde `cargar()` devuelve { url, nota, enlaces }
// (el archivo se incrusta y la nota y los enlaces van en un panel); `activo`: índice del documento que se muestra primero.
export function abrirVisor({ titulo, subtitulo = '', documentos, activo = 0 }) {
  if (!documentos || !documentos.length) return null;
  if (visorAbierto) visorAbierto.cerrar();
  const origen = document.activeElement;
  let actual = Math.min(Math.max(activo, 0), documentos.length - 1);

  const overlay = document.createElement('div');
  overlay.className = 'visor-overlay';
  overlay.innerHTML = `
    <div class="visor" role="dialog" aria-modal="true" aria-labelledby="visor-titulo">
      <header class="visor-cab">
        <div class="visor-titulos">
          <h3 id="visor-titulo">${escapeHtml(titulo)}</h3>
          ${subtitulo ? `<p>${escapeHtml(subtitulo)}</p>` : ''}
        </div>
        <div class="visor-acciones">
          <a class="btn btn--ghost btn--sm" data-visor-pestana target="_blank" rel="noopener"><ion-icon name="open-outline" aria-hidden="true"></ion-icon><span>Abrir en pestaña</span></a>
          <a class="btn btn--ghost btn--sm" data-visor-descarga download><ion-icon name="download-outline" aria-hidden="true"></ion-icon><span>Descargar</span></a>
          <button type="button" class="visor-cerrar" data-visor-cerrar aria-label="Cerrar"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </div>
      </header>
      ${documentos.length > 1 ? `
      <div class="visor-pestanas" role="tablist" aria-label="Documentos">
        ${documentos.map((d, i) => `<button type="button" class="visor-pestana" role="tab" data-visor-pestana-i="${i}" aria-selected="false">${escapeHtml(d.etiqueta)}</button>`).join('')}
      </div>` : ''}
      <div class="visor-cuerpo" role="tabpanel">
        <div class="visor-cargando" data-visor-cargando><ion-icon name="sync-outline" class="spin-animation" aria-hidden="true"></ion-icon><span>Cargando documento…</span></div>
        <div class="visor-error" data-visor-error hidden>
          <ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>
          <p>No se pudo mostrar el documento aquí.</p>
          <a class="btn btn--primary btn--sm" data-visor-pestana-error target="_blank" rel="noopener">Abrir en una pestaña</a>
        </div>
        <div class="visor-contenido" data-visor-contenido></div>
      </div>
      <p class="visor-pie">¿No se ve el documento? Usa «Abrir en pestaña».</p>
    </div>`;
  const root = $('#modals-root') || document.body;
  root.appendChild(overlay);
  const sobreflujoPrevio = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const contenido = overlay.querySelector('[data-visor-contenido]');
  const cargando = overlay.querySelector('[data-visor-cargando]');
  const error = overlay.querySelector('[data-visor-error]');

  function crearElemento(url, titulo) {
    const imagen = ES_IMAGEN.test(url);
    const elemento = document.createElement(imagen ? 'img' : 'iframe');
    elemento.className = imagen ? 'visor-imagen' : 'visor-marco';
    elemento.title = titulo;
    if (imagen) elemento.alt = titulo;
    elemento.addEventListener('load', () => { cargando.hidden = true; });
    elemento.addEventListener('error', () => { cargando.hidden = true; error.hidden = false; });
    elemento.src = url;
    return elemento;
  }

  function fijarEnlaces(url) {
    const pestana = overlay.querySelector('[data-visor-pestana]');
    const descarga = overlay.querySelector('[data-visor-descarga]');
    const errorEnlace = overlay.querySelector('[data-visor-pestana-error]');
    [pestana, descarga].forEach(a => { a.hidden = !url; if (url) a.href = url; });
    if (url) errorEnlace.href = url;
    errorEnlace.hidden = !url;
    overlay.querySelector('.visor-pie').hidden = !url; // sin archivo incrustado no hay nada que "abrir en pestaña"
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
    error.hidden = true;
    cargando.hidden = false;
    contenido.innerHTML = '';
    if (!doc.cargar) {
      fijarEnlaces(doc.url);
      contenido.appendChild(crearElemento(doc.url, doc.etiqueta));
      return;
    }
    // Propuesta: se piden al servidor el archivo, la nota y los enlaces.
    fijarEnlaces(null);
    doc.cargar().then(datos => {
      if (actual !== indice) return;
      fijarEnlaces(datos.url);
      const extras = hayExtras(datos);
      if (!datos.url && !extras) { cargando.hidden = true; error.hidden = false; return; }
      contenido.innerHTML = `
        <div class="visor-propuesta${datos.url ? '' : ' solo-extras'}">
          ${datos.url ? '<div class="visor-propuesta-doc"></div>' : ''}
          ${extras ? `<aside class="visor-propuesta-extras" aria-label="Observaciones y enlaces de la propuesta">${htmlPropuestaExtras(datos)}</aside>` : ''}
        </div>`;
      if (datos.url) contenido.querySelector('.visor-propuesta-doc').appendChild(crearElemento(datos.url, doc.etiqueta));
      else cargando.hidden = true;
    }).catch(() => {
      if (actual !== indice) return;
      cargando.hidden = true;
      error.hidden = false;
    });
  }

  function cerrar() {
    document.removeEventListener('keydown', alTeclear, true);
    document.body.style.overflow = sobreflujoPrevio;
    overlay.remove();
    if (visorAbierto && visorAbierto.overlay === overlay) visorAbierto = null;
    if (origen && origen.isConnected && typeof origen.focus === 'function') origen.focus();
  }

  // Esc cierra; Tab se queda dentro del visor; las flechas cambian de pestaña.
  function alTeclear(e) {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(); return; }
    if (e.key === 'Tab') {
      const lista = [...overlay.querySelectorAll(FOCALIZABLES)].filter(el => !el.hidden && el.offsetParent !== null);
      if (!lista.length) return;
      const primero = lista[0], ultimo = lista[lista.length - 1];
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
  (overlay.querySelector('.visor-pestana.is-activa') || overlay.querySelector('[data-visor-cerrar]')).focus();
  visorAbierto = { overlay, cerrar };
  return visorAbierto;
}

// Atajo para un vale: su PDF y, si tiene, su propuesta (con nota y enlaces). `propuesta`: { tipo: 'taller' | 'general' | 'ultima',
// disenadorId } o null; `activo`: 'vale' | 'propuesta'.
export function abrirVisorVale({ id, correlativo, propuesta = null, activo = 'vale' }) {
  const documentos = [{ etiqueta: 'Vale de arte', url: `/api/vales/${id}/pdf` }];
  if (propuesta) documentos.push({ etiqueta: 'Propuesta', cargar: () => obtenerPropuestaVale(id, propuesta) });
  return abrirVisor({
    titulo: correlativo || 'Vale de arte',
    documentos,
    activo: activo === 'propuesta' && propuesta ? 1 : 0
  });
}

// Solo la propuesta de un vale (sin pestaña del vale), por ejemplo desde la revisión del Encargado.
export function abrirVisorPropuesta({ id, correlativo, propuesta }) {
  return abrirVisor({
    titulo: `Propuesta — ${correlativo || ''}`.trim(),
    documentos: [{ etiqueta: 'Propuesta', cargar: () => obtenerPropuestaVale(id, propuesta) }]
  });
}
