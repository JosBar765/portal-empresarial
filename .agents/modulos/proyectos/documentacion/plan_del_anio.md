# Plan del año y activación automática (fase 9e)

Mockups aprobados en Figma (página «06 · Administrador»): **A2** (grilla del año), **A2b** (con el panel de activación automática) y **A2c** (modal «Planificar un mes»).

## Plan del año (A2, `#/plan`)

- **Qué es:** para cada mes, el **nicho**, el **artículo de muestra** y la **plantilla** que toca. Es **uno solo para toda la región** (la tabla `proy_plan_nichos` guarda `pais_id` NULL; el plan por país queda para una mejora posterior).
- **Estados de un mes:** *Sin plan*, *Planificado*, *Borrador*, *Esperando aprobación*, *Activo* o *Cerrado* (según el proyecto de ese mes; uno cancelado deja el mes libre).
- **Reglas:** un mes que ya pasó, o que ya tiene un proyecto activo, esperando aprobación o cerrado, **no se puede cambiar ni quitar** (409). El artículo y la plantilla son opcionales: sin ellos manda la plantilla (o la predeterminada).
- **Historial:** cada cambio queda en el historial de configuración (área «Plan del año»); guardar sin cambios no agrega nada.
- **Sugerencia al crear un proyecto:** el asistente propone el nicho, el artículo y la plantilla del plan para el mes elegido, en un proyecto nuevo. Si la persona elige otro nicho, el botón «Usar la sugerencia del plan» lo recupera.

## Activación automática

Se enciende y se ajusta en el mismo A2 (parámetros `activacion_auto.activa`, `.dia` y `.hora`). El vigilante de Proyectos (cada 15 minutos) la revisa:

1. **Cuándo:** el día elegido a la hora elegida (hora de Guatemala). `dia` 0 = primer día hábil del mes; un día del 1 al 28 que cae en fin de semana pasa al siguiente día hábil.
2. **Qué crea:** el proyecto del mes con el plan (nicho, artículo, plantilla), con **todas las tiendas libres que tienen asesores** y fecha de inicio ese día. Una tienda con otro proyecto activo se deja fuera.
3. **Aprobación:** si «Aprobar activación» está encendida, el proyecto queda **esperando la aprobación del gerente** (sin repartir); si no, se activa y se reparte en el momento.
4. **Quién figura como creador:** la persona que cambió por última vez el interruptor de activación automática (o, si ya no está activa, el primer administrador).
5. **Avisos:** el éxito avisa a los supervisores de las tiendas y a gerencia (evento «Proyecto activado por el plan del año», configurable en Notificaciones); un fallo avisa **solo a los administradores**.
6. **Una vez por mes:** si el mes ya tiene un proyecto (aunque sea manual) no crea otro. Un mes sin proyecto vuelve a intentarse en cada vuelta del vigilante hasta que se pueda.

**Si no se puede, no deja nada a medias:** sin plan, sin plantilla, sin tiendas libres con asesores, sin empresas disponibles del nicho o con la plantilla pidiendo datos obligatorios, no se crea ningún proyecto (el borrador que se alcanzó a crear se borra) y se avisa a los administradores con el motivo. El aviso del mismo motivo en el mismo mes **no se repite**.

## API (`/api/proyectos`, solo `proyectos.administrar`)

| Ruta | Qué |
|---|---|
| `GET /config/plan/:anio` | los 12 meses del año con su estado, y la automatización con la próxima activación |
| `PUT /config/plan/:anio/:mes` | planifica el mes `{ nichoId, articuloId?, plantillaId? }` |
| `DELETE /config/plan/:anio/:mes` | quita el mes del plan |
| `GET`/`PUT /config/automatizacion` | los ajustes `activacion_auto.*` (solo esos) |
| `GET /proyectos/opciones` | ahora trae `plan` (el año actual y el siguiente) para sugerir el nicho |

## Código

`planAnual.js` (reglas puras de fechas) · `services/planService.js` · `services/activacionAutomaticaService.js` · `repositories/planRepository.js` · `controllers/planController.js` · `proyectosWatcher.js` · frontend `views/planAnio.js` (A2) y `views/proyectoAsistente.js` (sugerencia). No hay migración nueva: la tabla `proy_plan_nichos` ya venía de la migración de trabajo del asesor.

## Verificación

`node scripts/proyectos/verificar-plan.js` (base desechable; 44 comprobaciones): fechas, permisos, validaciones, meses que no se pueden cambiar, historial, sugerencia, vigilante apagado/espera/sin plan/éxito/no repetir, aprobación del gerente y fallos sin nada a medias.
