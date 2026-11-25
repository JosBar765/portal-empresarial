# Notificaciones: campana y avisos en el dispositivo

Cada aviso del portal llega a la **campana** del módulo. Además, cada persona puede elegir qué categorías quiere recibir como **notificación del sistema** en su computadora o en su celular. Vale para toda la plataforma.

| Quiero… | Ir a |
|---|---|
| Activar y usar los avisos | [Uso](#1-uso) |
| Entender cómo funciona | [Cómo funciona](#2-cómo-funciona) |
| Configurar un entorno | [Configuración](#3-configuración-por-entorno) |
| Saber por qué no llega un aviso | [Diagnóstico](#4-diagnóstico) |
| Agregar avisos nuevos | [Desarrollo](#5-desarrollo) |

## 1. Uso

1. Entrar a un módulo y abrir la campana.
2. Tocar el engranaje.
3. **Activar en este dispositivo** → **Continuar** → **Permitir** en el navegador.
4. Marcar las categorías en la columna **Escritorio** o **Celular**. Se guarda solo.
5. El ícono de información de cada categoría explica qué incluye.

| Regla | Detalle |
|---|---|
| Todo empieza apagado | Nadie recibe avisos del sistema sin activar el dispositivo y marcar la categoría |
| La campana no cambia | Sigue recibiendo todo; guarda los avisos 30 días |
| Las casillas son del usuario | Se ven igual en cualquier equipo |
| La activación es del dispositivo | Hay que activar cada navegador o teléfono; vale para todos los módulos |
| Cada módulo configura lo suyo | El engranaje solo aparece si el usuario tiene categorías en ese módulo |
| Cerrar sesión | Deja de recibir en ese dispositivo; se reactiva solo cuando **la misma persona** vuelve a entrar. «Desactivar» sí lo olvida |
| Entra otra persona en el equipo | Queda apagado hasta que ella lo active |
| Con **ese módulo** a la vista | No sale la notificación del sistema (ya avisa el portal). Con otro módulo sí. En Apple sale siempre |
| Tocar un aviso | En la campana o en la notificación del sistema, abre lo que nombra (ver «Qué abre cada aviso») |

### Qué abre cada aviso

| Módulo | Qué hace |
|---|---|
| Vales de Arte | Va a la pestaña donde ese usuario ve el vale, pone el mes de su entrega, escribe el correlativo en el buscador y quita los demás filtros |
| Viáticos | Va a Solicitudes o Gestiones, pone el mes en que se creó y escribe el correlativo en el buscador |
| Incidencias | Abre la incidencia |
| Proyectos | Abre la pantalla relacionada, con la forma de volver |

- Si el registro ya no existe o no está disponible para esa persona, sale el cartel «Ese aviso ya no tiene una pantalla a la que llevarte».
- Los avisos de Viáticos anteriores a 2026-11-25 no guardaron su solicitud: no abren nada.
- Un vale con modificaciones puede aparecer junto a ellas, porque comparten número.
- Las solicitudes vencidas y los vales vencidos que pasaron a Borradores abren Borradores desde la campana.

### Dónde funciona

| Dispositivo | Funciona | Nota |
|---|---|---|
| Chrome, Edge o Firefox de escritorio | Sí | Windows debe permitir notificaciones del navegador y no estar en «No molestar» |
| Brave | Sí | Activar `brave://settings/privacy` → «Usar los servicios de Google para mensajería push» y reiniciar el navegador |
| Android con Chrome | Sí | El ahorro de batería puede retrasarlas |
| iPhone o iPad (iOS 16.4 o superior) | Sí | Primero: Safari → Compartir → «Agregar a pantalla de inicio», y activar desde ese ícono |
| Por IP en HTTP (`http://192.168.…`) | **No** | Se exige HTTPS; la única excepción es `localhost` |

### Si se tocó «No permitir»

El portal no puede volver a preguntar. La persona lo desbloquea: candado junto a la dirección → Notificaciones → Permitir → recargar. En iPhone: Ajustes → Notificaciones → el portal.

## 2. Cómo funciona

```text
módulo ─► notificacionService.registrar ─► guarda en `notificaciones` + socket (campana)
                                        └► pushService.enviar (sin esperar)
                                             1. tipo → categoría   (sin categoría: solo campana)
                                             2. quién la marcó y tiene un dispositivo de esa clase
                                             3. servicio push (Google, Mozilla, Apple, Microsoft)
                                             4. public/sw.js muestra la notificación
```

| Pieza | Dónde |
|---|---|
| Gancho | `src/core/notifications/notificacionService.js` (`registrar`) |
| Envío | `pushService.js`, `pushRepository.js`, `pushConfig.js` |
| Categorías (qué `tipo` va en cada una y quién la ve) | `categorias.js` |
| Preferencias | `preferenciaService.js`, `preferenciaRepository.js` |
| API | `/api/notificaciones/push/`: `GET config`, `POST` y `DELETE suscripcion`, `GET` y `PUT preferencias` |
| Tablas | `push_suscripciones` (dispositivos), `notificacion_preferencias` (casillas) |
| Navegador | `public/js/pushDispositivo.js` (activar, reasociar, borrar al salir) |
| Modal | `public/js/notificacionesAjustes.js`, estilos en `public/css/dashboard.css` |
| Service worker y manifest | `public/sw.js` (solo push, sin caché), `public/manifest.webmanifest` |

- El envío nunca bloquea ni rompe la operación que generó el aviso.
- Máximo 10 envíos a la vez, 8 s de espera por envío; el servicio push reintenta hasta 24 h. Las alertas van con urgencia alta.
- Un dispositivo que el servicio da por vencido (404 o 410) se borra solo.
- El navegador recuerda quién activó el dispositivo. Al cargar el portal o volver a él, repara la suscripción de esa persona (perdida, vencida o creada con otras claves) sin pedir nada. En iPhone puede requerir tocar «Activar».
- Si entra otra persona, el dispositivo se suelta; no pasa a su nombre.
- Celulares y tabletas cuentan como **celular**.
- Usuarios desactivados no reciben. Desactivar un usuario o cambiar su contraseña borra sus dispositivos.
- **El modo mantenimiento y la revocación por reuso de token no los borran.**
- La sesión única no cambió: un teléfono puede seguir recibiendo avisos aunque la sesión esté abierta en otro equipo; al tocarlo, el inicio de sesión puede responder «Ya tienes una sesión activa».

### Categorías

El nombre y el contenido exactos están en `categorias.js`.

| Módulo | Categorías |
|---|---|
| Vales de Arte | Pendientes de autorización · Autorizados y rechazados · Asignación de diseño · Avance del diseño · Aprobación y entrega · Rechazo de propuesta · Revisión de adjuntos · Mensajes · Atrasos y por vencer · Bajas y eliminaciones |
| Viáticos | Por autorizar · Autorizadas y rechazadas · Liquidadas · Vencimientos |
| Incidencias | Buzón y asignación · Avance · Verificación y cierre · Comentarios |
| Proyectos | Reparto · Seguimiento · Proyecto · Aprobaciones · Ventas · Muestras |

- Cada usuario ve solo las categorías que sus permisos pueden recibir. El administrador ve todas las de Vales.
- Solo campana en Vales: «corregido», «tomado», «pausado» y «reanudado».
- Proyectos: si el administrador apaga un evento para un rol en su matriz de avisos, no llega ni a la campana; la preferencia personal no lo reactiva.
- Prompts, Tiempos y Administración no tienen categorías. El administrador configura los avisos de Vales desde la campana de Vales.

## 3. Configuración por entorno

Tres variables **opcionales**, que van juntas:

| Variable | Qué es |
|---|---|
| `VAPID_PUBLIC_KEY` | Identifica al servidor; los navegadores se suscriben con ella |
| `VAPID_PRIVATE_KEY` | Firma cada envío. Es un secreto, como `JWT_SECRET` |
| `VAPID_SUBJECT` | Contacto del responsable (`mailto:` o `https:`). Usar uno real: Apple puede rechazar los inventados |

1. `npx web-push generate-vapid-keys` (un par **por entorno**).
2. Cargar las tres variables (`.env` en desarrollo; panel del hosting en staging y producción).
3. `npm install` (dependencia `web-push`; el hosting lo hace al desplegar).
4. Migración: `npm run migrate` en desarrollo; automática al arrancar en staging y producción.
5. Reiniciar y confirmar en el log `[Push] Avisos del sistema activados`.

Reglas que no se negocian:

- **Las claves de producción no se usan en ningún otro entorno.** Es lo que impide que una prueba llegue a un teléfono real.
- **No cambiar el par una vez en uso:** cada dispositivo deja de recibir hasta que su dueño abra el portal (en iPhone puede tener que volver a activar).
- El push es la excepción a «acciones críticas solo en producción»: corre también en staging y desarrollo, nunca en `test` (`reglas_entornos.md`).
- El refresco de staging borra `push_suscripciones` (`reglas_refresco_staging.md`).
- Sin las variables el portal arranca igual, con los avisos apagados y sin la tarjeta de activación.

## 4. Diagnóstico

### Según lo que se ve

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| No aparece el engranaje | Sin categorías para ese usuario, o falta la migración | Revisar permisos; `npm run migrate:estado` |
| No aparece «Activar» | Push apagado en el servidor | Revisar la línea `[Push]` del arranque |
| «Registration failed - push service error» | El navegador no llega a su servicio push | Brave: ver arriba. Si no: VPN, antivirus o red |
| «Algo salió mal de nuestro lado» al activar | Error del servidor | Ver `push:upsert` en el log |
| `Unknown column 'dispositivo'` | Quedó una tabla vieja de una prueba local anterior | `ALTER TABLE push_suscripciones ADD COLUMN dispositivo VARCHAR(10) NOT NULL AFTER auth;` |
| Llega a la campana pero no al dispositivo | Sin dispositivo, sin casilla, solo campana, módulo a la vista o es quien hizo la acción (nunca se avisa a sí mismo) | Seguir las líneas `[Push]` |
| El log dice `enviado` y no se ve | Problema en el equipo | Permisos del sistema, «No molestar», ahorro de batería |

### Líneas del log

Todas empiezan con `[Push]` y no llevan claves, direcciones de dispositivos ni textos de avisos.

| Línea | Entornos | Qué indica |
|---|---|---|
| `Avisos del sistema activados` / `desactivados: …` | todos menos `test` | Estado al arrancar y motivo |
| `dispositivo registrado: usuario N, movil, servicio Apple` | staging y desarrollo | El dispositivo quedó guardado y con qué clase |
| `modulo/TIPO sin categoría: solo campana` | staging y desarrollo | Ese aviso no se envía a dispositivos |
| `modulo/TIPO categoría=x destinatarios=3 dispositivos=0 usuarios=5,9,13` | staging y desarrollo | A quién iba y a cuántos dispositivos. Quien actuó no figura |
| `modulo/TIPO sin envío: 5=sin casilla, 9=sin dispositivo` | staging y desarrollo | Motivo por persona: `sin casilla`, `sin dispositivo`, `sin dispositivo de la clase marcada` o `usuario desactivado` |
| `enviado notif-N a usuario N por Google` | staging y desarrollo | El servicio aceptó el envío |
| `suscripción vencida del usuario N …: se elimina` | staging y desarrollo | El navegador ya no existe o quitó el permiso |
| `No se pudo enviar el aviso … (403): motivo` | todos | Claves o `VAPID_SUBJECT` |
| `No se pudo enviar el aviso … (ETIMEDOUT)` | todos | El hosting no deja salir la conexión |
| `Fallo al procesar el aviso: …` | todos | Error interno (por ejemplo, base de datos) |
| `última hora: enviados X, fallidos Y, …` | todos | Resumen por hora |

Si no aparece **ninguna** línea al generar un aviso: el push está apagado, o es producción (no registra el detalle).

### Consultas de solo lectura

```sql
-- Dispositivos de un usuario
SELECT s.dispositivo, s.user_agent, s.actualizado_en
FROM push_suscripciones s JOIN usuarios u ON u.id = s.usuario_id
WHERE u.email = 'correo@ejemplo.com';

-- Casillas marcadas de un usuario
SELECT p.modulo, p.categoria, p.escritorio, p.movil
FROM notificacion_preferencias p JOIN usuarios u ON u.id = p.usuario_id
WHERE u.email = 'correo@ejemplo.com';
```

## 5. Desarrollo

**Aviso nuevo:**

1. Llamar a `notificacionService.registrar(usuarios, { modulo, tipo, mensaje, … })`.
2. Dar siempre un `tipo` (hasta 30 caracteres). No renombrar los existentes: el frontend reacciona a algunos.
3. Agregar el `tipo` a una categoría de `categorias.js`. Sin categoría queda solo en la campana.
4. Categoría nueva: definir qué permisos pueden recibirla, según a quién avisa de verdad el emisor.

**Abrir lo que nombra un aviso:** el push lleva `?aviso=<id>` y `public/js/notificaciones.js` ejecuta la misma acción que al tocarlo en la campana. Un módulo solo necesita guardar la referencia (`vale_id` o `referencia_tipo`/`referencia_id`), pasar `alAbrir` al iniciar la campana y llamar a `centroNotificaciones.abrirPendiente()` cuando ya cargó. El servidor decide qué puede ver cada persona (`valeUbicacionService`, `viaticos/services/ubicacionService`).

**Módulo nuevo:** además, su campana (ver `centro_notificaciones_por_modulo.md` en Vales) y los scripts `pushDispositivo.js` y `notificacionesAjustes.js` en su página.

**Pruebas:** `node --test scripts/notificaciones/` (sin base de datos ni red). Íconos: `node scripts/notificaciones/generarIconos.js`.

**Diseño:** mockup aprobado en https://www.figma.com/design/X7Eg6rNsNy6VzsdCf4JHE3.

## Sin verificar todavía (2026-11-25)

Probado en desarrollo (Brave de escritorio): activación, flujo de Vales, rechazos y atraso. Probado en staging (Samsung S25 Ultra, Chrome, app instalada): aviso con la app cerrada y tras reiniciar el teléfono, cierre y nuevo inicio de sesión, otro usuario en el mismo equipo, aviso con la PC en otro módulo y enlace externo sin perder la sesión. Falta:

- Aviso tras una o dos horas sin usar el teléfono (ahorro de batería).
- iPhone o iPad.
- Que tocar una notificación real abra el registro (en la computadora y con la app del celular cerrada).
- Las categorías «Bajas y eliminaciones» y los avisos «por vencer».
- La visibilidad de categorías por rol (se dedujo de los emisores) y los avisos de Viáticos, Incidencias y Proyectos.

Actualizar esta sección al comprobarlos.
