// Panel del selector de período de la barra: dos niveles, como un calendario normal. Los días filtran un
// solo día; el título del mes abre una cuadrícula de meses con flechas de año y elegir uno filtra todo el mes.
// Reusa el aspecto del calendario de los formularios (.date-picker-panel, .dp-*).
import { hoyMedianoche, isoLocal, parseIsoLocal, primerDiaDelMes } from '../utils/fechas.js';
import { MESES, DIAS_SEMANA_CORTO, registrarPanelFechaActivo, liberarPanelFechaActivo } from './datepicker.js';

const DIAS_ABREV = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// «mar 13 oct 2026»
export function etiquetaDia(fecha) {
  return `${DIAS_ABREV[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()].slice(0, 3).toLowerCase()} ${fecha.getFullYear()}`;
}

export function etiquetaMes(fecha) {
  return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

// `obtener()` devuelve la ventana actual (`state.ventana`); `alElegir({ tipo: 'mes' | 'dia', fecha })` la cambia.
export function wireSelectorPeriodo(trigger, { obtener, alElegir }) {
  let panel = null;
  let vista = 'dias';
  let mesVisible = new Date();
  let anioVisible = mesVisible.getFullYear();

  const api = { cerrar: () => cerrar(false) };

  function elegir(tipo, fecha) {
    cerrar(true);
    alElegir({ tipo, fecha });
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(true); }
  }
  function onClickFuera(e) {
    if (panel && !panel.contains(e.target) && !trigger.contains(e.target)) cerrar(false);
  }

  function cerrar(devolverFoco) {
    if (!panel) return;
    panel.remove();
    panel = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('click', onClickFuera, true);
    liberarPanelFechaActivo(api);
    if (devolverFoco) trigger.focus();
  }

  function htmlDias() {
    const { tipo, fecha } = obtener();
    const hoy = hoyMedianoche();
    const elegido = tipo === 'dia' ? parseIsoLocal(fecha) : null;
    const anio = mesVisible.getFullYear(), mes = mesVisible.getMonth();
    const offset = (new Date(anio, mes, 1).getDay() + 6) % 7; // lunes = primer día de la semana
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    let celdas = '';
    for (let i = 0; i < offset; i++) celdas += '<span class="dp-day is-outside"></span>';
    for (let d = 1; d <= diasEnMes; d++) {
      const f = new Date(anio, mes, d);
      const clases = ['dp-day'];
      if (f.getTime() === hoy.getTime()) clases.push('is-today');
      if (elegido && f.getTime() === elegido.getTime()) clases.push('is-selected');
      celdas += `<button type="button" class="${clases.join(' ')}" data-fecha="${isoLocal(f)}" aria-label="${etiquetaDia(f)}"${elegido && f.getTime() === elegido.getTime() ? ' aria-pressed="true"' : ''}>${d}</button>`;
    }
    return `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav="-1" aria-label="Mes anterior"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <button type="button" class="dp-titulo" data-accion="meses" aria-label="${etiquetaMes(mesVisible)}, elegir otro mes">${etiquetaMes(mesVisible)}<ion-icon name="chevron-down-outline" aria-hidden="true"></ion-icon></button>
        <button type="button" class="dp-nav" data-nav="1" aria-label="Mes siguiente"><ion-icon name="chevron-forward-outline"></ion-icon></button>
      </div>
      <div class="dp-weekdays">${DIAS_SEMANA_CORTO.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="dp-grid">${celdas}</div>
      <div class="dp-pie"><button type="button" class="dp-accion" data-accion="mes-completo">Todo ${MESES[mes].toLowerCase()}</button></div>`;
  }

  function htmlMeses() {
    const { tipo, fecha } = obtener();
    const hoy = new Date();
    const elegido = tipo === 'mes' ? parseIsoLocal(fecha) : null;
    const botones = MESES.map((nombre, i) => {
      const clases = ['dp-mes'];
      if (anioVisible === hoy.getFullYear() && i === hoy.getMonth()) clases.push('is-actual');
      const activo = elegido && elegido.getFullYear() === anioVisible && elegido.getMonth() === i;
      if (activo) clases.push('is-selected');
      return `<button type="button" class="${clases.join(' ')}" data-mes="${i}" aria-label="${nombre} ${anioVisible}"${activo ? ' aria-pressed="true"' : ''}>${nombre.slice(0, 3)}</button>`;
    }).join('');
    return `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav-anio="-1" aria-label="Año anterior"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <span class="dp-month-label">${anioVisible}</span>
        <button type="button" class="dp-nav" data-nav-anio="1" aria-label="Año siguiente"><ion-icon name="chevron-forward-outline"></ion-icon></button>
      </div>
      <div class="dp-meses">${botones}</div>`;
  }

  function pintar(enfocar) {
    panel.innerHTML = vista === 'dias' ? htmlDias() : htmlMeses();
    panel.setAttribute('aria-label', vista === 'dias' ? 'Elegir día' : 'Elegir mes');
    panel.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
      mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + Number(b.dataset.nav), 1);
      pintar();
      panel.querySelector(`[data-nav="${b.dataset.nav}"]`).focus();
    }));
    panel.querySelectorAll('[data-nav-anio]').forEach(b => b.addEventListener('click', () => {
      anioVisible += Number(b.dataset.navAnio);
      pintar();
      panel.querySelector(`[data-nav-anio="${b.dataset.navAnio}"]`).focus();
    }));
    panel.querySelectorAll('.dp-day[data-fecha]').forEach(b => b.addEventListener('click', () => elegir('dia', parseIsoLocal(b.dataset.fecha))));
    panel.querySelectorAll('.dp-mes').forEach(b => b.addEventListener('click', () => elegir('mes', new Date(anioVisible, Number(b.dataset.mes), 1))));
    const titulo = panel.querySelector('[data-accion="meses"]');
    if (titulo) titulo.addEventListener('click', () => { anioVisible = mesVisible.getFullYear(); vista = 'meses'; pintar(true); });
    const completo = panel.querySelector('[data-accion="mes-completo"]');
    if (completo) completo.addEventListener('click', () => elegir('mes', primerDiaDelMes(mesVisible)));
    if (enfocar) {
      // Foco inicial: lo elegido, si no el día/mes de hoy, si no el primero.
      const prioridad = ['.is-selected', '.is-today', '.is-actual', '.dp-day[data-fecha], .dp-mes'];
      for (const selector of prioridad) {
        const objetivo = panel.querySelector(selector);
        if (objetivo) { objetivo.focus(); break; }
      }
    }
  }

  function posicionar() {
    const rect = trigger.getBoundingClientRect();
    const ancho = panel.offsetWidth;
    let left = rect.left;
    if (left + ancho > window.innerWidth - 12) left = Math.max(12, window.innerWidth - ancho - 12);
    panel.style.top = `${rect.bottom + 6}px`;
    panel.style.left = `${left}px`;
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel) { cerrar(true); return; }
    registrarPanelFechaActivo(api);
    mesVisible = primerDiaDelMes(parseIsoLocal(obtener().fecha) || new Date());
    anioVisible = mesVisible.getFullYear();
    vista = 'dias';
    panel = document.createElement('div');
    panel.className = 'date-picker-panel panel-periodo';
    panel.setAttribute('role', 'dialog');
    document.body.appendChild(panel);
    pintar(true);
    posicionar();
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeydown, true);
    setTimeout(() => document.addEventListener('click', onClickFuera, true), 0);
  });

  return api;
}
