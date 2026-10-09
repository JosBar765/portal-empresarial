import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { verificarAdjuntos, rechazarAdjuntos, responderAdjuntos, obtenerConversacion, enviarMensajeRechazo } from '../api/valesApi.js';
import { escapeHtml, formatearFechaHora, inicialesAvatar } from '../utils/formato.js';
import { puedeResponderAdjuntos } from '../permisos.js';
import { state } from '../state.js';
import { cargarBuzon } from '../views/buzon.js';

const MAX_CARACTERES = 200;
const AVISO_CARACTERES = 170;
const MENSAJE_POR_DEFECTO = 'Adjuntos enviados al correo';
const MOTIVOS_RAPIDOS = [
  'Faltan los adjuntos.',
  'Da de baja este vale y crea otro.',
  'Corrige los datos y avísame.'
];

// Contador «n/200» de un textarea con estados (normal, cerca del límite, excedido); habilita o no el botón.
function wireContador(textarea, contador, boton, { obligatorio = true } = {}) {
  const actualizar = () => {
    const n = Array.from(textarea.value).length;
    contador.textContent = `${n}/${MAX_CARACTERES}`;
    contador.classList.toggle('is-cerca', n >= AVISO_CARACTERES && n <= MAX_CARACTERES);
    contador.classList.toggle('is-excedido', n > MAX_CARACTERES);
    const valido = n <= MAX_CARACTERES && (!obligatorio || textarea.value.trim().length > 0);
    boton.disabled = !valido;
    return valido;
  };
  textarea.addEventListener('input', actualizar);
  actualizar();
  return actualizar;
}

// -----------------------------------------------------------------------
// Encargado/asistente: verificar los adjuntos de su taller o rechazar el vale con un mensaje
// -----------------------------------------------------------------------
export function abrirModalVerificarAdjuntos(vale) {
  const { overlay, cerrar } = abrirModal({
    title: `Verificar adjuntos — ${vale.correlativo}`,
    bodyHtml: `
      <p style="font-size:14px;font-weight:600;margin-bottom:8px;">¿Estás seguro que recibiste los adjuntos del vale de arte antes de trabajar?</p>
      <p style="font-size:13px;">Al confirmar, el vale queda listo para asignarse a un diseñador.</p>
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Sí, los recibí</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-confirmar');
    btn.disabled = true;
    try {
      await verificarAdjuntos(vale.id);
      window.toast.success('Adjuntos verificados', `${vale.correlativo} ya puede asignarse a un diseñador.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
      cargarBuzon();
    }
  });
}

