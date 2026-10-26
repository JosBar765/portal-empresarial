// Vista del prompt generado: copiado guiado de cada imagen (en orden) y del prompt.
import { h, icono } from '../../utils/dom.js';
import { construirPasos, claveDePaso, siguientePendiente, etiquetaBoton } from './pasosCopiado.js';
import { copiarImagen, copiarTexto, descargarBlob } from './portapapeles.js';

const MAX_GEMINI = 14;

// Cada imagen de la respuesta se empareja con su archivo por parámetro y posición.
function armarItems(resultado, estado) {
  const usados = {};
  const items = resultado.imagenes.map((r) => {
    const pos = usados[r.parametro] = (usados[r.parametro] ?? -1) + 1;
    const archivo = (estado.archivos[r.parametro] || [])[pos];
    const sub = [r.grupo, r.ubicacion].filter(Boolean).join(' · ');
    return {
      url: archivo && archivo.url,
      blob: async () => archivo.file,
      nombre: archivo ? archivo.file.name : `imagen-${r.numero}.png`,
      titulo: `Imagen ${r.numero} · ${r.descripcion || 'sin descripción'}`,
      sub
    };
  });
  const { logo } = resultado;
  let blobLogo = null;
  items.push({
    url: logo.url,
    blob: async () => {
      if (!blobLogo) blobLogo = await (await fetch(logo.url)).blob();
      return blobLogo;
    },
    nombre: 'logo-grupo-premia.png',
    titulo: `Imagen ${logo.numero} · Logo de Grupo Premia (marca de agua)`,
    sub: ''
  });
  return { items, liberar: () => { blobLogo = null; } };
}

// Devuelve liberar(): suelta los blobs propios de esta vista.
export function renderResultado(cont, { producto, indice, estado, resultado, alEditar }) {
  const { prompt, totalImagenes } = resultado;
  const { items, liberar } = armarItems(resultado, estado);
  const pasos = construirPasos(items.length);
  const hechos = new Set();
  let ocupado = false;

  const primerTexto = indice.lista.find(p => p.tipo === 'texto' && String(estado.valores[p.clave] || '').trim());
  const titulo = primerTexto ? String(estado.valores[primerTexto.clave]).trim() : '';
  const subtitulo = titulo ? `${producto.nombre} · ${titulo}` : producto.nombre;

  const cajaPrompt = h('div', { class: 'pr-prompt-texto', text: prompt });
  const btnGuiado = h('button', { type: 'button', class: 'btn btn--primary btn--lg pr-guiado-boton' });
  const btnReiniciar = h('button', { type: 'button', class: 'pr-enlace', text: 'Empezar de nuevo' });
  const btnPrompt = h('button', { type: 'button', class: 'btn btn--ghost', text: 'Copiar prompt' });

  const filas = items.map((it, i) => {
    const btnCopiar = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Copiar' });
    const btnDescarga = h('button', { type: 'button', class: 'btn-icon', title: 'Descargar imagen', 'aria-label': `Descargar imagen ${i + 1}` }, icono('download-outline'));
    btnCopiar.addEventListener('click', () => copiarPaso(pasos[i]));
    btnDescarga.addEventListener('click', async () => {
      try { descargarBlob(await it.blob(), it.nombre); } catch (e) { window.toast.warning('No se pudo descargar', 'Inténtalo de nuevo.'); }
    });
    const nodo = h('li', { class: 'pr-pegar-fila' },
      h('div', { class: 'pr-adjunto-img' }, it.url ? h('img', { src: it.url, alt: '' }) : icono('image-outline')),
      h('div', { class: 'pr-adjunto-texto' },
        h('strong', { text: it.titulo }),
        it.sub ? h('span', { class: 'form-hint', text: it.sub }) : null),
      btnCopiar, btnDescarga);
    return { nodo, btnCopiar };
  });

  function pintar() {
    const siguiente = siguientePendiente(pasos, hechos);
    btnGuiado.textContent = etiquetaBoton(pasos, hechos, totalImagenes);
    btnGuiado.disabled = !siguiente || ocupado;
    btnReiniciar.hidden = !!siguiente;
    filas.forEach((f, i) => {
      const hecho = hechos.has(claveDePaso(pasos[i]));
      f.btnCopiar.textContent = hecho ? 'Copiada' : 'Copiar';
      f.nodo.classList.toggle('is-copiada', hecho);
    });
    btnPrompt.textContent = hechos.has('prompt') ? 'Copiado' : 'Copiar prompt';
  }

  async function copiarPaso(paso) {
    if (ocupado) return;
    ocupado = true;
    pintar();
    try {
      if (paso.tipo === 'prompt') {
        if (!(await copiarTexto(prompt, cajaPrompt))) {
          window.toast.warning('Copia manual', 'El texto quedó seleccionado: cópialo con Ctrl+C.');
          return;
        }
        window.toast.success('Prompt copiado', 'Pégalo en el chat después de las imágenes.');
      } else {
        try {
          await copiarImagen(await items[paso.indice].blob());
        } catch (e) {
          window.toast.warning('No se pudo copiar la imagen', 'Tu navegador no lo permitió. Usa el botón de descarga y adjúntala a mano.');
          return;
        }
        window.toast.success(`Imagen ${paso.indice + 1} copiada`, 'Pégala en el chat de tu generador de imágenes.');
      }
      hechos.add(claveDePaso(paso));
    } finally {
      ocupado = false;
      pintar();
    }
  }

  btnGuiado.addEventListener('click', () => { const s = siguientePendiente(pasos, hechos); if (s) copiarPaso(s); });
  btnPrompt.addEventListener('click', () => copiarPaso({ tipo: 'prompt' }));
  btnReiniciar.addEventListener('click', () => { hechos.clear(); pintar(); });

  cont.replaceChildren(
    h('div', { class: 'panel-toolbar' },
      h('div', null, h('h2', { text: 'Prompt generado' }), h('p', { class: 'pr-subtitulo', text: subtitulo })),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: alEditar }, icono('create-outline'), ' Editar y generar otra propuesta')),
    h('div', { class: 'pr-banner' }, icono('information-circle-outline'),
      h('span', { text: 'Abre un chat nuevo en tu generador de imágenes y pega primero las imágenes, una por una y en este orden; al final pega el prompt. El prompt le indica que ignore cualquier propuesta anterior.' })),
    totalImagenes > MAX_GEMINI
      ? h('div', { class: 'pr-banner pr-banner--aviso' }, icono('warning-outline'),
        h('span', { text: `Gemini admite hasta ${MAX_GEMINI} imágenes de referencia y este pedido tiene ${totalImagenes}. Quita algunas imágenes para mejores resultados.` }))
      : null,
    h('div', { class: 'pr-guiado' }, btnGuiado, btnReiniciar),
    h('div', { class: 'pr-resultado-layout' },
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: 'Prompt' }),
        cajaPrompt,
        h('span', { class: 'form-hint', text: `${prompt.length} caracteres` }),
        h('div', { class: 'pr-acciones' }, btnPrompt)),
      h('section', { class: 'pr-card' },
        h('h3', { class: 'pr-card-titulo', text: 'Imágenes para pegar' }),
        h('span', { class: 'form-hint', text: 'Se copian en orden. La última es el logo de Grupo Premia para la marca de agua.' }),
        h('ul', { class: 'pr-adjuntos' }, filas.map(f => f.nodo)))));

  pintar();
  return liberar;
}
