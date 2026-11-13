// public/modules/incidencias/js/api/incidenciasApi.js
// Un fetch simple por ruta de /api/incidencias. El error conserva el estado, el mensaje del servidor y el detalle por campo.
const BASE = '/api/incidencias';

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
const enForm = (formData) => ({ method: 'POST', body: formData });
const consulta = (params) => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
  const texto = q.toString();
  return texto ? `?${texto}` : '';
};

// Sesión
export const sessionCheck = () => fetch('/api/auth.php?action=session_check').then(r => r.json());
export const logout = () => fetch('/api/auth.php?action=logout');

// Reportar y consultar
export const formulario = () => pedir(`${BASE}/formulario`);
export const atencion = (params) => pedir(`${BASE}/atencion${consulta(params)}`);
export const similares = (params) => pedir(`${BASE}/similares${consulta(params)}`);
export const crear = (formData) => pedir(BASE, enForm(formData));
export const listar = (params) => pedir(`${BASE}${consulta(params)}`);
export const resumen = () => pedir(`${BASE}/resumen`);
export const detalle = (id) => pedir(`${BASE}/${id}`);

// Técnico
export const tomar = (id) => pedir(`${BASE}/${id}/tomar`, enJson('POST'));
export const avance = (id, formData) => pedir(`${BASE}/${id}/avances`, enForm(formData));
export const ponerEnEspera = (id, cuerpo) => pedir(`${BASE}/${id}/espera`, enJson('POST', cuerpo));
export const reanudar = (id) => pedir(`${BASE}/${id}/reanudar`, enJson('POST'));
export const enviarVerificacion = (id, formData) => pedir(`${BASE}/${id}/verificacion`, enForm(formData));
export const devolver = (id, cuerpo) => pedir(`${BASE}/${id}/devolver`, enJson('POST', cuerpo));

// Verificador y asignador
export const aprobar = (id, cuerpo) => pedir(`${BASE}/${id}/aprobar`, enJson('POST', cuerpo));
export const pedirCorreccion = (id, formData) => pedir(`${BASE}/${id}/correccion`, enForm(formData));
export const reasignar = (id, cuerpo) => pedir(`${BASE}/${id}/reasignar`, enJson('POST', cuerpo));
export const descartar = (id, cuerpo) => pedir(`${BASE}/${id}/descartar`, enJson('POST', cuerpo));
export const cambiarPrioridad = (id, cuerpo) => pedir(`${BASE}/${id}/prioridad`, enJson('PUT', cuerpo));

// Todos
export const comentar = (id, cuerpo) => pedir(`${BASE}/${id}/comentarios`, enJson('POST', cuerpo));
