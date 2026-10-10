# horarios-laborales

Rama: `feature/horarios-laborales` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: fase 1 (CRUD) hecha; fase 2 (lógica) en curso.

## Objetivo
Tabla de horarios laborales y de feriados por país, gestionadas desde una pestaña del administrador (fase 1, hecha), y **aplicar esas reglas a los vales** (fase 2): plazos que solo corren en horario laboral, fecha mínima de entrega, días en que no se entrega, y fin de las restricciones por día de la semana.

## Fase 1 (hecha): CRUD
Tablas `horarios_laborales` (7 filas, un horario por día; un día no laboral no admite horas) y `feriados` (por país, con «se repite todos los años»), permiso `admin.horarios.gestionar`, pestaña «Horarios y feriados». Commits 5e96300…8cd6485.

## Fase 2: decisiones del usuario (no suponer nada fuera de esto)
- **Plazos:** los tres de 24 h pasan a **N horas laborales** (hoy 4): vigencia de un vale en espera de autorización, vigencia de un `MOD-` y plazo de adjuntos tras el primer rechazo. N es **editable por el administrador** («HORAS DE VENCIMIENTO DE UN VALE DE ARTE»), número **entero** (1–48).
- **Cómputo:** solo corre dentro del horario laboral de cada día (los sábados cuentan sus horas: 08:00–12:00 en los datos actuales), salta noches, días no laborales y feriados. Un vale creado o rechazado fuera de horario empieza a contar al inicio del siguiente día laboral. El contador mostrado es el **tiempo laboral restante** y se detiene fuera de horario.
- **Aviso de próximo a vencer:** cuando queda el **25% del plazo** (con 4 h, cuando queda 1 h laboral). Reemplaza el aviso de 6 h.
- **Vales ya guardados:** se recalculan (en producción no hay vales pendientes de vencer; se verifica con una consulta antes de desplegar).
- **Fecha de entrega:** no se puede elegir un día que no reciba vales («RECIBE VALES DE ARTE», una casilla por día; el sábado no) ni un **feriado del país del vale**. **Hora máxima de recibimiento** (por taller, 12:00 por defecto, editable en «Gestionar Talleres»): un vale creado a esa hora o después no puede pedirse para hoy; la fecha mínima pasa al siguiente día válido (también si hoy es feriado o no recibe vales). Con varios talleres rige la **más restrictiva** (la fecha mínima más tardía).
- **País del vale:** el del destino. Diseño, Diseño UV/3D y Protextil son de **Guatemala**; los Diseño Local usan el país de **su tienda** (tienda → departamento → país). Zona horaria fija UTC-6 para todos.
- **Sin restricciones fuera del horario laboral:** se quitan las restricciones por sábado/domingo al operar (crear, corregir, reenviar, modificar, autorizar, aprobar modificación). Se conservan las de la fecha de entrega y, al autorizar, si la fecha de entrega ya venció el supervisor debe rechazar para que el asesor la corrija.
- **Atraso:** sin cambios (días corridos).
- **Seed del script** (datos actuales del usuario): L–V 08:00–18:00 y reciben vales; sábado 08:00–12:00 y NO recibe vales; domingo no laboral; feriado Guatemala 20/10 «Día de la Revolución» (anual).
- **Base de datos:** se modifica `03_horarios_laborales.sql` (nada se ha importado en producción). Idempotente también sobre bases que ya corrieron la versión de fase 1. Recordar al usuario importarlo ANTES de desplegar.

## Tareas
- [x] T1–T4 · Fase 1 (script, backend, pestaña, docs).
- [ ] T5 · Script: columna `recibe_vales`, columna `talleres.hora_maxima_recepcion` (12:00), parámetro de horas de vencimiento (4) y seed (horarios y feriado) con upgrade idempotente.
- [ ] T6 · Admin backend + pestañas: casilla «Recibe vales de arte» por día, campo «Horas de vencimiento de un vale de arte», y hora máxima por taller en «Gestionar Talleres».
- [ ] T7 · Servicio de calendario laboral (país del vale, sumar horas laborales, minutos laborales restantes, fecha mínima de entrega y días no disponibles) con pruebas por simulación de fechas.
- [ ] T8 · Plazos: reemplazar los tres de 24 h; vigilantes y aviso al 25%; contador de tiempo laboral y textos.
- [ ] T9 · Fecha de entrega (servidor y calendario del navegador) y fin de las restricciones por día; mensajes.
- [ ] T10 · Documentación (flujo §5.1, CLAUDE.md, correcciones) y verificación de punta a punta.

## Verificación y evidencia
(fase 1) 47 comprobaciones API y verificación en el navegador. (fase 2) pendiente.

## Ruta por tarea
Fase 1: escritor delegado. Fase 2: escritor A (T5–T6), escritor B (T7–T10).

## Siguiente paso
Escritor A (T5–T6).
