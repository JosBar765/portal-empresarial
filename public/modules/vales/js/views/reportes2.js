import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { crearBarraPeriodo } from '../components/barraPeriodoReportes.js';
import { CATALOGO, etiquetaNumerada } from './reportes2/catalogo.js';
import { TEXTOS as T } from './reportes2/textos.js';
import { tienePermiso } from '../permisos.js';
import { obtenerOpcionesReporte } from '../api/valesApi.js';
import { ErrorReporte } from '../api/errorReporte.js';
import { crearUnaALaVez } from '../utils/unaALaVez.js';
import { restaurarFiltrosReportes2, guardarFiltrosReportes2, reiniciarFiltrosReportes2, claveReporteDe } from '../utils/filtrosReportes2.js';

// -----------------------------------------------------------------------
// Reportes: contenedor de reportes. Un combo elige el reporte, cuyos filtros propios se piden al servidor; con la ventana de tiempo
// se llega a «Generar», el único botón que consulta el reporte (más «Ver el mes completo» y el salto a otro reporte, que generan al instante).
// Cambiar un filtro o la ventana solo marca el resultado como viejo. Los reportes se registran en reportes2/catalogo.js.
// -----------------------------------------------------------------------
// Los filtros guardados son por usuario: se restauran al abrir la pestaña (y antes de que «Ver reporte de este día» fije su ventana), cuando ya se conoce al usuario.

let barraPeriodo = null;
// Cada contador descarta la respuesta tardía de una petición ya superada.
let pedidoVigente = 0;
let pedidoOpciones = 0;
let montadoId = ''; // reporte cuyos filtros están pedidos o montados
let opciones = null; // opciones de filtro del reporte elegido, ya recibidas
let generando = false;
let pdfEnCurso = false;
// Idempotencia: pedir lo mismo mientras ya se está haciendo devuelve esa misma operación (una sola consulta); una vez terminada, volver a pedir sí consulta de nuevo.
const unaGeneracion = crearUnaALaVez(() => pedidoVigente);
const unPdf = crearUnaALaVez();
let generado = null; // { reporteId, instantanea, periodo, datos } del resultado que se ve

// El reporte elegido sobrevive a recargar la página (preferencia local del navegador).
const leerReporteGuardado = () => { try { return localStorage.getItem(claveReporteDe()) || ''; } catch { return ''; } };
const guardarReporte = (id) => { try { localStorage.setItem(claveReporteDe(), id); } catch { /* sin almacenamiento: no se recuerda */ } };

// Solo los reportes cuyo permiso tiene la persona (el servidor lo exige igual).
const catalogoVisible = () => CATALOGO.filter(r => !r.permiso || tienePermiso(r.permiso));
const reporteElegido = () => catalogoVisible().find(r => r.id === state.reporte2.reporteId) || null;
const vista = () => $('#reportes2-vista');

// Ventana + query del reporte: si difiere de la que se generó, el resultado quedó viejo.
const instantaneaDe = (reporte) => JSON.stringify([state.reporte2.ventana, reporte.consulta({ ...state.reporte2.ventana })]);
const resultadoViejo = (reporte) => !!(reporte && opciones && generado && generado.reporteId === reporte.id && generado.instantanea !== instantaneaDe(reporte));

// Un fallo en el log del navegador con los mismos datos que la línea «[Reportes] ref=…» del servidor (sin filtros: pueden ser datos personales).
const normalizarError = (error, etapa, reporte) => (error instanceof ErrorReporte ? error : ErrorReporte.deCliente(error, { etapa, reporte }));
const registrarError = (e) => console.error('[Reportes]', { reporte: e.reporte, etapa: e.etapa, status: e.status, codigo: e.codigo, referencia: e.referencia, mensaje: e.message });
const infoError = (e) => {
  const info = T.errores[e.codigo] || T.errores.generico;
  return { titulo: info.titulo, texto: typeof info.texto === 'function' ? info.texto(e.reintentarEnSegundos) : info.texto };
};
const lineaReferencia = (e) => T.referencia(e.referencia, e.etapa);

function cambiarVentana(ventana) {
  state.reporte2.ventana = ventana;
  barraPeriodo.pintar();
  alCambiarFiltro();
}

// Filtros y ventana solo se recuerdan y marcan el resultado como viejo: no consultan.
function alCambiarFiltro() {
  guardarFiltrosReportes2();
  sincronizarControles();
}

