// public/js/mantenimientoAviso.js
// Aviso con cuenta regresiva del Modo Mantenimiento (no aparece para Administrador).
// Cada página lo inicia con su socket: window.avisoMantenimiento.iniciar({ socket, rolId }).
(() => {
  const RESYNC_MS = 30 * 1000;
  let barra = null;
  let textoCuenta = null;
  let textoMensaje = null;
  let intervalo = null;
  let finMs = null; // instante local (Date.now) en que termina la cuenta
  let iniciado = false;

  function crearBarra() {
    const estilo = document.createElement('style');
    estilo.textContent = `
      .aviso-mantenimiento { position: fixed; left: 0; right: 0; bottom: 0; z-index: 9000; display: flex; flex-wrap: wrap;
        align-items: center; justify-content: center; gap: 4px 12px; padding: 10px 16px; font-family: var(--font-body, 'Inter', sans-serif);
        font-size: var(--text-sm, 0.8125rem); line-height: 1.4; text-align: center; color: var(--color-text, #0F172A);
        background: var(--color-warning-bg, #FFFBEB); border-top: 2px solid var(--color-warning, #D97706); }
      .aviso-mantenimiento[hidden] { display: none; }
      .aviso-mantenimiento strong { font-weight: 600; }
      .aviso-mantenimiento__mensaje { color: var(--color-text-secondary, #475569); }`;
    document.head.appendChild(estilo);

    barra = document.createElement('div');
    barra.className = 'aviso-mantenimiento';
    barra.setAttribute('role', 'status');
    barra.hidden = true;
    textoCuenta = document.createElement('strong');
    textoMensaje = document.createElement('span');
    textoMensaje.className = 'aviso-mantenimiento__mensaje';
    barra.append(textoCuenta, textoMensaje);
    document.body.appendChild(barra);
  }

  const formato = (seg) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

  function ocultar() {
    clearInterval(intervalo);
    intervalo = null;
    finMs = null;
    if (barra) barra.hidden = true;
  }

  function pintar() {
    const restante = Math.max(0, Math.ceil((finMs - Date.now()) / 1000));
    textoCuenta.textContent = `El sistema entra en mantenimiento en ${formato(restante)}. Guarda tu trabajo.`;
    if (restante === 0) {
      clearInterval(intervalo);
      // Margen para que el servidor ya esté bloqueando al recargar.
      setTimeout(() => window.location.reload(), 1500);
    }
  }

  function mostrar(segundos, mensaje) {
    if (!barra) crearBarra();
    finMs = Date.now() + segundos * 1000;
    textoMensaje.textContent = mensaje || '';
    barra.hidden = false;
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
    if (iniciado || rolId === 1) return;
    iniciado = true;
    consultar();
    setInterval(consultar, RESYNC_MS);
    if (socket) {
      socket.on('mantenimiento_programado', (d) => mostrar(d.segundosRestantes, d.mensaje));
      socket.on('mantenimiento_cancelado', ocultar);
    }
  }

  window.avisoMantenimiento = { iniciar };
})();
