import { state } from './state.js';
import { TIEMPO_REAL, ACCIONES_AVISABLES, PERMISOS } from './config/constantes.js';
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

// Aviso solo si la vista afectada es la abierta y la acción no es propia.
function avisarSiAplica(data) {
  const avisables = ACCIONES_AVISABLES[state.tab] || [];
  if (!avisables.includes(data.accion) || esAccionPropia(data.id) || !window.toast) return;
  const tipo = data.accion === 'rechazada' ? 'warning' : 'info';
  window.toast[tipo](t('socket.titulo'), t(`socket.accion.${data.accion}`, { correlativo: data.correlativo }));
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
