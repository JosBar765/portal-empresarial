// Armazón común de las listas de Configuración: título, buscador, botón «Agregar», nota opcional y tabla con sus estados.
import { h, icono, montar } from '../../utils/dom.js';
import { crearAviso } from '../../components/aviso.js';
import { t } from '../../textos.js';

// Estado vacío, de carga o de error dentro de la tabla (o de una tarjeta).
export function estadoLista({ icono: nombreIcono, titulo, texto, error = false, spinner = false, alReintentar }) {
  const nodoIcono = icono(nombreIcono);
  if (spinner) nodoIcono.classList.add('spin-animation');
  return h('div', { class: `buzon-vacio${error ? ' buzon-vacio-error' : ''}`, role: error ? 'alert' : null },
    nodoIcono,
    titulo && h('h3', { text: titulo }),
    texto && h('p', { text: texto }),
    alReintentar && h('button', { class: 'btn btn--primary btn--sm', type: 'button', text: t('comun.reintentar'), onclick: alReintentar }));
}

// `encabezados`: textos de las columnas (incluidos estado y acciones). `nota`: { titulo, texto } de un aviso informativo sobre la tabla.
// `idBase` prefija los ids (varias listas en una pantalla); sin `alAgregar` no hay botón; `filtros` es una barra de filtros rápidos opcional.
export function crearPanelLista({ seccion, titulo, subtitulo, encabezados, nota, filtros, idBase = 'vi-cfg', alAgregar, alBuscar, alPulsarFila }) {
  const buscador = h('input', {
    type: 'text', id: `${idBase}-buscar`, placeholder: t('config.buscar'), 'aria-label': t('config.buscarAria', { seccion }), autocomplete: 'off',
    oninput: (e) => alBuscar(e.target.value)
  });
  const resumen = h('span', { class: 'vi-resumen', id: `${idBase}-resumen`, 'aria-live': 'polite' });
  const tbody = h('tbody', { id: `${idBase}-tbody`, onclick: alPulsarFila });
  const tabla = h('table', { class: 'buzon-table data-table sticky-header vi-config-tabla' },
    h('thead', null, h('tr', null, encabezados.map(texto => h('th', { text: texto })))), tbody);
  const zona = h('div', { class: 'tabla-wrapper', tabindex: '0', role: 'region', 'aria-label': titulo }, tabla);

  const raiz = h('section', { class: 'vi-seccion vi-config-seccion', 'aria-label': titulo },
    h('div', { class: 'vi-seccion-cabecera' },
      h('div', { class: 'vi-config-titulos' },
        h('h2', { text: titulo }),
        subtitulo && h('p', { class: 'vi-config-subtitulo', text: subtitulo })),
      h('div', { class: 'vi-filtros vi-config-herramientas' },
        resumen,
        h('div', { class: 'vi-buscador' }, icono('search-outline'), buscador),
        alAgregar && h('button', { class: 'btn btn--primary vi-config-agregar', id: `${idBase}-agregar`, type: 'button', onclick: alAgregar }, icono('add-outline'), t('config.agregar')))),
    filtros,
    nota && h('div', { class: 'vi-config-nota' }, crearAviso({ tipo: 'info', titulo: nota.titulo, texto: nota.texto })),
    zona);

  return {
    raiz,
    tbody,
    ponerFilas: (html) => { tbody.innerHTML = html; },
    ponerEstado: (nodo) => montar(tbody, h('tr', null, h('td', { class: 'tabla-vacia', colspan: String(encabezados.length) }, nodo))),
    ponerResumen: (n) => { resumen.textContent = n === null ? '' : t(n === 1 ? 'config.resumen.uno' : 'config.resumen.varios', { n }); }
  };
}
