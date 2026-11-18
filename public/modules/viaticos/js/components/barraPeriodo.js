// Barra de período (copia adaptada de la de Reportes de Vales): Hoy · Día · Semana · Mes · Desde–Hasta.
// Un control segmentado elige el tipo; al lado, flechas ‹ › y una etiqueta que abre el calendario del tipo elegido. El rango usa dos campos de fecha.
import { hoyMedianoche, isoLocal, parseIsoLocal, primerDiaDelMes, sumarDiaLocal } from '../utils/fechas.js';
import { t } from '../textos.js';
import {
  MESES, DIAS_SEMANA_CORTO, htmlCampoFechaCompacto, wireCampoFecha, registrarPanelFechaActivo, liberarPanelFechaActivo
} from './datepicker.js';

const TIPOS = ['hoy', 'dia', 'semana', 'mes', 'rango'];

const DIAS_ABREV = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// «mar 13 oct 2026»
export function etiquetaDia(fecha) {
  return `${DIAS_ABREV[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()].slice(0, 3).toLowerCase()} ${fecha.getFullYear()}`;
}

export function etiquetaMes(fecha) {
  return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

const corto = (f) => `${f.getDate()} ${MESES[f.getMonth()].slice(0, 3).toLowerCase()}`;

export const lunesDeSemana = (f) => sumarDiaLocal(new Date(f.getFullYear(), f.getMonth(), f.getDate()), -((f.getDay() + 6) % 7));

export function etiquetaSemana(f) {
  const lunes = lunesDeSemana(f);
  const domingo = sumarDiaLocal(lunes, 6);
  return `${corto(lunes)} – ${corto(domingo)} ${domingo.getFullYear()}`;
}

// Etiqueta legible del período elegido.
export function etiquetaDelPeriodo(p) {
  const f = parseIsoLocal(p.fecha) || hoyMedianoche();
  if (p.tipo === 'hoy') return t('periodo.etiquetaHoy', { dia: etiquetaDia(hoyMedianoche()) });
  if (p.tipo === 'dia') return etiquetaDia(f);
  if (p.tipo === 'semana') return etiquetaSemana(f);
  if (p.tipo === 'mes') return etiquetaMes(f);
  return t('periodo.etiquetaRango');
}

// `obtener()` devuelve el período vigente; `alCambiar(nuevo)` lo recibe y debe llamar a `pintar()` de la barra.
// `prefijo` hace únicos los ids y nombres de campo si hubiera dos barras en la página.
export function crearBarraPeriodo(contenedor, { obtener, alCambiar, prefijo = 'rp' }) {
  const idNavegador = `${prefijo}-navegador`;
  const idEtiqueta = `${prefijo}-etiqueta`;
  const idRango = `${prefijo}-rango`;
  const campoDesde = `${prefijo}-desde`;
  const campoHasta = `${prefijo}-hasta`;
  contenedor.innerHTML = `
    <div class="rp-segmentos" role="group" aria-label="${t('periodo.tipoAria')}">
      ${TIPOS.map(tipo => `<button type="button" class="rp-segmento" data-tipo="${tipo}" aria-pressed="false">${t(`periodo.tipo.${tipo}`)}</button>`).join('')}
    </div>
    <div class="rp-navegador" id="${idNavegador}">
      <button type="button" class="rp-flecha" data-paso="-1" aria-label="${t('periodo.anterior')}"><ion-icon name="chevron-back-outline"></ion-icon></button>
      <button type="button" class="rp-etiqueta" id="${idEtiqueta}" aria-haspopup="dialog" aria-expanded="false"><ion-icon name="calendar-outline" aria-hidden="true"></ion-icon><span></span></button>
      <button type="button" class="rp-flecha" data-paso="1" aria-label="${t('periodo.siguiente')}"><ion-icon name="chevron-forward-outline"></ion-icon></button>
    </div>
    <div class="rp-rango" id="${idRango}">
      ${htmlCampoFechaCompacto(campoDesde, t('periodo.desde'))}<span class="rp-guion" aria-hidden="true">–</span>${htmlCampoFechaCompacto(campoHasta, t('periodo.hasta'))}
    </div>`;
  const navegador = contenedor.querySelector(`#${idNavegador}`);
  const etiqueta = contenedor.querySelector(`#${idEtiqueta}`);
  const rango = contenedor.querySelector(`#${idRango}`);
  const apiDesde = wireCampoFecha(rango, campoDesde, { placeholder: t('periodo.desde') });
  const apiHasta = wireCampoFecha(rango, campoHasta, { placeholder: t('periodo.hasta') });

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
      cambiar({ tipo, fecha: tipo === 'hoy' ? isoLocal(hoy) : (p.fecha || isoLocal(hoy)) });
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
    if (d > h) { window.toast?.error(t('periodo.titulo'), t('periodo.errorOrden')); return; }
    cambiar({ tipo: 'rango', desde: isoLocal(d), hasta: isoLocal(h) });
  };
  rango.querySelector(`[data-date-field="${campoDesde}"] input[type="hidden"]`).addEventListener('change', alCambiarRango);
  rango.querySelector(`[data-date-field="${campoHasta}"] input[type="hidden"]`).addEventListener('change', alCambiarRango);

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
      celdas.push(`<button type="button" class="${clases.join(' ')}" data-fecha="${isoLocal(f)}" aria-label="${etiquetaDia(f)}"${marcado ? ' aria-pressed="true"' : ''}>${d}</button>`);
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
        <button type="button" class="dp-nav" data-nav="-1" aria-label="${t('periodo.mesAnterior')}"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <button type="button" class="dp-titulo" data-accion="meses" aria-label="${t('periodo.elegirOtroMes', { mes: etiquetaMes(mesVisible) })}">${etiquetaMes(mesVisible)}<ion-icon name="chevron-down-outline" aria-hidden="true"></ion-icon></button>
        <button type="button" class="dp-nav" data-nav="1" aria-label="${t('periodo.mesSiguiente')}"><ion-icon name="chevron-forward-outline"></ion-icon></button>
      </div>
      <div class="dp-weekdays">${DIAS_SEMANA_CORTO.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="dp-grid${modo === 'semana' ? ' dp-grid--semanas' : ''}">${cuadricula}</div>
      ${modo === 'semana' ? `<p class="dp-ayuda">${t('periodo.ayudaSemana')}</p>` : ''}`;
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
      return `<button type="button" class="${clases.join(' ')}" data-mes="${i}" aria-label="${nombre} ${anioVisible}"${activo ? ' aria-pressed="true"' : ''}>${nombre.slice(0, 3)}</button>`;
    }).join('');
    return `
      <div class="dp-header">
        <button type="button" class="dp-nav" data-nav-anio="-1" aria-label="${t('periodo.anioAnterior')}"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <span class="dp-month-label">${anioVisible}</span>
        <button type="button" class="dp-nav" data-nav-anio="1" aria-label="${t('periodo.anioSiguiente')}"><ion-icon name="chevron-forward-outline"></ion-icon></button>
      </div>
      <div class="dp-meses">${botones}</div>`;
  }

  function pintarPanel(enfocar) {
    const p = obtener();
    panel.innerHTML = vista === 'dias' ? htmlDias(p.tipo) : htmlMeses();
    panel.setAttribute('aria-label', t(`periodo.elegir.${p.tipo}`));
    panel.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
      mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + Number(b.dataset.nav), 1);
      pintarPanel();
      panel.querySelector(`[data-nav="${b.dataset.nav}"]`).focus();
    }));
    panel.querySelectorAll('[data-nav-anio]').forEach(b => b.addEventListener('click', () => {
      anioVisible += Number(b.dataset.navAnio);
      pintarPanel();
      panel.querySelector(`[data-nav-anio="${b.dataset.navAnio}"]`).focus();
    }));
    panel.querySelectorAll('.dp-day[data-fecha]').forEach(b => b.addEventListener('click', () => elegir(parseIsoLocal(b.dataset.fecha))));
    panel.querySelectorAll('.dp-mes').forEach(b => b.addEventListener('click', () => elegir(new Date(anioVisible, Number(b.dataset.mes), 1))));
    const titulo = panel.querySelector('[data-accion="meses"]');
    if (titulo) titulo.addEventListener('click', () => { anioVisible = mesVisible.getFullYear(); vista = 'meses'; pintarPanel(true); });
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
    panel.className = 'date-picker-panel';
    panel.setAttribute('role', 'dialog');
    document.body.appendChild(panel);
    pintarPanel(true);
    posicionar();
    etiqueta.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeydown, true);
    setTimeout(() => document.addEventListener('click', onClickFuera, true), 0);
  });

  pintar();
  return { pintar, cerrar: () => cerrar(false) };
}
