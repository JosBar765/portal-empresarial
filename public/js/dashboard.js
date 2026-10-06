// public/js/dashboard.js
// Iniciales del avatar de cuenta (p. ej. "Asesor Comercial" -> "AC") —
// compartido por convención con la misma lógica en modules/vales/js/app.js
// (no hay un sistema de módulos JS compartidos entre páginas en este proyecto).
function inicialesAvatar(nombreCompleto) {
  const palabras = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '--';
  const iniciales = palabras.length === 1 ? palabras[0][0] : palabras[0][0] + palabras[1][0];
  return iniciales.toUpperCase();
}

document.addEventListener('DOMContentLoaded', async () => {
  const userDisplayName = document.getElementById('user-display-name');
  const userDisplayRole = document.getElementById('user-display-role');
  const accountAvatar = document.getElementById('account-avatar');
  const accountWidget = document.getElementById('account-widget');
  const accountDropdown = document.getElementById('account-dropdown');
  const accountDropdownName = document.getElementById('account-dropdown-name');
  const accountDropdownRole = document.getElementById('account-dropdown-role');
  const welcomeMessage = document.getElementById('welcome-message');
  const logoutBtn = document.getElementById('logout-btn');
  const modulesContainer = document.getElementById('modules-container');
  const modulesCount = document.getElementById('modules-count');

  let currentUser = null;

  // 1. Verificar Sesión Activa
  try {
    const sessionRes = await fetch('/api/auth.php?action=session_check');
    const sessionData = await sessionRes.json();

    if (!sessionData.autenticado) {
      // Redirigir al login si no está autenticado
      window.location.href = '/login/?expired=true';
      return;
    }

    currentUser = sessionData.user;

    // Rellenar información de usuario en el header y bienvenida
    userDisplayName.textContent = currentUser.nombre;
    userDisplayRole.textContent = currentUser.rolNombre;
    accountDropdownName.textContent = currentUser.nombre;
    accountDropdownRole.textContent = currentUser.rolNombre;
    accountAvatar.textContent = inicialesAvatar(currentUser.nombre);
    const primerNombre = currentUser.nombre.split(' ')[0];
    welcomeMessage.innerHTML = `¡Hola, <span class="text-accent">${primerNombre}</span>!`;
  } catch (error) {
    console.error('Error verificando sesión:', error);
    window.location.href = '/login/?error=conexion';
    return;
  }

  // 2. Cargar Módulos Autorizados
  try {
    const modulesRes = await fetch('/api/modules');
    if (!modulesRes.ok) throw new Error('Error al obtener la lista de módulos.');
    
    const modules = await modulesRes.json();
    modulesCount.textContent = modules.length === 1 ? '1 módulo' : `${modules.length} módulos`;
    renderModules(modules);
  } catch (error) {
    console.error('Error cargando módulos:', error);
    modulesContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <ion-icon name="alert-circle-outline" style="color: var(--color-danger);"></ion-icon>
        <h3>Error al cargar herramientas</h3>
        <p>No pudimos recuperar tus módulos autorizados. Recarga la página o inténtalo más tarde.</p>
      </div>
    `;
  }

  // 2b. Menú desplegable de cuenta (avatar) — abre/cierra con clic, se cierra
  // al hacer clic afuera o con Escape.
  function cerrarMenuCuenta() {
    accountDropdown.classList.remove('visible');
    accountWidget.setAttribute('aria-expanded', 'false');
  }
  accountWidget.addEventListener('click', (e) => {
    e.stopPropagation();
    const abierto = accountDropdown.classList.toggle('visible');
    accountWidget.setAttribute('aria-expanded', String(abierto));
  });
  document.addEventListener('click', (e) => {
    if (!accountDropdown.contains(e.target) && !accountWidget.contains(e.target)) cerrarMenuCuenta();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarMenuCuenta();
  });

  // 3. Manejar Botón de Salir (Logout)
  logoutBtn.addEventListener('click', async () => {
    try {
      const logoutRes = await fetch('/api/auth.php?action=logout');
      const logoutData = await logoutRes.json();
      if (logoutData.ok) {
        window.location.href = '/login/';
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Fallback
      window.location.href = '/login/';
    }
  });

  // 4. Inicializar Conexión Transversal WebSocket
  if (typeof io !== 'undefined' && currentUser) {
    const socket = io({
      query: { userId: currentUser.id }
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Conectado exitosamente al canal de notificaciones en tiempo real del portal.');
      
      // Registrarse en el canal del rol de usuario
      socket.emit('register_module', `role_${currentUser.rolId}`);
    });

    // Escuchar notificaciones del portal en tiempo real
    socket.on('portal_notification', (data) => {
      console.log('[WebSocket] Notificación del portal recibida:', data);
      // Aquí se podrían renderizar popups, alertas flotantes o badges de actualización
    });

    // analisis_correcciones_17.md #2: el admin cambió los permisos de mi
    // rol — renuevo el JWT (sin pedir credenciales) y recargo para que el
    // catálogo de módulos refleje los permisos vigentes.
    socket.on('permisos_actualizados', async () => {
      await fetch('/api/auth/refresh', { method: 'POST' });
      window.location.reload();
    });

    // El admin desactivó esta cuenta mientras seguía conectada — su JWT ya
    // emitido seguiría siendo válido hasta expirar por su cuenta si no se
    // fuerza el logout aquí (authenticateJWT nunca reconsulta `activo`).
    socket.on('sesion_revocada', async () => {
      await fetch('/api/auth.php?action=logout');
      window.location.href = '/login/?expired=true';
    });
  }

  // Función para renderizar tarjetas de módulos en la cuadrícula
  function renderModules(modules) {
    if (!modules || modules.length === 0) {
      modulesContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <ion-icon name="lock-closed-outline"></ion-icon>
          <h3>Sin módulos autorizados</h3>
          <p>Tu rol actual de usuario no tiene asignado ningún módulo activo. Por favor, solicita permisos a TI.</p>
        </div>
      `;
      return;
    }

    modulesContainer.innerHTML = ''; // Limpiar preloader

    modules.forEach(module => {
      const card = document.createElement('a');
      card.href = module.path;
      card.className = 'module-card';
      card.style.setProperty('--module-color', module.color);
      
      card.innerHTML = `
        <div class="module-icon-container">
          <ion-icon name="${module.icono}"></ion-icon>
        </div>
        <div class="module-info">
          <h3 class="module-title">${module.nombre}</h3>
          <p class="module-description">${module.descripcion}</p>
        </div>
        <div class="module-cta">
          <span>Abrir herramienta</span>
          <span class="module-cta-icon"><ion-icon name="arrow-forward-outline"></ion-icon></span>
        </div>
      `;

      modulesContainer.appendChild(card);
    });
  }
});
