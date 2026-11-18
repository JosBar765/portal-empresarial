// public/js/mantenimientoAviso.js
// Aviso con cuenta regresiva del Modo Mantenimiento (lo ven todos, también el Administrador).
// Cada página lo inicia con su socket: window.avisoMantenimiento.iniciar({ socket, rolId }).
(() => {
  const RESYNC_MS = 30 * 1000;
  let barra = null;
  let textoCuenta = null;
  let textoMensaje = null;
  let intervalo = null;
  let finMs = null; // instante local (Date.now) en que termina la cuenta
  let iniciado = false;
  let esAdministrador = false;
  let mini = null;
  const CLAVE_MINIMIZADO = 'avisoMantenimientoMinimizado';

  // Se recuerda en la pestaña para que no reaparezca al cambiar de módulo; sin storage disponible, simplemente no se recuerda.
  function leerMinimizado() {
    try { return sessionStorage.getItem(CLAVE_MINIMIZADO) === '1'; } catch { return false; }
  }
  function guardarMinimizado(valor) {
    try { if (valor) sessionStorage.setItem(CLAVE_MINIMIZADO, '1'); else sessionStorage.removeItem(CLAVE_MINIMIZADO); } catch { /* sin storage */ }
  }
  function aplicarMinimizado(minimizado) {
    barra.hidden = minimizado;
    mini.hidden = !minimizado;
  }

  function crearBarra() {
    const estilo = document.createElement('style');
    estilo.textContent = `
      .aviso-mantenimiento { position: fixed; left: 0; right: 0; bottom: 0; z-index: 9000; display: flex; flex-wrap: wrap;
        align-items: center; justify-content: center; gap: 4px 12px; padding: 10px 16px; font-family: var(--font-body, 'Inter', sans-serif);
        font-size: var(--text-sm, 0.8125rem); line-height: 1.4; text-align: center; color: var(--color-text, #0F172A);
        background: var(--color-warning-bg, #FFFBEB); border-top: 2px solid var(--color-warning, #D97706); }
      .aviso-mantenimiento[hidden] { display: none; }
      .aviso-mantenimiento strong { font-weight: 600; }
      .aviso-mantenimiento__mensaje { color: var(--color-text-secondary, #475569); }
      .aviso-mantenimiento__ocultar, .aviso-mantenimiento-mini { font: inherit; cursor: pointer; color: inherit; }
      .aviso-mantenimiento__ocultar { margin-left: 8px; padding: 2px 10px; border: 1px solid var(--color-warning, #D97706); border-radius: 6px; background: transparent; }
      .aviso-mantenimiento-mini { position: fixed; right: 12px; bottom: 12px; z-index: 9000; padding: 6px 12px; border-radius: 999px;
        font-size: var(--text-sm, 0.8125rem); background: var(--color-warning-bg, #FFFBEB); border: 2px solid var(--color-warning, #D97706); }
      .aviso-mantenimiento-mini[hidden] { display: none; }`;
    document.head.appendChild(estilo);

    barra = document.createElement('div');
    barra.className = 'aviso-mantenimiento';
    barra.setAttribute('role', 'status');
    barra.hidden = true;
    textoCuenta = document.createElement('strong');
    textoMensaje = document.createElement('span');
    textoMensaje.className = 'aviso-mantenimiento__mensaje';
    const botonOcultar = document.createElement('button');
    botonOcultar.type = 'button';
    botonOcultar.className = 'aviso-mantenimiento__ocultar';
    botonOcultar.textContent = 'Ocultar';
    botonOcultar.title = 'Ocultar el aviso (queda un contador pequeño)';
    barra.append(textoCuenta, textoMensaje, botonOcultar);
    document.body.appendChild(barra);

    // Al ocultarlo queda un contador pequeño: si estorba una acción se quita de en medio, pero no se pierde el tiempo restante.
    mini = document.createElement('button');
    mini.type = 'button';
    mini.className = 'aviso-mantenimiento-mini';
    mini.title = 'Mostrar el aviso de mantenimiento';
    mini.hidden = true;
    document.body.appendChild(mini);

    botonOcultar.addEventListener('click', () => { guardarMinimizado(true); aplicarMinimizado(true); });
    mini.addEventListener('click', () => { guardarMinimizado(false); aplicarMinimizado(false); });
  }

  const formato = (seg) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

  function ocultar() {
    clearInterval(intervalo);
    intervalo = null;
    finMs = null;
    if (barra) { barra.hidden = true; mini.hidden = true; }
    guardarMinimizado(false); // un mantenimiento nuevo vuelve a mostrarse completo
  }

  function pintar() {
    const restante = Math.max(0, Math.ceil((finMs - Date.now()) / 1000));
    textoCuenta.textContent = `El sistema entra en mantenimiento en ${formato(restante)}. Guarda tu trabajo.`;
    mini.textContent = `Mantenimiento en ${formato(restante)}`;
    if (restante === 0) {
      clearInterval(intervalo);
      // El Administrador no queda bloqueado: no se recarga su página para no hacerle perder lo que esté haciendo.
      // Margen para que el servidor ya esté bloqueando al recargar.
      if (!esAdministrador) setTimeout(() => window.location.reload(), 1500);
    }
  }

  function mostrar(segundos, mensaje) {
    if (!barra) crearBarra();
    finMs = Date.now() + segundos * 1000;
    textoMensaje.textContent = mensaje || '';
    aplicarMinimizado(leerMinimizado());
    pintar();
    if (!intervalo) intervalo = setInterval(pintar, 1000);
  }

  function aplicar(estado) {
    if (estado && estado.enCuentaRegresiva) mostrar(estado.segundosRestantes, estado.mensaje);
    else ocultar();
  }

  async function consultar() {
    try {
      const res = await fetch('/api/mantenimiento/estado');
      // Con el bloqueo ya activo la página se recarga para mostrar la pantalla de mantenimiento.
      if (res.status === 503) return window.location.reload();
      if (res.ok) aplicar(await res.json());
    } catch { /* sin conexión: se reintenta en la próxima resincronización */ }
  }

  function iniciar({ socket, rolId } = {}) {
    if (iniciado) return;
    iniciado = true;
    esAdministrador = rolId === 1;
    consultar();
    setInterval(consultar, RESYNC_MS);
    if (socket) {
      socket.on('mantenimiento_programado', (d) => mostrar(d.segundosRestantes, d.mensaje));
      socket.on('mantenimiento_cancelado', ocultar);
    }
  }

  window.avisoMantenimiento = { iniciar };
})();
