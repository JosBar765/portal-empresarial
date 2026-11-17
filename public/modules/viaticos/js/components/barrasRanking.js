// «Inversión por solicitante»: ranking de barras horizontales y tabla; funciones puras que devuelven texto HTML (todo texto del servidor escapado).
import { escapeHtml, formatearDinero } from '../utils/formato.js';
import { textoPorcentaje } from './graficoPastel.js';
import { t } from '../textos.js';

const ANCHO_MINIMO = 2;

// Ancho de la barra en % de la pista: la mayor ocupa todo; una con importe nunca desaparece.
export function anchoBarra(total, maximo) {
  const valor = Number(total) || 0;
  const tope = Number(maximo) || 0;
  if (valor <= 0 || tope <= 0) return 0;
  return Math.max(ANCHO_MINIMO, Math.min(100, Number(((valor / tope) * 100).toFixed(1))));
}

const esElegido = (solicitante, seleccionadoId) => seleccionadoId !== '' && seleccionadoId != null && Number(solicitante.solicitanteId) === Number(seleccionadoId);

export function htmlRanking(solicitantes, { simbolo, seleccionadoId }) {
  const lista = Array.isArray(solicitantes) ? solicitantes : [];
  const maximo = lista.reduce((m, s) => Math.max(m, Number(s.total) || 0), 0);
  const filas = lista.map((s) => {
    const elegido = esElegido(s, seleccionadoId);
    return `<li><button type="button" class="vi-rep-rank__fila${elegido ? ' is-seleccionado' : ''}" data-solicitante-id="${Number(s.solicitanteId)}" aria-pressed="${elegido}" title="${escapeHtml(t('reportes.ranking.seleccionar', { nombre: s.nombre }))}">
      <span class="vi-rep-rank__nombre">${escapeHtml(s.nombre)}</span>
      <span class="vi-rep-rank__pista" aria-hidden="true"><span class="vi-rep-rank__barra" style="width:${anchoBarra(s.total, maximo)}%"></span></span>
      <span class="vi-rep-rank__monto">${escapeHtml(formatearDinero(simbolo, s.total))}</span>
      <span class="vi-rep-rank__pct">${escapeHtml(textoPorcentaje(s.porcentaje))}</span></button></li>`;
  }).join('');
  return `<ol class="vi-rep-rank" aria-label="${escapeHtml(t('reportes.ranking.aria'))}">${filas}</ol>`;
}

export function htmlTablaSolicitantes(solicitantes, resumen, { simbolo, seleccionadoId }) {
  const lista = Array.isArray(solicitantes) ? solicitantes : [];
  const col = (clave) => escapeHtml(t(`reportes.col.${clave}`));
  const filas = lista.map((s) => {
    const elegido = esElegido(s, seleccionadoId);
    return `<tr data-solicitante-id="${Number(s.solicitanteId)}"${elegido ? ' class="is-seleccionado"' : ''}>
      <td data-label="${col('solicitante')}"><button type="button" class="vi-rep-nombre" aria-pressed="${elegido}">${escapeHtml(s.nombre)}</button></td>
      <td data-label="${col('solicitudes')}" class="vi-rep-num">${Number(s.solicitudes)}</td>
      <td data-label="${col('total')}" class="vi-rep-num">${escapeHtml(formatearDinero(simbolo, s.total))}</td>
      <td data-label="${col('porcentaje')}" class="vi-rep-num">${escapeHtml(textoPorcentaje(s.porcentaje))}</td>
      <td data-label="${col('promedio')}" class="vi-rep-num">${escapeHtml(formatearDinero(simbolo, s.promedio))}</td></tr>`;
  }).join('');
  const r = resumen || {};
  const pie = `<tr class="vi-rep-total">
      <th scope="row" data-label="${col('solicitante')}">${escapeHtml(t('reportes.totalFila'))}</th>
      <td data-label="${col('solicitudes')}" class="vi-rep-num">${Number(r.solicitudes) || 0}</td>
      <td data-label="${col('total')}" class="vi-rep-num">${escapeHtml(formatearDinero(simbolo, r.total))}</td>
      <td data-label="${col('porcentaje')}" class="vi-rep-num">${escapeHtml(textoPorcentaje(lista.length ? 100 : 0))}</td>
      <td data-label="${col('promedio')}" class="vi-rep-num">${escapeHtml(formatearDinero(simbolo, r.promedio))}</td></tr>`;
  return `<table class="vi-rep-tabla"><thead><tr>
    <th scope="col">${col('solicitante')}</th><th scope="col" class="vi-rep-num">${col('solicitudes')}</th><th scope="col" class="vi-rep-num">${col('total')}</th>
    <th scope="col" class="vi-rep-num">${col('porcentaje')}</th><th scope="col" class="vi-rep-num">${col('promedio')}</th></tr></thead><tbody>${filas}${pie}</tbody></table>`;
}
