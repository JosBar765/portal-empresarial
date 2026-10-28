# Reglas de despliegue (staging y producción)

Runbook único de **cómo se despliega hoy**. Lo leen personas y agentes de IA. Cada pieza tiene su documento de detalle (enlazado abajo); este archivo une el flujo, los comandos, los riesgos y dónde configurar cada cosa.

## 1. Resumen del flujo

```text
rama feature ──PR──► dev ──PR──► staging ──PR──► main
                      │            │              │
                (CI informativo)  (CI obligatorio) (CI obligatorio + 1 aprobación)
                                   │              │
                           Hostinger despliega   Hostinger despliega
                           solo al fusionar      solo al fusionar
```

- Toda rama nueva sale de un `dev` actualizado. Nunca se hace commit directo a `dev`, `staging` ni `main`.
- Hostinger **despliega solo** cuando se fusiona un PR en `staging` o `main` (no hay paso manual de despliegue).
- `staging` y `main` aceptan **solo merge commits** («Create a merge commit»; sin squash ni rebase).
- El check de CI `verificar` es obligatorio en `staging_ruleset` y `main_ruleset`; en `dev_ruleset` es informativo.
- `main` además exige 1 aprobación, aprobación del último push y conversaciones resueltas. El dueño puede usar el bypass de administrador (solo emergencias).

| Entorno | Rama | `NODE_ENV` | Base de datos | Buckets de Storage | Migraciones |
|---|---|---|---|---|---|
| Desarrollo | local | `development` | MySQL local (`.env`) | los del `.env` local | a mano: `npm run migrate` |
| Staging | `staging` | `staging` | base de staging (lleva la marca `entorno = staging`) | propios, distintos a los de producción | solas al arrancar |
| Producción | `main` | `production` | base de producción (sin marca) | los de producción | solas al arrancar |
| CI | efímero | `test` | MySQL temporal del workflow | ninguno (valores falsos) | las aplica el script de CI |

## 2. Qué hace cada pieza

**CI** (`.github/workflows/ci.yml`, job `verificar`). Cada PR hacia `dev`, `staging` o `main` verifica sintaxis, scripts SQL (instalación nueva y actualización estilo producción, ejecutor dos veces) y el arranque del servidor. No despliega ni usa secretos. Detalle: `.agents/reglas/reglas_ci.md`.

**Ejecutor de migraciones** (`src/core/migrations/ejecutor.js`). Aplica en orden de nombre los scripts de `database/migrations/` que no constan en la tabla `schema_migrations`. Corre solo al arrancar el servidor en `staging` y `production`, antes de escuchar; en `development` se usa `npm run migrate` y `npm run migrate:estado`. Los scripts son aditivos e idempotentes y **nunca se edita uno ya aplicado** (un cambio va en un script nuevo). Los cambios de base nunca van en `schema.sql` ni `seed.sql`. La carpeta antigua `database/migraciones` ya no existe: no la uses. Detalle: `.agents/reglas/reglas_archivosSQL.md`.

**Marca de entorno** (`src/core/entorno/verificarMarca.js`). Solo la base de staging tiene `parametros_sistema.entorno = 'staging'`; producción se reconoce por la **ausencia** de marca y nunca se escribe en ella. Al arrancar, antes de migrar, el servidor comprueba que `NODE_ENV` y la base concuerdan; si no, `[FATAL]` y sale. Detalle: `.agents/reglas/reglas_entornos.md`.

**Refresco de staging** (`scripts/staging/`). Desde el PC del dueño: `npm run staging:probar-conexion` (solo lectura), `npm run staging:marcar` (una vez) y `npm run staging:refrescar`. ORIGEN = producción (solo lectura), DESTINO = staging (se borra y reescribe). Al terminar limpia el modo mantenimiento y las sesiones de DESTINO y restablece la marca. Detalle: `.agents/reglas/reglas_refresco_staging.md`.

**Respaldo de producción** (`scripts/backup/`). `npm run main:backup` descarga la base de producción a un `.sql` local, en solo lectura y con lista blanca de sentencias; el archivo lleva la fecha del día (`<base>_<AAAA-MM-DD>.sql`) y nunca se sobrescribe. Detalle: `.agents/reglas/reglas_respaldo_produccion.md`.

## 3. Desplegar a staging

Todos los comandos `npm run staging:*` los ejecuta el dueño en su PC.

