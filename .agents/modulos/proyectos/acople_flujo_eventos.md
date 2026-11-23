# Acople del flujo de Eventos al módulo Proyectos

Estado: **aplicado a `propuesta_modulo.md`** (2026-11-05). Las decisiones de las preguntas 13 y 14 quedaron confirmadas con la recomendación de este documento. Los diez ajustes (B1 a B10) se aplicaron al portal con algunas adaptaciones; este documento conserva el análisis original, con las precisiones marcadas como **Adaptación** en cada ajuste. Qué se adoptó, qué se adaptó y por qué: `decisiones_acople_eventos.md`. Si algo de aquí difiere de `propuesta_modulo.md`, manda la propuesta.
Origen de las reglas: el sistema de gestión de eventos en producción (`eventos_mt`, módulo **Gestión de Venta** y pantalla **Rendimiento**). Es el documento que la pregunta 10 de la propuesta pedía: aquí queda lo que de ese flujo sirve a Proyectos.

## 1. Criterio: qué entra y qué no

Solo se lleva una regla de Eventos si cumple **las dos** condiciones:

1. Cambia la **estructura** de Proyectos (una tabla, una columna, un permiso, una regla o una métrica).
2. Evita un problema que Eventos **ya tuvo** en uso real, o cubre un hueco que la propuesta deja abierto.

Se copian **reglas**, no código: el portal es Node/MySQL y Eventos es PHP/MariaDB. Todo lo demás (cosas propias de un evento, o que Proyectos ya resuelve mejor) está en la sección 5 y se deja fuera a propósito.

## 2. Equivalencias

El «mismo flujo que el evento» de la idea del 4 de noviembre se traduce así:

| En Eventos | En Proyectos | Comentario |
|---|---|---|
| Evento (carrera) | **Empresa** de la base global | Eventos tiene fecha propia; la empresa no. |
| Asignación de un evento a un asesor | **Participación** (empresa dentro de un proyecto) | Ya está en la propuesta. |
| Oportunidad con 5 etapas | Estado de la participación | Misma idea; en Proyectos sube sola por lo que el asesor registra. |
| Números COT y OV pegados desde Odoo | **Referencia** de la cotización y de la venta | Hoy la propuesta solo guarda monto y vale. Ver ajuste B2. |
| Próximo contacto | `proxima_gestion_en` | Ya está. Ver ajuste B7. |
| Historial de cambios | `proy_gestiones`, `proy_reasignaciones`, `proy_historial` | Ya está. |
| Rendimiento: meta, semáforo, alcance, PDF | Informe de cierre y panel de supervisor | Ver ajustes B6 y B8. |
| Supervisor que cubre varias tiendas | `supervisor_tiendas` | Ver ajuste B4. |

## 3. Ajustes necesarios a la propuesta

Cada ajuste dice **qué cambia**, **qué pasó en Eventos** y **dónde se refleja** en `propuesta_modulo.md`.

### B1. La unicidad se garantiza en la base de datos, no solo en el servicio

- **Qué cambia.** Las reglas 2 y 3 («una empresa en un solo proyecto activo» y «una tienda en un solo proyecto activo») se respaldan con índices únicos, no solo con consultas del servicio.
  - `proy_participaciones`: columna `abierta` (1 mientras su proyecto está activo; 0 al cerrar o cancelar) y columna generada **VIRTUAL** `cliente_abierto_id = IF(abierta = 1, cliente_id, NULL)` con índice **único**.
  - `proy_proyecto_tiendas`: igual, con `proyecto_abierto` y `tienda_abierta_id`.
  - Los NULL repetidos no chocan en un índice único, por eso las filas de proyectos cerrados no estorban.
- **Qué pasó en Eventos.** Usan este mismo patrón (columna virtual + índice único + `INSERT IGNORE`) y lo declaran «la fuente de verdad». La columna tiene que ser VIRTUAL: con STORED y claves foráneas en cascada MariaDB 11 dio el error 1901 en producción.
- **Por qué importa aquí.** Dos supervisores comparten las mismas 10 tiendas (propuesta 4.3): pueden activar a la vez. Sin índice único, los dos repartirían las mismas empresas.
- **Activar** debe ser idempotente (un doble clic devuelve el mismo resultado) y bloquear en orden fijo: `proy_proyectos` → `proy_proyecto_tiendas` → `proy_clientes` → `proy_participaciones`.
- **Adaptación.** Aquí **no se usa `INSERT IGNORE`**: el servicio inserta dentro de la transacción y captura el error de duplicado para decir qué tienda o empresa ya está en otro proyecto. Activar compara el estado en la misma sentencia (`WHERE estado = 'borrador'`) y acepta `idempotencyKey`. Es la primera columna generada del portal: se prueba en `staging` (MariaDB) antes de depender de ella, con una tabla `proy_clientes_abiertos` como alternativa.
- **Dónde.** Secciones 6 (reglas 2 y 3) y 10.3.

