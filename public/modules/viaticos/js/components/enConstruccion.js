// Marcador funcional de las vistas que llegan en fases siguientes: título, y un estado vacío que ya consume state.contexto.
import { state } from '../state.js';
import { h, icono, montar } from '../utils/dom.js';
import { t } from '../textos.js';

export function renderEnConstruccion(contenedor, claveTitulo) {
  const paises = (state.contexto && state.contexto.paises) || [];
  const detalle = paises.length
    ? t('shell.enConstruccion.paises', { paises: paises.map(p => p.nombre).join(', ') })
    : t('shell.enConstruccion.sinPaises');
  montar(contenedor,
    h('div', { class: 'panel-toolbar' }, h('h2', { text: t(claveTitulo) })),
    h('div', { class: 'buzon-vacio' },
      icono('construct-outline'),
      h('h3', { text: t('shell.enConstruccion.titulo') }),
      h('p', { text: t('shell.enConstruccion.texto') }),
      h('p', { text: detalle })));
}
