// Tarjetas de contadores del reporte de actividad de tienda (opt-in con `contadores` en su configuración).
const entero = (n) => Number(n) || 0;

// Cada categoría lleva punto y rótulo: no depende solo del color.
const chip = (clase, rotulo, numero) => `<div class="rep2-cont-chip rep2-cont-chip--${clase}"><span class="rep2-cont-chip-rotulo"><span class="rep2-cont-punto" aria-hidden="true"></span>${rotulo}</span><span class="rep2-cont-chip-num">${numero}</span></div>`;

export function htmlContadores(c, T) {
  const ingresados = entero(c?.ingresados);
  const urgentes = c?.urgentes || {};
  const recibidos = c?.recibidos || {};
  return `<div class="rep2-contadores" id="rep2-contadores" role="group" aria-label="${T.contadoresAria}">
    <div class="rep2-cont-card">
      <span class="rep2-cont-rotulo">${T.contIngresados}</span>
      <span class="rep2-cont-num">${ingresados}</span>
    </div>
    <div class="rep2-cont-card">
      <span class="rep2-cont-rotulo">${T.contUrgentes}</span>
      <span class="rep2-cont-num">${entero(urgentes.porcentaje)}%</span>
      <span class="rep2-cont-detalle">${T.contDetalleUrgentes(entero(urgentes.total), ingresados)}</span>
    </div>
    <div class="rep2-cont-card rep2-cont-card--recibidos">
      <div class="rep2-cont-total">
        <span class="rep2-cont-rotulo">${T.contRecibidos}</span>
        <span class="rep2-cont-num">${entero(recibidos.total)}</span>
      </div>
      <div class="rep2-cont-chips">
        ${chip('atraso', T.contConAtraso, entero(recibidos.conAtraso))}
        ${chip('sin', T.contSinAtraso, entero(recibidos.sinAtraso))}
        ${chip('adelanto', T.contAdelantados, entero(recibidos.adelantados))}
      </div>
    </div>
  </div>`;
}
