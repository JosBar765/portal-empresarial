// Una función por endpoint de /api/admin. Cada una reproduce exactamente la
// semántica de verificación de errores que tenía su call site original en el
// app.js monolítico — algunas lanzan con el mensaje del servidor, otras no
// verifican `res.ok` en absoluto. Esa diferencia se conserva a propósito
// (mismo criterio documentado en public/modules/vales/js/api/valesApi.js).
//
// Dos endpoints (`GET /usuarios` y `GET /roles`) tenían call sites con
// validación DISTINTA entre sí — una pestaña verificaba `res.ok` y lanzaba,
// otras no. Para no uniformizar ese comportamiento, sus funciones devuelven
// `{ res, data }` en vez de decidir ellas mismas: cada call site valida (o
// no) exactamente como hacía antes.

async function enviarConBody(url, method, payload) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

async function enviarSinBody(url, method) {
  const res = await fetch(url, { method });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

// ---- Usuarios ----
export async function listarUsuariosRaw() {
  const res = await fetch('/api/admin/usuarios');
  const data = await res.json();
  return { res, data };
}

export function toggleActivoUsuario(usuarioId, activo) {
  return enviarConBody(`/api/admin/usuarios/${usuarioId}/activo`, 'PATCH', { activo });
}

export function guardarUsuario(usuarioId, payload) {
  return enviarConBody(usuarioId ? `/api/admin/usuarios/${usuarioId}` : '/api/admin/usuarios', usuarioId ? 'PUT' : 'POST', payload);
}

// ---- Roles y permisos ----
export async function listarRolesRaw() {
  const res = await fetch('/api/admin/roles');
  const data = await res.json();
  return { res, data };
}

export function toggleActivoRol(rolId, activo) {
  return enviarConBody(`/api/admin/roles/${rolId}/activo`, 'PATCH', { activo });
}

export function guardarRol(rolId, payload) {
  return enviarConBody(rolId ? `/api/admin/roles/${rolId}` : '/api/admin/roles', rolId ? 'PUT' : 'POST', payload);
}

export async function listarPermisos() {
  const res = await fetch('/api/admin/permisos');
  return res.json();
}

export async function listarPermisosDeRol(rolId) {
  const res = await fetch(`/api/admin/roles/${rolId}/permisos`);
  return res.json();
}

export function actualizarPermisosDeRol(rolId, permisoIds) {
  return enviarConBody(`/api/admin/roles/${rolId}/permisos`, 'PUT', { permisoIds });
}

// ---- Tiendas ----
export async function listarTiendas() {
  const res = await fetch('/api/admin/tiendas');
  return res.json();
}

export async function obtenerOrganizacion() {
  const res = await fetch('/api/admin/organizacion');
  return res.json();
}

export function guardarTienda(tiendaId, payload) {
  return enviarConBody(tiendaId ? `/api/admin/tiendas/${tiendaId}` : '/api/admin/tiendas', tiendaId ? 'PUT' : 'POST', payload);
}

export async function listarPersonalDeTienda(tiendaId) {
  const res = await fetch(`/api/admin/tiendas/${tiendaId}/personal`);
  return res.json();
}

export function agregarPersonalATienda(tiendaId, usuarioId) {
  return enviarConBody(`/api/admin/tiendas/${tiendaId}/personal`, 'POST', { usuarioId: Number(usuarioId) });
}

export function quitarPersonalDeTienda(tiendaId, usuarioId) {
  return enviarSinBody(`/api/admin/tiendas/${tiendaId}/personal/${usuarioId}`, 'DELETE');
}

// ---- Talleres ----
export async function listarTalleres() {
  const res = await fetch('/api/admin/talleres');
  return res.json();
}

export async function listarPersonalDeTaller(tallerId) {
  const res = await fetch(`/api/admin/talleres/${tallerId}/personal`);
  return res.json();
}

export function asignarEncargadoTaller(tallerId, usuarioId) {
  return enviarConBody(`/api/admin/talleres/${tallerId}/encargado`, 'POST', { usuarioId: Number(usuarioId) });
}

export function quitarEncargadoTaller(tallerId) {
  return enviarSinBody(`/api/admin/talleres/${tallerId}/encargado`, 'DELETE');
}

export function agregarTecnicoATaller(tallerId, usuarioId) {
  return enviarConBody(`/api/admin/talleres/${tallerId}/tecnicos`, 'POST', { usuarioId: Number(usuarioId) });
}

export function quitarTecnicoDeTaller(tallerId, usuarioId) {
  return enviarSinBody(`/api/admin/talleres/${tallerId}/tecnicos/${usuarioId}`, 'DELETE');
}

export function actualizarLimiteDiarioTaller(tallerId, limiteDiario) {
  return enviarConBody(`/api/admin/talleres/${tallerId}/limite-diario`, 'PUT', { limiteDiario });
}

// ---- Mantenimiento ----
export async function obtenerMantenimiento() {
  const res = await fetch('/api/admin/mantenimiento');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export function actualizarMantenimiento(payload) {
  return enviarConBody('/api/admin/mantenimiento', 'PUT', payload);
}
