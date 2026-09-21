import { state } from '../state.js';
import { ROL } from '../config/roles.js';
import { $, $$ } from '../utils/dom.js';
import { claseEstado, etiquetaEstado } from '../permisos.js';
import { escapeHtml, formatearFecha, celdaTaller } from '../utils/formato.js';
import { obtenerRendimientoGerencia } from '../api/valesApi.js';
import { abrirModalHistorial } from '../actions/historial.js';
import { fmtNum, fmtPct, fmtDias, sparkline, graficaLineas, conectarTooltips, ocultarTooltip } from '../components/charts.js';

// -----------------------------------------------------------------------
// Vista Rendimiento (Gerencia): lectura de un vistazo de cuánto cumple el
// sistema con las fechas de entrega y dónde se demora. Los filtros de
// período y tienda son los de la barra superior (state.ventana/tiendaId) y
// escopan TODO lo de abajo; nada aquí tiene filtros propios salvo el cambio
// Talleres/Tiendas del ranking.
// -----------------------------------------------------------------------
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MUESTRA_BAJA_TEXTO = 'Menos de 5 vales cerrados: dato poco representativo.';

let graficaTendencia = null;
let pedidoVigente = 0;
let ultimaData = null;
let tabDesempeno = 'talleres';
const vistaTabla = { tendencia: false, ciclo: false, encurso: false };

function construirQuery() {
  const qs = new URLSearchParams();
  if (state.ventana.tipo) qs.set('ventana', state.ventana.tipo);
  if (state.ventana.tipo === 'rango') {
    if (state.ventana.desde) qs.set('desde', state.ventana.desde);
    if (state.ventana.hasta) qs.set('hasta', state.ventana.hasta);
  }
  if (state.tiendaId) qs.set('tiendaId', state.tiendaId);
  return qs;
}

let temporizadorEnVivo = null;

// Refresco por eventos de tiempo real: con rebote (varios eventos seguidos
// disparan una sola recarga) y sin atenuar la vista — el usuario la está mirando.
export function actualizarRendimientoEnVivo() {
  const cont = $('#rendimiento-gerencia');
  if (!cont || !cont.dataset.wired) return;
  clearTimeout(temporizadorEnVivo);
  temporizadorEnVivo = setTimeout(() => cargarRendimientoGerencia({ silencioso: true }), 2000);
}

export async function cargarRendimientoGerencia({ silencioso = false } = {}) {
  const cont = $('#rendimiento-gerencia');
  armarEsqueleto(cont);
  const pedido = ++pedidoVigente;
  const cuerpo = $('#rend-cuerpo', cont);
  // Recarga: se conserva el marco anterior atenuado (sin saltos de layout);
  // solo la primera carga muestra el mensaje de espera.
  if (ultimaData && !silencioso) cuerpo.classList.add('is-refetching');
  try {
    const data = await obtenerRendimientoGerencia(construirQuery());
    if (pedido !== pedidoVigente) return;
    ultimaData = data;
    cuerpo.classList.remove('is-refetching');
    renderTodo(data);
  } catch (error) {
    if (pedido !== pedidoVigente) return;
    cuerpo.classList.remove('is-refetching');
    if (silencioso) return;
    if (!ultimaData) {
      cuerpo.innerHTML = `
        <div class="buzon-vacio buzon-vacio-error">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <h3>No se pudo cargar el rendimiento</h3>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn--ghost btn--sm" id="rend-reintentar">Reintentar</button>
        </div>`;
      $('#rend-reintentar', cuerpo).addEventListener('click', () => cargarRendimientoGerencia());
    } else {
      window.toast?.error('Rendimiento', error.message);
    }
  }
}

function armarEsqueleto(cont) {
  if (cont.dataset.wired) return;
  cont.innerHTML = `
    <div class="rend-encabezado">
      <div>
        <h2>Rendimiento de vales de arte</h2>
        <p class="rend-meta" id="rend-meta"></p>
      </div>
      <button class="btn btn--ghost btn--sm" id="rend-actualizar" type="button">
        <ion-icon name="refresh-outline"></ion-icon> Actualizar
      </button>
    </div>
    <div class="rend-cuerpo" id="rend-cuerpo">
      <div class="buzon-vacio"><ion-icon name="sync-outline" class="spin-animation"></ion-icon><p>Calculando rendimiento...</p></div>
    </div>`;
  $('#rend-actualizar', cont).addEventListener('click', () => cargarRendimientoGerencia());
  cont.dataset.wired = '1';
}

