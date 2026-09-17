# Correcciones #28

Base: `.agents/modulos/vales de arte/correcciones/analisis_correcciones_28.md`
y el mockup `pruebas/nuevo_elemento_calendar.jpg` (no se encontró ningún
"prompt descriptivo" en texto en `pruebas/` además de la imagen — el diseño
final se derivó directamente del mockup + buenas prácticas de UI/UX).
Verificado en vivo contra el entorno Docker+Node aislado (MySQL en el
puerto 3307, servidor en el 3099), con sesiones reales de Asesor,
Supervisor y Administrador.

## 1. Límite diario opcional por taller (`talleres.limite_diario`)

Columna nueva, nullable, sin default distinto de `NULL`
(`database/schema.sql`). Nunca se agregó un `CHECK` de SQL: el proyecto no
tiene precedente de constraints de este tipo, y la validación real vive en
el backend (`adminService.actualizarLimiteDiarioTaller`), que exige
`NULL` o un entero `>= 3`.

Nuevo endpoint `PUT /api/admin/talleres/:id/limite-diario` (permiso
`admin.talleres.gestionar`, igual que el resto de "Gestionar Talleres").
En el frontend, `Gestionar Talleres` gana una columna "Límite diario" y un
ícono nuevo (`speedometer-outline`) que abre un modal chico
(`actions/tallerLimite.js`) para fijarlo o dejarlo vacío ("Sin límite").

## 2. Conteo de "vales entrantes" por taller y día

El reparto real a `vale_talleres` solo ocurre al AUTORIZAR la creación
(`valeCreacionService.autorizarCreacion`) — antes de eso, el destino de un
vale vive solo en `vales.talleres_solicitados` (CSV), mientras está
`ESPERANDO_AUTORIZACION`. Contar solo `vale_talleres` dejaba un hueco
exacto al que se refería el análisis ("asesores aplicando truquitos"): un
asesor podía crear varios vales para el mismo día sin que ninguno contara
todavía contra el límite, porque ninguno había sido autorizado aún.

Nuevo `capacidadRepository.js` expone las dos fuentes por separado
(`listarSolicitadosEnRango`, `listarFanOutEnRango`); `capacidadEntregaService.js`
las combina en JS (el CSV de `talleres_solicitados` se interpreta ahí, no
con `FIND_IN_SET` en SQL, para no depender de una lista de talleres de
tamaño variable) y expone:

- `obtenerCapacidadMes(talleresIds, anio, mes)` — capacidad día por día de
  un mes completo, usada por el calendario del frontend.
- `validarLimiteDiario(talleresIds, fechaEntregaISO)` — la validación real
  e inapelable, usada por el backend.

Un taller sin `limite_diario` nunca aparece en el detalle ni restringe
nada — el límite es puramente opcional, tal como pide el punto 1 del
análisis.

**Verificado en vivo**: con `Diseño` en `limite_diario = 3`, se crearon 3
vales `ESPERANDO_AUTORIZACION` para el mismo taller y fecha de entrega — el
endpoint de capacidad reportó `programados: 3/3, restantes: 0`. Un 4°
intento de creación fue rechazado por el backend
(`El taller "Diseño" ya alcanzó su límite diario (3)...`). Tras autorizar
uno de los 3 (pasa a `vale_talleres`), el conteo se mantuvo en 3/3 — sin
doble conteo entre las dos fuentes. Una fecha distinta, y un taller sin
límite en la misma fecha llena, funcionaron sin restricción.

## 3. Enforcement en los tres puntos de entrada

El límite se valida — y puede bloquear — en:

- `valeCreacionService.crearVale`, justo después de `validarDatosVale`
  (ya conoce `talleresIds` y `fechaEntregaNorm`).
- `valeConfirmacionService.solicitarModificacion`, después de resolver
  `talleresIdsModificacion` (el destino de una modificación se resuelve
  aparte de `validarDatosVale`, ver comentario original del archivo).
- `valeConfirmacionService.aprobarModificacion`, justo antes del
  `fanOutTalleres` — se revalida aquí porque es el momento real en que el
  vale entra al buzón del taller, y pudo llenarse el día entre la
  solicitud y esta aprobación.

Ninguno de los tres afecta `fecha_evento` — el límite es exclusivamente
sobre `fecha_entrega`, como pide el análisis.

## 4. Calendario con capacidad — solo en "Fecha de entrega"

`datepicker.js` gana un parámetro opcional `capacidad` en `wireCampoFecha`
(`{ obtenerTalleresIds, cargarMes }`). Sin ese parámetro, el calendario es
exactamente el mismo de siempre — por eso "Fecha del evento" nunca lo
recibe y queda pixel-idéntico a como estaba.

Diseño derivado del mockup (`pruebas/nuevo_elemento_calendar.jpg`): cada
día con al menos un taller-con-límite seleccionado pinta una barra de color
bajo el número, con 5 niveles según el peor caso (mayor % usado) entre los
talleres elegidos:

| Nivel | Barra | Cuándo |
|---|---|---|
| vacío | gris | 0 vales programados |
| disponible | verde | < 60% del límite usado |
| moderado | amarillo | 60%–89% usado |
| crítico | rojo | 90%–99% usado (sigue seleccionable) |
| agotado | rojo | 100% usado — día deshabilitado, número en rojo |

Al pasar el mouse o enfocar un día con datos aparece un tooltip
("Detalle de Capacidad: Programados: X/Y — Z Restantes", en verde si
quedan cupos y en rojo si no) posicionado junto a la celda, igual al de la
imagen guía. Los días "agotado" quedan con `disabled` real en el
`<button>` — no solo deshabilitados visualmente — así que ni un clic
directo los selecciona.

Los datos de capacidad se piden al backend (`GET
/api/vales/capacidad-entrega`, permiso `vales.crear`) cada vez que se abre
el panel o se navega de mes, usando los talleres seleccionados EN ESE
MOMENTO — nunca un valor cacheado — para que un cambio de taller antes de
reabrir el calendario siempre muestre datos frescos.

Wired en `valeForm.js` en los dos formularios que comparten el campo
"Fecha de entrega": creación (`tallerSeleccionados`) y solicitud de
modificación (`tallerSeleccionadosMod`, o los talleres originales del vale
si no hay elección de taller que hacer).

**Verificado en vivo** (Asesor, taller "Diseño" con límite 3, 1/3 usado en
el 21 y 3/3 en el 20): el 20 se pintó en rojo con el número también en
rojo, el tooltip mostró "Programados: 3/3 — Sin cupos disponibles", y el
clic no hizo nada. El 21 mostró una barra verde y el tooltip "Programados:
1/3 — 2 Restantes"; al hacer clic se seleccionó normalmente. El campo
"Fecha del evento" del mismo formulario se abrió sin ninguna barra ni
tooltip, como el resto del formulario nunca cambió.

## Recuerda (del propio análisis) — confirmado que no se tocó

- El ordenamiento/jerarquía de vales no cambió — el límite solo bloquea la
  creación/selección de fecha, nunca reordena ni filtra el buzón.
- El buzón del encargado de taller no ganó ningún contador ni columna
  nueva — la única UI nueva vive en el formulario de creación/modificación
  del asesor.
- El flujo de estados de un vale (`ESPERANDO_AUTORIZACION → CREADO → ...`)
  no cambió — el límite es una validación adicional, no un estado nuevo.

No se commiteó ni se subió nada salvo pedido explícito.
