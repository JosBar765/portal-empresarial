// Un fetch simple por endpoint de /api/prompts; el error conserva campos y codigo.
export async function pedir(url, opciones) {
  const res = await fetch(url, opciones);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'No se pudo completar la acción. Inténtalo de nuevo.');
    error.status = res.status;
    error.campos = data.campos;
    error.errores = data.errores;
    error.codigo = data.codigo;
    throw error;
  }
  return data;
}

export const enJson = (method, payload) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

// Sesión
export const sessionCheck = () => fetch('/api/auth.php?action=session_check').then(r => r.json());
export const logout = () => fetch('/api/auth.php?action=logout');

// Asesor
export const listarProductos = () => pedir('/api/prompts/productos');
export const obtenerContacto = () => pedir('/api/prompts/contacto');
export const generarPrompt = (payload) => pedir('/api/prompts/generar', enJson('POST', payload));
