// public/modules/incidencias/js/api/configApi.js
// Un fetch por ruta de /api/incidencias/configuracion (solo con el permiso de configurar).
import { pedir } from './incidenciasApi.js';

const BASE = '/api/incidencias/configuracion';
const enJson = (metodo, cuerpo) => ({ method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
const consulta = (params) => {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
  const texto = q.toString();
  return texto ? `?${texto}` : '';
};

export const estado = () => pedir(`${BASE}/estado`);
export const historial = (limite = 60) => pedir(`${BASE}/historial${consulta({ limite })}`);

export const paises = () => pedir(`${BASE}/paises`);
export const actualizarPais = (id, cuerpo) => pedir(`${BASE}/paises/${id}`, enJson('PUT', cuerpo));

export const catalogo = (nombre) => pedir(`${BASE}/catalogos/${nombre}`);
export const crearEnCatalogo = (nombre, cuerpo) => pedir(`${BASE}/catalogos/${nombre}`, enJson('POST', cuerpo));
export const actualizarEnCatalogo = (nombre, id, cuerpo) => pedir(`${BASE}/catalogos/${nombre}/${id}`, enJson('PUT', cuerpo));

export const prioridades = () => pedir(`${BASE}/prioridades`);
export const crearPrioridad = (cuerpo) => pedir(`${BASE}/prioridades`, enJson('POST', cuerpo));
export const actualizarPrioridad = (id, cuerpo) => pedir(`${BASE}/prioridades/${id}`, enJson('PUT', cuerpo));
export const guardarReglas = (reglas) => pedir(`${BASE}/prioridades/reglas`, enJson('PUT', { reglas }));

export const parametros = () => pedir(`${BASE}/parametros`);
export const guardarParametros = (valores) => pedir(`${BASE}/parametros`, enJson('PUT', { valores }));

export const tecnicos = () => pedir(`${BASE}/tecnicos`);
export const candidatosTecnico = (q) => pedir(`${BASE}/tecnicos/candidatos${consulta({ q })}`);
export const agregarTecnico = (cuerpo) => pedir(`${BASE}/tecnicos`, enJson('POST', cuerpo));
export const actualizarTecnico = (usuarioId, cuerpo) => pedir(`${BASE}/tecnicos/${usuarioId}`, enJson('PUT', cuerpo));

export const verificadores = () => pedir(`${BASE}/verificadores`);
export const candidatosVerificador = (q) => pedir(`${BASE}/verificadores/candidatos${consulta({ q })}`);
export const agregarVerificador = (cuerpo) => pedir(`${BASE}/verificadores`, enJson('POST', cuerpo));
export const quitarVerificador = (id) => pedir(`${BASE}/verificadores/${id}`, { method: 'DELETE' });

export const roles = () => pedir(`${BASE}/roles`);
export const actualizarRol = (rolId, permisos) => pedir(`${BASE}/roles/${rolId}`, enJson('PUT', { permisos }));
