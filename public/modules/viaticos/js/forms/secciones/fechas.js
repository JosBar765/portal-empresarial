// Sección «Fechas y motivo»: salida, regreso, motivo y las advertencias del servidor (vigencias que vencen durante el viaje).
import { h } from '../../utils/dom.js';
import { crearCombo, opcionesDe } from '../../components/comboAgrupado.js';
import { crearCampo, crearSeccionForm } from '../../components/campo.js';
import { crearCampoFecha } from '../../components/campoFecha.js';
import { crearAviso } from '../../components/aviso.js';
import { wireCampoFecha } from '../../components/datepicker.js';
import { hoyMedianoche, parseIsoLocal, sumarDiaLocal } from '../../utils/fechas.js';
import { aId } from '../datos.js';
import { t } from '../../textos.js';

// Las claves de las advertencias son los nombres de las salvedades del servidor.
export const TITULO_ADVERTENCIA = {
  licencia: 'formulario.advertencia.licencia',
  'tarjeta de circulación': 'formulario.advertencia.tarjeta',
  seguro: 'formulario.advertencia.seguro'
};

export function crearSeccionFechas(ctx) {
  const { estado, catalogos } = ctx;
  const campoSalida = crearCampoFecha({ id: 'vi-sol-salida', name: 'fechaSalida', etiqueta: t('formulario.fechas.salida') });
  const campoRegreso = crearCampoFecha({ id: 'vi-sol-regreso', name: 'fechaRegreso', etiqueta: t('formulario.fechas.regreso') });
  const motivo = crearCombo({
    id: 'vi-sol-motivo', name: 'motivoId', etiquetaAria: t('formulario.fechas.motivo'), placeholder: t('formulario.fechas.motivoPlaceholder'),
    grupos: [{ opciones: opcionesDe(catalogos.motivos, m => m.nombre) }], valor: estado.motivoId,
    alCambiar: (v) => { estado.motivoId = aId(v); ctx.cambio('motivo'); }
  });
  const avisos = h('div', { class: 'vi-avisos', id: 'vi-sol-advertencias', 'aria-live': 'polite' });
  const raiz = h('div', { class: 'vi-grid vi-grid--3' }, campoSalida, campoRegreso, crearCampo({ etiqueta: t('formulario.fechas.motivo'), control: motivo, idControl: 'vi-sol-motivo' }));

  const hoy = hoyMedianoche();
  const minimoRegreso = (salida) => sumarDiaLocal(salida || hoy, 1);
  const salida = wireCampoFecha(raiz, 'fechaSalida', { minDate: hoy });
  const regreso = wireCampoFecha(raiz, 'fechaRegreso', { minDate: minimoRegreso(parseIsoLocal(estado.fechaSalida)) });
  if (estado.fechaSalida) salida.setDate(parseIsoLocal(estado.fechaSalida), { silent: true });
  if (estado.fechaRegreso) regreso.setDate(parseIsoLocal(estado.fechaRegreso), { silent: true });

  // Un regreso que deja de ser posterior a la salida lo borra el selector y avisa con su propio `change`.
  raiz.querySelector('[name="fechaSalida"]').addEventListener('change', (e) => {
    estado.fechaSalida = e.target.value;
    regreso.setMinDate(minimoRegreso(salida.getDate()));
    ctx.cambio('fechas');
  });
  raiz.querySelector('[name="fechaRegreso"]').addEventListener('change', (e) => {
    estado.fechaRegreso = e.target.value;
    ctx.cambio('fechas');
  });

  function pintarAdvertencias() {
    const lista = (ctx.respuesta && ctx.respuesta.advertencias) || [];
    avisos.replaceChildren(...lista.map(a => crearAviso({ tipo: 'warning', titulo: t(TITULO_ADVERTENCIA[a.clave] || 'formulario.advertencia.generica'), texto: a.mensaje })));
  }
  ctx.suscribir('resultado', pintarAdvertencias);
  pintarAdvertencias();

  const el = crearSeccionForm({ id: 'vi-sol-seccion-fechas', titulo: t('formulario.seccion.fechas') }, raiz, avisos);
  return { el };
}
