import { state } from '../state.js';
import { $, $$ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { ROL_ADMINISTRADOR } from '../config/roles.js';
import { crearMenuCascada, construirArbolTiendas, construirArbolRoles } from '../components/menuCascada.js';
import { listarUsuariosRaw, listarTiendas, listarRolesRaw, toggleActivoUsuario as apiToggleActivoUsuario } from '../api/adminApi.js';
import { abrirModalUsuario } from '../forms/usuarioForm.js';

// Catálogos livianos para los filtros de tienda/rol — se cargan una sola vez
// (independiente de qué pestaña los pida primero) y se reusan.
export async function asegurarCatalogosFiltro() {
  if (state.catalogoTiendas.length && state.catalogoRoles.length) return;
  const [tiendasData, rolesRaw] = await Promise.all([
    listarTiendas(),
    listarRolesRaw()
  ]);
  state.catalogoTiendas = tiendasData.tiendas;
  state.catalogoRoles = rolesRaw.data.roles;
}

export async function cargarUsuarios() {
  const [{ res, data }] = await Promise.all([listarUsuariosRaw(), asegurarCatalogosFiltro()]);
  if (!res.ok) throw new Error(data.error);
  state.usuariosResumen = data.resumen;
  state.usuarios = data.usuarios;
  renderUsuarios();
}

// Renderiza el cascarón (toolbar + tarjetas + tabla vacía) UNA sola vez;
// el filtro de búsqueda solo repinta el <tbody> (renderFilasUsuarios) para
// no perder el foco del input de búsqueda en cada tecla — reconstruir todo
// el panel_content en cada input, con un <input> nuevo, dejaba al anterior
// desmontado a media escritura y solo se veía el primer carácter tecleado.
export function renderUsuarios() {
  const r = state.usuariosResumen;
  $('#panel-content').innerHTML = `
    <div class="panel-toolbar">
      <h2>Gestionar Usuarios</h2>
      <div class="panel-toolbar-acciones">
        <input type="text" id="buscar-usuarios" placeholder="Buscar por nombre, correo o rol..." value="${escapeHtml(state.busquedaUsuarios)}">
        <div id="filtro-tienda-usuarios-cont"></div>
        <div id="filtro-rol-usuarios-cont"></div>
        <button class="btn btn--primary" id="btn-nuevo-usuario"><ion-icon name="add-outline"></ion-icon> Nuevo Usuario</button>
      </div>
    </div>
    <div class="resumen-grid">
      <div class="resumen-card"><div class="valor">${r.total}</div><div class="etiqueta">Total de Usuarios</div></div>
      <div class="resumen-card"><div class="valor">${r.activos}</div><div class="etiqueta">Activos</div></div>
      <div class="resumen-card"><div class="valor">${r.inactivos}</div><div class="etiqueta">Inactivos</div></div>
      <div class="resumen-card"><div class="valor">${r.rolesEnUso}</div><div class="etiqueta">Roles en uso</div></div>
    </div>
    <div class="tabla-wrapper">
      <table class="data-table sticky-header">
        <thead><tr><th>Nombre</th><th>Correo electrónico</th><th>Rol</th><th>Países asignados</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody id="usuarios-tbody"></tbody>
      </table>
    </div>
  `;
  renderFilasUsuarios();
  $('#filtro-tienda-usuarios-cont').appendChild(crearMenuCascada({
    arbol: [{ tipo: 'hoja', valor: '', etiqueta: 'Todas las tiendas' }, ...construirArbolTiendas(state.catalogoTiendas)],
    valorActual: state.filtroTiendaUsuarios,
    etiquetaVacio: 'Todas las tiendas',
    onSeleccionar: (valor) => { state.filtroTiendaUsuarios = String(valor); renderFilasUsuarios(); }
  }).elemento);
  $('#filtro-rol-usuarios-cont').appendChild(crearMenuCascada({
    arbol: [{ tipo: 'hoja', valor: '', etiqueta: 'Todos los roles' }, ...construirArbolRoles(state.catalogoRoles)],
    valorActual: state.filtroRolUsuarios,
    etiquetaVacio: 'Todos los roles',
    onSeleccionar: (valor) => { state.filtroRolUsuarios = String(valor); renderFilasUsuarios(); }
  }).elemento);
  $('#buscar-usuarios').addEventListener('input', (e) => { state.busquedaUsuarios = e.target.value; renderFilasUsuarios(); });
  $('#btn-nuevo-usuario').addEventListener('click', () => abrirModalUsuario(null));
}

export function renderFilasUsuarios() {
  const filtro = state.busquedaUsuarios.trim().toLowerCase();
  const filas = state.usuarios.filter(u => {
    const coincideBusqueda = !filtro ||
      u.nombre.toLowerCase().includes(filtro) ||
      u.email.toLowerCase().includes(filtro) ||
      (u.rol_nombre || '').toLowerCase().includes(filtro);
    const coincideTienda = !state.filtroTiendaUsuarios || String(u.tienda_id) === state.filtroTiendaUsuarios;
    const coincideRol = !state.filtroRolUsuarios || String(u.rol_id) === state.filtroRolUsuarios;
    return coincideBusqueda && coincideTienda && coincideRol;
  });

  const tbody = $('#usuarios-tbody');
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="tabla-vacia"><div class="buzon-vacio"><ion-icon name="people-outline"></ion-icon><p>No hay usuarios que coincidan con la búsqueda.</p></div></td></tr>`;
  } else {
    tbody.innerHTML = filas.map(u => `
      <tr>
        <td data-label="Nombre">${escapeHtml(u.nombre)}</td>
        <td data-label="Correo">${escapeHtml(u.email)}</td>
        <td data-label="Rol">${escapeHtml(u.rol_nombre)}${u.tienda_nombre ? `<div class="tabla-secundaria">${escapeHtml(u.tienda_nombre)}</div>` : ''}</td>
        <td data-label="Países">${u.paises_asignados ? escapeHtml(u.paises_asignados) : '-'}</td>
        <td data-label="Estado"><span class="badge ${u.activo ? 'badge-activo' : 'badge-inactivo'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td data-label="Acciones" class="acciones-cell" data-usuario-id="${u.id}"></td>
      </tr>
    `).join('');
    filas.forEach(u => {
      // El Administrador aparece en la lista pero sin ninguna acción
      // disponible sobre él.
      if (Number(u.rol_id) === ROL_ADMINISTRADOR) return;
      const celda = tbody.querySelector(`[data-usuario-id="${u.id}"]`);
      const btnEditar = document.createElement('button');
      btnEditar.className = 'btn-icon';
      btnEditar.title = 'Editar';
      btnEditar.innerHTML = '<ion-icon name="create-outline"></ion-icon>';
      btnEditar.addEventListener('click', () => abrirModalUsuario(u));
      celda.appendChild(btnEditar);

      const btnToggle = document.createElement('button');
      btnToggle.className = `btn-icon candado-estado ${u.activo ? 'candado-activo' : 'candado-inactivo'}`;
      btnToggle.title = u.activo ? 'Usuario activo — clic para bloquear' : 'Usuario bloqueado — clic para activar';
      btnToggle.setAttribute('aria-label', btnToggle.title);
      btnToggle.innerHTML = `<ion-icon name="${u.activo ? 'lock-open-outline' : 'lock-closed-outline'}"></ion-icon>`;
      btnToggle.addEventListener('click', () => toggleActivoUsuario(u));
      celda.appendChild(btnToggle);
    });
  }
}

export async function toggleActivoUsuario(u) {
  if (u.activo && u.id === state.user.id) {
    window.toast.error('No permitido', 'No puedes desactivar tu propia cuenta.');
    return;
  }
  if (u.activo && !confirm(`¿Desactivar a ${u.nombre}?`)) return;
  try {
    await apiToggleActivoUsuario(u.id, !u.activo);
    window.toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado', u.nombre);
    cargarUsuarios();
  } catch (error) {
    window.toast.error('No se pudo actualizar', error.message);
  }
}