### B2. Referencia COT / OV en cotizaciones y ventas

- **Qué cambia.** `proy_cotizaciones.referencia` (número de cotización) y `proy_ventas.referencia` (número de OV), ambas texto. **La venta no se guarda sin referencia.** *(Adaptación: la cotización también lleva su número, y una referencia repetida avisa y pide confirmar, sin bloquear. Se asume el mismo sistema contable en todas las tiendas: pregunta 15, respondida.)*
- **Qué pasó en Eventos.** Pasar a `cotizado` exige el número de cotización y pasar a `vendido` exige el de OV; se pegan desde Odoo. Es lo que permite verificar una venta contra el sistema contable.
- **Por qué importa aquí.** El propósito del módulo es «medir cuánto se vendió». Un monto escrito a mano, sin número, no se puede comprobar.
- **Dónde.** Sección 10.4; flujo 5.2-C pasos 4 y 5.

### B3. Cómo se corrige un registro equivocado

- **Qué cambia.** La regla 6 dice que gestiones, cotizaciones y ventas no se editan ni se borran, pero no dice qué pasa si un asesor escribe mal un monto. Se agrega:
  - Columnas `anulada_en`, `anulada_por` y `anulacion_motivo` en `proy_cotizaciones` y `proy_ventas`. Una venta anulada se reemplaza con una nueva.
  - Permiso **`proyectos.corregir`** (Supervisor y Administrador): anular un registro y reabrir una participación `perdida` o `vendida` mientras el proyecto siga activo.
  - Los informes **excluyen** lo anulado; queda en `proy_historial`.
  - *Adaptación:* al anular, el estado de la participación se **recalcula** con la precedencia `vendida` > `cotizada` > `interesada` > `en_gestion` > `pendiente`, ignorando lo anulado.
- **Qué pasó en Eventos.** Existe el permiso `oportunidades.corregir` para sacar un pipeline de un estado cerrado, y cada cambio queda en el historial con quién lo hizo.
- **Dónde.** Secciones 4.2, 6 (regla 6) y 10.4.

### B4. El alcance del supervisor tiene tres niveles

- **Qué cambia.** La propuesta define quién ve qué por rol, pero un proyecto abarca varias tiendas y no dice qué ve un supervisor cuyas tiendas solo coinciden en parte con las del proyecto. Se definen tres niveles separados (**ver no da poder de actuar**):

  | Nivel | Regla |
  |---|---|
  | **Lectura del proyecto** | Un supervisor ve el proyecto completo si al menos una de **sus** tiendas está en el alcance. |
  | **Acción** | Solo reasigna, anula o corrige participaciones de asesores de **sus** tiendas. |
  | **Fila** | Un asesor ve solo **sus** participaciones. |

  - Las participaciones de otras tiendas aparecen como «Otra tienda» (nombre de la empresa y etapa), **sin contactos, referencias ni montos**, y ninguna acción las acepta.
- **Qué pasó en Eventos.** Esa distinción se corrigió tres veces porque un supervisor **no tiene `tienda_id`**: cubre tiendas por una relación muchos a muchos (`usuario_tiendas_supervisadas`). Ahí también existe la insignia «Otra tienda» y los datos sensibles de esas filas se envían en `null`.
- **Por qué importa aquí.** Es justo el caso de las dos personas supervisoras de Centroamérica; además protege los datos personales de la sección 16.
- **Dónde.** Sección 4.3 y regla 5.

### B5. Los permisos se comprueban por código, nunca por nombre de rol

- **Qué cambia.** Se hace explícito en el backend: ningún servicio pregunta `rol === 'admin'`. El alcance global es un permiso (`proyectos.ver_gerencia`), no un rol.
- **Qué pasó en Eventos.** La migración 024 nació porque Gerencia veía 0 eventos, y aun así quedaron comprobaciones por nombre de rol en tres funciones.
- **Nota de despliegue (corregida).** En este portal los permisos viajan en el token de sesión y se refrescan en caliente solo cuando un administrador los cambia **desde la pantalla de roles**. Una migración SQL no dispara ese refresco: los usuarios los reciben al volver a iniciar sesión o en el siguiente refresco del token. Va en la lista de verificación de la fase 8 (activación).
- **Dónde.** Sección 4.2 y fase 8 de la sección 14.2.

### B6. Las cifras se calculan en un solo lugar y son acumulativas