1. **Primera vez (o si la marca se perdió):** `npm run staging:marcar`. Sin marca, el servidor de staging se niega a arrancar. Hacerlo **antes** de desplegar una versión que incluya la marca.
2. `npm run staging:probar-conexion`. Verificar: ORIGEN = producción (`entorno: sin marca`, `Sesión de solo lectura: OK`) y DESTINO = staging (`entorno: staging`, privilegios CREATE/DROP/INSERT/ALTER/DELETE en «sí»).
3. `npm run staging:refrescar`. Pide teclear el nombre de la base DESTINO. Verificar: «Verificación correcta» (mismos `COUNT(*)` en ambas) y «Marca entorno = staging restablecida».
4. Abrir el PR `dev` → `staging`, esperar `verificar` en verde y fusionar con **«Create a merge commit»**.
5. Hostinger despliega y reinicia. En el log de arranque deben verse, en este orden:
   - `[Entorno] Marca de entorno correcta (staging)`
   - `[Migraciones] Aplicada <archivo> (N ms)` por cada script pendiente
   - `[Migraciones] N aplicada(s), M ya registrada(s).`
   - `Servidor corriendo en el puerto: ...`
6. Verificar en la base de staging: `SELECT nombre, aplicada_en FROM schema_migrations ORDER BY nombre;`
7. Las sesiones de producción se limpiaron en el refresco (y el `JWT_SECRET` es otro): hay que **iniciar sesión de nuevo**. Probar el flujo que cambió.

**Por qué el refresco va antes del merge:** el refresco deja en staging una copia fresca de producción sin los scripts nuevos; al reiniciar tras el merge, el ejecutor aplica exactamente las migraciones que luego correrán en producción, sobre datos reales. Es el ensayo general.

## 4. Desplegar a producción

### Lista previa (todo en orden antes del merge)

1. **Staging validado**: el cambio se probó allí con el refresco reciente y las migraciones aplicadas sin error.
2. **Respaldo primero**: `npm run main:backup -- --salida <carpeta>` (añadir `--comprimir` si es grande). Elegir una carpeta fuera del repositorio o `respaldos/` (ignorada por git). Verificar «Verificación correcta» y guardar el archivo; no se commitea ni se comparte.
3. **Variables de entorno nuevas en el panel de Hostinger, ANTES del merge.** Hoy: `SUPABASE_STORAGE_BUCKET_BORRADORES`, más su bucket creado en Supabase (distinto al de staging). Sin la variable, `src/config/env.js` imprime `[FATAL]` y el servidor **no arranca**. Para descubrir variables nuevas: comparar `src/config/env.js` entre `main` y `staging` (`git diff main staging -- src/config/env.js`) y revisar `.env.example`.
4. **Decisión sobre la retención de archivos.** El vigilante de retención (`src/modules/vales/retencionArchivosWatcher.js`) corre solo con `NODE_ENV=production` y **al arrancar** purga los archivos de vales confirmados hace más de 30 días (PDF y adjuntos) y 60 días (propuestas). **Es irreversible** (borra en Storage; el respaldo no incluye archivos). Los días viven en `parametros_sistema` (`dias_retencion_pdf_adjuntos`, `dias_retencion_propuestas`) y se editan en Admin > Horarios y feriados. Para evitar sorpresas, precargar valores altos (por ejemplo 3650) antes del primer despliegue: la migración nunca sobrescribe valores existentes. Dimensionar el impacto con `SELECT COUNT(*) FROM vales WHERE confirmado_en IS NOT NULL AND confirmado_en < NOW() - INTERVAL 30 DAY;`. Detalle: `.agents/modulos/vales de arte/documentacion/retencion_archivos.md`.
5. **Producción sin marca de entorno:** `SELECT valor FROM parametros_sistema WHERE clave = 'entorno';` debe devolver **cero filas**. Si devuelve `staging`, el servidor de producción no arrancará (`[FATAL]`): no seguir.
6. **Modo mantenimiento** desde la cuenta Administrador: inicia una cuenta regresiva de 10 minutos y luego bloquea a los demás usuarios. Ver `.agents/modulos/admin/documentacion/mantenimiento_cuenta_regresiva.md`.

### Pasos

7. Abrir el PR `staging` → `main`, esperar `verificar` en verde, obtener la aprobación y fusionar con **«Create a merge commit»**.
8. Hostinger despliega. Log esperado:
   - `[Entorno] Marca de entorno correcta (sin marca: producción)`
   - `[Migraciones] Aplicada <archivo> (N ms)` por cada script. La primera vez que producción usa el ejecutor vuelve a correr los primeros scripts (01 a 05), que son idempotentes, y aplica los pendientes.
   - `[Migraciones] N aplicada(s), M ya registrada(s).`
   - `Servidor corriendo en el puerto: ...` y `Entorno: production`.
