// Barra de período de Reportes: Hoy · Día · Semana · Mes · Desde–Hasta.
// Un control segmentado elige el tipo; debajo, flechas ‹ › y una etiqueta que abre el calendario del tipo elegido
// (día, semana o mes). El rango usa dos campos de fecha. Reusa el aspecto del calendario de los formularios (.dp-*).
// Con `cargarInfoMes` el calendario del modo Día muestra información por día (cupo o cantidad de vales) y, al elegir un día,
// ofrece «Ver vales de este día» (`alVerVales`) y «Ver reporte de este día» (`alVerReporte`).
import { hoyMedianoche, isoLocal, parseIsoLocal, primerDiaDelMes, sumarDiaLocal } from '../utils/fechas.js';
import {
  MESES, DIAS_SEMANA_CORTO, htmlCampoFechaCompacto, wireCampoFecha, registrarPanelFechaActivo, liberarPanelFechaActivo
} from './datepicker.js';

const TIPOS = [
  { id: 'hoy', texto: 'Hoy' },
  { id: 'dia', texto: 'Día' },
  { id: 'semana', texto: 'Semana' },
  { id: 'mes', texto: 'Mes' },
  { id: 'rango', texto: 'Desde – Hasta' }
];

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
// `prefijo` (opcional) hace únicos los ids y nombres de campo cuando hay dos barras en la página; sin él se usan los de Reportes.
export function crearBarraPeriodo(contenedor, {
  obtener, alCambiar, soloCerrados = () => false, prefijo = null, cargarInfoMes = null, alVerReporte = null, alVerVales = null
}) {
  const idNavegador = `${prefijo || 'rp'}-navegador`;
  const idEtiqueta = `${prefijo || 'rp'}-etiqueta`;
  const idRango = `${prefijo || 'rp'}-rango`;
  const campoDesde = `${prefijo || 'rep'}-desde`;
  const campoHasta = `${prefijo || 'rep'}-hasta`;
  const conInfo = typeof cargarInfoMes === 'function';
  contenedor.innerHTML = `
    <div class="rp-segmentos" role="group" aria-label="Tipo de período">
      ${TIPOS.map(t => `<button type="button" class="rp-segmento" data-tipo="${t.id}" aria-pressed="false">${t.texto}</button>`).join('')}
    </div>
    <div class="rp-navegador" id="${idNavegador}">
      <button type="button" class="rp-flecha" data-paso="-1" aria-label="Período anterior"><ion-icon name="chevron-back-outline"></ion-icon></button>
      <button type="button" class="rp-etiqueta" id="${idEtiqueta}" aria-haspopup="dialog" aria-expanded="false"><ion-icon name="calendar-outline" aria-hidden="true"></ion-icon><span></span></button>
      <button type="button" class="rp-flecha" data-paso="1" aria-label="Período siguiente"><ion-icon name="chevron-forward-outline"></ion-icon></button>
    </div>
    <div class="rp-rango" id="${idRango}">
      ${htmlCampoFechaCompacto(campoDesde, 'Desde')}<span class="rp-guion" aria-hidden="true">–</span>${htmlCampoFechaCompacto(campoHasta, 'Hasta')}
    </div>`;
  const navegador = contenedor.querySelector(`#${idNavegador}`);
  const etiqueta = contenedor.querySelector(`#${idEtiqueta}`);
  const rango = contenedor.querySelector(`#${idRango}`);
  const apiDesde = wireCampoFecha(rango, campoDesde, { placeholder: 'Desde' });
  const apiHasta = wireCampoFecha(rango, campoHasta, { placeholder: 'Hasta' });

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
  rango.querySelector(`[data-date-field="${campoDesde}"] input[type="hidden"]`).addEventListener('change', alCambiarRango);
  rango.querySelector(`[data-date-field="${campoHasta}"] input[type="hidden"]`).addEventListener('change', alCambiarRango);

  // ---- Calendario del tipo elegido (día, semana o mes) ----
  let panel = null;
  let vista = 'dias';
  let mesVisible = new Date();
  let anioVisible = mesVisible.getFullYear();
  let info = null; // respuesta del servidor para el mes visible: { tipo: 'cupo' | 'conteo' | null, ... }
  let infoToken = 0;
  let previa = null; // día marcado (ISO) cuando hay información por día
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
    infoToken++;
    info = null;
    previa = null;
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
      ${conInfo && modo === 'dia' ? '<div class="dp-info" id="dp-info" aria-live="polite"></div>' : ''}
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
    const conInfoDia = conInfo && p.tipo === 'dia' && vista === 'dias';
    panel.classList.toggle('panel-periodo--info', conInfoDia);
    panel.querySelectorAll('.dp-day[data-fecha]').forEach(b => {
      if (!conInfoDia) { b.addEventListener('click', () => elegir(parseIsoLocal(b.dataset.fecha))); return; }
      b.addEventListener('click', () => previsualizar(b.dataset.fecha));
      b.addEventListener('mouseenter', () => mostrarInfo(b.dataset.fecha, false));
      b.addEventListener('focus', () => mostrarInfo(b.dataset.fecha, false));
      b.addEventListener('mouseleave', () => mostrarInfo(previa, true));
      b.addEventListener('blur', () => mostrarInfo(previa, true));
    });
    if (conInfoDia) { mostrarInfo(previa, true); cargarInfo(); }
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

  // ---- Información por día (cupo o cantidad de vales) ----
  const NIVELES = {
    disponible: { texto: 'Con cupo', clase: 'dp-day--disponible' },
    moderado: { texto: 'Medio', clase: 'dp-day--moderado' },
    critico: { texto: 'Casi lleno', clase: 'dp-day--critico' },
    lleno: { texto: 'Lleno', clase: 'dp-day--agotado' }
  };
  const ORDEN_NIVEL = ['disponible', 'moderado', 'critico', 'lleno'];
  const nivelDeTaller = (t) => {
    if (t.programados >= t.limite) return 'lleno';
    const pct = t.programados / t.limite;
    return pct >= 0.9 ? 'critico' : (pct >= 0.6 ? 'moderado' : 'disponible');
  };
  const nivelDelDia = (dia) => dia.talleres.map(nivelDeTaller).sort((a, b) => ORDEN_NIVEL.indexOf(b) - ORDEN_NIVEL.indexOf(a))[0];
  const nombreTaller = (id) => ((info.talleres || []).find(t => t.id === id) || {}).nombre || `Taller ${id}`;
  const esFinDeSemana = (iso) => [0, 6].includes(parseIsoLocal(iso).getDay());

  async function cargarInfo() {
    const token = ++infoToken;
    info = null;
    try {
      const respuesta = await cargarInfoMes(mesVisible.getFullYear(), mesVisible.getMonth() + 1);
      if (token !== infoToken || !panel) return;
      info = respuesta;
    } catch {
      if (token !== infoToken || !panel) return;
      info = { tipo: null }; // sin la información, el calendario sigue usable
    }
    aplicarInfo();
    mostrarInfo(previa, true);
  }

  // Pinta cada celda del mes con la información recibida (sin volver a construir la cuadrícula).
  function aplicarInfo() {
    if (!info || !info.tipo) return;
    const maximo = info.tipo === 'conteo' ? Math.max(1, ...Object.values(info.dias || {})) : 0;
    panel.querySelectorAll('.dp-day[data-fecha]').forEach(boton => {
      const iso = boton.dataset.fecha;
      if (info.tipo === 'cupo') {
        const dia = info.dias[iso];
        if (!dia || !dia.talleres.length || (esFinDeSemana(iso) && !dia.talleres.some(t => t.programados || t.pendientes))) return;
        const nivel = nivelDelDia(dia);
        const pendientes = dia.talleres.reduce((s, t) => s + t.pendientes, 0);
        boton.classList.add('tiene-info', NIVELES[nivel].clase);
        boton.insertAdjacentHTML('beforeend', `<span class="dp-day-barras" aria-hidden="true">${dia.talleres.map(t => `<span class="dp-pista"><i class="dp-barra dp-barra--${nivelDeTaller(t)}" style="width:${Math.min(100, Math.round(t.programados / t.limite * 100))}%"></i></span>`).join('')}</span>${pendientes ? `<span class="dp-day-mas" aria-hidden="true">+${pendientes}</span>` : ''}`);
      } else {
        const n = info.dias[iso] || 0;
        if (!n) return;
        boton.classList.add('tiene-info', `dp-day--c${Math.max(1, Math.ceil(n / maximo * 4))}`);
        boton.insertAdjacentHTML('beforeend', `<span class="dp-day-n" aria-hidden="true">${n}</span>`);
      }
      boton.setAttribute('aria-label', `${boton.getAttribute('aria-label')}: ${textoPlano(iso)}`);
    });
  }

  function textoPlano(iso) {
    if (!info || !info.tipo) return '';
    if (info.tipo === 'conteo') { const n = info.dias[iso] || 0; return `${n} ${n === 1 ? 'vale' : 'vales'}`; }
    const dia = info.dias[iso];
    return dia ? dia.talleres.map(t => `${nombreTaller(t.tallerId)} ${t.programados} de ${t.limite}`).join('; ') : '';
  }

  // Detalle del día en el pie del calendario; con `conAcciones` ofrece ver los vales o abrir el reporte de ese día.
  function mostrarInfo(iso, conAcciones) {
    const cont = panel && panel.querySelector('#dp-info');
    if (!cont) return;
    if (!iso) {
      cont.innerHTML = info && !info.tipo ? '' : '<p class="dp-info-ayuda">Elige un día para ver su detalle.</p>';
      return;
    }
    const titulo = `<p class="dp-info-titulo">${etiquetaDia(parseIsoLocal(iso))}</p>`;
    let cuerpo = '';
    if (!info) cuerpo = '<p class="dp-info-ayuda">Cargando…</p>';
    else if (info.tipo === 'conteo') {
      const n = info.dias[iso] || 0;
      cuerpo = n || !esFinDeSemana(iso)
        ? `<p class="dp-info-cifra"><b>${n}</b> ${n === 1 ? 'vale' : 'vales'} con entrega este día</p>`
        : '<p class="dp-info-ayuda">Fin de semana: sin entregas.</p>';
    } else if (info.tipo === 'cupo') {
      const dia = info.dias[iso];
      cuerpo = dia && dia.talleres.length && !(esFinDeSemana(iso) && !dia.talleres.some(t => t.programados || t.pendientes))
        ? `<ul class="dp-info-lista">${dia.talleres.map(t => {
          const nivel = nivelDeTaller(t);
          const libres = Math.max(0, t.limite - t.programados);
          return `<li><span class="dp-info-taller">${nombreTaller(t.tallerId)}</span><span class="dp-info-cupo dp-info-cupo--${nivel}">${t.programados}/${t.limite} · ${libres > 0 ? `${libres} ${libres === 1 ? 'libre' : 'libres'}` : 'Lleno'}</span>${t.pendientes ? `<span class="dp-info-pend">+${t.pendientes} por autorizar</span>` : ''}</li>`;
        }).join('')}</ul>`
        : (esFinDeSemana(iso) ? '<p class="dp-info-ayuda">Fin de semana: sin entregas.</p>' : '<p class="dp-info-ayuda">Sin talleres con límite este día.</p>');
    }
    const botones = (alVerVales ? '<button type="button" class="btn btn--primary btn--sm" data-accion="ver-dia">Ver vales de este día</button>' : '')
      + (alVerReporte ? '<button type="button" class="btn btn--ghost btn--sm" data-accion="ver-reporte">Ver reporte de este día</button>' : '');
    const acciones = conAcciones && iso === previa && botones ? `<div class="dp-info-acciones">${botones}</div>` : '';
    cont.innerHTML = titulo + cuerpo + acciones;
    const verDia = cont.querySelector('[data-accion="ver-dia"]');
    if (verDia) verDia.addEventListener('click', () => { cerrar(true); alVerVales(iso); });
    const verReporte = cont.querySelector('[data-accion="ver-reporte"]');
    if (verReporte) verReporte.addEventListener('click', () => { cerrar(false); alVerReporte(iso); });
  }

  function previsualizar(iso) {
    previa = iso;
    panel.querySelectorAll('.dp-day.is-previa').forEach(b => b.classList.remove('is-previa'));
    const boton = panel.querySelector(`.dp-day[data-fecha="${iso}"]`);
    if (boton) boton.classList.add('is-previa');
    mostrarInfo(iso, true);
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
