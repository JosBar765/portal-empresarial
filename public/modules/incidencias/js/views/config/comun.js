// public/modules/incidencias/js/views/config/comun.js
// Ayudas de las pestañas de Configuración: tablas, avisos de error, selector de personas y la lista de tiendas.
import { h, icono, montar, sinRebote } from '../../utils/dom.js';
import { verificadores as pedirVerificadores } from '../../api/configApi.js';

export const aviso = (tipo, titulo, texto) => { if (window.toast) window.toast[tipo](titulo, texto); };

// El mensaje más útil de un error: el detalle por campo si lo trae, si no el mensaje general.
export const mensajeDe = (error) => (error && error.campos ? Object.values(error.campos)[0] : (error && error.message)) || 'Algo salió mal. Inténtalo de nuevo.';
export const avisarError = (error, titulo = 'No se pudo guardar') => aviso('error', titulo, mensajeDe(error));

// Una tabla de configuración que se desliza de lado en pantallas angostas.
// columnas: títulos (en el celular cada fila se vuelve una tarjeta y cada celda lleva su título); filas: [{ celdas, clase? }].
export function tablaConfig({ columnas, filas, vacio = 'No hay nada para mostrar todavía.' }) {
  if (!filas.length) return h('p', { class: 'inc-tenue inc-config-vacio', text: vacio });
  return h('div', { class: 'inc-tabla-config' }, h('table', { class: 'inc-tabla' },
    h('thead', null, h('tr', null, columnas.map(c => h('th', { scope: 'col', text: c })))),
    h('tbody', null, filas.map(f => h('tr', { class: f.clase || '' }, f.celdas.map((c, i) => h('td', { class: i === f.celdas.length - 1 ? 'inc-celda-accion' : '', 'data-etiqueta': columnas[i] || null }, c)))))));
}

export const botonEditar = (alHacerClic, etiqueta = 'Editar') => h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: alHacerClic }, etiqueta);

// Cabecera de una pestaña: título, explicación y, si hace falta, el botón principal.
export const encabezadoPestana = (titulo, texto, boton) => h('div', { class: 'inc-config-encabezado' }, h('div', null, h('h2', { text: titulo }), texto ? h('p', { class: 'inc-tenue', text: texto }) : null), boton || null);

export const botonPrincipal = (texto, alHacerClic, nombreIcono = 'add-outline') => h('button', { class: 'btn btn--primary', type: 'button', onclick: alHacerClic }, icono(nombreIcono), texto);

// Las tiendas de los países encendidos (para elegir zonas y coberturas); se piden una vez por visita.
let tiendasEnMemoria = null;
export async function tiendasDeConfig({ renovar = false } = {}) {
  if (!tiendasEnMemoria || renovar) tiendasEnMemoria = (await pedirVerificadores()).tiendas.map(t => ({ id: t.id, codigo: t.codigo, empresa: t.empresa, pais: t.pais }));
  return tiendasEnMemoria;
}

// Un selector de personas con búsqueda: devuelve { el, elegida() } y llama `alElegir` al marcar a alguien.
export function selectorPersonas({ buscar, etiqueta = 'Persona', vacio = 'Escribe un nombre o un correo para buscar.', alElegir }) {
  let elegida = null;
  const entrada = h('input', { type: 'search', id: 'acc-persona-busqueda', placeholder: 'Buscar por nombre o correo', autocomplete: 'off', 'aria-label': 'Buscar persona' });
  const lista = h('ul', { class: 'inc-personas', role: 'listbox', 'aria-label': 'Personas encontradas' });
  const resumen = h('p', { class: 'inc-tenue', role: 'status' });
  function dibujar(personas) {
    if (!personas.length) { montar(lista); resumen.textContent = 'No encontramos a nadie con ese nombre.'; return; }
    resumen.textContent = '';
    montar(lista, personas.map(p => {
      const radio = h('input', { type: 'radio', name: 'persona', value: String(p.id), checked: elegida && elegida.id === p.id });
      radio.addEventListener('change', () => { elegida = p; if (alElegir) alElegir(p); });
      return h('li', null, h('label', { class: 'inc-persona' }, radio,
        h('span', { class: 'inc-persona-datos' }, h('strong', { text: p.nombre }), h('span', { class: 'inc-tenue', text: `${p.rol}${p.email ? ` · ${p.email}` : ''}` })),
        p.sinPermiso ? h('span', { class: 'inc-chip inc-chip--alerta', title: 'Su rol no tiene el permiso necesario: se lo das en «Roles y permisos»', text: 'Su rol no puede' }) : null));
    }));
  }
  const buscarAhora = async () => {
    resumen.textContent = 'Buscando…';
    try { dibujar((await buscar(entrada.value.trim())).candidatos); } catch (error) { resumen.textContent = mensajeDe(error); }
  };
  entrada.addEventListener('input', sinRebote(buscarAhora, 300));
  setTimeout(buscarAhora, 0);
  return {
    el: h('div', { class: 'inc-campo inc-campo--ancho', 'data-campo': 'usuarioId' }, h('label', { for: 'acc-persona-busqueda', text: `${etiqueta} *` }), entrada, resumen, lista),
    elegida: () => elegida
  };
}

// Dos botones de color para un valor `rojo|naranja|…` (los nombres de color que usa el servidor).
export const COLORES = [['rojo', 'Rojo'], ['naranja', 'Naranja'], ['amarillo', 'Amarillo'], ['verde', 'Verde'], ['azul', 'Azul'], ['gris', 'Gris']];
