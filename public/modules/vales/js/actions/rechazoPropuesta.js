import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import {
  solicitarRechazoPropuesta, listarRechazosPropuesta, obtenerConversacionRechazoPropuesta, enviarMensajeRechazoPropuesta,
  aceptarRechazoPropuesta, rechazarRechazoPropuesta, cancelarRechazoPropuesta
} from '../api/valesApi.js';
import { escapeHtml } from '../utils/formato.js';
import { wireContador, htmlHilo, MAX_CARACTERES_CHAT } from './adjuntos.js';
import { state } from '../state.js';
import { cargarBuzon } from '../views/buzon.js';
import { marcarRechazoVisto } from '../utils/modificacionesVistas.js';

// Rechazo de propuesta: el asesor dueño rechaza la propuesta de uno o varios talleres y conversa con cada uno; el taller acepta o rechaza.
const ESTADO_RECHAZO = {
  ABIERTO: { texto: 'Esperando al taller', clase: 'chip-estado--info' },
  ACEPTADO: { texto: 'Aceptado', clase: 'chip-estado--info' },
  RECHAZADO: { texto: 'Rechazado por el taller', clase: 'chip-estado--alerta' },
  CANCELADO: { texto: 'Cancelado', clase: 'chip-estado--cerrado' }
};

// Cierre de la ronda: con la conversación cerrada el hilo queda como registro, solo para leer.
const CIERRE_RECHAZO = {
  ACEPTADO: 'Acuerdo: el taller aceptó el rechazo.',
  RECHAZADO: 'El taller rechazó el rechazo.',
  CANCELADO: 'El asesor canceló el rechazo.'
};

// Frase corta bajo el título: qué pasa ahora y qué toca hacer (ronda abierta) o cómo se cerró (solo lectura).
function lineaDeEstado(c) {
  if (c.cerrada) return `${CIERRE_RECHAZO[c.estado] || 'Rechazo cerrado.'} Conversación en solo lectura.`;
  return c.lado === 'TALLER'
    ? 'Acepta para rehacer la propuesta, o rechaza escribiendo el motivo (por ejemplo, que tramite una modificación).'
    : 'Esperando la respuesta del taller. Puedes cancelar el rechazo para confirmar el vale.';
}

// La última ronda de cada taller (el hilo es uno por taller y continúa entre rondas); las rondas llegan en orden de creación.
const ultimasPorTaller = (rondas) => [...new Map(rondas.map(r => [r.taller_id, r])).values()];

const chipEstado = (estado) => {
  const e = ESTADO_RECHAZO[estado] || { texto: estado, clase: 'chip-estado--cerrado' };
  return `<span class="chip-estado ${e.clase}">${escapeHtml(e.texto)}</span>`;
};

// Talleres del vale con su propuesta ya aprobada: los únicos cuya propuesta se puede rechazar.
const talleresRechazables = (vale) => (vale._talleresDetalle || []).filter(t => t.estado === 'APROBADO');

