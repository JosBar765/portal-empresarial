# Refresco de staging desde producción

Comando local, ejecutado desde el PC del dueño, que reemplaza la base de **staging** por una copia de la base de **producción**. No usa `mysqldump` (no está instalado): copia con `mysql2` leyendo producción y escribiendo en staging. Después se reinicia el servidor de staging y el ejecutor de migraciones aplica solo lo pendiente.

```
producción (ORIGEN, solo lectura)  ──►  PC del dueño  ──►  staging (DESTINO, se borra y reescribe)
```

Código: `scripts/staging/` (`probar-conexion.js`, `marcar.js`, `refrescar.js`, `lib/`). El respaldo de producción a archivo (`npm run main:backup`) reutiliza `lib/` y se describe en `reglas_respaldo_produccion.md`.

## Diseño de seguridad

- **ORIGEN solo se lee.** La sesión ejecuta `SET SESSION TRANSACTION READ ONLY` y se comprueba que el servidor la aplicó (`transaction_read_only = 1`); si no, el comando aborta. Cualquier `INSERT`/`UPDATE`/`DELETE` por esa conexión falla con `ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION`.
- **Foto consistente.** `START TRANSACTION WITH CONSISTENT SNAPSHOT`: todas las tablas se leen del mismo instante, sin bloquear a los usuarios de producción.
- **Nunca el mismo destino.** Si ORIGEN y DESTINO coinciden en servidor, puerto y base, ninguno de los dos comandos hace nada. Si solo coincide el nombre de la base (servidores distintos), avisa.
- **Marca de entorno en la base.** Solo la base de staging tiene `parametros_sistema.entorno = 'staging'`. Antes de borrar nada, `refrescar` lee la marca de ambas bases: DESTINO debe tenerla (si no, aborta y manda a `npm run staging:marcar`) y ORIGEN no debe tenerla (si la tiene, es un staging: ORIGEN y DESTINO intercambiados). `--solo-limpieza` también exige la marca en DESTINO. Falla cerrado: sin marca, no se escribe. Al terminar, el refresco la vuelve a escribir (la copia de producción no la trae y el vaciado la borró).
- **Producción nunca lleva marca y estas herramientas nunca la escriben:** se reconoce por la ausencia de la marca `staging`. Así nada que se haga a la base de producción (restaurar, importar) puede dejarla «marcada» por error, y una base de staging que llegara a producción hace fallar el arranque (ver `reglas_entornos.md`).
- **Resumen previo al borrado.** Justo antes de pedir la confirmación se muestra qué se va a borrar de DESTINO (tablas, filas aproximadas, MB) para que un destino equivocado se note a simple vista.
- **Confirmación obligatoria.** Antes de tocar nada hay que escribir el nombre exacto de la base DESTINO. Un error aborta sin haber modificado nada.
- **Todo lo que escribe va a DESTINO.** Se borran todas sus tablas y vistas (así no queda un `schema_migrations` viejo que engañe al ejecutor), se recrean con el DDL exacto de ORIGEN (`SHOW CREATE TABLE`: motor, charset y claves foráneas) y se copian las filas en lotes por streaming.
- **Fechas exactas.** Ambas sesiones usan `time_zone = '+00:00'` para que los `TIMESTAMP` queden idénticos; los `DATETIME` se copian como texto. Los `JSON` se copian como texto UTF-8.
- **Verificación.** `COUNT(*)` exacto de cada tabla en ORIGEN (dentro de la misma foto) y DESTINO; cualquier diferencia termina con código 1.
- **Limpiezas de staging** (solo DESTINO, lista extensible en `scripts/staging/lib/limpiezas.js`): modo mantenimiento apagado y `sesiones_activas` vaciada (son sesiones de producción, inútiles con otro `JWT_SECRET`).
- Las credenciales viven solo en `scripts/staging/.env.refresco` (ignorado por git) y nunca se imprimen.

## Preparación (una sola vez)

1. En hPanel, **Bases de datos > MySQL remoto**, autoriza la IP pública de tu PC (la que muestra cualquier «cuál es mi IP»). Si tu IP cambia, hay que autorizarla de nuevo.
2. Anota el host remoto que muestra hPanel (ejemplo: `srv1202.hstgr.io`, puerto `3306`) y, de cada base, su nombre, usuario y contraseña. Staging necesita un usuario con `CREATE`, `DROP`, `ALTER`, `INSERT`, `DELETE`; producción solo necesita `SELECT`.
3. Crea el archivo de credenciales y complétalo:
   ```
   copy scripts\staging\refresco.env.example scripts\staging\.env.refresco
   ```
   Claves: `ORIGEN_HOST|PORT|DB|USER|PASSWORD` (producción) y `DESTINO_HOST|PORT|DB|USER|PASSWORD` (staging). Todas son obligatorias; si falta alguna, el comando lista **todas** las que faltan y termina.
