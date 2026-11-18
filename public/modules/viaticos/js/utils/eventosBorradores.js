// Guardar, eliminar o enviar un borrador avisa con este evento para refrescar el contador del botón «Borradores».
export const EVENTO_BORRADORES = 'viaticos:borradores:cambio';
export const avisarCambioBorradores = () => document.dispatchEvent(new Event(EVENTO_BORRADORES));
