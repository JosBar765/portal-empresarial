# Correcciones #24

Base: `.agents/modulos/vales de arte/correcciones/analisis_correcciones_24.md`.
Todo lo descrito aquí fue verificado en vivo contra la base de datos local de
XAMPP (`portal_empresarial`, reimportada desde cero: `schema.sql` + `seed.sql`
+ `users.sql`), con sesiones reales de Asesor, Supervisor, Encargado y
Técnico recorriendo el flujo completo. Sin credenciales reales de Supabase en
esta máquina, las pruebas de subida de archivos se hicieron con un stub local
temporal (nunca comiteado) que solo sirvió para no bloquear el resto del
flujo — la integración real con Supabase no cambió en esta corrección.

## 1. Botón "Rechazar" en autorizar creación

Nuevo método `valeCreacionService.rechazarCreacion(usuario, valeId)`: exige
`ESPERANDO_AUTORIZACION` y la misma pertenencia que ya validaba
`autorizarCreacion` (supervisor del asesor, o Administrador). Reutiliza
`eliminarValeConArchivos` (antes `revertirCreacionFallida`, generalizado —
ver Corrección #23) para borrar Storage + la fila de `vales` (el cascade de
FKs se lleva `vale_documentos`/`vale_talleres`/`vale_historial`). Nuevo
endpoint `POST /api/vales/:id/rechazar-creacion`, mismo permiso
`vales.autorizar_creacion` (mismo actor/modal, acción opuesta).

En el modal de "Autorizar creación" (`actions/supervisor.js`) se agregó un
tercer botón "Rechazar" (estilo `.btn--danger`, alineado a la izquierda del
footer) que pide confirmación nativa (`confirm()`, mismo patrón que
"Cancelar proceso" del técnico) antes de ejecutar — el borrado es permanente
e irreversible.

**Verificado en vivo**: Supervisor rechazó un vale `ESPERANDO_AUTORIZACION`
→ la fila desapareció de `vales`, su `vale_documentos` se fue por cascade, y
su PDF se borró del bucket (comprobado comparando el archivo remanente en
Storage contra el `pdf_url` del único vale que quedaba vivo).

## 1.5. Correlativo: de contador en vivo a `id` autoincremental

Al investigar el punto 1 encontramos que `contarValesPorAsesor` hacía un
`COUNT(*) FROM vales WHERE asesor_id = ?` en vivo — borrar vales (lo que
"Rechazar" ahora hace activamente) corre el contador hacia atrás y puede
repetir un correlativo ya usado. Confirmado con el usuario, se reemplazó
por el propio `id` autoincremental de MySQL, que nunca se reutiliza ni
retrocede.

Nuevo formato: `{CODIGO_TIENDA}-{INICIALES}-{ID}` (antes:
`{CODIGO_TIENDA}-{INICIALES}-{00001}` con contador propio). Como el `id`
solo se conoce DESPUÉS del insert, `valeRepository.crear()` ahora inserta
con un placeholder temporal único (`TEMP-<random>`) cuando no se pasa un
`correlativo` explícito, y lo reemplaza con `{prefijo}-{id}` en un segundo
UPDATE inmediato tras obtener `insertId`. El camino de `aprobarModificacion`
(que arma su propio `MOD-{correlativo original}` reutilizando el número del
vale que modifica) sigue pasando `correlativo` explícito sin cambios — solo
`crearVale()` pasa a usar el nuevo `correlativoPrefijo`. Se eliminaron
`pad5()` y `contarValesPorAsesor()` (sin más usos).

**Verificado en vivo**: vales creados con correlativos reales `MTC-AL-2`,
`MTC-AL-3` (ids 2 y 3); tras rechazar/borrar el 2, el siguiente vale
generado usó el id 4 (nunca repitió el 2), y la modificación aprobada de
`MTC-AL-3` generó `MOD-MTC-AL-3` reutilizando ese mismo número, como se
espera.

## 2. Zona horaria fija UTC-6

Causa raíz: `vale_historial.creado_en` (y cualquier otra columna
`TIMESTAMP DEFAULT CURRENT_TIMESTAMP`) la genera MySQL con su propio
`time_zone` de sesión — no el reloj de Node —, y `hoyISO()`/`horaActual()`
mezclaban `.toISOString()` (UTC) con `.toTimeString()` (hora local del
proceso), ambos dependientes de configuración del host que en un hosting
administrado (Hostinger) no se controla.

Arreglo, sin depender de la TZ del sistema operativo (ni de Node ni de
MySQL):