export function abrirModalRechazarAdjuntos(vale) {
  const { overlay, cerrar } = abrirModal({
    title: `Rechazar vale — ${vale.correlativo}`,
    bodyHtml: `
      <div class="aviso-rechazo">
        <ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon>
        <p>El vale vuelve al asesor con tu mensaje y tiene <strong>24 horas</strong> para atenderlo. Si no se resuelve en ese plazo, el vale se elimina junto con la conversación.</p>
      </div>
      <div class="form-field full">
        <label for="mensaje-rechazo">¿Qué debe hacer el asesor? *</label>
        <div class="motivos-rapidos" role="group" aria-label="Mensajes sugeridos">
          ${MOTIVOS_RAPIDOS.map(m => `<button type="button" class="chip-motivo" data-motivo="${escapeHtml(m)}">${escapeHtml(m)}</button>`).join('')}
        </div>
        <textarea id="mensaje-rechazo" rows="4" maxlength="${MAX_CARACTERES}" placeholder="Escribe el motivo del rechazo o toca una sugerencia."></textarea>
        <div class="campo-pie"><span class="campo-ayuda">El asesor podrá responderte.</span><span class="contador-mensaje" id="mensaje-contador"></span></div>
      </div>
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--danger" id="btn-confirmar"><ion-icon name="close-circle-outline"></ion-icon> Rechazar vale</button>'
  });
  const textarea = overlay.querySelector('#mensaje-rechazo');
  const btn = overlay.querySelector('#btn-confirmar');
  const actualizar = wireContador(textarea, overlay.querySelector('#mensaje-contador'), btn);
  overlay.querySelectorAll('[data-motivo]').forEach(chip => chip.addEventListener('click', () => {
    textarea.value = chip.dataset.motivo;
    actualizar();
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }));
  textarea.focus();
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await rechazarAdjuntos(vale.id, vale.taller_id, textarea.value.trim());
      window.toast.success('Vale rechazado', `${vale.correlativo} volvió al asesor con tu mensaje.`);
      cerrar();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      actualizar();
      cargarBuzon();
    }
  });
}

// -----------------------------------------------------------------------
// Conversación del rechazo (taller ↔ asesor): hilo agrupado por día y caja para escribir mientras esté abierta.
// -----------------------------------------------------------------------
const hoyGT = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const ayerGT = () => new Date(Date.now() - 30 * 3600 * 1000).toISOString().slice(0, 10);

function etiquetaDia(creadoEn) {
  const dia = String(creadoEn).slice(0, 10);
  if (dia === hoyGT()) return 'Hoy';
  if (dia === ayerGT()) return 'Ayer';
  const [y, m, d] = dia.split('-');
  return `${d}/${m}/${y}`;
}

const horaDe = (creadoEn) => String(creadoEn).replace('T', ' ').slice(11, 16);

function htmlHilo(conversacion) {
  if (!conversacion.mensajes.length) {
    return '<div class="chat-vacio"><ion-icon name="chatbubbles-outline" aria-hidden="true"></ion-icon><p>Aún no hay mensajes.</p></div>';
  }
  let diaActual = '';
  let hayMotivo = false;
  return conversacion.mensajes.map(m => {
    const dia = etiquetaDia(m.creado_en);
    const separador = dia !== diaActual ? `<div class="chat-dia"><span>${escapeHtml(dia)}</span></div>` : '';
    diaActual = dia;
    const propio = m.autor_id === state.user.id;
    // El primer mensaje del taller es el motivo del rechazo: se destaca.
    const esMotivo = !hayMotivo && m.lado === 'TALLER';
    if (esMotivo) hayMotivo = true;
    return `${separador}
      <div class="chat-fila ${propio ? 'chat-fila--propia' : ''}">
        <span class="chat-avatar chat-avatar--${m.lado === 'TALLER' ? 'taller' : 'asesor'}" aria-hidden="true">${escapeHtml(inicialesAvatar(m.autor))}</span>
        <div class="chat-burbuja chat-burbuja--${m.lado === 'TALLER' ? 'taller' : 'asesor'}${propio ? ' chat-burbuja--propia' : ''}${esMotivo ? ' chat-burbuja--motivo' : ''}">
          <span class="chat-autor">${escapeHtml(m.autor)}<em>${m.lado === 'TALLER' ? 'Taller' : 'Asesor'}</em></span>
          ${esMotivo ? '<span class="chat-etiqueta"><ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>Motivo del rechazo</span>' : ''}
          <p>${escapeHtml(m.mensaje)}</p>
          <span class="chat-hora">${escapeHtml(horaDe(m.creado_en))}</span>
        </div>
      </div>`;
  }).join('');
}

const ESTADO_CHAT = {
  ADJUNTOS_RECHAZADOS: { texto: 'Esperando respuesta del asesor', clase: 'chip-estado--alerta' },
  ADJUNTOS_RESPONDIDOS: { texto: 'Esperando revisión del taller', clase: 'chip-estado--info' }
};

export async function abrirModalConversacion(vale, tallerId, nombreTaller = '') {
  const { overlay, cerrar: cerrarModal } = abrirModal({
    title: `Conversación — ${vale.correlativo}`,
    bodyHtml: `
      <div class="chat-cabecera" id="chat-cabecera"></div>
      <div class="chat-hilo" id="chat-hilo" role="log" aria-live="polite" tabindex="0"><div class="chat-vacio"><p>Cargando…</p></div></div>
      <div class="chat-escribir" id="chat-escribir" hidden>
        <label for="chat-mensaje" class="sr-only">Escribe un mensaje</label>
        <div class="chat-caja">
          <textarea id="chat-mensaje" rows="1" maxlength="${MAX_CARACTERES}" placeholder="Escribe un mensaje…"></textarea>
          <button class="chat-enviar" id="chat-enviar" type="button" aria-label="Enviar mensaje"><ion-icon name="send"></ion-icon></button>
        </div>
        <div class="campo-pie"><span class="campo-ayuda">Enter envía · Shift + Enter agrega una línea</span><span class="contador-mensaje" id="chat-contador"></span></div>
      </div>
      <p class="chat-cerrada" id="chat-cerrada" hidden><ion-icon name="lock-closed-outline" aria-hidden="true"></ion-icon><span>Solo lectura.</span></p>
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar">Cerrar</button>'
  });
  const cabecera = overlay.querySelector('#chat-cabecera');
  const hilo = overlay.querySelector('#chat-hilo');
  const zonaEscribir = overlay.querySelector('#chat-escribir');
  const cerrada = overlay.querySelector('#chat-cerrada');
  const textarea = overlay.querySelector('#chat-mensaje');
  const enviar = overlay.querySelector('#chat-enviar');

  const cerrar = () => {
    if (state.conversacionAbierta && state.conversacionAbierta.overlay === overlay) state.conversacionAbierta = null;
    cerrarModal();
  };
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);

  const ajustarAlto = () => { textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 110)}px`; };

  const pintar = (conversacion) => {
    // Con el acuerdo (el taller verificó los adjuntos) la conversación deja de verse: el servidor ya no manda mensajes.
    if (conversacion.cerrada) {
      cabecera.innerHTML = '<span class="chip-estado chip-estado--cerrado">Cerrada</span>';
      hilo.innerHTML = '<div class="chat-vacio"><ion-icon name="checkmark-done-circle-outline" aria-hidden="true"></ion-icon><p><strong>Se llegó a un acuerdo.</strong><br>La conversación se cerró y quedó solo como registro en el historial del vale.</p></div>';
      zonaEscribir.hidden = true;
      cerrada.hidden = true;
      return;
    }
    const estado = ESTADO_CHAT[conversacion.estado];
    cabecera.innerHTML = `
      ${nombreTaller ? `<span class="chip-estado chip-estado--taller"><ion-icon name="storefront-outline" aria-hidden="true"></ion-icon>${escapeHtml(nombreTaller)}</span>` : ''}
      ${estado ? `<span class="chip-estado ${estado.clase}">${escapeHtml(estado.texto)}</span>` : ''}`;
    hilo.innerHTML = htmlHilo(conversacion);
    hilo.scrollTop = hilo.scrollHeight;
    zonaEscribir.hidden = !conversacion.puede_escribir;
    cerrada.hidden = conversacion.puede_escribir;
    cerrada.querySelector('span').textContent = 'Solo lectura.';
  };
  const refrescar = async () => {
    try { pintar(await obtenerConversacion(vale.id, tallerId)); } catch (error) { hilo.innerHTML = `<div class="chat-vacio"><p>${escapeHtml(error.message)}</p></div>`; }
  };
  state.conversacionAbierta = { overlay, valeId: vale.id, refrescar };
  await refrescar();

  const actualizar = wireContador(textarea, overlay.querySelector('#chat-contador'), enviar);
  textarea.addEventListener('input', ajustarAlto);
  const mandar = async () => {
    if (!actualizar()) return;
    enviar.disabled = true;
    enviar.classList.add('is-enviando');
    try {
      pintar(await enviarMensajeRechazo(vale.id, tallerId, textarea.value.trim()));
      textarea.value = '';
      ajustarAlto();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
    }
    enviar.classList.remove('is-enviando');
    actualizar();
    textarea.focus();
  };
  enviar.addEventListener('click', mandar);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); mandar(); }
  });
  if (!zonaEscribir.hidden) textarea.focus();
}

// -----------------------------------------------------------------------
// Asesor (y supervisor): vale rechazado por un taller. Solo el dueño escribe.
// -----------------------------------------------------------------------
export function abrirModalAdjuntosPendientes(vale) {
  const adjuntos = vale.adjuntos || [];
  const puedeResponder = puedeResponderAdjuntos(vale);
  const tarjetas = adjuntos.map(a => {
    if (a.estado === 'ADJUNTOS_RESPONDIDOS') {
      return `<li class="rechazo-tarjeta">
        <div class="rechazo-cab"><strong>${escapeHtml(a.taller)}</strong><span class="chip-estado chip-estado--info">Esperando revisión del taller</span></div>
        <p class="rechazo-texto">Ya avisaste al taller. Tu mensaje:</p>
        <p class="mensaje-adjuntos">${escapeHtml(a.mensaje || MENSAJE_POR_DEFECTO)}</p>
        ${puedeResponder ? `<div class="rechazo-acciones"><button class="btn btn--ghost btn--sm" data-conversacion="${Number(a.taller_id)}"><ion-icon name="chatbubbles-outline"></ion-icon> Ver conversación</button></div>` : ''}
      </li>`;
    }
    return `<li class="rechazo-tarjeta rechazo-tarjeta--alerta">
      <div class="rechazo-cab"><strong>${escapeHtml(a.taller)}</strong><span class="chip-estado chip-estado--alerta">Rechazado por el taller</span></div>
      <p class="rechazo-texto">Atiende el mensaje del taller. Si no se resuelve, el vale se elimina${a.vence_en ? ` el ${escapeHtml(formatearFechaHora(a.vence_en))}` : ''}.</p>
      ${puedeResponder ? `<div class="rechazo-acciones">
        <button class="btn btn--primary btn--sm" data-conversacion="${Number(a.taller_id)}"><ion-icon name="chatbubbles-outline"></ion-icon> Leer y responder</button>
        <button class="btn btn--ghost btn--sm" data-responder="${Number(a.taller_id)}"><ion-icon name="checkmark-done-outline"></ion-icon> Ya lo atendí</button>
      </div>` : ''}
    </li>`;
  }).join('');

  const hayRechazados = adjuntos.some(a => a.estado === 'ADJUNTOS_RECHAZADOS');
  const { overlay, cerrar } = abrirModal({
    title: `${hayRechazados ? 'Vale rechazado por un taller' : 'Aviso enviado al taller'} — ${vale.correlativo}`,
    bodyHtml: `
      <ul class="rechazo-lista">${tarjetas}</ul>
      ${hayRechazados && !puedeResponder ? '<p class="campo-ayuda" style="margin-top:10px;">Solo el asesor del vale puede responder.</p>' : ''}
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-cerrar">Cerrar</button>'
  });
  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelectorAll('[data-conversacion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const adjunto = adjuntos.find(a => a.taller_id === Number(btn.dataset.conversacion));
      if (adjunto) abrirModalConversacion(vale, adjunto.taller_id, adjunto.taller);
    });
  });
  overlay.querySelectorAll('[data-responder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const adjunto = adjuntos.find(a => a.taller_id === Number(btn.dataset.responder));
      if (adjunto) abrirModalResponderAdjuntos(vale, adjunto, cerrar);
    });
  });
}

