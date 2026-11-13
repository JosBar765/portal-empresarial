import { state } from './state.js';
import { TIEMPO_REAL, ACCIONES_AVISABLES, PERMISOS, TABS } from './config/constantes.js';
import { t } from './textos.js';
import { refreshToken, logout } from './api/authApi.js';

let recargaVista = null;
let recargaProgramada = null;
let recargaDiferida = false;

// Cada vista registra cómo refrescarse (o null al salir de ella); el socket solo la dispara.
export function registrarRecarga(fn) {
  recargaVista = typeof fn === 'function' ? fn : null;
}

// Las vistas lo llaman tras una acción propia: el evento de tiempo real no trae al actor y no se le avisa lo que él mismo hizo.
export function registrarAccionPropia(id) {
  state.accionesPropias.set(Number(id), Date.now());
}

function esAccionPropia(id) {
  const marca = state.accionesPropias.get(Number(id));
  if (marca === undefined) return false;
  if (Date.now() - marca > TIEMPO_REAL.VENTANA_ACCION_PROPIA_MS) {
    state.accionesPropias.delete(Number(id));
    return false;
  }
  return true;
}

// Aviso solo si la vista afectada es la abierta y la acción no es propia. En Solicitudes solo importan las decisiones sobre lo del propio usuario (`solicitanteId`).
function avisarSiAplica(data) {
  const avisables = ACCIONES_AVISABLES[state.tab] || [];
  // El actor viaja en el evento: quien hizo la acción no recibe además un aviso de lo que acaba de hacer (el evento puede llegar antes que la respuesta).
  if (!avisables.includes(data.accion) || Number(data.actorId) === Number(state.user.id) || esAccionPropia(data.id) || !window.toast) return;
  const enSolicitudes = state.tab === TABS.SOLICITUDES;
  if (enSolicitudes && Number(data.solicitanteId) !== Number(state.user.id)) return;
  const tipo = data.accion === 'rechazada' ? 'warning' : 'info';
  const clave = enSolicitudes ? `socket.propia.${data.accion}` : `socket.accion.${data.accion}`;
  window.toast[tipo](t('socket.titulo'), t(clave, { correlativo: data.correlativo }));
}

// Los eventos seguidos comparten una sola recarga; con la pestaña oculta se espera a que vuelva a verse.
function programarRecarga() {
  if (document.hidden) { recargaDiferida = true; return; }
  if (recargaProgramada) return;
  recargaProgramada = setTimeout(() => {
    recargaProgramada = null;
    if (recargaVista) Promise.resolve(recargaVista()).catch(error => console.error('No se pudo refrescar la vista de viáticos:', error));
  }, TIEMPO_REAL.ESPERA_RECARGA_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden || !recargaDiferida) return;
  recargaDiferida = false;
  programarRecarga();
});

export function initSocket() {
  if (typeof io === 'undefined') return;
  state.socket = io({ query: { userId: state.user.id } });
  window.centroNotificaciones?.iniciar({ socket: state.socket, modulo: 'viaticos' });
  window.avisoMantenimiento?.iniciar({ socket: state.socket, rolId: state.user.rolId });

  state.socket.on('connect', () => {
    const salas = [`role_${state.user.rolId}`];
    if ((state.user.permissions || []).includes(PERMISOS.GESTIONAR)) salas.push(TIEMPO_REAL.SALA_GESTION);
    state.socket.emit('register_module', salas);
  });
  state.socket.on('permisos_actualizados', async () => {
    await refreshToken();
    window.location.reload();
  });
  // El admin desactivó la cuenta mientras seguía conectada: su JWT seguiría válido hasta expirar si no se fuerza aquí.
  state.socket.on('sesion_revocada', async () => {
    await logout();
    window.location.href = '/login/?expired=true';
  });
  state.socket.on(TIEMPO_REAL.EVENTO_ACTUALIZADA, (data) => {
    avisarSiAplica(data);
    programarRecarga();
  });
}
