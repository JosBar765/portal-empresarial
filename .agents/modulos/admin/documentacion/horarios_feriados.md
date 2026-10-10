# Pestaña «Horarios y feriados» (Administración)

Solo CRUD. Ninguna regla de vales (vencimientos de 24 h, fecha mínima de entrega, días hábiles) consulta todavía estas tablas; esa lógica llegará después.

## Base de datos

Script `horarios_laborales.sql` (idempotente; se importa a mano en producción; reversa en su encabezado):

- `horarios_laborales`: una fila por día (`dia_semana` 1 = lunes ... 7 = domingo, único). `laboral` 0/1; `hora_inicio`/`hora_fin` TIME. CHECK: no laboral => horas NULL; laboral => ambas con inicio < fin. MySQL 8.0.16+ lo aplica; en motores que lo ignoran, valida el servicio. Se siembran los 7 días como no laborales, sin horas.
- `feriados`: `pais_id` (FK a `paises`), `fecha`, `nombre` (100), `se_repite_cada_anio`. UNIQUE (`pais_id`, `fecha`). Sin datos iniciales: los carga el administrador (se parte solo con Guatemala).
- Permiso `admin.horarios.gestionar`, asignado al rol Administrador por nombre. Tras importarlo, el administrador debe iniciar sesión de nuevo.

## API (`/api/admin`, todas con `admin.horarios.gestionar`)

| Método y ruta | Qué hace |
| --- | --- |
| `GET /horarios` | Los 7 días: `{ diaSemana, laboral, horaInicio, horaFin }` (horas `HH:MM` o `null`). |
| `PUT /horarios` | Body `{ dias: [7 días] }`. Valida todo y escribe en una transacción; devuelve los 7 días. |
| `GET /horarios/paises` | Países disponibles (reutiliza el catálogo de tiendas). |
| `GET /feriados?paisId=` | Feriados del país (sin `paisId`, todos), ordenados por mes y día. |
| `POST /feriados` | `{ paisId, fecha, nombre, seRepiteCadaAnio }`. |
| `PUT /feriados/:id` | `{ fecha, nombre, seRepiteCadaAnio }`. El país no cambia (se elimina y se crea de nuevo). |
| `DELETE /feriados/:id` | Elimina; 404 si no existe. |

Validaciones (400 con mensaje en español, nunca 500 por entrada inválida): día 1-7 sin repetirse y exactamente 7; `laboral` booleano; horas `HH:MM` 24 h; inicio < fin; día no laboral con horas => error; país existente; fecha `AAAA-MM-DD` real, año 2000-2100; nombre obligatorio, <= 100, sin caracteres de control. Choque de feriados => 409.

Choques: dos feriados del mismo país chocan si tienen la misma fecha, o el mismo día y mes cuando alguno de los dos se repite cada año (p. ej. un «25/12 anual» y un «25/12/2027» exacto). El 29 de febrero anual solo coincide con otro 29 de febrero.

## Frontend

`views/horarios.js`, funciones en `api/adminApi.js`, estado en `state.js`, pestaña `horarios` en `layout/sidebar.js` e `index.html`, estilos al final de `css/styles.css`. Sección 1: tabla de 7 días; al desmarcar «Laboral» las horas se deshabilitan y se vacían; un solo botón «Guardar horario». Sección 2: selector de país (Guatemala por defecto), tabla de feriados con fecha `dd/mm/aaaa`, modales de agregar/editar y de confirmar eliminación.

## Cómo verificar a mano

1. Iniciar sesión como Administrador y abrir «Horarios y feriados».
2. Marcar y desmarcar un día: las horas se habilitan y se vacían. Guardar con inicio >= fin muestra el error.
3. Agregar, editar y eliminar un feriado; intentar repetir la fecha muestra «Ya existe un feriado...».
4. Restaurar: los 7 días como no laborales y sin feriados de prueba.
