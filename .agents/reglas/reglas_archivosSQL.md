# Reglas de los Scripts SQL (`database/`)

Esta guía explica cómo está organizado `database/` y qué criterio seguir al agregar o modificar estructura o catálogos, para que el SQL del proyecto se mantenga legible y mantenible en vez de convertirse en un solo archivo con comentarios ilegibles.

---

## Los dos archivos

```text
database/
├── schema.sql   # Estructura: CREATE TABLE, claves, índices. Cero datos.
└── seed.sql     # Datos reales mínimos para una instalación funcional.
```

Orden de importación sobre una base de datos vacía:

```text
1. schema.sql   -> crea únicamente la estructura
2. seed.sql     -> deja la BD en un estado inicial funcional (login de
                   Administrador, catálogos, estructura organizacional)
```

No existen datos de demostración/mock en el repositorio: el proyecto no tiene
fallback de base de datos (`src/config/database.js` requiere una conexión
MySQL real — si falla, el proceso termina en el arranque) ni un archivo SQL
de datos ficticios. Cualquier vale/propuesta/historial de prueba que se
necesite para probar el flujo se crea a mano contra una base real.

## Qué va en cada archivo

### `schema.sql` — estructura pura

Solo `CREATE TABLE`, `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `INDEX`, `ENUM`, `DEFAULT`. Ningún `INSERT` ni `UPDATE`. Las tablas van en orden de dependencia (una tabla nunca aparece antes que las que referencia por `FOREIGN KEY`).

### `seed.sql` — datos reales, mínimos y legítimos

Todo lo que la aplicación necesita para arrancar desde una instalación limpia:

- Catálogos (`paises`, `roles`, `permisos`, `rol_permisos`).
- Estructura organizacional real (`departamentos`, `subdivisiones`, `tiendas`, `supervisor_asignaciones`).
- Usuarios que son **necesarios**, no solo "reales": el Administrador (para el primer login), y cualquier usuario que sea `FOREIGN KEY` obligatoria de otra fila del seed (ej. `talleres.encargado_id` — sin ese usuario, el propio `INSERT` de `talleres` falla).
- La fila singleton de `mantenimiento_config`.

Nunca datos que simulen un flujo de negocio (un vale, una propuesta, un historial) — eso no tiene lugar en este repositorio en absoluto (ver arriba).

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
2. Verificar que `seed.sql` corre de punta a punta sobre una base limpia recién creada con `schema.sql` (sin depender de ninguna fila que no inserte él mismo).
3. Reflejar cualquier cambio de estructura o catálogo también en los repositorios (`src/modules/*/repositories/`) que consultan esas tablas/columnas.
