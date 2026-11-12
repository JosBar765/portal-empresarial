// Selector de fecha propio (copia adaptada de Vales, sin cupos ni feriados): un calendario que solo deja elegir un día y se cierra al elegirlo.
import { hoyMedianoche, isoLocal, parseIsoLocal } from '../utils/fechas.js';
import { formatearFecha } from '../utils/formato.js';
import { limpiarErrorCampo, marcarErrorCampo } from './validacion.js';
import { t } from '../textos.js';

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const DIAS_SEMANA_CORTO = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

// Solo un calendario abierto a la vez: se cierra el anterior al abrir otro y no queda huérfano si el modal se cierra.
let panelFechaActivo = null;
export function cerrarPanelFechaActivo() {
  if (panelFechaActivo) panelFechaActivo.cerrar();
}

// Para otros paneles de fecha (el de la barra de período) que comparten la regla de «uno a la vez».
export function registrarPanelFechaActivo(api) {
  if (panelFechaActivo && panelFechaActivo !== api) panelFechaActivo.cerrar();
  panelFechaActivo = api;
}
export function liberarPanelFechaActivo(api) {
  if (panelFechaActivo === api) panelFechaActivo = null;
}

export function htmlCampoFecha(label, name, requerido = true) {
  return `
    <div class="form-field">
      <label>${label}${requerido ? ' *' : ''}</label>
      <div class="date-field" data-date-field="${name}">
        <button type="button" class="date-field-trigger">
          <span class="date-field-value is-placeholder">${t('periodo.seleccionarFecha')}</span>
          <ion-icon name="calendar-outline"></ion-icon>
        </button>
        <input type="hidden" name="${name}" />
      </div>
    </div>
  `;
}

// Variante compacta sin .form-field ni label, para barras de filtros; es limpiable porque un filtro puede volver a «sin fecha».
export function htmlCampoFechaCompacto(name, etiqueta) {
  return `
    <div class="date-field date-field-compact" data-date-field="${name}">
      <button type="button" class="date-field-trigger" title="${etiqueta}">
        <span class="date-field-value is-placeholder">${etiqueta}</span>
        <ion-icon name="calendar-outline"></ion-icon>
      </button>
      <button type="button" class="date-field-clear" title="${t('periodo.quitarFiltro')}" aria-label="${t('periodo.quitarFiltroDe', { campo: etiqueta.toLowerCase() })}">&times;</button>
      <input type="hidden" name="${name}" />
    </div>
  `;
}

// `minDate` se puede ajustar después con api.setMinDate() (p. ej. la fecha de regreso depende de la de salida).
export function wireCampoFecha(overlay, name, { minDate = null, placeholder = t('periodo.seleccionarFecha') } = {}) {
  const wrapper = overlay.querySelector(`[data-date-field="${name}"]`);
  const trigger = wrapper.querySelector('.date-field-trigger');
  const valueEl = wrapper.querySelector('.date-field-value');
  const hidden = wrapper.querySelector('input[type="hidden"]');
  const clearBtn = wrapper.querySelector('.date-field-clear');
  let seleccionado = null;
  let minActual = minDate;
  let mesVisible = new Date();
  let panelEl = null;
  let placeholderActual = placeholder;

  const noDisponible = (f) => !!(minActual && f < minActual);

  // Si la fecha elegida dejó de ser válida se borra; si el panel está abierto se redibuja.
  function revalidar() {
    if (seleccionado && noDisponible(seleccionado)) {
      seleccionado = null;
      hidden.value = '';
      refrescarLabel();
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (panelEl) renderPanel();
  }

  const api = {
    cerrar: cerrarPanel,
    getDate: () => seleccionado,
    setMinDate(fecha) {
      minActual = fecha;
      revalidar();
    },
    setDate(fecha, opts = {}) {
      seleccionado = fecha;
      hidden.value = isoLocal(fecha);
      refrescarLabel();
      if (!opts.silent) hidden.dispatchEvent(new Event('change', { bubbles: true }));
    },
    esValida: (f) => !noDisponible(f),
    // Deshabilita el campo (borra la fecha elegida) y muestra `hint` en su lugar.
    setEnabled(habilitado, hint = placeholder) {
      trigger.disabled = !habilitado;
      wrapper.classList.toggle('is-disabled', !habilitado);
      placeholderActual = habilitado ? placeholder : hint;
      if (!habilitado) {
        cerrarPanel();
        if (seleccionado) { api.clear(); return; }
      }
      refrescarLabel();
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
      valueEl.textContent = placeholderActual;
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
  // El panel es fixed en <body>: sigue al campo mientras se hace scroll y se cierra si el campo sale de la zona visible.
  function onScrollOResize() {
    if (!panelEl) return;
    const campo = trigger.getBoundingClientRect();
    let visible = { top: 0, bottom: window.innerHeight };
    for (let el = trigger.parentElement; el && el !== document.body; el = el.parentElement) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') {
        const caja = el.getBoundingClientRect();
        visible = { top: Math.max(visible.top, caja.top), bottom: Math.min(visible.bottom, caja.bottom) };
      }
    }
    if (campo.bottom <= visible.top || campo.top >= visible.bottom) { cerrarPanel(); return; }
    posicionarPanel();
  }
  function cerrarPanel() {
    if (!panelEl) return;
    panelEl.remove();
    panelEl = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydownCapture, true);
    document.removeEventListener('click', onClickFuera, true);
    window.removeEventListener('scroll', onScrollOResize, true);
    window.removeEventListener('resize', onScrollOResize);
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
      const deshabilitado = noDisponible(fecha);
      const clases = ['dp-day'];
      if (fecha.getTime() === hoy.getTime()) clases.push('is-today');
      if (seleccionado && fecha.getTime() === seleccionado.getTime()) clases.push('is-selected');
      if (deshabilitado) clases.push('is-disabled');
      celdas += `<button type="button" class="${clases.join(' ')}" ${deshabilitado ? 'disabled' : ''} data-fecha="${isoLocal(fecha)}">${d}</button>`;
    }
    panelEl.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav="-1" aria-label="${t('periodo.mesAnterior')}"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <span class="dp-month-label">${MESES[mesVisible.getMonth()]} ${mesVisible.getFullYear()}</span>
        <button type="button" class="dp-nav" data-nav="1" aria-label="${t('periodo.mesSiguiente')}"><ion-icon name="chevron-forward-outline"></ion-icon></button>
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
    window.addEventListener('scroll', onScrollOResize, true);
    window.addEventListener('resize', onScrollOResize);
    panelFechaActivo = api;
  });

  return api;
}

export function validarCampoFecha(overlay, name) {
  const hidden = overlay.querySelector(`[data-date-field="${name}"] input[type="hidden"]`);
  if (hidden.value) { limpiarErrorCampo(hidden); return true; }
  marcarErrorCampo(hidden, t('validacion.fecha'));
  return false;
}
