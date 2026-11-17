// Subpestaña «Vencimientos»: horas que una solicitud rechazada espera antes de pasar a borrador y vigencia y tope de los borradores.
import { state } from '../../state.js';
import { h, montar } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { guardarAjuste, listarAjustes, mensajesDeError } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearAviso } from '../../components/aviso.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { limpiarErrorCampo, marcarErrorCampo } from '../../components/validacion.js';
import { estadoLista } from './lista.js';
import { CAMPOS, ajustesCambiados, ajustesIniciales, validarAjustes, valorDeAjuste } from './vencimientoModelo.js';

const idDe = (clave) => `vi-venc-${clave.replace(/_/g, '-')}`;

export function renderVencimiento(contenedor) {
  let iniciales = {};
  let actuales = {};
  let guardando = false;
  let numeroCarga = 0;
  let refs = null;
  // Los cambios de subpestaña vacían el panel: si `raiz` ya no está conectada, las respuestas tardías no pintan nada.
  const raiz = h('div', { class: 'vi-vencimiento-raiz' });
  contenedor.replaceChildren(raiz);

  const hayCambios = () => ajustesCambiados(iniciales, actuales).length > 0;
  const antesDeSalir = (e) => { if (hayCambios()) { e.preventDefault(); e.returnValue = ''; } };

  // La vista le dice al shell (y a la barra lateral) que pida confirmación al salir con ajustes sin guardar.
  state.salidaVista = {
    confirmar: async () => !hayCambios() || confirmarModal({
      title: t('config.cambios.titulo'), mensaje: t('config.vencimiento.cambios.mensaje'), aceptar: t('config.cambios.salir'), cancelar: t('config.cambios.quedarme'), peligro: true
    }),
    liberar: () => window.removeEventListener('beforeunload', antesDeSalir)
  };
  window.addEventListener('beforeunload', antesDeSalir);

  const tarjeta = (...hijos) => h('section', { class: 'vi-seccion vi-config-seccion', 'aria-label': t('config.vencimiento.titulo') },
    h('div', { class: 'vi-seccion-cabecera' }, h('div', { class: 'vi-config-titulos' },
      h('h2', { text: t('config.vencimiento.titulo') }),
      h('p', { class: 'vi-config-subtitulo', text: t('config.vencimiento.subtitulo') }))),
    hijos);

  function actualizarBotones() {
    if (!refs) return;
    const cambios = hayCambios();
    refs.guardar.disabled = !cambios || guardando;
    refs.descartar.disabled = !cambios || guardando;
  }

  function alCambiar() {
    refs.avisos.replaceChildren();
    actualizarBotones();
  }

  function pintar() {
    const campos = CAMPOS.map(({ clave, min, max, ejemplo }) => {
      const input = crearCampoNumerico({
        id: idDe(clave), name: clave, valor: actuales[clave], entero: true, placeholder: t('config.vencimiento.ph', { ejemplo }),
        alCambiar: (valor) => { actuales[clave] = valor; limpiarErrorCampo(input); alCambiar(); }
      });
      const nodo = h('div', { class: 'form-field', 'data-campo': clave },
        h('label', { for: idDe(clave), text: t(`config.vencimiento.campo.${clave}`) }),
        input,
        h('span', { class: 'form-hint', text: t(`config.vencimiento.ayuda.${clave}`, { min, max }) }));
      return { clave, input, nodo };
    });
    const avisos = h('div', { class: 'vi-avisos', 'aria-live': 'polite' });
    const descartar = h('button', { class: 'btn btn--ghost', id: 'vi-venc-descartar', type: 'button', text: t('config.vencimiento.descartar'), onclick: descartarCambios });
    const guardar = h('button', { class: 'btn btn--primary', id: 'vi-venc-guardar', type: 'button', text: t('config.vencimiento.guardar'), onclick: guardarCambios });
    refs = { inputs: Object.fromEntries(campos.map(c => [c.clave, c.input])), avisos, guardar, descartar };
    montar(raiz, tarjeta(
      h('div', { class: 'vi-config-nota' }, crearAviso({ tipo: 'info', titulo: t('config.vencimiento.nota.titulo'), texto: t('config.vencimiento.nota.texto') })),
      avisos,
      h('form', { class: 'form-grid vi-config-form', id: 'vi-venc-form', novalidate: true, onsubmit: (e) => e.preventDefault() }, campos.map(c => c.nodo)),
      h('div', { class: 'vi-config-pie' }, descartar, guardar)));
    actualizarBotones();
  }

  function descartarCambios() {
    actuales = { ...iniciales };
    CAMPOS.forEach(({ clave }) => { refs.inputs[clave].value = actuales[clave]; limpiarErrorCampo(refs.inputs[clave]); });
    refs.avisos.replaceChildren();
    actualizarBotones();
  }

  async function guardarCambios() {
    if (guardando || !hayCambios()) return;
    Object.values(refs.inputs).forEach(limpiarErrorCampo);
    refs.avisos.replaceChildren();
    // Solo bloquean los errores de lo que cambió; un ajuste sin tocar se valida cuando se edita.
    const cambiados = ajustesCambiados(iniciales, actuales);
    const bloqueantes = Object.entries(validarAjustes(actuales)).filter(([clave]) => cambiados.includes(clave));
    if (bloqueantes.length) {
      bloqueantes.forEach(([clave, mensaje]) => marcarErrorCampo(refs.inputs[clave], mensaje));
      refs.inputs[bloqueantes[0][0]].focus();
      return;
    }
    guardando = true;
    actualizarBotones();
    const fallidos = [];
    for (const clave of cambiados) {
      try {
        await guardarAjuste(clave, valorDeAjuste(clave, actuales));
        if (!raiz.isConnected) return;
        iniciales[clave] = String(actuales[clave]).trim();
      } catch (error) {
        if (!raiz.isConnected) return;
        fallidos.push([clave, error]);
      }
    }
    guardando = false;
    let primero = null;
    for (const [clave, error] of fallidos) {
      const deCampo = error.status === 400 && error.campos && error.campos.valor;
      if (deCampo) {
        marcarErrorCampo(refs.inputs[clave], String(error.campos.valor));
        primero = primero || refs.inputs[clave];
      } else {
        refs.avisos.append(crearAviso({ tipo: 'error', titulo: t('config.vencimiento.errorGuardar'), texto: mensajesDeError(error).join(' ') }));
      }
    }
    if (primero) primero.focus();
    if (!fallidos.length) window.toast?.success(t('tab.configuracion'), t('config.vencimiento.exito'));
    actualizarBotones();
  }

  async function cargar() {
    const numero = ++numeroCarga;
    montar(raiz, tarjeta(estadoLista({ icono: 'sync-outline', spinner: true, texto: t('config.vencimiento.cargando') })));
    try {
      const lista = await listarAjustes();
      if (numero !== numeroCarga || !raiz.isConnected) return;
      iniciales = ajustesIniciales(lista);
      actuales = { ...iniciales };
      pintar();
    } catch (error) {
      if (numero !== numeroCarga || !raiz.isConnected) return;
      refs = null;
      montar(raiz, tarjeta(estadoLista({ icono: 'alert-circle-outline', titulo: t('config.vencimiento.error'), texto: error.message, error: true, alReintentar: () => cargar() })));
    }
  }

  return cargar();
}
