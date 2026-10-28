// Endpoints de administración (/api/prompts/admin); reusa el manejo de errores del asesor.
import { pedir, enJson } from './promptsApi.js';

const base = '/api/prompts/admin';

export const listarProductos = () => pedir(`${base}/productos`);
export const crearProducto = (payload) => pedir(`${base}/productos`, enJson('POST', payload));
export const duplicarProducto = (id, payload) => pedir(`${base}/productos/${id}/duplicar`, enJson('POST', payload));
export const obtenerProducto = (id) => pedir(`${base}/productos/${id}`);
export const crearBorrador = (id) => pedir(`${base}/productos/${id}/borrador`, { method: 'POST' });
export const guardarBorrador = (id, payload) => pedir(`${base}/productos/${id}/borrador`, enJson('PUT', payload));
export const descartarBorrador = (id) => pedir(`${base}/productos/${id}/borrador`, { method: 'DELETE' });
export const publicar = (id) => pedir(`${base}/productos/${id}/publicar`, { method: 'POST' });
export const borrarProducto = (id) => pedir(`${base}/productos/${id}`, { method: 'DELETE' });
export const cambiarEstado = (id, estado) => pedir(`${base}/productos/${id}/estado`, enJson('PATCH', { estado }));
export const previsualizar = (payload) => pedir(`${base}/previsualizar`, enJson('POST', payload));
export const listarAjustes = () => pedir(`${base}/ajustes`);
export const guardarAjuste = (clave, valor) => pedir(`${base}/ajustes/${encodeURIComponent(clave)}`, enJson('PUT', { valor }));
