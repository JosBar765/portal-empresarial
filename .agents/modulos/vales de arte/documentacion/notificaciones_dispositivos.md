# Avisos en el dispositivo (escritorio y celular)

Vale para toda la plataforma. La campana sigue recibiendo todo; además, cada persona elige qué categorías quiere recibir como notificación del sistema. Todo está desactivado al inicio. Mockup aprobado: https://www.figma.com/design/X7Eg6rNsNy6VzsdCf4JHE3

## Reglas

- Cada módulo configura solo sus categorías, desde el engranaje de su campana. Sin categorías para ese usuario no hay engranaje (Prompts, Tiempos, Administración).
- Solo se listan las categorías que sus permisos pueden recibir (`src/core/notifications/categorias.js`).
- Las preferencias son del usuario, con una columna para escritorio y otra para celular; la activación es de cada dispositivo (celulares y tabletas cuentan como celular).
- Se guarda al marcar; si falla, la casilla vuelve atrás y se explica por qué.
- En Vales, «corregido», «tomado», «pausado» y «reanudado» quedan solo en la campana.
- El portal pregunta antes de que el navegador pida el permiso. Si se elige «No permitir», solo la persona puede desbloquearlo desde el navegador.
- Al cerrar sesión se borra el dispositivo (hay que volver a activarlo). Desactivar un usuario o cambiar su contraseña borra todos los suyos.
- La sesión única no cambió: un dispositivo puede seguir recibiendo avisos aunque la sesión se haya abierto en otro.

## Piezas

| Pieza | Dónde |
|---|---|
| Envío (gancho en `notificacionService.registrar`, nunca lo bloquea) | `src/core/notifications/pushService.js` |
| Categorías y preferencias | `categorias.js`, `preferenciaService.js` |
| API | `/api/notificaciones/push/{config,suscripcion,preferencias}` |
| Tablas | `push_suscripciones`, `notificacion_preferencias` |
| Dispositivo (activar, reasociar, borrar al salir) | `public/js/pushDispositivo.js` |
| Modal de configuración | `public/js/notificacionesAjustes.js`, estilos en `public/css/dashboard.css` |
| Service worker (solo push, sin caché) y manifest | `public/sw.js`, `public/manifest.webmanifest` |

El service worker no muestra el aviso si hay una pestaña del portal visible y enfocada, salvo en iPhone, iPad y Safari: Apple cancela la suscripción ante un push que no muestra nada.

## Sumar avisos nuevos

Dar un `tipo` (hasta 30 caracteres) a la notificación y agregarlo a una categoría en `categorias.js`. Un `tipo` que no está en ninguna categoría queda solo en la campana.

## Dónde funciona

| Dispositivo | Funciona |
|---|---|
| Chrome, Edge, Firefox de escritorio | Sí |
| Android con Chrome | Sí |
| iPhone / iPad (iOS 16.4 o superior) | Solo con el portal agregado a la pantalla de inicio |
| Cualquiera entrando por IP en HTTP | No: hace falta HTTPS (o `localhost`) |

## Configuración por entorno

Variables opcionales `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` o `https:`). Generar un par distinto para cada entorno con `npx web-push generate-vapid-keys`; las de producción no se usan en otro. No cambiarlas después: los dispositivos ya activados dejarían de recibir. Sin ellas el push queda apagado y la tarjeta de activación no aparece. Reglas: `.agents/reglas/reglas_entornos.md`.

## Pruebas

`node --test scripts/notificaciones/` (sin base de datos ni red). Íconos: `node scripts/notificaciones/generarIconos.js`.

## Diagnóstico por el registro del servidor

Todas las líneas empiezan con `[Push]`. No incluyen claves, direcciones de dispositivos ni textos de avisos.

| Línea | Entornos | Qué indica |
|---|---|---|
| `Avisos del sistema activados` / `desactivados: …` | todos menos `test` | Estado al arrancar y motivo |
| `dispositivo registrado: usuario N, movil, servicio Apple` | staging y desarrollo | El dispositivo quedó guardado y con qué clase |
| `modulo/TIPO sin categoría: solo campana` | staging y desarrollo | Ese aviso no se envía a dispositivos |
| `modulo/TIPO categoría=x destinatarios=3 dispositivos=0` | staging y desarrollo | Con `dispositivos=0`: nadie activó su dispositivo o marcó la casilla de esa clase |
| `enviado notif-N a usuario N por Google` | staging y desarrollo | El servicio aceptó el envío; si no se ve, revisar el teléfono (permisos, No molestar, ahorro de batería) |
| `No se pudo enviar el aviso a usuario N por Apple (403): motivo` | todos | Rechazo del servicio (claves) o red (`ETIMEDOUT`: salida bloqueada) |
| `última hora: enviados X, fallidos Y, …` | todos | Resumen por hora |
