# Reglas de los Scripts SQL (`database/`)

Esta guía explica cómo está organizado `database/` y qué criterio seguir al agregar o modificar estructura, catálogos o datos de prueba, para que el SQL del proyecto se mantenga legible y mantenible en vez de convertirse en un solo archivo con comentarios ilegibles.

---

## Los tres archivos

```text
database/
├── schema.sql   # Estructura: CREATE TABLE, claves, índices. Cero datos.
├── seed.sql     # Datos reales mínimos para una instalación funcional.
└── mock.sql     # Datos de demostración/prueba (vales ficticios y su rastro).
```

Orden de importación sobre una base de datos vacía:

```text
1. schema.sql   -> crea únicamente la estructura
2. seed.sql     -> deja la BD en un estado inicial funcional
3. mock.sql     -> agrega datos ficticios para desarrollo/demostración
```

`seed.sql` puede ejecutarse solo sobre `schema.sql` y arrancar el portal (login de Administrador, catálogos, estructura organizacional). `mock.sql` solo tiene sentido después de los dos anteriores — depende de sus IDs de usuarios, tiendas y talleres.

**Importante:** en este proyecto el camino que de verdad se ejecuta es `src/config/database.js` (el mock en memoria que reemplaza a MySQL cuando no hay conexión — ver `CLAUDE.md`). Estos tres archivos SQL son el equivalente para una base de datos real; cualquier cambio de estructura, catálogo o dato de demostración debe reflejarse en **ambos lados**.

## Qué va en cada archivo

### `schema.sql` — estructura pura

Solo `CREATE TABLE`, `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `INDEX`, `ENUM`, `DEFAULT`. Ningún `INSERT` ni `UPDATE`. Las tablas van en orden de dependencia (una tabla nunca aparece antes que las que referencia por `FOREIGN KEY`).

### `seed.sql` — datos reales, mínimos y legítimos

Todo lo que la aplicación necesita para arrancar desde una instalación limpia:

- Catálogos (`paises`, `roles`, `permisos`, `rol_permisos`, `vale_productos`, `vale_materiales`).
- Estructura organizacional real (`departamentos`, `subdivisiones`, `tiendas`, `supervisor_asignaciones`).
- Usuarios que son **necesarios**, no solo "reales": el Administrador (para el primer login), y cualquier usuario que sea `FOREIGN KEY` obligatoria de otra fila del seed (ej. `talleres.encargado_id` — sin ese usuario, el propio `INSERT` de `talleres` falla).
- La fila singleton de `mantenimiento_config`.

Nunca datos que simulen un flujo de negocio (un vale, una propuesta, un historial). Si dudás si algo es seed o mock, preguntate: *¿la aplicación deja de arrancar o de tener sentido sin esto?* Si la respuesta es sí, es seed.

### `mock.sql` — datos de demostración

Todo lo que existe únicamente para probar el flujo de la aplicación de punta a punta: vales ficticios, sus propuestas, su historial, solicitudes de modificación, backfills. Se puede borrar por completo y la aplicación sigue siendo instalable y funcional (solo que sin datos que mostrar).

## Reasignar en vez de borrar

Cuando un usuario o rol de prueba se elimina (ver el propio `CLAUDE.md` — pasa en cada ciclo de correcciones), los datos de `mock.sql` que lo referenciaban **se reasignan a un usuario real que sobreviva**, nunca se eliminan junto con él. El comentario de cabecera de `mock.sql` documenta cualquier reasignación de este tipo.

## Comentarios

- Nada de historial de desarrollo: ni nombres de documentos de corrección, ni "se agregó/se quitó/antes esto era...". Ese historial vive en `git log`, no en el SQL.
- Un comentario se justifica solo si explica algo que el nombre de la columna/tabla no dice por sí solo (una regla de negocio, una restricción no obvia). Si el nombre ya es autoexplicativo, no lleva comentario.
- Nada de separadores decorativos (`-- ===`, bloques de `-- ---`). Un comentario de una línea alcanza para introducir una tabla o un bloque de `INSERT`.
- `COMMENT '...'` en columnas: igual de breve — documenta qué es el campo o su formato, no por qué se agregó.

## Formato

- Keywords SQL en mayúscula (`CREATE TABLE`, `NOT NULL`, `DEFAULT`).
- Identificadores siempre entre backticks.
- Un `CREATE TABLE` por bloque, columnas alineadas, `FOREIGN KEY`/`INDEX` al final de la definición.
- Un `INSERT` por tabla y por archivo (no repetir `INSERT INTO` para la misma tabla en el mismo archivo salvo que el orden de un `UPDATE`/backfill intermedio lo exija).
- Cuando cambien los IDs de un catálogo (por ejemplo, al eliminar un rol y renumerar), el archivo se reescribe con los IDs finales — nunca se deja un `UPDATE` post-INSERT para "corregir" algo que el propio `INSERT` ya puede tener bien desde el principio.

## Antes de dar por terminado un cambio

1. Verificar que cada `FOREIGN KEY` de `schema.sql` sigue teniendo del otro lado una tabla ya creada antes.
2. Verificar que `seed.sql` no depende de ninguna fila de `mock.sql` (debe poder ejecutarse solo, sobre una base limpia).
3. Verificar que `mock.sql` no reintroduce ningún ID de usuario/rol que ya no exista en `seed.sql`.
4. Reflejar el mismo cambio en `src/config/database.js` (roles/permisos/usuarios/talleres/etc. y, si aplica, los `taggedHandlers` que dependen de esos IDs) — es la única ruta que de verdad se ejecuta en desarrollo.
