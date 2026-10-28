// Cualquier cambio en los borradores (guardar, borrar, enviar) avisa con este evento para refrescar el contador.
export const EVENTO_BORRADORES = 'borradores:cambio';
export const avisarCambioBorradores = () => document.dispatchEvent(new Event(EVENTO_BORRADORES));
