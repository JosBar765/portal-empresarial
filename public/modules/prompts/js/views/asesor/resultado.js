// Vista del prompt generado: copiado guiado de cada imagen (en el orden de la respuesta) y del prompt.
import { h, icono, montar } from '../../utils/dom.js';
import { t, rellenar } from '../../textos.js';
import { descargarRecurso } from '../../api/promptsApi.js';
import { construirPasos, claveDePaso, siguientePendiente, etiquetaBoton } from './pasosCopiado.js';
import { copiarImagen, copiarTexto, descargarBlob } from './portapapeles.js';
import { mimeAExtension } from './archivos.js';

// Cada elemento de la respuesta es del asesor (se empareja con su archivo por parámetro y posición) o un recurso fijo.
function armarItems(resultado, estado, config) {
  const usados = {};
  const extPorMime = mimeAExtension(config.formatosImagen);
  return resultado.imagenes.map((r) => {
    if (r.origen === 'recurso') {
      let promesa = null; // una sola descarga; si falla se descarta para poder reintentar
      return {
        recurso: true,
        titulo: t('asesor.resultado.imagenRecurso', { numero: r.numero, etiqueta: r.etiqueta }),
        sub: t('asesor.resultado.recursoFijo'),
        blob: () => {
          if (!promesa) promesa = descargarRecurso(r.url, r.etiqueta).catch((e) => { promesa = null; throw e; });
          return promesa;
        },
        nombre: (blob) => {
          const ext = extPorMime[blob.type] || blob.type.split('/')[1]?.split('+')[0];
          return ext ? `${r.clave}.${ext}` : r.clave;
        }
      };
    }
    const pos = usados[r.parametro] = (usados[r.parametro] ?? -1) + 1;
    const archivo = (estado.archivos[r.parametro] || [])[pos];
    return {
      recurso: false,
      url: archivo && archivo.url,
      titulo: t('asesor.resultado.imagenAsesor', { numero: r.numero, descripcion: r.descripcion || t('asesor.resultado.sinDescripcion') }),
      sub: [r.grupo, r.ubicacion].filter(Boolean).join(' · '),
      blob: async () => {
        if (!archivo) throw new Error(t('asesor.errores.archivoNoDisponible', { numero: r.numero }));
        return archivo.file;
      },
      nombre: () => (archivo ? archivo.file.name : t('asesor.resultado.nombreImagen', { numero: r.numero }))
    };
  });
}