4. **Nunca** subas ese archivo al repositorio (`git check-ignore scripts/staging/.env.refresco` debe imprimir la ruta). Para otro archivo usa `--archivo <ruta>`.

## Marcar la base de staging (una sola vez, ANTES de desplegar esta versión en staging)

```
npm run staging:marcar
```

Desde el PC del dueño, con las claves `DESTINO_*` de `.env.refresco` (no usa ORIGEN). Muestra la base y su contenido, exige que la tabla `parametros_sistema` exista y que el nombre no contenga «prod», pide escribir el nombre exacto (o `--confirmar <nombre>`) y ejecuta `INSERT ... ON DUPLICATE KEY UPDATE` de `entorno = staging`. Repetirlo es inofensivo. Opciones: `--archivo <ruta>`, `--confirmar <nombre>`.

Orden de salida a producción (mismo para cada versión que incluya la marca):

1. Merge a `dev`.
2. `npm run staging:marcar` contra la base de staging.
3. Solo entonces desplegar `dev` a staging. Si no, el servidor de staging se niega a arrancar (por diseño): `[FATAL] El servidor de staging NO está conectado a una base de staging...`. En un arranque correcto se ve `[Entorno] Marca de entorno correcta (staging)`.
4. Producción no requiere ninguna acción; su primer arranque registra `[Entorno] Marca de entorno correcta (sin marca: producción)`.

Si la marca se pierde (por ejemplo, una importación manual que reemplaza `parametros_sistema`), staging no arranca y `refrescar` no escribe hasta volver a ejecutar `staging:marcar`.

## Plan de la prueba de conexión

Primero se prueba, sin copiar nada:

```
npm run staging:probar-conexion
```

Es de solo lectura: no escribe en ninguna base. Salida esperada, para ORIGEN y luego DESTINO:

```
[Refresco] ORIGEN: srv1202.hstgr.io:3306/<base> (usuario <usuario>)
  Servidor: <versión> | base actual: <base>
  Tablas: N | tamaño aproximado: X MB
  Las 5 tablas más grandes: ...
  schema_migrations: existe, N fila(s)
  entorno: sin marca
  Sesión de solo lectura: OK (transaction_read_only = 1)
[Refresco] DESTINO: ...
  entorno: staging
  Privilegios sobre <base>: CREATE=sí, DROP=sí, INSERT=sí, ALTER=sí, DELETE=sí
[Refresco] Prueba correcta: ambas conexiones funcionan y las marcas son coherentes. No se escribió nada.
```

Qué revisar: que ORIGEN sea producción (`entorno: sin marca`) y DESTINO staging (`entorno: staging`), no al revés, que ORIGEN muestre `Sesión de solo lectura: OK` y que DESTINO tenga los cinco privilegios en «sí». El código de salida es 0 solo si ambas conexiones funcionan, ORIGEN no tiene la marca staging y DESTINO sí la tiene (si le falta, termina en 1 indicando `npm run staging:marcar`).

| Síntoma | Causa probable |
|---|---|
| `ER_ACCESS_DENIED_ERROR` (Access denied for user) | Usuario o contraseña incorrectos, o el usuario no tiene acceso remoto a esa base. |
| `ETIMEDOUT` / `connect ETIMEDOUT` / `ECONNREFUSED` | Tu IP pública no está autorizada en MySQL remoto (o cambió), host o puerto incorrectos, o un firewall bloquea el 3306. Hay un tiempo de espera de 10 s. |
| `ENOTFOUND` | El host está mal escrito. |
| `ER_BAD_DB_ERROR` (Unknown database) | El nombre de la base está mal escrito. En Hostinger suele llevar un prefijo (`u123456789_...`). |
| `Privilegios ...: DROP=NO` (u otros) | El usuario de staging no tiene todos los privilegios; el refresco fallaría. Otórgalos en hPanel. |
| `ORIGEN y DESTINO son el mismo servidor y base de datos` | Pegaste las mismas credenciales en ambos bloques. |
| `ORIGEN_xxx falta o está vacía` | Falta una clave en `.env.refresco`; se listan todas. |

## Refrescar staging

```
npm run staging:refrescar
```

Muestra ambos destinos, verifica las marcas, resume lo que se va a borrar, pide escribir el nombre de la base DESTINO y empieza. Salida esperada (resumida):

