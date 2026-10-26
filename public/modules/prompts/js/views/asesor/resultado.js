// Vista del prompt generado: texto, adjuntos de la lámina y acciones de copiado.
import { h, icono } from '../../utils/dom.js';
import { armarRecuadros, dibujarLamina } from './lamina.js';

const puedeCopiarImagen = () => !!(window.isSecureContext && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);

function marcarCopiado(boton) {
  const original = boton.dataset.original || boton.textContent;
  boton.dataset.original = original;
  boton.textContent = 'Copiado';
  setTimeout(() => { boton.textContent = original; }, 2000);
}

// Fallback sin API de portapapeles: deja el texto seleccionado para Ctrl+C.
function seleccionarTexto(nodo) {
  const rango = document.createRange();
  rango.selectNodeContents(nodo);
  const seleccion = window.getSelection();
  seleccion.removeAllRanges();
  seleccion.addRange(rango);
  try { return document.execCommand('copy'); } catch (e) { return false; }
}

function filaAdjunto({ titulo, zona, url }) {
  return h('li', { class: 'pr-adjunto' },
    h('div', { class: 'pr-adjunto-img' }, url ? h('img', { src: url, alt: '' }) : icono('close-outline')),
    h('div', { class: 'pr-adjunto-texto' },
      h('strong', { text: titulo }),
      zona ? h('span', { class: 'form-hint', text: zona }) : null));
}

// Devuelve liberar(): revoca las URLs propias de esta vista.
export function renderResultado(cont, { producto, indice, estado, resultado, alEditar }) {
  const { prompt, lamina } = resultado;
  const recuadros = armarRecuadros(lamina, estado.archivos);
  let urlVistaPrevia = null;
  let blobLamina = null;

  const primerTexto = indice.lista.find(p => p.tipo === 'texto' && String(estado.valores[p.clave] || '').trim());
  const titulo = primerTexto ? String(estado.valores[primerTexto.clave]).trim() : '';
  const subtitulo = titulo ? `${producto.nombre} · ${titulo}` : producto.nombre;

  const cajaPrompt = h('div', { class: 'pr-prompt-texto', text: prompt });
  const vistaPrevia = h('div', { class: 'pr-lamina-preview' }, h('span', { class: 'form-hint', text: 'Preparando lámina...' }));

  const btnTodo = h('button', { type: 'button', class: 'btn btn--primary btn--lg', text: 'Copiar todo (lámina + prompt)', disabled: true });
  const btnPrompt = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Copiar prompt' });
  const btnImagen = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Copiar lámina', disabled: true });
  const btnDescarga = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Descargar lámina', disabled: true });

  btnTodo.addEventListener('click', async () => {
    const aviso = () => window.toast.warning('No se pudo copiar todo junto', 'Tu navegador no permitió copiar la lámina y el prompt a la vez. Usa «Copiar prompt» y «Copiar lámina» por separado.');
    if (!puedeCopiarImagen()) { aviso(); return; }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobLamina, 'text/plain': new Blob([prompt], { type: 'text/plain' }) })]);
      marcarCopiado(btnTodo);
      window.toast.success('Copiado', 'Pega la lámina y el prompt en un chat nuevo.');
    } catch (e) { aviso(); }
  });

  btnPrompt.addEventListener('click', async () => {
    try {
      if (!(navigator.clipboard && navigator.clipboard.writeText)) throw new Error('sin portapapeles');
      await navigator.clipboard.writeText(prompt);
    } catch (e) {
      if (!seleccionarTexto(cajaPrompt)) {
        window.toast.warning('Copia manual', 'El texto quedó seleccionado: cópialo con Ctrl+C.');
        return;
      }
    }
    marcarCopiado(btnPrompt);
    window.toast.success('Prompt copiado', 'Pégalo en un chat nuevo de tu generador de imágenes.');
  });

  btnImagen.addEventListener('click', async () => {
    if (!puedeCopiarImagen()) {
      window.toast.warning('No se pudo copiar la lámina', 'Tu navegador no permite copiar imágenes. Usa «Descargar lámina».');
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobLamina })]);
      marcarCopiado(btnImagen);
      window.toast.success('Lámina copiada', 'Pégala en un chat nuevo de tu generador de imágenes.');
    } catch (e) {
      window.toast.warning('No se pudo copiar la lámina', 'El navegador no lo permitió. Usa «Descargar lámina».');
    }
  });

  btnDescarga.addEventListener('click', () => {
    const url = URL.createObjectURL(blobLamina);
    const enlace = h('a', { href: url, download: 'lamina-referencia.png' });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const filas = recuadros.map(r => {
    if (r.esLogo) return filaAdjunto({ titulo: `Recuadro ${r.numero} · Logo Grupo Premia (marca de agua)`, url: r.url });
    const g = indice.grupoDe[r.parametro];
    const p = indice.porClave[r.parametro];
    return filaAdjunto({ titulo: `Recuadro ${r.numero} · ${r.nombre}`, zona: [g && g.etiqueta, p && p.etiqueta].filter(Boolean).join(' · '), url: r.url });
  });

  cont.replaceChildren(
    h('div', { class: 'panel-toolbar' },
      h('div', null, h('h2', { text: 'Prompt generado' }), h('p', { class: 'pr-subtitulo', text: subtitulo })),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: alEditar }, icono('create-outline'), ' Editar y generar otra propuesta')),
    h('div', { class: 'pr-banner' }, icono('information-circle-outline'),
      h('span', { text: 'Pega el prompt y la lámina en un chat nuevo de tu generador de imágenes. El prompt le indica que ignore cualquier propuesta anterior.' })),
    h('div', { class: 'pr-resultado-layout' },
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: 'Prompt' }),
        cajaPrompt,
        h('span', { class: 'form-hint', text: `${prompt.length} caracteres` })),
      h('aside', { class: 'pr-lateral-resultado' },
        h('section', { class: 'pr-card' },
          h('h3', { class: 'pr-card-titulo', text: 'Adjuntos' }),
          h('ul', { class: 'pr-adjuntos' }, filas),
          vistaPrevia,
          h('span', { class: 'form-hint', text: 'Las imágenes se copian juntas como una sola lámina numerada.' })),
        h('div', { class: 'pr-acciones' }, btnTodo, btnPrompt, btnImagen, btnDescarga))));

  let cancelado = false;
  dibujarLamina(recuadros).then(({ blob }) => {
    if (cancelado) return;
    blobLamina = blob;
    urlVistaPrevia = URL.createObjectURL(blob);
    vistaPrevia.replaceChildren(h('img', { src: urlVistaPrevia, alt: 'Lámina de referencia generada' }));
    [btnTodo, btnImagen, btnDescarga].forEach(b => { b.disabled = false; });
  }).catch(() => {
    if (!cancelado) vistaPrevia.replaceChildren(h('span', { class: 'form-hint', text: 'No se pudo crear la lámina. Inténtalo de nuevo.' }));
  });

  return () => {
    cancelado = true;
    if (urlVistaPrevia) URL.revokeObjectURL(urlVistaPrevia);
  };
}
