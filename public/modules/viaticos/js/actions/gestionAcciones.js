// Decisiones de Gestiones: autorizar (con confirmación) y rechazar (con un motivo libre y obligatorio).
import { LIMITES_SOLICITUD } from '../config/constantes.js';
import { abrirModal, confirmarModal, mostrarErrorModal } from '../components/modal.js';
import { crearAviso } from '../components/aviso.js';
import { enfocarPrimerCampoInvalido, limpiarErrorCampo, marcarErrorCampo, marcarErroresDeCampos } from '../components/validacion.js';
import { autorizarGestion, mensajesDeError, rechazarGestion } from '../api/viaticosApi.js';
import { registrarAccionPropia } from '../socket.js';
import { detallesAutorizar, tituloAutorizar, tituloRechazar, validarMotivo } from './gestionDatos.js';
import { escapeHtml } from '../utils/formato.js';
import { t } from '../textos.js';

// Ids con una decisión abierta o enviándose: un doble clic o una segunda acción sobre la misma solicitud no hace nada.
const enCurso = new Set();

// `alTerminar` recarga la lista (se recibe como función para no importar la vista y evitar un ciclo de imports).
export async function autorizar(solicitud, { alTerminar } = {}) {
  if (enCurso.has(solicitud.id)) return false;
  enCurso.add(solicitud.id);
  try {
    const confirmada = await confirmarModal({
      title: tituloAutorizar(solicitud.correlativo),
      mensaje: t('gestiones.autorizar.mensaje'),
      detalles: detallesAutorizar(solicitud),
      aceptar: t('gestiones.autorizar.confirmar')
    });
    if (!confirmada) return false;
    try {
      await autorizarGestion(solicitud.id);
    } catch (error) {
      window.toast?.error(t('gestiones.autorizar.error'), mensajesDeError(error).join(' '));
      // Un 403 dice que el estado cambió (ya autorizada, rechazada o vencida): la lista está desactualizada.
      if (error.status === 403 && alTerminar) await alTerminar();
      return false;
    }
    // El evento de tiempo real no trae al actor: se marca antes de recargar para no avisarle lo que él mismo hizo.
    registrarAccionPropia(solicitud.id);
    window.toast?.success(t('tab.gestiones'), t('gestiones.autorizar.exito', { correlativo: solicitud.correlativo }));
    if (alTerminar) await alTerminar();
    return true;
  } finally {
    enCurso.delete(solicitud.id);
  }
}

// Devuelve una promesa que se cumple al cerrarse el modal: `true` si se rechazó, `false` si no.
export function rechazar(solicitud, { alTerminar } = {}) {
  if (enCurso.has(solicitud.id)) return Promise.resolve(false);
  enCurso.add(solicitud.id);
  return new Promise((resolve) => {
    const max = LIMITES_SOLICITUD.MOTIVO_RECHAZO;
    let enviando = false;
    let descartable = false;
    let rechazada = false;

    const { overlay, cerrar, intentarCerrar } = abrirModal({
      title: tituloRechazar(solicitud.correlativo),
      bodyHtml: `<div class="vi-avisos" id="vi-rechazo-avisos"></div>
        <div class="form-field vi-rechazo-campo">
          <label for="vi-rechazo-motivo">${escapeHtml(t('gestiones.rechazar.motivo'))}</label>
          <textarea id="vi-rechazo-motivo" name="motivo" rows="4" autocomplete="off" placeholder="${escapeHtml(t('gestiones.rechazar.placeholder'))}" aria-describedby="vi-rechazo-contador"></textarea>
          <span class="vi-rechazo-contador" id="vi-rechazo-contador" aria-live="polite"></span>
        </div>`,
      footerHtml: `<button class="btn btn--ghost" type="button" id="vi-rechazo-volver">${escapeHtml(t('gestiones.rechazar.volver'))}</button>
        <button class="btn btn--danger" type="button" id="vi-rechazo-enviar" disabled>${escapeHtml(t('gestiones.rechazar.confirmar'))}</button>`,
      // Con texto escrito se pide confirmar antes de perderlo; mientras se envía no se puede cerrar.
      antesDeCerrar: async () => {
        if (enviando) return false;
        if (descartable || !campo.value.trim()) return true;
        return confirmarModal({
          title: t('gestiones.rechazar.cerrarTitulo'), mensaje: t('gestiones.rechazar.cerrarMensaje'),
          aceptar: t('gestiones.rechazar.cerrarSalir'), cancelar: t('gestiones.rechazar.cerrarSeguir'), peligro: true
        });
      },
      alCerrar: () => { enCurso.delete(solicitud.id); resolve(rechazada); }
    });

    const campo = overlay.querySelector('#vi-rechazo-motivo');
    const contador = overlay.querySelector('#vi-rechazo-contador');
    const botonEnviar = overlay.querySelector('#vi-rechazo-enviar');
    overlay.querySelector('#vi-rechazo-avisos').append(crearAviso({ tipo: 'info', texto: t('gestiones.rechazar.aviso') }));
    overlay.querySelector('#vi-rechazo-volver').addEventListener('click', intentarCerrar);

    function actualizar() {
      const r = validarMotivo(campo.value, max);
      contador.textContent = t('gestiones.rechazar.contador', { n: r.longitud, max });
      contador.classList.toggle('is-excedido', r.estado === 'excedido');
      botonEnviar.disabled = !r.valido || enviando;
      return r;
    }

    campo.addEventListener('input', () => {
      limpiarErrorCampo(campo);
      const r = actualizar();
      if (r.estado === 'excedido') marcarErrorCampo(campo, t('gestiones.rechazar.excedido', { n: r.longitud, max, sobran: r.sobran }));
    });

    async function enviar() {
      const r = validarMotivo(campo.value, max);
      if (enviando || !r.valido) return;
      enviando = true;
      campo.disabled = true;
      botonEnviar.disabled = true;
      botonEnviar.classList.add('btn--loading');
      try {
        await rechazarGestion(solicitud.id, r.motivo);
      } catch (error) {
        enviando = false;
        campo.disabled = false;
        botonEnviar.classList.remove('btn--loading');
        actualizar();
        if (error.status === 400 && error.campos && Object.keys(error.campos).length) {
          const { sueltos } = marcarErroresDeCampos(overlay.querySelector('.modal-body'), error.campos);
          if (sueltos.length) overlay.querySelector('[data-banner-campos]')?.setAttribute('role', 'alert');
          enfocarPrimerCampoInvalido(overlay);
          return;
        }
        const texto = mensajesDeError(error).join(' ');
        mostrarErrorModal(overlay, texto);
        overlay.querySelector('.form-error')?.setAttribute('role', 'alert');
        window.toast?.error(t('gestiones.rechazar.error'), texto);
        // Un 403 dice que el estado cambió: ya no hay nada que rechazar, así que se refresca la lista y se puede salir sin confirmar.
        if (error.status === 403) { descartable = true; if (alTerminar) await alTerminar(); }
        return;
      }
      registrarAccionPropia(solicitud.id);
      window.toast?.success(t('tab.gestiones'), t('gestiones.rechazar.exito', { correlativo: solicitud.correlativo }));
      rechazada = true;
      cerrar();
      if (alTerminar) await alTerminar();
    }

    botonEnviar.addEventListener('click', enviar);
    actualizar();
    campo.focus();
  });
}
