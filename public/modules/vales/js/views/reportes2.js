import { state } from '../state.js';
import { $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { crearBarraPeriodo } from '../components/barraPeriodoReportes.js';
import { CATALOGO } from './reportes2/catalogo.js';
import { TEXTOS as T } from './reportes2/textos.js';

// -----------------------------------------------------------------------
// Reportes 2: contenedor de reportes. Un combo elige el reporte; la ventana de tiempo, «Actualizar» y «Descargar PDF»
// valen para el reporte elegido. Los reportes se registran en reportes2/catalogo.js.
// -----------------------------------------------------------------------
let pedidoVigente = 0;
let barraPeriodo = null;

const reporteElegido = () => CATALOGO.find(r => r.id === state.reporte2.reporteId) || null;

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
        <button class="btn btn--ghost btn--sm" id="rep2-actualizar" type="button"><ion-icon name="refresh-outline"></ion-icon> ${escapeHtml(T.actualizar)}</button>
        <button class="btn btn--primary btn--sm" id="rep2-pdf" type="button"><ion-icon name="download-outline"></ion-icon> ${escapeHtml(T.descargarPdf)}</button>
      </div>
    </div>
    <div class="rep2-controles">
      <label class="rep2-combo">
        <span class="rep-filtro-rotulo">${escapeHtml(T.comboEtiqueta)}</span>
        <select id="rep2-combo" aria-label="${escapeHtml(T.comboEtiqueta)}">
          <option value="">${escapeHtml(T.comboVacio)}</option>
          ${CATALOGO.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.etiqueta)}</option>`).join('')}
        </select>
      </label>
      <div class="rp-barra" id="rep2-periodo"></div>
    </div>
    <div class="rend-cuerpo" id="rep2-cuerpo" aria-live="polite"></div>`;
  barraPeriodo = crearBarraPeriodo($('#rep2-periodo', cont), {
    prefijo: 'rp2', // ids y campos propios: Reportes ya usa los de por defecto
    obtener: () => state.reporte2.ventana,
    alCambiar: (ventana) => { state.reporte2.ventana = ventana; barraPeriodo.pintar(); cargarReportes2(); }
  });
  $('#rep2-combo', cont).addEventListener('change', (e) => { state.reporte2.reporteId = e.target.value; cargarReportes2(); });
  $('#rep2-actualizar', cont).addEventListener('click', () => cargarReportes2());
  $('#rep2-pdf', cont).addEventListener('click', descargarPdf);
  cont.dataset.wired = '1';
}

// Los controles reflejan el reporte elegido; sin PDF, el botón se deshabilita y explica por qué.
function sincronizarControles(cont, reporte) {
  const combo = $('#rep2-combo', cont);
  if (combo.value !== (reporte ? reporte.id : '')) combo.value = reporte ? reporte.id : '';
  $('#rep2-actualizar', cont).disabled = !reporte;
  const pdf = $('#rep2-pdf', cont);
  pdf.disabled = !(reporte && reporte.pdf);
  pdf.title = pdf.disabled ? (reporte ? T.pdfSinSoporte : T.pdfElegirReporte) : '';
}

const mensajeDeError = (error) => (error?.name === 'TypeError' ? T.errorRed : (error?.message || T.errorGenerico));

export async function cargarReportes2() {
  const cont = $('#reportes2-vista');
  armarShell(cont);
  barraPeriodo.pintar();
  // Un reporte que ya no está en el catálogo se olvida.
  if (state.reporte2.reporteId && !reporteElegido()) state.reporte2.reporteId = '';
  const reporte = reporteElegido();
  sincronizarControles(cont, reporte);
  const cuerpo = $('#rep2-cuerpo', cont);
  const pedido = ++pedidoVigente;
  if (!reporte) {
    cuerpo.innerHTML = CATALOGO.length
      ? htmlEstado('analytics-outline', T.vacioTitulo, T.vacioTexto)
      : htmlEstado('analytics-outline', T.vacioTitulo, T.vacioSinCatalogo);
    return;
  }
  cuerpo.setAttribute('aria-busy', 'true');
  // Se pinta en un nodo aparte y se cambia al terminar: una respuesta vieja nunca pisa a la última.
  const destino = document.createElement('div');
  try {
    await reporte.render(destino, { ...state.reporte2.ventana });
    if (pedido !== pedidoVigente) return;
    cuerpo.replaceChildren(...destino.childNodes);
  } catch (error) {
    if (pedido !== pedidoVigente) return;
    cuerpo.innerHTML = htmlEstado('alert-circle-outline', T.errorTitulo, mensajeDeError(error),
      `<button class="btn btn--ghost btn--sm" id="rep2-reintentar" type="button">${escapeHtml(T.reintentar)}</button>`, ' rep-estado--error');
    $('#rep2-reintentar', cuerpo).addEventListener('click', () => cargarReportes2());
  } finally {
    if (pedido === pedidoVigente) cuerpo.removeAttribute('aria-busy');
  }
}

async function descargarPdf() {
  const reporte = reporteElegido();
  if (!reporte || !reporte.pdf) return;
  const boton = $('#rep2-pdf');
  boton.disabled = true;
  try {
    const { blob, nombre } = await reporte.pdf({ ...state.reporte2.ventana });
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
    window.toast?.error(T.pdfErrorTitulo, mensajeDeError(error));
  } finally {
    sincronizarControles($('#reportes2-vista'), reporteElegido());
    boton.focus();
  }
}
