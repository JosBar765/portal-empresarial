// public/modules/admin/js/app.js
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // analisis_correcciones_16.md #7: renumeración de roles tras eliminar los
  // roles descontinuados (Supervisor de Ventas pasa de id 4 a id 3).
  const ROL_SUPERVISOR = 3;

  const state = {
    user: null,
    tab: 'usuarios',
    usuarios: [], usuariosResumen: { total: 0, activos: 0, inactivos: 0, rolesEnUso: 0 }, busquedaUsuarios: '',
    // analisis_correcciones_14.md #6/#7: filtros de tienda/rol, compartidos por
    // Gestión de Usuarios y Actividad de Usuarios.
    filtroTiendaUsuarios: '', filtroRolUsuarios: '',
    filtroTiendaActividad: '', filtroRolActividad: '',
    roles: [], rolesResumen: { rolesConfigurados: 0, permisosDisponibles: 0 },
    actividad: [], actividadResumen: { enLinea: 0, inactivos: 0, totalActivos: 0 },
    tiendas: [], tiendasResumen: { activas: 0, inactivas: 0 },
    // Catálogos livianos (id + nombre) para poblar los <select> de filtro,
    // cargados una vez y reusados por ambas pestañas.
    catalogoTiendas: [], catalogoRoles: [],
    mantenimiento: null
  };

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const sessionRes = await fetch('/api/auth.php?action=session_check');
      const sessionData = await sessionRes.json();
      if (!sessionData.autenticado) { window.location.href = '/login/?expired=true'; return; }
      state.user = sessionData.user;
      if (state.user.rolId !== 1) { window.location.href = '/dashboard/'; return; }

      $('#user-display-name').textContent = state.user.nombre;
      $('#user-display-role').textContent = state.user.rolNombre;
      $('#account-dropdown-name').textContent = state.user.nombre;
      $('#account-dropdown-role').textContent = state.user.rolNombre;
      $('#account-avatar').textContent = inicialesAvatar(state.user.nombre);
    } catch (error) {
      window.location.href = '/login/?error=conexion';
      return;
    }

    wireAccountMenu();
    wireSidebar();
    $('#logout-btn').addEventListener('click', async () => {
      try { await fetch('/api/auth.php?action=logout'); } catch (error) { /* redirige de todas formas */ }
      window.location.href = '/login/';
    });

    await cargarTab();
  });

  function inicialesAvatar(nombreCompleto) {
    const partes = (nombreCompleto || '').trim().split(/\s+/);
    const iniciales = partes.slice(0, 2).map(p => p[0]).join('');
    return iniciales.toUpperCase() || '--';
  }

  function escapeHtml(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function haceTiempo(fechaStr) {
    if (!fechaStr) return '-';
    const fecha = new Date(String(fechaStr).replace(' ', 'T'));
    const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000);
    if (minutos < 1) return 'Justo ahora';
    if (minutos < 60) return `Hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return `Hace ${dias} d`;
  }

  // Menú desplegable de cuenta — mismo patrón que public/js/dashboard.js y
  // public/modules/vales/js/app.js.
  function wireAccountMenu() {
    const widget = $('#account-widget');
    const dropdown = $('#account-dropdown');
    const cerrar = () => {
      dropdown.classList.remove('visible');
      widget.setAttribute('aria-expanded', 'false');
    };
    widget.addEventListener('click', (e) => {
      e.stopPropagation();
      const abierto = dropdown.classList.toggle('visible');
      widget.setAttribute('aria-expanded', String(abierto));
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !widget.contains(e.target)) cerrar();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrar();
    });
  }

  // Sidebar: mismo patrón colapsable/cajón móvil que Vales de Arte, aquí con
  // 5 pestañas fijas (no hay reescritura dinámica por rol — solo el
  // Administrador ve este panel).
  const SIDEBAR_ANCHO = '224px';
  const SIDEBAR_ANCHO_COLAPSADO = '68px';
  function actualizarOffsetSidebar(sidebar) {
    const offset = sidebar.classList.contains('colapsado') ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO;
    document.documentElement.style.setProperty('--sidebar-offset', offset);
  }

  function wireSidebar() {
    const sidebar = $('#sidebar-admin');
    const toggleMovil = $('#sidebar-toggle-mobile');

    $$('.sidebar-item', sidebar).forEach(btn => {
      btn.addEventListener('click', () => {
        cerrarSidebarMovil();
        if (btn.dataset.tab === state.tab) return;
        $$('.sidebar-item', sidebar).forEach(b => b.classList.remove('sidebar-item-active'));
        btn.classList.add('sidebar-item-active');
        state.tab = btn.dataset.tab;
        cargarTab();
      });
    });

    const COLAPSO_KEY = 'admin:sidebarColapsado';
    if (localStorage.getItem(COLAPSO_KEY) === '1') sidebar.classList.add('colapsado');
    actualizarOffsetSidebar(sidebar);
    $('#sidebar-collapse-toggle').addEventListener('click', () => {
      const colapsado = sidebar.classList.toggle('colapsado');
      localStorage.setItem(COLAPSO_KEY, colapsado ? '1' : '0');
      actualizarOffsetSidebar(sidebar);
    });

    const backdrop = $('#sidebar-backdrop');
    const iconoToggleMovil = toggleMovil.querySelector('ion-icon');
    toggleMovil.setAttribute('aria-expanded', 'false');
    toggleMovil.addEventListener('click', () => {
      if (sidebar.classList.contains('abierto-movil')) cerrarSidebarMovil(); else abrirSidebarMovil();
    });
    backdrop.addEventListener('click', cerrarSidebarMovil);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarSidebarMovil(); });

    function abrirSidebarMovil() {
      sidebar.classList.add('abierto-movil');
      backdrop.classList.add('visible');
      toggleMovil.setAttribute('aria-expanded', 'true');
      iconoToggleMovil.setAttribute('name', 'close-outline');
      document.body.style.overflow = 'hidden';
    }
    function cerrarSidebarMovil() {
      sidebar.classList.remove('abierto-movil');
      backdrop.classList.remove('visible');
      toggleMovil.setAttribute('aria-expanded', 'false');
      iconoToggleMovil.setAttribute('name', 'menu-outline');
      document.body.style.overflow = '';
    }
  }

  async function cargarTab() {
    const cont = $('#panel-content');
    cont.innerHTML = `<div class="buzon-vacio"><ion-icon name="sync-outline" class="spin-animation"></ion-icon><p>Cargando...</p></div>`;
    try {
      if (state.tab === 'usuarios') await cargarUsuarios();
      else if (state.tab === 'roles') await cargarRoles();
      else if (state.tab === 'actividad') await cargarActividad();
      else if (state.tab === 'tiendas') await cargarTiendas();
      else if (state.tab === 'mantenimiento') await cargarMantenimiento();
    } catch (error) {
      cont.innerHTML = `<div class="buzon-vacio buzon-vacio-error"><ion-icon name="alert-circle-outline"></ion-icon><h3>No se pudo cargar</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  // ---------------------------------------------------------------------
  // Modal genérico — copiado de public/modules/vales/js/app.js (no hay
  // helpers compartidos entre módulos en este proyecto).
  // ---------------------------------------------------------------------
  function abrirModal({ title, bodyHtml, footerHtml, size }) {
    const root = $('#modals-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box ${size === 'lg' ? 'modal-lg' : ''}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;
    root.appendChild(overlay);
    const onKeydown = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKeydown);
    const cerrar = () => {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
    };
    overlay.querySelector('.modal-close').addEventListener('click', cerrar);
    let mousedownEnOverlay = false;
    overlay.addEventListener('mousedown', (e) => { mousedownEnOverlay = (e.target === overlay); });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && mousedownEnOverlay) cerrar();
      mousedownEnOverlay = false;
    });
    return { overlay, cerrar };
  }

  function mostrarErrorModal(overlay, mensaje) {
    let box = overlay.querySelector('.form-error');
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-error';
      overlay.querySelector('.modal-body').prepend(box);
    }
    box.textContent = mensaje;
  }

  // =======================================================================
  // 1. Gestionar Usuarios
  // =======================================================================
  // analisis_correcciones_14.md #6/#7: catálogos livianos para los filtros de
  // tienda/rol — se cargan una sola vez (independiente de qué pestaña los pida
  // primero) y se reusan.
  async function asegurarCatalogosFiltro() {
    if (state.catalogoTiendas.length && state.catalogoRoles.length) return;
    const [tiendasData, rolesData] = await Promise.all([
      fetch('/api/admin/tiendas').then(r => r.json()),
      fetch('/api/admin/roles').then(r => r.json())
    ]);
    state.catalogoTiendas = tiendasData.tiendas;
    state.catalogoRoles = rolesData.roles;
  }

  function opcionesFiltroTienda(seleccionada) {
    return '<option value="">Todas las tiendas</option>' +
      state.catalogoTiendas.map(t => `<option value="${t.id}" ${String(seleccionada) === String(t.id) ? 'selected' : ''}>${escapeHtml(t.nombre)} (${escapeHtml(t.codigo)})</option>`).join('');
  }

  function opcionesFiltroRol(seleccionada) {
    return '<option value="">Todos los roles</option>' +
      state.catalogoRoles.map(r => `<option value="${r.id}" ${String(seleccionada) === String(r.id) ? 'selected' : ''}>${escapeHtml(r.nombre)}</option>`).join('');
  }

  async function cargarUsuarios() {
    const [res] = await Promise.all([fetch('/api/admin/usuarios'), asegurarCatalogosFiltro()]);
    const data = await res.json();
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
  function renderUsuarios() {
    const r = state.usuariosResumen;
    $('#panel-content').innerHTML = `
      <div class="panel-toolbar">
        <h2>Gestionar Usuarios</h2>
        <div class="panel-toolbar-acciones">
          <input type="text" id="buscar-usuarios" placeholder="Buscar por nombre, correo o rol..." value="${escapeHtml(state.busquedaUsuarios)}">
          <select id="filtro-tienda-usuarios">${opcionesFiltroTienda(state.filtroTiendaUsuarios)}</select>
          <select id="filtro-rol-usuarios">${opcionesFiltroRol(state.filtroRolUsuarios)}</select>
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
    $('#buscar-usuarios').addEventListener('input', (e) => { state.busquedaUsuarios = e.target.value; renderFilasUsuarios(); });
    $('#filtro-tienda-usuarios').addEventListener('change', (e) => { state.filtroTiendaUsuarios = e.target.value; renderFilasUsuarios(); });
    $('#filtro-rol-usuarios').addEventListener('change', (e) => { state.filtroRolUsuarios = e.target.value; renderFilasUsuarios(); });
    $('#btn-nuevo-usuario').addEventListener('click', () => abrirModalUsuario(null));
  }

  function renderFilasUsuarios() {
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
        const celda = tbody.querySelector(`[data-usuario-id="${u.id}"]`);
        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn-icon';
        btnEditar.title = 'Editar';
        btnEditar.innerHTML = '<ion-icon name="create-outline"></ion-icon>';
        btnEditar.addEventListener('click', () => abrirModalUsuario(u));
        celda.appendChild(btnEditar);

        const btnToggle = document.createElement('button');
        btnToggle.className = `btn-icon ${u.activo ? 'icon-danger' : ''}`;
        btnToggle.title = u.activo ? 'Desactivar' : 'Activar';
        btnToggle.innerHTML = `<ion-icon name="${u.activo ? 'lock-closed-outline' : 'lock-open-outline'}"></ion-icon>`;
        btnToggle.addEventListener('click', () => toggleActivoUsuario(u));
        celda.appendChild(btnToggle);
      });
    }
  }

  async function toggleActivoUsuario(u) {
    if (u.activo && u.id === state.user.id) {
      window.toast.error('No permitido', 'No puedes desactivar tu propia cuenta.');
      return;
    }
    if (u.activo && !confirm(`¿Desactivar a ${u.nombre}?`)) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}/activo`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !u.activo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado', u.nombre);
      cargarUsuarios();
    } catch (error) {
      window.toast.error('No se pudo actualizar', error.message);
    }
  }

  async function abrirModalUsuario(usuario) {
    const [rolesData, tiendasData] = await Promise.all([
      fetch('/api/admin/roles').then(r => r.json()),
      fetch('/api/admin/tiendas').then(r => r.json())
    ]);
    const roles = rolesData.roles;
    const tiendas = tiendasData.tiendas.filter(t => t.activo);
    const esEdicion = !!usuario;

    let tiendasSupervisadas = [];
    let coberturaHeredada = [];
    if (esEdicion && Number(usuario.rol_id) === ROL_SUPERVISOR) {
      [tiendasSupervisadas, coberturaHeredada] = await Promise.all([
        fetch(`/api/admin/usuarios/${usuario.id}/tiendas-supervisadas`).then(r => r.json()),
        fetch(`/api/admin/usuarios/${usuario.id}/cobertura-heredada`).then(r => r.json())
      ]);
    }

    // analisis_correcciones_14.md #5: solo roles activos son asignables — salvo
    // el rol actual del usuario en edición, para no corromper su valor al
    // guardar sin tocarlo.
    const rolesAsignables = roles.filter(r => r.activo || (esEdicion && Number(usuario.rol_id) === r.id));
    const opcionesRol = rolesAsignables.map(r => `<option value="${r.id}" ${esEdicion && Number(usuario.rol_id) === r.id ? 'selected' : ''}>${escapeHtml(r.nombre)}</option>`).join('');

    // analisis_correcciones_14.md #2: un Administrador no puede cambiar su
    // propia contraseña desde el panel — el campo ni siquiera se renderiza.
    const esPropioAdmin = esEdicion && Number(usuario.id) === Number(state.user.id) && Number(usuario.rol_id) === 1;
    const campoPassword = esPropioAdmin
      ? `<div class="form-field"><label>Contraseña</label><p class="form-nota">No puedes cambiar tu propia contraseña de administrador.</p></div>`
      : `<div class="form-field">
          <label>Contraseña${esEdicion ? ' (dejar vacío para no cambiar)' : ''}</label>
          <input type="password" id="input-password" autocomplete="new-password">
        </div>`;

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
        <div class="form-field">
          <label>Teléfono</label>
          <input type="text" id="input-telefono">
        </div>
        ${campoPassword}
        <div class="form-field">
          <label>Rol</label>
          <select id="input-rol">${opcionesRol}</select>
        </div>
        <div class="form-field full" id="zona-asignacion"></div>
      </div>
    `;

    const { overlay, cerrar } = abrirModal({
      title: esEdicion ? `Editar usuario — ${usuario.nombre}` : 'Nuevo usuario',
      bodyHtml,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar</button>`
    });

    overlay.querySelector('#input-nombre').value = esEdicion ? usuario.nombre : '';
    overlay.querySelector('#input-email').value = esEdicion ? usuario.email : '';
    overlay.querySelector('#input-telefono').value = (esEdicion && usuario.telefono) ? usuario.telefono : '';

    // analisis_correcciones_15.md #10/#11: agrupa las tiendas por país una
    // sola vez — ambas ramas de renderZonaAsignacion arman un cascada país→tienda.
    const paisesConTienda = [...new Set(tiendas.map(t => t.pais_nombre || 'Sin país'))].sort();
    // País actualmente elegido en el selector de "Tiendas supervisadas" —
    // vive fuera de renderZonaAsignacion para sobrevivir sus propios re-renders
    // (cambiar de país no debe perder las tiendas ya marcadas de otro país).
    let paisSupervisorActual = null;

    // Una tienda queda cubierta por herencia si su departamento/subdivisión
    // coincide con alguna fila de coberturaHeredada (subdivision_id null =
    // cubre TODAS las subdivisiones de ese departamento).
    function esHeredada(tienda) {
      return coberturaHeredada.some(c =>
        c.departamento_id === tienda.departamento_id &&
        (c.subdivision_id === null || c.subdivision_id === tienda.subdivision_id)
      );
    }

    // Vuelca en `tiendasSupervisadas` lo que esté marcado/desmarcado AHORA
    // MISMO en el país visible (las heredadas no se tocan, viven aparte) —
    // hace falta antes de cambiar de país (para no perder la selección) y
    // antes de guardar (el país visible al momento de guardar nunca se
    // había sincronizado todavía).
    function sincronizarTiendasSupervisadasVisibles() {
      $$('.chk-tienda-supervisada', overlay).forEach(chk => {
        if (chk.disabled) return;
        const id = Number(chk.value);
        tiendasSupervisadas = chk.checked
          ? [...new Set([...tiendasSupervisadas, id])]
          : tiendasSupervisadas.filter(x => x !== id);
      });
    }

    function renderZonaAsignacion() {
      const rolId = Number(overlay.querySelector('#input-rol').value);
      const zona = overlay.querySelector('#zona-asignacion');
      if (rolId === ROL_SUPERVISOR) {
        if (!paisSupervisorActual) {
          // Al abrir por primera vez, arranca en el país de la primera tienda
          // ya supervisada (si la hay) para que el admin la vea de una vez.
          const tiendaYaMarcada = tiendas.find(t => tiendasSupervisadas.includes(t.id));
          paisSupervisorActual = (tiendaYaMarcada ? tiendaYaMarcada.pais_nombre : null) || paisesConTienda[0] || '';
        }
        const opcionesPais = paisesConTienda.map(p => `<option value="${escapeHtml(p)}" ${p === paisSupervisorActual ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
        zona.innerHTML = `
          <label>Tiendas supervisadas</label>
          <select id="input-pais-supervisor">${opcionesPais}</select>
          <div class="personal-lista" id="lista-tiendas-supervisadas"></div>
          ${coberturaHeredada.length ? `<p class="form-hint">Las tiendas marcadas y bloqueadas ya vienen cubiertas por asignación heredada (departamento/subdivisión: ${coberturaHeredada.map(c => escapeHtml(c.subdivision_nombre || c.departamento_nombre)).join(', ')}) — no se pueden desmarcar aquí.</p>` : ''}
        `;
        function renderListaTiendasDelPais() {
          const tiendasDelPais = tiendas.filter(t => (t.pais_nombre || 'Sin país') === paisSupervisorActual);
          overlay.querySelector('#lista-tiendas-supervisadas').innerHTML = tiendasDelPais.map(t => {
            const heredada = esHeredada(t);
            const marcada = heredada || tiendasSupervisadas.includes(t.id);
            return `<label class="form-checkbox"><input type="checkbox" class="chk-tienda-supervisada" value="${t.id}" ${marcada ? 'checked' : ''} ${heredada ? 'disabled' : ''}> ${escapeHtml(t.nombre)} (${escapeHtml(t.codigo)})${heredada ? ' — heredada' : ''}</label>`;
          }).join('') || '<p class="form-hint">No hay tiendas en este país.</p>';
        }
        renderListaTiendasDelPais();
        overlay.querySelector('#input-pais-supervisor').addEventListener('change', (e) => {
          sincronizarTiendasSupervisadasVisibles();
          paisSupervisorActual = e.target.value;
          renderListaTiendasDelPais();
        });
      } else {
        // analisis_correcciones_15.md #11: cascada país -> tienda (dos selects
        // dependientes, mismo patrón que departamento->subdivisión en abrirModalTienda).
        const tiendaActual = esEdicion && usuario.tienda_id ? tiendas.find(t => t.id === usuario.tienda_id) : null;
        const paisActual = tiendaActual ? (tiendaActual.pais_nombre || 'Sin país') : (paisesConTienda[0] || '');
        const opcionesPais = paisesConTienda.map(p => `<option value="${escapeHtml(p)}" ${p === paisActual ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
        zona.innerHTML = `
          <label>País</label>
          <select id="input-pais-tienda">${opcionesPais}</select>
          <label>Tienda</label>
          <select id="input-tienda"></select>
        `;
        function actualizarTiendasDelPais() {
          const pais = overlay.querySelector('#input-pais-tienda').value;
          const disponibles = tiendas.filter(t => (t.pais_nombre || 'Sin país') === pais);
          overlay.querySelector('#input-tienda').innerHTML = '<option value="">Sin tienda asignada</option>' +
            disponibles.map(t => `<option value="${t.id}" ${esEdicion && usuario.tienda_id === t.id ? 'selected' : ''}>${escapeHtml(t.nombre)} (${escapeHtml(t.codigo)})</option>`).join('');
        }
        actualizarTiendasDelPais();
        overlay.querySelector('#input-pais-tienda').addEventListener('change', actualizarTiendasDelPais);
      }
    }
    renderZonaAsignacion();
    overlay.querySelector('#input-rol').addEventListener('change', renderZonaAsignacion);

    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-guardar');
      const rolId = Number(overlay.querySelector('#input-rol').value);
      const payload = {
        nombre: overlay.querySelector('#input-nombre').value.trim(),
        email: overlay.querySelector('#input-email').value.trim(),
        telefono: overlay.querySelector('#input-telefono').value.trim(),
        password: overlay.querySelector('#input-password') ? overlay.querySelector('#input-password').value : '',
        rolId
      };
      if (rolId === ROL_SUPERVISOR) {
        sincronizarTiendasSupervisadasVisibles();
        payload.tiendasSupervisadas = tiendasSupervisadas;
      } else {
        const valorTienda = overlay.querySelector('#input-tienda').value;
        payload.tiendaId = valorTienda ? Number(valorTienda) : null;
      }
      if (!payload.nombre || !payload.email) {
        mostrarErrorModal(overlay, 'Nombre y correo son obligatorios.');
        return;
      }
      if (!esEdicion && !payload.password) {
        mostrarErrorModal(overlay, 'La contraseña es obligatoria para un usuario nuevo.');
        return;
      }
      btn.disabled = true;
      try {
        const url = esEdicion ? `/api/admin/usuarios/${usuario.id}` : '/api/admin/usuarios';
        const res = await fetch(url, { method: esEdicion ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success(esEdicion ? 'Usuario actualizado' : 'Usuario creado', payload.nombre);
        cerrar();
        cargarUsuarios();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // =======================================================================
  // 2. Roles y Permisos
  // =======================================================================
  async function cargarRoles() {
    const res = await fetch('/api/admin/roles');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.rolesResumen = data.resumen;
    state.roles = data.roles;
    renderRoles();
  }

  function renderRoles() {
    const r = state.rolesResumen;
    $('#panel-content').innerHTML = `
      <div class="panel-toolbar">
        <h2>Roles y Permisos</h2>
        <div class="panel-toolbar-acciones">
          <button class="btn btn--primary" id="btn-nuevo-rol"><ion-icon name="add-outline"></ion-icon> Nuevo Rol</button>
        </div>
      </div>
      <div class="resumen-grid">
        <div class="resumen-card"><div class="valor">${r.rolesConfigurados}</div><div class="etiqueta">Roles Configurados</div></div>
        <div class="resumen-card"><div class="valor">${r.permisosDisponibles}</div><div class="etiqueta">Permisos Disponibles</div></div>
      </div>
      <div class="roles-grid" id="roles-grid"></div>
    `;

    const grid = $('#roles-grid');
    grid.innerHTML = state.roles.map(rol => `
      <div class="rol-card" data-rol-id="${rol.id}">
        <div class="rol-card-titulo">${escapeHtml(rol.nombre)}${rol.base ? '<span class="badge badge-base">Base</span>' : ''} <span class="badge ${rol.activo ? 'badge-activo' : 'badge-inactivo'}">${rol.activo ? 'Activo' : 'Inactivo'}</span></div>
        <div class="rol-card-descripcion">${escapeHtml(rol.descripcion || '')}</div>
        <div class="rol-card-meta"><span>${rol.usuarios_count} usuario(s)</span><span>${rol.permisos_count} permiso(s)</span></div>
        <div class="rol-card-acciones"></div>
      </div>
    `).join('');

    state.roles.forEach(rol => {
      const acciones = grid.querySelector(`[data-rol-id="${rol.id}"] .rol-card-acciones`);
      const btnPermisos = document.createElement('button');
      btnPermisos.className = 'btn btn--ghost btn--sm';
      btnPermisos.textContent = 'Permisos';
      btnPermisos.addEventListener('click', () => abrirModalPermisos(rol));
      acciones.appendChild(btnPermisos);

      if (!rol.base) {
        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn-icon';
        btnEditar.title = 'Editar';
        btnEditar.innerHTML = '<ion-icon name="create-outline"></ion-icon>';
        btnEditar.addEventListener('click', () => abrirModalRol(rol));
        acciones.appendChild(btnEditar);

        const btnToggle = document.createElement('button');
        btnToggle.className = `btn-icon ${rol.activo ? 'icon-danger' : ''}`;
        btnToggle.title = rol.activo ? 'Desactivar' : 'Activar';
        btnToggle.innerHTML = `<ion-icon name="${rol.activo ? 'lock-closed-outline' : 'lock-open-outline'}"></ion-icon>`;
        btnToggle.addEventListener('click', () => toggleActivoRol(rol));
        acciones.appendChild(btnToggle);
      }
    });

    $('#btn-nuevo-rol').addEventListener('click', () => abrirModalRol(null));
  }

  async function toggleActivoRol(rol) {
    if (rol.activo && !confirm(`¿Desactivar el rol "${rol.nombre}"?`)) return;
    try {
      const res = await fetch(`/api/admin/roles/${rol.id}/activo`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !rol.activo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.toast.success(rol.activo ? 'Rol desactivado' : 'Rol activado', rol.nombre);
      cargarRoles();
    } catch (error) {
      window.toast.error('No se pudo actualizar el rol', error.message);
    }
  }

  function abrirModalRol(rol) {
    const esEdicion = !!rol;
    const bodyHtml = `
      <div class="form-grid">
        <div class="form-field full">
          <label>Nombre del rol</label>
          <input type="text" id="input-nombre-rol">
        </div>
        <div class="form-field full">
          <label>Descripción</label>
          <textarea id="input-descripcion-rol"></textarea>
        </div>
      </div>
    `;
    const { overlay, cerrar } = abrirModal({
      title: esEdicion ? `Editar rol — ${rol.nombre}` : 'Nuevo rol',
      bodyHtml,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar</button>`
    });
    overlay.querySelector('#input-nombre-rol').value = esEdicion ? rol.nombre : '';
    overlay.querySelector('#input-descripcion-rol').value = esEdicion ? (rol.descripcion || '') : '';

    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-guardar');
      const payload = {
        nombre: overlay.querySelector('#input-nombre-rol').value.trim(),
        descripcion: overlay.querySelector('#input-descripcion-rol').value.trim()
      };
      if (!payload.nombre) {
        mostrarErrorModal(overlay, 'El nombre del rol es obligatorio.');
        return;
      }
      btn.disabled = true;
      try {
        const url = esEdicion ? `/api/admin/roles/${rol.id}` : '/api/admin/roles';
        const res = await fetch(url, { method: esEdicion ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success(esEdicion ? 'Rol actualizado' : 'Rol creado', payload.nombre);
        cerrar();
        cargarRoles();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  async function abrirModalPermisos(rol) {
    const [grupos, permisoIdsActuales] = await Promise.all([
      fetch('/api/admin/permisos').then(r => r.json()),
      fetch(`/api/admin/roles/${rol.id}/permisos`).then(r => r.json())
    ]);

    const bodyHtml = Object.keys(grupos).sort().map(modulo => `
      <div class="permisos-grupo" data-modulo="${escapeHtml(modulo)}">
        <div class="permisos-grupo-header">
          <h4>${escapeHtml(modulo)}</h4>
          <button type="button" class="btn btn--ghost btn--sm btn-toggle-grupo">Marcar/Desmarcar todos</button>
        </div>
        <div class="permisos-lista">
          ${grupos[modulo].map(p => `
            <label class="permiso-item">
              <input type="checkbox" class="chk-permiso" value="${p.id}" ${permisoIdsActuales.includes(p.id) ? 'checked' : ''}>
              ${escapeHtml(p.nombre)}
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');

    const { overlay, cerrar } = abrirModal({
      title: `Permisos — ${rol.nombre}`,
      bodyHtml,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar</button>`,
      size: 'lg'
    });

    $$('.btn-toggle-grupo', overlay).forEach(btn => {
      btn.addEventListener('click', () => {
        const lista = btn.closest('.permisos-grupo').querySelectorAll('.chk-permiso');
        const algunoSinMarcar = Array.from(lista).some(c => !c.checked);
        lista.forEach(c => { c.checked = algunoSinMarcar; });
      });
    });

    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-guardar');
      const permisoIds = $$('.chk-permiso', overlay).filter(c => c.checked).map(c => Number(c.value));
      btn.disabled = true;
      try {
        const res = await fetch(`/api/admin/roles/${rol.id}/permisos`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permisoIds })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Permisos actualizados', rol.nombre);
        cerrar();
        cargarRoles();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // =======================================================================
  // 3. Actividad de Usuarios
  // =======================================================================
  const ACTIVIDAD_ESTADO_LABEL = { EN_LINEA: 'En línea', INACTIVO: 'Inactivo', SIN_DATOS: 'Sin datos' };
  const ACTIVIDAD_ESTADO_CLASE = { EN_LINEA: 'badge-en-linea', INACTIVO: 'badge-presencia-inactivo', SIN_DATOS: 'badge-sin-datos' };

  async function cargarActividad() {
    const [res] = await Promise.all([fetch('/api/admin/actividad'), asegurarCatalogosFiltro()]);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.actividadResumen = data.resumen;
    state.actividad = data.actividad;
    renderActividad();
  }

  function renderActividad() {
    const r = state.actividadResumen;
    $('#panel-content').innerHTML = `
      <div class="panel-toolbar">
        <h2>Actividad de Usuarios</h2>
        <div class="panel-toolbar-acciones">
          <select id="filtro-tienda-actividad">${opcionesFiltroTienda(state.filtroTiendaActividad)}</select>
          <select id="filtro-rol-actividad">${opcionesFiltroRol(state.filtroRolActividad)}</select>
        </div>
      </div>
      <div class="resumen-grid">
        <div class="resumen-card"><div class="valor">${r.enLinea}</div><div class="etiqueta">En línea ahora</div></div>
        <div class="resumen-card"><div class="valor">${r.inactivos}</div><div class="etiqueta">Inactivos</div></div>
        <div class="resumen-card"><div class="valor">${r.totalActivos}</div><div class="etiqueta">Total de usuarios activos</div></div>
      </div>
      <div class="tabla-wrapper">
        <table class="data-table sticky-header">
          <thead><tr><th>Nombre</th><th>Rol</th><th>Ciudad</th><th>Estado</th><th>Conectado desde</th><th>Última actividad</th></tr></thead>
          <tbody id="actividad-tbody"></tbody>
        </table>
      </div>
    `;
    $('#filtro-tienda-actividad').addEventListener('change', (e) => { state.filtroTiendaActividad = e.target.value; renderActividad(); });
    $('#filtro-rol-actividad').addEventListener('change', (e) => { state.filtroRolActividad = e.target.value; renderActividad(); });

    const filas = state.actividad.filter(a => {
      const coincideTienda = !state.filtroTiendaActividad || String(a.tienda_id) === state.filtroTiendaActividad;
      const coincideRol = !state.filtroRolActividad || String(a.rol_id) === state.filtroRolActividad;
      return coincideTienda && coincideRol;
    });

    const tbody = $('#actividad-tbody');
    if (!filas.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="tabla-vacia"><div class="buzon-vacio"><ion-icon name="pulse-outline"></ion-icon><p>No hay usuarios que coincidan con el filtro.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = filas.map(a => `
      <tr>
        <td data-label="Nombre">${escapeHtml(a.nombre)}</td>
        <td data-label="Rol">${escapeHtml(a.rol_nombre)}</td>
        <td data-label="Ciudad">${a.ultima_ciudad ? escapeHtml(a.ultima_ciudad) : '-'}</td>
        <td data-label="Estado"><span class="badge ${ACTIVIDAD_ESTADO_CLASE[a.estado]}">${ACTIVIDAD_ESTADO_LABEL[a.estado]}</span></td>
        <td data-label="Conectado desde">${haceTiempo(a.sesion_iniciada_en)}</td>
        <td data-label="Última actividad">${haceTiempo(a.ultima_actividad_en)}</td>
      </tr>
    `).join('');
  }

  // =======================================================================
  // 4. Gestionar Tiendas
  // =======================================================================
  async function cargarTiendas() {
    const [tiendasRes, orgRes] = await Promise.all([
      fetch('/api/admin/tiendas').then(r => r.json()),
      fetch('/api/admin/organizacion').then(r => r.json())
    ]);
    state.tiendasResumen = tiendasRes.resumen;
    state.tiendas = tiendasRes.tiendas;
    state.organizacion = orgRes;
    renderTiendas();
  }

  function renderTiendas() {
    const r = state.tiendasResumen;
    $('#panel-content').innerHTML = `
      <div class="panel-toolbar">
        <h2>Gestionar Tiendas</h2>
        <div class="panel-toolbar-acciones">
          <button class="btn btn--ghost" id="btn-ordenar-tiendas"><ion-icon name="swap-vertical-outline"></ion-icon> Ordenar</button>
          <button class="btn btn--primary" id="btn-nueva-tienda"><ion-icon name="add-outline"></ion-icon> Nueva Tienda</button>
        </div>
      </div>
      <div class="resumen-grid">
        <div class="resumen-card"><div class="valor">${r.activas}</div><div class="etiqueta">Tiendas Activas</div></div>
        <div class="resumen-card"><div class="valor">${r.inactivas}</div><div class="etiqueta">Tiendas Inactivas</div></div>
      </div>
      <div class="tabla-wrapper">
        <table class="data-table sticky-header">
          <thead><tr><th>Orden</th><th>Tienda</th><th>País</th><th>Departamento/Subdivisión</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="tiendas-tbody"></tbody>
        </table>
      </div>
    `;

    const tbody = $('#tiendas-tbody');
    tbody.innerHTML = state.tiendas.map(t => `
      <tr>
        <td data-label="Orden">${t.orden}</td>
        <td data-label="Tienda">${escapeHtml(t.nombre)}<div class="tabla-secundaria">${escapeHtml(t.codigo)}</div></td>
        <td data-label="País">${t.pais_nombre ? escapeHtml(t.pais_nombre) : '-'}</td>
        <td data-label="Departamento/Subdivisión">${escapeHtml(t.departamento_nombre)}${t.subdivision_nombre ? '<div class="tabla-secundaria">' + escapeHtml(t.subdivision_nombre) + '</div>' : ''}</td>
        <td data-label="Estado"><span class="badge ${t.activo ? 'badge-activo' : 'badge-inactivo'}">${t.activo ? 'Activa' : 'Inactiva'}</span></td>
        <td data-label="Acciones" class="acciones-cell" data-tienda-id="${t.id}"></td>
      </tr>
    `).join('');

    state.tiendas.forEach(t => {
      const celda = tbody.querySelector(`[data-tienda-id="${t.id}"]`);
      // analisis_correcciones_14.md #3: acción de solo lectura, separada de
      // "Gestionar personal", para ver el personal agrupado por categoría sin
      // tener que listar todo de corrido.
      const btnVer = document.createElement('button');
      btnVer.className = 'btn-icon';
      btnVer.title = 'Ver personal';
      btnVer.innerHTML = '<ion-icon name="eye-outline"></ion-icon>';
      btnVer.addEventListener('click', () => abrirModalVerPersonal(t));
      celda.appendChild(btnVer);

      const btnPersonal = document.createElement('button');
      btnPersonal.className = 'btn-icon';
      btnPersonal.title = 'Gestionar personal';
      btnPersonal.innerHTML = '<ion-icon name="people-outline"></ion-icon>';
      btnPersonal.addEventListener('click', () => abrirModalPersonal(t));
      celda.appendChild(btnPersonal);

      const btnEditar = document.createElement('button');
      btnEditar.className = 'btn-icon';
      btnEditar.title = 'Editar';
      btnEditar.innerHTML = '<ion-icon name="create-outline"></ion-icon>';
      btnEditar.addEventListener('click', () => abrirModalTienda(t));
      celda.appendChild(btnEditar);
    });

    $('#btn-nueva-tienda').addEventListener('click', () => abrirModalTienda(null));
    $('#btn-ordenar-tiendas').addEventListener('click', () => abrirModalOrdenar());
  }

  function opcionesSubdivisiones(departamentoId, seleccionada) {
    const subs = state.organizacion.subdivisiones.filter(s => s.departamento_id === Number(departamentoId));
    return [`<option value="">Sin subdivisión</option>`]
      .concat(subs.map(s => `<option value="${s.id}" ${seleccionada === s.id ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`))
      .join('');
  }

  const PAISES_TIENDA = [
    { id: 1, nombre: 'Guatemala' }, { id: 2, nombre: 'El Salvador' }, { id: 3, nombre: 'Honduras' },
    { id: 4, nombre: 'Nicaragua' }, { id: 5, nombre: 'Costa Rica' }, { id: 6, nombre: 'Belice' }
  ];

  function abrirModalTienda(tienda) {
    const esEdicion = !!tienda;
    const departamentos = state.organizacion.departamentos;
    const bodyHtml = `
      <div class="form-grid">
        <div class="form-field">
          <label>Código</label>
          <input type="text" id="input-codigo" maxlength="10">
        </div>
        <div class="form-field">
          <label>Nombre</label>
          <input type="text" id="input-nombre-tienda">
        </div>
        <div class="form-field">
          <label>País</label>
          <select id="input-pais">
            <option value="">Sin país</option>
            ${PAISES_TIENDA.map(p => `<option value="${p.id}" ${esEdicion && tienda.pais_id === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Departamento</label>
          <select id="input-departamento">
            ${departamentos.map(d => `<option value="${d.id}" ${esEdicion ? (tienda.departamento_id === d.id ? 'selected' : '') : ''}>${escapeHtml(d.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Subdivisión</label>
          <select id="input-subdivision"></select>
        </div>
        ${esEdicion ? `<div class="form-field"><label class="form-checkbox" style="margin-top:8px;"><input type="checkbox" id="input-activo-tienda" ${tienda.activo ? 'checked' : ''}> Tienda activa</label></div>` : ''}
      </div>
    `;
    const { overlay, cerrar } = abrirModal({
      title: esEdicion ? `Editar tienda — ${tienda.nombre}` : 'Nueva tienda',
      bodyHtml,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar</button>`
    });
    overlay.querySelector('#input-codigo').value = esEdicion ? tienda.codigo : '';
    overlay.querySelector('#input-nombre-tienda').value = esEdicion ? tienda.nombre : '';

    function actualizarSubdivisiones() {
      const departamentoId = overlay.querySelector('#input-departamento').value;
      overlay.querySelector('#input-subdivision').innerHTML = opcionesSubdivisiones(departamentoId, esEdicion ? tienda.subdivision_id : null);
    }
    actualizarSubdivisiones();
    overlay.querySelector('#input-departamento').addEventListener('change', actualizarSubdivisiones);

    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-guardar');
      const subdivisionValor = overlay.querySelector('#input-subdivision').value;
      const paisValor = overlay.querySelector('#input-pais').value;
      const payload = {
        codigo: overlay.querySelector('#input-codigo').value.trim().toUpperCase(),
        nombre: overlay.querySelector('#input-nombre-tienda').value.trim(),
        paisId: paisValor ? Number(paisValor) : null,
        departamentoId: Number(overlay.querySelector('#input-departamento').value),
        subdivisionId: subdivisionValor ? Number(subdivisionValor) : null
      };
      if (esEdicion) payload.activo = overlay.querySelector('#input-activo-tienda').checked;
      if (!payload.codigo || !payload.nombre) {
        mostrarErrorModal(overlay, 'Código y nombre son obligatorios.');
        return;
      }
      btn.disabled = true;
      try {
        const url = esEdicion ? `/api/admin/tiendas/${tienda.id}` : '/api/admin/tiendas';
        const res = await fetch(url, { method: esEdicion ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success(esEdicion ? 'Tienda actualizada' : 'Tienda creada', payload.nombre);
        cerrar();
        cargarTiendas();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // analisis_correcciones_14.md #3: modal de solo lectura, personal agrupado
  // por rol (en vez de la lista plana que ya usaba "Gestionar personal").
  async function abrirModalVerPersonal(tienda) {
    const personal = await fetch(`/api/admin/tiendas/${tienda.id}/personal`).then(r => r.json());
    const grupos = {};
    personal.forEach(p => {
      const clave = p.rol_nombre || 'Sin rol';
      if (!grupos[clave]) grupos[clave] = [];
      grupos[clave].push(p);
    });
    const categorias = Object.keys(grupos).sort();

    const bodyHtml = categorias.length
      ? categorias.map(rol => `
          <p class="section-title">${escapeHtml(rol)} (${grupos[rol].length})</p>
          <div class="personal-lista">
            ${grupos[rol].map(p => `
              <div class="personal-item">
                <div class="personal-item-info"><span>${escapeHtml(p.nombre)}</span>${p.tipo_vinculo === 'supervisor' ? '<span class="rol">Cobertura de supervisor</span>' : ''}</div>
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

  async function abrirModalPersonal(tienda) {
    const [personal, todosUsuarios] = await Promise.all([
      fetch(`/api/admin/tiendas/${tienda.id}/personal`).then(r => r.json()),
      fetch('/api/admin/usuarios').then(r => r.json()).then(d => d.usuarios)
    ]);
    const idsActuales = new Set(personal.map(p => p.id));
    const disponibles = todosUsuarios.filter(u => u.activo && !idsActuales.has(u.id));

    // analisis_correcciones_15.md #12: cascada rol -> persona (dos selects
    // dependientes) en vez del combobox agrupado por <optgroup> de la
    // corrección anterior.
    const gruposDisponibles = {};
    disponibles.forEach(u => {
      const clave = u.rol_nombre || 'Sin rol';
      if (!gruposDisponibles[clave]) gruposDisponibles[clave] = [];
      gruposDisponibles[clave].push(u);
    });
    const rolesDisponibles = Object.keys(gruposDisponibles).sort();
    const opcionesRol = rolesDisponibles.map(rol => `<option value="${escapeHtml(rol)}">${escapeHtml(rol)}</option>`).join('');

    const bodyHtml = `
      <p class="section-title">Personal ligado a esta tienda</p>
      <div class="personal-lista" id="personal-actual">
        ${personal.length ? personal.map(p => `
          <div class="personal-item" data-usuario-id="${p.id}">
            <div class="personal-item-info"><span>${escapeHtml(p.nombre)}</span><span class="rol">${escapeHtml(p.rol_nombre)}${p.tipo_vinculo === 'supervisor' ? ' · cobertura de supervisor' : ''}</span></div>
          </div>
        `).join('') : '<p class="form-hint">Sin personal ligado todavía.</p>'}
      </div>
      <p class="section-title">Agregar personal</p>
      <div class="form-grid">
        <div class="form-field">
          <label>Categoría</label>
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
          const res = await fetch(`/api/admin/tiendas/${tienda.id}/personal/${usuarioId}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
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
        const res = await fetch(`/api/admin/tiendas/${tienda.id}/personal`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuarioId: Number(usuarioId) })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Personal actualizado', 'Se agregó a la tienda.');
        cerrar();
        cargarTiendas();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  function abrirModalOrdenar() {
    const ordenLocal = state.tiendas.slice().sort((a, b) => a.orden - b.orden);

    function render(overlay) {
      const lista = overlay.querySelector('#orden-lista');
      lista.innerHTML = ordenLocal.map((t, i) => `
        <div class="orden-item" data-tienda-id="${t.id}">
          <span class="nombre">${escapeHtml(t.nombre)} (${escapeHtml(t.codigo)})</span>
          <div class="orden-item-flechas">
            <button type="button" class="btn-icon btn-subir" ${i === 0 ? 'disabled' : ''}><ion-icon name="chevron-up-outline"></ion-icon></button>
            <button type="button" class="btn-icon btn-bajar" ${i === ordenLocal.length - 1 ? 'disabled' : ''}><ion-icon name="chevron-down-outline"></ion-icon></button>
          </div>
        </div>
      `).join('');
      $$('.btn-subir', lista).forEach((btn, i) => btn.addEventListener('click', () => { [ordenLocal[i - 1], ordenLocal[i]] = [ordenLocal[i], ordenLocal[i - 1]]; render(overlay); }));
      $$('.btn-bajar', lista).forEach((btn, i) => btn.addEventListener('click', () => { [ordenLocal[i + 1], ordenLocal[i]] = [ordenLocal[i], ordenLocal[i + 1]]; render(overlay); }));
    }

    const { overlay, cerrar } = abrirModal({
      title: 'Ordenar tiendas',
      bodyHtml: `<div class="orden-lista" id="orden-lista"></div>`,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar orden</button>`
    });
    render(overlay);

    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-guardar');
      const ordenes = ordenLocal.map((t, i) => ({ id: t.id, orden: i + 1 }));
      btn.disabled = true;
      try {
        const res = await fetch('/api/admin/tiendas/orden', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordenes }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Orden actualizado', 'El catálogo de tiendas se reordenó.');
        cerrar();
        cargarTiendas();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // =======================================================================
  // 5. Modo Mantenimiento
  // =======================================================================
  async function cargarMantenimiento() {
    const res = await fetch('/api/admin/mantenimiento');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.mantenimiento = data;
    renderMantenimiento();
  }

  function renderMantenimiento() {
    const m = state.mantenimiento || { activo: 0, mensaje: null };
    const activo = !!m.activo;
    $('#panel-content').innerHTML = `
      <div class="panel-toolbar"><h2>Modo Mantenimiento</h2></div>
      <div class="mantenimiento-banner ${activo ? 'activo' : 'normal'}">
        <h3>${activo ? 'Mantenimiento activo' : 'El sistema opera con normalidad'}</h3>
        <p>${activo ? (m.mensaje || 'El sistema está en mantenimiento.') : 'Todos los usuarios tienen acceso normal al portal.'}</p>
      </div>
      <div class="mantenimiento-form">
        <p class="form-hint">Mientras el mantenimiento está activo, solo las cuentas administradoras pueden usar el sistema; el resto ve una pantalla de aviso con el mensaje configurado.</p>
        <div class="form-field">
          <label>Mensaje para los usuarios bloqueados</label>
          <textarea id="input-mensaje-mantenimiento" ${activo ? 'disabled' : ''}>${escapeHtml(m.mensaje || '')}</textarea>
        </div>
        ${activo
          ? `<button class="btn btn--primary" id="btn-desactivar-mantenimiento">Desactivar Modo Mantenimiento</button>`
          : `<button class="btn btn--danger" id="btn-activar-mantenimiento">Activar Modo Mantenimiento</button>`}
      </div>
    `;

    if (activo) {
      $('#btn-desactivar-mantenimiento').addEventListener('click', async () => {
        try {
          const res = await fetch('/api/admin/mantenimiento', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: false }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          window.toast.success('Mantenimiento desactivado', 'El acceso normal fue restablecido.');
          cargarMantenimiento();
        } catch (error) {
          window.toast.error('No se pudo desactivar', error.message);
        }
      });
    } else {
      $('#btn-activar-mantenimiento').addEventListener('click', () => abrirModalActivarMantenimiento());
    }
  }

  function abrirModalActivarMantenimiento() {
    const mensaje = $('#input-mensaje-mantenimiento').value.trim();
    const bodyHtml = `
      <p>Activar el Modo Mantenimiento bloquea de inmediato a cualquier usuario que no sea Administrador, incluidos los que ya tengan sesión abierta.</p>
      <div class="form-field full" style="margin-top:12px;">
        <label>Confirma tu contraseña de administrador</label>
        <input type="password" id="input-password-confirmar" autocomplete="current-password">
      </div>
    `;
    const { overlay, cerrar } = abrirModal({
      title: 'Activar Modo Mantenimiento',
      bodyHtml,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--danger" id="btn-confirmar">Activar</button>`
    });
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-confirmar');
      const password = overlay.querySelector('#input-password-confirmar').value;
      if (!password) {
        mostrarErrorModal(overlay, 'Debes ingresar tu contraseña.');
        return;
      }
      btn.disabled = true;
      try {
        const res = await fetch('/api/admin/mantenimiento', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo: true, mensaje, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Mantenimiento activado', 'El sistema quedó bloqueado para el resto de usuarios.');
        cerrar();
        cargarMantenimiento();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }
})();
