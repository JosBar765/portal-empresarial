// Tarjetas de contadores del reporte de actividad de tienda (opt-in con `contadores` en su configuración).
// Orden de la maqueta: Ingresados · Urgentes · Sin entregar / Atrasados (anteriores, actuales) · Entregados (con atraso, sin atraso).
// Con `pulsables`, cada contador (menos Ingresados) es un botón `data-filtro` que filtra el desglose; `activos` = { estado, urgente } vigentes.
const entero = (n) => Number(n) || 0;

// Un elemento pulsable es un botón con aria-pressed; sin `pulsables` queda el elemento de siempre.
function elemento(etiqueta, clase, filtro, ctx, contenido) {
  if (!ctx.pulsables) return `<${etiqueta} class="${clase}">${contenido}</${etiqueta}>`;
  const activo = filtro === 'urgente' ? ctx.activos.urgente : ctx.activos.estado === filtro;
  return `<button type="button" class="${clase} rep2-pulsable${activo ? ' is-activo' : ''}" data-filtro="${filtro}" aria-pressed="${activo}">${contenido}</button>`;
}

// Cada categoría lleva punto y rótulo: no depende solo del color.
const chip = (ctx, clase, filtro, rotulo, numero) => elemento('div', `rep2-cont-chip rep2-cont-chip--${clase}`, filtro, ctx, `<span class="rep2-cont-chip-rotulo"><span class="rep2-cont-punto" aria-hidden="true"></span>${rotulo}</span><span class="rep2-cont-chip-num">${numero}</span>`);

// Tarjeta con total y dos categorías (Atrasados y Entregados): la tarjeta no es botón, lo son el total y cada categoría.
const tarjetaGrupo = (ctx, rotulo, filtro, total, chips) => `<div class="rep2-cont-card rep2-cont-card--grupo">
      ${elemento('div', 'rep2-cont-total', filtro, ctx, `<span class="rep2-cont-rotulo">${rotulo}</span><span class="rep2-cont-num">${total}</span>`)}
      <div class="rep2-cont-chips">${chips.join('')}</div>
    </div>`;

export function htmlContadores(c, T, { pulsables = false, activos = {} } = {}) {
  const ctx = { pulsables, activos: { estado: activos.estado || null, urgente: !!activos.urgente } };
  const ingresados = entero(c?.ingresados);
  const urgentes = c?.urgentes || {};
  const atrasados = c?.atrasados || {};
  const entregados = c?.recibidos || {};
  return `<div class="rep2-contadores" id="rep2-contadores" role="group" aria-label="${T.contadoresAria}">
    <div class="rep2-cont-card">
      <span class="rep2-cont-rotulo">${T.contIngresados}</span>
      <span class="rep2-cont-num">${ingresados}</span>
    </div>
    ${elemento('div', 'rep2-cont-card', 'urgente', ctx, `<span class="rep2-cont-rotulo">${T.contUrgentes}</span>
      <span class="rep2-cont-num">${entero(urgentes.porcentaje)}%</span>
      <span class="rep2-cont-detalle">${T.contDetalleUrgentes(entero(urgentes.total), ingresados)}</span>`)}
    ${elemento('div', 'rep2-cont-card rep2-cont-card--sin-entregar', 'sinEntregar', ctx, `<span class="rep2-cont-rotulo">${T.contSinEntregar}</span>
      <span class="rep2-cont-num">${entero(c?.sinEntregar)}</span>`)}
    ${tarjetaGrupo(ctx, T.contAtrasados, 'atrasados', entero(atrasados.total), [
      chip(ctx, 'atraso', 'atrasadosAnteriores', T.contAnteriores, entero(atrasados.anteriores)),
      chip(ctx, 'atraso', 'atrasadosActuales', T.contActuales, entero(atrasados.actuales))
    ])}
    ${tarjetaGrupo(ctx, T.contEntregados, 'entregados', entero(entregados.total), [
      chip(ctx, 'atraso', 'entregadosConAtraso', T.contConAtraso, entero(entregados.conAtraso)),
      chip(ctx, 'sin', 'entregadosSinAtraso', T.contSinAtraso, entero(entregados.sinAtraso))
    ])}
  </div>`;
}
