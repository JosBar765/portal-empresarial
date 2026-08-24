// public/modules/vales/js/app.js
(() => {
  // Estados REALES: nivel general del vale (vales.estado) + nivel de taller
  // (vale_talleres.estado, ver analisis_correcciones_3.md). No colisionan entre
  // sí, así que comparten un solo diccionario de etiquetas.
  const ESTADOS_LABEL = {
    // Generales (RECHAZADO/EN_CORRECCION ya no existen — ver analisis_correcciones_5.md #5)
    CREADO: 'Creado',
    APROBADO_DEPARTAMENTO: 'Aprobado por Talleres',
    PENDIENTE_CONFIRMACION: 'Pendiente Confirmación',
    RECIBIDO: 'Recibido',
    SOLICITANDO_MODIFICACION: 'Solicitando Modificación',
    MODIFICADO: 'Modificado',
    // Por taller
    PENDIENTE_ASIGNACION: 'Pendiente Asignación',
    ASIGNADO: 'Asignado',
    EN_PROCESO: 'En Proceso',
    EN_REVISION: 'En Revisión',
    APROBADO: 'Aprobado'
  };

  // El asesor no ve el estado real de la máquina de estados, ve una versión "lógica"
  // colapsada (analisis_correcciones_3.md #11, redefinida en #4/#5 sin RECHAZADO ni
  // EN_CORRECCION). Nunca se usa para autorización.
  const ESTADOS_VISIBLES_LABEL = {
    CREADO: 'Creado',
    SOLICITANDO_MODIFICACION: 'Solicitando Modificación',
    MODIFICADO: 'Modificado',
    PENDIENTE_CONFIRMACION: 'Pendiente Confirmación',
    CONFIRMADO: 'Confirmado'
  };

  // Roles con sidebar Buzón / Trabajo realizado (Asesor, Supervisor, Técnico,
  // Encargado General/Asistente — analisis_correcciones_5.md #1).
  const ROLES_CON_SIDEBAR = [3, 4, 7, 8, 9];

  const CONTADORES_CONFIG = {
    3: { // Asesor
      buzon: [
        { key: 'valesRestantesHoy', label: 'Vales restantes hoy' },
        { key: 'valesPorRevisar', label: 'Pend. confirmación', filtro: 'valesPorRevisar' },
        { key: 'valesPendientesModificacion', label: 'Solicitando modificación', filtro: 'valesPendientesModificacion' },
        { key: 'valesAtrasados', label: 'Atrasados', alerta: true, filtro: 'valesAtrasados' }
      ],
      trabajo: [
        { key: 'recibidosHoy', label: 'Recibidos hoy', filtro: 'recibidosHoy' },
        { key: 'totalRecibidos', label: 'Total recibidos', filtro: 'totalRecibidos' }
      ]
    },
    4: { // Supervisor
      buzon: [
        { key: 'pendientesConfirmarModificacion', label: 'Por autorizar modificación', filtro: 'pendientesConfirmarModificacion' },
        { key: 'modificados', label: 'Modificados', filtro: 'modificados' },
        { key: 'enCorreccion', label: 'En corrección', filtro: 'enCorreccion' },
        { key: 'pendientesConfirmacion', label: 'Pend. confirmación asesor', filtro: 'pendientesConfirmacion' }
      ],
      trabajo: [
        { key: 'valesRecibidosHoy', label: 'Recibidos hoy', filtro: 'valesRecibidosHoy' },
        { key: 'totalRecibidos', label: 'Total recibidos', filtro: 'totalRecibidos' }
      ]
    },
    5: [ // Encargado de un taller
      { key: 'pendientesAsignacion', label: 'Pend. asignación', filtro: 'pendientesAsignacion' },
      { key: 'pendientesAsignacionAtrasados', label: 'Pend. asignación atrasados', alerta: true, filtro: 'pendientesAsignacionAtrasados' },
      { key: 'asignados', label: 'Asignados', filtro: 'asignados' },
      { key: 'asignadosAtrasados', label: 'Asignados atrasados', alerta: true, filtro: 'asignadosAtrasados' },
      { key: 'enProceso', label: 'En proceso', filtro: 'enProceso' },
      { key: 'enProcesoAtrasados', label: 'En proceso atrasados', alerta: true, filtro: 'enProcesoAtrasados' },
      { key: 'enRevision', label: 'En revisión', filtro: 'enRevision' },
      { key: 'enRevisionAtrasados', label: 'En revisión atrasados', alerta: true, filtro: 'enRevisionAtrasados' },
      { key: 'aprobados', label: 'Aprobados hoy', filtro: 'aprobados' },
      { key: 'aprobadosAtrasados', label: 'Aprobados hoy (atrasados)', alerta: true, filtro: 'aprobadosAtrasados' }
    ],
    7: { // Técnico
      buzon: [
        { key: 'asignados', label: 'Vales asignados', filtro: 'asignados' },
        { key: 'asignadosAtrasados', label: 'Asignados atrasados', alerta: true, filtro: 'asignadosAtrasados' },
        { key: 'modificacionPendiente', label: 'Con modificación', filtro: 'modificacionPendiente' },
        { key: 'modificacionPendienteAtrasados', label: 'Modificación atrasados', alerta: true, filtro: 'modificacionPendienteAtrasados' },
        { key: 'enProceso', label: 'Vale en proceso', esTexto: true }
      ],
      trabajo: [
        { key: 'totalAprobados', label: 'Total aprobados' },
        { key: 'aprobadosHoy', label: 'Aprobados hoy', filtro: 'aprobadosHoy' }
      ]
    },
    8: { // Encargado General
      buzon: [
        { key: 'pendientesFusion', label: 'Vales por fusionar' },
        { key: 'pendientesReenvio', label: 'Pend. reenvío a taller' },
        { key: 'atrasados', label: 'Atrasados', alerta: true, filtro: 'atrasados' }
      ],
      trabajo: [
        { key: 'fusionadosHoy', label: 'Fusionados hoy', filtro: 'fusionadosHoy' },
        { key: 'totalFusionados', label: 'Total fusionados', filtro: 'totalFusionados' }
      ]
    }
  };
  CONTADORES_CONFIG[6] = CONTADORES_CONFIG[5];
  CONTADORES_CONFIG[9] = CONTADORES_CONFIG[8];
  CONTADORES_CONFIG[1] = [ // Administrador: vista de control general
    { key: 'total', label: 'Total vales' },
    { key: 'pendientesConfirmacion', label: 'Pend. confirmación', filtro: 'pendientesConfirmacion' },
    { key: 'aprobadoDepartamento', label: 'Por fusionar', filtro: 'aprobadoDepartamento' },
    { key: 'atrasados', label: 'Atrasados', alerta: true, filtro: 'atrasados' }
  ];

  const state = {
    user: null,
    catalogos: null,
    vales: [],
    contadores: {},
    vista: 'buzon', // solo aplica a roles con sidebar
    ventana: { tipo: 'todo', desde: null, hasta: null },
    filtroContador: null,
    busqueda: '',
    sort: { key: null, dir: null },
    socket: null,
    cargaTrabajoModal: null,
    accionesEnCurso: new Set(),
    paginacion: { limit: 50, offset: 0, total: 0, hasMore: false, cargandoMas: false }
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Iniciales del avatar de cuenta (p. ej. "Asesor Comercial" -> "AC") —
  // misma lógica duplicada en public/js/dashboard.js (no hay un sistema de
  // módulos JS compartidos entre páginas en este proyecto).
  function inicialesAvatar(nombreCompleto) {
    const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return '--';
    const iniciales = palabras.length === 1 ? palabras[0][0] : palabras[0][0] + palabras[1][0];
    return iniciales.toUpperCase();
  }

  function puede(accion) {
    const r = state.user.rolId;
    const admin = r === 1;
    switch (accion) {
      case 'crear': return admin || r === 3;
      case 'asignar': return admin || r === 5 || r === 6;
      case 'revisar': return admin || r === 5 || r === 6;
      case 'trabajar': return admin || r === 7;
      case 'confirmar': return admin || r === 3;
      case 'solicitarModificacion': return admin || r === 3;
      case 'aprobarModificacion': return admin || r === 4;
      case 'aprobarGeneral': return admin || r === 8 || r === 9;
      case 'reenviarModificacion': return admin || r === 8 || r === 9;
      default: return false;
    }
  }

  function usaEstadosVisibles() {
    return state.user.rolId === 3;
  }

  // El estado que corresponde MOSTRAR depende del rol: el asesor ve su versión
  // lógica; encargados y técnicos ven el progreso DENTRO de su taller
  // (v.estado_taller); el resto ve el estado general del vale (v.estado).
  function estadoActivo(v) {
    if (usaEstadosVisibles()) return v.estado_visible;
    if ([5, 6, 7].includes(state.user.rolId)) return v.estado_taller || v.estado;
    return v.estado;
  }

  function claseEstado(v) {
    return `estado-${estadoActivo(v)}`;
  }

  function etiquetaEstado(v) {
    if (usaEstadosVisibles()) return ESTADOS_VISIBLES_LABEL[v.estado_visible] || v.estado_visible;
    const clave = estadoActivo(v);
    return ESTADOS_LABEL[clave] || clave;
  }

  // -------------------------------------------------------------------------
  // Arranque
  // -------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const sessionRes = await fetch('/api/auth.php?action=session_check');
      const sessionData = await sessionRes.json();
      if (!sessionData.autenticado) {
        window.location.href = '/login/?expired=true';
        return;
      }
      state.user = sessionData.user;
      if (!(state.user.modulosPermitidos || []).includes('vales') && state.user.rolId !== 1) {
        window.location.href = '/dashboard/';
        return;
      }
    } catch (error) {
      window.location.href = '/login/?error=conexion';
      return;
    }

    $('#user-display-name').textContent = state.user.nombre;
    $('#user-display-role').textContent = state.user.rolNombre;
    $('#account-dropdown-name').textContent = state.user.nombre;
    $('#account-dropdown-role').textContent = state.user.rolNombre;
    $('#account-avatar').textContent = inicialesAvatar(state.user.nombre);

    // Corrección #9: encargados y técnicos ya trabajan scoped a su propio taller —
    // la columna "Taller" (pensada para el asesor y roles de supervisión) sobra ahí.
    $('.buzon-table').classList.toggle('oculta-taller', [5, 6, 7].includes(state.user.rolId));

    $('#btn-nuevo-vale').style.display = puede('crear') ? 'flex' : 'none';
    // La carga de trabajo es una herramienta de gestión del propio equipo del encargado
    // de UN taller; el Encargado General no tiene técnicos propios y el administrador
    // ya ve todo desde el buzón general, por lo que no aplica en ninguno de los dos.
    $('#btn-carga-trabajo').style.display = (state.user.rolId === 5 || state.user.rolId === 6) ? 'flex' : 'none';

    try {
      const catalogosRes = await fetch('/api/vales/catalogos');
      state.catalogos = await catalogosRes.json();
    } catch (error) {
      state.catalogos = { localidades: [], productos: [], materiales: [], paises: [], talleres: [] };
    }

    wireSidebar();
    wireAccountMenu();
    wireToolbar();
    wireSortHeaders();
    wireScrollInfinito();
    initSocket();

    await cargarBuzon();

    $('#logout-btn').addEventListener('click', async () => {
      await fetch('/api/auth.php?action=logout');
      window.location.href = '/login/';
    });
    $('#btn-nuevo-vale').addEventListener('click', () => abrirModalCrearVale());
    $('#btn-carga-trabajo').addEventListener('click', () => abrirModalCargaTrabajo());
  });

  // Menú desplegable de cuenta (avatar) — abre/cierra con clic, se cierra al
  // hacer clic afuera o con Escape. Mismo patrón que public/js/dashboard.js.
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

  // Sidebar de navegación: colapsable en escritorio (icon-only, se recuerda por
  // usuario vía localStorage) y cajón deslizante superpuesto en móvil.
  // Ancho a compensar en .app-shell (--sidebar-offset, ver global.css) para que
  // el header y el contenido no queden debajo del sidebar fijo. En móvil el
  // propio media query de styles.css lo vuelve a poner en 0 (el sidebar pasa a
  // ser un cajón superpuesto, no algo que empuje el contenido).
  const SIDEBAR_ANCHO = '224px';
  const SIDEBAR_ANCHO_COLAPSADO = '68px';
  function actualizarOffsetSidebar(sidebar) {
    const offset = !ROLES_CON_SIDEBAR.includes(state.user.rolId)
      ? '0px'
      : (sidebar.classList.contains('colapsado') ? SIDEBAR_ANCHO_COLAPSADO : SIDEBAR_ANCHO);
    document.documentElement.style.setProperty('--sidebar-offset', offset);
  }

  function wireSidebar() {
    const sidebar = $('#sidebar-vales');
    const toggleMovil = $('#sidebar-toggle-mobile');
    if (!ROLES_CON_SIDEBAR.includes(state.user.rolId)) {
      sidebar.style.display = 'none';
      actualizarOffsetSidebar(sidebar);
      return;
    }
    sidebar.style.display = 'flex';
    // El botón de menú móvil arranca oculto por HTML (evita el parpadeo antes de
    // saber el rol); se limpia el estilo inline para que la regla CSS
    // (oculto en escritorio, visible <900px) tome el control.
    toggleMovil.style.display = '';

    $$('.sidebar-item', sidebar).forEach(btn => {
      btn.addEventListener('click', () => {
        cerrarSidebarMovil();
        if (btn.dataset.vista === state.vista) return;
        $$('.sidebar-item', sidebar).forEach(b => b.classList.remove('sidebar-item-active'));
        btn.classList.add('sidebar-item-active');
        state.vista = btn.dataset.vista;
        state.sort = { key: null, dir: null };
        state.filtroContador = null; // un filtro de contador es propio de la vista activa
        actualizarIndicadoresOrden();
        $('#buzon-titulo').textContent = state.vista === 'trabajo' ? 'Trabajo Realizado' : 'Buzón de Vales de Arte';
        cargarBuzon();
      });
    });

    // Colapso de escritorio — se recuerda por navegador (conveniencia local,
    // no es una preferencia que deba viajar al servidor).
    const COLAPSO_KEY = 'vales:sidebarColapsado';
    if (localStorage.getItem(COLAPSO_KEY) === '1') {
      sidebar.classList.add('colapsado');
    }
    actualizarOffsetSidebar(sidebar);
    $('#sidebar-collapse-toggle').addEventListener('click', () => {
      const colapsado = sidebar.classList.toggle('colapsado');
      localStorage.setItem(COLAPSO_KEY, colapsado ? '1' : '0');
      actualizarOffsetSidebar(sidebar);
    });

    // Cajón móvil — el botón de menú del header lo abre Y lo cierra (toggle
    // real, ver abrirSidebarMovil/cerrarSidebarMovil); también se cierra
    // tocando el fondo oscuro, con Escape, o al elegir una vista (arriba).
    const backdrop = $('#sidebar-backdrop');
    const iconoToggleMovil = toggleMovil.querySelector('ion-icon');
    toggleMovil.setAttribute('aria-expanded', 'false');
    toggleMovil.addEventListener('click', () => {
      if (sidebar.classList.contains('abierto-movil')) {
        cerrarSidebarMovil();
      } else {
        abrirSidebarMovil();
      }
    });
    backdrop.addEventListener('click', cerrarSidebarMovil);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrarSidebarMovil();
    });

    function abrirSidebarMovil() {
      sidebar.classList.add('abierto-movil');
      backdrop.classList.add('visible');
      toggleMovil.setAttribute('aria-expanded', 'true');
      iconoToggleMovil.setAttribute('name', 'close-outline');
      // Bloquea el scroll del fondo mientras el cajón está abierto — evita
      // que el contenido se desplace detrás del overlay (patrón estándar de
      // drawer/modal) y de paso evita el reflow de la barra de direcciones
      // móvil a media apertura, que es lo que recortaba el sidebar.
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

  function wireToolbar() {
    $$('#ventana-selector .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#ventana-selector .chip').forEach(b => b.classList.remove('chip-active'));
        btn.classList.add('chip-active');
        state.ventana = { tipo: btn.dataset.ventana, desde: null, hasta: null };
        $('#ventana-desde').value = '';
        $('#ventana-hasta').value = '';
        cargarBuzon();
      });
    });
    const onRangoChange = () => {
      const desde = $('#ventana-desde').value || null;
      const hasta = $('#ventana-hasta').value || null;
      if (!desde && !hasta) {
        // Al borrar ambas fechas del rango, vuelve automáticamente a "Todo".
        $$('#ventana-selector .chip').forEach(b => b.classList.remove('chip-active'));
        $('.chip[data-ventana="todo"]').classList.add('chip-active');
        state.ventana = { tipo: 'todo', desde: null, hasta: null };
        cargarBuzon();
        return;
      }
      $$('#ventana-selector .chip').forEach(b => b.classList.remove('chip-active'));
      state.ventana = { tipo: 'rango', desde, hasta };
      cargarBuzon();
    };
    $('#ventana-desde').addEventListener('change', onRangoChange);
    $('#ventana-hasta').addEventListener('change', onRangoChange);
    // Búsqueda contra el servidor (analisis_correcciones_5.md #12) — corre sobre
    // TODOS los vales del buzón, no solo la página ya cargada; debounced para no
    // disparar una petición por cada tecla.
    let debounceBusqueda;
    $('#filtro-texto').addEventListener('input', (e) => {
      clearTimeout(debounceBusqueda);
      const valor = e.target.value.trim();
      debounceBusqueda = setTimeout(() => { state.busqueda = valor; cargarBuzon(); }, 300);
    });
    $('#filtro-estado').addEventListener('change', () => renderTabla());
  }

  function wireSortHeaders() {
    $$('.buzon-table thead th[data-sort-key]').forEach(th => {
      th.innerHTML = `${th.textContent}<span class="sort-arrow">⇅</span>`;
      th.addEventListener('click', () => {
        const key = th.dataset.sortKey;
        if (state.sort.key !== key) {
          state.sort = { key, dir: 'asc' };
        } else if (state.sort.dir === 'asc') {
          state.sort.dir = 'desc';
        } else {
          state.sort = { key: null, dir: null };
        }
        actualizarIndicadoresOrden();
        renderTabla();
      });
    });
  }

  function actualizarIndicadoresOrden() {
    $$('.buzon-table thead th[data-sort-key]').forEach(th => {
      const activo = th.dataset.sortKey === state.sort.key;
      th.classList.toggle('sort-active', activo);
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = activo ? (state.sort.dir === 'asc' ? '▲' : '▼') : '⇅';
    });
  }

  // Cuenta las columnas realmente visibles del <thead> (la de Taller puede estar
  // oculta vía CSS para encargados/técnicos — corrección #9) para que los mensajes
  // de "tabla vacía"/error usen el colspan correcto sin hardcodearlo por rol.
  function columnasVisibles() {
    const todas = $$('.buzon-table thead th');
    const visibles = todas.filter(th => th.offsetParent !== null);
    return visibles.length || todas.length;
  }

  function miTaller() {
    return (state.catalogos.talleres || []).find(t => t.encargado_id === state.user.id) || null;
  }

  function roomsParaUsuario(user) {
    switch (user.rolId) {
      case 1: return ['vales:admin'];
      case 3: return [`asesor:${user.id}`];
      case 4: return ['vales:supervisores'];
      case 5:
      case 6: {
        const taller = miTaller();
        return taller ? [`taller:${taller.id}`] : [];
      }
      case 7: return [`tecnico:${user.id}`];
      case 8:
      case 9: return ['vales:encargado_general'];
      default: return [];
    }
  }

  function initSocket() {
    if (typeof io === 'undefined') return;
    state.socket = io({ query: { userId: state.user.id } });
    state.socket.on('connect', () => {
      state.socket.emit('register_module', roomsParaUsuario(state.user));
    });
    state.socket.on('vale_evento', (data) => {
      const esCreacion = data.tipo === 'creado';
      window.toast.info(
        esCreacion ? 'Nuevo vale de arte' : 'Vale actualizado',
        esCreacion ? data.correlativo : `${data.correlativo} → ${ESTADOS_LABEL[data.estado] || data.estado}`
      );
      reproducirBeep();
      cargarBuzon();
      if (state.cargaTrabajoModal) {
        if (state.cargaTrabajoModal.overlay.isConnected) {
          state.cargaTrabajoModal.actualizar();
        } else {
          state.cargaTrabajoModal = null;
        }
      }
    });
  }

  function reproducirBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* Audio no disponible en este navegador/contexto; no es crítico */ }
  }

  // -------------------------------------------------------------------------
  // Carga y render del buzón (paginado: 50 vales por petición, cargados por
  // scroll infinito; el orden — jerarquía general e individual — ya viene
  // resuelto del backend, la paginación solo recorta esa lista ya ordenada).
  // -------------------------------------------------------------------------
  function construirQueryBase() {
    const qs = new URLSearchParams();
    if (state.ventana.tipo) qs.set('ventana', state.ventana.tipo);
    if (state.ventana.tipo === 'rango') {
      if (state.ventana.desde) qs.set('desde', state.ventana.desde);
      if (state.ventana.hasta) qs.set('hasta', state.ventana.hasta);
    }
    if (ROLES_CON_SIDEBAR.includes(state.user.rolId)) qs.set('vista', state.vista);
    if (state.filtroContador) qs.set('filtroContador', state.filtroContador);
    if (state.busqueda) qs.set('busqueda', state.busqueda);
    return qs;
  }

  async function cargarBuzon() {
    state.paginacion = { limit: 50, offset: 0, total: 0, hasMore: false, cargandoMas: false };
    const qs = construirQueryBase();
    qs.set('offset', '0');

    try {
      const res = await fetch(`/api/vales?${qs.toString()}`);
      if (!res.ok) throw new Error('No se pudo cargar el buzón.');
      const data = await res.json();
      state.vales = data.vales || [];
      state.contadores = data.contadores || {};
      state.paginacion.total = data.total ?? state.vales.length;
      state.paginacion.hasMore = !!data.hasMore;
    } catch (error) {
      $('#buzon-tbody').innerHTML = `<tr><td colspan="${columnasVisibles()}" class="tabla-vacia">Error al cargar el buzón: ${error.message}</td></tr>`;
      return;
    }

    if (puede('crear') && state.vista !== 'trabajo') {
      try {
        const r = await fetch('/api/vales/limite-restante');
        const d = await r.json();
        state.contadores.valesRestantesHoy = d.restantes;
      } catch { /* no bloquea el render del buzón */ }
    }

    renderContadores();
    poblarFiltroEstado();
    renderTabla();
  }

  async function cargarMasVales() {
    if (state.paginacion.cargandoMas || !state.paginacion.hasMore) return;
    state.paginacion.cargandoMas = true;
    const siguienteOffset = state.paginacion.offset + state.paginacion.limit;
    const qs = construirQueryBase();
    qs.set('offset', String(siguienteOffset));

    try {
      const res = await fetch(`/api/vales?${qs.toString()}`);
      if (!res.ok) throw new Error('No se pudo cargar más vales.');
      const data = await res.json();
      state.vales = state.vales.concat(data.vales || []);
      state.paginacion.offset = siguienteOffset;
      state.paginacion.total = data.total ?? state.paginacion.total;
      state.paginacion.hasMore = !!data.hasMore;
      poblarFiltroEstado();
      renderTabla();
    } catch { /* si falla, simplemente no se agregan más filas; el usuario puede reintentar scrolleando */ }
    state.paginacion.cargandoMas = false;
  }

  function wireScrollInfinito() {
    window.addEventListener('scroll', () => {
      if (state.paginacion.cargandoMas || !state.paginacion.hasMore) return;
      const cercaDelFinal = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (cercaDelFinal) cargarMasVales();
    });
  }

  // Corrección #10: cada tarjeta con `filtro` es clickeable para filtrar el buzón por
  // ese criterio (toggle); las propias contadores nunca cambian de valor al activarse
  // (el backend las calcula antes de aplicar el filtro), y no afecta el scroll infinito
  // porque el filtro viaja en la misma querystring que ya usa la paginación.
  function renderContadores() {
    let config = CONTADORES_CONFIG[state.user.rolId] || [];
    if (!Array.isArray(config)) config = config[state.vista] || [];
    const grid = $('#contadores-grid');
    grid.innerHTML = config.map(c => {
      const valor = state.contadores[c.key];
      const mostrado = c.esTexto ? (valor || '—') : (valor ?? 0);
      const alerta = c.alerta && Number(valor) > 0;
      const activo = c.filtro && state.filtroContador === c.filtro;
      const clases = ['contador-card'];
      if (alerta) clases.push('contador-alerta');
      if (c.filtro) clases.push('contador-clickeable');
      if (activo) clases.push('contador-activo');
      return `
        <div class="${clases.join(' ')}" data-filtro="${c.filtro || ''}">
          <div class="valor">${mostrado}</div>
          <div class="etiqueta">${c.label}</div>
        </div>`;
    }).join('');

    $$('.contador-card', grid).forEach(card => {
      const filtro = card.dataset.filtro;
      if (!filtro) return;
      card.addEventListener('click', () => {
        state.filtroContador = state.filtroContador === filtro ? null : filtro;
        cargarBuzon();
      });
    });
  }

  function poblarFiltroEstado() {
    const select = $('#filtro-estado');
    const valorPrevio = select.value;
    const labelMap = usaEstadosVisibles() ? ESTADOS_VISIBLES_LABEL : ESTADOS_LABEL;
    const presentes = [...new Set(state.vales.map(v => estadoActivo(v)))];
    select.innerHTML = '<option value="">Todos los estados</option>' +
      presentes.map(e => `<option value="${e}">${labelMap[e] || e}</option>`).join('');
    if (presentes.includes(valorPrevio)) select.value = valorPrevio;
  }

  function nombreCatalogo(lista, id) {
    if (!state.catalogos || !id) return '-';
    const item = (state.catalogos[lista] || []).find(x => x.id === Number(id));
    return item ? (item.nombre || item.codigo) : '-';
  }

  function aplicarOrdenPersonalizado(lista) {
    if (!state.sort.key || !state.sort.dir) return lista;
    const dir = state.sort.dir === 'asc' ? 1 : -1;
    const valorDe = (v) => {
      switch (state.sort.key) {
        case 'correlativo': return v.correlativo || '';
        case 'fecha_ingreso': return v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`;
        case 'fecha_entrega': return v.fecha_entrega || '';
        case 'fecha_evento': return v.fecha_evento || '';
        default: return '';
      }
    };
    return [...lista].sort((a, b) => {
      const va = valorDe(a), vb = valorDe(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function renderTabla() {
    // El texto ya viene filtrado del servidor (state.busqueda, ver cargarBuzon/
    // construirQueryBase — analisis_correcciones_5.md #12); acá solo queda el
    // filtro de estado, que sí es puramente de la página ya cargada.
    const estadoFiltro = $('#filtro-estado').value;

    let filas = state.vales.filter(v => !estadoFiltro || estadoActivo(v) === estadoFiltro);
    filas = aplicarOrdenPersonalizado(filas);

    const tbody = $('#buzon-tbody');
    if (filas.length === 0) {
      const mensaje = state.busqueda
        ? `No se encontraron vales de arte para «${state.busqueda}».`
        : 'No hay vales de arte para mostrar.';
      tbody.innerHTML = `<tr><td colspan="${columnasVisibles()}" class="tabla-vacia">${mensaje}</td></tr>`;
      return;
    }

    tbody.innerHTML = filas.map(v => `
      <tr>
        <td data-label="Correlativo"><strong>${v.correlativo}</strong>${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}</td>
        <td data-label="Fecha Ingreso">${formatearFechaHora(v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`)}</td>
        <td data-label="Fecha Entrega">${formatearFecha(v.fecha_entrega)}</td>
        <td data-label="Atraso">${v.atrasado ? `<span class="badge badge-atraso">${v.diasAtraso}d</span>` : `<span class="badge badge-ok">Al día</span>`}</td>
        <td data-label="Fecha Evento">${formatearFecha(v.fecha_evento)}</td>
        <td data-label="Taller" class="col-taller">${v.taller || '-'}</td>
        <td data-label="Estado"><span class="estado-pill ${claseEstado(v)}">${etiquetaEstado(v)}</span></td>
        <td data-label="Acciones" class="acciones-cell" data-vale-id="${v.id}"></td>
      </tr>
    `).join('');

    filas.forEach(v => {
      const cell = tbody.querySelector(`.acciones-cell[data-vale-id="${v.id}"]`);
      construirAcciones(v).forEach(accion => {
        const btn = document.createElement('button');
        btn.className = `btn-icon ${accion.clase || ''}`;
        btn.title = accion.titulo;
        btn.innerHTML = `<ion-icon name="${accion.icono}"></ion-icon>`;
        btn.addEventListener('click', () => {
          if (state.accionesEnCurso.has(v.id)) return;
          state.accionesEnCurso.add(v.id);
          Promise.resolve(accion.onClick(v)).finally(() => state.accionesEnCurso.delete(v.id));
        });
        cell.appendChild(btn);
      });
    });
  }

  // Fechas siempre dd/mm/aaaa; solo la fecha de ingreso (y los logs de historial)
  // muestran también la hora, como dd/mm/aaaa hh:mm.
  function formatearFecha(valor) {
    if (!valor) return '-';
    const [f] = String(valor).split(/[ T]/);
    const [y, m, d] = f.split('-');
    if (!y || !m || !d) return String(valor);
    return `${d}/${m}/${y}`;
  }

  function formatearFechaHora(valor) {
    if (!valor) return '-';
    const [f, h] = String(valor).replace('T', ' ').split(' ');
    const [y, m, d] = f.split('-');
    if (!y || !m || !d) return String(valor);
    const hm = (h || '').slice(0, 5);
    return `${d}/${m}/${y}${hm ? ' ' + hm : ''}`;
  }

  function construirAcciones(v) {
    // El supervisor abre un modal de elección (Ver info / Ver vale) en vez de ir
    // directo al PDF — a veces solo necesita los datos de encabezado
    // (analisis_correcciones_5.md #7).
    const acciones = state.user.rolId === 4
      ? [{ icono: 'eye-outline', titulo: 'Ver', onClick: abrirModalVerSupervisor }]
      : [{ icono: 'eye-outline', titulo: 'Ver vale de arte (PDF)', onClick: () => window.open(`/api/vales/${v.id}/pdf`, '_blank') }];
    // Corrección #1/#6: el hipervínculo de la propuesta ya no apunta al vale (PDF) sino
    // al documento de propuesta real — disponible tanto en el buzón (trabajo realizado)
    // como en cualquier vista donde ya exista una propuesta oficial para el vale. El
    // supervisor también la necesita en Trabajo realizado (analisis_correcciones_5.md #2).
    if ((usaEstadosVisibles() || state.user.rolId === 4) && v.propuesta_general_url) {
      acciones.push({ icono: 'document-attach-outline', titulo: 'Ver propuesta', onClick: () => window.open(`/${v.propuesta_general_url}`, '_blank') });
    }

    if (puede('asignar') && v.estado_taller === 'PENDIENTE_ASIGNACION') {
      acciones.push({ icono: 'person-add-outline', titulo: 'Asignar a técnico', onClick: abrirModalAsignar });
    }
    if (puede('revisar') && v.estado_taller === 'EN_REVISION') {
      acciones.push({ icono: 'clipboard-outline', titulo: 'Revisar propuesta', onClick: abrirModalRevisar });
    }
    if (puede('trabajar') && v.estado_taller === 'ASIGNADO') {
      acciones.push({ icono: 'play-outline', titulo: 'Comenzar', clase: 'icon-success', onClick: accionComenzar });
    }
    if (puede('trabajar') && v.estado_taller === 'EN_PROCESO') {
      acciones.push({ icono: 'checkmark-done-outline', titulo: 'Entregar propuesta', clase: 'icon-success', onClick: abrirModalEntregar });
      acciones.push({ icono: 'close-outline', titulo: 'Cancelar proceso', clase: 'icon-danger', onClick: accionCancelarProceso });
    }
    if (puede('aprobarGeneral') && v.estado === 'APROBADO_DEPARTAMENTO') {
      acciones.push({ icono: 'checkmark-done-circle-outline', titulo: 'Aprobar y fusionar', clase: 'icon-success', onClick: abrirModalAprobarGeneral });
    }
    // Vale MODIFICADO recién aprobado, todavía sin taller — el Encargado General
    // decide a cuál va (analisis_correcciones_5.md #6).
    if (puede('reenviarModificacion') && v.estado === 'MODIFICADO' && (v._filasTaller || []).length === 0) {
      acciones.push({ icono: 'send-outline', titulo: 'Reenviar a taller', clase: 'icon-success', onClick: abrirModalReenviarModificacion });
    }
    if (puede('confirmar') && v.estado === 'PENDIENTE_CONFIRMACION') {
      acciones.push({ icono: 'document-text-outline', titulo: 'Confirmar o solicitar modificación', clase: 'icon-success', onClick: abrirModalDecisionAsesor });
    }
    if (puede('solicitarModificacion') && v.estado === 'RECIBIDO' && !Number(v.modificado)) {
      acciones.push({ icono: 'create-outline', titulo: 'Solicitar modificación', onClick: abrirModalSolicitarModificacion });
    }
    if (puede('aprobarModificacion') && v.estado === 'SOLICITANDO_MODIFICACION') {
      acciones.push({ icono: 'checkmark-circle-outline', titulo: 'Aprobar modificación', clase: 'icon-success', onClick: abrirModalAprobarModificacion });
    }
    acciones.push({ icono: 'time-outline', titulo: 'Ver historial', onClick: abrirModalHistorial });

    return acciones;
  }

  // -------------------------------------------------------------------------
  // Modales genéricos
  // -------------------------------------------------------------------------
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
    // Cerrar con Escape mientras este modal esté abierto (antes ningún modal lo
    // tenía). El listener se quita al cerrar para no dejar huérfanos con modales
    // anidados (analisis_correcciones_5.md #10).
    const onKeydown = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKeydown);
    const cerrar = () => {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
    };
    overlay.querySelector('.modal-close').addEventListener('click', cerrar);
    // Cerrar solo si el click EMPEZÓ (mousedown) y TERMINÓ (click) sobre el propio
    // backdrop: un `click` del DOM se dispara sobre el ancestro común de mousedown y
    // mouseup, así que arrastrar una selección de texto desde un campo del formulario
    // hasta soltar fuera del modal cerraba el modal aunque el arrastre haya empezado
    // adentro (analisis_correcciones_5.md #10).
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

  // -------------------------------------------------------------------------
  // Selector de tags de talleres (corrección #4) — compartido entre el
  // formulario de creación y el de solicitud de modificación.
  // -------------------------------------------------------------------------
  function htmlSelectorTalleres(seleccionadosIniciales) {
    const opciones = (state.catalogos.talleres || [])
      .map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
    return `
      <div class="form-field full">
        <label>Talleres *</label>
        <div class="taller-tags"></div>
        <select class="select-agregar-taller">
          <option value="">+ Agregar taller...</option>
          ${opciones}
        </select>
      </div>
    `;
  }

  function wireSelectorTalleres(overlay, seleccionados) {
    const container = overlay.querySelector('.taller-tags');
    const select = overlay.querySelector('.select-agregar-taller');
    const render = () => {
      container.innerHTML = [...seleccionados].map(id => {
        const t = (state.catalogos.talleres || []).find(x => x.id === id);
        return `<span class="taller-tag" data-taller-id="${id}">${t ? t.nombre : id}<button type="button" class="taller-tag-quitar" data-taller-id="${id}">&times;</button></span>`;
      }).join('') || '<span class="taller-tags-vacio">Ningún taller seleccionado</span>';
    };
    render();
    select.addEventListener('change', () => {
      const id = Number(select.value);
      if (id) { seleccionados.add(id); render(); }
      select.value = '';
    });
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.taller-tag-quitar');
      if (!btn) return;
      seleccionados.delete(Number(btn.dataset.tallerId));
      render();
    });
  }

  // Corrección #3: si la entrega queda a menos de 3 días, "Urgente" se marca
  // solo y no se puede desmarcar; con más margen, el asesor decide libremente.
  function wireUrgenteAutoLock(overlay) {
    const fechaInput = overlay.querySelector('[name="fechaEntrega"]');
    const checkbox = overlay.querySelector('[name="urgente"]');
    const actualizar = () => {
      if (!fechaInput.value) return;
      const diffDias = (new Date(fechaInput.value) - new Date()) / (1000 * 60 * 60 * 24);
      if (diffDias < 3) {
        checkbox.checked = true;
        checkbox.disabled = true;
      } else {
        checkbox.disabled = false;
      }
    };
    // El picker nativo de datetime-local no se cierra solo al elegir una fecha —
    // .blur() en `change` es el truco estándar en Chromium (analisis_correcciones_5.md #11).
    fechaInput.addEventListener('change', () => { actualizar(); fechaInput.blur(); });
    actualizar();

    const fechaEventoInput = overlay.querySelector('[name="fechaEvento"]');
    if (fechaEventoInput) {
      fechaEventoInput.addEventListener('change', () => fechaEventoInput.blur());
    }
  }

  // -------------------------------------------------------------------------
  // Modal: Crear vale de arte
  // -------------------------------------------------------------------------
  function opcionesSelect(lista, campo = 'nombre') {
    return (state.catalogos[lista] || []).map(item => `<option value="${item.id}">${item[campo] || item.nombre}</option>`).join('');
  }

  function opcionesPaises() {
    return (state.catalogos.paises || []).map(p =>
      `<option value="${p.codigo_telefono}" ${p.codigo === 'GT' ? 'selected' : ''}>${p.codigo_telefono} ${p.codigo}</option>`
    ).join('');
  }

  // Input de archivos con lista removible — un input <input type=file multiple>
  // nativo no permite quitar un archivo individual de su propio .files, así que se
  // mantiene un array propio en JS y se usa ESE array al armar el FormData del envío
  // en vez de depender del input directamente (analisis_correcciones_5.md #9).
  function wireInputArchivosRemovibles(overlay, inputSelector, listaSelector) {
    const input = overlay.querySelector(inputSelector);
    const lista = overlay.querySelector(listaSelector);
    let archivos = [];
    const render = () => {
      lista.innerHTML = archivos.map((f, i) => `
        <span class="archivo-chip">${f.name}<button type="button" class="archivo-chip-quitar" data-idx="${i}" title="Quitar">&times;</button></span>
      `).join('');
    };
    input.addEventListener('change', () => {
      archivos = archivos.concat(Array.from(input.files));
      input.value = ''; // la lista real vive en `archivos`, no en el input nativo
      render();
    });
    lista.addEventListener('click', (e) => {
      const btn = e.target.closest('.archivo-chip-quitar');
      if (!btn) return;
      archivos.splice(Number(btn.dataset.idx), 1);
      render();
    });
    return () => archivos;
  }

  function abrirModalCrearVale() {
    const tallerSeleccionados = new Set();
    const { overlay, cerrar } = abrirModal({
      title: 'Crear Vale de Arte',
      size: 'lg',
      bodyHtml: `
        <form id="form-crear-vale">
          <div class="section-title">Información de Cliente</div>
          <div class="form-grid">
            <div class="form-field"><label>Empresa</label><input type="text" name="clienteEmpresa" /></div>
            <div class="form-field"><label>Cliente *</label><input type="text" name="clienteNombre" required /></div>
            <div class="form-field">
              <label>Teléfono *</label>
              <div class="form-field-phone">
                <select name="clienteTelefonoPais">${opcionesPaises()}</select>
                <input type="text" name="clienteTelefono" required placeholder="0000-0000" />
              </div>
            </div>
            <div class="form-field"><label>Correo *</label><input type="email" name="clienteCorreo" required /></div>
          </div>

          <div class="section-title">Información de Taller</div>
          <div class="form-grid">
            ${htmlSelectorTalleres()}
          </div>

          <div class="section-title">Información de Venta</div>
          <div class="form-grid">
            <div class="form-field"><label>Fecha de entrega *</label><input type="datetime-local" name="fechaEntrega" required /></div>
            <div class="form-field"><label>Fecha del evento *</label><input type="datetime-local" name="fechaEvento" required /></div>
            <div class="form-field"><label>Código de producto *</label><select name="productoId" required>${opcionesSelect('productos')}</select></div>
            <div class="form-field"><label>Material *</label><select name="materialId" required>${opcionesSelect('materiales')}</select></div>
            <div class="form-field"><label>Técnica</label><input type="text" name="tecnica" /></div>
            <div class="form-field"><label>Acabado</label><input type="text" name="acabado" /></div>
            <div class="form-field"><label>Cantidad * (mayor a 1)</label><input type="number" name="cantidad" min="2" required /></div>
            <div class="form-field"><label>Cotización (Q) *</label><input type="number" name="cotizacion" min="0.01" step="0.01" required /></div>
            <div class="form-field form-checkbox full"><input type="checkbox" name="urgente" id="chk-urgente" /><label for="chk-urgente">Urgente</label></div>
          </div>

          <div class="section-title">Boceto y Descripción</div>
          <div class="form-grid">
            <div class="form-field full"><label>Descripción (máx. 600 caracteres)</label><textarea name="descripcion" maxlength="600"></textarea></div>
            <div class="form-field">
              <label>Imágenes (jpg, jpeg, png, webp — máx. 2MB c/u)</label>
              <input type="file" name="imagenes" accept="image/jpeg,image/png,image/webp" multiple />
              <div class="archivo-lista"></div>
            </div>
            <div class="form-field">
              <label>Documentos adjuntos (PDF — máx. 3MB c/u)</label>
              <input type="file" name="documentos" accept="application/pdf" multiple />
              <div class="archivo-lista"></div>
            </div>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn--ghost" id="btn-cancelar-crear">Cancelar</button>
        <button class="btn btn--primary" id="btn-guardar-crear">Crear Vale de Arte</button>
      `
    });

    wireSelectorTalleres(overlay, tallerSeleccionados);
    wireUrgenteAutoLock(overlay);
    const getImagenes = wireInputArchivosRemovibles(overlay, '[name="imagenes"]', '.form-field:has([name="imagenes"]) .archivo-lista');
    const getDocumentos = wireInputArchivosRemovibles(overlay, '[name="documentos"]', '.form-field:has([name="documentos"]) .archivo-lista');

    overlay.querySelector('#btn-cancelar-crear').addEventListener('click', cerrar);
    overlay.querySelector('#btn-guardar-crear').addEventListener('click', () => {
      const form = overlay.querySelector('#form-crear-vale');
      if (!form.reportValidity()) return;
      if (tallerSeleccionados.size === 0) {
        mostrarErrorModal(overlay, 'Debe seleccionar al menos un taller.');
        return;
      }
      const formData = new FormData(form);
      formData.set('urgente', form.querySelector('[name="urgente"]').checked ? 'true' : 'false');
      const paisCodigo = form.querySelector('[name="clienteTelefonoPais"]').value;
      const telefonoNum = form.querySelector('[name="clienteTelefono"]').value.trim();
      formData.set('clienteTelefono', `${paisCodigo} ${telefonoNum}`);
      formData.delete('clienteTelefonoPais');
      formData.set('talleresIds', JSON.stringify([...tallerSeleccionados]));
      // Las imágenes/documentos reales viven en los arrays de wireInputArchivosRemovibles
      // (el usuario pudo quitar alguno con la "×"), no en el input nativo.
      formData.delete('imagenes');
      formData.delete('documentos');
      getImagenes().forEach(f => formData.append('imagenes', f));
      getDocumentos().forEach(f => formData.append('documentos', f));

      // Corrección #4: antes de crear el vale de verdad, se confirma con un modal
      // resumen (el modal de creación queda debajo, intacto, por si se cancela).
      abrirModalConfirmarCreacion(formData);
    });
  }

  function abrirModalConfirmarCreacion(formData) {
    const nombresTalleres = JSON.parse(formData.get('talleresIds') || '[]')
      .map(id => ((state.catalogos.talleres || []).find(t => t.id === id) || {}).nombre || id)
      .join(', ');
    const { overlay, cerrar } = abrirModal({
      title: 'Confirmar creación de Vale de Arte',
      bodyHtml: `
        <p style="font-size:13px;margin-bottom:10px;">Vas a crear un vale de arte con los siguientes datos:</p>
        <ul class="historial-list">
          <li><strong>Cliente:</strong> ${formData.get('clienteNombre')}</li>
          <li><strong>Talleres:</strong> ${nombresTalleres}</li>
          <li><strong>Cantidad:</strong> ${formData.get('cantidad')}</li>
          <li><strong>Cotización:</strong> Q${formData.get('cotizacion')}</li>
          <li><strong>Urgente:</strong> ${formData.get('urgente') === 'true' ? 'Sí' : 'No'}</li>
        </ul>
      `,
      footerHtml: `
        <button class="btn btn--ghost" id="btn-volver">Volver</button>
        <button class="btn btn--primary" id="btn-confirmar-crear">Confirmar y Crear</button>
      `
    });
    overlay.querySelector('#btn-volver').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar-crear').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-confirmar-crear');
      btn.disabled = true;
      btn.classList.add('btn--loading');
      try {
        const res = await fetch('/api/vales', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo crear el vale de arte.');
        window.toast.success('Vale de arte creado', `${data.correlativo} se creó correctamente.`);
        cerrar();
        // El modal de creación original sigue debajo — se cierra también.
        $$('.modal-overlay').forEach(o => o.remove());
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
        btn.classList.remove('btn--loading');
      }
    });
  }

  // -------------------------------------------------------------------------
  // Modal: Asignar a técnico
  // -------------------------------------------------------------------------
  async function abrirModalAsignar(vale) {
    let tecnicos = [];
    try {
      const res = await fetch('/api/vales/tecnicos');
      tecnicos = await res.json();
    } catch { /* se muestra select vacío si falla */ }

    const { overlay, cerrar } = abrirModal({
      title: `Asignar ${vale.correlativo}`,
      bodyHtml: `
        <div class="form-field">
          <label>Técnico a cargo</label>
          <select id="select-tecnico">
            ${tecnicos.length ? tecnicos.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('') : '<option value="">No hay técnicos bajo su mando</option>'}
          </select>
        </div>
      `,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Asignar</button>`
    });

    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
      const tecnicoId = overlay.querySelector('#select-tecnico').value;
      if (!tecnicoId) return;
      const btn = overlay.querySelector('#btn-confirmar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/asignar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tecnicoId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Vale asignado', `${vale.correlativo} se asignó correctamente.`);
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Modal: Revisar propuesta (encargado de taller)
  // -------------------------------------------------------------------------
  async function abrirModalRevisar(vale) {
    let detalle;
    try {
      detalle = await (await fetch(`/api/vales/${vale.id}`)).json();
    } catch {
      detalle = { propuestas: [] };
    }
    const ultima = (detalle.propuestas || [])[detalle.propuestas.length - 1];
    let tecnicos = [];
    try {
      tecnicos = await (await fetch('/api/vales/tecnicos')).json();
    } catch { /* select se mostrará vacío */ }

    const { overlay, cerrar } = abrirModal({
      title: `Revisar propuesta — ${vale.correlativo}`,
      bodyHtml: `
        <p style="margin-bottom:14px;font-size:13px;">
          ${ultima && ultima.es_cancelacion
            ? 'El técnico canceló el proceso y entregó una propuesta en blanco.'
            : (ultima && ultima.url
                ? `<a href="/${ultima.url}" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver propuesta adjunta</a>`
                : 'El técnico no adjuntó documento de propuesta (no se puede aprobar en blanco).')}
        </p>
        <div class="form-field">
          <label>Reasignar a (solo si desaprueba)</label>
          <select id="select-tecnico-reasignar">
            ${tecnicos.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('')}
          </select>
        </div>
      `,
      footerHtml: `
        <button class="btn btn--danger" id="btn-desaprobar">Desaprobar y reasignar</button>
        <button class="btn btn--primary" id="btn-aprobar">Aprobar</button>
      `
    });

    overlay.querySelector('#btn-aprobar').addEventListener('click', () => enviarRevision(true));
    overlay.querySelector('#btn-desaprobar').addEventListener('click', () => enviarRevision(false));

    async function enviarRevision(aprobar) {
      const tecnicoReasignadoId = overlay.querySelector('#select-tecnico-reasignar').value;
      try {
        const res = await fetch(`/api/vales/${vale.id}/revisar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aprobar, tecnicoReasignadoId: aprobar ? null : tecnicoReasignadoId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success(aprobar ? 'Propuesta aprobada' : 'Vale reasignado', `${vale.correlativo} ${aprobar ? 'aprobado' : 'reasignado'} correctamente.`);
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Técnico: comenzar / entregar / cancelar
  // -------------------------------------------------------------------------
  async function accionComenzar(vale) {
    try {
      const res = await fetch(`/api/vales/${vale.id}/comenzar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.toast.success('En proceso', `${vale.correlativo} marcado como en proceso.`);
      cargarBuzon();
    } catch (error) {
      window.toast.error('No se pudo actualizar', error.message);
    }
  }

  function abrirModalEntregar(vale) {
    const { overlay, cerrar } = abrirModal({
      title: `Entregar propuesta — ${vale.correlativo}`,
      bodyHtml: `
        <div class="form-field">
          <label>Documento de propuesta (PDF, opcional)</label>
          <input type="file" id="input-propuesta" accept="application/pdf" />
        </div>
      `,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-enviar">Entregar</button>`
    });
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-enviar').addEventListener('click', async () => {
      const file = overlay.querySelector('#input-propuesta').files[0];
      const formData = new FormData();
      if (file) formData.append('propuesta', file);
      const btn = overlay.querySelector('#btn-enviar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/entregar`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Propuesta entregada', `Propuesta de ${vale.correlativo} entregada.`);
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  async function accionCancelarProceso(vale) {
    if (!confirm(`¿Cancelar el proceso del vale ${vale.correlativo}? Se notificará al encargado.`)) return;
    try {
      const res = await fetch(`/api/vales/${vale.id}/cancelar-proceso`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.toast.success('Proceso cancelado', `Proceso de ${vale.correlativo} cancelado.`);
      cargarBuzon();
    } catch (error) {
      window.toast.error('No se pudo cancelar', error.message);
    }
  }

  // -------------------------------------------------------------------------
  // Encargado General: aprobar y fusionar un vale multi-taller
  // -------------------------------------------------------------------------
  // Encargado General: la fusión NO la hace el sistema — el propio encargado revisa la
  // propuesta de cada taller (analisis_correcciones_4.md #10) y adjunta manualmente su
  // documento final ya fusionado antes de aprobar (#11), sea un vale multi-taller o uno
  // que cayó aquí por haber sido rechazado por el asesor.
  async function abrirModalAprobarGeneral(vale) {
    let detalle;
    try {
      detalle = await (await fetch(`/api/vales/${vale.id}`)).json();
    } catch {
      detalle = { talleres: [], propuestas: [] };
    }
    const filasPropuesta = (detalle.talleres || []).map(t => {
      const delTecnico = (detalle.propuestas || []).filter(p => p.tecnico_id === t.tecnico_id);
      const ultima = delTecnico[delTecnico.length - 1];
      const url = ultima && !ultima.es_cancelacion ? ultima.url : null;
      return `<li><strong>${t.taller_nombre}:</strong> ${url ? `<a href="/${url}" target="_blank">Ver propuesta</a>` : 'Sin propuesta'}</li>`;
    }).join('');

    const { overlay, cerrar } = abrirModal({
      title: `Aprobar y fusionar — ${vale.correlativo}`,
      bodyHtml: `
        <p style="font-size:13px;margin-bottom:10px;">Revisa la propuesta de cada taller y adjunta el documento final ya fusionado por ti.</p>
        <ul class="historial-list" style="margin-bottom:14px;">${filasPropuesta || '<li>Este vale no tiene talleres asociados.</li>'}</ul>
        <div class="form-field">
          <label>Documento de fusión final (PDF) *</label>
          <input type="file" id="input-fusion" accept="application/pdf" required />
        </div>
      `,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Aprobar y Fusionar</button>`
    });
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
      const file = overlay.querySelector('#input-fusion').files[0];
      if (!file) {
        mostrarErrorModal(overlay, 'Debe adjuntar el documento de fusión final.');
        return;
      }
      const formData = new FormData();
      formData.append('fusion', file);
      const btn = overlay.querySelector('#btn-confirmar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/aprobar-general`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Vale fusionado', `${vale.correlativo} fusionado y aprobado correctamente.`);
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Asesor: decidir sobre un vale PENDIENTE_CONFIRMACION (confirmar / rechazar / corregir)
  // -------------------------------------------------------------------------
  // Rechazar YA NO es una acción separada de "solicitar corrección" (analisis_correcciones_4.md
  // #2): un solo botón "Rechazar" pide el motivo y manda el vale a corrección — cae al buzón
  // del Encargado General, nunca queda como un estado "Rechazado" persistido (#3).
  function abrirModalDecisionAsesor(vale) {
    const { overlay, cerrar } = abrirModal({
      title: `Vale pendiente de confirmación — ${vale.correlativo}`,
      bodyHtml: `
        <p style="font-size:13px;margin-bottom:14px;">Revisa el vale de arte final y decide qué hacer.</p>
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          <a href="/api/vales/${vale.id}/pdf" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver vale de arte (PDF)</a>
          ${vale.propuesta_general_url ? `<a href="/${vale.propuesta_general_url}" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver propuesta</a>` : ''}
        </div>
      `,
      footerHtml: `
        <button class="btn btn--danger" id="btn-solicitar-modificacion">Solicitar Modificación</button>
        <button class="btn btn--primary" id="btn-confirmar-recibido">Confirmar Recibido</button>
      `
    });

    overlay.querySelector('#btn-confirmar-recibido').addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/vales/${vale.id}/confirmar`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Venta confirmada', `${vale.correlativo} confirmado como recibido.`);
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
      }
    });

    // Ya no existe una accion separada de "rechazar" (analisis_correcciones_5.md #5):
    // este boton simplemente reusa el modal completo de solicitar modificacion, que
    // ya sabe pedir la justificacion y talleres y llamar al endpoint correspondiente.
    overlay.querySelector('#btn-solicitar-modificacion').addEventListener('click', () => {
      cerrar();
      abrirModalSolicitarModificacion(vale);
    });
  }

  // -------------------------------------------------------------------------
  // Asesor: solicitar modificación (mismo formulario de creación, precargado;
  // boceto y descripción quedan en blanco — analisis_correcciones_3.md)
  // -------------------------------------------------------------------------
  async function abrirModalSolicitarModificacion(vale) {
    let detalle;
    try {
      detalle = await (await fetch(`/api/vales/${vale.id}`)).json();
    } catch {
      detalle = { talleres: [] };
    }
    const tallerSeleccionados = new Set((detalle.talleres || []).map(t => t.taller_id));
    const [paisCodigoActual, ...resto] = (vale.cliente_telefono || '').split(' ');
    const telefonoActual = resto.join(' ');

    const { overlay, cerrar } = abrirModal({
      title: `Solicitar modificación — ${vale.correlativo}`,
      size: 'lg',
      bodyHtml: `
        <form id="form-modificacion">
          <div class="section-title">Información de Cliente</div>
          <div class="form-grid">
            <div class="form-field"><label>Empresa</label><input type="text" name="clienteEmpresa" value="${vale.cliente_empresa || ''}" /></div>
            <div class="form-field"><label>Cliente *</label><input type="text" name="clienteNombre" value="${vale.cliente_nombre || ''}" required /></div>
            <div class="form-field">
              <label>Teléfono *</label>
              <div class="form-field-phone">
                <select name="clienteTelefonoPais">${opcionesPaises()}</select>
                <input type="text" name="clienteTelefono" value="${telefonoActual}" required placeholder="0000-0000" />
              </div>
            </div>
            <div class="form-field"><label>Correo *</label><input type="email" name="clienteCorreo" value="${vale.cliente_correo || ''}" required /></div>
          </div>

          <div class="section-title">Información de Taller</div>
          <div class="form-grid">
            ${htmlSelectorTalleres()}
          </div>

          <div class="section-title">Información de Venta</div>
          <div class="form-grid">
            <div class="form-field"><label>Fecha de entrega *</label><input type="datetime-local" name="fechaEntrega" required /></div>
            <div class="form-field"><label>Fecha del evento *</label><input type="datetime-local" name="fechaEvento" required /></div>
            <div class="form-field"><label>Código de producto *</label><select name="productoId" required>${opcionesSelect('productos')}</select></div>
            <div class="form-field"><label>Material *</label><select name="materialId" required>${opcionesSelect('materiales')}</select></div>
            <div class="form-field"><label>Técnica</label><input type="text" name="tecnica" value="${vale.tecnica || ''}" /></div>
            <div class="form-field"><label>Acabado</label><input type="text" name="acabado" value="${vale.acabado || ''}" /></div>
            <div class="form-field"><label>Cantidad * (mayor a 1)</label><input type="number" name="cantidad" min="2" value="${vale.cantidad || ''}" required /></div>
            <div class="form-field"><label>Cotización (Q) *</label><input type="number" name="cotizacion" min="0.01" step="0.01" value="${vale.cotizacion || ''}" required /></div>
            <div class="form-field form-checkbox full"><input type="checkbox" name="urgente" id="chk-urgente-mod" /><label for="chk-urgente-mod">Urgente</label></div>
          </div>

          <div class="form-field full">
            <label>Justificación de la modificación *</label>
            <textarea name="justificacion" required></textarea>
          </div>
        </form>
      `,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-enviar">Solicitar Modificación</button>`
    });

    wireSelectorTalleres(overlay, tallerSeleccionados);
    wireUrgenteAutoLock(overlay);
    if (paisCodigoActual) overlay.querySelector('[name="clienteTelefonoPais"]').value = paisCodigoActual;
    overlay.querySelector('[name="productoId"]').value = vale.producto_id || '';
    overlay.querySelector('[name="materialId"]').value = vale.material_id || '';

    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-enviar').addEventListener('click', async () => {
      const form = overlay.querySelector('#form-modificacion');
      if (!form.reportValidity()) return;
      if (tallerSeleccionados.size === 0) {
        mostrarErrorModal(overlay, 'Debe seleccionar al menos un taller.');
        return;
      }
      const fd = new FormData(form);
      const paisCodigo = fd.get('clienteTelefonoPais');
      const telefonoNum = (fd.get('clienteTelefono') || '').trim();
      const payload = {
        clienteEmpresa: fd.get('clienteEmpresa'),
        clienteNombre: fd.get('clienteNombre'),
        clienteTelefono: `${paisCodigo} ${telefonoNum}`,
        clienteCorreo: fd.get('clienteCorreo'),
        fechaEntrega: fd.get('fechaEntrega'),
        fechaEvento: fd.get('fechaEvento'),
        urgente: form.querySelector('[name="urgente"]').checked,
        productoId: fd.get('productoId'),
        materialId: fd.get('materialId'),
        tecnica: fd.get('tecnica'),
        acabado: fd.get('acabado'),
        cantidad: fd.get('cantidad'),
        cotizacion: fd.get('cotizacion'),
        talleresIds: JSON.stringify([...tallerSeleccionados]),
        justificacion: fd.get('justificacion')
      };
      const btn = overlay.querySelector('#btn-enviar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/solicitar-modificacion`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Modificación solicitada', `Modificación solicitada para ${vale.correlativo}.`);
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Supervisor: aprobar modificación (crea el vale MOD- nuevo)
  // -------------------------------------------------------------------------
  async function abrirModalAprobarModificacion(vale) {
    // El supervisor necesita ver la justificación para decidir (analisis_correcciones_5.md #3).
    let detalle;
    try {
      detalle = await (await fetch(`/api/vales/${vale.id}`)).json();
    } catch {
      detalle = { solicitudModificacion: null };
    }
    const justificacion = detalle.solicitudModificacion && detalle.solicitudModificacion.justificacion;

    const { overlay, cerrar } = abrirModal({
      title: `Autorizar modificación — ${vale.correlativo}`,
      bodyHtml: `
        <div class="form-field full" style="margin-bottom:14px;">
          <label>Justificación de la modificación</label>
          <p style="font-size:13px;white-space:pre-wrap;">${justificacion || 'Sin justificación registrada.'}</p>
        </div>
        <p style="font-size:13px;">¿Confirmas autorizar la modificación solicitada para este vale de arte? Se creará un vale de arte nuevo con el prefijo MOD-, que quedará en el buzón del Encargado General para que decida a qué taller enviarlo.</p>
      `,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Autorizar</button>`
    });
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-confirmar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/aprobar-modificacion`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Modificación autorizada', `Se creó el vale ${data.correlativo}.`);
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Encargado General: reenviar un vale MODIFICADO al taller correcto, viendo la
  // justificación (analisis_correcciones_5.md #6) — reusa el mismo selector de
  // talleres de creación/solicitud de modificación.
  // -------------------------------------------------------------------------
  async function abrirModalReenviarModificacion(vale) {
    let detalle;
    try {
      detalle = await (await fetch(`/api/vales/${vale.id}`)).json();
    } catch {
      detalle = { descripcion: '' };
    }
    const tallerSeleccionados = new Set();
    const { overlay, cerrar } = abrirModal({
      title: `Reenviar modificación — ${vale.correlativo}`,
      bodyHtml: `
        <div class="form-field full" style="margin-bottom:14px;">
          <label>Justificación de la modificación</label>
          <p style="font-size:13px;white-space:pre-wrap;">${detalle.descripcion || 'Sin justificación registrada.'}</p>
        </div>
        <p style="font-size:13px;margin-bottom:10px;">Elige el/los taller(es) al que debe ir este vale de arte modificado.</p>
        <div class="form-grid">
          ${htmlSelectorTalleres()}
        </div>
      `,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Reenviar</button>`
    });
    wireSelectorTalleres(overlay, tallerSeleccionados);
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
      if (tallerSeleccionados.size === 0) {
        mostrarErrorModal(overlay, 'Debe seleccionar al menos un taller.');
        return;
      }
      const btn = overlay.querySelector('#btn-confirmar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/reenviar-modificacion`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ talleresIds: [...tallerSeleccionados] })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Vale reenviado', `${vale.correlativo} se envió al taller seleccionado.`);
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Supervisor: "Ver" abre a elegir entre info de encabezado o el PDF completo
  // (analisis_correcciones_5.md #7) — a veces solo hace falta lo primero.
  // -------------------------------------------------------------------------
  function abrirModalVerSupervisor(v) {
    const { overlay, cerrar } = abrirModal({
      title: `Ver vale de arte — ${v.correlativo}`,
      bodyHtml: `<p style="font-size:13px;">¿Qué necesitas ver?</p>`,
      footerHtml: `
        <button class="btn btn--ghost" id="btn-ver-info">Ver info</button>
        <button class="btn btn--primary" id="btn-ver-pdf">Ver vale</button>
      `
    });
    overlay.querySelector('#btn-ver-pdf').addEventListener('click', () => {
      window.open(`/api/vales/${v.id}/pdf`, '_blank');
      cerrar();
    });
    overlay.querySelector('#btn-ver-info').addEventListener('click', () => {
      cerrar();
      abrirModalInfoVale(v);
    });
  }

  function abrirModalInfoVale(v) {
    const campo = (etiqueta, valor) => `
      <div class="form-field"><label>${etiqueta}</label><p style="font-size:13px;margin:0;">${valor || '-'}</p></div>
    `;
    const { overlay, cerrar } = abrirModal({
      title: `Información — ${v.correlativo}`,
      size: 'lg',
      bodyHtml: `
        <div class="form-grid">
          ${campo('Correlativo', v.correlativo)}
          ${campo('Estado', etiquetaEstado(v))}
          ${campo('Cliente', v.cliente_nombre)}
          ${campo('Empresa', v.cliente_empresa)}
          ${campo('Teléfono', v.cliente_telefono)}
          ${campo('Correo', v.cliente_correo)}
          ${campo('Fecha entrega', formatearFecha(v.fecha_entrega))}
          ${campo('Fecha evento', formatearFecha(v.fecha_evento))}
          ${campo('Taller(es)', v.taller)}
          ${campo('Código de producto', nombreCatalogo('productos', v.producto_id))}
          ${campo('Material', nombreCatalogo('materiales', v.material_id))}
          ${campo('Técnica', v.tecnica)}
          ${campo('Acabado', v.acabado)}
          ${campo('Cantidad', v.cantidad)}
          ${campo('Cotización', v.cotizacion != null ? `Q${Number(v.cotizacion).toFixed(2)}` : '-')}
          ${campo('Urgente', v.urgente ? 'Sí' : 'No')}
        </div>
      `,
      footerHtml: `<button class="btn btn--primary" id="btn-cerrar-info">Cerrar</button>`
    });
    overlay.querySelector('#btn-cerrar-info').addEventListener('click', cerrar);
  }

  // -------------------------------------------------------------------------
  // Historial / trazabilidad
  // -------------------------------------------------------------------------
  async function abrirModalHistorial(vale) {
    let detalle;
    try {
      detalle = await (await fetch(`/api/vales/${vale.id}`)).json();
    } catch {
      detalle = { historial: [] };
    }
    const { overlay } = abrirModal({
      title: `Historial — ${vale.correlativo}`,
      bodyHtml: `
        <ul class="historial-list">
          ${(detalle.historial || []).map(h => `<li><span class="fecha">${formatearFechaHora(h.creado_en)}</span>${h.actor_nombre ? `<strong>${h.actor_nombre}:</strong> ` : ''}${h.accion}</li>`).join('') || '<li>Sin movimientos registrados.</li>'}
        </ul>
      `
    });
    void overlay;
  }

  // -------------------------------------------------------------------------
  // Carga de trabajo (encargados de taller) — se mantiene actualizada en tiempo
  // real mientras el modal (o su detalle) está abierto, sin necesidad de cerrarlo.
  // -------------------------------------------------------------------------
  async function renderContenidoCargaTrabajo(overlay) {
    let data = [];
    try {
      data = await (await fetch('/api/vales/carga-trabajo')).json();
    } catch { /* se muestra vacío si falla */ }

    const maxAsignaciones = Math.max(1, ...data.map(t => t.asignaciones));
    const body = overlay.querySelector('.modal-body');
    body.innerHTML = data.length ? data.map(t => `
      <div class="carga-tecnico" data-tecnico-id="${t.tecnicoId}">
        <div class="nombre">${t.nombre}</div>
        <div class="carga-barra"><div class="carga-barra-fill" style="transform:scaleX(${t.asignaciones / maxAsignaciones})"></div></div>
        <div style="font-size:12px;color:var(--color-text-secondary);">
          Asignaciones: ${t.asignaciones} · En proceso: ${t.enProceso || 'Ninguno'}
        </div>
      </div>
    `).join('') : '<p style="font-size:13px;">No tienes técnicos bajo tu mando.</p>';

    $$('.carga-tecnico', body).forEach(el => {
      el.addEventListener('click', () => abrirModalAsignacionesTecnico(el.dataset.tecnicoId));
    });
  }

  function abrirModalCargaTrabajo() {
    const { overlay, cerrar } = abrirModal({ title: 'Carga de trabajo', bodyHtml: '<p class="tabla-vacia">Cargando...</p>' });
    void cerrar;
    state.cargaTrabajoModal = { overlay, actualizar: () => renderContenidoCargaTrabajo(overlay) };
    renderContenidoCargaTrabajo(overlay);
  }

  async function renderContenidoAsignacionesTecnico(overlay, tecnicoId) {
    let vales = [];
    try {
      vales = await (await fetch(`/api/vales/carga-trabajo/${tecnicoId}`)).json();
    } catch { /* se muestra vacío si falla */ }

    const body = overlay.querySelector('.modal-body');
    body.innerHTML = vales.length ? `
      <table class="buzon-table data-table"><thead><tr><th>Correlativo</th><th>Entrega</th><th>Estado</th></tr></thead>
      <tbody>${vales.map(v => `
        <tr${v.atrasado ? ' style="color:var(--color-danger);"' : ''}>
          <td>${v.correlativo}</td><td>${formatearFecha(v.fecha_entrega)}</td>
          <td><span class="estado-pill estado-${v.estado_taller}">${ESTADOS_LABEL[v.estado_taller] || v.estado_taller}</span></td>
        </tr>`).join('')}</tbody></table>
    ` : '<p style="font-size:13px;">Este técnico no tiene asignaciones activas.</p>';
  }

  function abrirModalAsignacionesTecnico(tecnicoId) {
    const { overlay } = abrirModal({ title: 'Asignaciones del técnico', bodyHtml: '<p class="tabla-vacia">Cargando...</p>' });
    state.cargaTrabajoModal = { overlay, actualizar: () => renderContenidoAsignacionesTecnico(overlay, tecnicoId) };
    renderContenidoAsignacionesTecnico(overlay, tecnicoId);
  }
})();
