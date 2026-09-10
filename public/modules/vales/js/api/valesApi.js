// Una función por endpoint de /api/vales. Cada una reproduce exactamente la
// semántica de verificación de errores que tenía su call site original en el
// app.js monolítico — algunas lanzan con el mensaje del servidor, otras con
// un mensaje fijo, y otras no verifican `res.ok` porque el llamador original
// las envolvía en un try/catch con un valor de respaldo. Esa diferencia se
// conserva a propósito.

async function enviarPost(url) {
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

async function enviarJSON(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

async function enviarFormData(url, formData) {
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export async function obtenerCatalogos() {
  const res = await fetch('/api/vales/catalogos');
  return res.json();
}

export async function obtenerBuzon(qs) {
  const res = await fetch(`/api/vales?${qs.toString()}`);
  if (!res.ok) throw new Error('No se pudo cargar el buzón.');
  return res.json();
}

export async function obtenerMasVales(qs) {
  const res = await fetch(`/api/vales?${qs.toString()}`);
  if (!res.ok) throw new Error('No se pudo cargar más vales.');
  return res.json();
}

export async function obtenerLimiteColectivo() {
  const res = await fetch('/api/vales/limite-colectivo');
  return res.json();
}

export async function obtenerDashboardGerencia(qs) {
  const res = await fetch(`/api/vales/dashboard-gerencia?${qs.toString()}`);
  if (!res.ok) throw new Error('No se pudo cargar el dashboard.');
  return res.json();
}

export async function obtenerTecnicosAsignables() {
  const res = await fetch('/api/vales/tecnicos');
  return res.json();
}

export async function crearVale(formData) {
  const res = await fetch('/api/vales', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No se pudo crear el vale de arte.');
  return data;
}

export function asignarTecnico(valeId, tecnicoId) {
  return enviarJSON(`/api/vales/${valeId}/asignar`, { tecnicoId });
}

export async function obtenerDetalleVale(valeId) {
  const res = await fetch(`/api/vales/${valeId}`);
  return res.json();
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

export async function obtenerCargaTrabajo() {
  const res = await fetch('/api/vales/carga-trabajo');
  return res.json();
}

export async function obtenerAsignacionesTecnico(tecnicoId) {
  const res = await fetch(`/api/vales/carga-trabajo/${tecnicoId}`);
  return res.json();
}
