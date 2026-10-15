import { escapeHtml } from '../utils/formato.js';

// -----------------------------------------------------------------------
// Tabla comparativa del reporte de Rendimiento: una fila por persona y una fila de totales. La persona con el % más bajo lleva el
// texto «más bajo» (no solo color). En celular cada fila pasa a tarjeta.
// Taller (diseñadores): Asignados, Entregados, % efectividad, % a tiempo, Entregas tarde y Sin entregar.
// Supervisor (asesores): las dos cifras comparadas, su % y sus atrasados.
// -----------------------------------------------------------------------
const pct = (a, b) => (a > 0 ? `${Math.round((b / a) * 100)} %` : '—');
// % a tiempo: lo entregado sin atraso entre lo entregado.
const pctATiempo = (entregados, tarde) => (entregados > 0 ? `${Math.round(((entregados - tarde) / entregados) * 100)} %` : '—');

function htmlTablaTaller(r) {
  const [serieA, serieB] = r.series;
  const col = [serieA.etiqueta, serieB.etiqueta, '% efectividad', '% a tiempo', 'Entregas tarde', 'Sin entregar'];
  const celdas = (f, alerta) => `
      <td class="rend-num" data-label="${escapeHtml(col[0])}">${f.a}</td>
      <td class="rend-num" data-label="${escapeHtml(col[1])}">${f.b}</td>
      <td class="rend-num" data-label="${col[2]}">${pct(f.a, f.b)}</td>
      <td class="rend-num" data-label="${col[3]}">${pctATiempo(f.b, f.tarde)}</td>
      <td class="rend-num${f.tarde ? ' rend-num--aviso' : ''}" data-label="${col[4]}">${f.tarde}</td>
      <td class="rend-num${f.sinEntregar ? ' rend-num--alerta' : ''}" data-label="${col[5]}">${f.sinEntregar}</td>`;
  const filas = r.filas.map(f => `
    <tr${f.a === 0 ? ' class="rend-fila-vacia"' : ''}>
      <th scope="row" data-label="${escapeHtml(r.persona)}">${escapeHtml(f.nombre)}</th>${celdas(f)}
    </tr>`).join('');
  return {
    sub: 'Las cifras de la gráfica, con entregas tarde y sin entregar',
    cabecera: `<th scope="col">${escapeHtml(r.persona)}</th>${col.map(c => `<th scope="col" class="rend-num">${escapeHtml(c)}</th>`).join('')}`,
    filas,
    total: `<th scope="row" data-label="Total">Total</th>${celdas(r.totales)}`
  };
}

function htmlTablaSupervisor(r) {
  const [serieA, serieB] = r.series;
  const filas = r.filas.map(f => `
    <tr${f.a === 0 ? ' class="rend-fila-vacia"' : ''}>
      <th scope="row" data-label="${escapeHtml(r.persona)}">${escapeHtml(f.nombre)}${r.totales.masBajo === f.id ? '<span class="rep-chip rep-chip--aviso rep-chip--mini">% más bajo</span>' : ''}</th>
      <td class="rend-num" data-label="${escapeHtml(serieA.etiqueta)}">${f.a}</td>
      <td class="rend-num" data-label="${escapeHtml(serieB.etiqueta)}">${f.b}</td>
      <td class="rend-num" data-label="%">${pct(f.a, f.b)}</td>
      <td class="rend-num${f.atrasados ? ' rend-num--alerta' : ''}" data-label="Atrasados">${f.atrasados}</td>
    </tr>`).join('');
  return {
    sub: 'Las mismas cifras de la gráfica, con atrasados',
    cabecera: `<th scope="col">${escapeHtml(r.persona)}</th><th scope="col" class="rend-num">${escapeHtml(serieA.etiqueta)}</th><th scope="col" class="rend-num">${escapeHtml(serieB.etiqueta)}</th><th scope="col" class="rend-num">%</th><th scope="col" class="rend-num">Atrasados</th>`,
    filas,
    total: `<th scope="row" data-label="Total">Total</th>
            <td class="rend-num" data-label="${escapeHtml(serieA.etiqueta)}">${r.totales.a}</td>
            <td class="rend-num" data-label="${escapeHtml(serieB.etiqueta)}">${r.totales.b}</td>
            <td class="rend-num" data-label="%">${pct(r.totales.a, r.totales.b)}</td>
            <td class="rend-num${r.totales.atrasados ? ' rend-num--alerta' : ''}" data-label="Atrasados">${r.totales.atrasados}</td>`
  };
}

export function htmlTablaRendimiento(r) {
  if (!r || !r.filas.length) return '';
  const t = r.clave === 'disenadores' ? htmlTablaTaller(r) : htmlTablaSupervisor(r);
  return `
    <section class="rend-panel rep-comparativo" aria-label="Comparativo por persona">
      <header class="rend-panel-cab"><div><h3>Comparativo por ${escapeHtml(r.persona.toLowerCase())}</h3><p>${t.sub}</p></div></header>
      <div class="rend-tabla-wrap">
        <table class="rend-tabla rep-rendimiento">
          <thead><tr>${t.cabecera}</tr></thead>
          <tbody>${t.filas}</tbody>
          <tfoot><tr>${t.total}</tr></tfoot>
        </table>
      </div>
    </section>`;
}