// Un reporte puede llevar a otro (p. ej. del de tiendas al de asesores de una tienda): solo a los que la persona puede ver; conserva el período y genera.
const puedeIrA = (id) => catalogoVisible().some(r => r.id === id);
async function irAReporte(id) {
  if (!puedeIrA(id)) return false;
  state.reporte2.reporteId = id;
  guardarReporte(id);
  if (await seleccionarReporte()) await generar();
  return true;
}

// «Ver el mes completo» del resultado vacío: cambia la ventana y genera.
function verMes(ventana) {
  state.reporte2.ventana = ventana;
  barraPeriodo.pintar();
  guardarFiltrosReportes2();
  return generar();
}

const htmlEstado = (icono, titulo, texto, extra = '', modificador = '') => `
  <div class="rep-estado rep-estado--tarjeta${modificador}">
    <span class="rep-estado-icono"><ion-icon name="${icono}" aria-hidden="true"></ion-icon></span>
    <h4>${escapeHtml(titulo)}</h4>
    <p>${escapeHtml(texto)}</p>${extra}
  </div>`;

function armarShell(cont) {
  if (cont.dataset.wired) return;
  cont.innerHTML = `
    <div class="rend-encabezado">
      <div>
        <h2>${escapeHtml(T.titulo)}</h2>
        <p class="rend-meta">${escapeHtml(T.ayuda)}</p>
      </div>
      <div class="rep-acciones">
        <button class="btn btn--ghost btn--sm" id="rep2-actualizar" type="button"><ion-icon name="play-outline"></ion-icon> ${escapeHtml(T.generar)}</button>
        <button class="btn btn--ghost btn--sm" id="rep2-pdf" type="button"><ion-icon name="download-outline"></ion-icon> ${escapeHtml(T.descargarPdf)}</button>
      </div>
    </div>
    <div class="rep2-controles">
      <label class="rep2-combo">
        <span class="rep-filtro-rotulo">${escapeHtml(T.comboEtiqueta)}</span>
        <select id="rep2-combo" aria-label="${escapeHtml(T.comboEtiqueta)}">
          <option value="">${escapeHtml(T.comboVacio)}</option>
          ${catalogoVisible().map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(etiquetaNumerada(r))}</option>`).join('')}
        </select>
      </label>
      <div class="rp-barra" id="rep2-periodo"></div>
    </div>
    <div class="rep-filtros rep2-filtros" id="rep2-filtros" hidden></div>
    <p class="rep2-obsoleto" id="rep2-obsoleto" role="status" hidden><ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon> ${escapeHtml(T.obsoleto)}</p>
    <div class="rend-cuerpo" id="rep2-cuerpo" aria-live="polite"></div>`;
  barraPeriodo = crearBarraPeriodo($('#rep2-periodo', cont), {
    prefijo: 'rp2', // ids y campos propios: Reportes ya usa los de por defecto
    obtener: () => state.reporte2.ventana,
    alCambiar: cambiarVentana
  });
  $('#rep2-combo', cont).addEventListener('change', (e) => { state.reporte2.reporteId = e.target.value; guardarReporte(state.reporte2.reporteId); seleccionarReporte(); });
  $('#rep2-actualizar', cont).addEventListener('click', () => generar());
  $('#rep2-pdf', cont).addEventListener('click', descargarPdf);
  conectarBotonSubir(cont);
  cont.dataset.wired = '1';
}

// Botón flotante «Subir al inicio»: aparece al bajar un buen trecho y lleva arriba de una. Va en el body (no en la vista): el contenedor principal
// anima con `transform`, y eso hace que un `position: fixed` interior se mida contra él y no contra la ventana. Se oculta con la vista de Reportes.
const DISTANCIA_PARA_SUBIR = 400;
function conectarBotonSubir(vistaReportes) {
  if (document.getElementById('rep2-subir')) return;
  const boton = document.createElement('button');
  boton.type = 'button'; boton.id = 'rep2-subir'; boton.className = 'rep2-subir'; boton.hidden = true;
  boton.setAttribute('aria-label', T.subir); boton.title = T.subir;
  boton.innerHTML = '<ion-icon name="arrow-up-outline" aria-hidden="true"></ion-icon>';
  document.body.appendChild(boton);
  const actualizar = () => { boton.hidden = window.scrollY < DISTANCIA_PARA_SUBIR || getComputedStyle(vistaReportes).display === 'none'; };
  window.addEventListener('scroll', actualizar, { passive: true });
  new MutationObserver(actualizar).observe(vistaReportes, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  boton.addEventListener('click', () => {
    const sinAnimar = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: sinAnimar ? 'auto' : 'smooth' });
  });
}

// Los controles reflejan el estado: «Generar» se resalta cuando hay algo nuevo que generar; el PDF solo corresponde a un resultado al día.
function sincronizarControles() {
  const cont = vista();
  if (!cont || !cont.dataset.wired) return;
  const reporte = reporteElegido();
  const viejo = resultadoViejo(reporte);
  const combo = $('#rep2-combo', cont);
  if (combo.value !== (reporte ? reporte.id : '')) combo.value = reporte ? reporte.id : '';
  const boton = $('#rep2-actualizar', cont);
  boton.disabled = !reporte || !opciones || generando;
  const resaltar = !!reporte && !!opciones && (viejo || !generado);
  boton.classList.toggle('btn--primary', resaltar);
  boton.classList.toggle('btn--ghost', !resaltar);
  $('#rep2-obsoleto', cont).hidden = !viejo;
  $('#rep2-cuerpo', cont).classList.toggle('is-obsoleto', viejo);
  const pdf = $('#rep2-pdf', cont);
  pdf.disabled = !(reporte && reporte.pdf && generado && generado.reporteId === reporte.id && !viejo && !generando && !pdfEnCurso);
  pdf.title = !pdf.disabled ? '' : (!reporte ? T.pdfElegirReporte : (!reporte.pdf ? T.pdfSinSoporte : (viejo ? T.pdfObsoleto : T.pdfGenerarPrimero)));
}

function mostrarVacio() {
  const cuerpo = $('#rep2-cuerpo', vista());
  cuerpo.innerHTML = !reporteElegido()
    ? (catalogoVisible().length ? htmlEstado('analytics-outline', T.vacioTitulo, T.vacioTexto) : htmlEstado('analytics-outline', T.vacioTitulo, T.vacioSinCatalogo))
    : htmlEstado('play-circle-outline', T.sinGenerarTitulo, T.sinGenerarTexto);
}

// Rehace los selectores del reporte elegido con las opciones ya recibidas.
function montarFiltrosActuales() {
  const reporte = reporteElegido();
  if (reporte && opciones) reporte.montarFiltros($('#rep2-filtros', vista()), opciones, alCambiarFiltro);
}

function pintarErrorFiltros(zona, e) {
  const { titulo } = infoError(e);
  zona.innerHTML = `<div class="rep2-filtros-error" role="alert">
    <span>${escapeHtml(T.filtrosErrorTitulo)}: ${escapeHtml(titulo)}.</span>
    <button class="btn btn--ghost btn--sm" id="rep2-filtros-reintentar" type="button">${escapeHtml(T.reintentar)}</button>
    <small class="rep2-referencia">${escapeHtml(lineaReferencia(e))}</small>
  </div>`;
  $('#rep2-filtros-reintentar', zona).addEventListener('click', () => { const r = reporteElegido(); if (r) cargarOpciones(r); });
}

// Pide las opciones de filtro del reporte y monta sus selectores; sin ellas no se puede generar. Devuelve si quedaron listos.
async function cargarOpciones(reporte) {
  const zona = $('#rep2-filtros', vista());
  const pedido = ++pedidoOpciones;
  opciones = null;
  zona.hidden = false;
  zona.innerHTML = `<span class="rep2-filtros-estado" role="status">${escapeHtml(T.filtrosCargando)}</span>`;
  sincronizarControles();
  try {
    const datos = await obtenerOpcionesReporte(reporte.ruta);
    if (pedido !== pedidoOpciones) return false;
    opciones = datos;
    montarFiltrosActuales();
    guardarFiltrosReportes2(); // montar descarta lo guardado que ya no existe
    return true;
  } catch (error) {
    if (pedido !== pedidoOpciones) return false;
    opciones = null;
    const e = normalizarError(error, 'opciones', reporte.ruta);
    registrarError(e);
    pintarErrorFiltros(zona, e);
    return false;
  } finally {
    if (pedido === pedidoOpciones) sincronizarControles();
  }
}

// Elegir (o quitar) un reporte descarta el resultado anterior y pide los filtros del nuevo.
async function seleccionarReporte() {
  const reporte = reporteElegido();
  const cuerpo = $('#rep2-cuerpo', vista());
  pedidoVigente++; // cualquier generación en vuelo del reporte anterior ya no vale
  pedidoOpciones++;
  generando = false;
  generado = null;
  opciones = null;
  state.reporte2.contadorElegido = null; // el filtro por contador es de este resultado: otro reporte arranca sin él
  state.reporte2.urgenteElegido = false;
  montadoId = reporte ? reporte.id : '';
  cuerpo.removeAttribute('aria-busy');
  cuerpo.classList.remove('is-refetching', 'is-obsoleto');
  delete cuerpo.dataset.reporte;
  mostrarVacio();
  if (!reporte) {
    const zona = $('#rep2-filtros', vista());
    zona.hidden = true;
    zona.replaceChildren();
    sincronizarControles();
    return false;
  }
  return cargarOpciones(reporte);
}

export async function cargarReportes2() {
  restaurarFiltrosReportes2(); // idempotente: solo actúa la primera vez de cada usuario
  const cont = vista();
  armarShell(cont);
  barraPeriodo.pintar();
  // Al abrir la pestaña tras recargar se recupera el último reporte elegido (sin generarlo).
  if (!state.reporte2.reporteId) state.reporte2.reporteId = leerReporteGuardado();
  // Un reporte que ya no está en el catálogo (o sin permiso) se olvida, también del navegador.
  if (state.reporte2.reporteId && !reporteElegido()) { state.reporte2.reporteId = ''; guardarReporte(''); }
  guardarFiltrosReportes2();
  const reporte = reporteElegido();
  // Volver a la pestaña conserva lo que había; solo se prepara lo que falta.
  if ((reporte ? reporte.id : '') !== montadoId || (!reporte && !$('#rep2-cuerpo', cont).innerHTML)) await seleccionarReporte();
  else sincronizarControles();
}

function htmlError(e) {
  const { titulo, texto } = infoError(e);
  const detalle = e.codigo === 'REPORTE_FILTRO_INVALIDO' && e.message ? `<p class="rep2-referencia">${escapeHtml(e.message)}</p>` : '';
  const referencia = lineaReferencia(e);
  const boton = (id, etiqueta) => `<button class="btn btn--ghost btn--sm" id="${id}" type="button">${escapeHtml(etiqueta)}</button>`;
  const acciones = e.codigo === 'REPORTE_FILTRO_INVALIDO' ? boton('rep2-restablecer', T.restablecerFiltros)
    : (['REPORTE_SIN_ACCESO', 'REPORTE_NO_ENCONTRADO'].includes(e.codigo) ? '' : boton('rep2-reintentar', T.reintentar));
  return htmlEstado('alert-circle-outline', titulo, texto, `${detalle}${referencia ? `<p class="rep2-referencia">${escapeHtml(referencia)}</p>` : ''}${acciones}`, ' rep-estado--error');
}

// Vuelve a los filtros de fábrica, rehace los selectores y deja el reporte por generar.
function restablecerFiltros() {
  reiniciarFiltrosReportes2();
  barraPeriodo.pintar();
  pedidoVigente++;
  generando = false;
  generado = null;
  const cuerpo = $('#rep2-cuerpo', vista());
  cuerpo.removeAttribute('aria-busy');
  cuerpo.classList.remove('is-refetching', 'is-obsoleto');
  delete cuerpo.dataset.reporte;
  mostrarVacio();
  montarFiltrosActuales();
  sincronizarControles();
}

// Pinta el resultado ya generado; `repintar` (barras de la gráfica) lo rehace con ese mismo resultado.
function pintar(reporte, destino, periodo, datos) {
  reporte.render(destino, periodo, datos, { alCambiar: alCambiarFiltro, repintar, remontarFiltros: montarFiltrosActuales, verMes, irAReporte, puedeIrA });
}

// Repinta el resultado vigente sin consultar ni tocar lo viejo/«Generar»: solo cambia el enfoque de la gráfica.
function repintar() {
  const reporte = reporteElegido();
  const cuerpo = $('#rep2-cuerpo', vista());
  if (!reporte || !generado || generado.reporteId !== reporte.id || generando) return;
  const destino = document.createElement('div');
  pintar(reporte, destino, generado.periodo, generado.datos);
  cuerpo.replaceChildren(...destino.childNodes);
}

// Único punto que consulta el reporte. Idempotente: con el mismo reporte, filtros y ventana, una generación en curso se reutiliza en vez de lanzar otra.
function generar() {
  const reporte = reporteElegido();
  if (!reporte || !opciones) return Promise.resolve();
  const instantanea = instantaneaDe(reporte);
  return unaGeneracion(`${reporte.id}|${instantanea}`, () => ejecutarGeneracion(reporte, instantanea));
}

async function ejecutarGeneracion(reporte, instantanea) {
  const cuerpo = $('#rep2-cuerpo', vista());
  const periodo = { ...state.reporte2.ventana };
  const consulta = reporte.consulta(periodo); // se guarda con el resultado para que el PDF use exactamente esta consulta
  const pedido = ++pedidoVigente;
  generando = true;
  cuerpo.setAttribute('aria-busy', 'true');
  // Al cambiar de reporte (o tras un error) se muestra su esqueleto; al regenerar el mismo, el contenido previo se atenúa.
  if (cuerpo.dataset.reporte !== reporte.id && reporte.esqueleto) cuerpo.innerHTML = reporte.esqueleto();
  else cuerpo.classList.add('is-refetching');
  sincronizarControles();
  // Se pinta en un nodo aparte y se cambia al terminar: una respuesta vieja nunca pisa a la última.
  const destino = document.createElement('div');
  try {
    const datos = await reporte.generar(periodo);
    if (pedido !== pedidoVigente) return;
    pintar(reporte, destino, periodo, datos);
    cuerpo.replaceChildren(...destino.childNodes);
    cuerpo.dataset.reporte = reporte.id;
    generado = { reporteId: reporte.id, instantanea, consulta, periodo, datos };
  } catch (error) {
    if (pedido !== pedidoVigente) return;
    generado = null;
    delete cuerpo.dataset.reporte;
    const e = normalizarError(error, 'generar', reporte.ruta);
    registrarError(e);
    cuerpo.innerHTML = htmlError(e);
    const reintentar = $('#rep2-reintentar', cuerpo);
    if (reintentar) reintentar.addEventListener('click', () => generar());
    const restablecer = $('#rep2-restablecer', cuerpo);
    if (restablecer) restablecer.addEventListener('click', restablecerFiltros);
  } finally {
    if (pedido === pedidoVigente) {
      generando = false;
      cuerpo.removeAttribute('aria-busy');
      cuerpo.classList.remove('is-refetching');
      sincronizarControles();
    }
  }
}

// Idempotente: el mismo PDF (mismo reporte y resultado generado) pedido mientras ya se prepara no lanza otro.
function descargarPdf() {
  const reporte = reporteElegido();
  if (!reporte || !reporte.pdf) return Promise.resolve();
  return unPdf(`${reporte.id}|${generado ? generado.instantanea : ''}`, descargarPdfUnaVez);
}

async function descargarPdfUnaVez() {
  const reporte = reporteElegido();
  if (!reporte || !reporte.pdf) return;
  // Segunda guarda además del botón deshabilitado: el PDF solo sale de un resultado generado y al día.
  if (!generado || generado.reporteId !== reporte.id || resultadoViejo(reporte)) { window.toast?.warning(T.pdfErrorTitulo, T.pdfObsoleto); sincronizarControles(); return; }
  const boton = $('#rep2-pdf');
  boton.disabled = true;
  pdfEnCurso = true;
  try {
    const archivo = await reporte.pdf({ ...generado.periodo }, generado.consulta);
    if (!archivo) return; // el reporte pidió una confirmación y se cerró sin elegir
    const { blob, nombre } = archivo;
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    window.toast?.success(T.pdfExito, nombre);
  } catch (error) {
    const e = normalizarError(error, 'pdf', reporte.ruta);
    registrarError(e);
    const referencia = lineaReferencia(e);
    window.toast?.error(T.pdfErrorTitulo, `${infoError(e).texto}${referencia ? ` (${referencia})` : ''}`);
  } finally {
    pdfEnCurso = false; // antes de sincronizar: si no, el botón quedaría deshabilitado
    sincronizarControles();
    boton.focus();
  }
}
