// Pestaña «Reportes»: inversión autorizada por solicitante y reparto por categoría de una ventana de tiempo, en una moneda; se imprime en PDF.
// Solo cuenta lo AUTORIZADO (el servidor ya lo garantiza); lo liquidado no se muestra en ningún lado.
import { state } from '../state.js';
import { h, icono, montar } from '../utils/dom.js';
import { obtenerOpcionesReportes, obtenerReportes, urlPdfReportes } from '../api/viaticosApi.js';
import { crearBarraPeriodo } from '../components/barraPeriodo.js';
import { crearCombo } from '../components/comboAgrupado.js';
import { htmlRanking, htmlTablaSolicitantes } from '../components/barrasRanking.js';
import { htmlPastel, htmlLeyenda } from '../components/graficoPastel.js';
import { aplicarPeriodoAConsulta, periodoInicial } from '../utils/periodo.js';
import { escapeHtml, formatearDinero } from '../utils/formato.js';
import { t } from '../textos.js';

// Referencias de la vista abierta: una respuesta que llega con la vista ya cerrada (nodos desconectados) se descarta.
let vista = null;
let opciones = null;
let datos = null;
let numeroCarga = 0;

const seleccion = () => state.seleccionReportes;
const consultaActual = () => ({ ...aplicarPeriodoAConsulta(state.ventanaReportes), ...seleccion() });
const vistaViva = () => vista && vista.cuerpo.isConnected;

// Un solo bloque (cargando, vacío o error) que reemplaza el cuerpo del informe.
function bloqueEstado(nombreIcono, titulo, texto, { error = false, spinner = false, reintentar = false } = {}) {
  const nodoIcono = icono(nombreIcono);
  if (spinner) nodoIcono.classList.add('spin-animation');
  return h('div', { class: `buzon-vacio${error ? ' buzon-vacio-error' : ''}`, role: error ? 'alert' : null },
    nodoIcono,
    titulo && h('h3', { text: titulo }),
    texto && h('p', { text: texto }),
    reintentar && h('button', { class: 'btn btn--primary btn--sm', type: 'button', text: t('comun.reintentar'), onclick: () => cargarTodo() }));
}

const tarjeta = (clave, valor) => `<div class="vi-rep-tarjeta"><span class="vi-rep-tarjeta__rotulo">${escapeHtml(t(`reportes.resumen.${clave}`))}</span><strong class="vi-rep-tarjeta__valor">${escapeHtml(valor)}</strong></div>`;

function htmlResumen(d) {
  const s = d.moneda.simbolo;
  return tarjeta('total', formatearDinero(s, d.resumen.total)) + tarjeta('solicitudes', String(d.resumen.solicitudes))
    + tarjeta('solicitantes', String(d.resumen.solicitantes)) + tarjeta('promedio', formatearDinero(s, d.resumen.promedio));
}

function htmlInversion(d) {
  const contexto = { simbolo: d.moneda.simbolo, seleccionadoId: seleccion().solicitanteId };
  return `<h2 id="vi-rep-inversion-titulo">${escapeHtml(t('reportes.ranking.titulo'))}</h2>${htmlRanking(d.solicitantes, contexto)}
    <div class="vi-rep-tabla-zona" tabindex="0" role="region" aria-label="${escapeHtml(t('reportes.tablaAria'))}">${htmlTablaSolicitantes(d.solicitantes, d.resumen, contexto)}</div>`;
}

function opcionesSolicitante(d) {
  return [{ valor: '', texto: t('reportes.reparto.todos') }, ...d.solicitantes.map(s => ({ valor: s.solicitanteId, texto: s.nombre }))];
}

// El selector y el botón del reparto viven en la cabecera de la sección; se rehacen en cada pintado.
function pintarReparto() {
  const { reparto: zona, cabeceraReparto } = vista;
  const { reparto, moneda } = datos;
  const alcance = reparto.alcance && reparto.alcance.nombre ? reparto.alcance.nombre : t('reportes.reparto.alcanceTodos');
  const combo = crearCombo({
    id: 'vi-rep-ver-de', etiquetaAria: t('reportes.reparto.verDe'), grupos: [{ opciones: opcionesSolicitante(datos) }],
    valor: seleccion().solicitanteId, alCambiar: (valor) => elegirSolicitante(valor)
  });
  const quitar = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'vi-rep-quitar', text: t('reportes.reparto.quitar'), hidden: seleccion().solicitanteId === '', onclick: () => elegirSolicitante('') });
  montar(cabeceraReparto,
    h('h2', { text: t('reportes.reparto.titulo') }),
    h('div', { class: 'vi-rep-ver-de' }, h('label', { for: 'vi-rep-ver-de', text: t('reportes.reparto.verDe') }), combo, quitar));
  zona.innerHTML = `<p class="vi-rep-alcance">${escapeHtml(t('reportes.reparto.alcance', { alcance }))}</p>
    <div class="vi-rep-reparto__cuerpo"><div class="vi-rep-reparto__grafico">${htmlPastel({ categorias: reparto.categorias, total: reparto.total, simbolo: moneda.simbolo, alcance })}</div>
    <div class="vi-rep-tabla-zona" tabindex="0" role="region" aria-label="${escapeHtml(t('reportes.reparto.tablaAria'))}">${htmlLeyenda(reparto.categorias, moneda.simbolo)}</div></div>`;
}

