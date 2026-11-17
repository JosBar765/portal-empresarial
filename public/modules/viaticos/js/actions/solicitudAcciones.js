// Acciones de una solicitud propia que se resuelven con una confirmación y una llamada a la API.
import { confirmarModal } from '../components/modal.js';
import { darDeBajaSolicitud, mensajesDeError } from '../api/viaticosApi.js';
import { registrarAccionPropia } from '../socket.js';
import { t } from '../textos.js';

// `alTerminar` refresca la lista una vez dada de baja; así este archivo no importa la vista (evita un ciclo de imports).
export async function darDeBaja(solicitud, alTerminar) {
  const confirmada = await confirmarModal({
    title: t('solicitudes.baja.titulo'),
    mensaje: t('solicitudes.baja.mensaje', { correlativo: solicitud.correlativo }),
    aceptar: t('solicitudes.baja.confirmar'),
    peligro: true
  });
  if (!confirmada) return false;
  try {
    await darDeBajaSolicitud(solicitud.id);
  } catch (error) {
    window.toast?.error(t('solicitudes.baja.error'), mensajesDeError(error).join(' '));
    return false;
  }
  // El evento de tiempo real no trae al actor: se marca antes de recargar para no avisarle lo que él mismo hizo.
  registrarAccionPropia(solicitud.id);
  window.toast?.success(t('tab.solicitudes'), t('solicitudes.baja.exito', { correlativo: solicitud.correlativo }));
  if (alTerminar) await alTerminar();
  return true;
}
