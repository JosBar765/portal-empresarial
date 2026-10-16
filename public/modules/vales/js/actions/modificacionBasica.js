import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import {
  solicitarModificacionBasica, listarModificacionesBasicas, obtenerConversacionBasica, enviarMensajeBasica,
  aceptarModificacionBasica, rechazarModificacionBasica, cancelarModificacionBasica
} from '../api/valesApi.js';
import { escapeHtml, formatearFecha } from '../utils/formato.js';
import { wireContador, htmlHilo, MAX_CARACTERES_CHAT } from './adjuntos.js';
import { state } from '../state.js';
import { cargarBuzon } from '../views/buzon.js';

// Modificación básica: sin vale MOD. El asesor le pide un cambio pequeño a uno o varios talleres y conversan; el taller acepta o rechaza.
const ESTADO_MODIFICACION = {
  EN_CONVERSACION: { texto: 'En conversación', clase: 'chip-estado--info' },
  ACEPTADA: { texto: 'Aceptada: el taller rehace la propuesta', clase: 'chip-estado--info' },
  RECHAZADA: { texto: 'Rechazada por el taller', clase: 'chip-estado--alerta' },
  CANCELADA: { texto: 'Cancelada por el asesor', clase: 'chip-estado--cerrado' },
  ENTREGADA: { texto: 'Propuesta entregada', clase: 'chip-estado--cerrado' }
};

const chipEstado = (estado) => {
  const e = ESTADO_MODIFICACION[estado] || { texto: estado, clase: 'chip-estado--cerrado' };
  return `<span class="chip-estado ${e.clase}">${escapeHtml(e.texto)}</span>`;
};

// Talleres del vale con su propuesta ya aprobada: los únicos a los que se les puede pedir una modificación básica.
const talleresModificables = (vale) => (vale._talleresDetalle || []).filter(t => t.estado === 'APROBADO');

// -----------------------------------------------------------------------
// Asesor: pedir la modificación básica (elige taller si hay varios y escribe el primer mensaje)
// -----------------------------------------------------------------------
export function abrirModalModificacionBasica(vale) {
  const talleres = talleresModificables(vale);
  const variosTalleres = talleres.length > 1;
  const { overlay, cerrar } = abrirModal({
    title: `Modificación básica — ${vale.correlativo}`,
    bodyHtml: `
      <p class="form-nota"><strong>No se crea otro vale.</strong> Cuéntale al taller qué cambio pequeño necesitas. Si lo acepta, rehace la propuesta y vuelve a quedar pendiente de tu confirmación con la fecha de entrega movida <strong>1 día hábil</strong> (nunca antes de la actual). No se valida el cupo del taller.</p>
      ${variosTalleres ? `
      <fieldset class="campo-grupo">
        <legend>¿A qué taller se lo pides?</legend>
        ${talleres.map(t => `<label class="opcion-taller"><input type="checkbox" name="mb-taller" value="${t.taller_id}"> <span>${escapeHtml(t.nombre)}</span></label>`).join('')}
      </fieldset>` : `<p style="font-size:13px;margin:10px 0;">Taller: <strong>${escapeHtml(talleres.map(t => t.nombre).join(', ') || vale.taller || '')}</strong></p>`}
      <label for="mb-mensaje" style="font-size:13px;font-weight:600;">¿Qué cambio necesitas?</label>
      <div class="chat-caja">
        <textarea id="mb-mensaje" rows="3" maxlength="${MAX_CARACTERES_CHAT}" placeholder="Ej.: cambiar el color del logo a azul."></textarea>
      </div>
      <div class="campo-pie"><span class="campo-ayuda">Si el cambio es grande, usa una modificación media o avanzada.</span><span class="contador-mensaje" id="mb-contador"></span></div>
    `,
    footerHtml: '<button class="btn btn--ghost" id="mb-cancelar">Cancelar</button><button class="btn btn--primary" id="mb-enviar">Enviar solicitud</button>'
  });
  const textarea = overlay.querySelector('#mb-mensaje');
  const enviar = overlay.querySelector('#mb-enviar');
  const actualizar = wireContador(textarea, overlay.querySelector('#mb-contador'), enviar);
  const hayTaller = () => !variosTalleres || overlay.querySelectorAll('input[name="mb-taller"]:checked').length > 0;
  const validar = () => { enviar.disabled = !actualizar() || !hayTaller(); };
  overlay.querySelectorAll('input[name="mb-taller"]').forEach(c => c.addEventListener('change', validar));
  textarea.addEventListener('input', validar);
  validar();
  overlay.querySelector('#mb-cancelar').addEventListener('click', cerrar);
  enviar.addEventListener('click', async () => {
    const ids = variosTalleres
      ? [...overlay.querySelectorAll('input[name="mb-taller"]:checked')].map(c => Number(c.value))
      : talleres.map(t => t.taller_id);
    enviar.disabled = true;
    try {
      const modificaciones = await solicitarModificacionBasica(vale.id, ids, textarea.value.trim());
      window.toast.success('Solicitud enviada', 'El taller recibió tu solicitud de modificación básica.');
      cerrar();
      await cargarBuzon();
      const nueva = modificaciones.filter(m => m.estado === 'EN_CONVERSACION').pop();
      if (nueva && modificaciones.filter(m => m.estado === 'EN_CONVERSACION').length === 1) abrirModalConversacionBasica(vale, nueva.id);
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      validar();
      cargarBuzon();
    }
  });
  textarea.focus();
}

