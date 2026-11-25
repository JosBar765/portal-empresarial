// public/js/pushDispositivo.js
// Avisos del sistema en ESTE dispositivo (Web Push): activar, desactivar, reasociar al cargar y borrar al cerrar sesión.
// Expone window.pushDispositivo; las funciones puras también se exportan para las pruebas en Node.
(() => {
  const API = '/api/notificaciones/push';
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  const ESPERA_AL_SALIR_MS = 2500;

  // iPadOS se presenta como una Mac: solo la pantalla táctil lo delata.
  const esIOS = (userAgent, puntosTactiles) => /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && puntosTactiles > 1);

  const clasificarDispositivo = (userAgent, puntosTactiles) => (esIOS(userAgent, puntosTactiles) || /Android|Mobi/.test(userAgent) ? 'movil' : 'escritorio');

  function resolverEstado({ habilitado, ios, instalado, soportado, permiso, suscrito }) {
    if (!habilitado) return 'deshabilitado';
    if (ios && !instalado) return 'ios';
    if (!soportado) return 'no-soportado';
    if (permiso === 'denied') return 'bloqueado';
    return permiso === 'granted' && suscrito ? 'activo' : 'inactivo';
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { esIOS, clasificarDispositivo, resolverEstado };
  if (typeof window === 'undefined') return;

  let configCache = null;

  const soportado = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const instalado = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  async function config() {
    if (configCache) return configCache;
    try {
      const res = await fetch(`${API}/config`, { credentials: 'same-origin' });
      if (!res.ok) return { habilitado: false };
      configCache = await res.json();
      return configCache;
    } catch {
      return { habilitado: false };
    }
  }

  async function suscripcionActual() {
    const registro = await navigator.serviceWorker.getRegistration('/');
    return registro ? registro.pushManager.getSubscription() : null;
  }

  async function estado() {
    const cfg = await config();
    let suscrito = false;
    if (cfg.habilitado && soportado() && Notification.permission === 'granted') {
      try { suscrito = Boolean(await suscripcionActual()); } catch { /* se considera inactivo */ }
    }
    return resolverEstado({
      habilitado: cfg.habilitado,
      ios: esIOS(navigator.userAgent, navigator.maxTouchPoints),
      instalado: instalado(),
      soportado: soportado(),
      permiso: soportado() ? Notification.permission : 'default',
      suscrito
    });
  }

  function claveABytes(base64url) {
    const base64 = (base64url + '='.repeat((4 - base64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  async function guardar(suscripcion) {
    const res = await fetch(`${API}/suscripcion`, {
      method: 'POST', headers: JSON_HEADERS, credentials: 'same-origin',
      body: JSON.stringify({ ...suscripcion.toJSON(), dispositivo: clasificarDispositivo(navigator.userAgent, navigator.maxTouchPoints) })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'El portal no pudo guardar este dispositivo.');
    }
  }

  // Solo desde un clic y con la configuración ya cargada: pedir el permiso va primero para no perder el gesto del usuario.
  async function activar() {
    if (!configCache || !configCache.habilitado || !soportado()) throw new Error('Los avisos no están disponibles en este dispositivo.');
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return estado();
    await navigator.serviceWorker.register('/sw.js');
    const registro = await navigator.serviceWorker.ready;
    const opciones = { userVisibleOnly: true, applicationServerKey: claveABytes(configCache.clavePublica) };
    let suscripcion;
    try {
      suscripcion = await registro.pushManager.subscribe(opciones);
    } catch {
      // Quedó una suscripción hecha con otra clave del servidor: se reemplaza.
      const anterior = await registro.pushManager.getSubscription();
      if (anterior) await anterior.unsubscribe();
      suscripcion = await registro.pushManager.subscribe(opciones);
    }
    await guardar(suscripcion);
    return estado();
  }

  async function desactivar() {
    if (!soportado()) return;
    const suscripcion = await suscripcionActual();
    if (!suscripcion) return;
    try {
      await fetch(`${API}/suscripcion`, {
        method: 'DELETE', headers: JSON_HEADERS, credentials: 'same-origin', body: JSON.stringify({ endpoint: suscripcion.endpoint })
      });
    } finally {
      await suscripcion.unsubscribe();
    }
  }

  // En cada carga: reasocia la suscripción de este navegador al usuario actual (equipos compartidos). Idempotente.
  async function sincronizar() {
    try {
      if (!soportado() || Notification.permission !== 'granted' || !(await config()).habilitado) return;
      const suscripcion = await suscripcionActual();
      if (suscripcion) await guardar(suscripcion);
    } catch { /* se reintenta en la próxima carga */ }
  }

  function alCambiarPermiso(cb) {
    if (!navigator.permissions || !navigator.permissions.query) return;
    navigator.permissions.query({ name: 'notifications' }).then((p) => { p.addEventListener('change', cb); }).catch(() => {});
  }

  // «Cerrar sesión» de cualquier pantalla: se retiene el clic hasta borrar el dispositivo (aún con sesión) y luego se repite.
  let salidaLista = false;
  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest && evento.target.closest('#logout-btn');
    if (!boton || salidaLista || !soportado() || Notification.permission !== 'granted') return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    const limite = new Promise(resolver => setTimeout(resolver, ESPERA_AL_SALIR_MS));
    Promise.race([desactivar(), limite]).catch(() => {}).then(() => {
      salidaLista = true;
      boton.click();
    });
  }, true);

  window.pushDispositivo = { config, estado, activar, desactivar, sincronizar, alCambiarPermiso };
  sincronizar();
})();
