// Sección «Fecha de salida y motivo» del viaje de 1 día o menos: fecha, hora (HH:mm), motivo y las advertencias del servidor.
import { h } from '../../utils/dom.js';
import { crearCombo, opcionesDe } from '../../components/comboAgrupado.js';
import { crearCampo, crearSeccionForm } from '../../components/campo.js';
import { crearCampoFecha } from '../../components/campoFecha.js';
import { crearAviso } from '../../components/aviso.js';
import { wireCampoFecha } from '../../components/datepicker.js';
import { hoyMedianoche, parseIsoLocal } from '../../utils/fechas.js';
import { aId } from '../datos.js';
import { TITULO_ADVERTENCIA } from './fechas.js';
import { t } from '../../textos.js';

export function crearSeccionFechasCorto(ctx) {
  const { estado, catalogos } = ctx;
  const campoFecha = crearCampoFecha({ id: 'vi-sol-salida', name: 'fechaSalida', etiqueta: t('formulario.fechas.salida') });
  const hora = h('input', { type: 'time', id: 'vi-sol-hora', name: 'horaSalida', step: '60', value: estado.horaSalida, 'aria-label': t('formulario.fechas.hora') });
  const motivo = crearCombo({
    id: 'vi-sol-motivo', name: 'motivoId', etiquetaAria: t('formulario.fechas.motivo'), placeholder: t('formulario.fechas.motivoPlaceholder'),
    grupos: [{ opciones: opcionesDe(catalogos.motivos, m => m.nombre) }], valor: estado.motivoId,
    alCambiar: (v) => { estado.motivoId = aId(v); ctx.cambio('motivo'); }
  });
  const avisos = h('div', { class: 'vi-avisos', id: 'vi-sol-advertencias', 'aria-live': 'polite' });
  const raiz = h('div', { class: 'vi-grid vi-grid--3' }, campoFecha,
    crearCampo({ etiqueta: t('formulario.fechas.hora'), control: hora, idControl: 'vi-sol-hora' }),
    crearCampo({ etiqueta: t('formulario.fechas.motivo'), control: motivo, idControl: 'vi-sol-motivo' }));

  const salida = wireCampoFecha(raiz, 'fechaSalida', { minDate: hoyMedianoche() });
  if (estado.fechaSalida) salida.setDate(parseIsoLocal(estado.fechaSalida), { silent: true });
  raiz.querySelector('[name="fechaSalida"]').addEventListener('change', (e) => { estado.fechaSalida = e.target.value; ctx.cambio('fechas'); });
  hora.addEventListener('input', () => { estado.horaSalida = hora.value; ctx.cambio('fechas'); });

  function pintarAdvertencias() {
    const lista = (ctx.respuesta && ctx.respuesta.advertencias) || [];
    avisos.replaceChildren(...lista.map(a => crearAviso({ tipo: 'warning', titulo: t(TITULO_ADVERTENCIA[a.clave] || 'formulario.advertencia.generica'), texto: a.mensaje })));
  }
  ctx.suscribir('resultado', pintarAdvertencias);
  pintarAdvertencias();

  const el = crearSeccionForm({ id: 'vi-sol-seccion-fechas', titulo: t('formulario.seccion.fechasCorto') }, raiz, avisos);
  return { el };
}
