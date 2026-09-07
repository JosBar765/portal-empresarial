// Selector de fecha propio — reemplaza el <input type="datetime-local">
// nativo. La hora nunca se le muestra al usuario en ningún lado, así que
// tampoco se le pide: es un calendario propio, con la línea visual del resto
// del formulario, que solo deja elegir un día y se cierra solo al elegirlo.
import { hoyMedianoche, isoLocal, parseIsoLocal } from '../utils/fechas.js';
import { formatearFecha } from '../utils/formato.js';
import { limpiarErrorCampo, marcarErrorCampo } from './validacion.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA_CORTO = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

// Solo un calendario puede estar abierto a la vez (aunque el formulario tenga
// varios campos de fecha) — se usa para cerrar el anterior al abrir otro, y
// para no dejarlo huérfano si el modal se cierra mientras sigue abierto.
let panelFechaActivo = null;
export function cerrarPanelFechaActivo() {
  if (panelFechaActivo) panelFechaActivo.cerrar();
}

export function htmlCampoFecha(label, name, requerido = true) {
  return `
    <div class="form-field">
      <label>${label}${requerido ? ' *' : ''}</label>
      <div class="date-field" data-date-field="${name}">
        <button type="button" class="date-field-trigger">
          <span class="date-field-value is-placeholder">Seleccionar fecha</span>
          <ion-icon name="calendar-outline"></ion-icon>
        </button>
        <input type="hidden" name="${name}" />
      </div>
    </div>
  `;
}

// Variante compacta del mismo componente, sin envoltorio .form-field/label —
// pensada para filtros de barra de herramientas. A diferencia de
// htmlCampoFecha, es limpiable (trae su propio botón "×") porque un filtro,
// a diferencia de un dato requerido del vale, siempre debe poder volver a
// "sin fecha".
export function htmlCampoFechaCompacto(name, etiqueta) {
  return `
    <div class="date-field date-field-compact" data-date-field="${name}">
      <button type="button" class="date-field-trigger" title="${etiqueta}">
        <span class="date-field-value is-placeholder">${etiqueta}</span>
        <ion-icon name="calendar-outline"></ion-icon>
      </button>
      <button type="button" class="date-field-clear" title="Quitar filtro" aria-label="Quitar filtro de ${etiqueta.toLowerCase()}">&times;</button>
      <input type="hidden" name="${name}" />
    </div>
  `;
}

// minDate se puede ajustar después con api.setMinDate() — lo usa, por
// ejemplo, la fecha del evento, que se recalcula cuando cambia la fecha de
// entrega.
export function wireCampoFecha(overlay, name, { minDate = null, placeholder = 'Seleccionar fecha' } = {}) {
  const wrapper = overlay.querySelector(`[data-date-field="${name}"]`);
  const trigger = wrapper.querySelector('.date-field-trigger');
  const valueEl = wrapper.querySelector('.date-field-value');
  const hidden = wrapper.querySelector('input[type="hidden"]');
  const clearBtn = wrapper.querySelector('.date-field-clear');
  let seleccionado = null;
  let minActual = minDate;
  let mesVisible = new Date();
  let panelEl = null;

  const api = {
    cerrar: cerrarPanel,
    getDate: () => seleccionado,
    setMinDate(fecha) {
      minActual = fecha;
      if (seleccionado && minActual && seleccionado < minActual) {
        seleccionado = null;
        hidden.value = '';
        refrescarLabel();
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    clear(opts = {}) {
      seleccionado = null;
      hidden.value = '';
      refrescarLabel();
      if (!opts.silent) hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      api.clear();
    });
  }

  function refrescarLabel() {
    wrapper.classList.toggle('has-value', !!seleccionado);
    if (seleccionado) {
      valueEl.textContent = formatearFecha(isoLocal(seleccionado));
      valueEl.classList.remove('is-placeholder');
    } else {
      valueEl.textContent = placeholder;
      valueEl.classList.add('is-placeholder');
    }
  }

  function seleccionar(fecha) {
    seleccionado = fecha;
    hidden.value = isoLocal(fecha);
    refrescarLabel();
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
    cerrarPanel();
  }

  function onKeydownCapture(e) {
    if (e.key === 'Escape') { e.stopPropagation(); cerrarPanel(); }
  }
  function onClickFuera(e) {
    if (panelEl && !panelEl.contains(e.target) && !trigger.contains(e.target)) cerrarPanel();
  }
  function cerrarPanel() {
    if (!panelEl) return;
    panelEl.remove();
    panelEl = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydownCapture, true);
    document.removeEventListener('click', onClickFuera, true);
    if (panelFechaActivo === api) panelFechaActivo = null;
  }

  function renderPanel() {
    const hoy = hoyMedianoche();
    const primerDia = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
    const offset = (primerDia.getDay() + 6) % 7; // lunes = primer día de la semana
    const diasEnMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 0).getDate();
    let celdas = '';
    for (let i = 0; i < offset; i++) celdas += '<span class="dp-day is-outside"></span>';
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), d);
      const deshabilitado = !!(minActual && fecha < minActual);
      const clases = ['dp-day'];
      if (fecha.getTime() === hoy.getTime()) clases.push('is-today');
      if (seleccionado && fecha.getTime() === seleccionado.getTime()) clases.push('is-selected');
      if (deshabilitado) clases.push('is-disabled');
      celdas += `<button type="button" class="${clases.join(' ')}" ${deshabilitado ? 'disabled' : ''} data-fecha="${isoLocal(fecha)}">${d}</button>`;
    }
    panelEl.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav="-1" aria-label="Mes anterior"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <span class="dp-month-label">${MESES[mesVisible.getMonth()]} ${mesVisible.getFullYear()}</span>
        <button type="button" class="dp-nav" data-nav="1" aria-label="Mes siguiente"><ion-icon name="chevron-forward-outline"></ion-icon></button>
      </div>
      <div class="dp-weekdays">${DIAS_SEMANA_CORTO.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="dp-grid">${celdas}</div>
    `;
    panelEl.querySelectorAll('.dp-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + Number(btn.dataset.nav), 1);
        renderPanel();
      });
    });
    panelEl.querySelectorAll('.dp-day[data-fecha]:not(.is-disabled)').forEach(btn => {
      btn.addEventListener('click', () => seleccionar(parseIsoLocal(btn.dataset.fecha)));
    });
  }

  function posicionarPanel() {
    const rect = trigger.getBoundingClientRect();
    const anchoPanel = panelEl.offsetWidth;
    let left = rect.left;
    if (left + anchoPanel > window.innerWidth - 12) left = Math.max(12, rect.right - anchoPanel);
    panelEl.style.top = `${rect.bottom + 6}px`;
    panelEl.style.left = `${left}px`;
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panelEl) { cerrarPanel(); return; }
    if (panelFechaActivo) panelFechaActivo.cerrar();
    const base = minActual && minActual > hoyMedianoche() ? minActual : hoyMedianoche();
    mesVisible = seleccionado ? new Date(seleccionado) : new Date(base);
    panelEl = document.createElement('div');
    panelEl.className = 'date-picker-panel';
    document.body.appendChild(panelEl);
    renderPanel();
    posicionarPanel();
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeydownCapture, true);
    setTimeout(() => document.addEventListener('click', onClickFuera, true), 0);
    panelFechaActivo = api;
  });

  return api;
}

export function validarCampoFecha(overlay, name) {
  const hidden = overlay.querySelector(`[data-date-field="${name}"] input[type="hidden"]`);
  if (hidden.value) { limpiarErrorCampo(hidden); return true; }
  marcarErrorCampo(hidden, 'Selecciona una fecha.');
  return false;
}
