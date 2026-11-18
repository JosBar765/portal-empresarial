// public/modules/incidencias/js/components/selectorTienda.js
// Elegir una tienda sin una lista interminable: un botón que abre una hoja con buscador y las tiendas agrupadas por país y
// ruta (o área). En el celular la hoja ocupa la pantalla; la tienda propia va primero y se puede encontrar escribiendo.
import { h, icono, montar } from '../utils/dom.js';
import { abrirHoja } from './modal.js';
import { agrupar, coincide, nombreDeGrupo, nombreDeTienda } from '../utils/tiendas.js';

// `tiendas`: [{ id, codigo, empresa, departamento, subdivision, pais }]; `propiaId`: la tienda de quien reporta (opcional).
// `alElegir(id)` se llama al cambiar; `establecer(id)` cambia el valor sin avisar. `valor()` devuelve el id como texto.
export function selectorTienda({ id, nombre = 'tiendaId', tiendas, propiaId = null, valor = '', vacio = 'Elige dónde está el problema', titulo = 'Elige la tienda', alElegir }) {
  let actual = valor ? String(valor) : '';
  const propia = tiendas.find(t => t.id === propiaId) || null;
  const boton = h('button', { class: 'inc-selector', type: 'button', id, name: nombre, 'aria-haspopup': 'dialog' });
  const pintar = () => {
    const t = tiendas.find(x => String(x.id) === actual);
    montar(boton,
      h('span', { class: 'inc-selector-texto' },
        h('span', { class: `inc-selector-principal${t ? '' : ' inc-selector-vacio'}`, text: t ? nombreDeTienda(t, tiendas) : vacio }),
        t ? h('span', { class: 'inc-selector-secundario', text: `${t.codigo} · ${nombreDeGrupo(t.departamento)} · ${t.pais}` }) : null),
      icono('chevron-down-outline'));
  };
  pintar();

  function abrir() {
    const buscador = h('input', { type: 'search', class: 'inc-selector-buscar', placeholder: 'Buscar por nombre o código', autocomplete: 'off', 'aria-label': 'Buscar tienda' });
    const lista = h('div', { class: 'inc-selector-lista' });
    const estado = h('p', { class: 'inc-tenue', role: 'status' });
    let hoja = null;
    const elegir = (t) => { actual = String(t.id); pintar(); if (hoja) hoja.cerrar(); if (alElegir) alElegir(actual); };
    const fila = (t) => {
      const elegida = String(t.id) === actual;
      const b = h('button', { class: `inc-tienda-fila${elegida ? ' inc-tienda-fila--elegida' : ''}`, type: 'button', 'aria-pressed': String(elegida), onclick: () => elegir(t) },
        h('span', { class: 'inc-tienda-nombre' }, h('strong', { text: nombreDeTienda(t, tiendas) }), propia && t.id === propia.id ? h('span', { class: 'inc-chip inc-chip--exito', text: 'Tu tienda' }) : null),
        h('span', { class: 'inc-tienda-codigo', text: t.codigo }),
        elegida ? icono('checkmark-circle', 'inc-tienda-check') : null);
      return h('li', null, b);
    };
    function dibujar() {
      const visibles = tiendas.filter(t => coincide(t, tiendas, buscador.value));
      const paises = agrupar(visibles, propia);
      const variosPaises = paises.length > 1;
      estado.textContent = visibles.length ? '' : 'No encontramos ninguna tienda con ese nombre.';
      montar(lista, paises.map(p => h('section', { class: 'inc-tienda-pais' },
        variosPaises ? h('h4', { class: 'inc-tienda-pais-titulo', text: p.pais }) : null,
        p.grupos.map(g => h('div', { class: 'inc-tienda-grupo' },
          h('h5', { class: 'inc-tienda-grupo-titulo', text: `${g.nombre} · ${g.tiendas.length}` }),
          h('ul', { class: 'inc-tienda-filas' }, g.tiendas.map(fila)))))));
    }
    buscador.addEventListener('input', dibujar);
    dibujar();
    hoja = abrirHoja({ titulo, contenido: h('div', { class: 'inc-selector-hoja' }, buscador, estado, lista), acciones: [], cancelar: 'Cerrar' });
    hoja.el.classList.add('inc-hoja--selector');
    // En el celular el teclado taparía la lista: solo se abre si la persona toca el buscador.
    if (window.matchMedia('(pointer: coarse)').matches) buscador.blur();
    const elegida = lista.querySelector('.inc-tienda-fila--elegida');
    if (elegida) elegida.scrollIntoView({ block: 'center' });
  }
  boton.addEventListener('click', abrir);
  return { el: boton, valor: () => actual, establecer: (nuevo) => { actual = nuevo ? String(nuevo) : ''; pintar(); } };
}
