# Pestaña «Horarios y feriados» (Administración)

Esta pestaña administra los datos; cada cambio (horario, feriados, parámetro, hora máxima de un taller) invalida el caché del calendario laboral (`src/core/calendario/`). La aplicación de estas reglas a los vales (plazos en horas laborales, fecha mínima de entrega) está en §5.1 del flujo del vale de arte.

Además del horario y los feriados, la pestaña edita las **horas de vencimiento de un vale de arte** (parámetro global, entero de 1 a 48, por defecto 4) y cada día lleva la casilla **«Recibe vales de arte»** (solo un día laboral puede recibir vales). La **hora máxima de recibimiento** de cada taller (por defecto 12:00) se edita en «Gestionar Talleres» (ver al final).

## Base de datos

Script `horarios_laborales.sql` (idempotente; se importa a mano en producción; reversa en su encabezado):

- `horarios_laborales`: una fila por día (`dia_semana` 1 = lunes ... 7 = domingo, único). `laboral` 0/1; `hora_inicio`/`hora_fin` TIME. CHECK: no laboral => horas NULL; laboral => ambas con inicio < fin. MySQL 8.0.16+ lo aplica; en motores que lo ignoran, valida el servicio. `recibe_vales` 0/1 con CHECK «si no es laboral no recibe vales». Se siembran los 7 días con el horario real (lunes a viernes 08:00-18:00 y reciben vales; sábado 08:00-12:00 sin recibir vales; domingo no laboral) sin pisar lo ya cargado.
- `parametros_sistema` (`clave`, `valor`, `descripcion`): fila `horas_vencimiento_vale` = 4.
- `talleres.hora_maxima_recepcion` TIME NOT NULL, por defecto 12:00:00.
- `feriados`: `pais_id` (FK a `paises`), `fecha`, `nombre` (100), `se_repite_cada_anio`. UNIQUE (`pais_id`, `fecha`). Dato inicial: Guatemala, 20/10 «Día de la Revolución», anual.
- Permiso `admin.horarios.gestionar`, asignado al rol Administrador por nombre. Tras importarlo, el administrador debe iniciar sesión de nuevo.

## API (`/api/admin`, todas con `admin.horarios.gestionar`)

| Método y ruta | Qué hace |
| --- | --- |
| `GET /horarios` | Los 7 días: `{ diaSemana, laboral, recibeVales, horaInicio, horaFin }` (horas `HH:MM` o `null`). |
| `PUT /horarios` | Body `{ dias: [7 días] }`. Valida todo y escribe en una transacción; devuelve los 7 días. |
| `GET /horarios/parametros` | `{ horasVencimientoVale }`. |
| `PUT /horarios/parametros` | Body `{ horasVencimientoVale }`: entero 1-48 (rechaza decimales, texto, vacío o fuera de rango con 400). |
| `GET /horarios/paises` | Países disponibles (reutiliza el catálogo de tiendas). |
| `GET /feriados?paisId=` | Feriados del país (sin `paisId`, todos), ordenados por mes y día. |
| `POST /feriados` | `{ paisId, fecha, nombre, seRepiteCadaAnio }`. |
| `PUT /feriados/:id` | `{ fecha, nombre, seRepiteCadaAnio }`. El país no cambia (se elimina y se crea de nuevo). |
| `DELETE /feriados/:id` | Elimina; 404 si no existe. |

Validaciones (400 con mensaje en español, nunca 500 por entrada inválida): día 1-7 sin repetirse y exactamente 7; `laboral` booleano; horas `HH:MM` 24 h; inicio < fin; día no laboral con horas o con `recibeVales` verdadero => error (`recibeVales` omitido = falso); país existente; fecha `AAAA-MM-DD` real, año 2000-2100; nombre obligatorio, <= 100, sin caracteres de control. Choque de feriados => 409.

Choques: dos feriados del mismo país chocan si tienen la misma fecha, o el mismo día y mes cuando alguno de los dos se repite cada año (p. ej. un «25/12 anual» y un «25/12/2027» exacto). El 29 de febrero anual solo coincide con otro 29 de febrero.

## Frontend

`views/horarios.js`, funciones en `api/adminApi.js`, estado en `state.js`, pestaña `horarios` en `layout/sidebar.js` e `index.html`, estilos al final de `css/styles.css`. Sección 1: tabla de 7 días; al desmarcar «Laboral» las horas y la casilla «Recibe vales de arte» se deshabilitan y se vacían; un solo botón «Guardar horario». Sección 2: campo «Horas de vencimiento de un vale de arte» con su botón Guardar. Sección 3: selector de país (Guatemala por defecto), tabla de feriados con fecha `dd/mm/aaaa`, modales de agregar/editar y de confirmar eliminación.

## Hora máxima de recibimiento por taller («Gestionar Talleres»)

Permiso `admin.talleres.gestionar`. Columna «Hora máxima» y botón con ícono de reloj, que abre un modal igual al del límite diario (`actions/tallerHoraMaxima.js`). Endpoint `PUT /api/admin/talleres/:id/hora-maxima` con `{ horaMaxima: "HH:MM" }`: obligatoria, 24 h de 00:00 a 23:59 (no admite vacío ni «24:00»); taller inexistente => 404. `GET /api/admin/talleres` devuelve `hora_maxima_recepcion` (`HH:MM`).

## Cómo verificar a mano

1. Iniciar sesión como Administrador y abrir «Horarios y feriados».
2. Marcar y desmarcar un día: las horas se habilitan y se vacían. Guardar con inicio >= fin muestra el error.
3. Agregar, editar y eliminar un feriado; intentar repetir la fecha muestra «Ya existe un feriado...».
4. Restaurar: los 7 días como no laborales y sin feriados de prueba.
