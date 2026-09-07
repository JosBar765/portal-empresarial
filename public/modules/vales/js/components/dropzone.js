// Selector de archivos propio — reemplaza el <input type="file"> nativo por
// una zona de arrastrar-y-soltar / clic. Un <input type=file> nativo ya
// acepta archivos soltados encima sin JS extra; aquí solo se le da estilo y
// feedback visual al arrastrar. La lista de archivos elegidos es removible
// con una "×" — el input nativo no permite quitar un archivo individual de su
// propio .files, así que se mantiene un array propio en JS y se usa ESE array
// al armar el FormData del envío en vez de depender del input directamente.
import { iconoParaArchivo, formatearTamano } from '../utils/formato.js';

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

export function wireDropzone(overlay, inputSelector, listaSelector) {
  const input = overlay.querySelector(inputSelector);
  const dropzone = input.closest('.dropzone');
  const lista = overlay.querySelector(listaSelector);
  let archivos = [];
  const render = () => {
    lista.innerHTML = archivos.map((f, i) => `
      <span class="archivo-chip">
        <ion-icon name="${iconoParaArchivo(f)}" class="archivo-chip-icon"></ion-icon>
        <span class="archivo-chip-nombre">${f.name}</span>
        <span class="archivo-chip-tamano">${formatearTamano(f.size)}</span>
        <button type="button" class="archivo-chip-quitar" data-idx="${i}" title="Quitar">&times;</button>
      </span>
    `).join('');
  };
  input.addEventListener('change', () => {
    const nuevos = Array.from(input.files);
    archivos = input.multiple ? archivos.concat(nuevos) : nuevos;
    input.value = ''; // la lista real vive en `archivos`, no en el input nativo
    render();
  });
  input.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
  input.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  input.addEventListener('drop', () => dropzone.classList.remove('is-dragover'));
  lista.addEventListener('click', (e) => {
    const btn = e.target.closest('.archivo-chip-quitar');
    if (!btn) return;
    archivos.splice(Number(btn.dataset.idx), 1);
    render();
  });
  return () => archivos;
}
