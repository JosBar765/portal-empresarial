// public/modules/vales/js/app.js
(() => {
  const ESTADOS_LABEL = {
    CREADO: 'Creado', ASIGNADO: 'Asignado', EN_PROCESO: 'En Proceso', EN_REVISION: 'En Revisión',
    APROBADO: 'Aprobado', CONFIRMACION_MODIFICACION: 'Confirmación Modificación', MODIFICADO: 'Modificado',
    VENDIDO: 'Vendido', CANCELADO: 'Cancelado'
  };

  // El asesor no ve el estado real de la máquina de estados, ve una versión "lógica"
  // colapsada (ver .agents/correciones_mod_vales_de_arte_1.md, VISTA ASESOR #5).
  const ESTADOS_VISIBLES_LABEL = {
    CREADO: 'Creado',
    SOLICITANDO_MODIFICACION: 'Solicitando Modificación',
    MODIFICADO: 'Modificado',
    APROBADO: 'Aprobado',
    VENDIDO: 'Vendido',
    CANCELADO: 'Cancelado'
  };
  const ALIAS_CLASE_ESTADO_VISIBLE = { SOLICITANDO_MODIFICACION: 'CONFIRMACION_MODIFICACION' };

  // Roles con sidebar Buzón / Trabajo realizado (Asesor, Supervisor, Técnico).
  const ROLES_CON_SIDEBAR = [3, 4, 7];

  const CONTADORES_CONFIG = {
    3: { // Asesor
      buzon: [
        { key: 'valesRestantesHoy', label: 'Vales restantes hoy' },
        { key: 'valesPorRevisar', label: 'Vales por revisar' },
        { key: 'valesPendientesModificacion', label: 'Pend. modificación' },
        { key: 'valesAtrasados', label: 'Atrasados', alerta: true }
      ],
      trabajo: [
        { key: 'vendidosHoy', label: 'Vendidos hoy' },
        { key: 'canceladosHoy', label: 'Cancelados hoy' },
        { key: 'totalVendidos', label: 'Total vendidos' },
        { key: 'totalCancelados', label: 'Total cancelados' }
      ]
    },
    4: { // Supervisor
      buzon: [
        { key: 'pendientesConfirmarModificacion', label: 'Por confirmar modificación' },
        { key: 'modificados', label: 'Modificados' },
        { key: 'aprobados', label: 'Aprobados' }
      ],
      trabajo: [
        { key: 'valesConfirmadosHoy', label: 'Confirmados hoy' },
        { key: 'valesCanceladosHoy', label: 'Cancelados hoy' },
        { key: 'totalVendidos', label: 'Total vendidos' },
        { key: 'totalCancelados', label: 'Total cancelados' }
      ]
    },
    5: [ // Encargado
      { key: 'pendientesAsignacion', label: 'Pend. asignación' },
      { key: 'pendientesAsignacionAtrasados', label: 'Pend. asignación atrasados', alerta: true },
      { key: 'asignados', label: 'Asignados' },
      { key: 'asignadosAtrasados', label: 'Asignados atrasados', alerta: true },
      { key: 'enProceso', label: 'En proceso' },
      { key: 'enProcesoAtrasados', label: 'En proceso atrasados', alerta: true },
      { key: 'enRevision', label: 'En revisión' },
      { key: 'enRevisionAtrasados', label: 'En revisión atrasados', alerta: true },
      { key: 'aprobados', label: 'Aprobados hoy' },
      { key: 'aprobadosAtrasados', label: 'Aprobados hoy (atrasados)', alerta: true }
    ],
    7: { // Técnico
      buzon: [
        { key: 'asignados', label: 'Vales asignados' },
        { key: 'asignadosAtrasados', label: 'Asignados atrasados', alerta: true },
        { key: 'modificacionPendiente', label: 'Con modificación' },
        { key: 'modificacionPendienteAtrasados', label: 'Modificación atrasados', alerta: true },
        { key: 'enProceso', label: 'Vale en proceso', esTexto: true }
      ],
      trabajo: [
        { key: 'totalAprobados', label: 'Total aprobados' },
        { key: 'aprobadosHoy', label: 'Aprobados hoy' }
      ]
    }
  };
  CONTADORES_CONFIG[6] = CONTADORES_CONFIG[5];
  CONTADORES_CONFIG[1] = CONTADORES_CONFIG[5]; // Administrador ve una vista de control similar a encargado

  const state = {
    user: null,
    catalogos: null,
    vales: [],
    contadores: {},
    vista: 'buzon', // solo aplica a roles con sidebar
    ventana: { tipo: 'todo', desde: null, hasta: null },
    sort: { key: null, dir: null },
    socket: null,
    cargaTrabajoModal: null,
    accionesEnCurso: new Set()
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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
      default: return false;
    }
  }

  function usaEstadosVisibles() {
    return state.user.rolId === 3;
  }

  function claseEstado(v) {
    if (usaEstadosVisibles()) {
      const clave = ALIAS_CLASE_ESTADO_VISIBLE[v.estado_visible] || v.estado_visible;
      return `estado-${clave}`;
    }
    return `estado-${v.estado}`;
  }

  function etiquetaEstado(v) {
    if (usaEstadosVisibles()) return ESTADOS_VISIBLES_LABEL[v.estado_visible] || v.estado_visible;
    return ESTADOS_LABEL[v.estado] || v.estado;
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

    $('#btn-nuevo-vale').style.display = puede('crear') ? 'flex' : 'none';
    // La carga de trabajo es una herramienta de gestión del propio equipo del encargado;
    // el administrador ya ve todo desde el buzón general, por lo que no aplica aquí.
    $('#btn-carga-trabajo').style.display = (state.user.rolId === 5 || state.user.rolId === 6) ? 'flex' : 'none';

    wireSidebar();
    wireToolbar();
    wireSortHeaders();
    initSocket();

    try {
      const catalogosRes = await fetch('/api/vales/catalogos');
      state.catalogos = await catalogosRes.json();
    } catch (error) {
      state.catalogos = { localidades: [], productos: [], materiales: [], tecnicas: [], acabados: [], paises: [] };
    }

    await cargarBuzon();

    $('#logout-btn').addEventListener('click', async () => {
      await fetch('/api/auth.php?action=logout');
      window.location.href = '/login/';
    });
    $('#btn-nuevo-vale').addEventListener('click', () => abrirModalCrearVale());
    $('#btn-carga-trabajo').addEventListener('click', () => abrirModalCargaTrabajo());
  });

  function wireSidebar() {
    const sidebar = $('#sidebar-vales');
    if (!ROLES_CON_SIDEBAR.includes(state.user.rolId)) {
      sidebar.style.display = 'none';
      return;
    }
    sidebar.style.display = 'flex';
    $$('.sidebar-item', sidebar).forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.vista === state.vista) return;
        $$('.sidebar-item', sidebar).forEach(b => b.classList.remove('sidebar-item-active'));
        btn.classList.add('sidebar-item-active');
        state.vista = btn.dataset.vista;
        state.sort = { key: null, dir: null };
        actualizarIndicadoresOrden();
        $('#buzon-titulo').textContent = state.vista === 'trabajo' ? 'Trabajo Realizado' : 'Buzón de Vales de Arte';
        cargarBuzon();
      });
    });
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
      if (!desde && !hasta) return;
      $$('#ventana-selector .chip').forEach(b => b.classList.remove('chip-active'));
      state.ventana = { tipo: 'rango', desde, hasta };
      cargarBuzon();
    };
    $('#ventana-desde').addEventListener('change', onRangoChange);
    $('#ventana-hasta').addEventListener('change', onRangoChange);
    $('#filtro-texto').addEventListener('input', () => renderTabla());
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

  function roomsParaUsuario(user) {
    switch (user.rolId) {
      case 1: return ['vales:admin'];
      case 3: return [`asesor:${user.id}`];
      case 4: return ['vales:supervisores'];
      case 5:
      case 6: return ['vales:encargados', `encargado:${user.id}`];
      case 7: return [`tecnico:${user.id}`];
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
      mostrarToast(
        esCreacion ? `Nuevo vale de arte: ${data.correlativo}` : `Vale ${data.correlativo} actualizado a ${ESTADOS_LABEL[data.estado] || data.estado}`,
        esCreacion ? 'add-circle-outline' : 'sync-outline'
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

  function mostrarToast(mensaje, icono = 'notifications-outline') {
    const root = $('#toast-root');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<ion-icon name="${icono}"></ion-icon><span></span>`;
    toast.querySelector('span').textContent = mensaje;
    root.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // -------------------------------------------------------------------------
  // Carga y render del buzón
  // -------------------------------------------------------------------------
  async function cargarBuzon() {
    const qs = new URLSearchParams();
    if (state.ventana.tipo) qs.set('ventana', state.ventana.tipo);
    if (state.ventana.tipo === 'rango') {
      if (state.ventana.desde) qs.set('desde', state.ventana.desde);
      if (state.ventana.hasta) qs.set('hasta', state.ventana.hasta);
    }
    if (ROLES_CON_SIDEBAR.includes(state.user.rolId)) qs.set('vista', state.vista);

    try {
      const res = await fetch(`/api/vales?${qs.toString()}`);
      if (!res.ok) throw new Error('No se pudo cargar el buzón.');
      const data = await res.json();
      state.vales = data.vales || [];
      state.contadores = data.contadores || {};
    } catch (error) {
      $('#buzon-tbody').innerHTML = `<tr><td colspan="7" class="tabla-vacia">Error al cargar el buzón: ${error.message}</td></tr>`;
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

  function renderContadores() {
    let config = CONTADORES_CONFIG[state.user.rolId] || [];
    if (!Array.isArray(config)) config = config[state.vista] || [];
    const grid = $('#contadores-grid');
    grid.innerHTML = config.map(c => {
      const valor = state.contadores[c.key];
      const mostrado = c.esTexto ? (valor || '—') : (valor ?? 0);
      const alerta = c.alerta && Number(valor) > 0;
      return `
        <div class="contador-card ${alerta ? 'contador-alerta' : ''}">
          <div class="valor">${mostrado}</div>
          <div class="etiqueta">${c.label}</div>
        </div>`;
    }).join('');
  }

  function poblarFiltroEstado() {
    const select = $('#filtro-estado');
    const valorPrevio = select.value;
    const visibles = usaEstadosVisibles();
    const labelMap = visibles ? ESTADOS_VISIBLES_LABEL : ESTADOS_LABEL;
    const presentes = [...new Set(state.vales.map(v => visibles ? v.estado_visible : v.estado))];
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
    const texto = $('#filtro-texto').value.trim().toLowerCase();
    const estadoFiltro = $('#filtro-estado').value;
    const visibles = usaEstadosVisibles();

    let filas = state.vales.filter(v => {
      if (estadoFiltro && (visibles ? v.estado_visible : v.estado) !== estadoFiltro) return false;
      if (texto) {
        const haystack = `${v.correlativo} ${v.cliente_nombre} ${v.cliente_empresa || ''}`.toLowerCase();
        if (!haystack.includes(texto)) return false;
      }
      return true;
    });
    filas = aplicarOrdenPersonalizado(filas);

    const tbody = $('#buzon-tbody');
    if (filas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="tabla-vacia">No hay vales de arte para mostrar.</td></tr>`;
      return;
    }

    tbody.innerHTML = filas.map(v => `
      <tr>
        <td><strong>${v.correlativo}</strong>${v.urgente ? '<span class="badge badge-urgente">URGENTE</span>' : ''}</td>
        <td>${formatearFechaHora(v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`)}</td>
        <td>${formatearFecha(v.fecha_entrega)}</td>
        <td>${v.atrasado ? `<span class="badge badge-atraso">${v.diasAtraso}d</span>` : `<span class="badge badge-ok">Al día</span>`}</td>
        <td>${formatearFecha(v.fecha_evento)}</td>
        <td><span class="estado-pill ${claseEstado(v)}">${etiquetaEstado(v)}</span></td>
        <td class="acciones-cell" data-vale-id="${v.id}"></td>
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
    const acciones = [
      { icono: 'eye-outline', titulo: 'Ver vale de arte (PDF)', onClick: () => window.open(`/api/vales/${v.id}/pdf`, '_blank') }
    ];

    if (puede('asignar') && (v.estado === 'CREADO' || v.estado === 'MODIFICADO')) {
      acciones.push({ icono: 'person-add-outline', titulo: 'Asignar a técnico', onClick: abrirModalAsignar });
    }
    if (puede('revisar') && v.estado === 'EN_REVISION') {
      acciones.push({ icono: 'clipboard-outline', titulo: 'Revisar propuesta', onClick: abrirModalRevisar });
    }
    if (puede('trabajar') && v.estado === 'ASIGNADO') {
      acciones.push({ icono: 'play-outline', titulo: 'Comenzar', clase: 'icon-success', onClick: accionComenzar });
    }
    if (puede('trabajar') && v.estado === 'EN_PROCESO') {
      acciones.push({ icono: 'checkmark-done-outline', titulo: 'Entregar propuesta', clase: 'icon-success', onClick: abrirModalEntregar });
      acciones.push({ icono: 'close-outline', titulo: 'Cancelar proceso', clase: 'icon-danger', onClick: accionCancelarProceso });
    }
    if (puede('confirmar') && v.estado === 'APROBADO') {
      acciones.push({ icono: 'document-text-outline', titulo: 'Ver propuesta y confirmar', clase: 'icon-success', onClick: abrirModalPropuestaAsesor });
      acciones.push({ icono: 'close-circle-outline', titulo: 'Cancelar / Modificar', clase: 'icon-danger', onClick: abrirModalCancelarModificar });
    }
    if (puede('aprobarModificacion') && v.estado === 'CONFIRMACION_MODIFICACION') {
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
    const cerrar = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', cerrar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
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

  function abrirModalCrearVale() {
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

          <div class="section-title">Información de Venta</div>
          <div class="form-grid">
            <div class="form-field"><label>Fecha de entrega *</label><input type="datetime-local" name="fechaEntrega" required /></div>
            <div class="form-field"><label>Fecha del evento *</label><input type="datetime-local" name="fechaEvento" required /></div>
            <div class="form-field"><label>Código de producto *</label><select name="productoId" required>${opcionesSelect('productos')}</select></div>
            <div class="form-field"><label>Material *</label><select name="materialId" required>${opcionesSelect('materiales')}</select></div>
            <div class="form-field"><label>Técnica *</label><select name="tecnicaId" required>${opcionesSelect('tecnicas')}</select></div>
            <div class="form-field"><label>Acabado *</label><select name="acabadoId" required>${opcionesSelect('acabados')}</select></div>
            <div class="form-field"><label>Cantidad * (mayor a 1)</label><input type="number" name="cantidad" min="2" required /></div>
            <div class="form-field"><label>No. Cotización *</label><input type="number" name="cotizacion" min="0.01" step="0.01" required /></div>
            <div class="form-field form-checkbox full"><input type="checkbox" name="urgente" id="chk-urgente" /><label for="chk-urgente">Urgente</label></div>
          </div>

          <div class="section-title">Boceto y Descripción</div>
          <div class="form-grid">
            <div class="form-field full"><label>Descripción (máx. 600 caracteres)</label><textarea name="descripcion" maxlength="600"></textarea></div>
            <div class="form-field"><label>Imágenes (jpg, jpeg, png, webp — máx. 2MB c/u)</label><input type="file" name="imagenes" accept="image/jpeg,image/png,image/webp" multiple /></div>
            <div class="form-field"><label>Documentos adjuntos (PDF — máx. 3MB c/u)</label><input type="file" name="documentos" accept="application/pdf" multiple /></div>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn-secondary" id="btn-cancelar-crear">Cancelar</button>
        <button class="btn-primary" id="btn-guardar-crear">Crear Vale de Arte</button>
      `
    });

    overlay.querySelector('#btn-cancelar-crear').addEventListener('click', cerrar);
    overlay.querySelector('#btn-guardar-crear').addEventListener('click', async () => {
      const form = overlay.querySelector('#form-crear-vale');
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      formData.set('urgente', form.querySelector('[name="urgente"]').checked ? 'true' : 'false');
      const paisCodigo = form.querySelector('[name="clienteTelefonoPais"]').value;
      const telefonoNum = form.querySelector('[name="clienteTelefono"]').value.trim();
      formData.set('clienteTelefono', `${paisCodigo} ${telefonoNum}`);
      formData.delete('clienteTelefonoPais');

      const btn = overlay.querySelector('#btn-guardar-crear');
      btn.disabled = true;
      btn.textContent = 'Creando...';
      try {
        const res = await fetch('/api/vales', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo crear el vale de arte.');
        mostrarToast(`Vale de arte ${data.correlativo} creado correctamente.`, 'checkmark-circle-outline');
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
        btn.textContent = 'Crear Vale de Arte';
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
      footerHtml: `<button class="btn-secondary" id="btn-cerrar">Cancelar</button><button class="btn-primary" id="btn-confirmar">Asignar</button>`
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
        mostrarToast(`${vale.correlativo} asignado correctamente.`, 'checkmark-circle-outline');
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Modal: Revisar propuesta (encargado)
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
                ? `<a href="/${ultima.url}" target="_blank" class="btn-secondary" style="text-decoration:none;display:inline-flex;">Ver propuesta adjunta</a>`
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
        <button class="btn-danger" id="btn-desaprobar">Desaprobar y reasignar</button>
        <button class="btn-primary" id="btn-aprobar">Aprobar</button>
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
        mostrarToast(`${vale.correlativo} ${aprobar ? 'aprobado' : 'reasignado'} correctamente.`, 'checkmark-circle-outline');
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
      mostrarToast(`${vale.correlativo} marcado como en proceso.`, 'play-outline');
      cargarBuzon();
    } catch (error) {
      mostrarToast(error.message, 'alert-circle-outline');
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
      footerHtml: `<button class="btn-secondary" id="btn-cerrar">Cancelar</button><button class="btn-primary" id="btn-enviar">Entregar</button>`
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
        mostrarToast(`Propuesta de ${vale.correlativo} entregada.`, 'checkmark-done-outline');
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
      mostrarToast(`Proceso de ${vale.correlativo} cancelado.`, 'close-outline');
      cargarBuzon();
    } catch (error) {
      mostrarToast(error.message, 'alert-circle-outline');
    }
  }

  // -------------------------------------------------------------------------
  // Asesor: ver propuesta / confirmar / cancelar / modificar
  // -------------------------------------------------------------------------
  async function abrirModalPropuestaAsesor(vale) {
    let detalle;
    try {
      detalle = await (await fetch(`/api/vales/${vale.id}`)).json();
    } catch {
      detalle = { propuestas: [] };
    }
    const ultima = (detalle.propuestas || [])[detalle.propuestas.length - 1];

    const { overlay, cerrar } = abrirModal({
      title: `Propuesta recibida — ${vale.correlativo}`,
      bodyHtml: `
        <p style="font-size:13px;margin-bottom:14px;">Revisa la propuesta entregada por el técnico y confirma la venta si el cliente la aceptó.</p>
        ${ultima && ultima.url
          ? `<a href="/${ultima.url}" target="_blank" class="btn-secondary" style="text-decoration:none;display:inline-flex;">Ver propuesta adjunta</a>`
          : '<p style="font-size:13px;color:var(--color-outline);">El técnico no adjuntó documento de propuesta.</p>'}
      `,
      footerHtml: `<button class="btn-secondary" id="btn-cerrar">Cerrar</button><button class="btn-primary" id="btn-confirmar">Confirmar Venta</button>`
    });
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-confirmar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/confirmar`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        mostrarToast(`Venta de ${vale.correlativo} confirmada.`, 'checkmark-circle-outline');
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  function abrirModalCancelarModificar(vale) {
    const { overlay, cerrar } = abrirModal({
      title: `${vale.correlativo}`,
      bodyHtml: `<p style="font-size:13px;">¿Qué deseas hacer con este vale de arte?</p>`,
      footerHtml: `
        <button class="btn-secondary" id="btn-modificar" ${vale.modificado ? 'disabled title="Ya se usó la única modificación permitida"' : ''}>Solicitar Modificación</button>
        <button class="btn-danger" id="btn-cancelar-vale">Cancelar Vale</button>
      `
    });
    overlay.querySelector('#btn-cancelar-vale').addEventListener('click', async () => {
      if (!confirm(`¿Confirmas cancelar el vale ${vale.correlativo}? El cliente no compró.`)) return;
      try {
        const res = await fetch(`/api/vales/${vale.id}/cancelar`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        mostrarToast(`${vale.correlativo} cancelado.`, 'close-circle-outline');
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
      }
    });
    overlay.querySelector('#btn-modificar').addEventListener('click', () => {
      cerrar();
      abrirModalSolicitarModificacion(vale);
    });
  }

  function abrirModalSolicitarModificacion(vale) {
    const { overlay, cerrar } = abrirModal({
      title: `Solicitar modificación — ${vale.correlativo}`,
      size: 'lg',
      bodyHtml: `
        <form id="form-modificacion">
          <div class="form-field full">
            <label>Justificación de la modificación *</label>
            <textarea name="justificacion" required></textarea>
          </div>
          <div class="form-field full">
            <label>Nueva descripción</label>
            <textarea name="descripcion" maxlength="600">${vale.descripcion || ''}</textarea>
          </div>
          <div class="form-grid">
            <div class="form-field full"><label>Nuevas imágenes</label><input type="file" name="imagenes" accept="image/jpeg,image/png,image/webp" multiple /></div>
          </div>
        </form>
      `,
      footerHtml: `<button class="btn-secondary" id="btn-cerrar">Cancelar</button><button class="btn-primary" id="btn-enviar">Solicitar Modificación</button>`
    });
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-enviar').addEventListener('click', async () => {
      const form = overlay.querySelector('#form-modificacion');
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const btn = overlay.querySelector('#btn-enviar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/solicitar-modificacion`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        mostrarToast(`Modificación solicitada para ${data.correlativo}.`, 'checkmark-circle-outline');
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Supervisor: aprobar modificación
  // -------------------------------------------------------------------------
  function abrirModalAprobarModificacion(vale) {
    const { overlay, cerrar } = abrirModal({
      title: `Autorizar modificación — ${vale.correlativo}`,
      bodyHtml: `<p style="font-size:13px;">¿Confirmas autorizar la modificación solicitada para este vale de arte? El vale volverá al buzón de encargados para continuar su proceso.</p>`,
      footerHtml: `<button class="btn-secondary" id="btn-cerrar">Cancelar</button><button class="btn-primary" id="btn-confirmar">Autorizar</button>`
    });
    overlay.querySelector('#btn-cerrar').addEventListener('click', cerrar);
    overlay.querySelector('#btn-confirmar').addEventListener('click', async () => {
      const btn = overlay.querySelector('#btn-confirmar');
      btn.disabled = true;
      try {
        const res = await fetch(`/api/vales/${vale.id}/aprobar-modificacion`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        mostrarToast(`Modificación de ${vale.correlativo} autorizada.`, 'checkmark-circle-outline');
        cerrar();
        cargarBuzon();
      } catch (error) {
        mostrarErrorModal(overlay, error.message);
        btn.disabled = false;
      }
    });
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
          ${(detalle.historial || []).map(h => `<li><span class="fecha">${formatearFechaHora(h.creado_en)}</span>${h.accion}</li>`).join('') || '<li>Sin movimientos registrados.</li>'}
        </ul>
      `
    });
    void overlay;
  }

  // -------------------------------------------------------------------------
  // Carga de trabajo (encargados) — se mantiene actualizada en tiempo real
  // mientras el modal (o su detalle) está abierto, sin necesidad de cerrarlo.
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
        <div class="carga-barra"><div class="carga-barra-fill" style="width:${(t.asignaciones / maxAsignaciones) * 100}%"></div></div>
        <div style="font-size:12px;color:var(--color-on-surface-variant);">
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
      <table class="buzon-table"><thead><tr><th>Correlativo</th><th>Entrega</th><th>Estado</th></tr></thead>
      <tbody>${vales.map(v => `
        <tr${v.atrasado ? ' style="color:var(--color-error);"' : ''}>
          <td>${v.correlativo}</td><td>${formatearFecha(v.fecha_entrega)}</td>
          <td><span class="estado-pill estado-${v.estado}">${ESTADOS_LABEL[v.estado] || v.estado}</span></td>
        </tr>`).join('')}</tbody></table>
    ` : '<p style="font-size:13px;">Este técnico no tiene asignaciones activas.</p>';
  }

  function abrirModalAsignacionesTecnico(tecnicoId) {
    const { overlay } = abrirModal({ title: 'Asignaciones del técnico', bodyHtml: '<p class="tabla-vacia">Cargando...</p>' });
    state.cargaTrabajoModal = { overlay, actualizar: () => renderContenidoAsignacionesTecnico(overlay, tecnicoId) };
    renderContenidoAsignacionesTecnico(overlay, tecnicoId);
  }
})();
