# Permisos agrupados y acciones por permiso

Rama: `fix/permisos2` (derivada de `fix/permisos`, desde `dev`). Migraciones `permisos_asesor_en_crear`, `quitar_permisos_sin_uso`, `permisos_supervisor_en_supervisar`, `permisos_taller_en_gestionar_taller` y `cupo_taller_al_asesor`.

## Problema

Las acciones, vistas y gates del módulo dependían del **rol** (Asesor, Supervisor, Encargado de taller...) y los permisos eran muy granulares (`corregir`, `confirmar`, `asignar`, `revisar`...). Eso impedía que un usuario de otro rol (un gerente, un encargado o un diseñador) creara y administrara sus propios vales, y repetía la misma decisión en decenas de sitios. Antes de lanzar a Centroamérica, donde una persona puede ser a la vez asesor y diseñador, había que desacoplar el permiso del rol.

## Qué cambia

| Permiso | Qué cubre | Sustituye a | Quién lo tiene hoy |
|---|---|---|---|
| `vales.crear` | Crear vales y administrar los **propios**: borradores, corregir, reenviar, responder adjuntos, chat de adjuntos, confirmar de recibido, solicitar modificación, rechazar propuesta y su chat | `vales.corregir`, `vales.confirmar`, `vales.solicitar_modificacion`, `vales.rechazar_propuesta` | Asesor (2) y Supervisor (3); asignable a cualquier rol |
| `vales.supervisar` | Marcar visto, autorizar y rechazar la creación, aprobar y rechazar modificaciones, y leer en solo lectura los chats de los asesores que cubre | `vales.autorizar_creacion`, `vales.aprobar_modificacion` (más el visto, que ya lo usaba) | Solo el Supervisor (3); el panel de roles lo bloquea en los demás |
| `vales.gestionar_taller` | Asignar a diseñadores, revisar propuestas, verificar o rechazar adjuntos y responder los rechazos de propuesta del taller | `vales.asignar`, `vales.revisar`, `vales.verificar_adjuntos`, `vales.responder_rechazo_propuesta` | Encargados y asistentes de taller (roles 4, 5, 7, 9, 10, 11, 12, 13) |
| `vales.ver_cupo` | Única condición para ver el cupo diario de los talleres en el calendario del Buzón | La condición por rol del Asesor | Supervisor y Asesor (en producción); asignable a cualquier otro rol desde «Roles y Permisos» |

Sin cambios, por decisión del dueño: `vales.aprobar_general` (fusión; roles 4 y 7), `vales.trabajar` (también el diseñador), `vales.dar_de_baja` (permiso atómico aparte), `vales.ver`, `vales.ver_reportes`, `vales.ver_historial`.

Retirados sin sustituto (nadie los consultaba): `vales.editar` y `vales.responder_modificacion_basica`.

## Reglas

- **Dueño + permiso.** Cada acción del asesor exige `vales.crear` **y** ser el dueño del vale (`vales.asesor_id = usuario.id`). El servidor valida las dos cosas; el frontend solo replica la condición para mostrar el botón. El administrador no entra como dueño.
- **Fila en `asesores`.** Crear exige una fila en `asesores` con tienda, que hoy se inserta a mano para los roles distintos de 2 y 3. De esa tienda salen los talleres elegibles (generales y el Diseño Local de esa tienda) y el cupo. Sin fila, el catálogo solo ofrece los talleres generales y la creación se rechaza.
- **Cobertura del supervisor.** Quién cubre a quién sigue siendo dato (`supervisor_tiendas`). Cambia que se reconoce al supervisor por `vales.supervisar` y no por el rol 3; un asesor es quien tiene fila en `asesores` y `vales.crear`.
- **Taller por dato.** A qué taller pertenece un encargado o asistente sigue saliendo de `talleres.encargado_id` y `taller_disenadores`; el permiso solo dice que gestiona.
- **Chats con `lado`.** Un usuario que es dueño del vale y también del taller destino actúa como asesor desde «Mis vales» y como taller desde su Buzón. La pantalla pide `lado=ASESOR` en cada petición cuando corresponde; el servidor solo lo honra si el usuario es dueño. Cancelar un rechazo de propuesta es siempre del dueño.
- **Red de seguridad.** Un rol de taller sin `vales.gestionar_taller`, o el rol 3 sin `vales.supervisar`, no cae en el buzón general: ve la vista de asesor (solo sus vales).
- **Tiempo real.** Quien tiene `vales.crear` recibe en su sala `asesor:<id>` lo de sus vales, sea cual sea su rol. Las notificaciones guardadas no se duplican aunque esté en dos salas.

## Vistas

- **«Mis vales»** (`vista=mios`): buzón activo del dueño para los roles con `vales.crear` y `vales.ver` que no son administrador, asesor ni supervisor (ellos ya tienen sus vales en su buzón). Usa la lógica, los contadores y el pipeline del asesor. Va primero en el sidebar.
- **Trabajo realizado mezclado:** el encargado, el asistente y el diseñador con `vales.crear` ven también sus vales propios confirmados, con el estado del asesor y «Solicitar modificación», sin acciones de taller.
- **Empresa del cliente** bajo el correlativo: además de los roles que siguen el vale de punta a punta, aparece en «Mis vales» y en las filas propias de cualquier rol.
- **Calendario del Buzón:** cupo con `vales.ver_cupo`; conteos de vales por día para el encargado, el asistente (`vales.gestionar_taller`) y el diseñador (`vales.trabajar`). El formulario de crear vale conserva la disponibilidad de fechas por `vales.crear`.

## Gates por rol que se conservan a propósito

El alta del supervisor y de los encargados en el panel de administración (filas `supervisores`, `supervisor_tiendas`, `talleres.encargado_id`), la herencia de los asistentes (`hereda_de_rol_id`), el selector de qué configuración de vista usar según el rol, y la identidad del diseñador (`vales.trabajar` más su sala `disenador:<id>`).

## Despliegue

1. Importar las migraciones 27 a 31 **justo antes** del código nuevo (en staging y producción corren solas al arrancar el servidor). Si el código sale antes, los encargados quedan sin el permiso; si la migración sale antes, las rutas viejas darían 403.
2. Todos los usuarios deben **cerrar sesión e iniciar de nuevo**: los permisos viajan en el token.
3. Primero en staging.
4. `database/seed.sql` sigue siendo el estado inicial del host y no se actualiza: una base nueva nace con los permisos viejos y las migraciones los transforman (verificado en el escenario A del CI).

## Verificación realizada

- CI: `ci:sintaxis` y `ci:migraciones` (instalación nueva y actualización estilo producción, con re-ejecución de cada script) pasan.
- Migraciones sobre una copia del respaldo de producción del 2026-11-06: 111 a 69 filas de `rol_permisos`, cada rol conserva sus capacidades salvo el cupo del Asesor.
- 15 casos de uso por API contra `dev` (1567 pasos por pasada): idénticos salvo las diferencias esperadas (`vista=mios`, cupo por permiso, mensajes de 403 que pasan de rol a permiso).
- Pantalla con Chrome: asesor, supervisor, gerente, encargado, asistente y diseñador; calendario, panel de roles, «Mis vales» y notificaciones.
- Tareas automáticas (`atrasoWatcher`, `adjuntosWatcher`, `vigenciaWatcher`): mismos destinatarios que con el código anterior.

No cubierto: datos reales de producción (solo estructura de permisos), el caso exitoso de modificaciones Media y Avanzada, y borradores y flujos alternos de rechazo y modificación en pantalla con el código final.
