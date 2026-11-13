// public/modules/incidencias/js/components/fotos.js
// Selector de fotos para reportar, dar un avance o enviar a verificación: cámara directa en el celular, galería, arrastrar en
// la computadora, miniaturas con «Quitar» y reducción de cada foto antes de subirla.
import { h, icono } from '../utils/dom.js';
import { reducirImagen } from '../utils/imagen.js';

const TIPOS = /^image\/(jpeg|png|webp)$/;

// `max`: cuántas fotos admite; `obligatorio`: si hace falta al menos una (solo cambia la etiqueta; el servidor lo exige).
export function selectorFotos({ max, obligatorio = false, etiqueta = 'Fotos', ayuda }) {
  const fotos = [];
  let trabajando = 0;
  const aviso = h('p', { class: 'inc-fotos-aviso', role: 'status', hidden: true });
  const miniaturas = h('ul', { class: 'inc-fotos-lista', 'aria-label': 'Fotos agregadas' });
  const contador = h('span', { class: 'inc-fotos-contador' });
  const inputCamara = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'inc-oculto', tabindex: '-1', 'aria-hidden': 'true' });
  const inputGaleria = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'inc-oculto', tabindex: '-1', 'aria-hidden': 'true' });
  const botonCamara = h('button', { class: 'btn btn--primary inc-fotos-boton', type: 'button' }, icono('camera-outline'), 'Tomar foto');
  const botonGaleria = h('button', { class: 'btn btn--ghost inc-fotos-boton', type: 'button' }, icono('images-outline'), 'Elegir de la galería');
  const zona = h('div', { class: 'inc-fotos-zona' },
    h('div', { class: 'inc-fotos-botones' }, botonCamara, botonGaleria),
    h('p', { class: 'inc-fotos-ayuda', text: ayuda || `JPG, PNG o WebP · hasta ${max} foto${max === 1 ? '' : 's'}. También puedes arrastrarlas aquí.` }));
  const raiz = h('div', { class: 'inc-fotos', 'data-campo': 'fotos' },
    h('div', { class: 'inc-fotos-encabezado' }, etiqueta ? h('span', { class: 'inc-etiqueta', text: `${etiqueta}${obligatorio ? ' *' : ''}` }) : h('span'), contador),
    zona, aviso, miniaturas, inputCamara, inputGaleria);

  function mostrarAviso(texto) { aviso.hidden = !texto; aviso.textContent = texto || ''; }

  function dibujar() {
    contador.textContent = `${fotos.length} de ${max}`;
    botonCamara.disabled = botonGaleria.disabled = fotos.length >= max;
    miniaturas.replaceChildren(...fotos.map((f, i) => h('li', { class: 'inc-foto' },
      h('img', { src: f.url, alt: `Foto ${i + 1}` }),
      h('button', { class: 'inc-foto-quitar', type: 'button', 'aria-label': `Quitar la foto ${i + 1}`, onclick: () => { URL.revokeObjectURL(f.url); fotos.splice(i, 1); mostrarAviso(''); dibujar(); } }, icono('close-outline')))));
    if (trabajando) miniaturas.append(h('li', { class: 'inc-foto inc-foto--cargando', 'aria-label': 'Preparando la foto' }, icono('sync-outline', 'spin-animation')));
  }

  async function agregar(lista) {
    mostrarAviso('');
    const archivos = Array.from(lista || []);
    let rechazadas = 0;
    let sobrantes = 0;
    for (const archivo of archivos) {
      if (!TIPOS.test(archivo.type)) { rechazadas += 1; continue; }
      if (fotos.length + trabajando >= max) { sobrantes += 1; continue; }
      trabajando += 1;
      dibujar();
      const lista2 = await reducirImagen(archivo);
      trabajando -= 1;
      fotos.push({ archivo: lista2, url: URL.createObjectURL(lista2) });
    }
    dibujar();
    if (rechazadas) mostrarAviso('Solo se admiten fotos JPG, PNG o WebP.');
    else if (sobrantes) mostrarAviso(`Puedes agregar hasta ${max} foto${max === 1 ? '' : 's'}.`);
  }

  botonCamara.addEventListener('click', () => inputCamara.click());
  botonGaleria.addEventListener('click', () => inputGaleria.click());
  for (const input of [inputCamara, inputGaleria]) input.addEventListener('change', () => { agregar(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('inc-fotos-zona--sobre'); }));
  ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('inc-fotos-zona--sobre'); }));
  zona.addEventListener('drop', (e) => agregar(e.dataTransfer && e.dataTransfer.files));
  dibujar();

  return {
    el: raiz,
    archivos: () => fotos.map(f => f.archivo),
    cantidad: () => fotos.length,
    ocupado: () => trabajando > 0,
    marcarError: (texto) => { raiz.classList.toggle('inc-campo--error', Boolean(texto)); mostrarAviso(texto || ''); },
    liberar: () => fotos.forEach(f => URL.revokeObjectURL(f.url))
  };
}
