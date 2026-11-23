// Para hoy (M2): lo que el asesor debe tocar ahora, en tres grupos: vencidos, de hoy y sin tocar. Ruta: #/parahoy.
import { h, icono, montar } from '../utils/dom.js';
import { cargando } from '../components/ui.js';
import { obtenerParaHoy } from '../api/api.js';
import { chipGestion, diaCorto, textoSeguimiento, horaDe } from '../utils/gestion.js';
import { accionesDeContacto, sinProyectoActivo } from './miProyecto.js';

export async function renderParaHoy(cont) {
  montar(cont, cargando());
  const d = await obtenerParaHoy();
  if (d.total === 0 && d.limiteDias === null) { montar(cont, sinProyectoActivo()); return; }

  const tarjeta = (f) => h('article', { class: 'tarjeta-hoy tarjeta-hoy--grande' },
    h('a', { class: 'tarjeta-hoy-enlace', href: `#/empresa/${f.id}` },
      h('div', { class: 'tarjeta-hoy-fila' }, h('strong', { text: f.nombre }), chipGestion(f.estado)),
      f.ciudad ? h('div', { class: 'texto-tenue', text: f.ciudad }) : null,
      f.seguimientoVencido ? h('div', { class: 'alerta-linea alerta-linea--roja' }, icono('warning-outline'), `Seguimiento vencido desde el ${diaCorto(f.proximaGestion)}`)
        : f.proximaGestion ? h('div', { class: 'alerta-linea' }, icono('time-outline'), `Seguimiento: ${textoSeguimiento(f.proximaGestion, false).toLowerCase()}`)
          : h('div', { class: 'alerta-linea alerta-linea--roja' }, icono('warning-outline'), `Sin gestión · ${f.diasSinGestion} días`)),
    !f.tieneDireccion && d.hoy.includes(f) ? h('div', { class: 'alerta-linea' }, icono('location-outline'), 'Sin dirección: complétala para incluirla en la ruta') : null,
    accionesDeContacto(f.telefono, { texto: true, enlaceMapa: f.enlaceMapa }));
  const grupo = (titulo, filas) => (filas.length ? h('section', { class: 'grupo-hoy' }, h('h2', { class: 'panel-titulo', text: `${titulo} · ${filas.length}` }), h('div', { class: 'rejilla-hoy' }, filas.map(tarjeta))) : null);

  // La ruta del día (M13): las empresas con seguimiento hoy y dirección, en el orden de su hora, con un enlace a Google Maps.
  const ruta = d.ruta && d.ruta.paradas.length ? h('section', { class: 'panel ruta-hoy' },
    h('h2', { class: 'panel-titulo', text: `Ruta de hoy · ${d.ruta.paradas.length} ${d.ruta.paradas.length === 1 ? 'parada' : 'paradas'}` }),
    h('ol', { class: 'ruta-hoy-lista' }, d.ruta.paradas.map(p => h('li', null, h('span', { class: 'ruta-hoy-nombre', text: p.nombre }), h('span', { class: 'texto-tenue', text: horaDe(p.proximaGestion) })))),
    h('a', { class: 'btn btn--primary', href: d.ruta.enlace, target: '_blank', rel: 'noopener' }, icono('location-outline'), 'Abrir ruta en Google Maps'),
    h('p', { class: 'texto-tenue texto-tenue--chico', text: `${d.ruta.paradas.length > 1 ? 'Maps las abre en el orden de las horas; puedes reordenarlas allí.' : 'Maps abre la dirección de la empresa.'}${d.ruta.recortada ? ' Maps admite hasta 10 lugares: van las primeras.' : ''}${d.ruta.sinDireccion ? ` ${d.ruta.sinDireccion} ${d.ruta.sinDireccion === 1 ? 'empresa de hoy no tiene' : 'empresas de hoy no tienen'} dirección y no entra${d.ruta.sinDireccion === 1 ? '' : 'n'} en la ruta.` : ''}` })) : null;
  const partes = [];
  if (d.vencidos.length) partes.push(`${d.vencidos.length} ${d.vencidos.length === 1 ? 'vencido' : 'vencidos'}`);
  if (d.hoy.length) partes.push(`${d.hoy.length} ${d.hoy.length === 1 ? 'vence hoy' : 'vencen hoy'}`);
  if (d.sinTocar.length) partes.push(`${d.sinTocar.length} sin tocar hace ${d.limiteDias}+ días`);
  montar(cont,
    h('div', { class: 'pagina-cabecera' }, h('div', null, h('h1', { class: 'pagina-titulo', text: 'Para hoy' }),
      h('p', { class: 'pagina-subtitulo', text: d.total ? `${d.total} ${d.total === 1 ? 'pendiente' : 'pendientes'}: ${partes.join(', ')}.` : 'No tienes nada pendiente por hoy.' }))),
    d.total ? [ruta, grupo('Vencidos', d.vencidos), grupo('Hoy', d.hoy), grupo(`Sin tocar hace ${d.limiteDias} días o más`, d.sinTocar)]
      : h('div', { class: 'estado-vacio' }, icono('checkmark-circle-outline'), h('h3', { text: 'Estás al día' }), h('p', { text: 'Ningún seguimiento vence y no hay empresas sin tocar. Vuelve a Mi proyecto para seguir avanzando.' }), h('a', { class: 'btn btn--primary', href: '#/miproyecto' }, 'Ir a Mi proyecto')));
}
