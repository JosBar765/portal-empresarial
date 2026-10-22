# Respaldo de producción (`npm run main:backup`)

Descarga una copia completa de la base de **producción** a un archivo `.sql` en el PC del dueño. No usa `mysqldump` (no está instalado): lee con `mysql2`, en solo lectura, y reutiliza `scripts/staging/lib/`. Código: `scripts/backup/`.

```
producción (solo lectura)  ──►  PC del dueño  ──►  respaldos/<base>_<AAAA-MM-DD>.sql
```

## Cuándo usarlo

Antes de **cada despliegue a producción**: modo mantenimiento → respaldo → despliegue. El respaldo va primero; encender el mantenimiento antes o después del respaldo lo decide el dueño (con el mantenimiento activo nadie escribe mientras se descarga, así que el respaldo queda más "quieto").

## Comandos

```
npm run main:backup
npm run main:backup -- --salida D:\respaldos --comprimir
```

| Opción | Efecto |
|---|---|
| `--salida <carpeta>` | Carpeta de destino. Sin ella pregunta; por defecto `respaldos/` en la raíz del repo (se crea si falta). |
| `--comprimir` | Escribe `.sql.gz` (≈10 veces más pequeño). |
| `--confirmar <nombre>` | Da la confirmación sin teclearla (para automatizar); sin `--salida` usa la carpeta por defecto sin preguntar. |
| `--archivo <ruta>` | Otro archivo de configuración. Por defecto `scripts/staging/.env.refresco`: **solo se leen las claves `ORIGEN_*`** (producción). |

Antes de leer datos muestra `host:puerto/base` y pide teclear el nombre exacto de la base. Se aborta si la base lleva la marca `entorno = staging` («esta base es de staging, no producción»).

## Archivo generado

- Nombre: `<base>_<AAAA-MM-DD>.sql` con la fecha local del PC. Si ya existe, **nunca se sobrescribe**: usa `<base>_<AAAA-MM-DD>_<HHmm>.sql` (y un contador si hasta ese existe).
- Al terminar imprime la ruta, el tamaño, tablas/vistas/filas y la duración.
- SQL plano: cabecera (fecha, host/base de origen, sin credenciales), `SET NAMES utf8mb4; SET time_zone = '+00:00'; SET FOREIGN_KEY_CHECKS = 0; …`, y por cada tabla `DROP TABLE IF EXISTS` + `CREATE TABLE` exacto + `INSERT` en lotes (≈500 filas o 1 MB). Vistas al final. Cada sentencia termina en `;` en su propia línea. No usa `DELIMITER`.
- **Contiene datos reales de clientes.** No lo compartas, no lo subas a ningún sitio y no lo agregues a git (`respaldos/` y `*.sql.gz` están en `.gitignore`). El comando nunca sube nada.

## Qué hace y qué NO hace en la base

El único efecto del comando es el archivo en el PC (y crear la carpeta de salida). Es verificable en el código:

- La sesión se abre en solo lectura (`SET SESSION TRANSACTION READ ONLY`, se comprueba `transaction_read_only = 1`) con un snapshot consistente (`REPEATABLE READ` + `START TRANSACTION WITH CONSISTENT SNAPSHOT`).
- **Lista blanca** (`scripts/backup/guardaSoloLectura.js`): toda sentencia hacia producción (`query`, `execute`, `prepare` y el streaming de filas) se revisa **antes de enviarse** y solo pasan `SELECT`, `SHOW`, `SET SESSION TRANSACTION READ ONLY|ISOLATION LEVEL …`, `SET NAMES`, `SET time_zone` y `START TRANSACTION` (forma de solo lectura/snapshot), `COMMIT`/`ROLLBACK`. Todo lo demás lanza un error: `INSERT/UPDATE/DELETE/REPLACE`, `CREATE/ALTER/DROP/TRUNCATE/RENAME`, `GRANT`, `FLUSH`, `LOCK/UNLOCK TABLES`, `GET_LOCK`, `CALL`, `LOAD`, `SELECT … INTO`, `FOR UPDATE`, varias sentencias juntas, etc.
- No hay bloqueos de tablas ni con nombre, ni tablas temporales, ni `FLUSH`. La marca de entorno solo se lee con un `SELECT`.
- Al final el comando imprime cuántas sentencias de cada tipo envió (ej. `SET SESSION 6, SELECT 139, START TRANSACTION 2, SHOW 44`).
- Prueba de la lista blanca sin base de datos: `npm run main:backup:probar-guarda` (sentencias permitidas pasan; las prohibidas lanzan).

## Verificación incluida

Tras escribir, vuelve a contar cada tabla con `COUNT(*)` **dentro del mismo snapshot** y lo compara con las filas escritas. Si todo coincide imprime «Verificación correcta». Si no coincide, sale con error, **conserva** el archivo y lo marca como sospechoso: repite el respaldo. Si falla a mitad de la escritura se borra el archivo incompleto.

## Restaurar

Restaurar **reemplaza** las tablas con el mismo nombre (`DROP TABLE IF EXISTS`): hazlo solo sobre la base correcta y, si dudas, primero en una base vacía de prueba.

**phpMyAdmin:** elige la base → pestaña *Importar* → selecciona el `.sql` (o `.sql.gz`, lo descomprime solo) → formato SQL → *Importar*. phpMyAdmin limita el tamaño de subida (`upload_max_filesize`/`post_max_size`, se ve en la propia pantalla de Importar; en Hostinger es desconocido para este proyecto). Si el archivo pesa más: genéralo con `--comprimir` (queda mucho más pequeño) o usa DBeaver.

**DBeaver:** conectar a la base → clic derecho en la base → *Herramientas → Ejecutar script* (o abrir el `.sql` en el editor y *Ejecutar script*, Alt+X). No tiene límite de subida. Para `.sql.gz`, descomprímelo antes.

Después de restaurar, reinicia el servidor.

## Límites

- No exporta **triggers ni rutinas** (el comando lo avisa y lo deja como comentario en el archivo). Hoy el esquema no los usa.
- **Los archivos de Supabase Storage no forman parte del respaldo**: solo se respaldan las URLs en la base.
- Las vistas se exportan sin `DEFINER` ni el prefijo de la base; el esquema actual no tiene vistas.
- Tablas muy grandes: se leen por streaming y se escriben por lotes, la memoria no crece con el tamaño; el tiempo depende de la red. Una fila mayor que `max_allowed_packet` del servidor donde se restaure fallará al importar.
- Las columnas generadas no se insertan (el motor las recalcula). El DDL es el que devuelve `SHOW CREATE TABLE`: entre MariaDB y MariaDB es idéntico; restaurar en MySQL podría chocar con collations propias de MariaDB.
