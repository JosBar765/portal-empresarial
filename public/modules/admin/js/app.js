// public/modules/admin/js/app.js
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // analisis_correcciones_16.md #7: renumeración de roles tras eliminar los
  // roles descontinuados (Supervisor de Ventas pasa de id 4 a id 3).
  const ROL_ASESOR = 2;
  const ROL_SUPERVISOR = 3;
  const ROL_ADMINISTRADOR = 1;
  // analisis_correcciones_17.md #12/#13: mismos roles/tiendas que valida el backend.
  const ROLES_ENCARGADO_UNICO = [4, 5, 9];
  const ROL_TECNICO = 6;
  const ROL_ASISTENTE = 7;
  const ROL_ENCARGADO_DISENO_LOCAL = 10;
  const TALLERES_CLONABLES_ASISTENTE = ['Diseño', 'Diseño UV/3D', 'Protextil'];

  const state = {
    user: null,
    tab: 'usuarios',
    usuarios: [], usuariosResumen: { total: 0, activos: 0, inactivos: 0, rolesEnUso: 0 }, busquedaUsuarios: '',
    // analisis_correcciones_14.md #6/#7: filtros de tienda/rol para Gestión de Usuarios.
    filtroTiendaUsuarios: '', filtroRolUsuarios: '',
    roles: [],
    tiendas: [], filtroTiendaTiendas: '',
    // Catálogos livianos (id + nombre) para poblar los <select> de filtro,
    // cargados una vez y reusados por las distintas pestañas.
    catalogoTiendas: [], catalogoRoles: [],
    mantenimiento: null,
    socket: null
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
    initSocket();
    $('#logout-btn').addEventListener('click', async () => {
      try { await fetch('/api/auth.php?action=logout'); } catch (error) { /* redirige de todas formas */ }
      window.location.href = '/login/';
    });

    await cargarTab();
  });

  // analisis_correcciones_17.md #2: para enterarse si el propio admin.ver
  // le fue revocado a su rol (u otro cambio de permisos) mientras está
  // parado en el panel.
  function initSocket() {
    if (typeof io === 'undefined') return;
    state.socket = io({ query: { userId: state.user.id } });
    state.socket.on('connect', () => {
      state.socket.emit('register_module', [`role_${state.user.rolId}`]);
    });
    state.socket.on('permisos_actualizados', async () => {
      await fetch('/api/auth/refresh', { method: 'POST' });
      window.location.reload();
    });
  }

  function inicialesAvatar(nombreCompleto) {
    const partes = (nombreCompleto || '').trim().split(/\s+/);
    const iniciales = partes.slice(0, 2).map(p => p[0]).join('');
    return iniciales.toUpperCase() || '--';
  }

  function escapeHtml(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

  // analisis_correcciones_17.md #10: no perder la pestaña activa al
  // recargar la página (antes siempre volvía a "usuarios").
  const TAB_ACTIVA_KEY = 'admin:tabActiva';
  const TABS_VALIDOS = ['usuarios', 'roles', 'tiendas', 'talleres', 'mantenimiento'];

  function wireSidebar() {
    const sidebar = $('#sidebar-admin');
    const toggleMovil = $('#sidebar-toggle-mobile');

    const tabGuardada = localStorage.getItem(TAB_ACTIVA_KEY);
    if (TABS_VALIDOS.includes(tabGuardada)) {
      state.tab = tabGuardada;
      $$('.sidebar-item', sidebar).forEach(b => b.classList.toggle('sidebar-item-active', b.dataset.tab === tabGuardada));
    }

    $$('.sidebar-item', sidebar).forEach(btn => {
      btn.addEventListener('click', () => {
        cerrarSidebarMovil();
        if (btn.dataset.tab === state.tab) return;
        $$('.sidebar-item', sidebar).forEach(b => b.classList.remove('sidebar-item-active'));
        btn.classList.add('sidebar-item-active');
        state.tab = btn.dataset.tab;
        localStorage.setItem(TAB_ACTIVA_KEY, state.tab);
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
      else if (state.tab === 'tiendas') await cargarTiendas();
      else if (state.tab === 'talleres') await cargarTalleres();
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

  // =======================================================================
  // Menú cascada (analisis_correcciones_17.md #4/#5/#6/#7/#15) — desplegable
  // vertical con submenús de nivel 2 hacia la derecha. Reemplaza los <select>
  // de Tienda/Rol en Gestionar Usuarios, el modal de Nuevo Usuario y el
  // filtro de Gestionar Tiendas. Un nodo del árbol es uno
  // de tres tipos:
  //   - hoja:    { tipo:'hoja', valor, etiqueta }         — seleccionable.
  //   - grupo:   { tipo:'grupo', etiqueta, hijos }        — abre un submenú
  //              flotante hacia la derecha (ej. "Trofex R1").
  //   - seccion: { tipo:'seccion', etiqueta, hijos }      — encabezado no
  //              clickeable, sus hijos se listan debajo en línea (ej. un país).
  function construirArbolTiendas(tiendas) {
    const porPais = {};
    tiendas.forEach(t => {
      const pais = t.pais_nombre || 'Sin país';
      (porPais[pais] = porPais[pais] || []).push(t);
    });
    const etiquetaTienda = t => `${t.codigo} - ${t.nombre}`;
    return Object.keys(porPais).sort().map(pais => {
      const sueltas = [];
      const gruposPorDepto = {};
      porPais[pais].slice().sort((a, b) => a.orden - b.orden).forEach(t => {
        const depto = t.departamento_nombre || '';
        // Agrupación elegida: los departamentos "Trofex" (Ruta 1/Ruta 2) van
        // en submenú; el resto de tiendas del país quedan sueltas.
        if (/trofex/i.test(depto)) {
          const etiquetaGrupo = depto.replace(/^Ventas\s+/i, '');
          (gruposPorDepto[etiquetaGrupo] = gruposPorDepto[etiquetaGrupo] || []).push(t);
        } else {
          sueltas.push(t);
        }
      });
      const hijos = [
        ...sueltas.map(t => ({ tipo: 'hoja', valor: t.id, etiqueta: etiquetaTienda(t) })),
        ...Object.keys(gruposPorDepto).sort().map(etiqueta => ({
          tipo: 'grupo',
          etiqueta,
          hijos: gruposPorDepto[etiqueta].map(t => ({ tipo: 'hoja', valor: t.id, etiqueta: etiquetaTienda(t) }))
        }))
      ];
      return { tipo: 'seccion', etiqueta: pais, hijos };
    });
  }

  // Orden y agrupación fijos del punto 5 — no se derivan genéricamente de la
  // tabla de roles porque el propio documento define esta jerarquía puntual.
  function construirArbolRoles(roles) {
    const porId = new Map(roles.map(r => [r.id, r]));
    const hoja = (id) => porId.has(id) ? { tipo: 'hoja', valor: id, etiqueta: porId.get(id).nombre } : null;
    const grupoEncargados = { tipo: 'grupo', etiqueta: 'Encargados de taller', hijos: [4, 5, 9, 10].map(hoja).filter(Boolean) };
    return [hoja(1), hoja(8), hoja(3), hoja(2), grupoEncargados, hoja(7), hoja(6)].filter(Boolean);
  }

  // El panel principal y los submenús de nivel 2 viven sueltos en
  // document.body (no como descendientes del trigger): un ancestro con
  // overflow (un modal scrolleable) o con transform (incluida una animación
  // de apertura con scale/translate) recortaría o desubicaría un panel
  // anidado ahí. Cada uno queda marcado con `_dueno` (el elemento del que
  // depende su ciclo de vida) para poder barrer los que ya quedaron
  // huérfanos de un render anterior.
  function limpiarMenusCascadaHuerfanos() {
    $$('.menu-cascada-panel, .menu-cascada-panel-nivel2').forEach(el => {
      if (el._dueno && !el._dueno.isConnected) el.remove();
    });
  }

  // Cada trigger detiene la propagación de su propio click, así que el
  // listener "click afuera" de cualquier OTRO menú abierto nunca se entera
  // de ese click y no se cierra — este registro deja que abrir uno cierre
  // explícitamente a todos los demás.
  const menusCascadaAbiertos = new Set();

  // `deshabilitar(nodoHoja)` opcional: devuelve { disabled, motivo } para
  // bloquear una hoja puntual (rol ya ocupado, tienda fuera de MTC/MTS) sin
  // sacarla del árbol, con el motivo visible como title.
  function crearMenuCascada({ arbol, valorActual, etiquetaVacio, deshabilitar, onSeleccionar }) {
    let actual = valorActual;
    const cont = document.createElement('div');
    cont.className = 'menu-cascada';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'menu-cascada-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    const etiquetaSpan = document.createElement('span');
    etiquetaSpan.className = 'menu-cascada-valor';
    trigger.appendChild(etiquetaSpan);
    trigger.insertAdjacentHTML('beforeend', '<ion-icon name="chevron-down-outline"></ion-icon>');
    cont.appendChild(trigger);

    // El panel vive en document.body (no como hijo de cont): triggers dentro
    // de un modal (overflow-y: auto) recortarían un panel absoluto/anidado —
    // mismo problema que el submenú de nivel 2, misma solución.
    const nav = document.createElement('nav');
    nav.className = 'menu-cascada-panel';
    nav.setAttribute('aria-label', 'Menú de selección');
    nav._dueno = cont;
    document.body.appendChild(nav);

    function buscarEtiqueta(valor, nodos) {
      for (const nodo of nodos) {
        if (nodo.tipo === 'hoja' && String(nodo.valor) === String(valor)) return nodo.etiqueta;
        if (nodo.hijos) {
          const enHijos = buscarEtiqueta(valor, nodo.hijos);
          if (enHijos) return enHijos;
        }
      }
      return null;
    }

    function actualizarTrigger() {
      etiquetaSpan.textContent = (actual === '' || actual == null) ? etiquetaVacio : (buscarEtiqueta(actual, arbol) || etiquetaVacio);
    }

    function marcarActivos() {
      $$('.menu-cascada-item[data-valor]', nav).forEach(btn => {
        btn.classList.toggle('menu-cascada-item-activo', String(btn.dataset.valor) === String(actual));
      });
    }

    const misFlyouts = [];
    function cerrarTodo() {
      trigger.setAttribute('aria-expanded', 'false');
      nav.classList.remove('visible');
      misFlyouts.forEach(f => { f.style.display = 'none'; });
      $$('.menu-cascada-item-padre', nav).forEach(b => b.setAttribute('aria-expanded', 'false'));
      menusCascadaAbiertos.delete(cerrarTodo);
    }

    function renderNodo(nodo) {
      const li = document.createElement('li');
      if (nodo.tipo === 'hoja') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'menu-cascada-item';
        btn.dataset.valor = nodo.valor;
        btn.textContent = nodo.etiqueta;
        const estado = deshabilitar ? deshabilitar(nodo) : null;
        if (estado && estado.disabled) {
          btn.disabled = true;
          if (estado.motivo) btn.title = estado.motivo;
        } else {
          btn.addEventListener('click', () => {
            actual = nodo.valor;
            actualizarTrigger();
            marcarActivos();
            cerrarTodo();
            onSeleccionar(nodo.valor);
          });
        }
        li.appendChild(btn);
      } else if (nodo.tipo === 'grupo') {
        li.className = 'menu-cascada-submenu';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'menu-cascada-item menu-cascada-item-padre';
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = `<span>${escapeHtml(nodo.etiqueta)}</span><ion-icon name="chevron-forward-outline"></ion-icon>`;
        const subUl = document.createElement('ul');
        subUl.className = 'menu-cascada-panel-nivel2';
        subUl._dueno = li;
        nodo.hijos.forEach(hijo => subUl.appendChild(renderNodo(hijo)));
        document.body.appendChild(subUl);
        misFlyouts.push(subUl);
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const yaAbierto = subUl.style.display === 'block';
          misFlyouts.forEach(f => { f.style.display = 'none'; });
          $$('.menu-cascada-item-padre', nav).forEach(b => b.setAttribute('aria-expanded', 'false'));
          if (!yaAbierto) {
            const rect = li.getBoundingClientRect();
            subUl.style.top = `${rect.top}px`;
            const cabeEnDerecha = rect.right + 220 <= window.innerWidth;
            if (cabeEnDerecha) {
              subUl.style.left = `${rect.right + 4}px`;
              subUl.style.right = '';
            } else {
              subUl.style.left = '';
              subUl.style.right = `${window.innerWidth - rect.left + 4}px`;
            }
            subUl.style.display = 'block';
            btn.setAttribute('aria-expanded', 'true');
          }
        });
        li.appendChild(btn);
      } else if (nodo.tipo === 'seccion') {
        li.className = 'menu-cascada-seccion';
        const titulo = document.createElement('span');
        titulo.className = 'menu-cascada-seccion-titulo';
        titulo.textContent = nodo.etiqueta;
        const subUl = document.createElement('ul');
        nodo.hijos.forEach(hijo => subUl.appendChild(renderNodo(hijo)));
        li.appendChild(titulo);
        li.appendChild(subUl);
      }
      return li;
    }

    const raiz = document.createElement('ul');
    arbol.forEach(nodo => raiz.appendChild(renderNodo(nodo)));
    nav.appendChild(raiz);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const abrir = !nav.classList.contains('visible');
      if (abrir) {
        // Cierra cualquier otro combobox ya abierto antes de abrir este.
        menusCascadaAbiertos.forEach(cerrar => { if (cerrar !== cerrarTodo) cerrar(); });
        // Barre paneles/flyouts huérfanos de renders anteriores AQUÍ (no
        // durante la construcción del árbol, cuando los propios <li>/cont
        // todavía no están conectados al documento y `isConnected` daría un
        // falso "huérfano").
        limpiarMenusCascadaHuerfanos();
        const rect = trigger.getBoundingClientRect();
        nav.style.top = `${rect.bottom + 6}px`;
        nav.style.left = `${rect.left}px`;
        nav.classList.add('visible');
        trigger.setAttribute('aria-expanded', 'true');
        menusCascadaAbiertos.add(cerrarTodo);
      } else {
        cerrarTodo();
      }
    });
    // Listeners globales con auto-limpieza: si `cont` ya no está en el
    // documento (este menú quedó obsoleto por un re-render, o su modal
    // contenedor se cerró) se desregistran solos Y retiran de inmediato el
    // panel/flyouts que hubieran quedado sueltos y visibles en <body> — no
    // basta con dejar de escuchar, porque un modal puede cerrarse (Escape,
    // Cancelar, click en el fondo) con el menú todavía abierto.
    const limpiarSiObsoleto = () => {
      if (cont.isConnected) return false;
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeydown);
      nav.remove();
      misFlyouts.forEach(f => f.remove());
      menusCascadaAbiertos.delete(cerrarTodo);
      return true;
    };
    const onDocumentClick = (e) => {
      if (limpiarSiObsoleto()) return;
      if (!cont.contains(e.target) && !nav.contains(e.target) && !misFlyouts.some(f => f.contains(e.target))) cerrarTodo();
    };
    const onDocumentKeydown = (e) => {
      if (limpiarSiObsoleto()) return;
      if (e.key === 'Escape') cerrarTodo();
    };
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown);

    actualizarTrigger();
    marcarActivos();

    return {
      elemento: cont,
      actualizar(nuevoValor) {
        actual = nuevoValor;
        actualizarTrigger();
        marcarActivos();
      }
    };
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
        // analisis_correcciones_17.md #11: el Administrador aparece en la
        // lista pero sin ninguna acción disponible sobre él.
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

  // "Gestionar Usuarios" solo crea usuarios y edita su información personal
  // — ninguna asignación de tienda o taller vive aquí (eso es "Gestionar
  // Tiendas"/"Gestionar Talleres"). El rol se elige al crear y ya no se
  // puede cambiar al editar.
  async function abrirModalUsuario(usuario) {
    const [rolesData, usuariosData, orgData] = await Promise.all([
      fetch('/api/admin/roles').then(r => r.json()),
      fetch('/api/admin/usuarios').then(r => r.json()),
      fetch('/api/admin/organizacion').then(r => r.json())
    ]);
    const roles = rolesData.roles;
    const todosUsuarios = usuariosData.usuarios;
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

    // Teléfono con código de país (punto 5) — solo Asesor/Supervisor lo
    // tienen; mismo patrón que public/modules/vales/js/app.js.
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
    state.roles = data.roles;
    renderRoles();
  }

  function renderRoles() {
    $('#panel-content').innerHTML = `
      <div class="panel-toolbar">
        <h2>Roles y Permisos</h2>
        <div class="panel-toolbar-acciones">
          <button class="btn btn--primary" id="btn-nuevo-rol"><ion-icon name="add-outline"></ion-icon> Nuevo Rol</button>
        </div>
      </div>
      <div class="roles-grid" id="roles-grid"></div>
    `;

    const grid = $('#roles-grid');
    grid.innerHTML = state.roles.map(rol => `
      <div class="rol-card" data-rol-id="${rol.id}">
        <div class="rol-card-titulo">${escapeHtml(rol.nombre)}${rol.base ? '<span class="badge badge-base">Base</span>' : ''}</div>
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

        // analisis_correcciones_18.md #4: el candado ES el indicador de
        // estado (ya no hay badge "Activo"/"Inactivo" aparte) — desbloqueado
        // y verde cuando el rol está activo, bloqueado y rojo cuando no.
        const btnToggle = document.createElement('button');
        btnToggle.className = `btn-icon candado-estado ${rol.activo ? 'candado-activo' : 'candado-inactivo'}`;
        btnToggle.title = rol.activo ? 'Rol activo — clic para desactivar' : 'Rol inactivo — clic para activar';
        btnToggle.setAttribute('aria-label', btnToggle.title);
        btnToggle.innerHTML = `<ion-icon name="${rol.activo ? 'lock-open-outline' : 'lock-closed-outline'}"></ion-icon>`;
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
  // 3. Gestionar Tiendas
  // =======================================================================
  async function cargarTiendas() {
    const [tiendasRes, orgRes] = await Promise.all([
      fetch('/api/admin/tiendas').then(r => r.json()),
      fetch('/api/admin/organizacion').then(r => r.json())
    ]);
    state.tiendas = tiendasRes.tiendas;
    state.organizacion = orgRes;
    renderTiendas();
  }

  function renderTiendas() {
    $('#panel-content').innerHTML = `
      <div class="panel-toolbar">
        <h2>Gestionar Tiendas</h2>
        <div class="panel-toolbar-acciones">
          <div id="filtro-tienda-tiendas-cont"></div>
          <button class="btn btn--primary" id="btn-nueva-tienda"><ion-icon name="add-outline"></ion-icon> Nueva Tienda</button>
        </div>
      </div>
      <div class="tabla-wrapper">
        <table class="data-table sticky-header">
          <thead><tr><th>Orden</th><th>Tienda</th><th>País</th><th>Departamento</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="tiendas-tbody"></tbody>
        </table>
      </div>
    `;
    $('#filtro-tienda-tiendas-cont').appendChild(crearMenuCascada({
      arbol: [{ tipo: 'hoja', valor: '', etiqueta: 'Todas las tiendas' }, ...construirArbolTiendas(state.tiendas)],
      valorActual: state.filtroTiendaTiendas,
      etiquetaVacio: 'Todas las tiendas',
      onSeleccionar: (valor) => { state.filtroTiendaTiendas = String(valor); renderTiendas(); }
    }).elemento);

    // analisis_correcciones_17.md #15: filtro por tienda en vez de reordenar
    // manualmente el catálogo.
    const tiendasFiltradas = state.tiendas.filter(t => !state.filtroTiendaTiendas || String(t.id) === state.filtroTiendaTiendas);
    const tbody = $('#tiendas-tbody');
    tbody.innerHTML = tiendasFiltradas.map(t => `
      <tr>
        <td data-label="Orden">${t.orden}</td>
        <td data-label="Tienda">${escapeHtml(t.nombre)}<div class="tabla-secundaria">${escapeHtml(t.codigo)}</div></td>
        <td data-label="País">${t.pais_nombre ? escapeHtml(t.pais_nombre) : '-'}</td>
        <td data-label="Departamento/Subdivisión">${escapeHtml(t.departamento_nombre)}${t.subdivision_nombre ? '<div class="tabla-secundaria">' + escapeHtml(t.subdivision_nombre) + '</div>' : ''}</td>
        <td data-label="Estado"><span class="badge ${t.activo ? 'badge-activo' : 'badge-inactivo'}">${t.activo ? 'Activa' : 'Inactiva'}</span></td>
        <td data-label="Acciones" class="acciones-cell" data-tienda-id="${t.id}"></td>
      </tr>
    `).join('');

    tiendasFiltradas.forEach(t => {
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
  }

  const PAISES_TIENDA = [
    { id: 1, nombre: 'Guatemala' }, { id: 2, nombre: 'El Salvador' }, { id: 3, nombre: 'Honduras' },
    { id: 4, nombre: 'Nicaragua' }, { id: 5, nombre: 'Costa Rica' }, { id: 6, nombre: 'Belice' }
  ];

  // analisis_correcciones_18.md #3: el nombre de la tienda ya no se escribe a
  // mano (se deriva de {EMPRESA}, {SUBDIVISIÓN} en el backend) — este modal
  // solo captura los IDs de los que depende: Empresa y Departamento quedan
  // filtrados por el País elegido, y la Subdivisión se elige de las
  // existentes de ese departamento/país o se crea una nueva.
  function empresasDelPais(paisId) {
    return state.organizacion.empresas.filter(e => Number(e.pais_id) === Number(paisId));
  }
  // Un departamento aparece para un país si tiene alguna subdivisión de ese
  // país, o si no tiene subdivisiones propias y su propio país coincide
  // (caso "Ventas Premia Z13", exclusivo de Guatemala).
  function departamentosDelPais(paisId) {
    const pid = Number(paisId);
    return state.organizacion.departamentos.filter(d => {
      const subs = state.organizacion.subdivisiones.filter(s => s.departamento_id === d.id);
      return subs.length > 0 ? subs.some(s => Number(s.pais_id) === pid) : Number(d.pais_id) === pid;
    });
  }
  function subdivisionesDelDepartamento(departamentoId, paisId) {
    return state.organizacion.subdivisiones.filter(s => s.departamento_id === Number(departamentoId) && Number(s.pais_id) === Number(paisId));
  }

  function abrirModalTienda(tienda) {
    const esEdicion = !!tienda;
    const paisInicial = esEdicion ? tienda.pais_id : (PAISES_TIENDA[0] && PAISES_TIENDA[0].id);
    const bodyHtml = `
      <div class="form-grid">
        <div class="form-field">
          <label>Código</label>
          <input type="text" id="input-codigo" maxlength="10">
        </div>
        <div class="form-field">
          <label>País</label>
          <select id="input-pais">
            ${PAISES_TIENDA.map(p => `<option value="${p.id}" ${paisInicial === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Empresa</label>
          <select id="input-empresa"></select>
        </div>
        <div class="form-field full" id="zona-departamento"></div>
        <div class="form-field full" id="zona-subdivision"></div>
        ${esEdicion ? `<div class="form-field"><label class="form-checkbox" style="margin-top:8px;"><input type="checkbox" id="input-activo-tienda" ${tienda.activo ? 'checked' : ''}> Tienda activa</label></div>` : ''}
      </div>
    `;
    const { overlay, cerrar } = abrirModal({
      title: esEdicion ? `Editar tienda — ${tienda.nombre}` : 'Nueva tienda',
      bodyHtml,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-guardar">Guardar</button>`
    });
    overlay.querySelector('#input-codigo').value = esEdicion ? tienda.codigo : '';

    let departamentoModo = 'existente'; // 'existente' | 'nueva'
    let subdivisionModo = 'existente'; // 'existente' | 'nueva'

    // analisis_correcciones_19.md #9: mientras el departamento esté en modo
    // "crear nuevo" no hay ningún departamento real todavía, así que no hay
    // subdivisiones existentes que listar — la única opción posible es crear
    // una subdivisión nueva también.
    function departamentoIdActual() {
      if (departamentoModo === 'nueva') return null;
      const sel = overlay.querySelector('#input-departamento-existente');
      return sel ? sel.value : '';
    }

    function renderZonaSubdivision() {
      const departamentoId = departamentoIdActual();
      const paisId = overlay.querySelector('#input-pais').value;
      const subs = departamentoId ? subdivisionesDelDepartamento(departamentoId, paisId) : [];
      const zona = overlay.querySelector('#zona-subdivision');
      const puedeUsarExistente = departamentoModo === 'existente';
      zona.innerHTML = `
        <label>Subdivisión</label>
        <div class="form-radio-group">
          ${puedeUsarExistente ? `<label class="form-checkbox"><input type="radio" name="modo-subdivision" value="existente" ${subdivisionModo === 'existente' ? 'checked' : ''}> Usar existente</label>` : ''}
          <label class="form-checkbox"><input type="radio" name="modo-subdivision" value="nueva" ${subdivisionModo === 'nueva' ? 'checked' : ''}> Crear nueva</label>
        </div>
        <div id="zona-subdivision-input"></div>
      `;
      function renderInput() {
        const cont = zona.querySelector('#zona-subdivision-input');
        if (subdivisionModo === 'nueva') {
          cont.innerHTML = `<input type="text" id="input-subdivision-nombre" placeholder="Nombre de la nueva subdivisión">`;
        } else {
          const seleccionada = esEdicion && Number(tienda.departamento_id) === Number(departamentoId) ? tienda.subdivision_id : null;
          cont.innerHTML = `
            <select id="input-subdivision-existente">
              <option value="">Sin subdivisión</option>
              ${subs.map(s => `<option value="${s.id}" ${seleccionada === s.id ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`).join('')}
            </select>
          `;
        }
      }
      renderInput();
      zona.querySelectorAll('input[name="modo-subdivision"]').forEach(r => {
        r.addEventListener('change', (e) => { subdivisionModo = e.target.value; renderInput(); });
      });
    }

    function renderZonaDepartamento() {
      const paisId = overlay.querySelector('#input-pais').value;
      const departamentos = departamentosDelPais(paisId);
      const zona = overlay.querySelector('#zona-departamento');
      zona.innerHTML = `
        <label>Departamento</label>
        <div class="form-radio-group">
          <label class="form-checkbox"><input type="radio" name="modo-departamento" value="existente" ${departamentoModo === 'existente' ? 'checked' : ''}> Usar existente</label>
          <label class="form-checkbox"><input type="radio" name="modo-departamento" value="nueva" ${departamentoModo === 'nueva' ? 'checked' : ''}> Crear nuevo</label>
        </div>
        <div id="zona-departamento-input"></div>
      `;
      function renderInput() {
        const cont = zona.querySelector('#zona-departamento-input');
        if (departamentoModo === 'nueva') {
          cont.innerHTML = `<input type="text" id="input-departamento-nombre" placeholder="Nombre del nuevo departamento">`;
        } else {
          const departamentoSel = esEdicion ? tienda.departamento_id : null;
          cont.innerHTML = departamentos.length
            ? `<select id="input-departamento-existente">${departamentos.map(d => `<option value="${d.id}" ${departamentoSel === d.id ? 'selected' : ''}>${escapeHtml(d.nombre)}</option>`).join('')}</select>`
            : `<select id="input-departamento-existente"><option value="">Sin departamentos para este país</option></select>`;
          overlay.querySelector('#input-departamento-existente').addEventListener('change', renderZonaSubdivision);
        }
      }
      renderInput();
      zona.querySelectorAll('input[name="modo-departamento"]').forEach(r => {
        r.addEventListener('change', (e) => {
          departamentoModo = e.target.value;
          renderInput();
          if (departamentoModo === 'nueva') subdivisionModo = 'nueva';
          renderZonaSubdivision();
        });
      });
    }

    function renderEmpresasYDepartamentos() {
      const paisId = overlay.querySelector('#input-pais').value;
      const empresas = empresasDelPais(paisId);
      const empresaSel = esEdicion ? tienda.empresa_id : null;
      overlay.querySelector('#input-empresa').innerHTML = empresas.length
        ? empresas.map(e => `<option value="${e.id}" ${empresaSel === e.id ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')
        : `<option value="">Sin empresas para este país</option>`;
      renderZonaDepartamento();
      renderZonaSubdivision();
    }
    renderEmpresasYDepartamentos();
    overlay.querySelector('#input-pais').addEventListener('change', renderEmpresasYDepartamentos);

    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-guardar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-guardar');
      const paisId = overlay.querySelector('#input-pais').value;
      const empresaId = overlay.querySelector('#input-empresa').value;
      const payload = {
        codigo: overlay.querySelector('#input-codigo').value.trim().toUpperCase(),
        empresaId: empresaId ? Number(empresaId) : null,
        paisId: paisId ? Number(paisId) : null
      };
      if (departamentoModo === 'nueva') {
        payload.departamentoNombre = overlay.querySelector('#input-departamento-nombre').value.trim();
      } else {
        const depVal = overlay.querySelector('#input-departamento-existente').value;
        payload.departamentoId = depVal ? Number(depVal) : null;
      }
      if (subdivisionModo === 'nueva') {
        payload.subdivisionNombre = overlay.querySelector('#input-subdivision-nombre').value.trim();
      } else {
        const subVal = overlay.querySelector('#input-subdivision-existente').value;
        payload.subdivisionId = subVal ? Number(subVal) : null;
      }
      if (esEdicion) payload.activo = overlay.querySelector('#input-activo-tienda').checked;
      if (!payload.codigo || !payload.empresaId || !(payload.departamentoId || payload.departamentoNombre)) {
        mostrarErrorModal(overlay, 'Código, empresa y departamento son obligatorios.');
        return;
      }
      if (departamentoModo === 'nueva' && !payload.departamentoNombre) {
        mostrarErrorModal(overlay, 'Escribe el nombre del nuevo departamento, o elegí "Usar existente".');
        return;
      }
      if (subdivisionModo === 'nueva' && !payload.subdivisionNombre) {
        mostrarErrorModal(overlay, 'Escribe el nombre de la nueva subdivisión, o elegí "Usar existente".');
        return;
      }
      btn.disabled = true;
      try {
        const url = esEdicion ? `/api/admin/tiendas/${tienda.id}` : '/api/admin/tiendas';
        const res = await fetch(url, { method: esEdicion ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success(esEdicion ? 'Tienda actualizada' : 'Tienda creada', payload.codigo);
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
  // analisis_correcciones_17.md #14: orden de negocio fijo para agrupar al
  // personal de una tienda — los 4 roles de encargado de taller se colapsan
  // en un solo bucket ("Encargado(s) de taller"), el resto conserva su
  // nombre de rol tal cual.
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

  async function abrirModalVerPersonal(tienda) {
    const personal = await fetch(`/api/admin/tiendas/${tienda.id}/personal`).then(r => r.json());
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

  async function abrirModalPersonal(tienda) {
    const [personal, todosUsuarios] = await Promise.all([
      fetch(`/api/admin/tiendas/${tienda.id}/personal`).then(r => r.json()),
      fetch('/api/admin/usuarios').then(r => r.json()).then(d => d.usuarios)
    ]);
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

    // analisis_correcciones_17.md #14: el personal ya ligado se agrupa con
    // el mismo criterio y orden que "Ver personal", en vez de listarse plano.
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

  // =======================================================================
  // 4. Gestionar Talleres
  // =======================================================================
  function rolEsperadoDeTaller(taller) {
    if (taller.nombre === 'Diseño') return 4;
    if (taller.nombre === 'Diseño UV/3D') return 5;
    if (taller.nombre === 'Protextil') return 9;
    return ROL_ENCARGADO_DISENO_LOCAL;
  }

  async function cargarTalleres() {
    const { talleres } = await fetch('/api/admin/talleres').then(r => r.json());
    state.talleres = talleres;
    renderTalleres();
  }

  function renderTalleres() {
    $('#panel-content').innerHTML = `
      <div class="panel-toolbar">
        <h2>Gestionar Talleres</h2>
      </div>
      <div class="tabla-wrapper">
        <table class="data-table sticky-header">
          <thead><tr><th>Taller</th><th>Encargado</th><th>Técnicos</th><th>Acciones</th></tr></thead>
          <tbody id="talleres-tbody"></tbody>
        </table>
      </div>
    `;
    const tbody = $('#talleres-tbody');
    tbody.innerHTML = state.talleres.map(t => `
      <tr>
        <td data-label="Taller">${escapeHtml(t.nombre)}</td>
        <td data-label="Encargado">${t.encargado_nombre ? escapeHtml(t.encargado_nombre) : '<span class="form-hint">Sin encargado</span>'}</td>
        <td data-label="Técnicos">${t.tecnicos_count}</td>
        <td data-label="Acciones" class="acciones-cell" data-taller-id="${t.id}"></td>
      </tr>
    `).join('');
    state.talleres.forEach(t => {
      const celda = tbody.querySelector(`[data-taller-id="${t.id}"]`);
      const btnVer = document.createElement('button');
      btnVer.className = 'btn-icon';
      btnVer.title = 'Ver personal';
      btnVer.innerHTML = '<ion-icon name="eye-outline"></ion-icon>';
      btnVer.addEventListener('click', () => abrirModalVerPersonalTaller(t));
      celda.appendChild(btnVer);

      const btnGestionar = document.createElement('button');
      btnGestionar.className = 'btn-icon';
      btnGestionar.title = 'Gestionar personal';
      btnGestionar.innerHTML = '<ion-icon name="people-outline"></ion-icon>';
      btnGestionar.addEventListener('click', () => abrirModalPersonalTaller(t));
      celda.appendChild(btnGestionar);
    });
  }

  async function abrirModalVerPersonalTaller(taller) {
    const personal = await fetch(`/api/admin/talleres/${taller.id}/personal`).then(r => r.json());
    const encargado = personal.find(p => p.tipo_vinculo === 'encargado');
    const tecnicos = personal.filter(p => p.tipo_vinculo === 'tecnico');
    const bodyHtml = `
      <p class="section-title">Encargado</p>
      <div class="personal-lista">
        ${encargado
          ? `<div class="personal-item"><div class="personal-item-info"><span>${escapeHtml(encargado.nombre)}</span></div></div>`
          : '<p class="form-hint">Sin encargado asignado.</p>'}
      </div>
      <p class="section-title">Técnicos (${tecnicos.length})</p>
      <div class="personal-lista">
        ${tecnicos.map(p => `
          <div class="personal-item">
            <div class="personal-item-info">
              <span>${escapeHtml(p.nombre)}</span>
              ${p.rol_id === ROL_ASISTENTE ? '<span class="rol">Asistente</span>' : ''}
            </div>
          </div>
        `).join('') || '<p class="form-hint">Sin técnicos asignados.</p>'}
      </div>
    `;
    const { overlay, cerrar } = abrirModal({
      title: `Personal — ${taller.nombre}`,
      bodyHtml,
      footerHtml: `<button class="btn btn--primary" id="btn-cerrar-ver-personal-taller">Cerrar</button>`
    });
    overlay.querySelector('#btn-cerrar-ver-personal-taller').addEventListener('click', cerrar);
  }

  async function abrirModalPersonalTaller(taller) {
    const [personal, todosUsuarios] = await Promise.all([
      fetch(`/api/admin/talleres/${taller.id}/personal`).then(r => r.json()),
      fetch('/api/admin/usuarios').then(r => r.json()).then(d => d.usuarios)
    ]);
    const encargadoActual = personal.find(p => p.tipo_vinculo === 'encargado');
    const tecnicosActuales = personal.filter(p => p.tipo_vinculo === 'tecnico');
    const idsActuales = new Set(personal.map(p => p.id));

    const rolEsperado = rolEsperadoDeTaller(taller);
    const encargadosDisponibles = todosUsuarios.filter(u => u.activo && u.rol_id === rolEsperado && !u.taller_id);
    const tecnicosClonables = TALLERES_CLONABLES_ASISTENTE.includes(taller.nombre);
    const tecnicosDisponibles = todosUsuarios.filter(u =>
      u.activo && !idsActuales.has(u.id) && !u.taller_id &&
      (u.rol_id === ROL_TECNICO || (u.rol_id === ROL_ASISTENTE && tecnicosClonables))
    );

    const bodyHtml = `
      <p class="section-title">Encargado</p>
      <div id="zona-encargado-taller" class="form-grid"></div>
      <p class="section-title">Técnicos</p>
      <div id="tecnicos-actual">
        ${tecnicosActuales.map(p => `
          <div class="personal-item" data-usuario-id="${p.id}">
            <div class="personal-item-info">
              <span>${escapeHtml(p.nombre)}</span>
              ${p.rol_id === ROL_ASISTENTE ? '<span class="rol">Asistente</span>' : ''}
            </div>
          </div>
        `).join('') || '<p class="form-hint">Sin técnicos asignados.</p>'}
      </div>
      <p class="section-title">Agregar técnico</p>
      <div class="form-grid">
        <div class="form-field">
          <label>Persona</label>
          <select id="input-agregar-tecnico">
            <option value="">Seleccionar...</option>
            ${tecnicosDisponibles.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)}${u.rol_id === ROL_ASISTENTE ? ' (Asistente)' : ''}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    const { overlay, cerrar } = abrirModal({
      title: `Personal — ${taller.nombre}`,
      bodyHtml,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar-taller">Cerrar</button><button class="btn btn--primary" id="btn-agregar-tecnico">Agregar técnico</button>`
    });

    function renderZonaEncargado() {
      const zona = overlay.querySelector('#zona-encargado-taller');
      if (encargadoActual) {
        zona.innerHTML = `
          <div class="personal-item">
            <div class="personal-item-info"><span>${escapeHtml(encargadoActual.nombre)}</span></div>
          </div>
        `;
        const item = zona.querySelector('.personal-item');
        const btnQuitar = document.createElement('button');
        btnQuitar.className = 'btn-icon icon-danger';
        btnQuitar.title = 'Quitar';
        btnQuitar.innerHTML = '<ion-icon name="close-outline"></ion-icon>';
        btnQuitar.addEventListener('click', async () => {
          try {
            const res = await fetch(`/api/admin/talleres/${taller.id}/encargado`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            window.toast.success('Encargado actualizado', 'Se quitó al encargado del taller.');
            cerrar();
            cargarTalleres();
          } catch (error) {
            window.toast.error('No se pudo quitar', error.message);
          }
        });
        item.appendChild(btnQuitar);
      } else {
        zona.innerHTML = `
          <div class="form-field">
            <select id="input-asignar-encargado">
              <option value="">Seleccionar...</option>
              ${encargadosDisponibles.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)}</option>`).join('') || ''}
            </select>
          </div>
          <button class="btn btn--primary" id="btn-asignar-encargado" type="button">Asignar</button>
        `;
        if (!encargadosDisponibles.length) {
          zona.innerHTML = '<p class="form-hint">No hay usuarios disponibles con el rol correcto para este taller.</p>';
          return;
        }
        overlay.querySelector('#btn-asignar-encargado').addEventListener('click', async () => {
          const usuarioId = overlay.querySelector('#input-asignar-encargado').value;
          if (!usuarioId) return;
          try {
            const res = await fetch(`/api/admin/talleres/${taller.id}/encargado`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuarioId: Number(usuarioId) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            window.toast.success('Encargado actualizado', 'Se asignó el encargado del taller.');
            cerrar();
            cargarTalleres();
          } catch (error) {
            mostrarErrorModal(overlay, error.message);
          }
        });
      }
    }
    renderZonaEncargado();

    $$('#tecnicos-actual .personal-item', overlay).forEach(item => {
      const btnQuitar = document.createElement('button');
      btnQuitar.className = 'btn-icon icon-danger';
      btnQuitar.title = 'Quitar';
      btnQuitar.innerHTML = '<ion-icon name="close-outline"></ion-icon>';
      btnQuitar.addEventListener('click', async () => {
        const usuarioId = item.dataset.usuarioId;
        try {
          const res = await fetch(`/api/admin/talleres/${taller.id}/tecnicos/${usuarioId}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          window.toast.success('Personal actualizado', 'Se quitó del taller.');
          cerrar();
          cargarTalleres();
        } catch (error) {
          window.toast.error('No se pudo quitar', error.message);
        }
      });
      item.appendChild(btnQuitar);
    });

    overlay.querySelector('#btn-cerrar-taller').addEventListener('click', cerrar);
    overlay.querySelector('#btn-agregar-tecnico').addEventListener('click', async () => {
      const usuarioId = overlay.querySelector('#input-agregar-tecnico').value;
      if (!usuarioId) return;
      const btn = overlay.querySelector('#btn-agregar-tecnico');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/admin/talleres/${taller.id}/tecnicos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuarioId: Number(usuarioId) })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Personal actualizado', 'Se agregó al taller.');
        cerrar();
        cargarTalleres();
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
