// Barra de período de Reportes: Hoy · Día · Semana · Mes · Desde–Hasta.
// Un control segmentado elige el tipo; debajo, flechas ‹ › y una etiqueta que abre el calendario del tipo elegido
// (día, semana o mes). El rango usa dos campos de fecha. Reusa el aspecto del calendario de los formularios (.dp-*).
import { hoyMedianoche, isoLocal, parseIsoLocal, primerDiaDelMes, sumarDiaLocal } from '../utils/fechas.js';
import {
  MESES, DIAS_SEMANA_CORTO, htmlCampoFechaCompacto, wireCampoFecha, registrarPanelFechaActivo, liberarPanelFechaActivo
} from './datepicker.js';
import { etiquetaDia, etiquetaMes } from './selectorPeriodo.js';

const TIPOS = [
  { id: 'hoy', texto: 'Hoy' },
  { id: 'dia', texto: 'Día' },
  { id: 'semana', texto: 'Semana' },
  { id: 'mes', texto: 'Mes' },
  { id: 'rango', texto: 'Desde – Hasta' }
];

const corto = (f) => `${f.getDate()} ${MESES[f.getMonth()].slice(0, 3).toLowerCase()}`;

export const lunesDeSemana = (f) => sumarDiaLocal(new Date(f.getFullYear(), f.getMonth(), f.getDate()), -((f.getDay() + 6) % 7));

// Una semana o un mes está «cerrado» cuando su último día ya pasó (hoy no cuenta). Día y rango no se restringen.
export function periodoCerrado(tipo, f) {
  const hoy = hoyMedianoche();
  if (tipo === 'semana') return sumarDiaLocal(lunesDeSemana(f), 6) < hoy;
  if (tipo === 'mes') return new Date(f.getFullYear(), f.getMonth() + 1, 0) < hoy;
  return true;
}

// Último período cerrado del tipo (semana o mes) que contiene la fecha o la precede.
export function ultimoPeriodoCerrado(tipo, f = hoyMedianoche()) {
  if (tipo === 'semana') { let g = lunesDeSemana(f); while (!periodoCerrado('semana', g)) g = sumarDiaLocal(g, -7); return g; }
  if (tipo === 'mes') { let g = new Date(f.getFullYear(), f.getMonth(), 1); while (!periodoCerrado('mes', g)) g = new Date(g.getFullYear(), g.getMonth() - 1, 1); return g; }
  return f;
}

// Si el período es una semana o un mes que aún no cierra, lo lleva al último cerrado (mismo objeto si no hace falta).
export function normalizarPeriodoCerrado(p) {
  if (p.tipo !== 'semana' && p.tipo !== 'mes') return p;
  const f = parseIsoLocal(p.fecha) || hoyMedianoche();
  return periodoCerrado(p.tipo, f) ? p : { ...p, fecha: isoLocal(ultimoPeriodoCerrado(p.tipo, f)) };
}

function semanaIso(f) {
  const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - primerJueves) / 86400000 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7);
}

export function etiquetaSemana(f) {
  const lunes = lunesDeSemana(f);
  const domingo = sumarDiaLocal(lunes, 6);
  const anio = domingo.getFullYear();
  return `Semana ${semanaIso(lunes)} · ${corto(lunes)} – ${corto(domingo)} ${anio}`;
}

// Etiqueta legible del período elegido.
export function etiquetaDelPeriodo(p) {
  const f = parseIsoLocal(p.fecha) || hoyMedianoche();
  if (p.tipo === 'hoy') return `Hoy · ${etiquetaDia(hoyMedianoche())}`;
  if (p.tipo === 'dia') return etiquetaDia(f);
  if (p.tipo === 'semana') return etiquetaSemana(f);
  if (p.tipo === 'mes') return etiquetaMes(f);
  return 'Desde – Hasta';
}

export function periodoInicial() {
  return { tipo: 'hoy', fecha: isoLocal(hoyMedianoche()), desde: '', hasta: '' };
}

// Parámetros para el servidor: el tipo viaja tal cual; el rango, con sus dos fechas.
export function aplicarPeriodoAQuery(qs, p) {
  qs.set('ventana', p.tipo);
  if (p.tipo === 'rango') { qs.set('desde', p.desde); qs.set('hasta', p.hasta); }
  else if (p.tipo !== 'hoy') qs.set('fecha', p.fecha);
}

