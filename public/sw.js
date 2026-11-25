// Service worker solo para avisos push: no guarda nada en caché (jamás páginas ni API autenticadas).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Sin responder nada: solo para que Chrome considere el sitio instalable.
self.addEventListener('fetch', () => {});

// Apple cancela la suscripción si un push no muestra nada: iPhone, iPad y Safari avisan siempre.
function esApple() {
  const ua = self.navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/.test(ua));
}

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { cuerpo: event.data ? event.data.text() : '' };
  }

  event.waitUntil((async () => {
    // Con una pestaña visible y enfocada ya avisa el propio portal (toast y campana).
    if (!esApple()) {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (ventanas.some(v => v.visibilityState === 'visible' && v.focused)) return;
    }
    await self.registration.showNotification(datos.titulo || 'Portal Empresarial', {
      body: datos.cuerpo || '',
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/badge-72.png',
      tag: datos.tag,
      data: { url: datos.url || '/dashboard/' }
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/dashboard/', self.location.origin);
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find(v => new URL(v.url).origin === self.location.origin);
    if (!abierta) {
      await self.clients.openWindow(destino.href);
      return;
    }
    await abierta.focus();
    // Si ya está en ese módulo no se recarga: se perdería lo que tenga a medias.
    const actual = new URL(abierta.url).pathname;
    if (!actual.startsWith(destino.pathname) && 'navigate' in abierta) await abierta.navigate(destino.href).catch(() => {});
  })());
});
