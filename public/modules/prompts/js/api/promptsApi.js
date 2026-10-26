// Un fetch simple por endpoint de /api/prompts; el error conserva campos y codigo.
async function pedir(url, opciones) {
  const res = await fetch(url, opciones);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'No se pudo completar la acción. Inténtalo de nuevo.');
    error.status = res.status;
    error.campos = data.campos;
    error.codigo = data.codigo;
    throw error;
  }
  return data;
}

const enJson = (method, payload) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

// Sesión
export const sessionCheck = () => fetch('/api/auth.php?action=session_check').then(r => r.json());
export const logout = () => fetch('/api/auth.php?action=logout');

// Asesor
export const listarProductos = () => pedir('/api/prompts/productos');
export const obtenerContacto = () => pedir('/api/prompts/contacto');
export const generarPrompt = (payload) => pedir('/api/prompts/generar', enJson('POST', payload));

// Administración (la usa la vista de productos)
export const listarProductosAdmin = () => pedir('/api/prompts/admin/productos');
export const crearProducto = (payload) => pedir('/api/prompts/admin/productos', enJson('POST', payload));
export const obtenerProductoAdmin = (id) => pedir(`/api/prompts/admin/productos/${id}`);
export const crearBorrador = (id) => pedir(`/api/prompts/admin/productos/${id}/borrador`, { method: 'POST' });
export const guardarBorrador = (id, payload) => pedir(`/api/prompts/admin/productos/${id}/borrador`, enJson('PUT', payload));
export const descartarBorrador = (id) => pedir(`/api/prompts/admin/productos/${id}/borrador`, { method: 'DELETE' });
export const publicarProducto = (id) => pedir(`/api/prompts/admin/productos/${id}/publicar`, { method: 'POST' });
export const cambiarEstadoProducto = (id, estado) => pedir(`/api/prompts/admin/productos/${id}/estado`, enJson('PATCH', { estado }));
export const previsualizar = (payload) => pedir('/api/prompts/admin/previsualizar', enJson('POST', payload));
