# Viabilidad: notificaciones nativas de Windows (analisis_correcciones_14.md #14, punto 15)

## Pedido

Hoy una notificación de Vales de Arte es un toast interno de la página (`window.toast.info/error`, `public/modules/vales/js/app.js:650-668`) más un beep sintetizado (`reproducirBeep()`, `AudioContext`). Si el usuario no tiene la pestaña visible, no se entera de nada salvo el sonido. Se pide que las notificaciones "salgan en pantalla" también fuera de la pestaña — idealmente como una notificación nativa de Windows.

## Opción recomendada: Web Notifications API

`Notification.requestPermission()` + `new Notification(titulo, opciones)` es una API del navegador (Chrome/Edge en Windows la muestra como un toast nativo del sistema operativo, en la esquina de notificaciones), sin backend nuevo ni dependencias.

**Enganche**: el gancho en tiempo real ya existe — `state.socket.on('vale_evento', ...)` (`app.js:650`) es el único lugar donde se decide "hay algo nuevo que avisar". Justo donde hoy se llama a `window.toast...` y `reproducirBeep()`, se agregaría:

```js
if (document.hidden && Notification.permission === 'granted') {
  new Notification('Vale de arte', { body: data.mensaje });
}
```

- `document.hidden` evita duplicar el aviso cuando el usuario ya está mirando la pestaña (ahí el toast interno basta).
- El permiso se pide una vez, en algún gesto explícito del usuario (ej. un toggle en su perfil o el primer login), nunca automáticamente al cargar la página — Chrome bloquea/degrada el prompt de permisos que dispara solo al entrar a un sitio.
- Funciona con la pestaña en segundo plano, minimizada, o en otro escritorio virtual — **no** con el navegador completamente cerrado.

**Costo**: bajo. Cero dependencias nuevas, cero cambios de backend, quizás 20-30 líneas de frontend (el gancho del evento + un pequeño control de "activar notificaciones" en el perfil del usuario, ya que pedir el permiso requiere un gesto del usuario).

**Limitación conocida**: dos usuarios que compartan el mismo perfil de Windows/Chrome (ej. una computadora compartida en un taller) verían las notificaciones del último que dio permiso en esa sesión — no es un problema nuevo, ya existe hoy con el `token` de sesión (un usuario a la vez por navegador).

## Alternativa: Push API + Service Worker

Necesaria si el requisito real es notificar con el **navegador completamente cerrado** (no solo en segundo plano). Requiere:

- Un Service Worker nuevo registrado en el frontend.
- Suscripción push por usuario (browser genera un endpoint + llaves), guardada en una tabla nueva (`push_subscriptions` o similar).
- Llaves VAPID generadas para el servidor.
- Un endpoint backend nuevo que, en el mismo punto donde hoy se emite `vale_evento` por Socket.IO (`src/modules/vales/events.js` / `socketManager.sendToModule`), también dispare un push HTTP a cada suscripción activa del destinatario.

**Costo**: considerablemente mayor — nueva tabla, nueva dependencia (`web-push` o equivalente), gestión de suscripciones caducadas/revocadas, y un service worker que hay que mantener versionado junto al resto del frontend. Sigue siendo compatible con la arquitectura de monolito modular (no requiere infraestructura nueva tipo Docker/VPS), pero es una pieza nueva no trivial.

## Alternativa descartada: empaquetar como app de escritorio (Electron)

Contradice explícitamente la arquitectura del proyecto: CLAUDE.md fija un monolito modular sobre un host Node administrado con MySQL, sin infraestructura de escritorio ni instalación por usuario. Convertir el portal en una app de escritorio implicaría mantener un segundo empaquetado (instalador, actualizaciones, firma de código) solo para resolver notificaciones, cuando el navegador ya ofrece el mismo resultado sin ese costo. Se descarta.

## Recomendación

Implementar la Web Notifications API primero (bajo costo, reutiliza el gancho de tiempo real que ya existe) y evaluar Push API + Service Worker más adelante **solo si** se confirma que el requisito real es recibir avisos con el navegador cerrado — hoy nadie ha pedido eso explícitamente, solo "que las notificaciones salgan en pantalla", que la Web Notifications API ya resuelve.