- **Qué cambia.**
  - Una única función de informe calcula las métricas; la pantalla, el PDF y la exportación **solo la llaman**. Así nunca dicen cosas distintas.
  - Las tasas son **acumulativas**: *Contactadas* = todas menos las pendientes; *Cotizadas* = con cotización **o** con venta. Una venta sin cotización previa cuenta como cotizada, para que el embudo nunca quede invertido.
  - Se fija el **semáforo**: verde ≥ 75 %, ámbar 50–74 %, rojo < 50 % (los mismos umbrales de Rendimiento). *(Adaptación: durante el proyecto mide la cobertura, gestionadas ÷ asignadas; al cierre, la efectividad, interesadas ÷ asignadas. Los umbrales viven en `constantes.js`.)*
  - En el PDF, las tablas largas se cortan en 20 filas con «y N más»; la lista completa va en la exportación (mejora 10).
- **Qué pasó en Eventos.** Se puede vender sin pasar por cotizado, y por eso la métrica «fue cotizado» usa varias señales. Un solo objeto de reporte genera el PDF y el Excel.
- **Dónde.** Sección 11.

### B7. Seguimiento: una sola fecha y un orden de prioridad fijo

- **Qué cambia.**
  - `proxima_gestion_en` vive **solo** en `proy_participaciones`; `proy_gestiones.proxima_en` es un dato histórico de cada registro, no una segunda fuente.
  - **Vencido** = fecha de seguimiento anterior a hoy. «Hoy» sale de `ahoraUTC6()` en `core/calendario`: toda la región usa UTC-6, así que no hay zonas horarias por país.
  - Orden de «Mi proyecto» y «Para hoy»: cerradas al final → vencidas primero → fecha más próxima → sin contactar antes que contactadas.
  - Se añade una métrica al informe: **tiempo de reacción** (días entre `asignada_en` y la primera gestión). Dice si el asesor realmente empezó.
- **Qué pasó en Eventos.** Mantener la fecha duplicada en dos tablas (con un espejo del mínimo) fue una complicación constante. La fecha por asesor es la única fuente.
- **Dónde.** Secciones 5.2-C y 11; regla de «estancado» (pregunta 7).

### B8. Proyecto vencido: avisar y bloquear, no dejar el problema colgado

- **Qué cambia.** Un proyecto `activo` cuya `fecha_fin` ya pasó, más **3 días hábiles de gracia** (decidido), se considera **vencido**:
  1. Se avisa al supervisor y al gerente (notificación `proyectos`).
  2. Mientras exista, **no se puede crear otro proyecto** para esas tiendas (regla 3), y el mensaje dice cuál hay que cerrar.
  3. **No se cierra solo**: el cierre necesita las conclusiones del supervisor.
  - *Adaptación:* el aviso sale una sola vez (columna `aviso_vencido_en`) desde una revisión periódica, con el patrón de los vigilantes de Vales.
- **Qué pasó en Eventos.** Dejar pipelines vencidos abiertos generó una «deuda» visible que nadie resolvía, y terminaron cerrándolos automáticamente. Aquí el cierre automático no es posible, pero sí evitar que un proyecto olvidado deje empresas y tiendas bloqueadas.
- **Dónde.** Sección 6 (regla nueva), 5.2-E y 12 (notificaciones).

### B9. Notificaciones: no avisar al propio autor

- **Qué cambia.** Una acción notifica solo si quien la hace es **distinto** del destinatario. En una reasignación se avisa a quien **recibe** y a quien **pierde** la empresa.
- **Qué pasó en Eventos.** Se añadió el aviso de desasignación (migración 037) y la regla de no avisar al autor.
- **Dónde.** Sección 12, fila «Notificaciones».

### B10. Índices y listas por lotes desde el inicio

- **Qué cambia.**
  - Índices compuestos creados **junto con la tabla**: `proy_gestiones (participacion_id, creado_en)` y `proy_gestiones (usuario_id, creado_en)`, para la línea de tiempo y para medir actividad por asesor.
  - «Base de clientes» y «Mi proyecto» cargan en **lotes de 50** con scroll infinito (el mismo tamaño y patrón del Buzón de Vales; en Eventos son de 60); el endpoint del informe tiene tope de filas y de rango.
- **Qué pasó en Eventos.** Los índices compuestos se añadieron tarde (migraciones 045 y 049) cuando las listas ya eran lentas, y el render por lotes y el tope de filas se hicieron después.
- **Dónde.** Secciones 10.3 y 10.4; pantallas 1 y 4 de la sección 9.

## 4. Preguntas de este documento: respondidas

| # | Pregunta | Decisión (2026-11-05) |
|---|---|---|
| 13 | ¿Quién confirma una venta? En Eventos un asesor sin permiso de cierre **solicita** y el supervisor **aprueba**. | **El asesor la registra directamente**, con referencia OV obligatoria (B2); el supervisor puede anularla (B3). Sin aprobación previa. |
| 14 | ¿Cuántos días de gracia tras la `fecha_fin` antes de marcar un proyecto como vencido (B8)? | **3 días hábiles**, contados con el calendario laboral. |

