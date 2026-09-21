// Una función por endpoint de /api/vales. Cada una reproduce exactamente la
// semántica de verificación de errores que tenía su call site original en el
// app.js monolítico — algunas lanzan con el mensaje del servidor, otras con
// un mensaje fijo, y otras no verifican `res.ok` porque el llamador original
// las envolvía en un try/catch con un valor de respaldo. Esa diferencia se
// conserva a propósito.

// Si el servidor (o un intermediario delante de él, ej. un límite de tamaño
// de subida del hosting) responde con HTML en vez de JSON, `res.json()`
// truena con un mensaje crudo de parseo ("Unexpected token '<', ... is not
// valid JSON") que no le dice nada útil a quien está usando el formulario —
// se homogeniza acá a un mensaje claro, sin cambiar la revisión de `res.ok`
// que ya hace cada función.
async function leerJSON(res) {
  try {
    return await res.json();
  } catch {
    throw new Error(res.ok
      ? 'El servidor respondió en un formato inesperado.'
      : `Error del servidor (${res.status}). Si adjuntaste un archivo, es posible que sea demasiado grande.`);
  }
}

async function enviarPost(url) {
  const res = await fetch(url, { method: 'POST' });
  const data = await leerJSON(res);
  if (!res.ok) throw new Error(data.error);
  return data;
}

async function enviarJSON(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await leerJSON(res);
  if (!res.ok) throw new Error(data.error);
  return data;
}

async function enviarFormData(url, formData) {
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await leerJSON(res);
  if (!res.ok) throw new Error(data.error);
  return data;
}

export async function obtenerCatalogos() {
  const res = await fetch('/api/vales/catalogos');
  return leerJSON(res);
}

export async function obtenerBuzon(qs) {
  const res = await fetch(`/api/vales?${qs.toString()}`);
  if (!res.ok) throw new Error('No se pudo cargar el buzón.');
  return leerJSON(res);
}

export async function obtenerMasVales(qs) {
  const res = await fetch(`/api/vales?${qs.toString()}`);
  if (!res.ok) throw new Error('No se pudo cargar más vales.');
  return leerJSON(res);
}

export async function obtenerLimiteColectivo() {
  const res = await fetch('/api/vales/limite-colectivo');
  return leerJSON(res);
}

// Capacidad por día del mes visible, para el calendario de "Fecha de
// entrega" — analisis_correcciones_28.md.
export async function obtenerCapacidadEntrega(talleresIds, anio, mes) {
  const qs = new URLSearchParams({ talleres: talleresIds.join(','), anio, mes });
  const res = await fetch(`/api/vales/capacidad-entrega?${qs.toString()}`);
  if (!res.ok) throw new Error('No se pudo cargar la capacidad de los talleres.');
  return leerJSON(res);
}

export async function buscarValePorCorrelativo(correlativo) {
  const res = await fetch(`/api/vales/buscar?correlativo=${encodeURIComponent(correlativo)}`);
  const data = await leerJSON(res);
  if (!res.ok) throw new Error(data.error || 'No se pudo buscar el vale.');
  return data;
}

export async function obtenerRendimientoGerencia(qs) {
  const res = await fetch(`/api/vales/rendimiento-gerencia?${qs.toString()}`);
  if (!res.ok) throw new Error('No se pudo cargar el rendimiento.');
  return leerJSON(res);
}

export async function obtenerTecnicosAsignables() {
  const res = await fetch('/api/vales/tecnicos');
  return leerJSON(res);
}

export async function crearVale(formData) {
  const res = await fetch('/api/vales', { method: 'POST', body: formData });
  const data = await leerJSON(res);
  if (!res.ok) throw new Error(data.error || 'No se pudo crear el vale de arte.');
  return data;
}

export function asignarTecnico(valeId, tecnicoId) {
  return enviarJSON(`/api/vales/${valeId}/asignar`, { tecnicoId });
}

export async function obtenerDetalleVale(valeId) {
  const res = await fetch(`/api/vales/${valeId}`);
  return leerJSON(res);
}

export function revisarPropuesta(valeId, payload) {
  return enviarJSON(`/api/vales/${valeId}/revisar`, payload);
}

export function comenzarVale(valeId) {
  return enviarPost(`/api/vales/${valeId}/comenzar`);
}

export function entregarPropuesta(valeId, formData) {
  return enviarFormData(`/api/vales/${valeId}/entregar`, formData);
}

export function cancelarProceso(valeId) {
  return enviarPost(`/api/vales/${valeId}/cancelar-proceso`);
}

export function pausarVale(valeId) {
  return enviarPost(`/api/vales/${valeId}/pausar`);
}

export function reanudarVale(valeId) {
  return enviarPost(`/api/vales/${valeId}/reanudar`);
}

export function aprobarGeneral(valeId, formData) {
  return enviarFormData(`/api/vales/${valeId}/aprobar-general`, formData);
}

export function confirmarRecibido(valeId) {
  return enviarPost(`/api/vales/${valeId}/confirmar`);
}

export function solicitarModificacion(valeId, payload) {
  return enviarJSON(`/api/vales/${valeId}/solicitar-modificacion`, payload);
}

export function autorizarCreacion(valeId) {
  return enviarPost(`/api/vales/${valeId}/autorizar-creacion`);
}

export function rechazarCreacion(valeId) {
  return enviarPost(`/api/vales/${valeId}/rechazar-creacion`);
}

export function aprobarModificacion(valeId) {
  return enviarPost(`/api/vales/${valeId}/aprobar-modificacion`);
}

export function rechazarModificacion(valeId) {
  return enviarPost(`/api/vales/${valeId}/rechazar-modificacion`);
}

export async function obtenerCargaTrabajo() {
  const res = await fetch('/api/vales/carga-trabajo');
  return leerJSON(res);
}

export async function obtenerAsignacionesTecnico(tecnicoId) {
  const res = await fetch(`/api/vales/carga-trabajo/${tecnicoId}`);
  return leerJSON(res);
}