- `src/config/database.js`: `pool.on('connection', conn => conn.query("SET
  time_zone = '-06:00'"))` — fija la sesión de CADA conexión del pool a
  UTC-6, sin importar el `time_zone` global del servidor MySQL. Arregla
  `CURRENT_TIMESTAMP`/`NOW()` en todas las tablas de un solo lugar.
- `valeHelpers.js`: `hoyISO()`/`horaActual()` reescritos con aritmética de
  offset fijo (`Date.now() - 6h`, luego `.toISOString()`) en vez de métodos
  que dependen de la TZ del proceso. Nuevo `parsearUTC6()` ancla
  explícitamente el offset `-06:00` al parsear strings guardadas
  (`calcularAtraso`, `calcularUrgente`) — antes `new Date(stringNaive)`
  asumía que la TZ del proceso coincidía con la de los datos.
- Mismo criterio aplicado en `atrasoWatcher.js` (`ahoraLocal`),
  `events.js` (`fechaHoraLocal`, el timestamp de los toasts en vivo) y
  `valePdfService.js` (fecha "Generado" del encabezado del PDF) — los tres
  construían la fecha/hora con `getDate()`/`getHours()` locales.
- El frontend (`utils/formato.js`) no necesitó cambios: hace slicing de
  string puro, sin conversión de zona horaria, así que mostrar los strings
  UTC-6 tal cual ya es correcto.

**Verificado en vivo**: `SELECT @@session.time_zone` contra el pool de la
app devuelve `-06:00`; los vales creados durante las pruebas quedaron con
`fecha_creacion`/`vale_historial.creado_en` consistentes con la hora real
de Guatemala.

## 3. Modificación a un solo taller no debe pasar por "Aprobar y Fusionar"

Causa raíz en `valeTallerService._recalcularEstadoVale`:
`requiereEncargadoGeneral = filas.length > 1 || esValeDeModificacion(vale)`
— cualquier modificación, sin importar cuántos talleres, caía a
`APROBADO_DEPARTAMENTO`. Arreglo: `requiereEncargadoGeneral = filas.length >
1` — el bloque ya existente que copia la propuesta del único taller a
`propuesta_general_url` cuando hay un solo taller ya cubre este camino sin
cambios adicionales.

**Verificado en vivo, flujo completo**: Asesor crea (1 taller) → Supervisor
autoriza → Encargado asigna → Técnico entrega → Encargado aprueba (pasa
directo a `PENDIENTE_CONFIRMACION`, sin fusión — ya funcionaba así antes) →
Asesor confirma recibido → Asesor solicita modificación → Supervisor aprueba
(crea `MOD-...`) → Encargado asigna de nuevo → Técnico entrega de nuevo →
Encargado aprueba de nuevo → **resultado: `PENDIENTE_CONFIRMACION`**, no
`APROBADO_DEPARTAMENTO` — el bug reportado, confirmado corregido en el
segundo ciclo (el que antes fallaba).

## 4. Historial en tiempo real para todas las vistas

`abrirModalHistorial` y el handler de `vale_evento` en `socket.js` ya eran
genéricos para cualquier rol — el problema real es que cada
`valeEvents.notificar(...)` solo dispara para las salas por ROL relevantes a
esa transición específica (ej. `aprobarGeneral` solo notifica a
`asesor:<id>`, `confirmarRecibido`/`solicitarModificacion` solo a
`supervisor:<id>`), y cada rol solo está suscrito a una sala muy acotada
(`taller:<id>`, `tecnico:<id>`, etc. — ver `roomsParaUsuario`). Un Encargado
o Técnico con el historial de un vale abierto simplemente nunca recibía el
evento de transiciones que no involucran su propia sala — el Asesor "se
salvaba" porque casi todas las transiciones sí lo notifican a él.

**Arreglo**: canal aparte, uno por vale, independiente de a quién le suena
el beep/toast de cada acción. `events.js.notificar()` ahora, además del
`vale_evento` de siempre (sin tocar su lista de `salas` — el beep/toast de
cada acción no cambia para nadie), emite también un `vale_actualizado`
silencioso a la sala `vale:<id>`. `abrirModalHistorial` (`actions/
historial.js`) une el socket a esa sala al abrir el modal. `socket.js`
escucha `vale_actualizado` y refresca el modal si sigue abierto y
corresponde al mismo vale — nunca dispara toast ni beep. No hace falta salir
de la sala al cerrar el modal: el mensaje no tiene efecto si el modal ya no
está en el DOM.

