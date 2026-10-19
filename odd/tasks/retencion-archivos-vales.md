# Retención de archivos de vales (30 y 60 días)

Rama: `feat/limpieza-archivos-vales` (desde dev ab9cef0). Sin push.

## Objetivo
- A los 30 días de `vales.confirmado_en` se borran el PDF generado y todos los adjuntos del vale (Storage); en la BD solo queda la información.
- A los 60 días de `confirmado_en` se borran las propuestas: las de cada taller (`vale_propuestas.url`) y la general/fusionada (`vales.propuesta_general_url`).

## Decisiones
- Referencia: `confirmado_en` (decisión del usuario). Vale sin confirmar no se purga.
- Aplica a cada fila de `vales`, incluidos los `MOD-`, con su propio `confirmado_en`.
- Enlaces externos (`vale_propuesta_enlaces`) y notas de propuesta no se tocan; no están en Storage.
- Archivo compartido con otro vale aún vigente (`documentoRepository.contarReferenciasEnOtrosVales`): se anula la referencia de este vale pero no se borra el objeto.
- Orden: primero Storage, luego BD. Si Storage falla, la BD no cambia y el siguiente tick reintenta.
- Marcas de proceso: `vales.archivos_purgados_en`, `vales.propuestas_purgadas_en`.
- `vale_documentos.ruta` pasa a NULL-able; NULL = archivo purgado.
- Watcher al estilo `notificacionLimpieza.js`: corre al arrancar y cada 6 h, por lotes.
- Tras la purga: el front no ofrece descarga/visor de lo borrado y el mensaje de PDF deja de decir «aún no ha sido generado».
- Plazos editables (no constantes): `parametros_sistema.dias_retencion_pdf_adjuntos` (30) y `dias_retencion_propuestas` (60), leídos en cada ciclo; propuestas >= pdf/adjuntos; se editan en Admin > Horarios y feriados (mismo lugar que `horas_vencimiento_vale`).
- PDF purgado: `descargarPdf` responde «El PDF de este vale ya expiró y fue eliminado.».
- Crear un `MOD-` o corregir con propuesta original ya purgada falla con mensaje claro (coherente con los 60 días).

## Tareas
- [x] T1 Migración idempotente `database/10_retencion_archivos.sql` + `schema.sql` (columnas y `ruta` nullable). Commit 91274e3 (parámetros añadidos en bc50c4a).
- [x] T2 Backend: repositorio + `retencionArchivosService` + `retencionArchivosWatcher` registrado en `app.js`. Commit bc50c4a.
- [x] T3 (commit 9e38195) Front y mensajes: guardas de `ruta`/`url` nulos, mensaje del PDF, mensaje de MOD-/corrección sin propuesta original.
- [x] T5 Días de retención editables en el módulo admin (endpoint `PUT /api/admin/horarios/retencion`, sección en `horarios.js`). Commit c72f506.
- [x] T4 Documentación (`.agents/modulos/vales de arte/documentacion/retencion_archivos.md`, `flujo_vale_de_arte.md`, `CLAUDE.md` si aplica).

## Checks
Sin suite de tests (excepción a RED/GREEN). `node --check` por archivo, verificación contra la BD de desarrollo con un vale sembrado y Storage simulado/real según permita el entorno; verificación visual la decide el usuario.

## Progreso
T1-T5 implementadas y verificadas con `node --check` y un script contra BD de prueba `retencion_test` (Storage simulado). T4 docs en el commit final. Pendiente: verificación visual del usuario.
