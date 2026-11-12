// Resumen fijo del viaje de 1 día o menos: no hay dinero, solo si la solicitud está lista y cuántas cosas quedarán registradas en el PDF.
import { h, icono } from '../utils/dom.js';
import { nivelesBajos } from './datosCorto.js';
import { erroresVigentes } from './erroresForm.js';
import { t } from '../textos.js';

export function crearResumenCorto(ctx, { alReintentar }) {
  const estado = h('div', { class: 'vi-resumen__estado vi-resumen__estado--corto', id: 'vi-sol-resumen-corto-estado', 'aria-live': 'polite' });
  const el = h('div', { class: 'vi-resumen vi-resumen--corto', id: 'vi-sol-resumen-corto', role: 'region', 'aria-label': t('formulario.resumenCorto.titulo') }, estado);

  function pintar() {
    if (ctx.errorCalculo) {
      estado.replaceChildren(icono('alert-circle-outline'), h('span', { text: t('formulario.resumen.errorCalculo', { motivo: ctx.errorCalculo }) }),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: t('comun.reintentar'), onclick: alReintentar }));
      return;
    }
    if (ctx.calculando || !ctx.respuesta) {
      const spinner = icono('sync-outline');
      spinner.classList.add('spin-animation');
      estado.replaceChildren(spinner, h('span', { text: t('formulario.resumenCorto.validando') }));
      return;
    }
    if (erroresVigentes(ctx).length || !ctx.respuesta.valido) {
      estado.replaceChildren(icono('alert-circle-outline'), h('span', { text: t('formulario.resumenCorto.pendiente') }));
      return;
    }
    const registradas = ctx.respuesta.advertencias.length + nivelesBajos(ctx.estado, ctx.catalogos).length;
    estado.replaceChildren(icono('checkmark-circle-outline'),
      h('span', { text: t('formulario.resumenCorto.valida') + (registradas ? ` ${t(registradas === 1 ? 'formulario.resumenCorto.registrada' : 'formulario.resumenCorto.registradas', { n: registradas })}` : '') }));
  }

  for (const clave of ['resultado', 'calculando', 'catalogos', '*']) ctx.suscribir(clave, pintar, true);
  pintar();
  return { el };
}