**Verificado en vivo**: con el historial de un vale abierto en la sesión de
un Encargado (solo suscrito a `taller:1`), se ejecutó `confirmar` como
Asesor (acción que solo notifica a `supervisor:<id>`, nunca a `taller:<id>`)
— el modal del Encargado se refrescó solo, sin recargar la página, mostrando
la nueva entrada del historial en tiempo real.

## 5. ENUM → tablas de catálogo

5 columnas ENUM reemplazadas por tablas `id/nombre` (mismo patrón que
`roles`/`permisos`):

| Tabla | Columna ENUM anterior | Catálogo nuevo | FK nueva |
|---|---|---|---|
| `vales` | `estado` | `estados_vale` | `estado_id` |
| `vales` | `autorizacion_tipo` | `tipos_autorizacion` | `autorizacion_tipo_id` |
| `vale_talleres` | `estado` | `estados_taller` | `estado_id` |
| `vale_solicitudes_modificacion` | `estado` | `estados_solicitud_modificacion` | `estado_id` |
| `vale_documentos` | `tipo` | `tipos_documento` | `tipo_id` |

`seed.sql` inserta cada catálogo con exactamente los mismos strings que
tenían los ENUM (mismos ids que su orden original), para que nada fuera del
repositorio note el cambio.

**Patrón de traducción** (todo el SQL crudo vive en repositorios, por diseño
del proyecto): cada `SELECT` que antes hacía `SELECT * FROM vales` pasa a
`SELECT v.*, ev.nombre AS estado, ta.nombre AS autorizacion_tipo FROM vales
v LEFT JOIN estados_vale ev ON ... LEFT JOIN tipos_autorizacion ta ON ...`
(mismo patrón para `vale_talleres`/`vale_solicitudes_modificacion`/
`vale_documentos`) — el objeto que recibe el resto del código sigue
teniendo `estado`/`tipo`/`autorizacion_tipo` como string, igual que
siempre. Cada `INSERT`/`UPDATE` que antes escribía el string directo ahora
lo resuelve con una subconsulta inline: `estado_id = (SELECT id FROM
estados_vale WHERE nombre = ?)`. Las firmas de los métodos de repositorio
(`actualizarEstado(id, estado)`, `documentoRepository.crear({ tipo, ... })`,
etc.) no cambiaron — services, `valeHelpers.js` (`ESTADOS`/
`ESTADOS_TALLER`) y el frontend no notaron el cambio de esquema.

Archivos tocados: `valeRepository.js`, `valeTallerRepository.js`,
`solicitudModificacionRepository.js`, `documentoRepository.js` — ningún
service ni controller.

**Verificado en vivo**: el flujo completo del punto 3 (crear, autorizar,
asignar, entregar, aprobar, confirmar, modificar, re-aprobar) corrió de
punta a punta sobre el esquema nuevo sin ningún error de SQL, con las
respuestas JSON de cada endpoint mostrando `estado`/`autorizacion_tipo`
como los mismos strings de siempre (y, por debajo, `estado_id`/
`autorizacion_tipo_id` con los ids correctos del catálogo).

## 6. Bloquear más de un Asistente de Diseño (+ hueco de reactivación)

`adminService.ROLES_ENCARGADO_UNICO` pasó de `[4, 5, 9]` a `[4, 5, 9, 7]`
(Asistente incluido) — mismo mecanismo ya usado para los encargados de
taller de toda la empresa, sin código nuevo. Espejo en el frontend
(`public/modules/admin/js/config/roles.js`), que ya alimentaba el
`deshabilitarRol` del selector de rol en "Nuevo usuario" sin cambios
adicionales.

Adicional (confirmado con el usuario): la validación de rol único solo
corría al CREAR un usuario — reactivar un usuario desactivado con un rol
único mientras otro seguía activo no lo bloqueaba (afectaba también a los
Encargados, no solo al Asistente). Se agregó la misma validación a
`adminService.establecerActivoUsuario` cuando `activo === true`.

**Verificado** (llamando a los métodos del servicio directamente, sin pasar
por HTTP): intentar crear un segundo Asistente con uno ya activo lanza "Ya
existe un encargado activo para este rol: Giancarlo Hernández."; crear un
Encargado de Diseño inactivo de prueba y reactivarlo mientras el actual
sigue activo lanza el mismo tipo de error contra "Jesus Ramirez".

## 7. Popup de sesión expirada

