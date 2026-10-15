import { escapeHtml } from '../utils/formato.js';

// -----------------------------------------------------------------------
// Tabla comparativa del reporte de Rendimiento: una fila por persona y una fila de totales. En celular cada fila pasa a tarjeta.
// Taller (diseñadores): Asignados, Entregados, % efectividad, % a tiempo, Entregas tarde y Sin entregar.
// Supervisor (asesores): creados, autorizados, % de autorización, recibidos sin/con atraso y sin recibir.
// -----------------------------------------------------------------------
const pct = (a, b) => (a > 0 ? `${Math.round((b / a) * 100)} %` : '—');
// % a tiempo: lo entregado sin atraso entre lo entregado.
const pctATiempo = (entregados, tarde) => (entregados > 0 ? `${Math.round(((entregados - tarde) / entregados) * 100)} %` : '—');

function htmlTablaTaller(r) {
  const [serieA, serieB] = r.series;
  const col = [serieA.etiqueta, serieB.etiqueta, '% efectividad', '% a tiempo', 'Entregas tarde', 'Sin entregar'];
  // En la fila de total los porcentajes van en guion: sumar o promediar porcentajes de personas confunde (los contadores ya dan el global).
  const celdas = (f, esTotal = false) => `
      <td class="rend-num" data-label="${escapeHtml(col[0])}">${f.a}</td>
      <td class="rend-num" data-label="${escapeHtml(col[1])}">${f.b}</td>
      <td class="rend-num" data-label="${col[2]}">${esTotal ? '—' : pct(f.a, f.b)}</td>
      <td class="rend-num" data-label="${col[3]}">${esTotal ? '—' : pctATiempo(f.b, f.tarde)}</td>
      <td class="rend-num${f.tarde ? ' rend-num--aviso' : ''}" data-label="${col[4]}">${f.tarde}</td>
      <td class="rend-num${f.sinEntregar ? ' rend-num--alerta' : ''}" data-label="${col[5]}">${f.sinEntregar}</td>`;
  // «Sin asignar» va primero: los vales de la ventana que ningún diseñador tiene todavía.
  const todas = r.sinAsignar ? [r.sinAsignar, ...r.filas] : r.filas;
  const filas = todas.map(f => `
    <tr${f.a === 0 ? ' class="rend-fila-vacia"' : ''}>
      <th scope="row" data-label="${escapeHtml(r.persona)}">${escapeHtml(f.nombre)}</th>${celdas(f)}
    </tr>`).join('');
  return {
    sub: 'Las cifras de la gráfica, con entregas tarde y sin entregar',
    cabecera: `<th scope="col">${escapeHtml(r.persona)}</th>${col.map(c => `<th scope="col" class="rend-num">${escapeHtml(c)}</th>`).join('')}`,
    filas,
    total: `<th scope="row" data-label="Total">Total</th>${celdas(r.totales, true)}`
  };
}

function htmlTablaSupervisor(r) {
  const [serieA, serieB] = r.series;
  const filas = r.filas.map(f => `
    <tr${f.a === 0 ? ' class="rend-fila-vacia"' : ''}>
      <th scope="row" data-label="${escapeHtml(r.persona)}">${escapeHtml(f.nombre)}</th>
      <td class="rend-num" data-label="${escapeHtml(serieA.etiqueta)}">${f.a}</td>
      <td class="rend-num" data-label="${escapeHtml(serieB.etiqueta)}">${f.b}</td>
      <td class="rend-num" data-label="% autorización">${pct(f.a, f.b)}</td>
      <td class="rend-num" data-label="% a tiempo">${pct(f.recibidosATiempo + f.recibidosTarde, f.recibidosATiempo)}</td>
      <td class="rend-num" data-label="Recibidos sin atraso">${f.recibidosATiempo}</td>
      <td class="rend-num${f.recibidosTarde ? ' rend-num--aviso' : ''}" data-label="Recibidos con atraso">${f.recibidosTarde}</td>
      <td class="rend-num${f.sinRecibir ? ' rend-num--alerta' : ''}" data-label="Sin recibir">${f.sinRecibir}</td>
    </tr>`).join('');
  return {
    sub: 'Las cifras de la gráfica, con lo recibido y lo que falta por recibir',
    cabecera: `<th scope="col">${escapeHtml(r.persona)}</th><th scope="col" class="rend-num">${escapeHtml(serieA.etiqueta)}</th><th scope="col" class="rend-num">${escapeHtml(serieB.etiqueta)}</th><th scope="col" class="rend-num">% autorización</th><th scope="col" class="rend-num">% a tiempo</th><th scope="col" class="rend-num">Recibidos sin atraso</th><th scope="col" class="rend-num">Recibidos con atraso</th><th scope="col" class="rend-num">Sin recibir</th>`,
    filas,
    total: `<th scope="row" data-label="Total">Total</th>
            <td class="rend-num" data-label="${escapeHtml(serieA.etiqueta)}">${r.totales.a}</td>
            <td class="rend-num" data-label="${escapeHtml(serieB.etiqueta)}">${r.totales.b}</td>
            <td class="rend-num" data-label="% autorización">—</td>
            <td class="rend-num" data-label="% a tiempo">—</td>
            <td class="rend-num" data-label="Recibidos sin atraso">${r.totales.recibidosATiempo}</td>
            <td class="rend-num${r.totales.recibidosTarde ? ' rend-num--aviso' : ''}" data-label="Recibidos con atraso">${r.totales.recibidosTarde}</td>
            <td class="rend-num${r.totales.sinRecibir ? ' rend-num--alerta' : ''}" data-label="Sin recibir">${r.totales.sinRecibir}</td>`
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
