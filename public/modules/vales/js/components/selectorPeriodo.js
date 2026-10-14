// Panel del selector de período de la barra: dos niveles, como un calendario normal. Los días filtran un
// solo día; el título del mes abre una cuadrícula de meses con flechas de año y elegir uno filtra todo el mes.
// Reusa el aspecto del calendario de los formularios (.date-picker-panel, .dp-*).
// Con `cargarInfoMes` (Supervisor, Diseñador y Encargado) cada día muestra información: el cupo de los talleres con límite
// o la cantidad de vales; entonces elegir un día lo marca y el pie ofrece «Ver vales de este día» y «Ver reporte de este día».
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
// `cargarInfoMes(anio, mes)` (opcional) devuelve la información por día; `alVerReporte(fechaIso)` (opcional) abre Reportes en ese día.
export function wireSelectorPeriodo(trigger, { obtener, alElegir, cargarInfoMes = null, alVerReporte = null }) {
  const conInfo = typeof cargarInfoMes === 'function';
  let info = null; // respuesta del servidor para el mes visible: { tipo: 'cupo' | 'conteo' | null, ... }
  let infoToken = 0;
  let previa = null; // día marcado (ISO) cuando hay información por día
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
    infoToken++;
    info = null;
    previa = null;
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
      ${conInfo ? '<div class="dp-info" id="dp-info" aria-live="polite"></div>' : ''}
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
    panel.classList.toggle('panel-periodo--info', conInfo && vista === 'dias');
    panel.querySelectorAll('.dp-day[data-fecha]').forEach(b => {
      if (!conInfo) { b.addEventListener('click', () => elegir('dia', parseIsoLocal(b.dataset.fecha))); return; }
      b.addEventListener('click', () => previsualizar(b.dataset.fecha));
      b.addEventListener('mouseenter', () => mostrarInfo(b.dataset.fecha, false));
      b.addEventListener('focus', () => mostrarInfo(b.dataset.fecha, false));
      b.addEventListener('mouseleave', () => mostrarInfo(previa, true));
      b.addEventListener('blur', () => mostrarInfo(previa, true));
    });
    if (conInfo && vista === 'dias') { mostrarInfo(previa, true); cargarInfo(); }
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

  // Detalle del día en el pie del calendario; con `acciones` ofrece filtrar el Buzón o abrir el reporte de ese día.
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
    const acciones = conAcciones && iso === previa
      ? `<div class="dp-info-acciones"><button type="button" class="btn btn--primary btn--sm" data-accion="ver-dia">Ver vales de este día</button>${alVerReporte ? '<button type="button" class="btn btn--ghost btn--sm" data-accion="ver-reporte">Ver reporte de este día</button>' : ''}</div>`
      : '';
    cont.innerHTML = titulo + cuerpo + acciones;
    const verDia = cont.querySelector('[data-accion="ver-dia"]');
    if (verDia) verDia.addEventListener('click', () => elegir('dia', parseIsoLocal(iso)));
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