function abrirModalResponderAdjuntos(vale, adjunto, cerrarPadre) {
  const { overlay, cerrar } = abrirModal({
    title: `Avisar al taller — ${adjunto.taller}`,
    bodyHtml: `
      <div class="aviso-rechazo">
        <ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon>
        <p>El vale volverá a <strong>${escapeHtml(adjunto.taller)}</strong> para que lo revise de nuevo. Úsalo cuando ya atendiste lo que te pidieron.</p>
      </div>
      <div class="form-field full">
        <label for="mensaje-adjuntos">Mensaje para el taller</label>
        <textarea id="mensaje-adjuntos" rows="3" maxlength="${MAX_CARACTERES}">${MENSAJE_POR_DEFECTO}</textarea>
        <div class="campo-pie"><span class="campo-ayuda">Obligatorio.</span><span class="contador-mensaje" id="mensaje-palabras"></span></div>
      </div>
    `,
    footerHtml: '<button class="btn btn--ghost" id="btn-volver">Volver</button><button class="btn btn--primary" id="btn-enviar"><ion-icon name="send-outline"></ion-icon> Avisar al taller</button>'
  });
  const textarea = overlay.querySelector('#mensaje-adjuntos');
  const btn = overlay.querySelector('#btn-enviar');
  const actualizar = wireContador(textarea, overlay.querySelector('#mensaje-palabras'), btn);
  overlay.querySelector('#btn-volver').addEventListener('click', cerrar);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await responderAdjuntos(vale.id, adjunto.taller_id, textarea.value.trim());
      window.toast.success('Respuesta enviada', `${adjunto.taller} revisará de nuevo ${vale.correlativo}.`);
      cerrar();
      cerrarPadre();
      cargarBuzon();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      actualizar();
      cargarBuzon();
    }
  });
}
