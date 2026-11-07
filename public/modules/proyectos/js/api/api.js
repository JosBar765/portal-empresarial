// Un fetch simple por endpoint de /api/proyectos; el error conserva el mensaje y el detalle por campo.
export async function pedir(url, opciones) {
  let res;
  try {
    res = await fetch(url, opciones);
  } catch (e) {
    throw new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data === null) {
    const error = new Error((data && data.error) || `No se pudo completar la acción (código ${res.status}).`);
    error.status = res.status;
    error.campos = data && data.campos;
    throw error;
  }
  return data;
}

const enJson = (method, payload) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const consulta = (parametros) => {
  const limpios = Object.entries(parametros).filter(([, v]) => v !== '' && v != null);
  return limpios.length ? `?${new URLSearchParams(limpios)}` : '';
};

// Sesión
export const sessionCheck = () => fetch('/api/auth.php?action=session_check').then(r => r.json());
export const logout = () => fetch('/api/auth.php?action=logout');
export const refreshToken = () => fetch('/api/auth/refresh', { method: 'POST' });

const BASE = '/api/proyectos';

// Centro de configuración
export const obtenerResumen = () => pedir(`${BASE}/config/resumen`);
export const listarParametros = () => pedir(`${BASE}/config/parametros`);
export const guardarParametros = (cambios) => pedir(`${BASE}/config/parametros`, enJson('PUT', { cambios }));
export const listarReglas = () => pedir(`${BASE}/config/reglas`);
export const guardarReglas = (cambios) => pedir(`${BASE}/config/reglas`, enJson('PUT', { cambios }));
export const restaurarAjuste = (clave) => pedir(`${BASE}/config/ajustes/${encodeURIComponent(clave)}/restaurar`, { method: 'POST' });
export const listarPaises = () => pedir(`${BASE}/config/paises`);
export const guardarPais = (paisId, datos) => pedir(`${BASE}/config/paises/${paisId}`, enJson('PUT', datos));
export const listarHistorial = (filtros) => pedir(`${BASE}/config/historial${consulta(filtros)}`);
export const restaurarCambio = (id) => pedir(`${BASE}/config/historial/${id}/restaurar`, { method: 'POST' });

// Catálogos
export const listarCatalogo = (catalogo) => pedir(`${BASE}/catalogos/${catalogo}`);
export const crearEnCatalogo = (catalogo, datos) => pedir(`${BASE}/catalogos/${catalogo}`, enJson('POST', datos));
export const editarEnCatalogo = (catalogo, id, datos) => pedir(`${BASE}/catalogos/${catalogo}/${encodeURIComponent(id)}`, enJson('PUT', datos));
export const cambiarActivoEnCatalogo = (catalogo, id, activo) => pedir(`${BASE}/catalogos/${catalogo}/${encodeURIComponent(id)}/activo`, enJson('PATCH', { activo }));
