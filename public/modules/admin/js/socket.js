import { state } from './state.js';
import { refreshToken, logout } from './api/authApi.js';

// Para enterarse si el propio admin.ver le fue revocado a su rol (u otro
// cambio de permisos) mientras está parado en el panel.
export function initSocket() {
  if (typeof io === 'undefined') return;
  state.socket = io({ query: { userId: state.user.id } });
  state.socket.on('connect', () => {
    state.socket.emit('register_module', [`role_${state.user.rolId}`]);
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
}
