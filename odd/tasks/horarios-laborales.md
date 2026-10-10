# horarios-laborales

Rama: `feature/horarios-laborales` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: T1–T4 hechas.

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
- [x] T1 · Script de base de datos (`horarios_laborales.sql`): tablas `horarios_laborales` y `feriados`, 7 filas iniciales de horario (no laborales, sin horas), permiso `admin.horarios.gestionar` dado al Administrador. (1c6c02a)
- [x] T2 · Backend admin: repositorios, servicio con validaciones y rutas. (3f45903)
- [x] T3 · Frontend: pestaña nueva en la vista del administrador (horario semanal + feriados por país). (a07bb2e)
- [x] T4 · Documentación y verificación de punta a punta.

## Verificación y evidencia
- T1: script aplicado dos veces sin error (MySQL 8.4.11); 7 filas no laborales, 0 feriados, permiso asignado al Administrador; el CHECK rechaza inicio>fin, día 8 y no laboral con horas.
- T2: eslint limpio; 47 comprobaciones PASS (GET/PUT, validaciones 400, 403 sin permiso, CRUD de feriados, 404, choques 409) contra el router montado en una app temporal.
- T3: eslint sin errores nuevos; navegador: pestaña visible, interruptor habilita/vacía horas, errores de cliente y de servidor, guardado con toast, agregar/editar/eliminar feriado con modales, estado vacío, sin errores de consola.
- Datos de prueba restaurados: 7 días no laborales sin horas, 0 feriados.

## Ruta por tarea
T1–T4: delegado directo (un escritor).

## Siguiente paso
Esperar la explicación del usuario para la lógica de horarios y feriados en vales.
