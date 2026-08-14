// public/js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
  const userDisplayName = document.getElementById('user-display-name');
  const userDisplayRole = document.getElementById('user-display-role');
  const welcomeMessage = document.getElementById('welcome-message');
  const logoutBtn = document.getElementById('logout-btn');
  const modulesContainer = document.getElementById('modules-container');

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
    welcomeMessage.textContent = `¡Hola, ${currentUser.nombre.split(' ')[0]}!`;
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
    renderModules(modules);
  } catch (error) {
    console.error('Error cargando módulos:', error);
    modulesContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <ion-icon name="alert-circle-outline" style="color: var(--color-error);"></ion-icon>
        <h3>Error al cargar herramientas</h3>
        <p>No pudimos recuperar tus módulos autorizados. Recarga la página o inténtalo más tarde.</p>
      </div>
    `;
  }

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
          <h3 class="module-title">
            <span>${module.nombre}</span>
            <ion-icon name="arrow-forward-outline"></ion-icon>
          </h3>
          <p class="module-description">${module.descripcion}</p>
        </div>
      `;

      // Prevenir navegación a links de demostración sin implementar e informar
      card.addEventListener('click', (e) => {
        // En una implementación real, esto cargará la vista del módulo
        // Por ahora, como los módulos no están creados físicamente:
        e.preventDefault();
        alert(`Módulo "${module.nombre}" seleccionado. La arquitectura del backend y frontend ya está lista para hospedar este módulo modular bajo "/public/modules/${module.id}" y "/src/modules/${module.id}".`);
      });

      modulesContainer.appendChild(card);
    });
  }
});
