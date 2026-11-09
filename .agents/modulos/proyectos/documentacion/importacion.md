# Importación de empresas por CSV (fase 2b)

Carga muchas empresas a la vez. Permiso: `proyectos.clientes.importar` (supervisor y administrador por defecto en la propuesta).

## Flujo

1. **Archivo (S8).** Se descarga la plantilla (`GET /clientes/importar/plantilla`) y se sube un `.csv`.
2. **Vista previa (S9).** `POST /clientes/importar/previsualizar` clasifica cada fila: **nueva**, **duplicada** (con la empresa que se le parece y por qué) o **con error** (con el motivo por columna). No guarda nada. Para las duplicadas se elige **Omitir** o **Completar** (llena lo que esté vacío, sin pisar datos y sin agregar contactos repetidos); el valor inicial sale de `importacion.duplicadas_por_defecto`.
3. **Resultado (S11).** `POST /clientes/importar/confirmar` crea las nuevas con `origen = 'importacion'` y la tienda de quien importa, y registra la corrida en `proy_importaciones` (filas, creadas, actualizadas, duplicadas, con error). «Descargar errores (CSV)» se arma en el navegador.

## Reglas

- **Sin estado en el servidor.** El archivo viaja en la vista previa y otra vez al confirmar; la confirmación **revalida todo** (si alguien creó la empresa entre una y otra, se trata como duplicada).
- **Las mismas reglas que el registro:** ajustes `empresas.*` (ciudad, contacto, teléfono o correo y sitio web obligatorios), teléfono normalizado por país, alcance por país («País no asignado a tu usuario»), nicho y área por nombre sin importar acentos ni mayúsculas.
- **Repetidas dentro del archivo:** la primera sigue; la segunda se marca con la línea de la primera.
- **Límites:** `importacion.max_filas` (2,000) e `importacion.max_mb` (5); el tope duro de subida es 20 MB. Solo `.csv`.
- **Lector propio** (`src/modules/proyectos/csv.js`): BOM, coma, punto y coma o tabulador, comillas y saltos de línea dentro de comillas; UTF-8 o Windows-1252 (Excel de Windows); máximo 30 columnas y 1,000 caracteres por celda. **Nada se interpreta como fórmula**; en el CSV de errores, las celdas que empiezan con `= + - @` se neutralizan con un apóstrofo.
- **Idempotencia:** la pantalla genera una clave por archivo; la clave se guarda en `idempotency_keys` **dentro de la misma transacción** que las empresas, así que confirmar dos veces (incluso a la vez, en procesos distintos) crea una sola vez; la segunda respuesta trae `repetida: true`.
- **Límite de frecuencia por persona:** 30 vistas previas y 10 confirmaciones cada 10 minutos (429 con mensaje claro).
- Todo el alta ocurre en **una transacción**: si algo falla, no queda nada a medias.

## Columnas de la plantilla

`empresa, nicho, pais, ciudad, telefono, direccion, sitio_web, contacto_nombre, contacto_area, contacto_cargo, contacto_telefono, contacto_correo`. (`empresa`, `nicho` y `pais` son siempre obligatorias; en la fase 2c se suma una columna por cada campo propio.)

## Verificación

`node scripts/proyectos/verificar-importacion.js` en una base desechable (lector CSV, archivos inválidos, límites, vista previa, confirmación, idempotencia simultánea, completar duplicadas y límite de frecuencia; limpia lo que crea).
