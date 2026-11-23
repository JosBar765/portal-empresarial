// public/modules/tiempos/js/api/tiemposApi.js
// Un fetch simple por ruta de /api/tiempos. El error conserva el estado, el mensaje del servidor y el detalle por campo.
const BASE = '/api/tiempos';

export async function pedir(url, opciones) {
  let res;
  try {
    res = await fetch(url, opciones);
  } catch (e) {
    const error = new Error('No hay conexión. Revisa tu señal e inténtalo de nuevo.');
    error.sinConexion = true;
    throw error;
  }
  const datos = await res.json().catch(() => null);
  if (!res.ok || datos === null) {
    const error = new Error((datos && datos.error) || 'Algo salió mal. Inténtalo de nuevo en unos minutos.');
    error.status = res.status;
    error.campos = datos && datos.campos;
    throw error;
  }
  return datos;
}

const enJson = (metodo, cuerpo) => ({ method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });

export const sessionCheck = () => fetch('/api/auth.php?action=session_check').then(r => r.json());
export const logout = () => fetch('/api/auth.php?action=logout');

export const obtenerTabla = () => pedir(`${BASE}/tabla`);
export const calcular = (pedido) => pedir(`${BASE}/calcular`, enJson('POST', pedido));
export const obtenerFestivos = (desde, hasta) => pedir(`${BASE}/festivos?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`);