// -----------------------------------------------------------------------
// Asesor: rechazar la propuesta (elige taller si hay varios y escribe el primer mensaje)
// -----------------------------------------------------------------------
// `alCancelar` permite volver al modal desde el que se abrió (p. ej. el de decisión).
export function abrirModalRechazarPropuesta(vale, { alCancelar } = {}) {
  const talleres = talleresRechazables(vale);
  const variosTalleres = talleres.length > 1;
  const { overlay, cerrar } = abrirModal({
    title: `Rechazar propuesta — ${vale.correlativo}`,
    bodyHtml: `
      <p class="mod-aviso"><ion-icon name="information-circle-outline" aria-hidden="true"></ion-icon><span>Solo regresa el taller que elijas. Si acepta, rehace la propuesta; la fecha de entrega no cambia.</span></p>
      ${variosTalleres ? `
      <fieldset class="campo-grupo">
        <legend>¿La propuesta de qué taller?</legend>
        ${talleres.map(t => `<label class="opcion-taller"><input type="checkbox" name="mb-taller" value="${t.taller_id}"> <span>${escapeHtml(t.nombre)}</span></label>`).join('')}
      </fieldset>` : `<p class="mb-taller-unico"><ion-icon name="storefront-outline" aria-hidden="true"></ion-icon>${escapeHtml(talleres.map(t => t.nombre).join(', ') || vale.taller || '')}</p>`}
      <label for="mb-mensaje" class="mb-etiqueta">¿Qué debe cambiar la propuesta?</label>
      <div class="chat-caja">
        <textarea id="mb-mensaje" rows="3" maxlength="${MAX_CARACTERES_CHAT}" placeholder="Ej.: el logo no es el que envió el cliente."></textarea>
      </div>
      <div class="campo-pie"><span class="campo-ayuda">¿Cambio nuevo del cliente? Pide una modificación.</span><span class="contador-mensaje" id="mb-contador"></span></div>
    `,
    footerHtml: '<button class="btn btn--ghost" id="mb-cancelar">Cancelar</button><button class="btn btn--primary" id="mb-enviar">Rechazar propuesta</button>'
  });
  const textarea = overlay.querySelector('#mb-mensaje');
  const enviar = overlay.querySelector('#mb-enviar');
  const actualizar = wireContador(textarea, overlay.querySelector('#mb-contador'), enviar);
  const hayTaller = () => !variosTalleres || overlay.querySelectorAll('input[name="mb-taller"]:checked').length > 0;
  const validar = () => { enviar.disabled = !actualizar() || !hayTaller(); };
  overlay.querySelectorAll('input[name="mb-taller"]').forEach(c => c.addEventListener('change', validar));
  textarea.addEventListener('input', validar);
  validar();
  overlay.querySelector('#mb-cancelar').addEventListener('click', () => { cerrar(); if (alCancelar) alCancelar(); });
  enviar.addEventListener('click', async () => {
    const ids = variosTalleres
      ? [...overlay.querySelectorAll('input[name="mb-taller"]:checked')].map(c => Number(c.value))
      : talleres.map(t => t.taller_id);
    enviar.disabled = true;
    try {
      const rechazos = await solicitarRechazoPropuesta(vale.id, ids, textarea.value.trim());
      window.toast.success('Rechazo enviado', 'El taller ya lo puede ver.');
      cerrar();
      await cargarBuzon();
      const abiertos = rechazos.filter(r => r.estado === 'ABIERTO');
      if (abiertos.length === 1) abrirModalConversacionRechazo(vale, abiertos[0].id);
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
export async function abrirModalConversacionRechazo(vale, rechazoId) {
  const { overlay, cerrar: cerrarModal } = abrirModal({
    title: `Rechazo de propuesta — ${vale.correlativo}`,
    bodyHtml: `
      <div class="chat-cabecera" id="mb-cabecera"></div>
      <p class="mb-estado" id="mb-estado"></p>
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
      <button class="btn btn--ghost btn--texto-peligro" id="mb-cancelar-solicitud" hidden>Cancelar rechazo</button>
      <button class="btn btn--ghost btn--texto-peligro" id="mb-rechazar" hidden>Rechazar</button>
      <button class="btn btn--primary" id="mb-aceptar" hidden>Aceptar</button>
    `
  });
  const cabecera = overlay.querySelector('#mb-cabecera');
  const estado = overlay.querySelector('#mb-estado');
  const hilo = overlay.querySelector('#chat-hilo');
  const zonaEscribir = overlay.querySelector('#chat-escribir');
  const textarea = overlay.querySelector('#chat-mensaje');
  const enviar = overlay.querySelector('#chat-enviar');
  const btnCancelar = overlay.querySelector('#mb-cancelar-solicitud');
  const btnRechazar = overlay.querySelector('#mb-rechazar');
  const btnAceptar = overlay.querySelector('#mb-aceptar');

  let leido = false; // el asesor leyó la respuesta del taller: al cerrar, el buzón quita la marca
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
    hilo.innerHTML = htmlHilo(c, { destacarMotivo: false });
    hilo.scrollTop = hilo.scrollHeight;
    zonaEscribir.hidden = !c.puede_escribir;
    btnAceptar.hidden = btnRechazar.hidden = !c.puede_decidir;
    btnCancelar.hidden = !c.puede_cancelar;
    if (c.estado === 'RECHAZADO' && c.lado === 'ASESOR') { marcarRechazoVisto(c.id); leido = true; }
  };
  const refrescar = async () => {
    try { pintar(await obtenerConversacionRechazoPropuesta(vale.id, rechazoId)); } catch (error) { hilo.innerHTML = `<div class="chat-vacio"><p>${escapeHtml(error.message)}</p></div>`; }
  };
  state.conversacionAbierta = { overlay, valeId: vale.id, refrescar };
  await refrescar();

  const actualizar = wireContador(textarea, overlay.querySelector('#chat-contador'), enviar);
  textarea.addEventListener('input', ajustarAlto);
  const mandar = async () => {
    if (!actualizar()) return;
    enviar.disabled = true;
    try {
      pintar(await enviarMensajeRechazoPropuesta(vale.id, rechazoId, textarea.value.trim()));
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
  // Rechazar usa lo escrito en el chat como motivo (obligatorio).
  const decidir = (boton, accion, exito, { motivo = false } = {}) => boton.addEventListener('click', async () => {
    if (motivo && !actualizar()) {
      mostrarErrorModal(overlay, 'Escribe en el chat el motivo del rechazo (por ejemplo, que tramite una modificación).');
      textarea.focus();
      return;
    }
    [btnAceptar, btnRechazar, btnCancelar].forEach(b => { b.disabled = true; });
    try {
      await accion(vale.id, rechazoId, textarea.value.trim());
      window.toast.success(exito.titulo, exito.texto);
      cerrar();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      [btnAceptar, btnRechazar, btnCancelar].forEach(b => { b.disabled = false; });
    }
    cargarBuzon();
  });
  decidir(btnAceptar, aceptarRechazoPropuesta, { titulo: 'Aceptado', texto: 'Asigna el vale a un diseñador.' });
  decidir(btnRechazar, rechazarRechazoPropuesta, { titulo: 'Rechazado', texto: 'El asesor fue avisado.' }, { motivo: true });
  decidir(btnCancelar, cancelarRechazoPropuesta, { titulo: 'Cancelado', texto: 'Ya puedes confirmar el vale.' });
  if (!zonaEscribir.hidden) textarea.focus();
}

// -----------------------------------------------------------------------
// Entrada desde el buzón: abre el hilo del rechazo (abierto o cerrado, este último solo para leer) o, si hay varios talleres, deja elegir cuál
// -----------------------------------------------------------------------
export async function abrirConversacionesRechazo(vale, { ids = null } = {}) {
  let rechazos;
  try {
    rechazos = await listarRechazosPropuesta(vale.id);
  } catch (error) {
    window.toast.error('No se pudo abrir', error.message);
    return;
  }
  const hilos = ultimasPorTaller(rechazos);
  const lista = ids ? hilos.filter(r => ids.includes(r.id)) : hilos;
  if (lista.length === 1) { abrirModalConversacionRechazo(vale, lista[0].id); return; }
  if (!lista.length) { window.toast.info('Sin conversaciones', 'Este vale no tiene rechazos de propuesta a la vista.'); return; }
  const { overlay, cerrar } = abrirModal({
    title: `Rechazos de propuesta — ${vale.correlativo}`,
    bodyHtml: `
      <p class="mod-intro">¿Cuál quieres abrir?</p>
      <div class="lista-conversaciones">${lista.map(r => `
        <button type="button" class="fila-conversacion" data-modificacion="${r.id}">
          <span class="fila-conversacion-taller"><ion-icon name="storefront-outline" aria-hidden="true"></ion-icon>${escapeHtml(r.taller)}</span>
          ${chipEstado(r.estado)}
          <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>
        </button>`).join('')}</div>`,
    footerHtml: '<button class="btn btn--ghost" id="mb-cerrar-lista">Cerrar</button>'
  });
  overlay.querySelector('#mb-cerrar-lista').addEventListener('click', cerrar);
  overlay.querySelectorAll('[data-modificacion]').forEach(b => b.addEventListener('click', () => {
    cerrar();
    abrirModalConversacionRechazo(vale, Number(b.dataset.modificacion));
  }));
}
