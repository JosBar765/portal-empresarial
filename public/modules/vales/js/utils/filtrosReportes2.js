import { state } from '../state.js';
import { isoLocal } from './fechas.js';

// Filtros de Reportes 2 recordados en el navegador POR USUARIO: todo `state.reporte2` salvo el reporte (tiene su propia clave) y lo transitorio
// (barras elegidas). Un filtro nuevo agregado a `state.reporte2` se recuerda solo.
const PREFIJO = 'vales:rep2Filtros';
const CLAVES_ANTIGUAS = ['vales:rep2Filtros', 'vales:rep2Reporte']; // sin usuario: las veía cualquiera que usara el navegador
const TIPOS_VENTANA = ['hoy', 'dia', 'semana', 'mes', 'rango'];
const esPersistible = (clave) => clave !== 'reporteId' && !/Elegid/.test(clave);
const persistibles = () => Object.fromEntries(Object.entries(state.reporte2).filter(([clave]) => esPersistible(clave)));
const INICIALES = JSON.parse(JSON.stringify(persistibles())); // para volver al estado de fábrica si lo guardado ya no sirve

const idUsuario = () => state.user?.id ?? null;
const claveDe = (id) => `${PREFIJO}:${id}`;
let restauradoPara = null; // usuario cuyos filtros ya se restauraron: hasta entonces no se guarda (pisaría lo guardado con los de fábrica)

// El valor guardado debe tener la misma forma que el de fábrica (lista, texto, objeto); lo demás se descarta.
const mismaForma = (guardado, inicial) => (Array.isArray(inicial) ? Array.isArray(guardado) : typeof guardado === typeof inicial && guardado !== null);
const ventanaValida = (v) => v && TIPOS_VENTANA.includes(v.tipo) && ['fecha', 'desde', 'hasta'].every(k => typeof v[k] === 'string');

// Idempotente: restaura una sola vez por usuario y debe llamarse ANTES de fijar la ventana desde fuera (p. ej. «Ver reporte de este día»),
// para que lo fijado gane sobre lo guardado. Devuelve true si había algo guardado y se aplicó.
export function restaurarFiltrosReportes2() {
  const id = idUsuario();
  if (id == null || restauradoPara === id) return false;
  restauradoPara = id;
  let guardado = null;
  try {
    CLAVES_ANTIGUAS.forEach(k => localStorage.removeItem(k));
    guardado = JSON.parse(localStorage.getItem(claveDe(id)) || 'null');
  } catch { return false; }
  if (!guardado || typeof guardado !== 'object') return false;
  let aplicado = false;
  Object.keys(INICIALES).forEach((clave) => {
    if (!(clave in guardado) || !mismaForma(guardado[clave], INICIALES[clave])) return;
    if (clave === 'ventana') {
      if (!ventanaValida(guardado.ventana)) return;
      // «Hoy» guardado ayer sigue siendo «hoy»: se usa la fecha de ahora.
      state.reporte2.ventana = { ...guardado.ventana, ...(guardado.ventana.tipo === 'hoy' ? { fecha: isoLocal(new Date()) } : {}) };
    } else state.reporte2[clave] = guardado[clave];
    aplicado = true;
  });
  return aplicado;
}

export function guardarFiltrosReportes2() {
  const id = idUsuario();
  if (id == null || restauradoPara !== id) return;
  try { localStorage.setItem(claveDe(id), JSON.stringify(persistibles())); } catch { /* sin almacenamiento: no se recuerda */ }
}

// Vuelve a los filtros de fábrica y olvida lo guardado (un filtro guardado que ya no es válido no debe dejar el reporte en error).
export function reiniciarFiltrosReportes2() {
  Object.assign(state.reporte2, JSON.parse(JSON.stringify(INICIALES)), { ventana: { ...INICIALES.ventana, fecha: isoLocal(new Date()) } });
  const id = idUsuario();
  try { if (id != null) localStorage.removeItem(claveDe(id)); } catch { /* nada que olvidar */ }
}

// El reporte elegido también es por usuario.
export const claveReporteDe = () => `vales:rep2Reporte:${idUsuario() ?? ''}`;
