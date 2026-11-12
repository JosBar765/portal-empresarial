// Sección «Otros gastos»: peajes, parqueos, etc.; el tipo sale del catálogo y el total lo calcula el servidor.
import { h } from '../../utils/dom.js';
import { LIMITES_SOLICITUD } from '../../config/constantes.js';
import { crearCombo, opcionesDe } from '../../components/comboAgrupado.js';
import { crearCampo, crearSeccionForm } from '../../components/campo.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { crearBotonAgregar, crearBotonQuitar, crearTotales, ponerTotal } from '../../components/renglones.js';
import { formatearDinero } from '../../utils/formato.js';
import { aId } from '../datos.js';
import { t } from '../../textos.js';

export function crearSeccionGastos(ctx) {
  const { estado, catalogos } = ctx;
  const filas = h('div', { class: 'vi-renglones', id: 'vi-sol-gastos' });
  const vacio = h('p', { class: 'vi-ayuda vi-vacio', text: t('formulario.gastos.vacio') });
  const cabecera = h('div', { class: 'vi-renglon vi-renglon--gasto vi-renglon--cabecera', 'aria-hidden': 'true' },
    h('span', { text: t('formulario.gastos.tipo') }), h('span', { text: t('formulario.gastos.descripcionMax', { max: LIMITES_SOLICITUD.DESCRIPCION }) }),
    h('span', { id: 'vi-sol-gasto-monto-cab' }), h('span'));
  const listaCampo = h('div', { class: 'form-field vi-lista-campo', 'data-campo': 'gastos' }, cabecera, filas);
  const totales = crearTotales([{ id: 'vi-sol-total-otros', etiqueta: t('formulario.gastos.total'), valor: formatearDinero(ctx.simbolo(), 0), fuerte: true }], { id: 'vi-sol-totales-gastos' });
  const contenedorAgregar = h('div', { class: 'vi-agregar' });
  const etiquetaMonto = () => (ctx.simbolo() ? `${t('formulario.gastos.monto')} (${ctx.simbolo()})` : t('formulario.gastos.monto'));

  function renglon(i) {
    const fila = estado.gastos[i];
    const combo = crearCombo({
      id: `vi-sol-gasto-tipo-${i}`, name: `gastos[${i}].tipoGastoId`, etiquetaAria: t('formulario.gastos.tipoDelGasto', { n: i + 1 }), placeholder: t('formulario.gastos.tipoPlaceholder'),
      grupos: [{ opciones: opcionesDe(catalogos.tiposGasto, g => g.nombre) }], valor: fila.tipoGastoId,
      alCambiar: (v) => { fila.tipoGastoId = aId(v); ctx.cambio('gastos'); }
    });
    const descripcion = h('input', {
      type: 'text', id: `vi-sol-gasto-descripcion-${i}`, name: `gastos[${i}].descripcion`, maxlength: String(LIMITES_SOLICITUD.DESCRIPCION), autocomplete: 'off',
      value: fila.descripcion, 'aria-label': t('formulario.gastos.descripcionDelGasto', { n: i + 1 })
    });
    descripcion.addEventListener('input', () => { fila.descripcion = descripcion.value; ctx.cambio('gastos'); });
    const monto = crearCampoNumerico({
      id: `vi-sol-gasto-monto-${i}`, name: `gastos[${i}].monto`, valor: fila.monto, etiquetaAria: etiquetaMonto(),
      alCambiar: (v) => { fila.monto = v; ctx.cambio('gastos'); }
    });
    return h('div', { class: 'vi-renglon vi-renglon--gasto', 'data-fila': String(i) },
      h('span', { class: 'vi-renglon__titulo', text: t('formulario.gastos.titulo', { n: i + 1 }) }),
      crearCampo({ etiqueta: t('formulario.gastos.tipo'), control: combo, idControl: `vi-sol-gasto-tipo-${i}`, soloMovil: true }),
      crearCampo({ etiqueta: t('formulario.gastos.descripcionMax', { max: LIMITES_SOLICITUD.DESCRIPCION }), control: descripcion, idControl: `vi-sol-gasto-descripcion-${i}`, soloMovil: true }),
      crearCampo({ etiqueta: etiquetaMonto(), control: monto, idControl: `vi-sol-gasto-monto-${i}`, soloMovil: true }),
      crearBotonQuitar({ etiqueta: t('formulario.gastos.quitar', { n: i + 1 }), alPulsar: () => quitar(i) }));
  }

  function pintar(foco) {
    filas.replaceChildren(...estado.gastos.map((_, i) => renglon(i)));
    cabecera.style.display = estado.gastos.length ? '' : 'none';
    vacio.style.display = estado.gastos.length ? 'none' : '';
    cabecera.querySelector('#vi-sol-gasto-monto-cab').textContent = etiquetaMonto();
    contenedorAgregar.replaceChildren(crearBotonAgregar({ texto: t('formulario.gastos.agregar'), alPulsar: agregar, deshabilitado: estado.gastos.length >= LIMITES_SOLICITUD.MAX_GASTOS }));
    if (foco) { const nodo = filas.querySelector(`#${foco}`); if (nodo) nodo.focus(); }
    mostrarTotal();
  }

  function mostrarTotal() {
    const g = ctx.respuesta && ctx.respuesta.desglose && ctx.respuesta.desglose.otrosGastos;
    ponerTotal(totales, 'vi-sol-total-otros', formatearDinero(ctx.simbolo(), g ? g.importe : 0));
  }

  function agregar() {
    estado.gastos = [...estado.gastos, { tipoGastoId: '', descripcion: '', monto: '' }];
    ctx.erroresServidor = [];
    pintar(`vi-sol-gasto-tipo-${estado.gastos.length - 1}`);
    ctx.cambio('gastos');
  }
  function quitar(i) {
    estado.gastos = estado.gastos.filter((_, j) => j !== i);
    ctx.erroresServidor = [];
    pintar();
    ctx.cambio('gastos');
  }

  ctx.suscribir('moneda', () => pintar());
  ctx.suscribir('resultado', mostrarTotal);
  pintar();

  const el = crearSeccionForm({ id: 'vi-sol-seccion-gastos', titulo: t('formulario.seccion.gastos'), ayuda: t('formulario.gastos.ayuda') }, vacio, listaCampo, contenedorAgregar, totales);
  return { el };
}
