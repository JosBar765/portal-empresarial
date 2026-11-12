// Parte superior de la liquidación: tres tarjetas de dinero, barra de avance y una tarjeta por rubro pendiente.
import { h, icono } from '../../utils/dom.js';
import { formatearDinero } from '../../utils/formato.js';
import { RUBRO_HOSPEDAJE } from '../../config/constantes.js';
import { pendienteCompleto, porcentajeAvance, textoProgreso } from './datos.js';
import { t } from '../../textos.js';

const tarjeta = (id, etiqueta) => h('div', { class: 'vi-liq-tarjeta' },
  h('span', { class: 'vi-liq-tarjeta__etiqueta', text: etiqueta }),
  h('strong', { class: 'vi-liq-tarjeta__valor', id, text: '—' }));

export function crearResumenLiquidacion() {
  const solicitado = tarjeta('vi-liq-solicitado', t('liquidacion.resumen.solicitado'));
  const liquidado = tarjeta('vi-liq-liquidado', t('liquidacion.resumen.liquidado'));
  const falta = tarjeta('vi-liq-falta', t('liquidacion.resumen.falta'));
  const valorAvance = h('span', { class: 'vi-liq-avance__valor', id: 'vi-liq-avance-valor', text: '0 %' });
  const relleno = h('div', { class: 'vi-liq-avance__relleno', id: 'vi-liq-avance-relleno' });
  const barra = h('div', { class: 'vi-liq-avance__barra', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-labelledby': 'vi-liq-avance-etiqueta' }, relleno);
  const pendientes = h('div', { class: 'vi-liq-pendientes', id: 'vi-liq-pendientes' });

  const el = h('div', { class: 'vi-liq-resumen' },
    h('div', { class: 'vi-liq-tarjetas' }, solicitado, liquidado, falta),
    h('div', { class: 'vi-liq-avance' },
      h('div', { class: 'vi-liq-avance__texto' }, h('span', { id: 'vi-liq-avance-etiqueta', text: t('liquidacion.avance.etiqueta') }), valorAvance),
      barra),
    h('section', { class: 'vi-liq-seccion', 'aria-labelledby': 'vi-liq-pendiente-titulo' },
      h('h4', { class: 'vi-form-seccion__titulo', id: 'vi-liq-pendiente-titulo', text: t('liquidacion.pendiente.titulo') }),
      h('p', { class: 'vi-ayuda', text: t('liquidacion.pendiente.ayuda') }),
      pendientes));

  // Se repinta con cada respuesta del servidor (carga, comprobante agregado o quitado); el cliente no calcula dinero.
  function actualizar(liq) {
    const simbolo = liq.moneda ? liq.moneda.simbolo : '';
    solicitado.querySelector('strong').textContent = formatearDinero(simbolo, liq.resumen.solicitadoALiquidar);
    liquidado.querySelector('strong').textContent = formatearDinero(simbolo, liq.resumen.liquidado);
    falta.querySelector('strong').textContent = formatearDinero(simbolo, liq.resumen.faltaPorLiquidar);
    const n = porcentajeAvance(liq.resumen.liquidado, liq.resumen.solicitadoALiquidar);
    valorAvance.textContent = t('liquidacion.avance.valor', { n });
    barra.setAttribute('aria-valuenow', String(n));
    barra.setAttribute('aria-valuetext', t('liquidacion.avance.aria', { n }));
    relleno.style.width = `${n}%`;
    if (!liq.pendientes.length) {
      pendientes.replaceChildren(h('p', { class: 'vi-ayuda vi-vacio', text: t('liquidacion.pendiente.vacio') }));
      return;
    }
    pendientes.replaceChildren(...liq.pendientes.map(p => {
      const completo = pendienteCompleto(p);
      const progreso = textoProgreso(p, RUBRO_HOSPEDAJE);
      return h('div', { class: `vi-liq-rubro${completo ? ' is-completo' : ''}`, 'data-tipo-gasto': String(p.tipoGastoId) },
        h('div', { class: 'vi-liq-rubro__cab' },
          h('strong', { text: p.nombre }),
          completo && h('span', { class: 'vi-liq-rubro__visto', title: t('liquidacion.pendiente.completo') }, icono('checkmark-outline'), h('span', { class: 'vi-solo-lector', text: t('liquidacion.pendiente.completo') }))),
        h('span', { class: 'vi-liq-rubro__progreso', text: t(progreso.clave, progreso.params) }));
    }));
  }

  return { el, actualizar };
}
