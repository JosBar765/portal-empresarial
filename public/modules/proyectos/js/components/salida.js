// Una pantalla con cambios sin guardar avisa antes de que la persona salga (menú, atrás o cerrar la pestaña).
import { state } from '../state.js';
import { confirmarModal } from './modal.js';

export function registrarSalida(haySinGuardar) {
  state.salidaVista = {
    sucio: haySinGuardar,
    confirmar: async () => !haySinGuardar() || confirmarModal({
      title: 'Hay cambios sin guardar',
      mensaje: 'Si sales ahora, se pierden. ¿Quieres salir?',
      aceptar: 'Salir sin guardar',
      cancelar: 'Seguir editando'
    })
  };
}

export function liberarSalida() {
  state.salidaVista = null;
}

window.addEventListener('beforeunload', (e) => {
  if (state.salidaVista && state.salidaVista.sucio()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
