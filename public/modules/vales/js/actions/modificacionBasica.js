import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import {
  solicitarModificacionBasica, listarModificacionesBasicas, obtenerConversacionBasica, enviarMensajeBasica,
  aceptarModificacionBasica, rechazarModificacionBasica, cancelarModificacionBasica
} from '../api/valesApi.js';
import { escapeHtml, formatearFecha } from '../utils/formato.js';
import { wireContador, htmlHilo, MAX_CARACTERES_CHAT } from './adjuntos.js';
import { state } from '../state.js';
import { cargarBuzon } from '../views/buzon.js';
import { marcarRechazoVisto } from '../utils/modificacionesVistas.js';

// Modificación básica: sin vale MOD. El asesor le pide un cambio pequeño a uno o varios talleres y conversan; el taller acepta o rechaza.
const ESTADO_MODIFICACION = {
  EN_CONVERSACION: { texto: 'En conversación', clase: 'chip-estado--info' },
  ACEPTADA: { texto: 'Aceptada', clase: 'chip-estado--info' },
  RECHAZADA: { texto: 'Rechazada', clase: 'chip-estado--alerta' },
  CANCELADA: { texto: 'Cancelada', clase: 'chip-estado--cerrado' },
  ENTREGADA: { texto: 'Entregada', clase: 'chip-estado--cerrado' }
};

