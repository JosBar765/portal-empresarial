import { t } from '../textos.js';

// Un fetch simple por endpoint de /api/prompts; el error conserva campos y codigo.
// Los fallos de red o de formato se convierten en mensajes explicativos.
export async function pedir(url, opciones) {
  let res;
  try {
    res = await fetch(url, opciones);
  } catch (e) {
    throw new Error(t('comun.errores.sinConexion'));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data === null) {
    const motivo = data && data.error;
    const error = new Error(motivo || t(data === null ? 'comun.errores.respuestaNoLegible' : 'comun.errores.sinMotivo', { estado: res.status }));
    error.status = res.status;
    error.campos = data && data.campos;
    error.errores = data && data.errores;
    error.codigo = data && data.codigo;
    throw error;
  }
  return data;
}

export const enJson = (method, payload) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

// Sesión
export const sessionCheck = () => fetch('/api/auth.php?action=session_check').then(r => r.json());
export const logout = () => fetch('/api/auth.php?action=logout');

// Asesor
export const obtenerConfig = () => pedir('/api/prompts/config');
export const listarProductos = () => pedir('/api/prompts/productos');
export const generarPrompt = (payload) => pedir('/api/prompts/generar', enJson('POST', payload));

// Imagen fija del producto (misma origen): ante un fallo se muestra el motivo explicado por el servidor.
export async function descargarRecurso(url, etiqueta) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(t('comun.errores.sinConexion'));
  }
  if (res.ok) return res.blob();
  const data = await res.json().catch(() => null);
  throw new Error((data && data.error) || t('asesor.errores.recursoNoCargo', { etiqueta, estado: res.status }));
}
