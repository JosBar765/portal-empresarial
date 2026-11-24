// Mis proyectos anteriores (M10 en celular, D3 en escritorio): los proyectos ya cerrados o cancelados donde la persona tuvo empresas.
import { h, icono, montar } from '../utils/dom.js';
import { cargando, estadoVacio } from '../components/ui.js';
import { listarMisProyectosAnteriores } from '../api/api.js';
import { nombreDelMes, formatoMonto } from '../utils/gestion.js';

let anioRecordado = '';

export async function renderAnteriores(cont) {
  montar(cont, cargando());
  const { proyectos } = await listarMisProyectosAnteriores();
  const anios = [...new Set(proyectos.map(p => p.anio))].sort((a, b) => b - a);
  if (!anios.includes(Number(anioRecordado))) anioRecordado = anios.length ? String(anios[0]) : '';
  const zona = h('div');

  function dibujar() {
    const visibles = proyectos.filter(p => String(p.anio) === anioRecordado);
    montar(zona,
      anios.length > 1 ? h('div', { class: 'chips chips--anios' }, anios.map(a => h('button', { class: `chip-filtro${String(a) === anioRecordado ? ' chip-filtro--activo' : ''}`, type: 'button', onclick: () => { anioRecordado = String(a); dibujar(); } }, String(a)))) : null,
      visibles.length ? h('div', { class: 'rejilla-anteriores' }, visibles.map(p => h('article', { class: 'tarjeta-anterior' },
        h('div', { class: 'tarjeta-anterior-cabecera' },
          h('div', null, h('h2', { class: 'tarjeta-anterior-titulo', text: p.nicho }), h('div', { class: 'texto-tenue', text: nombreDelMes(p.anio, p.mes) })),
          h('span', { class: `chip-oscuro${p.estado === 'cancelado' ? ' chip-oscuro--gris' : ''}`, text: p.estado === 'cancelado' ? 'Cancelado' : 'Cerrado' })),
        h('div', { class: 'cifras-anterior' },
          [[p.asignadas, 'Asignadas'], [p.vendidas, 'Vendidas'], [`${p.efectividad} %`, 'Efectividad']].map(([v, t]) => h('div', null, h('div', { class: 'cifra-valor', text: String(v) }), h('div', { class: 'cifra-texto', text: t })))),
        h('div', { class: 'texto-tenue tarjeta-anterior-pie' }, icono('information-circle-outline'),
          p.vendido.length ? `Vendido: ${p.vendido.map(v => formatoMonto(v.monto, v.moneda)).join(' · ')}` : 'Sin ventas confirmadas')))) : estadoVacio('Todavía no tienes proyectos anteriores', 'Cuando un proyecto en el que participes se cierre, su resultado aparecerá aquí.', 'time-outline'));
  }

  montar(cont, h('div', { class: 'pagina-cabecera' }, h('div', null, h('h1', { class: 'pagina-titulo', text: 'Mis proyectos anteriores' }), h('p', { class: 'pagina-subtitulo', text: 'El resultado de cada proyecto en el que participaste.' }))), zona);
  dibujar();
}
