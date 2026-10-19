import { state } from '../state.js';
import { hoyMedianoche, isoLocal, parseIsoLocal, primerDiaDelMes, sumarDiaLocal } from './fechas.js';
import { lunesDeSemana } from '../components/barraPeriodoReportes.js';

// Traduce el período elegido en la barra a los parámetros que entiende el servidor (solo «mes» y «rango»):
// Hoy y Día viajan como un rango de un solo día, Semana como un rango de lunes a domingo.
export function aplicarVentanaAQuery(qs) {
  const { tipo, fecha, desde, hasta } = state.ventana;
  const f = (tipo === 'hoy' ? null : parseIsoLocal(fecha)) || hoyMedianoche();
  if (tipo === 'mes') {
    qs.set('ventana', 'mes');
    qs.set('fecha', isoLocal(primerDiaDelMes(f)));
    return;
  }
  let d = isoLocal(f);
  let h = d;
  if (tipo === 'semana') { const lunes = lunesDeSemana(f); d = isoLocal(lunes); h = isoLocal(sumarDiaLocal(lunes, 6)); }
  else if (tipo === 'rango') { d = desde; h = hasta; }
  qs.set('ventana', 'rango');
  qs.set('desde', d);
  qs.set('hasta', h);
}
