import { state } from '../../state.js';
import { $ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { obtenerReporteActividadTienda, descargarReporteActividadTiendaPdf } from '../../api/valesApi.js';
import { aplicarPeriodoAQuery } from '../../components/barraPeriodoReportes.js';
import { crearFiltroTiendas } from '/js/menuCascada.js';
import { paramsDeTienda, valorVigente, resolverTiendaIds } from '../../utils/filtroTiendas.js';
import { htmlBloqueVigentes, conectarBloqueVigentes } from '../../components/atrasadosVigentes.js';
import {
  htmlEsqueletoCuerpo, cabeceraPanel, htmlTablaSeccion, SECCIONES_REPORTE, htmlSeccion, conectarSecciones, conectarAcciones
} from '../reportes.js';
import { TEXTOS_TIENDA as T } from './textos.js';

// Reporte de actividad de tienda: el de Actividad agrupado solo por tienda, con vales autorizados (ver flujo_vale_de_arte.md §11.1).
const INFO_TIENDA = { texto: 'Tienda' };
const CLAVE_VIGENTES = 'vales:rep2VigentesPlegado';
const leerPlegadoVigentes = () => { try { return localStorage.getItem(CLAVE_VIGENTES) === '1'; } catch { return false; } };

// Las tiendas con las que se armó el menú: convierten un país o un grupo en su lista de ids (mismo criterio que Reportes).
let tiendasDelMenu = [];

function construirQuery(periodo) {
  const qs = new URLSearchParams();
  aplicarPeriodoAQuery(qs, periodo);
  Object.entries(paramsDeTienda(state.reporte2.tiendaId, tiendasDelMenu)).forEach(([clave, valor]) => qs.set(clave, valor));
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

// Contenedor del menú global en cascada; el menú se monta tras pintar (ver renderActividadTienda).
const htmlFiltroTienda = () => '<div class="rep-filtros rep2-filtros"><div class="rep-filtros-fila"><div id="rep2-f-tienda"></div></div></div>';

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
  tiendasDelMenu = data.filtros.tiendas;
  // Un país o grupo que ya no resuelve a ninguna tienda vuelve a «todas».
  state.reporte2.tiendaId = valorVigente(state.reporte2.tiendaId, v => resolverTiendaIds(v, tiendasDelMenu));
  cont.innerHTML = `
    <div class="rep2-cab">
      <h3>${escapeHtml(data.titulo)}</h3>
      <p class="rend-meta">${escapeHtml(data.periodo.etiqueta)} · ${escapeHtml(T.actualizado)} ${horaActual()}</p>
    </div>
    ${htmlFiltroTienda()}
    ${htmlVigentes(data.atrasadosVigentes)}
    <div class="rend-grid"><section class="rend-panel rend-span-12" id="rep2-panel">${htmlPanel(data, periodo)}</section></div>
    <details class="rend-notas">
      <summary>${escapeHtml(T.notasTitulo)}</summary>
      <ul>${T.notas.map(n => `<li>${n}</li>`).join('')}</ul>
    </details>`;
  // El bloque se recrea en cada render: el menú nace de nuevo con la tienda vigente.
  const menuTienda = crearFiltroTiendas({
    tiendas: tiendasDelMenu,
    etiquetaVacio: data.alcance === 'supervisadas' ? T.todasMisTiendas : T.todasLasTiendas,
    ariaLabel: T.filtroTienda,
    valorActual: state.reporte2.tiendaId || '',
    onSeleccionar: (valor) => { state.reporte2.tiendaId = valor === '' || valor == null ? '' : String(valor); recargar(); }
  });
  $('#rep2-f-tienda', cont).appendChild(menuTienda.elemento);
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
