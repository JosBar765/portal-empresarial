// Liquidación del solicitante: modal con el resumen, los rubros pendientes, los comprobantes y el botón «Liquidar».
// «Liquidar» queda habilitado aunque falten comprobantes (decisión del dueño): lo que falta solo se informa en un aviso.
import { state } from '../state.js';
import { h, icono } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { abrirModal, confirmarModal } from '../components/modal.js';
import { crearAviso } from '../components/aviso.js';
import { liquidarSolicitud, mensajesDeError, obtenerLiquidacion } from '../api/viaticosApi.js';
import { registrarAccionPropia } from '../socket.js';
import { crearResumenLiquidacion } from './liquidacion/resumen.js';
import { crearComprobantes } from './liquidacion/comprobantes.js';
import { t } from '../textos.js';

// `alTerminar` recarga la lista tras liquidar (se recibe como función para no importar la vista: evita un ciclo de imports).
// Devuelve { overlay, cerrar, listo }; `listo` se cumple cuando la carga inicial terminó (bien o mal).
export function abrirLiquidacion(solicitud, { alTerminar } = {}) {
  let liq = null;
  let cerrado = false;
  let liquidando = false;
  let numeroCarga = 0;
  let comprobantes = null;

  const { overlay, cerrar } = abrirModal({
    title: t('liquidacion.titulo', { correlativo: solicitud.correlativo }),
    subtitle: t('liquidacion.subtitulo.inicial'),
    size: 'lg',
    clase: 'vi-modal-liquidacion',
    bodyHtml: '',
    footerHtml: `<button class="btn btn--ghost" type="button" id="vi-liq-cerrar">${escapeHtml(t('comun.cerrar'))}</button>
      <button class="btn btn--primary" type="button" id="vi-liq-liquidar" disabled>${escapeHtml(t('liquidacion.liquidar'))}</button>`,
    antesDeCerrar: async () => {
      if (liquidando || (comprobantes && comprobantes.enCurso())) return false;
      if (!comprobantes || !comprobantes.hayBorradores()) return true;
      return confirmarModal({
        title: t('liquidacion.cerrar.titulo'), mensaje: t('liquidacion.cerrar.mensaje'),
        aceptar: t('liquidacion.cerrar.salir'), cancelar: t('liquidacion.cerrar.seguir'), peligro: true
      });
    },
    alCerrar: () => { cerrado = true; if (comprobantes) comprobantes.soltar(); }
  });
  const cuerpo = overlay.querySelector('.modal-body');
  const botonLiquidar = overlay.querySelector('#vi-liq-liquidar');
  overlay.querySelector('#vi-liq-cerrar').addEventListener('click', () => overlay.querySelector('.modal-close').click());

  const avisos = h('div', { class: 'vi-avisos', id: 'vi-liq-avisos', 'aria-live': 'polite' });
  const resumen = crearResumenLiquidacion();

  // Los avisos salen del servidor: el de lo que falta se informa, nunca bloquea.
  function pintarAvisos(extra) {
    avisos.replaceChildren(
      !liq.puedeLiquidar && liq.motivoNoPuedeLiquidar && crearAviso({ tipo: 'info', titulo: t('liquidacion.avisoMotivo.titulo'), texto: liq.motivoNoPuedeLiquidar }),
      liq.avisoFaltantes && crearAviso({ tipo: 'warning', titulo: t('liquidacion.avisoFaltantes.titulo'), texto: liq.avisoFaltantes }),
      extra);
  }

  function actualizarBoton() {
    botonLiquidar.disabled = !liq || !liq.puedeLiquidar || liquidando;
  }

  // Única vía por la que cambia la liquidación mostrada: carga, comprobante agregado o quitado.
  function aplicar(nueva) {
    liq = nueva;
    overlay.querySelector('.modal-subtitulo').textContent = nueva.moneda
      ? t('liquidacion.subtitulo', { moneda: nueva.moneda.nombre, simbolo: nueva.moneda.simbolo })
      : t('liquidacion.subtitulo.inicial');
    resumen.actualizar(nueva);
    pintarAvisos();
    comprobantes.pintar();
    actualizarBoton();
  }

  function estadoDeCarga(nodoIcono, mensaje, { error = false, reintentar = false } = {}) {
    const ico = icono(nodoIcono);
    if (!error) ico.classList.add('spin-animation');
    cuerpo.replaceChildren(h('div', { class: `buzon-vacio${error ? ' buzon-vacio-error' : ''}`, role: error ? 'alert' : 'status' },
      ico,
      error && h('h3', { text: t('liquidacion.errorCarga') }),
      h('p', { text: mensaje }),
      reintentar && h('button', { class: 'btn btn--primary btn--sm', type: 'button', id: 'vi-liq-reintentar', text: t('comun.reintentar'), onclick: cargar })));
  }

  async function cargar() {
    const numero = ++numeroCarga;
    liq = null;
    actualizarBoton();
    estadoDeCarga('sync-outline', t('liquidacion.cargando'));
    try {
      const respuesta = await obtenerLiquidacion(solicitud.id);
      if (cerrado || numero !== numeroCarga) return;
      comprobantes = crearComprobantes({
        solicitudId: solicitud.id,
        ajustes: (state.contexto && state.contexto.ajustes) || null,
        obtenerLiq: () => liq,
        alActualizar: aplicar
      });
      cuerpo.replaceChildren(avisos, resumen.el, comprobantes.el);
      aplicar(respuesta);
    } catch (error) {
      if (cerrado || numero !== numeroCarga) return;
      // Un 403 trae su explicación (ajena, de 1 día o menos, aún sin autorizar): no hay nada que reintentar.
      estadoDeCarga('alert-circle-outline', mensajesDeError(error).join(' '), { error: true, reintentar: error.status !== 403 });
    }
  }

  async function liquidar() {
    if (liquidando || !liq || !liq.puedeLiquidar || (comprobantes && comprobantes.enCurso())) return;
    const mensaje = [
      t('liquidacion.confirmar.mensaje'),
      comprobantes.hayBorradores() && t('liquidacion.confirmar.borradores'),
      liq.avisoFaltantes
    ].filter(Boolean).join(' ');
    liquidando = true;
    botonLiquidar.disabled = true;
    const confirmada = await confirmarModal({ title: t('liquidacion.confirmar.titulo'), mensaje, aceptar: t('liquidacion.confirmar.aceptar') });
    if (!confirmada || cerrado) { liquidando = false; actualizarBoton(); return; }
    botonLiquidar.classList.add('btn--loading');
    try {
      await liquidarSolicitud(solicitud.id);
    } catch (error) {
      liquidando = false;
      botonLiquidar.classList.remove('btn--loading');
      actualizarBoton();
      const texto = mensajesDeError(error).join(' ');
      pintarAvisos(crearAviso({ tipo: 'error', titulo: t('liquidacion.errorLiquidar'), texto }));
      window.toast?.error(t('liquidacion.errorLiquidar'), texto);
      return;
    }
    // El evento de tiempo real no trae al actor: se marca para no avisarle lo que él mismo hizo.
    registrarAccionPropia(solicitud.id);
    window.toast?.success(t('tab.solicitudes'), t('liquidacion.exito', { correlativo: solicitud.correlativo }));
    cerrar();
    if (alTerminar) await alTerminar();
  }

  botonLiquidar.addEventListener('click', liquidar);
  const listo = cargar();
  return { overlay, cerrar, listo };
}
