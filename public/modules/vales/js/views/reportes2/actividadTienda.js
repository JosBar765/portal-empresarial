import { state } from '../../state.js';
import { $ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { obtenerReporteActividadTienda, descargarReporteActividadTiendaPdf } from '../../api/valesApi.js';
import { aplicarPeriodoAQuery } from '../../components/barraPeriodoReportes.js';
import { htmlBloqueVigentes, conectarBloqueVigentes } from '../../components/atrasadosVigentes.js';
import {
  htmlEsqueletoCuerpo, cabeceraPanel, htmlTablaSeccion, SECCIONES_REPORTE, htmlSeccion, conectarSecciones, conectarAcciones
} from '../reportes.js';
import { TEXTOS_TIENDA as T } from './textos.js';

// Reporte de actividad de tienda: el de Actividad agrupado solo por tienda, con vales autorizados (ver flujo_vale_de_arte.md §11.1).
const INFO_TIENDA = { texto: 'Tienda' };
const CLAVE_VIGENTES = 'vales:rep2VigentesPlegado';
const leerPlegadoVigentes = () => { try { return localStorage.getItem(CLAVE_VIGENTES) === '1'; } catch { return false; } };

function construirQuery(periodo) {
  const qs = new URLSearchParams();
  aplicarPeriodoAQuery(qs, periodo);
  if (state.reporte2.tiendaId) qs.set('tiendaId', state.reporte2.tiendaId);
  return qs;
}

const botonVer = (v) => `<button type="button" class="btn-icon" data-ver="${v.id}" data-correlativo="${escapeHtml(v.correlativo)}"${v.tienePropuesta ? ' data-con-propuesta="1"' : ''}${v.multitaller ? ' data-multitaller="1"' : ''} title="Ver vale" aria-label="Ver vale ${escapeHtml(v.correlativo)}"><ion-icon name="eye-outline"></ion-icon></button>`;

function htmlVigentes(av) {
  if (!av || !av.total) return '';
  const vales = av.grupos.flatMap(g => g.vales.map(v => ({ v, tienda: g.nombre }))).sort((a, b) => b.v.diasAtraso - a.v.diasAtraso);
  return htmlBloqueVigentes({
    id: 'rep2-vigentes', total: av.total, truncado: av.truncado, plegado: leerPlegadoVigentes(), textoPeriodo: T.vigentesPeriodo,
    items: vales.map(({ v, tienda }) => ({
      correlativo: v.correlativo, esMod: v.esMod, sub: tienda, pipeline: v.pipeline, fechaEntrega: v.fechaEntrega, diasAtraso: v.diasAtraso, accionesHtml: botonVer(v)
    }))
  });
}

function htmlFiltroTienda(data) {
  const actual = String(state.reporte2.tiendaId || '');
  const vacio = data.alcance === 'supervisadas' ? T.todasMisTiendas : T.todasLasTiendas;
  return `<div class="rep-filtros rep2-filtros">
    <label class="rep2-combo">
      <span class="rep-filtro-rotulo">${escapeHtml(T.filtroTienda)}</span>
      <select id="rep2-tienda" aria-label="${escapeHtml(T.filtroTienda)}">
        <option value="">${escapeHtml(vacio)}</option>
        ${data.filtros.tiendas.map(t => `<option value="${t.id}"${String(t.id) === actual ? ' selected' : ''}>${escapeHtml(t.nombre)}</option>`).join('')}
      </select>
    </label>
  </div>`;
}

function htmlVacio(periodo) {
  const ampliar = periodo.tipo !== 'mes';
  return `<div class="rep-estado">
    <span class="rep-estado-icono"><ion-icon name="document-text-outline" aria-hidden="true"></ion-icon></span>
    <h4>${escapeHtml(T.vacioTitulo)}</h4>
    <p>${escapeHtml(T.vacioTexto)}</p>
    ${ampliar ? `<button type="button" class="btn btn--ghost btn--sm" id="rep2-ver-mes">${escapeHtml(T.verMes)}</button>` : ''}
  </div>`;
}

function htmlPanel(data, periodo) {
  const g = data.grupos;
  const secciones = SECCIONES_REPORTE.map(def => ({ ...def, ...g.secciones[def.clave] })).filter(x => x.total > 0);
  const tiendas = new Set(secciones.flatMap(x => x.grupos.map(gr => gr.id))).size;
  const sub = `${g.totalVales} vale${g.totalVales === 1 ? '' : 's'} · ${tiendas} tienda${tiendas === 1 ? '' : 's'}`;
  if (!secciones.length) return cabeceraPanel(T.panel, sub) + htmlVacio(periodo);
  return `${cabeceraPanel(T.panel, sub)}
    ${secciones.map(sec => htmlSeccion({
    ...sec, prefijo: 'rep2-sec', sub: sec.clave === 'entregados' ? T.subEntregados : sec.sub, cuerpo: htmlTablaSeccion(sec, INFO_TIENDA, false)
  })).join('')}
    ${g.truncado ? `<p class="rep-nota">${escapeHtml(T.recortado)}</p>` : ''}`;
}

const horaActual = () => new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

export async function renderActividadTienda(cont, periodo, { recargar, cambiarVentana }) {
  const data = await obtenerReporteActividadTienda(construirQuery(periodo));
  cont.innerHTML = `
    <div class="rep2-cab">
      <h3>${escapeHtml(data.titulo)}</h3>
      <p class="rend-meta">${escapeHtml(data.periodo.etiqueta)} · ${escapeHtml(T.actualizado)} ${horaActual()}</p>
    </div>
    ${htmlFiltroTienda(data)}
    ${htmlVigentes(data.atrasadosVigentes)}
    <div class="rend-grid"><section class="rend-panel rend-span-12" id="rep2-panel">${htmlPanel(data, periodo)}</section></div>
    <details class="rend-notas">
      <summary>${escapeHtml(T.notasTitulo)}</summary>
      <ul>${T.notas.map(n => `<li>${n}</li>`).join('')}</ul>
    </details>`;
  $('#rep2-tienda', cont).addEventListener('change', (e) => { state.reporte2.tiendaId = e.target.value; recargar(); });
  const vigentes = $('#rep2-vigentes', cont);
  if (vigentes) {
    conectarBloqueVigentes(vigentes, (plegado) => { try { localStorage.setItem(CLAVE_VIGENTES, plegado ? '1' : '0'); } catch { /* sin almacenamiento: no se recuerda */ } });
    conectarAcciones(vigentes);
  }
  const panel = $('#rep2-panel', cont);
  conectarAcciones(panel);
  conectarSecciones(panel);
  const ampliar = $('#rep2-ver-mes', panel);
  if (ampliar) ampliar.addEventListener('click', () => cambiarVentana({ tipo: 'mes', fecha: periodo.tipo === 'rango' ? periodo.hasta : periodo.fecha }));
}

export const esqueletoActividadTienda = htmlEsqueletoCuerpo;

export function pdfActividadTienda(periodo) {
  return descargarReporteActividadTiendaPdf(construirQuery(periodo));
}
