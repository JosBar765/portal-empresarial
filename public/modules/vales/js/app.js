// public/modules/vales/js/app.js
(() => {
  // Estados REALES: nivel general del vale (vales.estado) + nivel de taller
  // (vale_talleres.estado, ver analisis_correcciones_3.md). No colisionan entre
  // sí, así que comparten un solo diccionario de etiquetas.
  const ESTADOS_LABEL = {
    // Generales (RECHAZADO/EN_CORRECCION ya no existen — ver analisis_correcciones_5.md #5)
    // analisis_correcciones_10.md #5: nuevo primer estado, antes del fan-out a talleres.
    ESPERANDO_AUTORIZACION: 'Esperando Autorización',
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
    ESPERANDO_AUTORIZACION: 'Esperando Autorización',
    CREADO: 'Creado',
    SOLICITANDO_MODIFICACION: 'Solicitando Modificación',
    MODIFICADO: 'Modificado',
    PENDIENTE_CONFIRMACION: 'Pendiente Confirmación',
    CONFIRMADO: 'Confirmado'
  };

  // Subconjuntos de ESTADOS_LABEL usados solo para poblar las opciones del
  // desplegable "Todos los estados" del buzón (analisis_correcciones_9.md #3,
  // opción A) — reflejan exactamente qué rama de `estadoActivo()` aplica a
  // cada rol, para no ofrecer una opción que nunca puede matchear nada.
  const CLAVES_ESTADOS_TALLER = ['PENDIENTE_ASIGNACION', 'ASIGNADO', 'EN_PROCESO', 'EN_REVISION', 'APROBADO'];
  const CLAVES_ESTADOS_GENERAL = ['ESPERANDO_AUTORIZACION', 'CREADO', 'APROBADO_DEPARTAMENTO', 'PENDIENTE_CONFIRMACION', 'RECIBIDO', 'SOLICITANDO_MODIFICACION', 'MODIFICADO'];

  // Roles con sidebar Buzón / Trabajo realizado (Asesor, Supervisor, Técnico,
  // Encargado General/Asistente, Encargado de un taller — analisis_correcciones_5.md
  // #1, ampliado a los roles 5/6 en analisis_correcciones_10.md #8). El Gerente
  // (10) también tiene sidebar, pero con su propio par Dashboard/Vales de Arte
  // en vez de Buzón/Trabajo realizado (analisis_correcciones_7.md, Vista
  // Gerencia) — ver wireSidebar().
  const ROLES_CON_SIDEBAR = [3, 4, 5, 6, 7, 8, 9, 10];

  // "Atrasados" (analisis_correcciones_6.md #3): para asesor, supervisor y
  // encargados (de taller y general) es un contador COMBINABLE — se marca
  // con `atrasadosGlobal: true` en vez de `filtro`, así renderContadores()
  // lo trata como un interruptor aparte (state.soloAtrasados) que se puede
  // activar junto con cualquier otro filtro de contador. El técnico queda
  // afuera de esta lista: su "Asignados con atraso" es su propio filtro fijo.
  const CONTADORES_CONFIG = {
    3: { // Asesor
      buzon: [
        // analisis_correcciones_10.md #11: el límite diario ya no es del asesor
        // (era "vales restantes hoy") — pasó a ser colectivo, del Supervisor.
        { key: 'esperandoAutorizacion', label: 'Esperando autorización', filtro: 'esperandoAutorizacion' },
        { key: 'valesPorRevisar', label: 'Pend. confirmación', filtro: 'valesPorRevisar' },
        { key: 'valesPendientesModificacion', label: 'Solicitando modificación', filtro: 'valesPendientesModificacion' },
        { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
      ],
      trabajo: [
        { key: 'recibidosHoy', label: 'Recibidos hoy', filtro: 'recibidosHoy' },
        { key: 'totalRecibidos', label: 'Total recibidos', filtro: 'totalRecibidos' }
      ]
    },
    4: { // Supervisor
      buzon: [
        // analisis_correcciones_10.md #11: contador colectivo ascendente
        // "autorizados/asesores" — se calcula aparte, ver cargarBuzon().
        { key: 'valesAutorizadosHoy', label: 'Autorizados hoy (equipo)', esTexto: true },
        { key: 'pendientesAutorizacion', label: 'Por autorizar creación', filtro: 'pendientesAutorizacion' },
        { key: 'pendientesConfirmarModificacion', label: 'Por autorizar modificación', filtro: 'pendientesConfirmarModificacion' },
        { key: 'modificados', label: 'Modificados', filtro: 'modificados' },
        { key: 'pendientesConfirmacion', label: 'Pend. confirmación asesor', filtro: 'pendientesConfirmacion' },
        { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
      ],
      // analisis_correcciones_10.md #7: dos grupos — lo que él autorizó, y lo
      // que sus asesores confirmaron de recibido.
      trabajo: [
        { key: 'autorizadosHoy', label: 'Autorizados hoy', filtro: 'autorizadosHoy' },
        { key: 'totalAutorizados', label: 'Total autorizados', filtro: 'totalAutorizados' },
        { key: 'confirmadosHoy', label: 'Confirmados hoy', filtro: 'confirmadosHoy' },
        { key: 'totalConfirmados', label: 'Total confirmados', filtro: 'totalConfirmados' }
      ]
    },
    5: { // Encargado de un taller (analisis_correcciones_10.md #8: ahora con sidebar)
      // analisis_correcciones_11.md #2: "Aprobados hoy" sale del buzón — un vale
      // ya aprobado por este taller sale del buzón y pasa a Trabajo Realizado.
      buzon: [
        { key: 'pendientesAsignacion', label: 'Pend. asignación', filtro: 'pendientesAsignacion' },
        { key: 'asignados', label: 'Asignados', filtro: 'asignados' },
        { key: 'enProceso', label: 'En proceso', filtro: 'enProceso' },
        { key: 'enRevision', label: 'En revisión', filtro: 'enRevision' },
        { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
      ],
      trabajo: [
        { key: 'aprobadosHoy', label: 'Aprobados hoy', filtro: 'aprobadosHoy' },
        { key: 'totalAprobados', label: 'Total aprobados', filtro: 'totalAprobados' }
      ]
    },
    7: { // Técnico
      buzon: [
        { key: 'asignados', label: 'Asignados sin atraso', filtro: 'asignados' },
        { key: 'asignadosAtrasados', label: 'Asignados con atraso', alerta: true, filtro: 'asignadosAtrasados' },
        { key: 'enProceso', label: 'Vale en proceso', esTexto: true }
      ],
      trabajo: [
        { key: 'totalAprobados', label: 'Total aprobados' },
        { key: 'aprobadosHoy', label: 'Aprobados hoy', filtro: 'aprobadosHoy' }
      ]
    },
    8: { // Encargado General
      buzon: [
        { key: 'pendientesFusion', label: 'Vales por fusionar', filtro: 'pendientesFusion' },
        { key: 'valesModificados', label: 'Vales Modificados', filtro: 'valesModificados' },
        { key: 'atrasados', label: 'Atrasados', alerta: true, atrasadosGlobal: true }
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
  // Gerente (Vista Gerencia, analisis_correcciones_7.md): mismo resumen que el
  // administrador para su vista "Vales de Arte" — es de solo lectura, respeta la
  // misma jerarquía que ya ve el administrador.
  CONTADORES_CONFIG[10] = CONTADORES_CONFIG[1];

  const state = {
    user: null,
    catalogos: null,
    vales: [],
    contadores: {},
    vista: 'buzon', // solo aplica a roles con sidebar
    ventana: { tipo: 'todo', desde: null, hasta: null },
    localidadId: null, // Vista Gerencia: filtro de tienda (analisis_correcciones_7.md)
    filtroContador: null,
    soloAtrasados: false, // combinable con filtroContador (analisis_correcciones_6.md #3)
    busqueda: '',
    estadoFiltro: '', // analisis_correcciones_9.md #3 (opción A): ahora corre en el servidor
    sort: { key: null, dir: null }, // ídem — el orden por columna también corre en el servidor
    socket: null,
    cargaTrabajoModal: null,
    accionesEnCurso: new Set(),
    // `cursor` reemplaza a `offset` para el scroll infinito (analisis_correcciones_9.md
    // #3, opción B): es el id del último vale ya cargado, no una posición numérica —
    // así una página siguiente no se desalinea si el conjunto ordenado cambió entre
    // requests (ver documentacion/solucion_paginacion.md).
    paginacion: { limit: 50, cursor: null, total: 0, hasMore: false, cargandoMas: false }
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
      case 'autorizarCreacion': return admin || r === 4;
      case 'aprobarGeneral': return admin || r === 8 || r === 9;
      case 'reenviarModificacion': return admin || r === 8 || r === 9;
      default: return false;
    }
  }

  // El supervisor también usa el estado "lógico" (estado_visible), pero solo en
  // su vista de Trabajo realizado (analisis_correcciones_8.md #2 lo agregó en
  // el backend — _trabajoSupervisor ya adjunta estado_visible a cada fila —
  // pero esta función se había quedado sin el `|| rolId === 4`, así que un
  // vale ya modificado seguía etiquetándose "Recibido" en vez de "Modificado"
  // en pantalla; se corrige acá, detectado al tocar esta misma función para
  // analisis_correcciones_9.md #3).
  function usaEstadosVisibles() {
    return state.user.rolId === 3 || (state.user.rolId === 4 && state.vista === 'trabajo');
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

  // El Gerente reemplaza contadores-grid + buzon-section por su propio
  // dashboard-gerencia mientras esté en la vista "dashboard" — el resto de
  // roles solo cambian el título (analisis_correcciones_7.md, Vista Gerencia).
  function actualizarTituloYSeccionesVista() {
    if (state.user.rolId === 10) {
      const enDashboard = state.vista === 'dashboard';
      $('#buzon-titulo').textContent = enDashboard ? 'Dashboard' : 'Vales de Arte';
      $('#dashboard-gerencia').style.display = enDashboard ? 'block' : 'none';
      $('#contadores-grid').style.display = enDashboard ? 'none' : '';
      $('.buzon-section').style.display = enDashboard ? 'none' : '';
      return;
    }
    $('#buzon-titulo').textContent = state.vista === 'trabajo' ? 'Trabajo Realizado' : 'Buzón de Vales de Arte';
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

    // El Gerente reusa los mismos dos botones del sidebar, pero con su propio
    // par de vistas — Dashboard / Vales de Arte — en vez de Buzón/Trabajo
    // realizado (analisis_correcciones_7.md, Vista Gerencia).
    if (state.user.rolId === 10) {
      const primario = $('#sidebar-item-primario', sidebar);
      const secundario = $('#sidebar-item-secundario', sidebar);
      primario.dataset.vista = 'dashboard';
      primario.querySelector('ion-icon').setAttribute('name', 'bar-chart-outline');
      primario.querySelector('span').textContent = 'Dashboard';
      secundario.dataset.vista = 'vales';
      secundario.querySelector('ion-icon').setAttribute('name', 'file-tray-full-outline');
      secundario.querySelector('span').textContent = 'Vales de Arte';
      state.vista = 'dashboard';
    }
    actualizarTituloYSeccionesVista();

    $$('.sidebar-item', sidebar).forEach(btn => {
      btn.addEventListener('click', () => {
        cerrarSidebarMovil();
        if (btn.dataset.vista === state.vista) return;
        $$('.sidebar-item', sidebar).forEach(b => b.classList.remove('sidebar-item-active'));
        btn.classList.add('sidebar-item-active');
        state.vista = btn.dataset.vista;
        state.sort = { key: null, dir: null };
        state.filtroContador = null; // un filtro de contador es propio de la vista activa
        state.soloAtrasados = false;
        state.estadoFiltro = ''; // el conjunto de estados válidos cambia entre Buzón/Trabajo realizado
        actualizarIndicadoresOrden();
        actualizarTituloYSeccionesVista();
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
    // El rango de fechas reusa el mismo componente de calendario propio de los
    // modales (antes eran <input type="date"> nativos, cuyo ícono/calendario de
    // fábrica del navegador desentonaba junto a los chips de la barra) — ver
    // htmlCampoFechaCompacto/wireCampoFecha. Aquí sí necesita ser limpiable
    // (filtro opcional, a diferencia de un campo de formulario requerido), de
    // ahí el botón "×" propio de la variante compacta.
    const rangoRoot = $('#ventana-rango');
    rangoRoot.innerHTML = htmlCampoFechaCompacto('ventana-desde', 'Desde') +
      '<span class="ventana-rango-sep">—</span>' +
      htmlCampoFechaCompacto('ventana-hasta', 'Hasta');
    const apiDesde = wireCampoFecha(rangoRoot, 'ventana-desde', { placeholder: 'Desde' });
    const apiHasta = wireCampoFecha(rangoRoot, 'ventana-hasta', { placeholder: 'Hasta' });

    $$('#ventana-selector .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#ventana-selector .chip').forEach(b => b.classList.remove('chip-active'));
        btn.classList.add('chip-active');
        state.ventana = { tipo: btn.dataset.ventana, desde: null, hasta: null };
        apiDesde.clear({ silent: true });
        apiHasta.clear({ silent: true });
        apiHasta.setMinDate(null);
        cargarBuzon();
      });
    });
    const onRangoChange = () => {
      const desde = apiDesde.getDate() ? isoLocal(apiDesde.getDate()) : null;
      const hasta = apiHasta.getDate() ? isoLocal(apiHasta.getDate()) : null;
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
    rangoRoot.querySelector('[data-date-field="ventana-desde"] input[type="hidden"]').addEventListener('change', () => {
      apiHasta.setMinDate(apiDesde.getDate());
      onRangoChange();
    });
    rangoRoot.querySelector('[data-date-field="ventana-hasta"] input[type="hidden"]').addEventListener('change', onRangoChange);
    // Búsqueda contra el servidor (analisis_correcciones_5.md #12) — corre sobre
    // TODOS los vales del buzón, no solo la página ya cargada; debounced para no
    // disparar una petición por cada tecla.
    let debounceBusqueda;
    $('#filtro-texto').addEventListener('input', (e) => {
      clearTimeout(debounceBusqueda);
      const valor = e.target.value.trim();
      debounceBusqueda = setTimeout(() => { state.busqueda = valor; cargarBuzon(); }, 300);
    });
    $('#filtro-estado').addEventListener('change', (e) => {
      state.estadoFiltro = e.target.value;
      cargarBuzon();
    });

    // Filtro de tienda — solo Gerencia (analisis_correcciones_7.md, Vista Gerencia).
    if (state.user.rolId === 10) {
      const selectLocalidad = $('#filtro-localidad');
      selectLocalidad.style.display = '';
      (state.catalogos.localidades || []).forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc.id;
        opt.textContent = loc.nombre;
        selectLocalidad.appendChild(opt);
      });
      selectLocalidad.addEventListener('change', () => {
        state.localidadId = selectLocalidad.value || null;
        cargarBuzon();
      });
    }
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
        // analisis_correcciones_9.md #3 (opción A): el orden por columna ahora
        // corre en el servidor sobre el conjunto completo, no solo sobre la
        // página ya cargada — hace falta un refetch, no solo repintar.
        cargarBuzon();
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
      // analisis_correcciones_10.md #11: ya no hay una sala global de
      // supervisores — cada tienda tiene su propio Supervisor, así que cada
      // uno se une solo a su propia sala.
      case 4: return [`supervisor:${user.id}`];
      case 5:
      case 6: {
        const taller = miTaller();
        return taller ? [`taller:${taller.id}`] : [];
      }
      case 7: return [`tecnico:${user.id}`];
      case 8:
      case 9: return ['vales:encargado_general'];
      // Gerente (Vista Gerencia): rol de solo lectura sin ninguna acción sobre
      // los vales — no debe recibir ninguna notificación en tiempo real
      // (toast + beep de `vale_evento`), ni siquiera las que ve Administrador
      // vía `vales:admin` (analisis_correcciones_9.md #4). Ya caía en el
      // `default` de abajo (nunca se unía a ninguna sala), pero se deja
      // explícito para que la ausencia de notificaciones sea intencional y no
      // un efecto colateral de un `switch` sin `case`.
      case 10: return [];
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
      // analisis_correcciones_10.md #10: el mensaje ya viene formateado y
      // listo del servidor ("{fecha} – Vale: {correlativo} fue {acción} por
      // {actor}[ a {destino}]"); `nivel: 'alerta'` (atrasos, propuesta vacía)
      // pinta el toast en rojo; `beep: false` permite un evento silencioso
      // (reenvío a varios talleres del Encargado General: un solo emit, un
      // solo beep, aunque el mensaje mencione a más de un destino).
      const esAlerta = data.nivel === 'alerta';
      window.toast[esAlerta ? 'error' : 'info'](esAlerta ? 'Atención' : 'Vale de arte', data.mensaje);
      if (data.beep !== false) reproducirBeep();
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
    if (state.soloAtrasados) qs.set('soloAtrasados', '1');
    if (state.busqueda) qs.set('busqueda', state.busqueda);
    if (state.localidadId) qs.set('localidadId', state.localidadId);
    if (state.estadoFiltro) qs.set('estado', state.estadoFiltro);
    if (state.sort.key && state.sort.dir) {
      qs.set('sortKey', state.sort.key);
      qs.set('sortDir', state.sort.dir);
    }
    return qs;
  }

  async function cargarBuzon() {
    // El Gerente en su vista "Dashboard" no pide el buzón de vales — pide las
    // métricas agregadas (analisis_correcciones_7.md, Vista Gerencia).
    if (state.user.rolId === 10 && state.vista === 'dashboard') {
      return cargarDashboardGerencia();
    }
    state.paginacion = { limit: 50, cursor: null, total: 0, hasMore: false, cargandoMas: false };
    const qs = construirQueryBase();

    try {
      const res = await fetch(`/api/vales?${qs.toString()}`);
      if (!res.ok) throw new Error('No se pudo cargar el buzón.');
      const data = await res.json();
      state.vales = data.vales || [];
      state.contadores = data.contadores || {};
      state.paginacion.total = data.total ?? state.vales.length;
      state.paginacion.hasMore = !!data.hasMore;
      state.paginacion.cursor = data.nextCursor ?? null;
    } catch (error) {
      $('#buzon-tbody').innerHTML = `
        <tr><td colspan="${columnasVisibles()}" class="tabla-vacia">
          <div class="buzon-vacio buzon-vacio-error">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <h3>No se pudo cargar el buzón</h3>
            <p>${error.message}</p>
          </div>
        </td></tr>`;
      return;
    }

    // analisis_correcciones_10.md #11: el límite diario pasó del asesor al
    // Supervisor, como contador colectivo ascendente "autorizados/asesores".
    if (state.user.rolId === 4 && state.vista !== 'trabajo') {
      try {
        const r = await fetch('/api/vales/limite-colectivo');
        const d = await r.json();
        state.contadores.valesAutorizadosHoy = `${d.autorizados}/${d.limite}`;
      } catch { /* no bloquea el render del buzón */ }
    }

    renderContadores();
    poblarFiltroEstado();
    renderTabla();
  }

  // -------------------------------------------------------------------------
  // Vista Gerencia: Dashboard de métricas (analisis_correcciones_7.md) — reusa
  // la ventana de tiempo y el filtro de tienda del resto del módulo, pero pide
  // agregados en vez del listado de vales.
  // -------------------------------------------------------------------------
  const chartsGerencia = { estado: null, localidad: null };

  async function cargarDashboardGerencia() {
    const qs = new URLSearchParams();
    if (state.ventana.tipo) qs.set('ventana', state.ventana.tipo);
    if (state.ventana.tipo === 'rango') {
      if (state.ventana.desde) qs.set('desde', state.ventana.desde);
      if (state.ventana.hasta) qs.set('hasta', state.ventana.hasta);
    }
    if (state.localidadId) qs.set('localidadId', state.localidadId);
    try {
      const res = await fetch(`/api/vales/dashboard-gerencia?${qs.toString()}`);
      if (!res.ok) throw new Error('No se pudo cargar el dashboard.');
      renderDashboardGerencia(await res.json());
    } catch (error) {
      $('#dashboard-gerencia').innerHTML = `<p class="tabla-vacia">Error al cargar el dashboard: ${error.message}</p>`;
    }
  }

  function renderDashboardGerencia(data) {
    const cont = $('#dashboard-gerencia');
    cont.innerHTML = `
      <div class="contadores-grid">
        <div class="contador-card">
          <div class="valor">${data.total}</div>
          <div class="etiqueta">Total vales</div>
        </div>
        <div class="contador-card contador-alerta">
          <div class="valor">${data.atrasados}</div>
          <div class="etiqueta">Atrasados (${data.porcentajeAtrasados}%)</div>
        </div>
        <div class="contador-card">
          <div class="valor">${data.entregadosATiempo}</div>
          <div class="etiqueta">Entregados a tiempo</div>
        </div>
        <div class="contador-card">
          <div class="valor">${data.porcentajeEntregadosATiempo}%</div>
          <div class="etiqueta">% a tiempo (de ${data.terminados} recibidos)</div>
        </div>
      </div>
      <div class="dashboard-charts">
        <div class="chart-card">
          <h3>Vales por estado</h3>
          <canvas id="chart-por-estado"></canvas>
        </div>
        <div class="chart-card">
          <h3>Vales por tienda</h3>
          <canvas id="chart-por-localidad"></canvas>
        </div>
      </div>
    `;

    if (typeof Chart === 'undefined') return; // Chart.js no cargó (sin conexión, etc.) — las tarjetas ya se ven

    const tokenColor = (nombre, fallback) => {
      const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
      return valor || fallback;
    };
    const CLAVE_CSS_ESTADO = {
      ESPERANDO_AUTORIZACION: 'espera-autorizacion', CREADO: 'creado', APROBADO_DEPARTAMENTO: 'aprobado-departamento',
      PENDIENTE_CONFIRMACION: 'pendiente-confirmacion',
      RECIBIDO: 'recibido', SOLICITANDO_MODIFICACION: 'solicitando-modificacion', MODIFICADO: 'modificado'
    };
    const estadosPresentes = Object.keys(data.porEstado);

    chartsGerencia.estado?.destroy();
    chartsGerencia.estado = new Chart($('#chart-por-estado'), {
      type: 'bar',
      data: {
        labels: estadosPresentes.map(e => ESTADOS_LABEL[e] || e),
        datasets: [{
          data: estadosPresentes.map(e => data.porEstado[e]),
          backgroundColor: estadosPresentes.map(e => tokenColor(`--vale-estado-${CLAVE_CSS_ESTADO[e]}-bg`, '#E9E7EB')),
          borderColor: estadosPresentes.map(e => tokenColor(`--vale-estado-${CLAVE_CSS_ESTADO[e]}-fg`, '#43474E')),
          borderWidth: 1.5, borderRadius: 4
        }]
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });

    chartsGerencia.localidad?.destroy();
    chartsGerencia.localidad = new Chart($('#chart-por-localidad'), {
      type: 'bar',
      data: {
        labels: data.porLocalidad.map(l => l.nombre),
        datasets: [
          {
            label: 'Total', data: data.porLocalidad.map(l => l.total),
            backgroundColor: tokenColor('--color-primary-light', '#EFF6FF'), borderColor: tokenColor('--color-primary', '#2563EB'),
            borderWidth: 1.5, borderRadius: 4
          },
          {
            label: 'Atrasados', data: data.porLocalidad.map(l => l.atrasados),
            backgroundColor: tokenColor('--color-danger-bg', '#FEF2F2'), borderColor: tokenColor('--color-danger', '#DC2626'),
            borderWidth: 1.5, borderRadius: 4
          }
        ]
      },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  async function cargarMasVales() {
    if (state.paginacion.cargandoMas || !state.paginacion.hasMore) return;
    state.paginacion.cargandoMas = true;
    const qs = construirQueryBase();
    if (state.paginacion.cursor) qs.set('cursor', String(state.paginacion.cursor));

    try {
      const res = await fetch(`/api/vales?${qs.toString()}`);
      if (!res.ok) throw new Error('No se pudo cargar más vales.');
      const data = await res.json();
      // Si el cursor ya no aparece en el conjunto recalculado del servidor, este
      // cae a un respaldo por posición (ver obtenerBuzon) que en teoría podría
      // repetir filas ya mostradas — se descartan acá por id, nunca duplicando
      // una fila en pantalla (analisis_correcciones_9.md #3, opción B).
      const yaCargados = new Set(state.vales.map(v => v.id));
      const nuevos = (data.vales || []).filter(v => !yaCargados.has(v.id));
      state.vales = state.vales.concat(nuevos);
      state.paginacion.cursor = data.nextCursor ?? state.paginacion.cursor;
      state.paginacion.total = data.total ?? state.paginacion.total;
      state.paginacion.hasMore = !!data.hasMore;
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
      const esClickeable = !!c.filtro || !!c.atrasadosGlobal;
      // "Atrasados en general" (analisis_correcciones_6.md #3) es el único
      // contador combinable: se activa/desactiva con su propio interruptor
      // (state.soloAtrasados) en vez de competir por state.filtroContador con
      // el resto de las tarjetas, que siguen siendo mutuamente excluyentes.
      const activo = c.atrasadosGlobal ? state.soloAtrasados : (c.filtro && state.filtroContador === c.filtro);
      const clases = ['contador-card'];
      if (alerta) clases.push('contador-alerta');
      if (esClickeable) clases.push('contador-clickeable');
      if (activo) clases.push('contador-activo');
      // Un valor largo (p. ej. el correlativo del vale en proceso del técnico,
      // "GUA-3-0003") no se lee bien con el mismo tamaño pensado para un
      // número — .valor-compacto lo reduce sin tocar los contadores numéricos
      // ni los "N/M" cortos (p. ej. el límite colectivo del supervisor).
      const valorLargo = String(mostrado).length > 6;
      return `
        <div class="${clases.join(' ')}" data-filtro="${c.filtro || ''}" data-atrasados-global="${c.atrasadosGlobal ? '1' : ''}">
          <div class="valor${valorLargo ? ' valor-compacto' : ''}">${mostrado}</div>
          <div class="etiqueta">${c.label}</div>
        </div>`;
    }).join('');

    $$('.contador-card', grid).forEach(card => {
      const filtro = card.dataset.filtro;
      const esAtrasadosGlobal = card.dataset.atrasadosGlobal === '1';
      if (!filtro && !esAtrasadosGlobal) return;
      card.addEventListener('click', () => {
        if (esAtrasadosGlobal) {
          state.soloAtrasados = !state.soloAtrasados;
        } else {
          state.filtroContador = state.filtroContador === filtro ? null : filtro;
        }
        cargarBuzon();
      });
    });
  }

  // Opciones del desplegable "Todos los estados": ya NO se derivan de
  // `state.vales` (lo que estuviera cargado en ese momento) — se muestra
  // siempre el conjunto completo válido para el rol/vista actual, para que un
  // estado que solo existe más allá de la primera página siga siendo
  // seleccionable (analisis_correcciones_9.md #3, opción A). El filtrado en
  // sí ahora es responsabilidad del servidor (`state.estadoFiltro`, ver
  // construirQueryBase/cargarBuzon), no de esta función.
  function poblarFiltroEstado() {
    const select = $('#filtro-estado');
    let labelMap;
    if (usaEstadosVisibles()) {
      labelMap = ESTADOS_VISIBLES_LABEL;
    } else {
      const claves = [5, 6, 7].includes(state.user.rolId) ? CLAVES_ESTADOS_TALLER : CLAVES_ESTADOS_GENERAL;
      labelMap = Object.fromEntries(claves.map(k => [k, ESTADOS_LABEL[k]]));
    }
    select.innerHTML = '<option value="">Todos los estados</option>' +
      Object.entries(labelMap).map(([clave, label]) => `<option value="${clave}">${label}</option>`).join('');
    select.value = state.estadoFiltro || '';
  }

  // "Diseño, Diseño UV/3D" en texto plano se leía como una sola frase larga en
  // vez de dos talleres distintos, sobre todo en vales multi-taller — reusa el
  // mismo chip .taller-tag del selector de talleres del formulario de creación
  // (solo lectura, sin botón de quitar) en vez de inventar un componente nuevo.
  function celdaTaller(v) {
    const texto = v.taller || '-';
    if (texto === '-') return '-';
    return `<div class="taller-tags-cell">${texto.split(', ').map(t => `<span class="taller-tag">${t}</span>`).join('')}</div>`;
  }

  function nombreCatalogo(lista, id) {
    if (!state.catalogos || !id) return '-';
    const item = (state.catalogos[lista] || []).find(x => x.id === Number(id));
    return item ? (item.nombre || item.codigo) : '-';
  }

  function renderTabla() {
    // El filtro de estado y el orden por columna ya vienen resueltos del
    // servidor (state.estadoFiltro/state.sort viajan en la query — ver
    // construirQueryBase/cargarBuzon — analisis_correcciones_9.md #3, opción
    // A); acá solo se pinta `state.vales` tal cual llegó.
    const filas = state.vales;

    const tbody = $('#buzon-tbody');
    if (filas.length === 0) {
      const esBusqueda = !!state.busqueda;
      const icono = esBusqueda ? 'search-outline' : 'file-tray-outline';
      const titulo = esBusqueda ? 'Sin resultados' : 'Buzón vacío';
      const mensaje = esBusqueda
        ? `No encontramos vales de arte para «${state.busqueda}».`
        : 'No hay vales de arte para mostrar con los filtros actuales.';
      tbody.innerHTML = `
        <tr><td colspan="${columnasVisibles()}" class="tabla-vacia">
          <div class="buzon-vacio">
            <ion-icon name="${icono}"></ion-icon>
            <h3>${titulo}</h3>
            <p>${mensaje}</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = filas.map(v => `
      <tr>
        <td data-label="Correlativo"><strong>${v.correlativo}</strong>${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}</td>
        <td data-label="Fecha Ingreso">${formatearFechaHora(v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`)}</td>
        <td data-label="Fecha Entrega">${formatearFecha(v.fecha_entrega)}</td>
        <td data-label="Atraso">${v.atrasado ? `<span class="badge badge-atraso">${v.diasAtraso}d</span>` : `<span class="badge badge-ok">Al día</span>`}</td>
        <td data-label="Fecha Evento">${formatearFecha(v.fecha_evento)}</td>
        <td data-label="Taller" class="col-taller">${celdaTaller(v)}</td>
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
    // analisis_correcciones_11.md #2: en "Trabajo realizado" el encargado de un
    // taller ve la propuesta REAL que aprobó en su taller (`propuesta_taller_url`,
    // solo viene poblado en esa vista) — no `propuesta_general_url`, que en un
    // vale multi-taller es la fusión del Encargado General, no su propio trabajo.
    if ([5, 6].includes(state.user.rolId) && v.propuesta_taller_url) {
      acciones.push({ icono: 'document-attach-outline', titulo: 'Ver propuesta', onClick: () => window.open(`/${v.propuesta_taller_url}`, '_blank') });
    }

    // analisis_correcciones_10.md #5: el Supervisor autoriza el envío a talleres
    // de un vale recién creado por uno de sus asesores.
    if (puede('autorizarCreacion') && v.estado === 'ESPERANDO_AUTORIZACION') {
      acciones.push({ icono: 'checkmark-done-outline', titulo: 'Autorizar creación', clase: 'icon-success', onClick: abrirModalAutorizarCreacion });
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
      cerrarPanelFechaActivo(); // por si el modal se cierra con un calendario todavía abierto
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
  // Validación inline de formularios — reemplaza los globos nativos del
  // navegador (form.reportValidity()) por un mensaje propio junto a cada
  // campo, con el mismo lenguaje visual del resto de la UI. Se apoya en la
  // Constraint Validation API nativa (required/type/min/max) para no
  // reinventar las reglas, solo su presentación; los campos de fecha (un
  // <input type="hidden"> por debajo del calendario propio) quedan fuera de
  // esa API porque el navegador excluye los hidden de la validación, así que
  // se valida su .value a mano con la misma pareja de helpers.
  // -------------------------------------------------------------------------
  function limpiarErrorCampo(campo) {
    const wrapper = campo.closest('.form-field');
    if (!wrapper) return;
    wrapper.classList.remove('is-invalid');
    const msg = wrapper.querySelector('.field-error');
    if (msg) msg.remove();
  }

  function marcarErrorCampo(campo, mensaje) {
    const wrapper = campo.closest('.form-field');
    if (!wrapper) return;
    wrapper.classList.add('is-invalid');
    let msg = wrapper.querySelector('.field-error');
    if (!msg) {
      msg = document.createElement('span');
      msg.className = 'field-error';
      msg.innerHTML = '<ion-icon name="alert-circle-outline"></ion-icon><span></span>';
      wrapper.appendChild(msg);
    }
    msg.querySelector('span').textContent = mensaje;
  }

  function mensajeValidezCampo(campo) {
    const v = campo.validity;
    if (v.valueMissing) return campo.tagName === 'SELECT' ? 'Selecciona una opción.' : 'Este campo es obligatorio.';
    if (v.typeMismatch) return campo.type === 'email' ? 'Ingresa un correo válido.' : 'El valor no tiene un formato válido.';
    if (v.rangeUnderflow) return `El valor mínimo permitido es ${campo.min}.`;
    if (v.rangeOverflow) return `El valor máximo permitido es ${campo.max}.`;
    if (v.badInput) return 'Ingresa un valor numérico válido.';
    if (v.tooLong) return `Escribe como máximo ${campo.maxLength} caracteres.`;
    return 'Revisa este campo.';
  }

  // Un campo de fecha "válido" es simplemente uno con .value; los normales
  // usan la Constraint Validation API tal cual.
  function campoEsValido(campo) {
    return campo.type === 'hidden' ? !!campo.value : campo.checkValidity();
  }

  // Recorre los campos nativos del formulario (sin tocar los <input hidden>
  // de fecha ni los <input type=file>, que tienen su propio validador) y
  // marca cada uno inválido con su mensaje. Devuelve true si todos pasan.
  function validarCamposNativos(form) {
    let ok = true;
    form.querySelectorAll('input, select, textarea').forEach(campo => {
      if (campo.type === 'hidden' || campo.type === 'file') return;
      limpiarErrorCampo(campo);
      if (campo.checkValidity()) return;
      marcarErrorCampo(campo, mensajeValidezCampo(campo));
      ok = false;
    });
    return ok;
  }

  function validarCampoFecha(overlay, name) {
    const hidden = overlay.querySelector(`[data-date-field="${name}"] input[type="hidden"]`);
    if (hidden.value) { limpiarErrorCampo(hidden); return true; }
    marcarErrorCampo(hidden, 'Selecciona una fecha.');
    return false;
  }

  function validarTalleresSeleccionados(overlay, seleccionados) {
    const campo = overlay.querySelector('.select-agregar-taller');
    if (seleccionados.size > 0) { limpiarErrorCampo(campo); return true; }
    marcarErrorCampo(campo, 'Selecciona al menos un taller.');
    return false;
  }

  // Al primer intento de envío fallido, cada campo se limpia apenas el
  // usuario lo corrige, en vez de esperar a que vuelva a hacer clic en
  // guardar — el input/change del hidden de fecha también dispara 'change'
  // (ver wireCampoFecha), así que un solo listener delegado cubre todo.
  function wireLimpiezaValidacionInline(form) {
    const onCambio = (e) => {
      const campo = e.target.closest('input, select, textarea');
      if (!campo) return;
      const wrapper = campo.closest('.form-field');
      // Solo re-evalúa un campo que ya tenía un error visible; uno "virgen"
      // no se marca hasta el próximo intento de envío.
      if (!wrapper || !wrapper.classList.contains('is-invalid')) return;
      if (campoEsValido(campo)) { limpiarErrorCampo(campo); return; }
      // Sigue inválido, pero puede que ahora sea por otra razón (p. ej. pasó
      // de "obligatorio" a "mínimo 2") — se refresca el mensaje en vivo en
      // vez de dejar el de la última vez.
      if (campo.type !== 'hidden') marcarErrorCampo(campo, mensajeValidezCampo(campo));
    };
    form.addEventListener('input', onCambio);
    form.addEventListener('change', onCambio);
  }

  // Al fallar el envío, se hace scroll + foco al primer campo marcado
  // inválido en orden de documento — sea cual sea el validador que lo marcó
  // (nativo, fecha o talleres). Los campos de fecha no son enfocables (son un
  // <input hidden>), así que se enfoca su botón visible; lo mismo iría para
  // cualquier otro campo "de vitrina" que se agregue a futuro.
  function enfocarPrimerCampoInvalido(root) {
    const wrapper = root.querySelector('.form-field.is-invalid');
    if (!wrapper) return;
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const foco = wrapper.querySelector('.date-field-trigger')
      || wrapper.querySelector('input:not([type="hidden"]), select, textarea');
    if (foco) foco.focus({ preventScroll: true });
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
      if (seleccionados.size > 0) limpiarErrorCampo(select);
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

  // -------------------------------------------------------------------------
  // Selector de fecha propio (rediseño UI/UX, analisis_correcciones_6.md) —
  // reemplaza el <input type="datetime-local"> nativo. La hora nunca se le
  // mostró al usuario en ningún lado (formatearFecha/formatFechaSolo siempre
  // la ocultan), así que ahora tampoco se le pide: es un calendario propio,
  // con la línea visual del resto del formulario, que solo deja elegir un día
  // y se cierra solo al elegirlo.
  // -------------------------------------------------------------------------
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS_SEMANA_CORTO = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

  function hoyMedianoche() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function sumarDiaLocal(fecha, dias) {
    const d = new Date(fecha);
    d.setDate(d.getDate() + dias);
    return d;
  }
  function isoLocal(fecha) {
    const y = fecha.getFullYear(), m = String(fecha.getMonth() + 1).padStart(2, '0'), d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function parseIsoLocal(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Solo un calendario puede estar abierto a la vez (aunque el formulario tenga
  // varios campos de fecha) — se usa para cerrar el anterior al abrir otro, y
  // para no dejarlo huérfano si el modal se cierra mientras sigue abierto.
  let panelFechaActivo = null;
  function cerrarPanelFechaActivo() {
    if (panelFechaActivo) panelFechaActivo.cerrar();
  }

  function htmlCampoFecha(label, name, requerido = true) {
    return `
      <div class="form-field">
        <label>${label}${requerido ? ' *' : ''}</label>
        <div class="date-field" data-date-field="${name}">
          <button type="button" class="date-field-trigger">
            <span class="date-field-value is-placeholder">Seleccionar fecha</span>
            <ion-icon name="calendar-outline"></ion-icon>
          </button>
          <input type="hidden" name="${name}" />
        </div>
      </div>
    `;
  }

  // Variante compacta del mismo componente, sin envoltorio .form-field/label —
  // pensada para filtros de barra de herramientas (ver wireToolbar) en vez de
  // campos de formulario. A diferencia de htmlCampoFecha, es limpiable (trae su
  // propio botón "×", oculto hasta que hay una fecha elegida — ver .has-value
  // en wireCampoFecha/styles.css) porque un filtro, a diferencia de un dato
  // requerido del vale, siempre debe poder volver a "sin fecha".
  function htmlCampoFechaCompacto(name, etiqueta) {
    return `
      <div class="date-field date-field-compact" data-date-field="${name}">
        <button type="button" class="date-field-trigger" title="${etiqueta}">
          <span class="date-field-value is-placeholder">${etiqueta}</span>
          <ion-icon name="calendar-outline"></ion-icon>
        </button>
        <button type="button" class="date-field-clear" title="Quitar filtro" aria-label="Quitar filtro de ${etiqueta.toLowerCase()}">&times;</button>
        <input type="hidden" name="${name}" />
      </div>
    `;
  }

  // minDate se puede ajustar después con api.setMinDate() — lo usa, por ejemplo,
  // la fecha del evento, que se recalcula cuando cambia la fecha de entrega.
  function wireCampoFecha(overlay, name, { minDate = null, placeholder = 'Seleccionar fecha' } = {}) {
    const wrapper = overlay.querySelector(`[data-date-field="${name}"]`);
    const trigger = wrapper.querySelector('.date-field-trigger');
    const valueEl = wrapper.querySelector('.date-field-value');
    const hidden = wrapper.querySelector('input[type="hidden"]');
    const clearBtn = wrapper.querySelector('.date-field-clear');
    let seleccionado = null;
    let minActual = minDate;
    let mesVisible = new Date();
    let panelEl = null;

    const api = {
      cerrar: cerrarPanel,
      getDate: () => seleccionado,
      setMinDate(fecha) {
        minActual = fecha;
        if (seleccionado && minActual && seleccionado < minActual) {
          seleccionado = null;
          hidden.value = '';
          refrescarLabel();
          hidden.dispatchEvent(new Event('change', { bubbles: true }));
        }
      },
      clear(opts = {}) {
        seleccionado = null;
        hidden.value = '';
        refrescarLabel();
        if (!opts.silent) hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        api.clear();
      });
    }

    function refrescarLabel() {
      wrapper.classList.toggle('has-value', !!seleccionado);
      if (seleccionado) {
        valueEl.textContent = formatearFecha(isoLocal(seleccionado));
        valueEl.classList.remove('is-placeholder');
      } else {
        valueEl.textContent = placeholder;
        valueEl.classList.add('is-placeholder');
      }
    }

    function seleccionar(fecha) {
      seleccionado = fecha;
      hidden.value = isoLocal(fecha);
      refrescarLabel();
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
      cerrarPanel();
    }

    function onKeydownCapture(e) {
      if (e.key === 'Escape') { e.stopPropagation(); cerrarPanel(); }
    }
    function onClickFuera(e) {
      if (panelEl && !panelEl.contains(e.target) && !trigger.contains(e.target)) cerrarPanel();
    }
    function cerrarPanel() {
      if (!panelEl) return;
      panelEl.remove();
      panelEl = null;
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydownCapture, true);
      document.removeEventListener('click', onClickFuera, true);
      if (panelFechaActivo === api) panelFechaActivo = null;
    }

    function renderPanel() {
      const hoy = hoyMedianoche();
      const primerDia = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1);
      const offset = (primerDia.getDay() + 6) % 7; // lunes = primer día de la semana
      const diasEnMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 0).getDate();
      let celdas = '';
      for (let i = 0; i < offset; i++) celdas += '<span class="dp-day is-outside"></span>';
      for (let d = 1; d <= diasEnMes; d++) {
        const fecha = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), d);
        const deshabilitado = !!(minActual && fecha < minActual);
        const clases = ['dp-day'];
        if (fecha.getTime() === hoy.getTime()) clases.push('is-today');
        if (seleccionado && fecha.getTime() === seleccionado.getTime()) clases.push('is-selected');
        if (deshabilitado) clases.push('is-disabled');
        celdas += `<button type="button" class="${clases.join(' ')}" ${deshabilitado ? 'disabled' : ''} data-fecha="${isoLocal(fecha)}">${d}</button>`;
      }
      panelEl.innerHTML = `
        <div class="dp-header">
          <button type="button" class="dp-nav" data-nav="-1" aria-label="Mes anterior"><ion-icon name="chevron-back-outline"></ion-icon></button>
          <span class="dp-month-label">${MESES[mesVisible.getMonth()]} ${mesVisible.getFullYear()}</span>
          <button type="button" class="dp-nav" data-nav="1" aria-label="Mes siguiente"><ion-icon name="chevron-forward-outline"></ion-icon></button>
        </div>
        <div class="dp-weekdays">${DIAS_SEMANA_CORTO.map(d => `<span>${d}</span>`).join('')}</div>
        <div class="dp-grid">${celdas}</div>
      `;
      panelEl.querySelectorAll('.dp-nav').forEach(btn => {
        btn.addEventListener('click', () => {
          mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + Number(btn.dataset.nav), 1);
          renderPanel();
        });
      });
      panelEl.querySelectorAll('.dp-day[data-fecha]:not(.is-disabled)').forEach(btn => {
        btn.addEventListener('click', () => seleccionar(parseIsoLocal(btn.dataset.fecha)));
      });
    }

    function posicionarPanel() {
      const rect = trigger.getBoundingClientRect();
      const anchoPanel = panelEl.offsetWidth;
      let left = rect.left;
      if (left + anchoPanel > window.innerWidth - 12) left = Math.max(12, rect.right - anchoPanel);
      panelEl.style.top = `${rect.bottom + 6}px`;
      panelEl.style.left = `${left}px`;
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panelEl) { cerrarPanel(); return; }
      if (panelFechaActivo) panelFechaActivo.cerrar();
      const base = minActual && minActual > hoyMedianoche() ? minActual : hoyMedianoche();
      mesVisible = seleccionado ? new Date(seleccionado) : new Date(base);
      panelEl = document.createElement('div');
      panelEl.className = 'date-picker-panel';
      document.body.appendChild(panelEl);
      renderPanel();
      posicionarPanel();
      trigger.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', onKeydownCapture, true);
      setTimeout(() => document.addEventListener('click', onClickFuera, true), 0);
      panelFechaActivo = api;
    });

    return api;
  }

  // Corrección #3: si la entrega queda a menos de 3 días, "Urgente" se marca
  // solo y no se puede desmarcar; con más margen, el asesor decide libremente.
  function wireUrgenteAutoLock(overlay) {
    const fechaInput = overlay.querySelector('[name="fechaEntrega"]');
    const checkbox = overlay.querySelector('[name="urgente"]');
    const actualizar = () => {
      if (!fechaInput.value) { checkbox.disabled = false; return; }
      const diffDias = (parseIsoLocal(fechaInput.value) - hoyMedianoche()) / (1000 * 60 * 60 * 24);
      if (diffDias < 3) {
        checkbox.checked = true;
        checkbox.disabled = true;
      } else {
        checkbox.disabled = false;
      }
    };
    fechaInput.addEventListener('change', actualizar);
    actualizar();
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

  // -------------------------------------------------------------------------
  // Selector de archivos propio (rediseño UI/UX, analisis_correcciones_6.md) —
  // reemplaza el <input type="file"> nativo (botón "Elegir archivo" del
  // navegador) por una zona de arrastrar-y-soltar / clic, consistente con el
  // resto del formulario. Un <input type=file> nativo ya acepta archivos
  // soltados encima sin JS extra; aquí solo se le da estilo y feedback visual
  // al arrastrar. La lista de archivos elegidos es removible con una "×" —
  // el input nativo no permite quitar un archivo individual de su propio
  // .files, así que se mantiene un array propio en JS y se usa ESE array al
  // armar el FormData del envío en vez de depender del input directamente
  // (analisis_correcciones_5.md #9).
  // -------------------------------------------------------------------------
  function iconoParaArchivo(file) {
    if (file.type.startsWith('image/')) return 'image-outline';
    if (file.type === 'application/pdf') return 'document-text-outline';
    return 'document-outline';
  }
  function formatearTamano(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function htmlDropzone({ name, id, accept, multiple = false, hint }) {
    return `
      <label class="dropzone">
        <input type="file"${id ? ` id="${id}"` : ''}${name ? ` name="${name}"` : ''} accept="${accept}" ${multiple ? 'multiple' : ''} class="dropzone-input" />
        <ion-icon name="cloud-upload-outline" class="dropzone-icon"></ion-icon>
        <span class="dropzone-text"><strong>Haz clic para subir</strong> o arrastra el archivo aquí</span>
        ${hint ? `<span class="dropzone-hint">${hint}</span>` : ''}
      </label>
      <div class="archivo-lista"></div>
    `;
  }

  function wireDropzone(overlay, inputSelector, listaSelector) {
    const input = overlay.querySelector(inputSelector);
    const dropzone = input.closest('.dropzone');
    const lista = overlay.querySelector(listaSelector);
    let archivos = [];
    const render = () => {
      lista.innerHTML = archivos.map((f, i) => `
        <span class="archivo-chip">
          <ion-icon name="${iconoParaArchivo(f)}" class="archivo-chip-icon"></ion-icon>
          <span class="archivo-chip-nombre">${f.name}</span>
          <span class="archivo-chip-tamano">${formatearTamano(f.size)}</span>
          <button type="button" class="archivo-chip-quitar" data-idx="${i}" title="Quitar">&times;</button>
        </span>
      `).join('');
    };
    input.addEventListener('change', () => {
      const nuevos = Array.from(input.files);
      archivos = input.multiple ? archivos.concat(nuevos) : nuevos;
      input.value = ''; // la lista real vive en `archivos`, no en el input nativo
      render();
    });
    input.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
    input.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    input.addEventListener('drop', () => dropzone.classList.remove('is-dragover'));
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
            ${htmlCampoFecha('Fecha de entrega', 'fechaEntrega')}
            ${htmlCampoFecha('Fecha del evento', 'fechaEvento')}
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
              <label>Imágenes</label>
              ${htmlDropzone({ name: 'imagenes', accept: 'image/jpeg,image/png,image/webp', multiple: true, hint: 'JPG, PNG o WEBP · máx. 2MB c/u' })}
            </div>
            <div class="form-field">
              <label>Documentos adjuntos</label>
              ${htmlDropzone({ name: 'documentos', accept: 'application/pdf', multiple: true, hint: 'PDF · máx. 3MB c/u' })}
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
    const apiFechaEntrega = wireCampoFecha(overlay, 'fechaEntrega', { minDate: hoyMedianoche() });
    const apiFechaEvento = wireCampoFecha(overlay, 'fechaEvento', { minDate: sumarDiaLocal(hoyMedianoche(), 1) });
    overlay.querySelector('[name="fechaEntrega"]').addEventListener('change', () => {
      apiFechaEvento.setMinDate(sumarDiaLocal(apiFechaEntrega.getDate() || hoyMedianoche(), 1));
    });
    const getImagenes = wireDropzone(overlay, '[name="imagenes"]', '.form-field:has([name="imagenes"]) .archivo-lista');
    const getDocumentos = wireDropzone(overlay, '[name="documentos"]', '.form-field:has([name="documentos"]) .archivo-lista');

    const formCrear = overlay.querySelector('#form-crear-vale');
    wireLimpiezaValidacionInline(formCrear);

    overlay.querySelector('#btn-cancelar-crear').addEventListener('click', cerrar);
    overlay.querySelector('#btn-guardar-crear').addEventListener('click', () => {
      const form = formCrear;
      // validarCamposNativos limpia el estado de TODOS los campos nativos del
      // formulario antes de revisarlos (incluido el <select> de agregar
      // taller, que no tiene `required`) — por eso corre primero, y los
      // validadores manuales (que no son constraint-validation nativa) van
      // después, para que no les borre el error recién marcado.
      const camposOk = validarCamposNativos(form);
      const tallerOk = validarTalleresSeleccionados(overlay, tallerSeleccionados);
      const entregaOk = validarCampoFecha(overlay, 'fechaEntrega');
      const eventoOk = validarCampoFecha(overlay, 'fechaEvento');
      if (!tallerOk || !entregaOk || !eventoOk || !camposOk) {
        enfocarPrimerCampoInvalido(overlay);
        return;
      }
      const formData = new FormData(form);
      formData.set('urgente', form.querySelector('[name="urgente"]').checked ? 'true' : 'false');
      const paisCodigo = form.querySelector('[name="clienteTelefonoPais"]').value;
      const telefonoNum = form.querySelector('[name="clienteTelefono"]').value.trim();
      formData.set('clienteTelefono', `${paisCodigo} ${telefonoNum}`);
      formData.delete('clienteTelefonoPais');
      formData.set('talleresIds', JSON.stringify([...tallerSeleccionados]));
      // Las imágenes/documentos reales viven en los arrays de wireDropzone
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

    // El backend rechaza aprobar sin un documento adjunto real (ver
    // valeService.revisarPropuesta) — se refleja aquí deshabilitando el botón
    // en vez de dejar que el usuario reciba el error recién después de hacer
    // clic, cuando el propio mensaje de arriba ya adelanta que no se puede.
    const puedeAprobar = !!(ultima && ultima.url);

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
        <button class="btn btn--primary" id="btn-aprobar" ${puedeAprobar ? '' : 'disabled title="No hay una propuesta adjunta que aprobar"'}>Aprobar</button>
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
          <label>Documento de propuesta (opcional)</label>
          ${htmlDropzone({ id: 'input-propuesta', accept: 'application/pdf', hint: 'PDF' })}
        </div>
      `,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-enviar">Entregar</button>`
    });
    const getPropuesta = wireDropzone(overlay, '#input-propuesta', '.archivo-lista');
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-enviar').addEventListener('click', async () => {
      const file = getPropuesta()[0];
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
          <label>Documento de fusión final *</label>
          ${htmlDropzone({ id: 'input-fusion', accept: 'application/pdf', hint: 'PDF' })}
        </div>
      `,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Aprobar y Fusionar</button>`
    });
    const getFusion = wireDropzone(overlay, '#input-fusion', '.archivo-lista');
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
      const file = getFusion()[0];
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
  function abrirModalSolicitarModificacion(vale) {
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

          <div class="section-title">Información de Venta</div>
          <div class="form-grid">
            ${htmlCampoFecha('Fecha de entrega', 'fechaEntrega')}
            ${htmlCampoFecha('Fecha del evento', 'fechaEvento')}
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

    wireUrgenteAutoLock(overlay);
    const apiFechaEntregaMod = wireCampoFecha(overlay, 'fechaEntrega', { minDate: hoyMedianoche() });
    const apiFechaEventoMod = wireCampoFecha(overlay, 'fechaEvento', { minDate: sumarDiaLocal(hoyMedianoche(), 1) });
    overlay.querySelector('[name="fechaEntrega"]').addEventListener('change', () => {
      apiFechaEventoMod.setMinDate(sumarDiaLocal(apiFechaEntregaMod.getDate() || hoyMedianoche(), 1));
    });
    if (paisCodigoActual) overlay.querySelector('[name="clienteTelefonoPais"]').value = paisCodigoActual;
    overlay.querySelector('[name="productoId"]').value = vale.producto_id || '';
    overlay.querySelector('[name="materialId"]').value = vale.material_id || '';

    const formModificacion = overlay.querySelector('#form-modificacion');
    wireLimpiezaValidacionInline(formModificacion);

    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-enviar').addEventListener('click', async () => {
      const form = formModificacion;
      const entregaOk = validarCampoFecha(overlay, 'fechaEntrega');
      const eventoOk = validarCampoFecha(overlay, 'fechaEvento');
      const camposOk = validarCamposNativos(form);
      if (!entregaOk || !eventoOk || !camposOk) {
        enfocarPrimerCampoInvalido(overlay);
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
        // Ya no elige taller el asesor — eso es trabajo exclusivo del Encargado
        // General al reenviar la modificación (analisis_correcciones_7.md #3).
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
  // Supervisor: autorizar el envío a talleres de un vale recién creado
  // (analisis_correcciones_10.md #5) — el asesor eligió los talleres al crear
  // (vale.talleres_solicitados, CSV de ids); recién aquí se reparten de verdad.
  // -------------------------------------------------------------------------
  function abrirModalAutorizarCreacion(vale) {
    const talleresIds = String(vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
    const nombresTalleres = talleresIds
      .map(id => ((state.catalogos.talleres || []).find(t => t.id === id) || {}).nombre || `#${id}`)
      .join(', ');
    const { overlay, cerrar } = abrirModal({
      title: `Autorizar creación — ${vale.correlativo}`,
      bodyHtml: `
        <p style="font-size:13px;margin-bottom:10px;">Taller${talleresIds.length > 1 ? 'es' : ''} solicitado${talleresIds.length > 1 ? 's' : ''}: <strong>${nombresTalleres || 'Ninguno'}</strong></p>
        <p style="font-size:13px;">¿Confirmas autorizar este vale de arte? Se enviará de inmediato a ese/esos taller(es) y quedará firmado con tu nombre en el documento.</p>
      `,
      footerHtml: `<button class="btn btn--ghost" id="btn-cerrar">Cancelar</button><button class="btn btn--primary" id="btn-confirmar">Autorizar</button>`
    });
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-confirmar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/autorizar-creacion`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.toast.success('Creación autorizada', `${vale.correlativo} fue enviado a taller.`);
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
    // analisis_correcciones_9.md #2: el link de "Ver propuesta" faltaba porque
    // dependía de `vale.propuesta_general_url` — la fila del buzón tal como
    // llegó al render de la tabla, que puede quedar desactualizada si el campo
    // se pobló DESPUÉS de esa carga. `detalle` es un fetch fresco hecho acá
    // mismo, así que es la fuente correcta; se conserva `vale...` solo como
    // respaldo si ese fetch fallara.
    const propuestaUrl = detalle.propuesta_general_url || vale.propuesta_general_url;

    // analisis_correcciones_8.md #2: mismos dos hipervínculos que ya usa el modal
    // de decisión del asesor (Ver vale de arte / Ver propuesta) — el supervisor no
    // debería tener que cerrar este modal y usar los íconos de la fila para revisar
    // el vale antes de decidir si autoriza.
    const { overlay, cerrar } = abrirModal({
      title: `Autorizar modificación — ${vale.correlativo}`,
      bodyHtml: `
        <div class="form-field full" style="margin-bottom:14px;">
          <label>Justificación de la modificación</label>
          <p style="font-size:13px;white-space:pre-wrap;">${justificacion || 'Sin justificación registrada.'}</p>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          <a href="/api/vales/${vale.id}/pdf" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver vale de arte (PDF)</a>
          ${propuestaUrl ? `<a href="/${propuestaUrl}" target="_blank" class="btn btn--ghost" style="text-decoration:none;display:inline-flex;">Ver propuesta</a>` : ''}
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
      if (!validarTalleresSeleccionados(overlay, tallerSeleccionados)) {
        enfocarPrimerCampoInvalido(overlay);
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