// `soloCerrados()`: si devuelve true, Semana y Mes solo permiten períodos ya cerrados (reporte de Rendimiento).
export function crearBarraPeriodo(contenedor, { obtener, alCambiar, soloCerrados = () => false }) {
  contenedor.innerHTML = `
    <div class="rp-segmentos" role="group" aria-label="Tipo de período">
      ${TIPOS.map(t => `<button type="button" class="rp-segmento" data-tipo="${t.id}" aria-pressed="false">${t.texto}</button>`).join('')}
    </div>
    <div class="rp-navegador" id="rp-navegador">
      <button type="button" class="rp-flecha" data-paso="-1" aria-label="Período anterior"><ion-icon name="chevron-back-outline"></ion-icon></button>
      <button type="button" class="rp-etiqueta" id="rp-etiqueta" aria-haspopup="dialog" aria-expanded="false"><ion-icon name="calendar-outline" aria-hidden="true"></ion-icon><span></span></button>
      <button type="button" class="rp-flecha" data-paso="1" aria-label="Período siguiente"><ion-icon name="chevron-forward-outline"></ion-icon></button>
    </div>
    <div class="rp-rango" id="rp-rango">
      ${htmlCampoFechaCompacto('rep-desde', 'Desde')}<span class="rp-guion" aria-hidden="true">–</span>${htmlCampoFechaCompacto('rep-hasta', 'Hasta')}
    </div>`;
  const navegador = contenedor.querySelector('#rp-navegador');
  const etiqueta = contenedor.querySelector('#rp-etiqueta');
  const rango = contenedor.querySelector('#rp-rango');
  const apiDesde = wireCampoFecha(rango, 'rep-desde', { placeholder: 'Desde' });
  const apiHasta = wireCampoFecha(rango, 'rep-hasta', { placeholder: 'Hasta' });

  const cambiar = (cambios) => alCambiar({ ...obtener(), ...cambios });

  function pintar() {
    const p = obtener();
    contenedor.querySelectorAll('.rp-segmento').forEach(b => {
      const activo = b.dataset.tipo === p.tipo;
      b.classList.toggle('is-activo', activo);
      b.setAttribute('aria-pressed', String(activo));
    });
    navegador.hidden = p.tipo === 'rango';
    rango.hidden = p.tipo !== 'rango';
    navegador.querySelectorAll('.rp-flecha').forEach(b => { b.hidden = p.tipo === 'hoy'; });
    // Con períodos cerrados, la flecha «siguiente» se apaga cuando el siguiente aún no cierra.
    const siguiente = navegador.querySelector('[data-paso="1"]');
    if (siguiente) {
      const f = parseIsoLocal(p.fecha) || hoyMedianoche();
      const proximo = p.tipo === 'semana' ? sumarDiaLocal(f, 7) : new Date(f.getFullYear(), f.getMonth() + 1, 1);
      const apagar = soloCerrados() && (p.tipo === 'semana' || p.tipo === 'mes') && !periodoCerrado(p.tipo, proximo);
      siguiente.disabled = apagar;
      siguiente.title = apagar ? 'Este período aún no cierra' : '';
    }
    etiqueta.querySelector('span').textContent = etiquetaDelPeriodo(p);
    etiqueta.disabled = p.tipo === 'hoy';
    if (p.tipo === 'rango') {
      if (p.desde) apiDesde.setDate(parseIsoLocal(p.desde), { silent: true });
      if (p.hasta) apiHasta.setDate(parseIsoLocal(p.hasta), { silent: true });
    }
  }

  contenedor.querySelectorAll('.rp-segmento').forEach(b => b.addEventListener('click', () => {
    const p = obtener();
    const tipo = b.dataset.tipo;
    if (tipo === p.tipo) return;
    const hoy = hoyMedianoche();
    if (tipo === 'rango') {
      cambiar({ tipo, desde: p.desde || isoLocal(sumarDiaLocal(hoy, -6)), hasta: p.hasta || isoLocal(hoy) });
    } else {
      const nuevo = { tipo, fecha: tipo === 'hoy' ? isoLocal(hoy) : (p.fecha || isoLocal(hoy)) };
      cambiar(soloCerrados() ? normalizarPeriodoCerrado({ ...p, ...nuevo }) : nuevo);
    }
  }));

  navegador.querySelectorAll('.rp-flecha').forEach(b => b.addEventListener('click', () => {
    const p = obtener();
    const paso = Number(b.dataset.paso);
    const f = parseIsoLocal(p.fecha) || hoyMedianoche();
    let nueva = f;
    if (p.tipo === 'dia') nueva = sumarDiaLocal(f, paso);
    else if (p.tipo === 'semana') nueva = sumarDiaLocal(f, paso * 7);
    else if (p.tipo === 'mes') nueva = new Date(f.getFullYear(), f.getMonth() + paso, 1);
    cambiar({ fecha: isoLocal(nueva) });
  }));

  // Rango: solo se consulta cuando están las dos fechas y son coherentes.
  const alCambiarRango = () => {
    const d = apiDesde.getDate();
    const h = apiHasta.getDate();
    if (!d || !h) return;
    if (d > h) { window.toast?.error('Período', 'La fecha «Desde» no puede ser posterior a «Hasta».'); return; }
    cambiar({ tipo: 'rango', desde: isoLocal(d), hasta: isoLocal(h) });
  };
  rango.querySelector('[data-date-field="rep-desde"] input[type="hidden"]').addEventListener('change', alCambiarRango);
  rango.querySelector('[data-date-field="rep-hasta"] input[type="hidden"]').addEventListener('change', alCambiarRango);

  // ---- Calendario del tipo elegido (día, semana o mes) ----
  let panel = null;
  let vista = 'dias';
  let mesVisible = new Date();
  let anioVisible = mesVisible.getFullYear();
  const api = { cerrar: () => cerrar(false) };

  function elegir(fecha) {
    cerrar(true);
    cambiar({ fecha: isoLocal(fecha) });
  }
  const onKeydown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(true); } };
  const onClickFuera = (e) => { if (panel && !panel.contains(e.target) && !etiqueta.contains(e.target)) cerrar(false); };

  function cerrar(devolverFoco) {
    if (!panel) return;
    panel.remove();
    panel = null;
    etiqueta.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('click', onClickFuera, true);
    liberarPanelFechaActivo(api);
    if (devolverFoco) etiqueta.focus();
  }

  function htmlDias(modo) {
    const p = obtener();
    const hoy = hoyMedianoche();
    const elegido = parseIsoLocal(p.fecha);
    const lunesElegido = modo === 'semana' && elegido ? lunesDeSemana(elegido).getTime() : null;
    const anio = mesVisible.getFullYear(), mes = mesVisible.getMonth();
    const offset = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const celdas = [];
    for (let i = 0; i < offset; i++) celdas.push('<span class="dp-day is-outside"></span>');
    for (let d = 1; d <= diasEnMes; d++) {
      const f = new Date(anio, mes, d);
      const clases = ['dp-day'];
      if (f.getTime() === hoy.getTime()) clases.push('is-today');
      const marcado = modo === 'dia' && elegido && f.getTime() === elegido.getTime();
      if (marcado) clases.push('is-selected');
      // En Rendimiento no se elige una semana que aún no cierra.
      const sinCerrar = modo === 'semana' && soloCerrados() && !periodoCerrado('semana', f);
      if (sinCerrar) clases.push('is-disabled');
      celdas.push(`<button type="button" class="${clases.join(' ')}" data-fecha="${isoLocal(f)}" aria-label="${etiquetaDia(f)}"${marcado ? ' aria-pressed="true"' : ''}${sinCerrar ? ' disabled title="Esta semana aún no cierra"' : ''}>${d}</button>`);
    }
    let cuadricula = celdas.join('');
    if (modo === 'semana') {
      // Cada fila es una semana: se resalta completa y se elige con un toque.
      while (celdas.length % 7) celdas.push('<span class="dp-day is-outside"></span>');
      cuadricula = '';
      for (let i = 0; i < celdas.length; i += 7) {
        const fila = celdas.slice(i, i + 7);
        const primera = fila.map(c => /data-fecha="([^"]+)"/.exec(c)).find(Boolean);
        const lunes = primera ? lunesDeSemana(parseIsoLocal(primera[1])) : null;
        const elegida = lunes && lunes.getTime() === lunesElegido;
        cuadricula += `<div class="dp-semana-fila${elegida ? ' is-semana-elegida' : ''}" role="row">${fila.join('')}</div>`;
      }
    }
    return `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav="-1" aria-label="Mes anterior"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <button type="button" class="dp-titulo" data-accion="meses" aria-label="${etiquetaMes(mesVisible)}, elegir otro mes">${etiquetaMes(mesVisible)}<ion-icon name="chevron-down-outline" aria-hidden="true"></ion-icon></button>
        <button type="button" class="dp-nav" data-nav="1" aria-label="Mes siguiente"><ion-icon name="chevron-forward-outline"></ion-icon></button>
      </div>
      <div class="dp-weekdays">${DIAS_SEMANA_CORTO.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="dp-grid${modo === 'semana' ? ' dp-grid--semanas' : ''}">${cuadricula}</div>
      ${modo === 'semana' ? '<p class="dp-ayuda">Toca cualquier día para elegir su semana (lunes a domingo).</p>' : ''}`;
  }

  function htmlMeses() {
    const p = obtener();
    const hoy = new Date();
    const elegido = p.tipo === 'mes' ? parseIsoLocal(p.fecha) : null;
    const botones = MESES.map((nombre, i) => {
      const clases = ['dp-mes'];
      if (anioVisible === hoy.getFullYear() && i === hoy.getMonth()) clases.push('is-actual');
      const activo = elegido && elegido.getFullYear() === anioVisible && elegido.getMonth() === i;
      if (activo) clases.push('is-selected');
      const sinCerrar = p.tipo === 'mes' && soloCerrados() && !periodoCerrado('mes', new Date(anioVisible, i, 1));
      return `<button type="button" class="${clases.join(' ')}" data-mes="${i}" aria-label="${nombre} ${anioVisible}"${activo ? ' aria-pressed="true"' : ''}${sinCerrar ? ' disabled title="Este mes aún no cierra"' : ''}>${nombre.slice(0, 3)}</button>`;
    }).join('');
    return `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav-anio="-1" aria-label="Año anterior"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <span class="dp-month-label">${anioVisible}</span>
        <button type="button" class="dp-nav" data-nav-anio="1" aria-label="Año siguiente"><ion-icon name="chevron-forward-outline"></ion-icon></button>
      </div>
      <div class="dp-meses">${botones}</div>`;
  }

  function pintar2(enfocar) {
    const p = obtener();
    panel.innerHTML = vista === 'dias' ? htmlDias(p.tipo) : htmlMeses();
    panel.setAttribute('aria-label', { dia: 'Elegir día', semana: 'Elegir semana', mes: 'Elegir mes' }[p.tipo] || 'Elegir período');
    panel.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
      mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + Number(b.dataset.nav), 1);
      pintar2();
      panel.querySelector(`[data-nav="${b.dataset.nav}"]`).focus();
    }));
    panel.querySelectorAll('[data-nav-anio]').forEach(b => b.addEventListener('click', () => {
      anioVisible += Number(b.dataset.navAnio);
      pintar2();
      panel.querySelector(`[data-nav-anio="${b.dataset.navAnio}"]`).focus();
    }));
    panel.querySelectorAll('.dp-day[data-fecha]').forEach(b => b.addEventListener('click', () => elegir(parseIsoLocal(b.dataset.fecha))));
    panel.querySelectorAll('.dp-mes').forEach(b => b.addEventListener('click', () => elegir(new Date(anioVisible, Number(b.dataset.mes), 1))));
    const titulo = panel.querySelector('[data-accion="meses"]');
    if (titulo) titulo.addEventListener('click', () => { anioVisible = mesVisible.getFullYear(); vista = 'meses'; pintar2(true); });
    if (enfocar) {
      for (const selector of ['.is-selected', '.is-semana-elegida .dp-day[data-fecha]', '.is-today', '.is-actual', '.dp-day[data-fecha], .dp-mes']) {
        const objetivo = panel.querySelector(selector);
        if (objetivo) { objetivo.focus(); break; }
      }
    }
  }

  function posicionar() {
    const rect = etiqueta.getBoundingClientRect();
    const ancho = panel.offsetWidth;
    let left = rect.left;
    if (left + ancho > window.innerWidth - 12) left = Math.max(12, window.innerWidth - ancho - 12);
    panel.style.top = `${rect.bottom + 6}px`;
    panel.style.left = `${left}px`;
  }

  etiqueta.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel) { cerrar(true); return; }
    const p = obtener();
    if (p.tipo === 'hoy' || p.tipo === 'rango') return;
    registrarPanelFechaActivo(api);
    mesVisible = primerDiaDelMes(parseIsoLocal(p.fecha) || new Date());
    anioVisible = mesVisible.getFullYear();
    vista = p.tipo === 'mes' ? 'meses' : 'dias';
    panel = document.createElement('div');
    panel.className = 'date-picker-panel panel-periodo';
    panel.setAttribute('role', 'dialog');
    document.body.appendChild(panel);
    pintar2(true);
    posicionar();
    etiqueta.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeydown, true);
    setTimeout(() => document.addEventListener('click', onClickFuera, true), 0);
  });

  pintar();
  return { pintar, cerrar: () => cerrar(false) };
}
