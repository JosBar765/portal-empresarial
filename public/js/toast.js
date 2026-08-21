// public/js/toast.js
// Sistema compartido de notificaciones flotantes — window.toast.
// Cualquier módulo lo usa incluyendo este script y llamando
// window.toast.success/error/warning/info(titulo, mensaje) o
// window.toastDeshacer(mensaje, deshacerFn) para acciones reversibles.
// Estilos en public/css/global.css (.toast-root/.toast/.toast--*).
(() => {
  const ICONOS = {
    success: 'checkmark-circle-outline',
    error: 'alert-circle-outline',
    warning: 'warning-outline',
    info: 'information-circle-outline'
  };

  function obtenerRoot() {
    let root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      root.className = 'toast-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function mostrar(tipo, titulo, mensaje, opciones = {}) {
    const root = obtenerRoot();
    const toast = document.createElement('div');
    toast.className = `toast toast--${tipo}${opciones.undo ? ' toast--undo' : ''}`;
    const icono = ICONOS[tipo] || ICONOS.info;
    const duracion = opciones.duracion || (opciones.undo ? 6000 : 5000);

    toast.innerHTML = `
      <ion-icon name="${icono}"></ion-icon>
      <div class="toast-body">
        ${titulo ? '<span class="toast-title"></span>' : ''}
        <span class="toast-message"></span>
      </div>
      ${opciones.undo ? '<button type="button" class="toast-undo-btn">Deshacer</button>' : ''}
      ${opciones.undo ? '<div class="toast-progress"></div>' : ''}
    `;
    if (titulo) toast.querySelector('.toast-title').textContent = titulo;
    toast.querySelector('.toast-message').textContent = mensaje || '';

    let descartado = false;
    const cerrar = () => {
      if (descartado) return;
      descartado = true;
      toast.remove();
    };

    if (opciones.undo) {
      const progress = toast.querySelector('.toast-progress');
      progress.style.animationDuration = `${duracion}ms`;
      toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
        cerrar();
        Promise.resolve(opciones.undo()).catch(() => { /* deshacer falló silenciosamente */ });
      });
    }

    root.appendChild(toast);
    setTimeout(cerrar, duracion);
    return { cerrar };
  }

  window.toast = {
    success: (titulo, mensaje) => mostrar('success', titulo, mensaje),
    error: (titulo, mensaje) => mostrar('error', titulo, mensaje),
    warning: (titulo, mensaje) => mostrar('warning', titulo, mensaje),
    info: (titulo, mensaje) => mostrar('info', titulo, mensaje)
  };

  window.toastDeshacer = (mensaje, deshacerFn) => mostrar('warning', null, mensaje, { undo: deshacerFn });
})();
