import { state } from './state.js';
import { refreshToken } from './api/authApi.js';

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
}