La pregunta 10 de la propuesta queda respondida con este documento. Al contrastar con el portal surgieron dos preguntas más, ya respondidas en la sección 18 de la propuesta: la 15 (referencias obligatorias en todas las tiendas, se asume un mismo sistema contable en la región; si un país no lo usara, sería opcional solo para él) y la 16 (el semáforo mide cobertura durante el proyecto y efectividad al cierre, con umbrales de 75 % y 50 %).

## 5. Lo que NO se lleva (y por qué)

| En Eventos | Por qué no entra en Proyectos |
|---|---|
| Varios asesores por evento y pipeline por par (evento, usuario) | Una empresa tiene **un** asesor por proyecto (`UNIQUE(proyecto_id, cliente_id)`). Esa fue la parte más difícil de Eventos y aquí se evita. |
| Cierre por competencia (otro asesor vendió primero) y cierre en cascada | Consecuencia directa del punto anterior. |
| Solicitud y aprobación de cierre | Decidido en la pregunta 13: el asesor registra la venta y el supervisor puede anularla. |
| Fecha del evento, recurrencia, ediciones, póster, organizadores, categorías de carrera, lugares, «cohorte» | Propios de un evento. |
| Reasignar como «desasignar y asignar» | La participación conserva su historial al cambiar de asesor (`proy_reasignaciones`); es más simple y no pierde continuidad. |
| Asignar arrastrando tarjetas | El reparto es automático y la reasignación es de un clic. |
| Espejo de la fecha de contacto hacia otra tabla | Solo hay una fuente (B7). |
| Cierre automático de pipelines por fecha | Se sustituye por el aviso de B8. |
| Alcance guardado en `localStorage`, caché de lista en el navegador | Detalle de interfaz; se decide en el mockup. |

## 6. Cómo queda reflejado en `propuesta_modulo.md`

Estos cambios **ya están aplicados** en `propuesta_modulo.md` (2026-11-05). Se conservan aquí como registro; el detalle de cada adaptación está en `decisiones_acople_eventos.md`:

| Sección | Cambio |
|---|---|
| 4.2 Permisos | Añadir `proyectos.corregir` (Supervisor, Administrador). Nota de re-inicio de sesión (B5). |
| 4.3 Alcance | Reemplazar por los tres niveles de B4. |
| 6 Reglas | Ajustar las reglas 2, 3 y 6 (B1, B3). Añadir: referencia OV obligatoria en la venta (B2); métricas acumulativas (B6); proyecto vencido (B8); notificar solo a destinatarios distintos del autor (B9). |
| 10.3 | Columnas `abierta`, `cliente_abierto_id`, `proyecto_abierto` y `tienda_abierta_id` con sus índices únicos (B1). |
| 10.4 | `referencia`, `anulada_en`, `anulada_por`, `anulacion_motivo` e índices de `proy_gestiones` (B2, B3, B10). |
| 11 | Reglas de cálculo, semáforo, tiempo de reacción y corte del PDF (B6, B7). |
| 12 | Notificaciones (B8, B9). |
| 14.2 | Lista de verificación de la fase 8 (B5). |
| 18 | Preguntas 10, 13, 14, 15 y 16 respondidas. |

Con esto el módulo gana: **seguridad ante concurrencia**, **ventas verificables**, **alcance correcto entre supervisores**, **cifras que cuadran** y **un cierre que no deja proyectos colgados**. Nada más de Eventos hace falta.

## 7. Dónde está cada regla en Eventos (para verificar)

Rutas relativas al repositorio `eventos_mt`.

| Tema | Archivos |
|---|---|
| Transiciones del pipeline y exigencia de COT / OV | `api/gestion_venta_helper.php` (`validarTransicionOportunidad`) |
| Cierre, bloqueo en orden fijo e idempotencia | `api/oportunidades_cierre_helper.php` |
| Solicitud de cierre | `api/gestion_venta.php`, migraciones `029` y `030` |
| Unicidad por columna virtual | migraciones `008`, `026`, `029` y `031` |
| Alcance de supervisor y «fuera de mi equipo» | `api/asignaciones_guard.php`, `api/usuarios_guard.php` |
| Permiso global y corrección | migraciones `024` y `025` |
| Seguimiento y orden de prioridad | `js/gestion_venta.js` (`gvEsVencido`, `gvEsAtrasado`) |
| Métricas, tasas y semáforo | `js/rendimiento_helper.js` |
| Informe PDF / Excel | `js/rendimiento_reportes.js`, `js/gv_reportes.js` |
| Cierre automático por vencimiento | `api/oportunidades_vencidas_helper.php` |
