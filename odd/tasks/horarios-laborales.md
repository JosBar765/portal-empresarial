# horarios-laborales

Rama: `feature/horarios-laborales` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: T1–T4 pendientes.

## Objetivo
Tabla de horarios laborales de la empresa y de feriados por país, con una pestaña nueva en la vista del administrador para gestionarlos (**solo CRUD**). La lógica (vencimientos que solo corren en horario laboral, días hábiles, feriados que no reciben vales) llega después, cuando el usuario la explique; no se implementa aquí.

## Contexto de negocio (del usuario)
- Todas las tiendas abren y cierran a la misma hora y laboran los mismos días: el horario es **global**. Lo que cambia por país son los **feriados**.
- Hoy el sábado y el domingo se tratan como descanso en los vencimientos, pero la empresa labora unas horas el sábado (los vales siguen sin recibirse el sábado: restricción aparte). El horario servirá después para que el contador de vencimiento (24 h, quizá 3 h) solo descuente en horario laboral y no cuente feriados.

## Decisiones acordadas
- **Horario:** una fila por día de la semana (7 filas). Cada día es laboral o no; si no es laboral **no admite horario** (la pantalla deshabilita las horas y el servidor las rechaza). Si es laboral lleva hora de inicio y de fin.
- **Feriados:** por país (los de la tabla `paises`), con fecha exacta, nombre y la opción «se repite todos los años». De momento se parte solo con Guatemala: las tablas quedan **sin datos** y los carga el administrador.
- Cambios de base: script idempotente en `database/` (sin tocar `schema.sql`/`seed.sql`), citado en la documentación sin correlativo, con permiso nuevo por nombre.

## Tareas
- [ ] T1 · Script de base de datos (`horarios_laborales.sql`): tablas `horarios_laborales` y `feriados`, 7 filas iniciales de horario (no laborales, sin horas), permiso `admin.horarios.gestionar` dado al Administrador.
- [ ] T2 · Backend admin: repositorios, servicio con validaciones y rutas.
- [ ] T3 · Frontend: pestaña nueva en la vista del administrador (horario semanal + feriados por país).
- [ ] T4 · Documentación y verificación de punta a punta.

## Verificación y evidencia
(pendiente)

## Ruta por tarea
(pendiente)

## Siguiente paso
Delegar un escritor para T1–T4.
