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
  let vista = 'dias';
  let anioVisible = mesVisible.getFullYear();
  let desplazamientoAnios = 0;
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

  // Tres vistas: días del mes, meses del año y años; el título lleva de una a la siguiente para llegar a una fecha lejana en pocos clics.
  function renderPanel() {
    if (vista === 'anios') renderAnios();
    else if (vista === 'meses') renderMeses();
    else renderDias();
    if (panelEl) posicionarPanel();
  }

  function renderDias() {
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
    const etiqueta = `${MESES[mesVisible.getMonth()]} ${mesVisible.getFullYear()}`;
    panelEl.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav="-1" aria-label="${t('periodo.mesAnterior')}"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <button type="button" class="dp-titulo" data-vista="meses" aria-label="${t('periodo.elegirOtroMes', { mes: etiqueta })}">${etiqueta}<ion-icon name="chevron-down-outline" aria-hidden="true"></ion-icon></button>
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
    panelEl.querySelector('[data-vista="meses"]').addEventListener('click', () => { anioVisible = mesVisible.getFullYear(); vista = 'meses'; renderPanel(); });
    panelEl.querySelectorAll('.dp-day[data-fecha]:not(.is-disabled)').forEach(btn => {
      btn.addEventListener('click', () => seleccionar(parseIsoLocal(btn.dataset.fecha)));
    });
  }

  // Un mes o un año sin ningún día elegible (todo anterior a la fecha mínima) se deshabilita.
  const mesSinDias = (anio, mes) => !!(minActual && new Date(anio, mes + 1, 0) < minActual);
  const anioSinDias = (anio) => !!(minActual && new Date(anio, 11, 31) < minActual);

  function renderMeses() {
    const hoy = hoyMedianoche();
    const botones = MESES.map((nombre, i) => {
      const clases = ['dp-mes'];
      if (anioVisible === hoy.getFullYear() && i === hoy.getMonth()) clases.push('is-actual');
      if (seleccionado && seleccionado.getFullYear() === anioVisible && seleccionado.getMonth() === i) clases.push('is-selected');
      return `<button type="button" class="${clases.join(' ')}" data-mes="${i}" aria-label="${nombre} ${anioVisible}" ${mesSinDias(anioVisible, i) ? 'disabled' : ''}>${nombre.slice(0, 3)}</button>`;
    }).join('');
    panelEl.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav-anio="-1" aria-label="${t('periodo.anioAnterior')}"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <button type="button" class="dp-titulo" data-vista="anios" aria-label="${t('periodo.elegirOtroAnio', { anio: anioVisible })}">${anioVisible}<ion-icon name="chevron-down-outline" aria-hidden="true"></ion-icon></button>
        <button type="button" class="dp-nav" data-nav-anio="1" aria-label="${t('periodo.anioSiguiente')}"><ion-icon name="chevron-forward-outline"></ion-icon></button>
      </div>
      <div class="dp-meses">${botones}</div>
    `;
    panelEl.querySelectorAll('[data-nav-anio]').forEach(b => b.addEventListener('click', () => { anioVisible += Number(b.dataset.navAnio); renderPanel(); }));
    panelEl.querySelector('[data-vista="anios"]').addEventListener('click', () => { vista = 'anios'; renderPanel(); });
    panelEl.querySelectorAll('.dp-mes:not(:disabled)').forEach(b => b.addEventListener('click', () => {
      mesVisible = new Date(anioVisible, Number(b.dataset.mes), 1);
      vista = 'dias';
      renderPanel();
    }));
  }

  // Doce años por página, con el año visible dentro de la página (así 2030 aparece sin avanzar desde 2026).
  function renderAnios() {
    const hoy = hoyMedianoche();
    const inicio = anioVisible - 4 + desplazamientoAnios;
    const botones = Array.from({ length: 12 }, (_, i) => {
      const anio = inicio + i;
      const clases = ['dp-mes'];
      if (anio === hoy.getFullYear()) clases.push('is-actual');
      if (seleccionado && seleccionado.getFullYear() === anio) clases.push('is-selected');
      return `<button type="button" class="${clases.join(' ')}" data-anio="${anio}" ${anioSinDias(anio) ? 'disabled' : ''}>${anio}</button>`;
    }).join('');
    panelEl.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav-pagina="-1" aria-label="${t('periodo.aniosAnteriores')}"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <span class="dp-month-label">${inicio} – ${inicio + 11}</span>
        <button type="button" class="dp-nav" data-nav-pagina="1" aria-label="${t('periodo.aniosSiguientes')}"><ion-icon name="chevron-forward-outline"></ion-icon></button>
      </div>
      <div class="dp-meses">${botones}</div>
    `;
    panelEl.querySelectorAll('[data-nav-pagina]').forEach(b => b.addEventListener('click', () => { desplazamientoAnios += 12 * Number(b.dataset.navPagina); renderPanel(); }));
    panelEl.querySelectorAll('.dp-mes:not(:disabled)').forEach(b => b.addEventListener('click', () => {
      anioVisible = Number(b.dataset.anio);
      desplazamientoAnios = 0;
      vista = 'meses';
      renderPanel();
    }));
  }

  // El panel nunca debe salirse de la ventana: se abre debajo del campo, se voltea hacia arriba si abajo no cabe y,
  // si en ninguno de los dos lados cabe, se pega al borde (con scroll propio si la ventana es más baja que el calendario).
  function posicionarPanel() {
    const rect = trigger.getBoundingClientRect();
    const margen = 8;
    const separacion = 6;
    panelEl.style.maxHeight = `${window.innerHeight - margen * 2}px`;
    const anchoPanel = panelEl.offsetWidth;
    const altoPanel = panelEl.offsetHeight;
    let left = rect.left;
    if (left + anchoPanel > window.innerWidth - 12) left = Math.max(12, rect.right - anchoPanel);
    const espacioAbajo = window.innerHeight - rect.bottom - separacion - margen;
    const espacioArriba = rect.top - separacion - margen;
    let top = rect.bottom + separacion;
    if (altoPanel > espacioAbajo && espacioArriba > espacioAbajo) top = rect.top - separacion - altoPanel;
    top = Math.min(Math.max(margen, top), Math.max(margen, window.innerHeight - altoPanel - margen));
    panelEl.style.top = `${top}px`;
    panelEl.style.left = `${left}px`;
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panelEl) { cerrarPanel(); return; }
    if (panelFechaActivo) panelFechaActivo.cerrar();
    const base = minActual && minActual > hoyMedianoche() ? minActual : hoyMedianoche();
    mesVisible = seleccionado ? new Date(seleccionado) : new Date(base);
    vista = 'dias';
    desplazamientoAnios = 0;
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
