// public/modules/incidencias/js/views/enviada.js
// «Incidencia enviada»: el número para darle seguimiento y qué sigue.
import { h, icono, montar } from '../utils/dom.js';
import { detalle } from '../api/incidenciasApi.js';
import { chipPrioridad, chipEstado } from '../components/chips.js';
import { cargando, mostrarError, botonEnlace } from './estados.js';

export async function mostrarEnviada(cont, id) {
  montar(cont, cargando('Un momento…'));
  try {
    const { incidencia: i } = await detalle(id);
    montar(cont, h('section', { class: 'inc-card inc-enviada' },
      h('div', { class: 'inc-mensaje-icono inc-mensaje-icono--exito' }, icono('checkmark-circle-outline')),
      h('p', { class: 'inc-enviada-etiqueta', text: 'Incidencia enviada' }),
      h('h2', { class: 'inc-enviada-numero', text: i.correlativo }),
      h('p', { class: 'inc-enviada-titulo', text: `${i.titulo} · ${i.tienda.codigo}${i.zona ? ` · ${i.zona}` : ''}` }),
      h('div', { class: 'inc-fila-chips' }, chipPrioridad(i.prioridad), chipEstado(i.estado, i.estadoEtiqueta)),
      h('div', { class: 'inc-enviada-sigue' },
        h('h3', { text: 'Qué sigue' }),
        h('ul', null,
          h('li', { text: 'Cae al buzón: un técnico la toma y te avisamos.' }),
          h('li', { text: 'Verás los avances en «Mis incidencias».' }),
          h('li', { text: 'Cuando el técnico termine, la revisa la persona encargada de tu tienda.' }))),
      h('div', { class: 'inc-mensaje-acciones' },
        botonEnlace('Ver mi incidencia', `#/incidencia/${i.id}`, true, 'eye-outline'),
        botonEnlace('Reportar otra', '#/reportar', false, 'add-outline'))));
  } catch (error) {
    mostrarError(cont, error, () => mostrarEnviada(cont, id));
  }
  return {};
}
