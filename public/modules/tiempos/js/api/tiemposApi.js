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

// Administración (solo tiempos.administrar)
export const adminEstado = () => pedir(`${BASE}/admin/estado`);
export const adminTabla = () => pedir(`${BASE}/admin/tabla`);
export const adminCrearProducto = (cuerpo) => pedir(`${BASE}/admin/productos`, enJson('POST', cuerpo));
export const adminGuardarProducto = (clave, cuerpo) => pedir(`${BASE}/admin/productos/${encodeURIComponent(clave)}`, enJson('PUT', cuerpo));
export const adminGuardarExtras = (cuerpo) => pedir(`${BASE}/admin/extras`, enJson('PUT', cuerpo));
export const adminGuardarAvisos = (cuerpo) => pedir(`${BASE}/admin/avisos-generales`, enJson('PUT', cuerpo));
export const adminGuardarCatalogos = (cuerpo) => pedir(`${BASE}/admin/catalogos`, enJson('PUT', cuerpo));
export const adminCambios = () => pedir(`${BASE}/admin/cambios`);
export const adminPublicar = (cuerpo) => pedir(`${BASE}/admin/publicar`, enJson('POST', cuerpo));
export const adminDescartar = () => pedir(`${BASE}/admin/borrador`, { method: 'DELETE' });
export const adminVersiones = () => pedir(`${BASE}/admin/versiones`);
export const adminCambiosDeVersion = (id) => pedir(`${BASE}/admin/versiones/${id}/cambios`);
export const adminUsarComoBorrador = (id) => pedir(`${BASE}/admin/versiones/${id}/usar-como-borrador`, enJson('POST', {}));
export const adminActividad = () => pedir(`${BASE}/admin/actividad`);