// -----------------------------------------------------------------------
// Conversación: el asesor y el taller escriben; el taller acepta o rechaza; el asesor puede cancelar
// -----------------------------------------------------------------------
export async function abrirModalConversacionBasica(vale, modId) {
  const { overlay, cerrar: cerrarModal } = abrirModal({
    title: `Modificación básica — ${vale.correlativo}`,
    bodyHtml: `
      <div class="chat-cabecera" id="mb-cabecera"></div>
      <p class="form-nota" id="mb-fechas" hidden></p>
      <div class="chat-hilo" id="chat-hilo" role="log" aria-live="polite" tabindex="0"><div class="chat-vacio"><p>Cargando…</p></div></div>
      <div class="chat-escribir" id="chat-escribir" hidden>
        <label for="chat-mensaje" class="sr-only">Escribe un mensaje</label>
        <div class="chat-caja">
          <textarea id="chat-mensaje" rows="1" maxlength="${MAX_CARACTERES_CHAT}" placeholder="Escribe un mensaje…"></textarea>
          <button class="chat-enviar" id="chat-enviar" type="button" aria-label="Enviar mensaje"><ion-icon name="send"></ion-icon></button>
        </div>
        <div class="campo-pie"><span class="campo-ayuda">Enter envía · Shift + Enter agrega una línea</span><span class="contador-mensaje" id="chat-contador"></span></div>
      </div>
      <p class="chat-cerrada" id="chat-cerrada" hidden><ion-icon name="lock-closed-outline" aria-hidden="true"></ion-icon><span>Solo lectura.</span></p>
    `,
    footerHtml: `
      <button class="btn btn--ghost" id="mb-cerrar" style="margin-right:auto;">Cerrar</button>
      <button class="btn btn--ghost" id="mb-cancelar-solicitud" hidden>Cancelar solicitud</button>
      <button class="btn btn--danger" id="mb-rechazar" hidden>Rechazar</button>
      <button class="btn btn--primary" id="mb-aceptar" hidden>Aceptar modificación</button>
    `
  });
  const cabecera = overlay.querySelector('#mb-cabecera');
  const fechas = overlay.querySelector('#mb-fechas');
  const hilo = overlay.querySelector('#chat-hilo');
  const zonaEscribir = overlay.querySelector('#chat-escribir');
  const cerrada = overlay.querySelector('#chat-cerrada');
  const textarea = overlay.querySelector('#chat-mensaje');
  const enviar = overlay.querySelector('#chat-enviar');
  const btnCancelar = overlay.querySelector('#mb-cancelar-solicitud');
  const btnRechazar = overlay.querySelector('#mb-rechazar');
  const btnAceptar = overlay.querySelector('#mb-aceptar');

  const cerrar = () => {
    if (state.conversacionAbierta && state.conversacionAbierta.overlay === overlay) state.conversacionAbierta = null;
    cerrarModal();
  };
  overlay.querySelector('#mb-cerrar').addEventListener('click', cerrar);
  const ajustarAlto = () => { textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 110)}px`; };

  const pintar = (c) => {
    cabecera.innerHTML = `<span class="chip-estado chip-estado--taller"><ion-icon name="storefront-outline" aria-hidden="true"></ion-icon>${escapeHtml(c.taller)}</span>${chipEstado(c.estado)}`;
    fechas.hidden = false;
    fechas.innerHTML = `Fecha de entrega: <strong>${escapeHtml(formatearFecha(c.fecha_entrega_anterior))}</strong> → si el taller acepta, <strong>${escapeHtml(formatearFecha(c.fecha_entrega_nueva))}</strong> (como mínimo, 1 día hábil desde el día en que acepte).`;
    hilo.innerHTML = htmlHilo(c, { destacarMotivo: false });
    hilo.scrollTop = hilo.scrollHeight;
    zonaEscribir.hidden = !c.puede_escribir;
    cerrada.hidden = c.puede_escribir;
    cerrada.querySelector('span').textContent = 'La conversación terminó: solo lectura.';
    btnAceptar.hidden = btnRechazar.hidden = !c.puede_decidir;
    btnCancelar.hidden = !c.puede_cancelar;
  };
  const refrescar = async () => {
    try { pintar(await obtenerConversacionBasica(vale.id, modId)); } catch (error) { hilo.innerHTML = `<div class="chat-vacio"><p>${escapeHtml(error.message)}</p></div>`; }
  };
  state.conversacionAbierta = { overlay, valeId: vale.id, refrescar };
  await refrescar();

  const actualizar = wireContador(textarea, overlay.querySelector('#chat-contador'), enviar);
  textarea.addEventListener('input', ajustarAlto);
  const mandar = async () => {
    if (!actualizar()) return;
    enviar.disabled = true;
    try {
      pintar(await enviarMensajeBasica(vale.id, modId, textarea.value.trim()));
      textarea.value = '';
      ajustarAlto();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
    actualizar();
    textarea.focus();
  };
  enviar.addEventListener('click', mandar);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); mandar(); }
  });

  // Decisiones: aceptar y rechazar son del taller; cancelar, del asesor. Cierran la conversación y refrescan el buzón.
  const decidir = (boton, accion, exito) => boton.addEventListener('click', async () => {
    [btnAceptar, btnRechazar, btnCancelar].forEach(b => { b.disabled = true; });
    try {
      await accion(vale.id, modId);
      window.toast.success(exito.titulo, exito.texto);
      cerrar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      [btnAceptar, btnRechazar, btnCancelar].forEach(b => { b.disabled = false; });
    }
    cargarBuzon();
  });
  decidir(btnAceptar, aceptarModificacionBasica, { titulo: 'Modificación aceptada', texto: 'El vale volvió a tu taller para rehacer la propuesta.' });
  decidir(btnRechazar, rechazarModificacionBasica, { titulo: 'Modificación rechazada', texto: 'El asesor fue avisado; el vale sigue como estaba.' });
  decidir(btnCancelar, cancelarModificacionBasica, { titulo: 'Solicitud cancelada', texto: 'Puedes confirmar el vale o pedir otra modificación.' });
  if (!zonaEscribir.hidden) textarea.focus();
}

// -----------------------------------------------------------------------
// Entrada desde el buzón: abre la conversación abierta o, si hay varias (vale con varios talleres), deja elegir cuál
// -----------------------------------------------------------------------
export async function abrirConversacionesBasicas(vale) {
  let modificaciones;
  try {
    modificaciones = await listarModificacionesBasicas(vale.id);
  } catch (error) {
    window.toast.error('No se pudo abrir', error.message);
    return;
  }
  const abiertas = modificaciones.filter(m => m.estado === 'EN_CONVERSACION');
  const lista = abiertas.length ? abiertas : modificaciones.slice(-1);
  if (lista.length === 1) { abrirModalConversacionBasica(vale, lista[0].id); return; }
  if (!lista.length) { window.toast.info('Modificación básica', 'Este vale no tiene conversaciones de modificación básica.'); return; }
  const { overlay, cerrar } = abrirModal({
    title: `Modificaciones básicas — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:13px;margin-bottom:10px;">Elige la conversación que quieres abrir.</p>
      <div class="lista-conversaciones">${lista.map(m => `
        <div class="fila-conversacion">
          <div><strong>${escapeHtml(m.taller)}</strong><div>${chipEstado(m.estado)}</div></div>
          <button class="btn btn--ghost" data-modificacion="${m.id}">Abrir</button>
        </div>`).join('')}</div>`,
    footerHtml: '<button class="btn btn--ghost" id="mb-cerrar-lista">Cerrar</button>'
  });
  overlay.querySelector('#mb-cerrar-lista').addEventListener('click', cerrar);
  overlay.querySelectorAll('[data-modificacion]').forEach(b => b.addEventListener('click', () => {
    cerrar();
    abrirModalConversacionBasica(vale, Number(b.dataset.modificacion));
  }));
}