9. Verificar `SELECT nombre, aplicada_en FROM schema_migrations ORDER BY nombre;`, iniciar sesión de nuevo (el administrador entra aunque haya mantenimiento) y hacer una prueba rápida del flujo que cambió.
10. Apagar el modo mantenimiento desde la cuenta Administrador.

## 5. Dónde y cómo configurar

| Qué | Dónde vive | Notas |
|---|---|---|
| Variables de entorno del servidor | Panel de Hostinger (staging y producción); `.env` local en desarrollo | Lista y reglas en `src/config/env.js`. Plantilla: `.env.example` |
| Credenciales de refresco y respaldo | `scripts/staging/.env.refresco` en el PC del dueño | Ignorado por git. Copiar de `scripts/staging/refresco.env.example`. 10 claves `ORIGEN_*` y `DESTINO_*` (HOST, PORT, DB, USER, PASSWORD). Un valor con `#` va entre comillas simples |
| Acceso remoto a MySQL | hPanel > Bases de datos > MySQL remoto | Autorizar la IP pública del PC. Host tipo `srv1202.hstgr.io`, puerto `3306` |
| Reglas de ramas | GitHub > Settings > Rules > Rulesets: `dev_ruleset`, `staging_ruleset`, `main_ruleset` | Check `verificar`, merge commits, aprobaciones de `main` |
| Buckets de archivos | Supabase Storage | Mismo proyecto en staging y producción |

