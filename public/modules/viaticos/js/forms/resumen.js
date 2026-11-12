// Resumen fijo al pie del cuerpo del modal: importes por rubro y el total solicitado; todo viene de `totales` del servidor.
import { h, icono } from '../utils/dom.js';
import { formatearDinero } from '../utils/formato.js';
import { t } from '../textos.js';

const RUBROS = [
  ['combustible', 'formulario.resumen.combustible'],
  ['depreciacion', 'formulario.resumen.depreciacion'],
  ['hospedaje', 'formulario.resumen.hospedaje'],
  ['comidas', 'formulario.resumen.comidas'],
  ['otrosGastos', 'formulario.resumen.otros']
];

// `alReintentar` se llama desde el botón que aparece si el cálculo falló.
export function crearResumen(ctx, { alReintentar }) {
  const estado = h('div', { class: 'vi-resumen__estado', id: 'vi-sol-resumen-estado', 'aria-live': 'polite' });
  const filas = RUBROS.map(([clave, texto]) => h('div', { class: 'vi-resumen__fila', 'data-rubro': clave },
    h('span', { text: t(texto) }), h('span', { id: `vi-sol-res-${clave}`, text: '' })));
  const total = h('span', { id: 'vi-sol-res-total', class: 'vi-resumen__total-valor', text: '' });
  const el = h('div', { class: 'vi-resumen', id: 'vi-sol-resumen', role: 'region', 'aria-label': t('formulario.resumen.titulo') },
    estado, filas, h('div', { class: 'vi-resumen__total' }, h('span', { text: t('formulario.resumen.total') }), total));

  function pintar() {
    const simbolo = ctx.simbolo();
    const totales = ctx.respuesta && ctx.respuesta.totales;
    const esPropio = !ctx.vehiculo() || ctx.vehiculo().esPropio;
    for (const [clave] of RUBROS) {
      const fila = el.querySelector(`[data-rubro="${clave}"]`);
      if (clave === 'depreciacion') fila.style.display = esPropio ? '' : 'none';
      el.querySelector(`#vi-sol-res-${clave}`).textContent = formatearDinero(simbolo, totales ? totales[clave] : 0);
    }
    total.textContent = formatearDinero(simbolo, totales ? totales.totalSolicitado : 0);
    if (ctx.errorCalculo) {
      estado.replaceChildren(icono('alert-circle-outline'), h('span', { text: t('formulario.resumen.errorCalculo', { motivo: ctx.errorCalculo }) }),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: t('comun.reintentar'), onclick: alReintentar }));
    } else if (ctx.calculando) {
      const spinner = icono('sync-outline');
      spinner.classList.add('spin-animation');
      estado.replaceChildren(spinner, h('span', { text: t('formulario.resumen.calculando') }));
    } else {
      estado.replaceChildren();
    }
  }

  for (const clave of ['resultado', 'calculando', 'moneda', 'vehiculo', 'catalogos']) ctx.suscribir(clave, pintar, true);
  pintar();
  return { el };
}
