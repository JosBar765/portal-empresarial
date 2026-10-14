import { escapeHtml } from '../utils/formato.js';

// -----------------------------------------------------------------------
// Tabla comparativa del reporte de Rendimiento: una fila por persona con las dos cifras comparadas, su % y sus atrasados, y una fila
// de totales. La persona con el % más bajo lleva el texto «más bajo» (no solo color). En celular cada fila pasa a tarjeta.
// -----------------------------------------------------------------------
const pct = (a, b) => (a > 0 ? `${Math.round((b / a) * 100)} %` : '—');

export function htmlTablaRendimiento(r) {
  if (!r || !r.filas.length) return '';
  const [serieA, serieB] = r.series;
  const filas = r.filas.map(f => `
    <tr${f.a === 0 ? ' class="rend-fila-vacia"' : ''}>
      <th scope="row" data-label="${escapeHtml(r.persona)}">${escapeHtml(f.nombre)}${r.totales.masBajo === f.id ? '<span class="rep-chip rep-chip--aviso rep-chip--mini">% más bajo</span>' : ''}</th>
      <td class="rend-num" data-label="${escapeHtml(serieA.etiqueta)}">${f.a}</td>
      <td class="rend-num" data-label="${escapeHtml(serieB.etiqueta)}">${f.b}</td>
      <td class="rend-num" data-label="%">${pct(f.a, f.b)}</td>
      <td class="rend-num${f.atrasados ? ' rend-num--alerta' : ''}" data-label="Atrasados">${f.atrasados}</td>
    </tr>`).join('');
  return `
    <section class="rend-panel rep-comparativo" aria-label="Comparativo por persona">
      <header class="rend-panel-cab"><div><h3>Comparativo por ${escapeHtml(r.persona.toLowerCase())}</h3><p>Las mismas cifras de la gráfica, con atrasados</p></div></header>
      <div class="rend-tabla-wrap">
        <table class="rend-tabla rep-rendimiento">
          <thead><tr><th scope="col">${escapeHtml(r.persona)}</th><th scope="col" class="rend-num">${escapeHtml(serieA.etiqueta)}</th><th scope="col" class="rend-num">${escapeHtml(serieB.etiqueta)}</th><th scope="col" class="rend-num">%</th><th scope="col" class="rend-num">Atrasados</th></tr></thead>
          <tbody>${filas}</tbody>
          <tfoot><tr>
            <th scope="row" data-label="Total">Total</th>
            <td class="rend-num" data-label="${escapeHtml(serieA.etiqueta)}">${r.totales.a}</td>
            <td class="rend-num" data-label="${escapeHtml(serieB.etiqueta)}">${r.totales.b}</td>
            <td class="rend-num" data-label="%">${pct(r.totales.a, r.totales.b)}</td>
            <td class="rend-num${r.totales.atrasados ? ' rend-num--alerta' : ''}" data-label="Atrasados">${r.totales.atrasados}</td>
          </tr></tfoot>
        </table>
      </div>
    </section>`;
}