function pintarInforme() {
  vista.resumen.innerHTML = htmlResumen(datos);
  vista.inversion.innerHTML = htmlInversion(datos);
  pintarReparto();
  montar(vista.cuerpo, vista.informe);
}

function pintarFiltros() {
  const { moneda, pais } = vista.combos;
  const monedas = opciones.monedas.map(m => ({ valor: m.id, texto: `${m.nombre} (${m.codigo})` }));
  const paises = opciones.paises.map(p => ({ valor: p.id, texto: p.nombre }));
  const nuevoMoneda = crearCombo({ id: 'vi-rep-moneda', etiquetaAria: t('reportes.moneda'), grupos: [{ opciones: monedas }], valor: seleccion().monedaId, deshabilitado: monedas.length === 0, alCambiar: alCambiarMoneda });
  const nuevoPais = crearCombo({ id: 'vi-rep-pais', etiquetaAria: t('reportes.pais'), placeholder: t('reportes.todosPaises'), grupos: [{ opciones: paises }], valor: seleccion().paisId, deshabilitado: monedas.length === 0, alCambiar: alCambiarPais });
  moneda.replaceWith(nuevoMoneda);
  pais.replaceWith(nuevoPais);
  vista.combos = { moneda: nuevoMoneda, pais: nuevoPais };
}

const contiene = (lista, id) => id !== '' && lista.some(x => Number(x.id) === Number(id));

// La selección guardada sobrevive a los cambios de pestaña, pero se reinicia si ya no existe en las opciones de esta ventana.
function reconciliarOpciones() {
  const s = seleccion();
  if (!contiene(opciones.monedas, s.monedaId)) s.monedaId = opciones.monedaPorDefecto == null ? '' : opciones.monedaPorDefecto;
  if (!contiene(opciones.paises, s.paisId)) s.paisId = '';
}

// Carga completa: opciones de la ventana y luego el informe. Un cambio de ventana o «Reintentar» pasan por aquí.
export async function cargarTodo() {
  if (!vistaViva()) return;
  const numero = ++numeroCarga;
  montar(vista.cuerpo, bloqueEstado('sync-outline', null, t('reportes.cargando'), { spinner: true }));
  try {
    const nuevasOpciones = await obtenerOpcionesReportes(aplicarPeriodoAConsulta(state.ventanaReportes));
    if (numero !== numeroCarga || !vistaViva()) return;
    opciones = nuevasOpciones;
    reconciliarOpciones();
    pintarFiltros();
    await cargarInforme(numero);
  } catch (error) {
    mostrarError(numero, error);
  }
}

function mostrarError(numero, error) {
  if (numero !== numeroCarga || !vistaViva()) return;
  datos = null;
  montar(vista.cuerpo, bloqueEstado('alert-circle-outline', t('reportes.error.titulo'), error.message, { error: true, reintentar: true }));
}

async function cargarInforme(numero) {
  if (!seleccion().monedaId) {
    datos = null;
    montar(vista.cuerpo, bloqueEstado('bar-chart-outline', t('reportes.vacio.titulo'), t('reportes.vacio.texto')));
    return;
  }
  let respuesta = await obtenerReportes(consultaActual());
  if (numero !== numeroCarga || !vistaViva()) return;
  // Un solicitante elegido que ya no aparece en el resultado se quita y el reparto se pide de nuevo para todos.
  const elegido = seleccion().solicitanteId;
  if (elegido !== '' && !respuesta.solicitantes.some(s => Number(s.solicitanteId) === Number(elegido))) {
    seleccion().solicitanteId = '';
    respuesta = await obtenerReportes(consultaActual());
    if (numero !== numeroCarga || !vistaViva()) return;
  }
  datos = respuesta;
  if (datos.solicitantes.length === 0) {
    montar(vista.cuerpo, bloqueEstado('bar-chart-outline', t('reportes.vacio.titulo'), t('reportes.vacio.texto')));
    return;
  }
  pintarInforme();
}

// Moneda o país: se pide solo el informe (las opciones dependen de la ventana, no de ellos).
async function recargarInforme() {
  if (!vistaViva()) return;
  const numero = ++numeroCarga;
  montar(vista.cuerpo, bloqueEstado('sync-outline', null, t('reportes.cargando'), { spinner: true }));
  try {
    await cargarInforme(numero);
  } catch (error) {
    mostrarError(numero, error);
  }
}

function alCambiarMoneda(valor) { seleccion().monedaId = valor; recargarInforme(); }
function alCambiarPais(valor) { seleccion().paisId = valor; recargarInforme(); }