// -----------------------------------------------------------------------
// Formato
// -----------------------------------------------------------------------
function nombreTienda(id) {
  const tiendas = state.catalogos.tiendasGerencia || state.catalogos.tiendas || [];
  return (tiendas.find(t => t.id === id) || {}).nombre || `Tienda #${id}`;
}

function etiquetaPeriodo(data) {
  const { tipo, desde, hasta } = data.ventana;
  let texto;
  if (tipo === 'todo') texto = 'Todo el historial';
  else if (tipo === 'dia') texto = `Día ${formatearFecha(hasta)}`;
  else if (tipo === 'semana') texto = `Semana del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`;
  else if (tipo === 'mes') texto = `Mes de ${MESES[Number(desde.slice(5, 7)) - 1]} ${desde.slice(0, 4)}`;
  else texto = `${formatearFecha(desde)} — ${formatearFecha(hasta)}`;
  return state.tiendaId ? `${texto} · ${nombreTienda(Number(state.tiendaId))}` : texto;
}

function etiquetasEje(data) {
  return data.tendencia.map(t => {
    if (data.granularidad === 'mes') return `${MESES[Number(t.inicio.slice(5, 7)) - 1]} ${t.inicio.slice(2, 4)}`;
    return `${t.inicio.slice(8, 10)}/${t.inicio.slice(5, 7)}`;
  });
}

function titulosFecha(data) {
  return data.tendencia.map(t => {
    let titulo;
    if (data.granularidad === 'mes') titulo = `${MESES[Number(t.inicio.slice(5, 7)) - 1]} ${t.inicio.slice(0, 4)}`;
    else if (data.granularidad === 'semana') titulo = `Semana del ${formatearFecha(t.inicio)}`;
    else titulo = formatearFecha(t.inicio);
    return t.parcial ? `${titulo} · en curso` : titulo;
  });
}

function tip(titulo, filas) {
  return escapeHtml(JSON.stringify({ titulo, filas }));
}

// Variación contra el período anterior. `bueno`: true si subir es bueno,
// false si bajar es bueno, null si es solo volumen (sin juicio de valor).
function variacion(actual, previo, tipo, bueno) {
  if (actual == null || previo == null) return '';
  let diff;
  let texto;
  if (tipo === 'pct') {
    if (previo === 0) return '';
    diff = ((actual - previo) / previo) * 100;
    texto = `${Math.abs(Math.round(diff))}%`;
  } else if (tipo === 'pp') {
    diff = actual - previo;
    texto = `${fmtNum(Math.abs(diff), 1)} pp`;
  } else {
    diff = actual - previo;
    texto = `${fmtNum(Math.abs(diff), 1)} d`;
  }
  const igual = Math.abs(diff) < 0.05;
  const sube = diff > 0;
  const tono = igual || bueno === null ? 'neutro' : (sube === bueno ? 'bueno' : 'malo');
  const icono = igual ? 'remove-outline' : (sube ? 'trending-up-outline' : 'trending-down-outline');
  return `<span class="rend-delta rend-delta--${tono}"><ion-icon name="${icono}"></ion-icon>${igual ? 'Sin cambio' : texto}<span class="rend-delta-ref"> vs período anterior</span></span>`;
}

