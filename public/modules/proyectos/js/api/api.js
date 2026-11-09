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
    error.codigo = data && data.codigo;
    error.duplicados = data && data.duplicados;
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

// Empresas de la base global
export const obtenerOpcionesClientes = () => pedir(`${BASE}/clientes/opciones`);
export const listarClientes = (filtros) => pedir(`${BASE}/clientes${consulta(filtros)}`);
export const obtenerCliente = (id) => pedir(`${BASE}/clientes/${encodeURIComponent(id)}`);
export const revisarDuplicados = (datos) => pedir(`${BASE}/clientes/duplicados`, enJson('POST', datos));
export const crearCliente = (datos, confirmarDuplicado) => pedir(`${BASE}/clientes`, enJson('POST', { ...datos, confirmarDuplicado }));
export const editarCliente = (id, datos, confirmarDuplicado) => pedir(`${BASE}/clientes/${encodeURIComponent(id)}`, enJson('PUT', { ...datos, confirmarDuplicado }));
export const cambiarEstadoCliente = (id, datos) => pedir(`${BASE}/clientes/${encodeURIComponent(id)}/estado`, enJson('POST', datos));
export const agregarContacto = (clienteId, datos) => pedir(`${BASE}/clientes/${encodeURIComponent(clienteId)}/contactos`, enJson('POST', datos));
export const editarContacto = (contactoId, datos) => pedir(`${BASE}/clientes/contactos/${encodeURIComponent(contactoId)}`, enJson('PUT', datos));
export const cambiarActivoContacto = (contactoId, activo) => pedir(`${BASE}/clientes/contactos/${encodeURIComponent(contactoId)}/activo`, enJson('PATCH', { activo }));

// Importación (el archivo viaja como formulario, no como JSON)
const conArchivo = (archivo, campos = {}) => {
  const formulario = new FormData();
  Object.entries(campos).forEach(([k, v]) => formulario.append(k, v));
  formulario.append('archivo', archivo, archivo.name);
  return { method: 'POST', body: formulario };
};
export const URL_PLANTILLA = `${BASE}/clientes/importar/plantilla`;
export const previsualizarImportacion = (archivo) => pedir(`${BASE}/clientes/importar/previsualizar`, conArchivo(archivo));
export const confirmarImportacion = (archivo, duplicadas, idempotencyKey) => pedir(`${BASE}/clientes/importar/confirmar`, conArchivo(archivo, { duplicadas, idempotencyKey }));

// Campos propios (A6) y alcance de usuarios (A7)
export const listarCampos = () => pedir(`${BASE}/config/campos`);
export const crearCampo = (datos) => pedir(`${BASE}/config/campos`, enJson('POST', datos));
export const editarCampo = (id, datos) => pedir(`${BASE}/config/campos/${encodeURIComponent(id)}`, enJson('PUT', datos));
export const cambiarActivoCampo = (id, activo) => pedir(`${BASE}/config/campos/${encodeURIComponent(id)}/activo`, enJson('PATCH', { activo }));
export const listarAlcance = (filtros) => pedir(`${BASE}/config/alcance${consulta(filtros || {})}`);
export const guardarAlcance = (usuarioId, paises) => pedir(`${BASE}/config/alcance/${encodeURIComponent(usuarioId)}`, enJson('PUT', { paises }));
