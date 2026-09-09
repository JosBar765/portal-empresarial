import { escapeHtml } from '../utils/formato.js';
import { ROL_ASESOR, ROL_SUPERVISOR } from '../config/roles.js';
import { abrirModal, mostrarErrorModal } from '../components/modal.js';
import { $$ } from '../utils/dom.js';
import {
  listarPersonalDeTienda, listarUsuariosRaw,
  agregarPersonalATienda, quitarPersonalDeTienda
} from '../api/adminApi.js';
import { cargarTiendas } from '../views/tiendas.js';

// Modal de solo lectura, personal agrupado por rol (en vez de la lista
// plana que ya usaba "Gestionar personal"). Orden de negocio fijo para
// agrupar al personal de una tienda — los 4 roles de encargado de taller se
// colapsan en un solo bucket ("Encargado(s) de taller"), el resto conserva
// su nombre de rol tal cual.
const ORDEN_CATEGORIAS_PERSONAL = ['Gerente', 'Supervisor de Ventas', 'Asesor de Ventas', 'Encargado(s) de taller', 'Asistente', 'Técnicos'];
const ROLES_ENCARGADO_TALLER_NOMBRES = ['Encargado de taller de diseño', 'Encargado de taller de diseño 3d', 'Encargado de taller de protextil', 'Encargado de taller de diseño local'];
function categoriaDePersonal(rolNombre) {
  return ROLES_ENCARGADO_TALLER_NOMBRES.includes(rolNombre) ? 'Encargado(s) de taller' : (rolNombre || 'Sin rol');
}
function ordenarCategorias(categorias) {
  return categorias.sort((a, b) => {
    const ia = ORDEN_CATEGORIAS_PERSONAL.indexOf(a);
    const ib = ORDEN_CATEGORIAS_PERSONAL.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export async function abrirModalVerPersonal(tienda) {
  const personal = await listarPersonalDeTienda(tienda.id);
  const grupos = {};
  personal.forEach(p => {
    const clave = categoriaDePersonal(p.rol_nombre);
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(p);
  });
  const categorias = ordenarCategorias(Object.keys(grupos));

  const bodyHtml = categorias.length
    ? categorias.map(rol => `
        <p class="section-title">${escapeHtml(rol)} (${grupos[rol].length})</p>
        <div class="personal-lista">
          ${grupos[rol].map(p => `
            <div class="personal-item">
              <div class="personal-item-info">
                <span>${escapeHtml(p.nombre)}</span>
                ${p.tipo_vinculo === 'supervisor' ? '<span class="rol">Cobertura de supervisor</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')
    : '<p class="form-hint">Sin personal ligado todavía.</p>';

  const { overlay, cerrar } = abrirModal({
    title: `Personal — ${tienda.nombre}`,
    bodyHtml,
    footerHtml: `<button class="btn btn--primary" id="btn-cerrar-ver-personal">Cerrar</button>`
  });
  overlay.querySelector('#btn-cerrar-ver-personal').addEventListener('click', cerrar);
}

export async function abrirModalPersonal(tienda) {
  const [personal, usuariosRaw] = await Promise.all([
    listarPersonalDeTienda(tienda.id),
    listarUsuariosRaw()
  ]);
  const todosUsuarios = usuariosRaw.data.usuarios;
  const idsActuales = new Set(personal.map(p => p.id));
  // Solo Asesor/Supervisor se asignan a una tienda desde aquí — el resto
  // depende de su taller (Gestionar Talleres). Un Asesor ya asignado a
  // OTRA tienda no debe aparecer (una sola tienda a la vez); un Supervisor
  // sí, porque puede cubrir varias.
  const disponibles = todosUsuarios.filter(u =>
    u.activo && !idsActuales.has(u.id) && (
      (u.rol_id === ROL_ASESOR && u.tienda_id == null) ||
      u.rol_id === ROL_SUPERVISOR
    )
  );

  // Cascada rol -> persona (dos selects dependientes) en vez del combobox
  // agrupado por <optgroup>.
  const gruposDisponibles = {};
  disponibles.forEach(u => {
    const clave = u.rol_nombre || 'Sin rol';
    if (!gruposDisponibles[clave]) gruposDisponibles[clave] = [];
    gruposDisponibles[clave].push(u);
  });
  const rolesDisponibles = Object.keys(gruposDisponibles).sort();
  const opcionesRol = rolesDisponibles.map(rol => `<option value="${escapeHtml(rol)}">${escapeHtml(rol)}</option>`).join('');

  // El personal ya ligado se agrupa con el mismo criterio y orden que "Ver
  // personal", en vez de listarse plano.
  const gruposActuales = {};
  personal.forEach(p => {
    const clave = categoriaDePersonal(p.rol_nombre);
    (gruposActuales[clave] = gruposActuales[clave] || []).push(p);
  });
  const categoriasActuales = ordenarCategorias(Object.keys(gruposActuales));

  const bodyHtml = `
    <p class="section-title">Personal ligado a esta tienda</p>
    <div id="personal-actual">
      ${personal.length ? categoriasActuales.map(cat => `
        <p class="section-title">${escapeHtml(cat)} (${gruposActuales[cat].length})</p>
        <div class="personal-lista">
          ${gruposActuales[cat].map(p => `
            <div class="personal-item" data-usuario-id="${p.id}">
              <div class="personal-item-info">
                <span>${escapeHtml(p.nombre)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('') : '<p class="form-hint">Sin personal ligado todavía.</p>'}
    </div>
    <p class="section-title">Agregar personal</p>
    <div class="form-grid">
      <div class="form-field">
        <label>Tipo personal</label>
        <select id="input-categoria-personal">
          <option value="">Seleccionar categoría...</option>
          ${opcionesRol}
        </select>
      </div>
      <div class="form-field">
        <label>Persona</label>
        <select id="input-agregar-personal" disabled>
          <option value="">Elige una categoría primero...</option>
        </select>
      </div>
    </div>
  `;
  const { overlay, cerrar } = abrirModal({
    title: `Personal — ${tienda.nombre}`,
    bodyHtml,
    footerHtml: `<button class="btn btn--primary" id="btn-agregar">Agregar</button>`
  });

  overlay.querySelector('#input-categoria-personal').addEventListener('change', (e) => {
    const selectPersona = overlay.querySelector('#input-agregar-personal');
    const rol = e.target.value;
    const personas = gruposDisponibles[rol] || [];
    if (!rol) {
      selectPersona.innerHTML = '<option value="">Elige una categoría primero...</option>';
      selectPersona.disabled = true;
      return;
    }
    selectPersona.disabled = false;
    selectPersona.innerHTML = '<option value="">Seleccionar persona...</option>' +
      personas.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)}</option>`).join('');
  });

  $$('.personal-item', overlay).forEach(item => {
    const btnQuitar = document.createElement('button');
    btnQuitar.className = 'btn-icon icon-danger';
    btnQuitar.title = 'Quitar';
    btnQuitar.innerHTML = '<ion-icon name="close-outline"></ion-icon>';
    btnQuitar.addEventListener('click', async () => {
      const usuarioId = item.dataset.usuarioId;
      try {
        await quitarPersonalDeTienda(tienda.id, usuarioId);
        window.toast.success('Personal actualizado', 'Se quitó de la tienda.');
        cerrar();
        cargarTiendas();
      } catch (error) {
        window.toast.error('No se pudo quitar', error.message);
      }
    });
    item.appendChild(btnQuitar);
  });

  overlay.querySelector('#btn-agregar').addEventListener('click', async () => {
    const usuarioId = overlay.querySelector('#input-agregar-personal').value;
    if (!usuarioId) return;
    const btn = overlay.querySelector('#btn-agregar');
    btn.disabled = true;
    try {
      await agregarPersonalATienda(tienda.id, usuarioId);
      window.toast.success('Personal actualizado', 'Se agregó a la tienda.');
      cerrar();
      cargarTiendas();
    } catch (error) {
      mostrarErrorModal(overlay, error.message);
      btn.disabled = false;
    }
  });
}