// -----------------------------------------------------------------------
// Render
// -----------------------------------------------------------------------
function renderTodo(data) {
  ocultarTooltip();
  if (graficaTendencia) { graficaTendencia.destruir(); graficaTendencia = null; }
  $('#rend-meta').textContent = `${etiquetaPeriodo(data)} · Actualizado ${new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
  $('#rend-cuerpo').innerHTML = `
    <section class="rend-kpis" aria-label="Indicadores clave">${htmlKpis(data)}</section>
    <div class="rend-grid">
      <section class="rend-panel rend-span-8" id="rend-panel-tendencia"></section>
      <section class="rend-panel rend-span-4" id="rend-panel-ciclo"></section>
      <section class="rend-panel rend-span-7" id="rend-panel-desempeno"></section>
      <section class="rend-panel rend-span-5" id="rend-panel-encurso"></section>
      <section class="rend-panel rend-span-12" id="rend-panel-criticos"></section>
    </div>
    <details class="rend-notas">
      <summary>Cómo se calculan estas métricas</summary>
      <ul>
        <li><strong>Entregados a tiempo:</strong> vales cerrados (confirmados por el asesor) que no tuvieron atraso, sobre el total de vales cerrados. El atraso se mide contra la fecha de entrega del vale.</li>
        <li><strong>Atrasados ahora:</strong> vales todavía en curso cuya fecha de entrega ya pasó.</li>
        <li><strong>Ciclo promedio:</strong> días desde la creación del vale hasta su confirmación.</li>
        <li><strong>Con modificación:</strong> vales originales que pidieron una modificación, sobre el total de vales originales (no cuenta los vales MOD-).</li>
        <li><strong>Desempeño por taller:</strong> un vale que pasa por varios talleres cuenta en cada uno; el cumplimiento es el del vale completo.</li>
        <li><strong>Variación:</strong> se compara contra el período inmediatamente anterior de igual duración; con «Todo» no hay comparación.</li>
      </ul>
    </details>`;
  renderTendencia(data);
  renderCiclo(data);
  renderDesempeno(data);
  renderEnCurso(data);
  renderCriticos(data);
}

function htmlKpis(data) {
  const a = data.kpis.actual;
  const p = data.kpis.anterior;
  const serie = (clave) => data.tendencia.map(t => t[clave]);
  const pctAtrasados = a.enCurso ? Math.round((a.atrasadosAhora / a.enCurso) * 100) : null;
  const tiles = [
    {
      hero: true, etiqueta: 'Entregados a tiempo', valor: fmtPct(a.aTiempoPct),
      sub: a.cerrados ? `de ${fmtNum(a.cerrados)} vales cerrados` : 'Aún sin vales cerrados',
      delta: variacion(a.aTiempoPct, p && p.aTiempoPct, 'pp', true), spark: sparkline(serie('aTiempoMovilPct'))
    },
    {
      etiqueta: 'Vales creados', valor: fmtNum(a.creados), sub: `${fmtNum(a.enCurso)} siguen en curso`,
      delta: variacion(a.creados, p && p.creados, 'pct', null), spark: sparkline(serie('creados'))
    },
    {
      alerta: a.atrasadosAhora > 0, etiqueta: 'Atrasados ahora', valor: fmtNum(a.atrasadosAhora),
      sub: a.enCurso ? `${pctAtrasados}% de los vales en curso` : 'Sin vales en curso', delta: '', spark: ''
    },
    {
      etiqueta: 'Ciclo promedio', valor: fmtDias(a.cicloDias), sub: 'de la creación a la confirmación',
      delta: variacion(a.cicloDias, p && p.cicloDias, 'dias', false), spark: sparkline(serie('cicloMovilDias'))
    },
    {
      etiqueta: 'Con modificación', valor: fmtPct(a.modificadosPct),
      sub: a.originales ? `de ${fmtNum(a.originales)} vales originales` : 'Sin vales originales',
      delta: variacion(a.modificadosPct, p && p.modificadosPct, 'pp', false), spark: ''
    }
  ];
  return tiles.map(t => `
    <article class="rend-kpi${t.hero ? ' rend-kpi--hero' : ''}${t.alerta ? ' rend-kpi--alerta' : ''}">
      <p class="rend-kpi-etiqueta">${t.etiqueta}</p>
      <p class="rend-kpi-valor">${t.alerta ? '<ion-icon name="alert-circle" aria-hidden="true"></ion-icon>' : ''}${t.valor}</p>
      <p class="rend-kpi-sub">${t.sub}</p>
      <div class="rend-kpi-pie">${t.delta}${t.spark}</div>
    </article>`).join('');
}

function cabeceraPanel(titulo, subtitulo, { tabla = null, extra = '' } = {}) {
  const boton = tabla ? `
    <button class="rend-toggle-tabla" type="button" data-panel="${tabla}" aria-pressed="${vistaTabla[tabla]}" title="Alternar entre gráfica y tabla">
      <ion-icon name="${vistaTabla[tabla] ? 'bar-chart-outline' : 'grid-outline'}"></ion-icon>
      <span>${vistaTabla[tabla] ? 'Ver gráfica' : 'Ver tabla'}</span>
    </button>` : '';
  return `<header class="rend-panel-cab"><div><h3>${titulo}</h3><p>${subtitulo}</p></div>${extra}${boton}</header>`;
}

function conectarToggleTabla(panelEl, clave, volverARenderizar) {
  const btn = panelEl.querySelector('.rend-toggle-tabla');
  if (!btn) return;
  btn.addEventListener('click', () => { vistaTabla[clave] = !vistaTabla[clave]; volverARenderizar(ultimaData); });
}

function cuerpoDual(clave, htmlGrafica, htmlTabla) {
  return `
    <div class="rend-vista-grafica"${vistaTabla[clave] ? ' hidden' : ''}>${htmlGrafica}</div>
    <div class="rend-vista-tabla"${vistaTabla[clave] ? '' : ' hidden'}>${htmlTabla}</div>`;
}

function vacio(icono, titulo, texto, ok = false) {
  return `<div class="rend-vacio${ok ? ' rend-vacio--ok' : ''}"><ion-icon name="${icono}"></ion-icon><h4>${titulo}</h4><p>${texto}</p></div>`;
}

// --- Tendencia: creados vs cerrados -----------------------------------
function renderTendencia(data) {
  const panel = $('#rend-panel-tendencia');
  if (graficaTendencia) { graficaTendencia.destruir(); graficaTendencia = null; }
  const unidad = { dia: 'día', semana: 'semana', mes: 'mes' }[data.granularidad];
  const parcial = data.tendencia.length > 0 && data.tendencia[data.tendencia.length - 1].parcial;
  const cab = cabeceraPanel('Actividad de vales', `Vales creados y cerrados por ${unidad}${parcial ? ' · el último tramo punteado aún está en curso' : ''}`, { tabla: 'tendencia' });
  if (data.tendencia.length < 3) {
    panel.innerHTML = cab + vacio('trending-up-outline', 'Período muy corto para una tendencia', 'Elige Semana, Mes o Todo en la barra superior para ver cómo evoluciona la actividad.');
    conectarToggleTabla(panel, 'tendencia', renderTendencia);
    return;
  }
  const titulos = titulosFecha(data);
  const filas = data.tendencia.map((t, i) => `
    <tr><td>${titulos[i]}</td><td>${fmtNum(t.creados)}</td><td>${fmtNum(t.cerrados)}</td><td>${fmtPct(t.aTiempoPct)}</td><td>${fmtDias(t.cicloDias)}</td></tr>`).join('');
  const tabla = `<div class="rend-tabla-wrap"><table class="rend-tabla"><thead><tr><th>${unidad[0].toUpperCase() + unidad.slice(1)}</th><th>Creados</th><th>Cerrados</th><th>A tiempo</th><th>Ciclo</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  const leyenda = `
    <ul class="rend-leyenda" aria-label="Series">
      <li><span class="rend-llave" style="background:var(--color-primary)"></span>Creados</li>
      <li><span class="rend-llave" style="background:var(--color-secondary)"></span>Cerrados</li>
    </ul>`;
  panel.innerHTML = cab + cuerpoDual('tendencia', `${leyenda}<div class="rend-chart" id="rend-chart-tendencia"></div>`, tabla);
  conectarToggleTabla(panel, 'tendencia', renderTendencia);
  if (!vistaTabla.tendencia) {
    graficaTendencia = graficaLineas($('#rend-chart-tendencia', panel), {
      fechasTitulo: titulosFecha(data),
      etiquetasX: etiquetasEje(data),
      ariaLabel: `Vales creados y cerrados por ${unidad}`,
      ultimoParcial: parcial,
      series: [
        { etiqueta: 'Creados', color: 'var(--color-primary)', valores: data.tendencia.map(t => t.creados), formato: fmtNum },
        { etiqueta: 'Cerrados', color: 'var(--color-secondary)', valores: data.tendencia.map(t => t.cerrados), formato: fmtNum }
      ]
    });
  }
}

