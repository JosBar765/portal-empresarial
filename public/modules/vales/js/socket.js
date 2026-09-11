import { state } from './state.js';
import { ROL } from './config/roles.js';
import { roomsParaUsuario } from './permisos.js';
import { refreshToken, logout } from './api/authApi.js';
import { cargarBuzon } from './views/buzon.js';
import { actualizarDashboardGerenciaEnVivo } from './views/dashboardGerencia.js';

export function reproducirBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* Audio no disponible en este navegador/contexto; no es crítico */ }
}

export function initSocket() {
  if (typeof io === 'undefined') return;
  state.socket = io({ query: { userId: state.user.id } });
  state.socket.on('connect', () => {
    // `role_X` es independiente de las salas de notificación de vales — todo
    // rol la necesita para enterarse de cambios de permisos, incluido Gerente.
    state.socket.emit('register_module', [...roomsParaUsuario(state.user), `role_${state.user.rolId}`]);
  });
  state.socket.on('permisos_actualizados', async () => {
    await refreshToken();
    window.location.reload();
  });
  // El admin desactivó esta cuenta mientras seguía conectada — su JWT ya
  // emitido seguiría siendo válido hasta expirar por su cuenta si no se
  // fuerza el logout aquí (authenticateJWT nunca reconsulta `activo`).
  state.socket.on('sesion_revocada', async () => {
    await logout();
    window.location.href = '/login/?expired=true';
  });
  state.socket.on('vale_evento', (data) => {
    // El mensaje ya viene formateado y listo del servidor ("{fecha} – Vale:
    // {correlativo} fue {acción} por {actor}[ a {destino}]"); `nivel: 'alerta'`
    // (atrasos, propuesta vacía) pinta el toast en rojo; `beep: false` permite
    // un evento silencioso (reenvío a varios talleres: un solo emit, un solo
    // beep, aunque el mensaje mencione a más de un destino).
    // Quien ejecutó la acción ya recibió su propio toast optimista local al
    // completarse el fetch — este evento le llega también a él (auto-broadcast
    // deliberado, para que el buzón se refresque), pero mostrarle un SEGUNDO
    // toast/beep por lo mismo que él mismo acaba de hacer sería una
    // notificación duplicada. Se sigue refrescando el buzón igual, solo se
    // omite el aviso.
    const esPropiaAccion = data.actorId != null && data.actorId === state.user.id;
    if (!esPropiaAccion) {
      const esAlerta = data.nivel === 'alerta';
      window.toast[esAlerta ? 'error' : 'info'](esAlerta ? 'Atención' : 'Vale de arte', data.mensaje);
      if (data.beep !== false) reproducirBeep();
    }
    // El dashboard de Gerencia/Supervisor se actualiza en tiempo real de
    // forma selectiva (ver actualizarDashboardGerenciaEnVivo) en vez de
    // recargar todo el buzón — evita reconstruir la grilla de tarjetas
    // mientras el usuario la está mirando.
    const enVistaGerencia = [ROL.SUPERVISOR, ROL.GERENTE].includes(state.user.rolId) && state.vista === 'dashboard';
    if (enVistaGerencia) {
      actualizarDashboardGerenciaEnVivo();
    } else {
      cargarBuzon();
    }
    if (state.cargaTrabajoModal) {
      if (state.cargaTrabajoModal.overlay.isConnected) {
        state.cargaTrabajoModal.actualizar();
      } else {
        state.cargaTrabajoModal = null;
      }
    }
    actualizarHistorialModalSiAplica();
  });
  // Canal aparte de `vale_evento` (ver events.js) — llega a CUALQUIER vista
  // que tenga abierto el historial de ESTE vale, sin importar el rol ni si
  // esa vista está en alguna de las salas por rol de `vale_evento`. Nunca
  // dispara toast/beep, solo refresca el modal si sigue abierto.
  state.socket.on('vale_actualizado', (data) => {
    if (state.historialModal && state.historialModal.valeId === data.valeId) {
      actualizarHistorialModalSiAplica();
    }
  });
}

function actualizarHistorialModalSiAplica() {
  if (!state.historialModal) return;
  if (state.historialModal.overlay.isConnected) {
    state.historialModal.actualizar();
  } else {
    state.historialModal = null;
  }
}