No hay un wrapper de fetch compartido entre páginas en este proyecto (cada
módulo tiene su propio `api/*.js`). Nuevo `public/js/sessionGuard.js`:
sobrescribe `window.fetch` una sola vez para detectar cualquier respuesta
`401` de una URL `/api/...`, y muestra un overlay bloqueante ("Tu sesión ha
expirado" + botón OK) que redirige a `/login/?expired=true` al aceptar — una
bandera evita mostrarlo dos veces si llegan varios 401 casi simultáneos. No
reemplaza el manejo de error local de cada módulo (que sigue mostrando su
propio mensaje debajo), solo se agrega encima. Incluido en las 3 páginas
protegidas: `dashboard`, `admin`, `vales` (login ya maneja su propio
`?expired=true` con un mensaje inline, sin cambios).

**Verificado en vivo**: sesión cerrada manualmente, siguiente llamada a
`/api/vales` devolvió 401 y el popup apareció de inmediato sobre el resto de
la página (incluido un modal ya abierto detrás); clic en OK redirigió
correctamente a `/login/?expired=true`, que además mostró su propio mensaje
"Tu sesión expiró. Ingresa nuevamente." — ambos mecanismos conviven sin
conflicto.

## Dudas

**1. ¿Se reinicia el conteo de atraso si el servidor se reinicia?** No. El
atraso es una condición derivada, sin estado en memoria: cada carga del
buzón/dashboard recalcula `calcularAtraso()` desde `fecha_entrega` (BD),
nunca desde un contador vivo. El único componente con estado en memoria es
`atrasoWatcher` (un `setInterval` de 60s) y no lleva ninguna cuenta propia
— su única función es lanzar el toast/beep "marcado como atrasado" una sola
vez por vale, usando `vales.atraso_notificado_en` (columna persistida) como
bandera. `listarAtrasadosSinNotificar()` filtra con `WHERE
atraso_notificado_en IS NULL ... AND fecha_entrega < NOW() - INTERVAL 1
DAY` — una condición sin estado, re-derivable en cualquier momento. Si el
proceso se cae, el peor caso es un retraso de hasta 60s en notificar un
vale que cruzó su fecha límite durante la caída; en el siguiente tick los
atrapa a todos de una vez. El cálculo de "cuántos días de atraso" en sí
nunca se pierde.

**2. ¿Por qué el correlativo saltó a 00002 tras borrar 26 de 27 vales?**
`contarValesPorAsesor` hacía `COUNT(*) FROM vales WHERE asesor_id = ?` en
vivo — al quedar solo 1 vale, el siguiente calculó `1 + 1 = 00002`. Corregido
en el punto 1.5 de arriba: el número ahora es el `id` autoincremental de
MySQL, que nunca se reutiliza ni retrocede sin importar cuántas filas se
borren después — y esto era más urgente de arreglar ahora porque el nuevo
botón "Rechazar" (punto 1) hará estas eliminaciones mucho más frecuentes.

**3. ¿La conexión a MySQL es ineficiente (una por consulta)?** No, ya
estaba resuelto: `src/config/database.js` usa `mysql.createPool(...)`
desde el inicio del proyecto (`connectionLimit: 10`), y `db.query()` llama
a `pool.query()`, que toma prestada una conexión ya abierta del pool y la
devuelve al terminar — nunca abre una conexión TCP nueva por cada consulta.
No se necesitó ningún cambio para esto.

**4. ¿Por qué `encargado_tienda` se llama así si relaciona talleres con
tiendas?** Es un nombre heredado de una corrección anterior que quedó mal
alineado con lo que la tabla realmente hace hoy: relaciona `taller_id` ↔
`tienda_id` (qué tienda(s) puede atender cada taller de toda la empresa),
sin ninguna columna de encargado. Se recomienda renombrarla a
`taller_tiendas` en una futura corrección — no se hizo en esta ronda para
no mezclar una migración de nombre adicional, no pedida explícitamente, con
el resto de los cambios.

## Hallazgo aparte (no corregido en esta ronda): datos faltantes en `database/users.sql`

Al reimportar la base de datos desde cero para las pruebas, el `INSERT INTO
encargado_tienda` de `database/users.sql` (línea 168) falla con una
violación de FK: hace referencia a los talleres `6, 7, 9, 13` (Diseño Local
de más tiendas), pero el `INSERT INTO talleres` justo arriba (línea 156)
nunca los crea — solo inserta los ids `1, 2, 3, 4, 5, 8, 10, 11, 12, 14`.
Esto bloquea una reimportación limpia de `users.sql` tal cual está
comiteado hoy. Para las pruebas de esta corrección se usó una copia local
temporal con esas filas de `encargado_tienda` filtradas (nunca comiteada).
No se tocó `database/users.sql` porque son datos reales de la organización,
fuera del alcance de esta corrección — se deja documentado para que el
dueño de esos datos complete los talleres faltantes o limpie las filas de
`encargado_tienda` que ya no aplican.