// Elegir un solicitante solo cambia el alcance del reparto: el resumen y el ranking no se mueven, solo se resaltan.
async function elegirSolicitante(valor) {
  if (!datos || !vistaViva()) return;
  const id = valor === '' ? '' : Number(valor);
  const anterior = seleccion().solicitanteId;
  // Pulsar de nuevo al ya elegido lo quita.
  seleccion().solicitanteId = id !== '' && id === anterior ? '' : id;
  const numero = ++numeroCarga;
  vista.informe.classList.add('is-actualizando');
  try {
    const respuesta = await obtenerReportes(consultaActual());
    if (numero !== numeroCarga || !vistaViva()) return;
    datos = { ...datos, reparto: respuesta.reparto };
    vista.informe.classList.remove('is-actualizando');
    pintarInforme();
  } catch (error) {
    if (numero !== numeroCarga || !vistaViva()) return;
    seleccion().solicitanteId = anterior;
    vista.informe.classList.remove('is-actualizando');
    pintarInforme();
    window.toast?.error(t('reportes.titulo'), error.message);
  }
}

function alPulsarInforme(evento) {
  const objetivo = evento.target.closest('[data-solicitante-id]');
  if (objetivo && vista.inversion.contains(objetivo)) elegirSolicitante(objetivo.dataset.solicitanteId);
}

// El PDF lo arma el servidor con los mismos filtros de la pantalla; se abre en otra pestaña para no perder lo que se ve.
function imprimir() {
  const ventana = window.open(urlPdfReportes(consultaActual()), '_blank', 'noopener');
  if (!ventana) window.toast?.error(t('reportes.titulo'), t('reportes.imprimirError'));
}

export function renderReportes(contenedor) {
  if (vista && vista.barra) vista.barra.cerrar();
  state.ventanaReportes = state.ventanaReportes || periodoInicial();
  state.seleccionReportes = state.seleccionReportes || { monedaId: '', paisId: '', solicitanteId: '' };
  opciones = null;
  datos = null;

  const barraPeriodo = h('div', { class: 'rp-barra rp-barra--toolbar', id: 'vi-rep-periodo-barra' });
  const moneda = h('select', { id: 'vi-rep-moneda', 'aria-label': t('reportes.moneda') });
  const pais = h('select', { id: 'vi-rep-pais', 'aria-label': t('reportes.pais') });
  const campo = (id, rotulo, combo) => h('div', { class: 'vi-rep-campo' }, h('label', { for: id, text: rotulo }), combo);
  const filtros = h('div', { class: 'vi-rep-filtros', id: 'vi-rep-filtros' }, campo('vi-rep-moneda', t('reportes.moneda'), moneda), campo('vi-rep-pais', t('reportes.pais'), pais));
  const botonFiltros = h('button', { class: 'btn btn--ghost vi-rep-btn-filtros', type: 'button', id: 'vi-rep-filtros-boton', 'aria-expanded': 'false', 'aria-controls': 'vi-rep-filtros' },
    icono('options-outline'), h('span', { text: t('reportes.filtros') }));
  botonFiltros.addEventListener('click', () => {
    const abierto = filtros.classList.toggle('is-abierto');
    botonFiltros.setAttribute('aria-expanded', String(abierto));
  });
  const botonImprimir = h('button', { class: 'btn btn--primary vi-rep-btn-imprimir', type: 'button', id: 'vi-rep-imprimir', 'aria-label': t('reportes.imprimirAria'), onclick: imprimir },
    icono('print-outline'), h('span', { class: 'vi-rep-btn-imprimir__texto', text: t('reportes.imprimir') }));

  const resumen = h('div', { class: 'vi-rep-resumen', 'aria-live': 'polite' });
  const inversion = h('section', { class: 'vi-seccion vi-rep-seccion', 'aria-labelledby': 'vi-rep-inversion-titulo' });
  const cabeceraReparto = h('div', { class: 'vi-rep-reparto__cabecera' });
  const reparto = h('div', { class: 'vi-rep-reparto' });
  const informe = h('div', { class: 'vi-rep-informe', onclick: alPulsarInforme },
    resumen, inversion, h('section', { class: 'vi-seccion vi-rep-seccion', 'aria-label': t('reportes.reparto.titulo') }, cabeceraReparto, reparto));
  const cuerpo = h('div', { class: 'vi-rep-cuerpo' });

  montar(contenedor, h('div', { class: 'vi-rep' },
    h('div', { class: 'vi-rep-barra' }, barraPeriodo, filtros, botonFiltros, botonImprimir),
    cuerpo));

  vista = { cuerpo, informe, resumen, inversion, reparto, cabeceraReparto, combos: { moneda, pais }, barra: null };
  const cambiarPeriodo = (periodo) => { state.ventanaReportes = periodo; vista.barra.pintar(); cargarTodo(); };
  vista.barra = crearBarraPeriodo(barraPeriodo, { prefijo: 'vr', obtener: () => state.ventanaReportes, alCambiar: cambiarPeriodo });

  return cargarTodo();
}