// Devuelve liberar(): suelta los blobs y URLs propios de esta vista.
export function renderResultado(cont, { producto, indice, estado, config, resultado, alEditar }) {
  const { prompt, totalImagenes } = resultado;
  const items = armarItems(resultado, estado, config);
  const pasos = construirPasos(resultado.imagenes);
  const hechos = new Set();
  const urlsPropias = [];
  let vivo = true;
  let ocupado = false;

  const primerTexto = indice.lista.find(p => p.tipo === 'texto' && String(estado.valores[p.clave] || '').trim());
  const titulo = primerTexto ? String(estado.valores[primerTexto.clave]).trim() : '';
  const subtitulo = titulo ? `${producto.nombre} · ${titulo}` : producto.nombre;

  const cajaPrompt = h('div', { class: 'pr-prompt-texto', text: prompt });
  const btnGuiado = h('button', { type: 'button', class: 'btn btn--primary pr-copiar-guiado' });
  const btnReiniciar = h('button', { type: 'button', class: 'pr-enlace', text: t('asesor.resultado.empezarDeNuevo') });
  const btnPrompt = h('button', { type: 'button', class: 'btn btn--ghost', text: t('asesor.resultado.copiarPrompt') });

  const filas = items.map((it, i) => {
    const numero = pasos[i].numero;
    const btnCopiar = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: t('asesor.resultado.copiar') });
    const btnDescarga = h('button', { type: 'button', class: 'btn-icon', title: t('asesor.resultado.descargar'), 'aria-label': t('asesor.resultado.descargarAria', { numero }) }, icono('download-outline'));
    const miniatura = h('div', { class: 'pr-adjunto-img' }, it.url ? h('img', { src: it.url, alt: '' }) : icono('image-outline'));
    const error = h('span', { class: 'pr-adjunto-error', hidden: true });
    btnCopiar.addEventListener('click', () => copiarPaso(pasos[i]));
    btnDescarga.addEventListener('click', () => descargar(i));
    const nodo = h('li', { class: 'pr-pegar-fila' },
      miniatura,
      h('div', { class: 'pr-adjunto-texto' },
        h('strong', { text: it.titulo }),
        it.sub ? h('span', { class: 'form-hint', text: it.sub }) : null,
        error),
      btnCopiar, btnDescarga);
    return { nodo, btnCopiar, miniatura, error };
  });

  // Obtiene el blob de una fila; en un recurso pinta la miniatura al cargar o el motivo del fallo en la fila.
  async function obtenerBlob(i) {
    const it = items[i];
    const fila = filas[i];
    try {
      const blob = await it.blob();
      if (it.recurso && vivo) {
        fila.error.hidden = true;
        if (!fila.miniatura.querySelector('img')) {
          const url = URL.createObjectURL(blob);
          urlsPropias.push(url);
          fila.miniatura.replaceChildren(h('img', { src: url, alt: '' }));
        }
      }
      return blob;
    } catch (e) {
      if (it.recurso && vivo) { fila.error.textContent = e.message; fila.error.hidden = false; }
      throw e;
    }
  }

  async function descargar(i) {
    let blob;
    try { blob = await obtenerBlob(i); } catch (e) { window.toast.warning(t('asesor.resultado.toastNoDescargada'), e.message); return; }
    try { descargarBlob(blob, items[i].nombre(blob)); } catch (e) { window.toast.warning(t('asesor.resultado.toastNoDescargada'), t('asesor.errores.descargaFallo')); }
  }

  function pintar() {
    const siguiente = siguientePendiente(pasos, hechos);
    btnGuiado.textContent = etiquetaBoton(pasos, hechos);
    btnGuiado.disabled = !siguiente || ocupado;
    btnReiniciar.hidden = !!siguiente;
    filas.forEach((f, i) => {
      const hecho = hechos.has(claveDePaso(pasos[i]));
      f.btnCopiar.textContent = t(hecho ? 'asesor.resultado.copiada' : 'asesor.resultado.copiar');
      f.nodo.classList.toggle('is-copiada', hecho);
    });
    btnPrompt.textContent = t(hechos.has('prompt') ? 'asesor.resultado.promptCopiado' : 'asesor.resultado.copiarPrompt');
  }

  async function copiarPaso(paso) {
    if (ocupado) return;
    ocupado = true;
    pintar();
    try {
      if (paso.tipo === 'prompt') {
        if (!(await copiarTexto(prompt, cajaPrompt))) {
          window.toast.warning(t('asesor.resultado.toastCopiaManual'), t('asesor.errores.copiaTextoManual'));
          return;
        }
        window.toast.success(t('asesor.resultado.toastPromptCopiado'), t('asesor.resultado.toastPromptCopiadoTexto'));
      } else {
        try {
          await copiarImagen(await obtenerBlob(paso.indice));
        } catch (e) {
          window.toast.warning(t('asesor.resultado.toastImagenNoCopiada'), e.message);
          return;
        }
        window.toast.success(t('asesor.resultado.toastImagenCopiada', { numero: paso.numero }), t('asesor.resultado.toastImagenCopiadaTexto'));
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

  const { textosAsesor, limites } = config;
  const hayImagenes = items.length > 0;
  montar(cont,
    h('div', { class: 'panel-toolbar' },
      h('div', { class: 'pr-resultado-titulo' }, h('h2', { text: t('asesor.resultado.titulo') }), h('p', { class: 'pr-subtitulo', text: subtitulo })),
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: alEditar }, icono('create-outline'), ` ${t('asesor.resultado.editar')}`)),
    h('div', { class: 'pr-banner' }, icono('information-circle-outline'),
      h('span', { text: textosAsesor.aviso_pegado })),
    totalImagenes > limites.gemini_max_imagenes
      ? h('div', { class: 'pr-banner pr-banner--aviso' }, icono('warning-outline'),
        h('span', { text: rellenar(textosAsesor.aviso_exceso_imagenes, { limite: limites.gemini_max_imagenes, total: totalImagenes }) }))
      : null,
    h('div', { class: hayImagenes ? 'pr-resultado-layout' : 'pr-resultado-layout pr-resultado-layout--solo' },
      h('section', { class: 'pr-card' },
        h('div', { class: 'pr-card-cabecera' },
          h('h3', { class: 'pr-card-titulo', text: t('asesor.resultado.seccionPrompt') }),
          h('div', { class: 'pr-card-herramientas' },
            h('span', { class: 'form-hint', text: t('asesor.resultado.caracteres', { n: prompt.length }) }),
            btnPrompt)),
        cajaPrompt),
      hayImagenes
        ? h('section', { class: 'pr-card' },
          h('h3', { class: 'pr-card-titulo', text: t('asesor.resultado.seccionImagenes') }),
          h('span', { class: 'form-hint', text: textosAsesor.nota_orden_imagenes }),
          h('div', { class: 'pr-copiar-acciones' }, btnGuiado, btnReiniciar),
          h('ul', { class: 'pr-adjuntos' }, filas.map(f => f.nodo)))
        : null));

  pintar();
  // Las miniaturas de los recursos se cargan al mostrar; un fallo queda escrito en su fila.
  items.forEach((it, i) => { if (it.recurso) obtenerBlob(i).catch(() => {}); });
  return () => { vivo = false; urlsPropias.forEach(u => URL.revokeObjectURL(u)); };
}