Variables obligatorias (todas, sin valores por defecto; si falta una o es inválida el proceso lista todas las que fallan y sale): `NODE_ENV`, `PORT`, `JWT_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `SOCKET_CORS_ORIGIN`, `TRUST_PROXY`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, `SUPABASE_STORAGE_BUCKET_BORRADORES`.

Reglas por entorno:

- `NODE_ENV` ∈ `development|staging|production|test`.
- `JWT_SECRET` (≥ 32 caracteres) **distinto en cada entorno**: con el mismo, un token de producción valdría en staging.
- `SOCKET_CORS_ORIGIN` con el dominio exacto de cada entorno (sin barra final ni `*`; HTTPS en producción).
- `DB_*` apuntan a la base de **su** entorno; `DB_PASSWORD` solo puede estar vacía fuera de producción.
- Las claves de Supabase son del **mismo proyecto** en staging y producción: solo los nombres de bucket separan los entornos. `SUPABASE_STORAGE_BUCKET` y `SUPABASE_STORAGE_BUCKET_BORRADORES` deben ser **distintos** entre staging y producción.

## 6. Riesgos y qué hacer

| Riesgo | Causa | Protección | Qué hacer |
|---|---|---|---|
| Falla una migración al arrancar | Script con error o no idempotente | El servidor no arranca: `[FATAL] Falló la migración <archivo>: <error>`; el script no se registra hasta terminar | Corregir hacia adelante con un PR nuevo (nunca editar el script aplicado en otros entornos). Restaurar el respaldo solo como último recurso |
| Cruzar ORIGEN y DESTINO en el refresco | Credenciales intercambiadas en `.env.refresco` | ORIGEN en sesión de solo lectura; hay que teclear el nombre de la base DESTINO; DESTINO con «prod» en el nombre se rechaza; marca exigida en DESTINO y prohibida en ORIGEN | Revisar la salida de `staging:probar-conexion` antes de refrescar. Ante la duda, no continuar |
| Marca perdida tras una importación manual | La importación reemplazó `parametros_sistema` | Falla cerrado: staging no arranca y `refrescar` no escribe | `npm run staging:marcar` |
| Servidor de staging apuntando a la base de producción, o un respaldo de staging restaurado en producción | `DB_*` mal puestas o restauración equivocada | `[FATAL]` al arrancar, antes de migrar | Corregir `DB_*` en el panel o restaurar el respaldo correcto |
| Producción arranca sin la variable nueva | Variable no cargada en Hostinger antes del merge | `[FATAL] Falta la variable de entorno ...` y el servidor sale | Cargar la variable (y el bucket) en el panel y reiniciar |
| Purga irreversible de retención | Primer arranque en producción con vales viejos | Solo corre con `NODE_ENV=production` | Precargar días altos en `parametros_sistema` antes del merge (sección 4, paso 4) |
| Respaldo con datos reales de clientes | El `.sql` contiene datos de producción | `respaldos/` y `*.sql.gz` en `.gitignore`; el comando nunca sube nada | No commitear ni compartir el archivo. Los archivos de Storage **no** están en el respaldo |
| Particularidades de Hostinger | MariaDB 11.8 con RocksDB | Los scripts ya usan `REPEATABLE READ` para la foto consistente y `jsonStrings` | No cambiar esas opciones sin probar |
| Bypass de rulesets | Administrador puede saltarse las reglas | Solo para emergencias | Preferir siempre el PR normal |
| Scripts SQL manuales en phpMyAdmin | Cada sentencia se envía por separado | — | No depender de `ROW_COUNT()` entre sentencias; el error 1093 prohíbe actualizar una tabla leída en una subconsulta (calcular antes en variables) |
| La IP pública cambia | IP dinámica del PC | MySQL remoto solo acepta IP autorizadas | Volver a autorizarla en hPanel (`ETIMEDOUT`) |

## 7. Marcha atrás y emergencias

- **El servidor no arranca tras un despliegue:** leer el log de arranque. `[FATAL] Falta la variable...` o `[FATAL] ... marca ...` se corrigen en el panel; `[FATAL] Falló la migración ...` se corrige con un PR nuevo.
- **Despliegue defectuoso:** preferir corregir hacia adelante con un PR. Revertir el merge (PR de revert; con bypass solo si es urgente) no deshace migraciones ya aplicadas, que son aditivas.
- **Restaurar la base desde el respaldo:** phpMyAdmin (Importar) o DBeaver (Ejecutar script); reemplaza las tablas con el mismo nombre. Pasos y límites en `.agents/reglas/reglas_respaldo_produccion.md`. Después reiniciar el servidor.
- **Apagar el modo mantenimiento con la aplicación caída** (acción manual de emergencia del dueño, sobre su base):
  ```sql
  UPDATE mantenimiento_config SET activo = 0, inicia_en = NULL, sesiones_cerradas_en = NULL WHERE id = 1;
  ```

## 8. Reglas para agentes de IA

- **Nunca** ejecutar `staging:refrescar`, `staging:marcar`, `main:backup`, migraciones ni SQL contra producción o contra las bases de Hostinger del dueño: son acciones del dueño en su PC.
- **Nunca** hacer push a `dev`, `staging` ni `main`: solo PR. Subir únicamente una rama feature del mismo nombre y solo cuando el dueño lo pida.
- **Nunca** pedir, guardar ni imprimir credenciales, y **nunca** editar `scripts/staging/.env.refresco` ni ningún `.env`.
- **Nunca** levantar el servidor de la aplicación: lo ejecuta el dueño.
- Todo cambio va en una rama **nueva** desde un `dev` actualizado.
- **Nunca** debilitar una protección (sesión de solo lectura, lista blanca de sentencias, comprobaciones del destino, marca de entorno, verificación al arrancar) sin una decisión explícita del dueño.
- Si el entorno de destino es ambiguo, **detenerse y preguntar**.

## 9. Comandos de referencia

| Comando | Dónde se ejecuta | Qué hace | ¿Toca producción? |
|---|---|---|---|
| `npm run dev` | PC del desarrollador (lo levanta el dueño) | Servidor local con recarga | No |
| `npm run migrate` | Desarrollo, contra la base del `.env` | Aplica migraciones pendientes | No (solo si el `.env` apuntara a ella: no hacerlo) |
| `npm run migrate:estado` | Desarrollo | Lista aplicadas, pendientes y modificadas (solo lectura) | No |
| `npm run staging:probar-conexion` | PC del dueño | Prueba de solo lectura de ORIGEN y DESTINO | Solo lee |
| `npm run staging:marcar` | PC del dueño | Escribe `entorno = staging` en la base DESTINO | No |
| `npm run staging:refrescar` | PC del dueño | Reemplaza staging por copia de producción | Solo lee producción |
| `npm run main:backup` | PC del dueño | Respaldo de producción a archivo local | Solo lee |
| `npm run main:backup:probar-guarda` | Cualquier PC, sin base | Prueba la lista blanca de sentencias | No |
| `npm run ci:sintaxis` | Cualquier PC | Verifica la sintaxis del JS | No |
| `npm run ci:migraciones` | Solo con base desechable (`CI_DB_*`) | Escenarios A y B de migraciones; borra la base | No (jamás apuntarlo a una base de trabajo) |
| `npm run ci:arranque` | El CI | Arranca el servidor con `NODE_ENV=test` | No |
| `npm run ci` | El CI | Encadena los tres anteriores | No |

Ver también: `.agents/reglas/reglas_ci.md`, `reglas_archivosSQL.md`, `reglas_entornos.md`, `reglas_refresco_staging.md`, `reglas_respaldo_produccion.md`.