// --- Ciclo de vida: días promedio por etapa ----------------------------
function renderCiclo(data) {
  const panel = $('#rend-panel-ciclo');
  const etapas = data.etapasCiclo;
  const conDatos = etapas.filter(e => e.dias != null);
  const cab = cabeceraPanel('¿Dónde se demora un vale?', 'Días promedio por etapa', { tabla: 'ciclo' });
  if (!conDatos.length) {
    panel.innerHTML = cab + vacio('time-outline', 'Aún no hay etapas completadas', 'Aparecerá cuando los vales del período avancen por el flujo.');
    conectarToggleTabla(panel, 'ciclo', renderCiclo);
    return;
  }
  const maximo = Math.max(...conDatos.map(e => e.dias));
  const mayor = conDatos.length > 1 ? conDatos.find(e => e.dias === maximo).clave : null;
  const grafica = `<ol class="rend-etapas">${etapas.map((e, i) => {
    if (e.dias == null) {
      return `<li class="rend-etapa"><span class="rend-etapa-nombre">${e.label}</span><span class="rend-etapa-sin">Sin datos</span></li>`;
    }
    const ancho = Math.max(2, (e.dias / maximo) * 100);
    const datosTip = tip(e.label, [{ etiqueta: 'Promedio', valor: fmtDias(e.dias) }, { etiqueta: 'Vales', valor: fmtNum(e.n) }]);
    return `
      <li class="rend-etapa" tabindex="0" data-tip="${datosTip}">
        <span class="rend-etapa-nombre">${e.label}${e.clave === mayor ? '<span class="rend-etiqueta-max">Mayor demora</span>' : ''}</span>
        <span class="rend-barra-h"><span class="rend-barra-relleno" style="width:${ancho}%;background:var(--rend-ord-${i + 1})"></span></span>
        <strong class="rend-etapa-valor">${fmtDias(e.dias)}</strong>
      </li>`;
  }).join('')}</ol>
  <p class="rend-pie">Solo cuenta vales que ya completaron cada etapa.</p>`;
  const tabla = `<div class="rend-tabla-wrap"><table class="rend-tabla"><thead><tr><th>Etapa</th><th>Días promedio</th><th>Vales</th></tr></thead><tbody>${
    etapas.map(e => `<tr><td>${e.label}</td><td>${fmtDias(e.dias)}</td><td>${fmtNum(e.n)}</td></tr>`).join('')}</tbody></table></div>`;
  panel.innerHTML = cab + cuerpoDual('ciclo', grafica, tabla);
  conectarToggleTabla(panel, 'ciclo', renderCiclo);
  conectarTooltips(panel);
}

