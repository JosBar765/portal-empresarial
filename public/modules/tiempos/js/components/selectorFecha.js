// public/modules/tiempos/js/components/selectorFecha.js
// El campo «Fecha de la orden»: calendario con los fines de semana en gris y los festivos de Guatemala en rojo.
import { h, icono } from '../utils/dom.js';
import { crearFlotante } from './flotante.js';
import { obtenerFestivos } from '../api/tiemposApi.js';
import { aFecha, aISO, fechaCorta, fechaLarga, nombreMes } from '../utils/formato.js';
import { nuevoId } from './ui.js';

const festivosPorAnio = new Map();
async function festivosDe(anio) {
  if (!festivosPorAnio.has(anio)) {
    try { festivosPorAnio.set(anio, new Map((await obtenerFestivos(`${anio}-01-01`, `${anio}-12-31`)).festivos.map(f => [f.fecha, f.nombre]))); } catch (e) { return new Map(); }
  }
  return festivosPorAnio.get(anio);
}

export function selectorFecha({ valor, alElegir, id = nuevoId('fecha') }) {
  const boton = h('button', { class: 'tm-selector', type: 'button', id }, h('span', { class: 'tm-selector-texto', text: fechaCorta(valor) }), icono('calendar-outline'));
  return crearFlotante({
    boton, titulo: 'Fecha de la orden', subtitulo: 'Se cuenta desde el siguiente día hábil', clase: 'tm-flotante--calendario',
    construir: (cerrar) => {
      const base = aFecha(valor);
      let anio = base.getUTCFullYear(); let mes = base.getUTCMonth();
      const cuerpo = h('div', { class: 'tm-calendario' });
      const pintar = async () => {
        const festivos = await festivosDe(anio);
        const primero = new Date(Date.UTC(anio, mes, 1));
        const huecos = (primero.getUTCDay() + 6) % 7; // semana de lunes a domingo
        const diasMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
        const celdas = [];
        for (let i = 0; i < huecos; i++) celdas.push(h('span', { class: 'tm-dia tm-dia--vacio' }));
        for (let d = 1; d <= diasMes; d++) {
          const iso = aISO(new Date(Date.UTC(anio, mes, d)));
          const dow = new Date(Date.UTC(anio, mes, d)).getUTCDay();
          const festivo = festivos.get(iso);
          const clases = ['tm-dia', iso === valor ? 'tm-dia--elegido' : '', festivo ? 'tm-dia--festivo' : '', !festivo && (dow === 0 || dow === 6) ? 'tm-dia--finde' : ''].filter(Boolean).join(' ');
          celdas.push(h('button', { class: clases, type: 'button', title: festivo || '', 'aria-label': `${fechaLarga(iso)}${festivo ? `, festivo: ${festivo}` : ''}`, 'aria-pressed': String(iso === valor), onclick: () => { alElegir(iso); cerrar(); }, text: String(d) }));
        }
        cuerpo.replaceChildren(
          h('div', { class: 'tm-cal-cabecera' },
            h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': 'Mes anterior', onclick: () => { mes -= 1; if (mes < 0) { mes = 11; anio -= 1; } pintar(); } }, icono('chevron-back-outline')),
            h('strong', { text: nombreMes(anio, mes) }),
            h('button', { class: 'btn btn--ghost btn--solo-icono', type: 'button', 'aria-label': 'Mes siguiente', onclick: () => { mes += 1; if (mes > 11) { mes = 0; anio += 1; } pintar(); } }, icono('chevron-forward-outline'))),
          h('div', { class: 'tm-cal-semana' }, ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => h('span', { text: x }))),
          h('div', { class: 'tm-cal-rejilla' }, celdas),
          h('p', { class: 'tm-tenue tm-cal-leyenda' }, 'Rojo: festivo del calendario del portal (no cuenta). Gris: fin de semana.'));
      };
      pintar();
      return cuerpo;
    }
  });
}
