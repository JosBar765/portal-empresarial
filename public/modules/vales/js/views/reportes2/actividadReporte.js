import { $ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formato.js';
import { obtenerReporteActividad, descargarReporteActividadPdf } from '../../api/valesApi.js';
import { aplicarPeriodoAQuery } from '../../components/barraPeriodoReportes.js';
import { htmlContadores } from './contadoresActividad.js';
import { htmlBloqueVigentes, conectarBloqueVigentes } from '../../components/atrasadosVigentes.js';
import {
  htmlEsqueletoCuerpo, cabeceraPanel, htmlTablaSeccion, SECCIONES_REPORTE, htmlSeccion, conectarSecciones, conectarAcciones
} from '../reportes.js';

// Render común de los reportes de actividad de Reportes 2 (tienda, taller, diseñador, asesor); ver flujo_vale_de_arte.md §11.1.
// `filtro` aporta lo propio de cada uno: { id, aplicar(qs), recibir(data), montar(contenedor, data, recargar), quitar?(id), limpiar?() }.
const CLAVE_VIGENTES = 'vales:rep2VigentesPlegado';
const leerPlegadoVigentes = () => { try { return localStorage.getItem(CLAVE_VIGENTES) === '1'; } catch { return false; } };

const botonVer = (v) => `<button type="button" class="btn-icon" data-ver="${v.id}" data-correlativo="${escapeHtml(v.correlativo)}"${v.tienePropuesta ? ' data-con-propuesta="1"' : ''}${v.multitaller ? ' data-multitaller="1"' : ''} title="Ver vale" aria-label="Ver vale ${escapeHtml(v.correlativo)}"><ion-icon name="eye-outline"></ion-icon></button>`;

const horaActual = () => new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

function htmlVigentes(av, T) {
  if (!av || !av.total) return '';
  const vales = av.grupos.flatMap(g => g.vales.map(v => ({ v, grupo: g.nombre }))).sort((a, b) => b.v.diasAtraso - a.v.diasAtraso);
  return htmlBloqueVigentes({
    id: 'rep2-vigentes', total: av.total, truncado: av.truncado, plegado: leerPlegadoVigentes(), textoPeriodo: T.vigentesPeriodo,
    items: vales.map(({ v, grupo }) => ({
      correlativo: v.correlativo, esMod: v.esMod, sub: grupo, pipeline: v.pipeline, fechaEntrega: v.fechaEntrega, diasAtraso: v.diasAtraso, accionesHtml: botonVer(v)
    }))
  });
}

function htmlVacio(periodo, T) {
  const ampliar = periodo.tipo !== 'mes';
  return `<div class="rep-estado">
    <span class="rep-estado-icono"><ion-icon name="document-text-outline" aria-hidden="true"></ion-icon></span>
    <h4>${escapeHtml(T.vacioTitulo)}</h4>
    <p>${escapeHtml(T.vacioTexto)}</p>
    ${ampliar ? `<button type="button" class="btn btn--ghost btn--sm" id="rep2-ver-mes">${escapeHtml(T.verMes)}</button>` : ''}
  </div>`;
}

function htmlPanel(data, periodo, T) {
  const g = data.grupos;
  const secciones = SECCIONES_REPORTE.map(def => ({ ...def, ...g.secciones[def.clave] })).filter(x => x.total > 0);
  // Sin contador de vales: quienes trabajan por adelantado tienen vales con entrega fuera de la ventana y el total confundía.
  if (!secciones.length) return cabeceraPanel(T.panel) + htmlVacio(periodo, T);
  return `${cabeceraPanel(T.panel)}
    ${secciones.map(sec => htmlSeccion({
    ...sec, prefijo: 'rep2-sec', sub: sec.clave === 'entregados' ? T.subEntregados : sec.sub, cuerpo: htmlTablaSeccion(sec, { texto: T.columna }, false)
  })).join('')}
    ${g.truncado ? `<p class="rep-nota">${escapeHtml(T.recortado)}</p>` : ''}`;
}

// Quién se evalúa (solo en los filtros de personas), con × para quitar a cada uno, como en Reportes.
const htmlFichas = (evaluados) => `<div class="rep-fichas" id="rep2-fichas"><span class="rep-fichas-rotulo">Evaluando a:</span>${evaluados.map(p => `<span class="rep-ficha">${escapeHtml(p.nombre)}<button type="button" data-quitar="${p.id}" aria-label="Quitar a ${escapeHtml(p.nombre)}"><ion-icon name="close" aria-hidden="true"></ion-icon></button></span>`).join('')}<button type="button" class="rep-link" id="rep2-limpiar">Limpiar</button></div>`;

// `contadores: true` muestra las tarjetas de resumen (solo el reporte de tienda).
export function crearReporteActividad({ ruta, textos: T, filtro, contadores = false }) {
  const construirQuery = (periodo) => {
    const qs = new URLSearchParams();
    aplicarPeriodoAQuery(qs, periodo);
    filtro.aplicar(qs);
    return qs;
  };

  async function render(cont, periodo, { recargar, cambiarVentana }) {
    const data = await obtenerReporteActividad(ruta, construirQuery(periodo));
    filtro.recibir(data);
    const fichas = filtro.quitar && data.evaluados?.length ? htmlFichas(data.evaluados) : '';
    cont.innerHTML = `
    <div class="rep2-cabfila">
      <div class="rep2-cab">
        <h3>${escapeHtml(data.titulo)}</h3>
        <p class="rend-meta">${escapeHtml(data.periodo.etiqueta)} · ${escapeHtml(T.actualizado)} ${horaActual()}</p>
      </div>
      <div class="rep-filtros rep2-filtros"><div class="rep-filtros-fila"><div id="${filtro.id}"></div></div></div>
    </div>
    ${fichas}
    ${contadores ? htmlContadores(data.contadores, T) : ''}
    ${htmlVigentes(data.atrasadosVigentes, T)}
    <div class="rend-grid"><section class="rend-panel rend-span-12" id="rep2-panel">${htmlPanel(data, periodo, T)}</section></div>
    <details class="rend-notas">
      <summary>${escapeHtml(T.notasTitulo)}</summary>
      <ul>${T.notas.map(n => `<li>${n}</li>`).join('')}</ul>
    </details>`;
    // El bloque se recrea en cada render: el filtro nace de nuevo con la selección vigente.
    filtro.montar($(`#${filtro.id}`, cont), data, recargar);
    if (fichas) {
      cont.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => { filtro.quitar(b.dataset.quitar); recargar(); }));
      $('#rep2-limpiar', cont).addEventListener('click', () => { filtro.limpiar(); recargar(); });
    }
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

  return {
    render,
    esqueleto: htmlEsqueletoCuerpo,
    pdf: (periodo) => descargarReporteActividadPdf(ruta, construirQuery(periodo))
  };
}