// --- Desempeño por taller / tienda --------------------------------------
function renderDesempeno(data) {
  const panel = $('#rend-panel-desempeno');
  const esTaller = tabDesempeno === 'talleres';
  const lista = esTaller ? data.talleres : data.tiendas;
  const tabs = `
    <div class="rend-tabs" role="tablist" aria-label="Ver desempeño por">
      <button class="chip${esTaller ? ' chip-active' : ''}" role="tab" aria-selected="${esTaller}" data-tab="talleres" type="button">Talleres</button>
      <button class="chip${esTaller ? '' : ' chip-active'}" role="tab" aria-selected="${!esTaller}" data-tab="tiendas" type="button">Tiendas</button>
    </div>`;
  const cab = cabeceraPanel(`Desempeño por ${esTaller ? 'taller' : 'tienda'}`, 'De menor a mayor cumplimiento · las muestras pequeñas van al final', { extra: tabs });
  let cuerpo;
  if (!lista.length && esTaller && state.user.rolId === ROL.SUPERVISOR) {
    cuerpo = vacio('file-tray-outline', 'Sin talleres para mostrar', 'Las tiendas que supervisas no tienen talleres con vales en este período.');
  } else if (!lista.length) {
    cuerpo = vacio('file-tray-outline', 'Sin vales en el período', `No hay vales asignados a ${esTaller ? 'talleres' : 'tiendas'} con los filtros actuales.`);
  } else {
    const filas = lista.map(r => {
      const nombre = esTaller ? r.nombre : nombreTienda(r.id);
      const cumple = r.aTiempoPct == null
        ? '<span class="rend-sin">Sin cierres aún</span>'
        : `<div class="rend-cumpl${r.muestraBaja ? ' rend-cumpl--baja' : ''}" ${r.muestraBaja ? `title="${MUESTRA_BAJA_TEXTO}"` : ''}>
             <span class="rend-barra-h"><span class="rend-barra-relleno" style="width:${Math.max(2, r.aTiempoPct)}%"></span></span>
             <strong class="rend-pct">${fmtPct(r.aTiempoPct)}</strong>${r.muestraBaja ? `<span class="rend-n">n=${r.cerrados}</span>` : ''}
           </div>`;
      const aTiempoN = Math.round(((r.aTiempoPct || 0) / 100) * r.cerrados);
      const datosTip = tip(nombre, [
        { etiqueta: 'Cerrados a tiempo', valor: r.cerrados ? `${fmtNum(aTiempoN)} de ${fmtNum(r.cerrados)}` : '—' },
        { etiqueta: 'Vales en el período', valor: fmtNum(r.vales) }
      ]);
      const atrasados = r.atrasados
        ? `<span class="rend-atrasados"><ion-icon name="alert-circle" aria-hidden="true"></ion-icon>${fmtNum(r.atrasados)}</span>`
        : '<span class="rend-cero">0</span>';
      return `
        <tr>
          <th scope="row" class="rend-nombre">${escapeHtml(nombre)}</th>
          <td class="rend-celda-barra" data-tip="${datosTip}" tabindex="0">${cumple}</td>
          <td class="rend-num">${fmtNum(r.vales)}</td>
          <td class="rend-num">${fmtNum(r.enCola)}</td>
          <td class="rend-num">${atrasados}</td>
          <td class="rend-num">${fmtDias(r.atrasoPromDias)}</td>
          ${esTaller ? '' : `<td class="rend-num">${fmtPct(r.modificadosPct)}</td>`}
        </tr>`;
    }).join('');
    cuerpo = `
      <div class="rend-tabla-wrap">
        <table class="rend-tabla rend-tabla--ranking">
          <thead><tr>
            <th>${esTaller ? 'Taller' : 'Tienda'}</th><th>Cumplimiento</th><th class="rend-num">Vales</th><th class="rend-num">En curso</th>
            <th class="rend-num">Atrasados</th><th class="rend-num">Atraso prom.</th>${esTaller ? '' : '<th class="rend-num">Modificados</th>'}
          </tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
      <p class="rend-pie">Cumplimiento = vales cerrados sin atraso. Atraso prom. = días de atraso promedio de los vales atrasados. Las barras atenuadas tienen menos de ${data.muestraMinima} cierres.</p>`;
  }
  panel.innerHTML = cab + cuerpo;
  $$('.rend-tabs .chip', panel).forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.tab === tabDesempeno) return;
    tabDesempeno = btn.dataset.tab;
    renderDesempeno(ultimaData);
  }));
  conectarTooltips(panel);
}

