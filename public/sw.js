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
    // Solo si está a la vista el MISMO módulo ya avisa el portal; los demás módulos ignoran avisos ajenos.
    if (!esApple()) {
      const modulo = new URL(datos.url || '/dashboard/', self.location.origin).pathname;
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (ventanas.some(v => v.visibilityState === 'visible' && v.focused && new URL(v.url).pathname.startsWith(modulo))) return;
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
  const aviso = Number(destino.searchParams.get('aviso')) || null;
  event.waitUntil((async () => {
    const ventanas = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(v => new URL(v.url).origin === self.location.origin);
    // La que ya está en ese módulo no se recarga (se perdería lo que tenga a medias): se le dice qué abrir.
    const enModulo = ventanas.find(v => new URL(v.url).pathname.startsWith(destino.pathname));
    if (enModulo) {
      await enModulo.focus();
      if (aviso) enModulo.postMessage({ tipo: 'abrir-aviso', id: aviso });
      return;
    }
    const abierta = ventanas[0];
    if (abierta && 'navigate' in abierta) {
      await abierta.focus();
      try {
        await abierta.navigate(destino.href);
        return;
      } catch { /* una ventana que este service worker no controla no se puede navegar */ }
    }
    await self.clients.openWindow(destino.href);
  })());
});
