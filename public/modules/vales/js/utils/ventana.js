import { state } from '../state.js';

// Traduce el período elegido en la barra a los parámetros que entiende el servidor. Un día elegido viaja como
// un rango de un solo día (el servidor filtra rangos de forma inclusiva por fecha de entrega).
export function aplicarVentanaAQuery(qs) {
  const { tipo, fecha, desde, hasta } = state.ventana;
  if (tipo === 'dia') {
    qs.set('ventana', 'rango');
    qs.set('desde', fecha);
    qs.set('hasta', fecha);
    return;
  }
  if (tipo) qs.set('ventana', tipo);
  if (tipo === 'mes') qs.set('fecha', fecha);
  if (tipo === 'rango') {
    if (desde) qs.set('desde', desde);
    if (hasta) qs.set('hasta', hasta);
  }
}
