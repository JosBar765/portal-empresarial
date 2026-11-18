// Sección «Hospedaje»: renglones de hotel, lugar, noches y valor por noche; el importe total lo calcula el servidor.
import { h } from '../../utils/dom.js';
import { LIMITES_SOLICITUD } from '../../config/constantes.js';
import { crearCampo, crearSeccionForm } from '../../components/campo.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { crearBotonAgregar, crearBotonQuitar, crearTotales, ponerTotal } from '../../components/renglones.js';
import { formatearDinero } from '../../utils/formato.js';
import { formatearCantidad } from '../../utils/numero.js';
import { totalNochesLocal } from '../datos.js';
import { t } from '../../textos.js';

export function crearSeccionHospedaje(ctx) {
  const { estado } = ctx;
  const filas = h('div', { class: 'vi-renglones', id: 'vi-sol-hospedajes' });
  const vacio = h('p', { class: 'vi-ayuda vi-vacio', text: t('formulario.hospedaje.vacio') });
  const cabecera = h('div', { class: 'vi-renglon vi-renglon--hospedaje vi-renglon--cabecera', 'aria-hidden': 'true' },
    h('span', { text: t('formulario.hospedaje.hotel') }), h('span', { text: t('formulario.hospedaje.lugar') }),
    h('span', { text: t('formulario.hospedaje.noches') }), h('span', { id: 'vi-sol-hospedaje-valor-cab' }), h('span'));
  const listaCampo = h('div', { class: 'form-field vi-lista-campo', 'data-campo': 'hospedajes' }, cabecera, filas);
  const totales = crearTotales([
    { id: 'vi-sol-total-noches', etiqueta: t('formulario.hospedaje.totalNoches'), valor: '0', fuerte: true },
    { id: 'vi-sol-total-hospedaje', etiqueta: t('formulario.hospedaje.totalHospedaje'), valor: formatearDinero(ctx.simbolo(), 0), fuerte: true }
  ], { id: 'vi-sol-totales-hospedaje' });
  const contenedorAgregar = h('div', { class: 'vi-agregar' });
  const etiquetaValor = () => (ctx.simbolo() ? `${t('formulario.hospedaje.valorNoche')} (${ctx.simbolo()})` : t('formulario.hospedaje.valorNoche'));

  function texto(i, propiedad, max, etiqueta) {
    const id = `vi-sol-hospedaje-${propiedad}-${i}`;
    const input = h('input', { type: 'text', id, name: `hospedajes[${i}].${propiedad}`, maxlength: String(max), autocomplete: 'off', value: estado.hospedajes[i][propiedad], 'aria-label': etiqueta });
    input.addEventListener('input', () => { estado.hospedajes[i][propiedad] = input.value; ctx.cambio('hospedaje'); });
    return crearCampo({ etiqueta, control: input, idControl: id, soloMovil: true });
  }

  function numero(i, propiedad, etiqueta, entero) {
    const id = `vi-sol-hospedaje-${propiedad}-${i}`;
    const input = crearCampoNumerico({
      id, name: `hospedajes[${i}].${propiedad}`, valor: estado.hospedajes[i][propiedad], etiquetaAria: etiqueta, entero,
      alCambiar: (v) => { estado.hospedajes[i][propiedad] = v; ctx.cambio('hospedaje'); }
    });
    return crearCampo({ etiqueta, control: input, idControl: id, soloMovil: true });
  }

  const renglon = (i) => h('div', { class: 'vi-renglon vi-renglon--hospedaje', 'data-fila': String(i) },
    h('span', { class: 'vi-renglon__titulo', text: t('formulario.hospedaje.titulo', { n: i + 1 }) }),
    texto(i, 'hotel', LIMITES_SOLICITUD.HOTEL, t('formulario.hospedaje.hotelMax', { max: LIMITES_SOLICITUD.HOTEL })),
    texto(i, 'lugar', LIMITES_SOLICITUD.LUGAR, t('formulario.hospedaje.lugarMax', { max: LIMITES_SOLICITUD.LUGAR })),
    numero(i, 'noches', t('formulario.hospedaje.noches'), true),
    numero(i, 'valorNoche', etiquetaValor(), false),
    crearBotonQuitar({ etiqueta: t('formulario.hospedaje.quitar', { n: i + 1 }), alPulsar: () => quitar(i) }));

  function pintar(foco) {
    filas.replaceChildren(...estado.hospedajes.map((_, i) => renglon(i)));
    cabecera.style.display = estado.hospedajes.length ? '' : 'none';
    vacio.style.display = estado.hospedajes.length ? 'none' : '';
    cabecera.querySelector('#vi-sol-hospedaje-valor-cab').textContent = etiquetaValor();
    contenedorAgregar.replaceChildren(crearBotonAgregar({ texto: t('formulario.hospedaje.agregar'), alPulsar: agregar, deshabilitado: estado.hospedajes.length >= LIMITES_SOLICITUD.MAX_HOSPEDAJES }));
    if (foco) { const nodo = filas.querySelector(`#${foco}`); if (nodo) nodo.focus(); }
    mostrarTotales();
  }

  // Las noches son un conteo (respaldo local); el dinero siempre viene del servidor.
  function mostrarTotales() {
    const h2 = ctx.respuesta && ctx.respuesta.desglose && ctx.respuesta.desglose.hospedaje;
    const usaServidor = h2 && !ctx.calculando;
    ponerTotal(totales, 'vi-sol-total-noches', formatearCantidad(usaServidor ? h2.totalNoches : totalNochesLocal(estado.hospedajes)));
    ponerTotal(totales, 'vi-sol-total-hospedaje', formatearDinero(ctx.simbolo(), h2 ? h2.importe : 0));
  }

  function agregar() {
    estado.hospedajes = [...estado.hospedajes, { hotel: '', lugar: '', noches: '', valorNoche: '' }];
    ctx.erroresServidor = [];
    pintar(`vi-sol-hospedaje-hotel-${estado.hospedajes.length - 1}`);
    ctx.cambio('hospedaje');
  }
  function quitar(i) {
    estado.hospedajes = estado.hospedajes.filter((_, j) => j !== i);
    ctx.erroresServidor = [];
    pintar();
    ctx.cambio('hospedaje');
  }

  ctx.suscribir('moneda', () => pintar());
  ctx.suscribir('resultado', mostrarTotales);
  ctx.suscribir('calculando', mostrarTotales);
  pintar();

  const el = crearSeccionForm({ id: 'vi-sol-seccion-hospedaje', titulo: t('formulario.seccion.hospedaje') }, vacio, listaCampo, contenedorAgregar, totales);
  return { el };
}
