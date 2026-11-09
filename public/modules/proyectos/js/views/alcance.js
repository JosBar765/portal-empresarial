// A7 · Alcance de usuarios: los países que ve cada persona. Por defecto, el de su tienda; aquí se amplían o se quitan.
// Solo se guardan las diferencias; quitar un país no borra ningún dato.
import { h, icono, montar } from '../utils/dom.js';
import { cabecera, cargando, avisar, estadoVacio } from '../components/ui.js';
import { modalFormulario } from '../components/modalFormulario.js';
import { listarAlcance, guardarAlcance } from '../api/api.js';

const POR_TANDA = 10;
const iniciales = (nombre) => String(nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const nombres = (lista) => lista.map(p => p.nombre).join(', ');

export async function renderAlcance(cont) {
  montar(cont, cargando());
  let datos = await listarAlcance({});
  const filtros = { busqueda: '', rol: '', pais: '' };
  let visibles = POR_TANDA;
  let temporizador = null;
  let numeroConsulta = 0;

  const zonaTabla = h('div');
  const busqueda = h('input', { type: 'search', placeholder: 'Buscar persona…', maxlength: 100, 'aria-label': 'Buscar persona', autocomplete: 'off' });

  async function cargar() {
    const mia = ++numeroConsulta;
    try {
      const respuesta = await listarAlcance(filtros);
      if (mia !== numeroConsulta) return;
      datos = respuesta;
      visibles = POR_TANDA;
      dibujarTabla();
    } catch (error) {
      avisar('error', 'No se pudo cargar', error.message);
    }
  }

  const selector = (clave, etiqueta, opciones, todos) => {
    const control = h('select', { 'aria-label': etiqueta }, h('option', { value: '', text: todos }), opciones.map(o => h('option', { value: String(o.id), text: o.nombre })));
    control.value = filtros[clave];
    control.addEventListener('change', () => { filtros[clave] = control.value; cargar(); });
    return h('div', { class: 'campo' }, h('label', { text: etiqueta }), control);
  };

  function ajustes(p) {
    if (!p.agregados.length && !p.quitados.length) return h('span', { class: 'texto-tenue', text: '—' });
    return h('div', { class: 'chips' },
      p.agregados.map(x => h('span', { class: 'chip-estado chip-estado--activa', text: `+ ${x.nombre}` })),
      p.quitados.map(x => h('span', { class: 'chip-estado chip-estado--no_contactar', text: `− ${x.nombre}` })));
  }

  function dibujarTabla() {
    const lista = datos.items.slice(0, visibles);
    if (!datos.items.length) { montar(zonaTabla, h('div', { class: 'tabla-caja' }, estadoVacio('Nadie coincide', 'Prueba con otra búsqueda o quita algún filtro.', 'search-outline'))); return; }
    montar(zonaTabla,
      h('div', { class: 'tabla-caja' }, h('div', { class: 'tabla-scroll' }, h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['Persona', 'Rol', 'Tienda', 'País por defecto', 'Ajustes del administrador', 'Países efectivos', ''].map(t => h('th', { text: t })))),
        h('tbody', null, lista.map(p => h('tr', null,
          h('td', null, h('div', { class: 'persona' }, h('span', { class: 'persona-avatar', text: iniciales(p.nombre) }), h('span', { class: 'cambio-ajuste', text: p.nombre }))),
          h('td', { text: p.rol }), h('td', { text: p.tienda }),
          h('td', { text: p.paisesPorDefecto.length > 2 ? `${p.paisesPorDefecto.length} países` : (nombres(p.paisesPorDefecto) || '—') }),
          h('td', null, ajustes(p)),
          h('td', { text: p.efectivos.length > 3 ? `${p.efectivos.length} países` : nombres(p.efectivos), title: nombres(p.efectivos) }),
          h('td', null, h('button', { class: 'enlace-boton', type: 'button', onclick: () => editar(p) }, icono('create-outline'), ' Editar'))))))),
        h('div', { class: 'tabla-pie' },
          h('span', { text: `Mostrando ${lista.length} de ${datos.items.length} personas · quitar un país no borra datos` }),
          visibles < datos.items.length ? h('button', { class: 'btn btn--ghost btn--chico', type: 'button', onclick: () => { visibles = datos.items.length; dibujarTabla(); } }, `Ver las ${datos.items.length}`) : null)));
  }

  function editar(persona) {
    const elegidos = new Set(persona.efectivos.map(p => p.id));
    const defecto = new Set(persona.paisesPorDefecto.map(p => p.id));
    let error = '';
    const nodo = h('form', { class: 'formulario-modal', novalidate: '' });
    const dibujar = () => montar(nodo,
      h('p', { class: 'panel-descripcion', text: `${persona.nombre} · ${persona.rol}. Marca los países que verá y en los que podrá registrar empresas. Lo marcado con «tienda» es su país por defecto.` }),
      h('div', { class: 'lista-paises' }, datos.paises.map(p => h('label', { class: 'opcion-pais' },
        h('input', { type: 'checkbox', checked: elegidos.has(p.id), onchange: (e) => { if (e.target.checked) elegidos.add(p.id); else elegidos.delete(p.id); error = ''; dibujar(); } }),
        h('span', { class: 'opcion-pais-nombre', text: p.nombre }),
        defecto.has(p.id) ? h('span', { class: 'chip-estado', text: 'tienda' }) : (elegidos.has(p.id) ? h('span', { class: 'chip-estado chip-estado--activa', text: 'agregado' }) : null)))),
      [...defecto].some(id => !elegidos.has(id)) ? h('p', { class: 'campo-ayuda', text: 'Quitar un país de su tienda no borra ninguna empresa: solo deja de verla.' }) : null,
      error ? h('p', { class: 'campo-error', text: error }) : null);
    dibujar();
    modalFormulario({
      title: `Alcance de ${persona.nombre}`, nodo, aceptar: 'Guardar alcance',
      enviar: async () => {
        if (!elegidos.size) { error = 'Elige al menos un país.'; dibujar(); throw Object.assign(new Error(error), { silencioso: true }); }
        await guardarAlcance(persona.id, [...elegidos]);
        avisar('success', 'Alcance guardado', `${persona.nombre} ya ve los países elegidos.`);
        await cargar();
      },
      alError: (e) => { if (!e.silencioso) avisar('error', 'No se pudo guardar', e.message); }
    });
  }

  busqueda.addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(() => { filtros.busqueda = busqueda.value.trim(); cargar(); }, 350); });
  const limpiar = h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { Object.assign(filtros, { busqueda: '', rol: '', pais: '' }); renderAlcance(cont); } }, 'Quitar filtros');

  montar(cont,
    cabecera({ titulo: 'Alcance de usuarios', subtitulo: 'Cada persona ve el país de su tienda. Aquí amplías o quitas países.' }),
    h('div', { class: 'panel filtros filtros--clientes' },
      h('div', { class: 'campo campo--busqueda' }, h('label', { text: 'Buscar' }), busqueda),
      selector('rol', 'Rol', datos.roles, 'Todos'), selector('pais', 'País', datos.paises, 'Todos'), limpiar),
    zonaTabla);
  dibujarTabla();
}
