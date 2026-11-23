// Cálculo puro (sin DOM) de cuántas filas del desglose se dibujan por vez; el desglose las pide a demanda.
export const TAMANO_PAGINA = 50;

// Rango [desde, hasta) de la siguiente tanda y cuántas quedarán sin dibujar después de ella.
export function siguienteTramo(total, mostrados = 0, tamano = TAMANO_PAGINA) {
  const desde = Math.min(Math.max(mostrados, 0), total);
  const hasta = Math.min(total, desde + tamano);
  return { desde, hasta, quedan: total - hasta };
}

// Datos del botón «Ver N más»: N es lo que revelará la próxima pulsación (menos de una página al final).
export function datosVerMas(quedan, tamano = TAMANO_PAGINA) {
  return { n: Math.min(Math.max(quedan, 0), tamano), quedan: Math.max(quedan, 0) };
}