```
[Refresco] ORIGEN  (solo lectura): host:3306/<base prod> (usuario ...)
[Refresco] DESTINO (se BORRA y reescribe): host:3306/<base staging> (usuario ...)
[Refresco] ORIGEN: sin marca (producción).
[Refresco] DESTINO: marca entorno = staging verificada.
[Refresco] Se va a BORRAR el contenido actual de <base staging>: N tabla(s), ~F fila(s), ~X MB.
Escribe el nombre exacto de la base DESTINO (<base staging>) para continuar: <base staging>
[Refresco] DESTINO vaciado: N tabla(s) y 0 vista(s) eliminadas.
[Refresco] tabla asesores: 49 fila(s) en 133 ms
...
[Refresco] Copia terminada: N tabla(s), M fila(s) en T ms.
[Refresco] Verificación correcta: N tabla(s) con el mismo COUNT(*) en ORIGEN y DESTINO.
[Refresco] Limpieza «mantenimiento_config: ...»: 1 fila(s) afectada(s) (estaba apagado).
[Refresco] Limpieza «sesiones_activas: ...»: K fila(s) afectada(s).
[Refresco] Marca entorno = staging restablecida en DESTINO.
```

Opciones: `--archivo <ruta>` (otro archivo de credenciales), `--confirmar <nombre>` (omite la pregunta; solo para pruebas automáticas) y `--solo-limpieza` (ver más abajo). Si un paso falla, el mensaje indica la tabla y el error de MySQL, y el código de salida es 1.

### Después del refresco

1. **Reinicia el servidor de staging.** Al arrancar, el ejecutor (`src/core/migrations/`) aplica las migraciones pendientes sobre la base recién copiada.
2. Comprueba: `SELECT nombre, aplicada_en FROM schema_migrations ORDER BY nombre;`
3. Si staging tenía el modo mantenimiento o sesiones abiertas, ya fueron limpiados por el propio comando.

## Alternativa con DBeaver

Si el comando no sirve en algún caso, exporta los datos a mano con DBeaver desde producción hacia staging (solo lectura en producción) y luego aplica solo las limpiezas sobre staging:

```
npm run staging:refrescar -- --solo-limpieza
```

Pide la misma confirmación (y exige la marca en DESTINO), se conecta solo a DESTINO (en este modo solo se exigen las claves `DESTINO_*`) y no copia nada. Igual hay que reiniciar staging después.

## Límites conocidos

- **Los archivos de Storage no se copian.** Staging conserva las URLs de producción solo para lectura. Staging nunca debe borrar archivos de producción: las acciones críticas solo corren con `NODE_ENV=production` (ver `reglas_entornos.md`). Generar un PDF viejo en staging descarga archivos reales, sin modificarlos.
- **No se copian triggers, rutinas ni eventos.** Si ORIGEN tiene triggers o rutinas, el comando lo avisa.
- **Vistas:** se copian al final con `SHOW CREATE VIEW`, sin la cláusula `DEFINER` y sin el prefijo `` `base_origen`. `` en las referencias (para que funcionen con otro nombre de base). El esquema actual no tiene vistas; esta ruta no se ha ejercitado con datos reales.
- **Tablas muy grandes:** se leen por streaming y se insertan en lotes de 500 filas o 4 MB, así que la memoria no crece con la tabla; el tiempo sí depende de la red (cada fila viaja por el PC). Una fila individual mayor que `max_allowed_packet` de DESTINO falla con un error claro.
- **MariaDB / MySQL:** el DDL se reproduce tal cual lo devuelve `SHOW CREATE TABLE`. Entre MariaDB y MariaDB (Hostinger) es idéntico; entre MySQL y MariaDB podrían diferir collations (`utf8mb4_0900_ai_ci` no existe en MariaDB) o el tipo `JSON`. Para reducir fallos, la sesión de DESTINO usa un `sql_mode` permisivo (`NO_AUTO_VALUE_ON_ZERO,NO_ENGINE_SUBSTITUTION`), omite las columnas generadas al copiar filas y comprueba `transaction_read_only`/`tx_read_only` según la versión.
- Los datos de producción quedan en el disco de staging: trátalos con el mismo cuidado.

## Protecciones contra errores de configuración

- **ORIGEN y DESTINO intercambiados:** el script (y la prueba de conexión) se niegan a seguir si el nombre de la base de DESTINO contiene «prod» (sin distinguir mayúsculas). El DESTINO es siempre staging; el ORIGEN es producción y solo se lee.
- **Contraseñas con `#`:** `dotenv` corta un valor sin comillas en el `#`. Escribe el valor entre comillas simples, por ejemplo `ORIGEN_PASSWORD='ab#cd'`. Si la contraseña también tiene una comilla simple, usa comillas dobles.
- **Cómo comprobarlo antes de copiar:** en la salida de `npm run staging:probar-conexion`, el ORIGEN debe ser producción (por ejemplo, sin la tabla `schema_migrations` hasta el primer despliegue con el ejecutor) y el DESTINO staging.
