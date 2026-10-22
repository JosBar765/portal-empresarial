# Retención de archivos de vales de arte

## Qué hace
Un vigilante (`src/modules/vales/retencionArchivosWatcher.js`) borra de Supabase Storage los archivos de los vales **confirmados** (`vales.confirmado_en` no nulo) cuando cumplen su plazo. En la base solo queda la información del vale.

| Fase | Plazo por defecto | Qué se borra |
|---|---|---|
| PDF y adjuntos | 30 días desde `confirmado_en` | `vales.pdf_url` y todos los `vale_documentos.ruta` del vale |
| Propuestas | 60 días desde `confirmado_en` | todos los `vale_propuestas.url` y `vales.propuesta_general_url` |

Aplica a cada fila de `vales`, incluidos los `MOD-`, con su propio `confirmado_en`. Un vale sin confirmar no se purga. Los enlaces externos de las propuestas (`vale_propuesta_enlaces`) y las notas no se tocan.

## Por qué
Storage es un bucket único y crece sin límite; pasado el plazo el archivo ya no se necesita y la información del vale se conserva en la base.

## Reglas
- Orden: primero Storage, luego la BD. Si Storage falla, la BD de ese vale queda intacta y el siguiente ciclo reintenta (log `[RetencionArchivos]`).
- Un archivo que otro vale aún referencia (p. ej. la propuesta original dentro de un `MOD-`) no se borra de Storage: solo se anula la referencia de este vale. Se borra cuando ya nadie lo usa (`documentoRepository.contarReferenciasEnOtrosVales`).
- Tras la purga: `pdf_url`, `propuesta_general_url`, `vale_propuestas.url` y `vale_documentos.ruta` quedan en NULL, y `vales.archivos_purgados_en` / `vales.propuestas_purgadas_en` guardan cuándo ocurrió (reloj de MySQL).
- Se ejecuta al arrancar (cuando el pool de MySQL ya está listo) y cada 6 horas, con lotes de 50 vales por fase y ciclo.
- Solo funciona con `NODE_ENV=production`; en `development` y `test` el vigilante no arranca y lo avisa en el log.
- Sin PDF purgado, `GET /api/vales/:id/pdf` responde «aún no ha sido generado»; con el PDF purgado responde «El PDF de este vale ya expiró y fue eliminado.».
- El formulario de corrección muestra un adjunto purgado como «(archivo eliminado)», sin enlace.
- Solicitar una modificación Media/Avanzada de un vale cuyos archivos ya fueron purgados falla con un mensaje claro (el PDF del `MOD-` necesita los adjuntos y la propuesta del original).

## Parámetros editables
Tabla `parametros_sistema` (la misma de `horas_vencimiento_vale`), editables por el Administrador en **Admin > Horarios y feriados > Retención de archivos de vales de arte** (permiso `admin.horarios.gestionar`, `PUT /api/admin/horarios/retencion`):

- `dias_retencion_pdf_adjuntos` (por defecto 30)
- `dias_retencion_propuestas` (por defecto 60; no puede ser menor que el anterior)

Son enteros de 1 a 3650. El servicio los lee de la base en cada ciclo; si la fila falta o es inválida usa 30 y 60. Un cambio rige desde el siguiente ciclo (máx. 6 h) o al reiniciar.

## Cómo verificar
1. Elegir un vale confirmado en una base de pruebas y retroceder su `confirmado_en` más allá del plazo.
2. Reiniciar el servidor (la purga corre al arrancar) y revisar el log `[RetencionArchivos] Purgados: ...`.
3. Comprobar en la BD que `pdf_url`, `ruta` o `url` están en NULL y las marcas `*_purgad*_en` llenas, y en Supabase que los objetos desaparecieron.
4. Abrir `/api/vales/<id>/pdf`: debe decir que el PDF expiró.

## Puesta en producción
1. Importar `database/migraciones/10_retencion_archivos.sql` (el archivo lleva un número delante; se cita sin él) **ANTES** de desplegar el código. Es idempotente: agrega las dos columnas de marca, deja `vale_documentos.ruta` nullable y siembra los dos parámetros sin pisar valores ya cambiados.
2. Desplegar. Los vales confirmados hace más de 30 días se purgan en lotes desde el primer arranque.
3. La purga es irreversible: los objetos borrados de Storage no se recuperan. Para revertir el esquema, ver el encabezado del script.
