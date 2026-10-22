# Reglas de entornos y acciones críticas

Esta regla vale para **toda la plataforma**: el módulo de vales, el de administración y cualquier módulo nuevo.

## La regla

> Si `NODE_ENV` no es `production`, ninguna acción crítica actúa sobre datos ni recursos reales. Fuera de producción solo se escribe y se borra en la base de datos y en el bucket de ese entorno.

Motivo: una base de desarrollo o de pruebas se restaura muchas veces desde un backup de producción, y sus filas guardan URLs, rutas e identificadores de recursos reales. Una acción «normal» (dar de baja un vale, reemplazar un archivo, enviar un aviso) ejecutada fuera de producción puede alterar esos recursos reales.

## Entornos (`NODE_ENV`)

La variable es obligatoria y no tiene valor por defecto: si falta o tiene un valor no permitido, `src/config/env.js` detiene el arranque.

| Valor | Uso |
|---|---|
| `development` | La máquina local de cada desarrollador. |
| `staging` | El dominio de pruebas (HTTPS, copia de un backup de producción, bucket propio). |
| `production` | Producción: el único entorno donde corren las acciones críticas. |
| `test` | Pruebas automáticas y scripts de seguridad. |

## Qué es una acción crítica

- Borrar o reemplazar archivos en Storage (incluido el reemplazo de «huérfanos» al subir).
- Limpiezas o purgas automáticas (watchers) que borren archivos o recursos externos.
- Enviar correos, notificaciones push, SMS o webhooks.
- Llamar a APIs de terceros con efecto: pagos, facturación, mensajería.
- Cualquier operación sobre un recurso externo identificado por un dato que viene de la base de datos (una URL, un id externo).

No son críticas, y funcionan en todos los entornos: las operaciones sobre la base de datos del entorno, los sockets propios y las lecturas.

## Cómo se implementa

1. Comprobar `config.nodeEnv === 'production'`. Se lee de `src/config/env.js`, nunca de `process.env` directamente, y sin ningún valor por defecto.
2. Fuera de producción no se hace nada: la función devuelve un valor que su llamador entienda (por ejemplo `false`) y escribe una línea de log del estilo `[Modulo] NODE_ENV=<entorno>: no se ejecuta <acción> (solo en producción).`
3. La protección va en el punto más bajo por el que pasan todas las llamadas (por ejemplo `supabaseStorage.eliminar`), no repetida en cada llamador.
4. Un watcher cuyo único trabajo es crítico ni siquiera arranca fuera de producción (`retencionArchivosWatcher`).
5. El código que depende del resultado debe tolerar el «no hice nada». Ejemplo: al subir un archivo cuyo nombre ya existe, no se reemplaza el huérfano y la subida falla con un aviso.

## Inventario actual

| Acción | Dónde | Estado |
|---|---|---|
| Borrar objetos de Storage (incluye el bucket de borradores y los huérfanos) | `supabaseStorage.eliminar` | Solo en producción |
| Purga de PDF, adjuntos y propuestas por antigüedad | `retencionArchivosWatcher` | Solo en producción |

Hoy el código no envía correos, notificaciones push ni webhooks, ni llama a APIs de terceros. Detalle del borrado de archivos: `.agents/modulos/vales de arte/documentacion/storage_solo_produccion.md`.

## Al agregar una acción o un módulo nuevo

1. Pregunta: ¿esta acción cambia algo fuera de la base de datos del entorno, o usa un dato de la base para ubicar un recurso externo? Si la respuesta es sí, es crítica.
2. Aplicar «Cómo se implementa» y agregarla al inventario de arriba.
3. Documentar en el módulo correspondiente qué pasa fuera de producción.

## Configurar un entorno de pruebas (`staging`)

- `NODE_ENV=staging`. Con HTTPS, la cookie de sesión va con `Secure` en `staging` y `production`.
- `JWT_SECRET` distinto al de producción: con el mismo, un token de producción sería aceptado en pruebas.
- `SOCKET_CORS_ORIGIN` con el dominio de pruebas.
- Un bucket propio para `SUPABASE_STORAGE_BUCKET` y otro (o el mismo) para `SUPABASE_STORAGE_BUCKET_BORRADORES`; ninguno puede ser el de producción. Si las claves de Supabase son las de producción (mismo proyecto), ese par de variables es lo único que separa ambos entornos para las subidas.
- Una base restaurada de producción guarda URLs de archivos reales: leerlas no modifica nada, pero generar un PDF viejo descarga esos archivos.
