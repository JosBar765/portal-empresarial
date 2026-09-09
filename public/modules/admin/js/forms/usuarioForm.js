import { state } from '../state.js';
import { escapeHtml } from '../utils/formato.js';
import { ROL_ASESOR, ROL_SUPERVISOR, ROLES_ENCARGADO_UNICO } from '../config/roles.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { crearMenuCascada, construirArbolRoles } from '../components/menuCascada.js';
import { listarRolesRaw, listarUsuariosRaw, obtenerOrganizacion, guardarUsuario } from '../api/adminApi.js';
import { cargarUsuarios } from '../views/usuarios.js';

// "Gestionar Usuarios" solo crea usuarios y edita su información personal
// — ninguna asignación de tienda o taller vive aquí (eso es "Gestionar
// Tiendas"/"Gestionar Talleres"). El rol se elige al crear y ya no se
// puede cambiar al editar.
export async function abrirModalUsuario(usuario) {
  const [rolesRaw, usuariosRaw, orgData] = await Promise.all([
    listarRolesRaw(),
    listarUsuariosRaw(),
    obtenerOrganizacion()
  ]);
  const roles = rolesRaw.data.roles;
  const todosUsuarios = usuariosRaw.data.usuarios;
  const paises = orgData.paises || [];
  const esEdicion = !!usuario;

  const rolesAsignables = roles.filter(r => r.activo);
  let rolIdActual = esEdicion ? Number(usuario.rol_id) : (rolesAsignables[0] ? rolesAsignables[0].id : null);

  function deshabilitarRol(nodo) {
    if (!ROLES_ENCARGADO_UNICO.includes(Number(nodo.valor))) return null;
    const ocupante = todosUsuarios.find(u => u.activo && Number(u.rol_id) === Number(nodo.valor));
    return ocupante ? { disabled: true, motivo: `Ya asignado a ${ocupante.nombre}` } : null;
  }

  const esPropioAdmin = esEdicion && Number(usuario.id) === Number(state.user.id) && Number(usuario.rol_id) === 1;
  const campoPassword = esPropioAdmin
    ? `<div class="form-field"><label>Contraseña</label><p class="form-nota">No puedes cambiar tu propia contraseña de administrador.</p></div>`
    : `<div class="form-field">
        <label>Contraseña${esEdicion ? ' (dejar vacío para no cambiar)' : ''}</label>
        <input type="password" id="input-password" autocomplete="new-password">
      </div>`;

  const campoRol = esEdicion
    ? `<div class="form-field"><label>Rol</label><p class="form-nota">${escapeHtml(usuario.rol_nombre)} — no se puede cambiar una vez creado el usuario.</p></div>`
    : `<div class="form-field"><label>Rol</label><div id="rol-menu-cont"></div></div>`;

  const bodyHtml = `
    <div class="form-grid">
      <div class="form-field full">
        <label>Nombre completo</label>
        <input type="text" id="input-nombre">
      </div>
      <div class="form-field">
        <label>Correo electrónico</label>
        <input type="email" id="input-email">
      </div>
      <div class="form-field" id="zona-telefono"></div>
      ${campoPassword}
      ${campoRol}
    </div>
  `;

  const { overlay, cerrar } = abrirModal({
    title: esEdicion ? `Editar información — ${usuario.nombre}` : 'Nuevo usuario',
    bodyHtml,
    footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar</button>`
  });

  overlay.querySelector('#input-nombre').value = esEdicion ? usuario.nombre : '';
  overlay.querySelector('#input-email').value = esEdicion ? usuario.email : '';

  // Teléfono con código de país — solo Asesor/Supervisor lo tienen.
  const [paisTelActual, ...restoTel] = ((esEdicion && usuario.telefono) || '').split(' ');
  const numeroTelActual = restoTel.join(' ');
  function renderTelefono() {
    const zona = overlay.querySelector('#zona-telefono');
    if (rolIdActual !== ROL_ASESOR && rolIdActual !== ROL_SUPERVISOR) {
      zona.innerHTML = '';
      return;
    }
    const opciones = paises.map(p => {
      const seleccionado = paisTelActual ? p.codigo_telefono === paisTelActual : p.codigo === 'GT';
      return `<option value="${p.codigo_telefono}" ${seleccionado ? 'selected' : ''}>${p.codigo_telefono} ${p.codigo}</option>`;
    }).join('');
    zona.innerHTML = `
      <label>Teléfono</label>
      <div class="form-field-phone">
        <select id="input-telefono-pais">${opciones}</select>
        <input type="text" id="input-telefono" placeholder="0000-0000">
      </div>
    `;
    zona.querySelector('#input-telefono').value = numeroTelActual;
  }
  renderTelefono();

  if (!esEdicion) {
    overlay.querySelector('#rol-menu-cont').appendChild(crearMenuCascada({
      arbol: construirArbolRoles(rolesAsignables),
      valorActual: rolIdActual,
      etiquetaVacio: 'Selecciona un rol',
      deshabilitar: deshabilitarRol,
      onSeleccionar: (valor) => {
        rolIdActual = Number(valor);
        renderTelefono();
      }
    }).elemento);
  }

  overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
  overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
    const btn = overlay.querySelector('#btn-guardar');
    const payload = {
      nombre: overlay.querySelector('#input-nombre').value.trim(),
      email: overlay.querySelector('#input-email').value.trim(),
      password: overlay.querySelector('#input-password') ? overlay.querySelector('#input-password').value : '',
      rolId: rolIdActual
    };
    if (rolIdActual === ROL_ASESOR || rolIdActual === ROL_SUPERVISOR) {
      const paisTel = overlay.querySelector('#input-telefono-pais').value;
      const numTel = overlay.querySelector('#input-telefono').value.trim();
      payload.telefono = numTel ? `${paisTel} ${numTel}` : '';
    }
    if (!payload.nombre || !payload.email) {
      mostrarErrorModal(overlay, 'Nombre y correo son obligatorios.');
      return;
    }
    if (!esEdicion && !payload.password) {
      mostrarErrorModal(overlay, 'La contraseña es obligatoria para un usuario nuevo.');
      return;
    }
    if (!esEdicion && !payload.rolId) {
      mostrarErrorModal(overlay, 'Selecciona un rol.');
      return;
    }
    btn.disabled = true;
    try {
      await guardarUsuario(esEdicion ? usuario.id : null, payload);
      window.toast.success(esEdicion ? 'Usuario actualizado' : 'Usuario creado', payload.nombre);
      cerrar();
      cargarUsuarios();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
