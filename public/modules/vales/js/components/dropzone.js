// Selector de archivos propio — reemplaza el <input type="file"> nativo por
// una zona de arrastrar-y-soltar / clic. Un <input type=file> nativo ya
// acepta archivos soltados encima sin JS extra; aquí solo se le da estilo y
// feedback visual al arrastrar. La lista de archivos elegidos es removible
// con una "×" — el input nativo no permite quitar un archivo individual de su
// propio .files, así que se mantiene un array propio en JS y se usa ESE array
// al armar el FormData del envío en vez de depender del input directamente.
import { iconoParaArchivo, formatearTamano, escapeHtml } from '../utils/formato.js';
import { abrirModal } from './modal.js';

const ETIQUETA_TIPO = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP', 'application/pdf': 'PDF' };

// Ejecuta `fn` cuando el overlay sale del DOM, sea cual sea la forma de cerrarlo.
function alCerrarse(overlay, fn) {
  const root = overlay.parentElement;
  const obs = new MutationObserver(() => {
    if (!overlay.isConnected) { obs.disconnect(); fn(); }
  });
  obs.observe(root, { childList: true });
}

// El archivo solo existe en memoria del navegador: se muestra con una URL temporal.
function abrirPrevisualizacion(file) {
  const url = URL.createObjectURL(file);
  const visor = file.type.startsWith('image/')
    ? `<img class="archivo-preview-img" src="${url}" alt="${escapeHtml(file.name)}">`
    : `<iframe class="archivo-preview-pdf" src="${url}" title="${escapeHtml(file.name)}"></iframe>`;
  const { overlay, cerrar } = abrirModal({
    title: file.name,
    size: 'lg',
    bodyHtml: visor,
    footerHtml: `<a class="btn btn--ghost" href="${url}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-flex;">Abrir en otra pestaña</a><button class="btn btn--primary" id="btn-cerrar-preview">Cerrar</button>`
  });
  // Escape cierra solo la previsualización, no el formulario que hay debajo.
  const onEsc = (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    cerrar();
  };
  window.addEventListener('keydown', onEsc, true);
  overlay.querySelector('#btn-cerrar-preview').addEventListener('click', cerrar);
  alCerrarse(overlay, () => {
    window.removeEventListener('keydown', onEsc, true);
    URL.revokeObjectURL(url);
  });
}

export function htmlDropzone({ name, id, accept, multiple = false, hint }) {
  return `
    <label class="dropzone">
      <input type="file"${id ? ` id="${id}"` : ''}${name ? ` name="${name}"` : ''} accept="${accept}" ${multiple ? 'multiple' : ''} class="dropzone-input" />
      <ion-icon name="cloud-upload-outline" class="dropzone-icon"></ion-icon>
      <span class="dropzone-text"><strong>Haz clic para subir</strong> o arrastra el archivo aquí</span>
      ${hint ? `<span class="dropzone-hint">${hint}</span>` : ''}
    </label>
    <div class="archivo-lista"></div>
  `;
}

// `maxBytes`: rechaza en el propio selector cualquier archivo que ya se sepa
// que el backend va a rechazar por tamaño — antes se dejaba agregar al
// formulario igual, y el error solo aparecía hasta que fallaba la subida a
// Supabase (correcciones_27 #2).
export function wireDropzone(overlay, inputSelector, listaSelector, { maxBytes } = {}) {
  const input = overlay.querySelector(inputSelector);
  const dropzone = input.closest('.dropzone');
  const lista = overlay.querySelector(listaSelector);
  const tiposPermitidos = input.accept.split(',').map(t => t.trim()).filter(Boolean);
  const etiquetaTipos = tiposPermitidos.map(t => ETIQUETA_TIPO[t] || t).join(', ');
  let archivos = [];
  const miniaturas = new Map(); // File -> URL temporal de su miniatura
  const urlMiniatura = (f) => {
    if (!miniaturas.has(f)) miniaturas.set(f, URL.createObjectURL(f));
    return miniaturas.get(f);
  };
  const soltarMiniaturas = () => {
    for (const [f, url] of miniaturas) {
      if (!archivos.includes(f)) { URL.revokeObjectURL(url); miniaturas.delete(f); }
    }
  };
  alCerrarse(overlay, () => {
    miniaturas.forEach(url => URL.revokeObjectURL(url));
    miniaturas.clear();
  });
  const render = () => {
    soltarMiniaturas();
    lista.innerHTML = archivos.map((f, i) => `
      <span class="archivo-chip">
        <button type="button" class="archivo-chip-ver" data-idx="${i}" title="Ver archivo">
          ${f.type.startsWith('image/')
            ? `<img class="archivo-chip-miniatura" src="${urlMiniatura(f)}" alt="">`
            : `<ion-icon name="${iconoParaArchivo(f)}" class="archivo-chip-icon"></ion-icon>`}
          <span class="archivo-chip-nombre">${escapeHtml(f.name)}</span>
        </button>
        <span class="archivo-chip-tamano">${formatearTamano(f.size)}</span>
        <button type="button" class="archivo-chip-quitar" data-idx="${i}" title="Quitar">&times;</button>
      </span>
    `).join('');
  };
  input.addEventListener('change', () => {
    const seleccionados = Array.from(input.files);
    const nuevos = [];
    for (const f of seleccionados) {
      if (tiposPermitidos.length && !tiposPermitidos.includes(f.type)) {
        window.toast.error('Archivo no permitido', `"${f.name}" no se puede subir. Solo se aceptan archivos ${etiquetaTipos}.`);
        continue;
      }
      if (maxBytes && f.size > maxBytes) {
        window.toast.error('Archivo demasiado grande', `"${f.name}" (${formatearTamano(f.size)}) supera el máximo permitido de ${formatearTamano(maxBytes)}.`);
        continue;
      }
      nuevos.push(f);
    }
    archivos = input.multiple ? archivos.concat(nuevos) : nuevos;
    input.value = ''; // la lista real vive en `archivos`, no en el input nativo
    render();
  });
  input.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
  input.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  input.addEventListener('drop', () => dropzone.classList.remove('is-dragover'));
  lista.addEventListener('click', (e) => {
    const ver = e.target.closest('.archivo-chip-ver');
    if (ver) { abrirPrevisualizacion(archivos[Number(ver.dataset.idx)]); return; }
    const btn = e.target.closest('.archivo-chip-quitar');
    if (!btn) return;
    archivos.splice(Number(btn.dataset.idx), 1);
    render();
  });
  return () => archivos;
}
