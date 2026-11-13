import { t } from '../textos.js';

const BASE = '/api/viaticos';

// Un fetch por endpoint de /api/viaticos; el error conserva status, campos, errores y codigo.
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

// Lista de textos para mostrar de un error: `errores`, los valores de `campos` o el mensaje.
export function mensajesDeError(error) {
  const texto = (e) => (e && typeof e === 'object' ? (e.mensaje || e.message || '') : String(e));
  if (Array.isArray(error.errores) && error.errores.length) return error.errores.map(texto).filter(Boolean);
  if (error.campos && typeof error.campos === 'object' && Object.keys(error.campos).length) return Object.values(error.campos).map(texto).filter(Boolean);
  return [error.message];
}

// Llave de idempotencia (1 a 64 caracteres): se genera una vez por intento de guardado y se reenvía igual en un reintento.
export function crearLlaveIdempotencia() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// Arma «?desde=&hasta=&q=» sin los filtros vacíos.
function consulta(filtros = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor != null && String(valor).trim() !== '') params.set(clave, String(valor).trim());
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

// Multipart de solicitud: `datos` lleva el JSON (con idempotencyKey) y `defectos` las fotos del viaje corto.
function formularioSolicitud(datos, fotos = []) {
  const formulario = new FormData();
  formulario.append('datos', JSON.stringify(datos));
  fotos.forEach(foto => formulario.append('defectos', foto));
  return formulario;
}

// ---------- Contexto y catálogos ----------
export const obtenerContexto = () => pedir(`${BASE}/contexto`);
export const obtenerCatalogosSolicitud = (paisId) => pedir(`${BASE}/catalogos/solicitud${consulta({ paisId })}`);

// ---------- Solicitudes del propio usuario ----------
export const calcularSolicitud = (datos) => pedir(`${BASE}/solicitudes/calcular`, enJson('POST', datos));
export const listarSolicitudes = (filtros) => pedir(`${BASE}/solicitudes${consulta(filtros)}`);
export const obtenerSolicitud = (id) => pedir(`${BASE}/solicitudes/${id}`);
export const crearSolicitud = (datos, fotos) => pedir(`${BASE}/solicitudes`, { method: 'POST', body: formularioSolicitud(datos, fotos) });
export const modificarSolicitud = (id, datos, fotos) => pedir(`${BASE}/solicitudes/${id}`, { method: 'PUT', body: formularioSolicitud(datos, fotos) });
export const darDeBajaSolicitud = (id) => pedir(`${BASE}/solicitudes/${id}`, { method: 'DELETE' });
export const obtenerDocumentosSolicitud = (id) => pedir(`${BASE}/solicitudes/${id}/documentos`);

// ---------- Liquidación del solicitante ----------
export const obtenerLiquidacion = (id) => pedir(`${BASE}/solicitudes/${id}/liquidacion`);

// `comprobante`: { archivo, tipoGastoId, monto, descripcion?, idempotencyKey? }.
export function agregarComprobante(id, { archivo, tipoGastoId, monto, descripcion, idempotencyKey }) {
  const formulario = new FormData();
  formulario.append('archivo', archivo);
  formulario.append('tipoGastoId', tipoGastoId);
  formulario.append('monto', monto);
  if (descripcion) formulario.append('descripcion', descripcion);
  if (idempotencyKey) formulario.append('idempotencyKey', idempotencyKey);
  return pedir(`${BASE}/solicitudes/${id}/comprobantes`, { method: 'POST', body: formulario });
}

export const quitarComprobante = (id, comprobanteId) => pedir(`${BASE}/solicitudes/${id}/comprobantes/${comprobanteId}`, { method: 'DELETE' });
export const liquidarSolicitud = (id) => pedir(`${BASE}/solicitudes/${id}/liquidar`, { method: 'POST' });

// ---------- Gestiones (todas las solicitudes) ----------
export const listarGestiones = (filtros) => pedir(`${BASE}/gestiones${consulta(filtros)}`);
export const obtenerGestion = (id) => pedir(`${BASE}/gestiones/${id}`);
export const obtenerDocumentosGestion = (id) => pedir(`${BASE}/gestiones/${id}/documentos`);
export const autorizarGestion = (id) => pedir(`${BASE}/gestiones/${id}/autorizar`, { method: 'POST' });
export const rechazarGestion = (id, motivo) => pedir(`${BASE}/gestiones/${id}/rechazar`, enJson('POST', { motivo }));
export const obtenerLiquidacionGestion = (id) => pedir(`${BASE}/gestiones/${id}/liquidacion`);

// ---------- Configuración: recursos con la misma forma (lista, alta, edición y activar) ----------
// `recurso` es un valor de RECURSOS: monedas, ubicaciones, tramos, motivos, tipos-gasto, tipos-defecto, tipos-licencia, tipos-placa, vehiculos.
export const listarConfig = (recurso) => pedir(`${BASE}/config/${recurso}`);
export const crearConfig = (recurso, datos) => pedir(`${BASE}/config/${recurso}`, enJson('POST', datos));
export const editarConfig = (recurso, id, datos) => pedir(`${BASE}/config/${recurso}/${id}`, enJson('PUT', datos));
export const cambiarActivoConfig = (recurso, id, activo) => pedir(`${BASE}/config/${recurso}/${id}/activo`, enJson('PATCH', { activo }));

// Países y combustibles: solo lectura.
export const listarPaises = () => listarConfig('paises');
export const listarCombustibles = () => listarConfig('combustibles');

// Matriz moneda × comida; el PUT reemplaza todo: { valores: [{ monedaId, tipoComidaId, valor }] }.
export const obtenerValoresComida = () => listarConfig('valores-comida');
export const guardarValoresComida = (valores) => pedir(`${BASE}/config/valores-comida`, enJson('PUT', { valores }));

// La regla no tiene id: su clave es { paisId, tipoLicenciaId, tipoPlacaId }.
const rutaRegla = ({ paisId, tipoLicenciaId, tipoPlacaId }) => `${BASE}/config/reglas-licencia/${paisId}/${tipoLicenciaId}/${tipoPlacaId}`;
export const listarReglasLicencia = () => listarConfig('reglas-licencia');
export const crearReglaLicencia = (datos) => pedir(`${BASE}/config/reglas-licencia`, enJson('POST', datos));
export const editarReglaLicencia = (clave, datos) => pedir(rutaRegla(clave), enJson('PUT', datos));
export const eliminarReglaLicencia = (clave) => pedir(rutaRegla(clave), { method: 'DELETE' });

// Personas: usuarios con licencia y países; guardar recibe { licencia: { tipoLicenciaId, numero, venceEl } | null, paisIds: [] }.
export const listarPersonas = () => listarConfig('personas');
export const guardarPersona = (usuarioId, datos) => pedir(`${BASE}/config/personas/${usuarioId}`, enJson('PUT', datos));

// Ajustes de archivo: tipos_archivo_permitidos y max_archivo_mb.
export const listarAjustes = () => listarConfig('ajustes');
export const guardarAjuste = (clave, valor) => pedir(`${BASE}/config/ajustes/${clave}`, enJson('PUT', { valor }));
