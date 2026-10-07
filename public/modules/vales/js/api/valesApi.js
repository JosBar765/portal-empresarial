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
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la acción. Inténtalo de nuevo.');
  return data;
}

async function enviarJSON(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await leerJSON(res);
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la acción. Inténtalo de nuevo.');
  return data;
}

async function enviarFormData(url, formData) {
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await leerJSON(res);
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la acción. Inténtalo de nuevo.');
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

export async function obtenerReporte(qs) {
  const res = await fetch(`/api/vales/reportes?${qs.toString()}`);
  const data = await leerJSON(res);
  if (!res.ok) throw new Error(data.error || 'No se pudo cargar el reporte.');
  return data;
}

// Descarga el PDF del reporte con los mismos filtros; devuelve { blob, nombre }.
export async function descargarReportePdf(qs) {
  const res = await fetch(`/api/vales/reportes/pdf?${qs.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo generar el PDF.');
  }
  const disposicion = res.headers.get('Content-Disposition') || '';
  const nombre = (/filename="([^"]+)"/.exec(disposicion) || [])[1] || 'reporte-vales.pdf';
  return { blob: await res.blob(), nombre };
}

export async function obtenerDisenadoresAsignables() {
  const res = await fetch('/api/vales/disenadores');
  return leerJSON(res);
}

export async function crearVale(formData) {
  const res = await fetch('/api/vales', { method: 'POST', body: formData });
  const data = await leerJSON(res);
  if (!res.ok) throw new Error(data.error || 'No se pudo crear el vale de arte.');
  return data;
}

export function asignarDisenador(valeId, disenadorId) {
  return enviarJSON(`/api/vales/${valeId}/asignar`, { disenadorId });
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

export function solicitarModificacion(valeId, formData) {
  return enviarFormData(`/api/vales/${valeId}/solicitar-modificacion`, formData);
}

export function autorizarCreacion(valeId) {
  return enviarPost(`/api/vales/${valeId}/autorizar-creacion`);
}

export function rechazarCreacion(valeId, motivo) {
  return enviarJSON(`/api/vales/${valeId}/rechazar-creacion`, { motivo });
}

export function reenviarVale(valeId) {
  return enviarPost(`/api/vales/${valeId}/reenviar`);
}

export function marcarValeVisto(valeId) {
  return enviarPost(`/api/vales/${valeId}/visto`);
}

export function darDeBajaVale(valeId) {
  return enviarPost(`/api/vales/${valeId}/dar-de-baja`);
}

export function verificarAdjuntos(valeId) {
  return enviarJSON(`/api/vales/${valeId}/verificar-adjuntos`, {});
}

export function rechazarAdjuntos(valeId) {
  return enviarJSON(`/api/vales/${valeId}/rechazar-adjuntos`, {});
}

export function responderAdjuntos(valeId, tallerId, mensaje) {
  return enviarJSON(`/api/vales/${valeId}/responder-adjuntos`, { tallerId, mensaje });
}

export function corregirVale(valeId, formData) {
  return enviarFormData(`/api/vales/${valeId}/corregir`, formData);
}

export function aprobarModificacion(valeId) {
  return enviarPost(`/api/vales/${valeId}/aprobar-modificacion`);
}

export function rechazarModificacion(valeId, motivo) {
  return enviarJSON(`/api/vales/${valeId}/rechazar-modificacion`, { motivo });
}

export async function obtenerCargaTrabajo() {
  const res = await fetch('/api/vales/carga-trabajo');
  return leerJSON(res);
}

export async function obtenerAsignacionesDisenador(disenadorId) {
  const res = await fetch(`/api/vales/carga-trabajo/${disenadorId}`);
  return leerJSON(res);
}