// --- Vales en curso por etapa --------------------------------------------
function renderEnCurso(data) {
  const panel = $('#rend-panel-encurso');
  const etapas = data.enCurso;
  const total = etapas.reduce((s, e) => s + e.alDia + e.atrasados, 0);
  const cab = cabeceraPanel('Vales en curso', `${fmtNum(total)} en proceso · dónde están ahora`, { tabla: 'encurso' });
  if (!total) {
    panel.innerHTML = cab + vacio('checkmark-done-outline', 'Nada en curso', 'Todos los vales del período ya están cerrados.', true);
    conectarToggleTabla(panel, 'encurso', renderEnCurso);
    return;
  }
  const maximo = Math.max(...etapas.map(e => e.alDia + e.atrasados));
  const leyenda = `
    <ul class="rend-leyenda" aria-label="Series">
      <li><span class="rend-llave rend-llave--caja" style="background:var(--color-primary)"></span>Al día</li>
      <li><span class="rend-llave rend-llave--caja" style="background:var(--color-danger)"></span><ion-icon name="alert-circle" class="rend-icono-atraso" aria-hidden="true"></ion-icon>Atrasados</li>
    </ul>`;
  const grafica = `${leyenda}<ol class="rend-etapas rend-etapas--apiladas">${etapas.map(e => {
    const suma = e.alDia + e.atrasados;
    const datosTip = tip(e.label, [
      { color: 'var(--color-primary)', etiqueta: 'Al día', valor: fmtNum(e.alDia) },
      { color: 'var(--color-danger)', etiqueta: 'Atrasados', valor: fmtNum(e.atrasados) },
      { etiqueta: 'Total', valor: fmtNum(suma) }
    ]);
    const anchoDia = (e.alDia / maximo) * 100;
    const anchoAtr = (e.atrasados / maximo) * 100;
    return `
      <li class="rend-etapa" tabindex="0" data-tip="${datosTip}">
        <span class="rend-etapa-nombre">${e.label}</span>
        <span class="rend-barra-h rend-barra-h--apilada">
          ${e.alDia ? `<span class="rend-seg rend-seg--dia" style="width:${anchoDia}%"></span>` : ''}
          ${e.atrasados ? `<span class="rend-seg rend-seg--atraso" style="width:${anchoAtr}%"></span>` : ''}
        </span>
        <strong class="rend-etapa-valor">${fmtNum(suma)}${e.atrasados ? `<span class="rend-atrasados"><ion-icon name="alert-circle" aria-hidden="true"></ion-icon>${fmtNum(e.atrasados)}</span>` : ''}</strong>
      </li>`;
  }).join('')}</ol>`;
  const tabla = `<div class="rend-tabla-wrap"><table class="rend-tabla"><thead><tr><th>Etapa</th><th class="rend-num">Al día</th><th class="rend-num">Atrasados</th><th class="rend-num">Total</th></tr></thead><tbody>${
    etapas.map(e => `<tr><td>${e.label}</td><td class="rend-num">${fmtNum(e.alDia)}</td><td class="rend-num">${fmtNum(e.atrasados)}</td><td class="rend-num">${fmtNum(e.alDia + e.atrasados)}</td></tr>`).join('')}</tbody></table></div>`;
  panel.innerHTML = cab + cuerpoDual('encurso', grafica, tabla);
  conectarToggleTabla(panel, 'encurso', renderEnCurso);
  conectarTooltips(panel);
}

