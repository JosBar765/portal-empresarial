// public/js/pushDispositivo.js
// Avisos del sistema en ESTE dispositivo (Web Push): activar, desactivar, reparar al cargar o volver a la app y soltar al cerrar sesión.
// Expone window.pushDispositivo; las funciones puras también se exportan para las pruebas en Node.
(() => {
  const API = '/api/notificaciones/push';
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  const ESPERA_AL_SALIR_MS = 2500;
  const CLAVE_PROPIETARIO = 'push:propietario'; // quién activó este dispositivo

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

  // Qué hacer con la suscripción de este navegador según quién la activó y quién tiene la sesión.
  function planSincronizacion({ permiso, usuarioId, propietario, suscrito, claveCoincide }) {
    if (permiso !== 'granted' || !usuarioId) return 'nada';
    if (propietario === null) {
      // Activado antes de recordar al dueño: se adopta lo que ya exista, sin crear nada.
      if (!suscrito) return 'nada';
    } else if (propietario !== usuarioId) {
      return suscrito ? 'soltar' : 'nada';
    }
    return suscrito && claveCoincide ? 'registrar' : 'recrear';
  }

  // Una suscripción solo admite envíos firmados con la clave con la que se creó.
  function mismaClave(actual, esperada) {
    if (!actual) return true; // el navegador no la informa: no se toca
    const bytes = new Uint8Array(actual);
    return bytes.length === esperada.length && bytes.every((b, i) => b === esperada[i]);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { esIOS, clasificarDispositivo, resolverEstado, planSincronizacion, mismaClave };
  if (typeof window === 'undefined') return;

  let configCache = null;

  const soportado = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const instalado = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  function propietario() {
    try { return Number(localStorage.getItem(CLAVE_PROPIETARIO)) || null; } catch { return null; }
  }

  function recordarPropietario(usuarioId) {
    try {
      if (usuarioId) localStorage.setItem(CLAVE_PROPIETARIO, String(usuarioId));
      else localStorage.removeItem(CLAVE_PROPIETARIO);
    } catch { /* sin almacenamiento: habrá que activar a mano */ }
  }

  // `fresca`: vuelve a preguntar, porque la sesión del navegador puede haber cambiado desde que se cargó la página.
  async function config(fresca = false) {
    if (configCache && !fresca) return configCache;
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

  async function suscribir(clavePublica) {
    await navigator.serviceWorker.register('/sw.js');
    const registro = await navigator.serviceWorker.ready;
    const opciones = { userVisibleOnly: true, applicationServerKey: claveABytes(clavePublica) };
    try {
      return await registro.pushManager.subscribe(opciones);
    } catch (error) {
      // Quedó una suscripción hecha con otra clave del servidor: se reemplaza.
      const anterior = await registro.pushManager.getSubscription();
      if (!anterior) throw error;
      await anterior.unsubscribe();
      return registro.pushManager.subscribe(opciones);
    }
  }

  // Borra la suscripción en el servidor (hace falta sesión) y en el navegador; no toca quién es el dueño.
  async function soltar() {
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

  // Solo desde un clic y con la configuración ya cargada: pedir el permiso va primero para no perder el gesto del usuario.
  async function activar() {
    if (!configCache || !configCache.habilitado || !soportado()) throw new Error('Los avisos no están disponibles en este dispositivo.');
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return estado();
    await guardar(await suscribir(configCache.clavePublica));
    recordarPropietario(configCache.usuarioId);
    return estado();
  }

  let enCurso = null;
  let saliendo = false;

  // «Desactivar»: además de soltar, olvida la elección para que no vuelva solo.
  async function desactivar() {
    await enCurso;
    recordarPropietario(null);
    await soltar();
  }

  // «Cerrar sesión»: suelta el dispositivo pero recuerda al dueño, que lo recupera al volver a entrar.
  async function soltarAlSalir() {
    saliendo = true;
    await enCurso;
    await soltar();
  }

  async function reparar() {
    if (saliendo || !soportado() || Notification.permission !== 'granted') return;
    const cfg = await config(true);
    if (!cfg.habilitado) return;
    const suscripcion = await suscripcionActual();
    const plan = planSincronizacion({
      permiso: Notification.permission,
      usuarioId: cfg.usuarioId,
      propietario: propietario(),
      suscrito: Boolean(suscripcion),
      claveCoincide: !suscripcion || mismaClave(suscripcion.options && suscripcion.options.applicationServerKey, claveABytes(cfg.clavePublica))
    });
    if (plan === 'soltar') { await suscripcion.unsubscribe(); return; } // es de otra persona: el servidor la descarta en el próximo envío
    if (plan === 'registrar') await guardar(suscripcion);
    if (plan === 'recrear') {
      await soltar();
      await guardar(await suscribir(cfg.clavePublica)); // iOS puede exigir un toque: si falla, queda el botón «Activar»
    }
    if (plan !== 'nada') recordarPropietario(cfg.usuarioId);
  }

  // Al cargar y al volver a la app: reasocia, recupera lo perdido y cambia de clave. Nunca pide permiso.
  function sincronizar() {
    if (!enCurso) enCurso = reparar().catch(() => { /* se reintenta en la próxima ocasión */ }).finally(() => { enCurso = null; });
    return enCurso;
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
    Promise.race([soltarAlSalir(), limite]).catch(() => {}).then(() => {
      salidaLista = true;
      boton.click();
    });
  }, true);

  window.pushDispositivo = { config, estado, activar, desactivar, soltarAlSalir, sincronizar, alCambiarPermiso };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  sincronizar();
})();
