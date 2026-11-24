# Proyectos y reparto equitativo (fase 3a)

El supervisor (o el administrador) crea el proyecto del mes para un nicho, elige tiendas y asesores, ve una **vista previa** y **activa**: el servidor reparte las empresas en una transacción. Permiso para crear, editar, repartir, activar y cancelar: `proyectos.activar`.

## Alcance y visibilidad

- **Quién crea:** `proyectos.activar`. Un supervisor solo incluye tiendas de `supervisor_tiendas`; el administrador (`proyectos.administrar`) ve todas.
- **Quién lee:** un supervisor ve el proyecto si al menos una de **sus** tiendas está en el alcance (o si él lo creó); el administrador y el gerente (`proyectos.ver_gerencia`) ven todos. Lo que no se ve responde 404.
- **Una tienda, un proyecto activo** y **una empresa, un proyecto activo:** los garantizan los índices únicos `uq_proy_tienda_abierta` y `uq_proy_cliente_abierto` (columnas generadas VIRTUAL; probados en MySQL 8.4 y MariaDB 11.8). El servicio captura el error de duplicado y dice qué tienda y qué proyecto la bloquea.

## Estados

`borrador → activo → cancelado` (el cierre es de la fase 6; `pendiente_aprobacion` llega en la 3b). El borrador **no reparte nada**: guarda nicho, mes, tiendas, participantes, artículo y existencia, tope, meta y moneda, fechas y etapas. Solo un borrador se edita.

## Reparto (`src/modules/proyectos/repartoService.js`)

Funciones puras, un solo archivo; la vista previa y la activación usan **el mismo cálculo**.
1. Se reparte **por país**: las empresas de cada país, entre los asesores participantes de ese país.
2. **Una por una al asesor con menos empresas** → la diferencia entre dos asesores del mismo país nunca pasa de una.
3. **Desempate por afinidad** (`reparto.afinidad_tienda`): entre los que empatan en carga gana el de la tienda que registró la empresa. Solo desempata; nunca rompe la equidad.
4. Orden determinista por identificador.
5. **Tope por asesor** (el del proyecto o `reparto.tope_por_asesor`): lo que sobra queda en **reserva** (participación abierta sin asesor). Un país sin asesores deja sus empresas «sin asesor» (siguen disponibles).

**Empresas elegibles:** estado `activa` (no «No contactar» ni inactiva), del nicho del proyecto, de los países de las tiendas, sin participación abierta y fuera del periodo de **descanso** tras una venta del mismo nicho (`reparto.descanso_meses`, 0 lo apaga). **Participan** los asesores de las tiendas del alcance (y los supervisores solo con `reparto.reciben_supervisores`); el supervisor puede **excluir** a un asesor con motivo.

## Activar (`proyectoService.activar`)

Transacción con orden fijo de bloqueo **proyecto → tiendas → empresas → participaciones**: `UPDATE … SET estado = 'activo' WHERE estado = 'borrador'` (se comprueba `affectedRows`), `proyecto_abierto = 1` en las tiendas, empresas elegibles `ORDER BY id FOR UPDATE`, inserción en bloque de las participaciones y la clave de idempotencia (`idempotency_keys`) **dentro de la misma transacción**. Resultado: dos activaciones a la vez sobre la misma tienda dejan **un solo ganador** y el otro recibe un 409 que dice qué tienda y qué proyecto la bloquean; tres con la misma clave reparten una sola vez (las otras devuelven `repetida: true`). Con `reglas.aprobar_activacion` encendida, activar directo responde 409 (la aprobación llega en la 3b).

## Cancelar

Borrador → `cancelado`. Un proyecto **activo** exige motivo y, al cancelarlo, libera las tiendas (`proyecto_abierto = 0`) y las empresas (`abierta = 0`). Todo queda en `proy_historial`.

## Otros

- **Código del proyecto:** `codigo.formato` (`{AAAA}`, `{MM}`, `{NICHO}` = 3 letras del nicho, `{N}`); nunca se repite (sufijo `-2`, `-3`…) y se regenera si cambian nicho, año o mes del borrador.
- **Vencido:** proyecto `activo` cuya fecha de fin más `vencimiento.gracia_dias_habiles` (lunes a viernes) ya pasó. No se cierra solo.
- **Regla 16:** la empresa que registra un asesor que participa en el proyecto activo de ese nicho (y país) queda **asignada a él**; si no participa, queda disponible.

## Pantallas del supervisor (fase 3c)

- **Proyectos (S1):** lista con filtros (Todos, Activos, Vencidos, Cerrados) y año, alerta de proyectos vencidos y pestaña **Borradores** (S17: «Paso 2 de 4», «Continuar» y «Descartar»). Rutas `#/proyectos`, `#/proyectos/nuevo`, `#/proyectos/<id>` y `#/proyectos/<id>/editar`; el menú «Proyectos» aparece con `proyectos.activar` (y lectura para gerente y administrador).
- **Asistente de 4 pasos (S2–S5):** (1) plantilla, nicho (con las empresas elegibles de cada uno) y mes, con el código automático; (2) alcance — una tienda, un país o toda la región, con las tiendas ocupadas bloqueadas — y participantes con exclusión y motivo; (3) artículo, existencia, tope, meta y etapas con sus fechas (lo que la plantilla bloquea sale con candado y deshabilitado, lo obligatorio lleva *); (4) **vista previa** del reparto —empresas elegibles, se repartirán, sin asesor, en reserva, asesores, avisos por país y la tabla por asesor— y **Activar proyecto** (o **Pedir aprobación** si la regla está encendida). Cada «Continuar» guarda el borrador; salir con cambios sin guardar pide confirmación; en celular va en una columna.
- **Detalle del proyecto:** datos, tiendas y reparto entre asesores; un proyecto que **espera aprobación** muestra «Pediste la activación el…» (T12) y puede cancelarse; un borrador devuelto por el gerente muestra su comentario en el asistente. **Cancelar** pide motivo en un proyecto activo.

## API (`/api/proyectos/proyectos`)

`GET /opciones` (nichos con sus empresas elegibles, tiendas con su ocupación, artículos, monedas, plantillas), `POST /candidatos`, `GET /` (`?estado=todos|activos|vencidos|cerrados|borradores|cancelados&anio=`), `POST /`, `GET /:id`, `PUT /:id`, `POST /:id/vista-previa`, `POST /:id/activar` (con `idempotencyKey`), `POST /:id/cancelar`.

## Verificación

`node scripts/proyectos/verificar-reparto.js` en una base desechable (pruebas puras con 300 repartos al azar y por HTTP todo lo anterior; limpia lo que crea). Se corrió también en MariaDB 11.8.