// --- Vales críticos ----------------------------------------------------------
function renderCriticos(data) {
  const panel = $('#rend-panel-criticos');
  const criticos = data.criticos;
  const cab = cabeceraPanel('Vales atrasados para atender primero', criticos.length ? `Los ${criticos.length} con mayor atraso que siguen en curso` : 'Vales en curso con la fecha de entrega vencida');
  if (!criticos.length) {
    panel.innerHTML = cab + vacio('checkmark-circle-outline', 'Sin vales atrasados en curso', 'Todos los vales activos están dentro de su fecha de entrega.', true);
    return;
  }
  panel.innerHTML = `${cab}
    <div class="tabla-wrapper">
      <table class="buzon-table data-table">
        <thead><tr><th>Correlativo</th><th>Tienda</th><th class="col-taller">Taller</th><th>Fecha Entrega</th><th>Atraso</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody id="rend-criticos-tbody">${criticos.map(v => `
          <tr>
            <td data-label="Correlativo"><strong>${escapeHtml(v.correlativo)}</strong>${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}</td>
            <td data-label="Tienda">${escapeHtml(nombreTienda(v.tienda_id))}</td>
            <td data-label="Taller" class="col-taller">${celdaTaller({ taller: escapeHtml(v.taller || '') })}</td>
            <td data-label="Fecha Entrega">${formatearFecha(v.fecha_entrega)}</td>
            <td data-label="Atraso">${v.venceHoy ? '<span class="badge badge-hoy">Hoy</span>' : `<span class="badge badge-atraso">${v.diasAtraso}d</span>`}</td>
            <td data-label="Estado"><span class="estado-pill ${claseEstado(v)}">${escapeHtml(etiquetaEstado(v))}</span></td>
            <td data-label="Acciones" class="acciones-cell" data-vale-id="${v.id}"></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  criticos.forEach(v => {
    const celda = panel.querySelector(`.acciones-cell[data-vale-id="${v.id}"]`);
    const wrap = document.createElement('div');
    wrap.className = 'acciones-wrap';
    celda.appendChild(wrap);
    [
      { icono: 'eye-outline', titulo: 'Ver vale de arte (PDF)', onClick: () => window.open(`/api/vales/${v.id}/pdf`, '_blank') },
      { icono: 'time-outline', titulo: 'Ver historial', onClick: () => abrirModalHistorial(v) }
    ].forEach(accion => {
      const btn = document.createElement('button');
      btn.className = 'btn-icon';
      btn.title = accion.titulo;
      btn.setAttribute('aria-label', accion.titulo);
      btn.innerHTML = `<ion-icon name="${accion.icono}"></ion-icon>`;
      btn.addEventListener('click', accion.onClick);
      wrap.appendChild(btn);
    });
  });
}