// Frase corta bajo el título: qué pasa ahora y qué toca hacer, según quién la lee.
function lineaDeEstado(c) {
  switch (c.estado) {
    case 'EN_CONVERSACION': return c.lado === 'TALLER' ? 'Acepta para rehacer la propuesta, o rechaza para dejarla igual.' : 'Esperando la respuesta del taller.';
    case 'ACEPTADA': return 'El taller está rehaciendo la propuesta.';
    case 'RECHAZADA': return c.lado === 'ASESOR' ? 'El vale sigue igual: puedes confirmarlo o pedir otra modificación.' : 'Solicitud rechazada.';
    case 'CANCELADA': return 'Solicitud cancelada.';
    default: return 'El taller ya entregó la nueva propuesta.';
  }
}

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
      <p class="mod-aviso"><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon><span>Sin vale nuevo. Si el taller acepta, rehace la propuesta y la entrega sube <strong>1 día hábil</strong>.</span></p>
      ${variosTalleres ? `
      <fieldset class="campo-grupo">
        <legend>¿A qué taller?</legend>
        ${talleres.map(t => `<label class="opcion-taller"><input type="checkbox" name="mb-taller" value="${t.taller_id}"> <span>${escapeHtml(t.nombre)}</span></label>`).join('')}
      </fieldset>` : `<p class="mb-taller-unico"><ion-icon name="storefront-outline" aria-hidden="true"></ion-icon>${escapeHtml(talleres.map(t => t.nombre).join(', ') || vale.taller || '')}</p>`}
      <label for="mb-mensaje" class="mb-etiqueta">¿Qué cambio necesitas?</label>
      <div class="chat-caja">
        <textarea id="mb-mensaje" rows="3" maxlength="${MAX_CARACTERES_CHAT}" placeholder="Ej.: cambiar el color del logo a azul."></textarea>
      </div>
      <div class="campo-pie"><span class="campo-ayuda">¿Cambio grande? Pide una Media o Avanzada.</span><span class="contador-mensaje" id="mb-contador"></span></div>
    `,
    footerHtml: '<button class="btn btn--ghost" id="mb-cancelar">Cancelar</button><button class="btn btn--primary" id="mb-enviar">Enviar</button>'
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
      window.toast.success('Solicitud enviada', 'El taller ya la puede ver.');
      cerrar();
      await cargarBuzon();
      const abiertas = modificaciones.filter(m => m.estado === 'EN_CONVERSACION');
      if (abiertas.length === 1) abrirModalConversacionBasica(vale, abiertas[0].id);
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
      <p class="mb-estado" id="mb-estado"></p>
      <p class="mb-fechas" id="mb-fechas" hidden></p>
      <div class="chat-hilo" id="chat-hilo" role="log" aria-live="polite" tabindex="0"><div class="chat-vacio"><p>Cargando…</p></div></div>
      <div class="chat-escribir" id="chat-escribir" hidden>
        <label for="chat-mensaje" class="sr-only">Escribe un mensaje</label>
        <div class="chat-caja">
          <textarea id="chat-mensaje" rows="1" maxlength="${MAX_CARACTERES_CHAT}" placeholder="Escribe un mensaje…"></textarea>
          <button class="chat-enviar" id="chat-enviar" type="button" aria-label="Enviar mensaje"><ion-icon name="send"></ion-icon></button>
        </div>
        <div class="campo-pie"><span class="campo-ayuda">Enter envía · Shift + Enter, nueva línea</span><span class="contador-mensaje" id="chat-contador"></span></div>
      </div>
    `,
    footerHtml: `
      <button class="btn btn--ghost" id="mb-cerrar" style="margin-right:auto;">Cerrar</button>
      <button class="btn btn--ghost btn--texto-peligro" id="mb-cancelar-solicitud" hidden>Cancelar solicitud</button>
      <button class="btn btn--ghost btn--texto-peligro" id="mb-rechazar" hidden>Rechazar</button>
      <button class="btn btn--primary" id="mb-aceptar" hidden>Aceptar</button>
    `
  });
  const cabecera = overlay.querySelector('#mb-cabecera');
  const estado = overlay.querySelector('#mb-estado');
  const fechas = overlay.querySelector('#mb-fechas');
  const hilo = overlay.querySelector('#chat-hilo');
  const zonaEscribir = overlay.querySelector('#chat-escribir');
  const textarea = overlay.querySelector('#chat-mensaje');
  const enviar = overlay.querySelector('#chat-enviar');
  const btnCancelar = overlay.querySelector('#mb-cancelar-solicitud');
  const btnRechazar = overlay.querySelector('#mb-rechazar');
  const btnAceptar = overlay.querySelector('#mb-aceptar');

  let leido = false; // el asesor leyó un rechazo: al cerrar, el buzón quita la marca
  const cerrar = () => {
    if (state.conversacionAbierta && state.conversacionAbierta.overlay === overlay) state.conversacionAbierta = null;
    cerrarModal();
    if (leido) cargarBuzon();
  };
  overlay.querySelector('#mb-cerrar').addEventListener('click', cerrar);
  const ajustarAlto = () => { textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 110)}px`; };

  const pintar = (c) => {
    cabecera.innerHTML = `<span class="chip-estado chip-estado--taller"><ion-icon name="storefront-outline" aria-hidden="true"></ion-icon>${escapeHtml(c.taller)}</span>${chipEstado(c.estado)}`;
    estado.textContent = lineaDeEstado(c);
    // La fecha nueva solo importa mientras se decide; después ya quedó aplicada o descartada.
    fechas.hidden = c.cerrada;
    const antes = formatearFecha(c.fecha_entrega_anterior);
    const despues = formatearFecha(c.fecha_entrega_nueva);
    fechas.innerHTML = `<ion-icon name="calendar-outline" aria-hidden="true"></ion-icon>${antes === despues
      ? `Entrega: <strong>${escapeHtml(despues)}</strong> (sin cambio)`
      : `Entrega: ${escapeHtml(antes)} → <strong>${escapeHtml(despues)}</strong> si el taller acepta`}`;
    hilo.innerHTML = htmlHilo(c, { destacarMotivo: false });
    hilo.scrollTop = hilo.scrollHeight;
    zonaEscribir.hidden = !c.puede_escribir;
    btnAceptar.hidden = btnRechazar.hidden = !c.puede_decidir;
    btnCancelar.hidden = !c.puede_cancelar;
    if (c.estado === 'RECHAZADA' && c.lado === 'ASESOR') { marcarRechazoVisto(c.id); leido = true; }
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
  decidir(btnAceptar, aceptarModificacionBasica, { titulo: 'Aceptada', texto: 'Ya puedes rehacer la propuesta.' });
  decidir(btnRechazar, rechazarModificacionBasica, { titulo: 'Rechazada', texto: 'El asesor fue avisado.' });
  decidir(btnCancelar, cancelarModificacionBasica, { titulo: 'Cancelada', texto: 'Ya puedes confirmar el vale.' });
  if (!zonaEscribir.hidden) textarea.focus();
}

// -----------------------------------------------------------------------
// Entrada desde el buzón: abre la conversación abierta o, si hay varias (vale con varios talleres), deja elegir cuál
// -----------------------------------------------------------------------
export async function abrirConversacionesBasicas(vale, { ids = null } = {}) {
  let modificaciones;
  try {
    modificaciones = await listarModificacionesBasicas(vale.id);
  } catch (error) {
    window.toast.error('No se pudo abrir', error.message);
    return;
  }
  const abiertas = modificaciones.filter(m => m.estado === 'EN_CONVERSACION');
  const lista = ids ? modificaciones.filter(m => ids.includes(m.id)) : abiertas.length ? abiertas : modificaciones.slice(-1);
  if (lista.length === 1) { abrirModalConversacionBasica(vale, lista[0].id); return; }
  if (!lista.length) { window.toast.info('Sin conversaciones', 'Este vale no tiene modificaciones básicas.'); return; }
  const { overlay, cerrar } = abrirModal({
    title: `Modificaciones básicas — ${vale.correlativo}`,
    bodyHtml: `
      <p class="mod-intro">¿Cuál quieres abrir?</p>
      <div class="lista-conversaciones">${lista.map(m => `
        <button type="button" class="fila-conversacion" data-modificacion="${m.id}">
          <span class="fila-conversacion-taller"><ion-icon name="storefront-outline" aria-hidden="true"></ion-icon>${escapeHtml(m.taller)}</span>
          ${chipEstado(m.estado)}
          <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>
        </button>`).join('')}</div>`,
    footerHtml: '<button class="btn btn--ghost" id="mb-cerrar-lista">Cerrar</button>'
  });
  overlay.querySelector('#mb-cerrar-lista').addEventListener('click', cerrar);
  overlay.querySelectorAll('[data-modificacion]').forEach(b => b.addEventListener('click', () => {
    cerrar();
    abrirModalConversacionBasica(vale, Number(b.dataset.modificacion));
  }));
}
