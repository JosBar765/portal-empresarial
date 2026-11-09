# Plantillas de proyecto, foto de configuración y aprobación (fase 3b)

## Plantillas (A4 y A4b) — `proyectos.administrar`

- **Qué guardan:** nombre, descripción, duración (se calcula de las etapas: días hábiles ÷ 5, redondeado hacia arriba), artículo y existencia sugeridos, tope por asesor, meta y moneda, etapas (nombre, qué se espera y **días hábiles**), si es la **predeterminada** (solo una) y si está **activa**. Semilla: «Proyecto mensual estándar» (4 etapas de 5 días).
- **Nunca se borran:** se desactivan; la predeterminada no se puede desactivar ni dejar de serlo sin elegir otra. Un proyecto que usó una plantilla conserva su copia (la foto).
- **Controles del supervisor (A4b):** para cada uno de **artículo, existencia, meta, tope y fechas de las etapas** el administrador elige **Editable**, **Bloqueado** o **Obligatorio**. Lo **bloqueado** el servidor lo hace cumplir (si el supervisor manda otro valor, 400; el valor de la plantilla manda) y para bloquear un dato la plantilla debe traerlo. Lo **obligatorio** puede quedar vacío en el borrador, pero **no se activa** sin completarlo.
- **Al crear un proyecto con una plantilla** (`plantillaId`): lo que no se manda se completa con los valores de la plantilla; las etapas se copian y reciben **fechas en días hábiles, una tras otra** a partir de la fecha de inicio (si las fechas están bloqueadas, las fija la plantilla); sin fecha de fin, se toma la de la última etapa.
- **API:** `GET/POST /config/plantillas`, `PUT /config/plantillas/:id`, `PATCH /config/plantillas/:id/activa`; las activas llegan al asistente en `GET /proyectos/opciones`. Cada cambio queda en el historial (entidad `plantilla`, filtro «Plantillas de proyecto» en A10).

## Foto de la configuración (`config_snapshot`)

Al activar, el proyecto guarda una foto: **todos los parámetros y reglas vigentes**, la configuración de los **países del alcance** y una **copia de la plantilla** (con controles y etapas). Lo que el administrador cambie después solo aplica a proyectos nuevos. El **vencimiento** ya la usa (los días de gracia de la foto, no los de hoy); los informes y el semáforo de las fases siguientes leerán de ahí.

## Aprobación del gerente (opcional)

Con `reglas.aprobar_activacion` apagada, el supervisor activa directamente (`POST /:id/activar`). Con la regla **encendida**, activar directo responde 409 y el camino es:
1. `POST /:id/pedir-aprobacion` (`proyectos.activar`): solo un borrador **completo**; pasa a `pendiente_aprobacion` (ya no se edita) y guarda quién y cuándo lo pidió.
2. `POST /:id/aprobar` (`proyectos.aprobar_activacion`, con `idempotencyKey`): **activa y reparte en ese momento**, con las mismas garantías de la activación (una tienda y una empresa por proyecto activo, idempotencia, bloqueo en orden fijo); queda `aprobada_por` y `activado_por`.
3. `POST /:id/rechazar` (mismo permiso, con **comentario obligatorio**): vuelve a `borrador` y el supervisor ve el comentario.

Quien tiene `proyectos.aprobar_activacion` ve todos los proyectos y su vista previa. Todo queda en `proy_historial` (`pedir_aprobacion`, `aprobar`, `rechazar`). `GET /proyectos?estado=aprobacion` es la cola del gerente.

## Pantallas

- **Plantillas de proyecto (A4/A4b):** lista a la izquierda y editor con pestañas **General**, **Etapas** (subir/bajar, días hábiles, total) y **Permisos del supervisor** (control segmentado por campo). La tarjeta de A0 se enciende.
- **Por aprobar (G5):** lo que se pide activar, la vista previa del reparto y **Aprobar y repartir** / **Rechazar con comentario**. La pantalla del supervisor con «Esperando aprobación» (T12) llega con el asistente (3c).

## Verificación

`node scripts/proyectos/verificar-plantillas-aprobacion.js` en una base desechable: validaciones, controles bloqueados y obligatorios, predeterminada, calendario de etapas, foto de configuración (y que un cambio posterior no la altera), el flujo pedir / rechazar / aprobar, permisos por rol e historial; limpia lo que crea.
