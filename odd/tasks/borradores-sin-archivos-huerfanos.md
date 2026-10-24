# Borradores enviados: sin archivos huérfanos en el bucket de borradores

Rama: `fix/borradores-sin-archivos-huerfanos` (desde `dev` c4be89a).

## Problema (verificado en el código)
`borradorService.enviar` (`src/modules/vales/services/borradorService.js` ~241-276): con el vale ya creado borra primero la FILA del borrador (`borradorRepository.eliminar`) y después, de mejor esfuerzo, cada archivo del bucket de borradores (`supabaseStorage.borradores.eliminar`). Si el borrado de Storage falla, el archivo queda en el bucket sin fila que lo apunte (`vale_borrador_documentos` cae en cascada con el borrador), y el vigilante (`borradorWatcher.js`, `purgarVencidos`) solo reintenta borradores que aún existen: huérfano permanente. Es el orden contrario al de `_purgar` (~189-195), que borra Storage primero para poder reintentar. Además `listar`, `obtener` y `enviar` no filtran por vencimiento, así que si solo se invirtiera el orden, un borrador ya enviado seguiría visible y se podría reenviar (vale duplicado).

## Decisión del usuario
Opción con migración: columna nueva que marca el borrador como ENVIADO y lo oculta; el vigilante reintenta el borrado de archivos y luego la fila.

## Diseño
- Migración nueva `database/migrations/13_borradores_enviados.sql` (aditiva, idempotente, cabecera como las existentes; se cita sin correlativo): `vale_borradores.enviado_en DATETIME NULL` (e índice si hace falta). El ejecutor registra por nombre de archivo, así que el 13 no choca con el 11 y 12 de otra rama.
- `enviar`: tras crear el vale con éxito → marcar `enviado_en = NOW()` → borrar en Storage cada archivo del borrador (también los que el usuario quitó) y, por cada archivo borrado, su fila de documento → si todos se borraron, borrar la fila del borrador; si alguno falla, dejar el borrador marcado como enviado (el vigilante reintenta). La respuesta al usuario es de éxito siempre que el vale se creó; el fallo de limpieza solo va al log. Si `crear` falla: nada cambia (borrador y archivos intactos, se puede reenviar).
- Un borrador con `enviado_en` no existe para el usuario: `listar`, `obtener`, `actualizar`, `eliminar`, `enviar` y el tope de borradores por usuario (`contarPorUsuario`) lo ignoran (consultas del repositorio con `enviado_en IS NULL`).
- Vigilante: `purgarVencidos` también reintenta los borradores con `enviado_en` (sin esperar al vencimiento), con `_purgar` (Storage primero, luego la fila).
- Fuera de producción `supabaseStorage.eliminar` no borra (regla de plataforma): se mantiene.
- No cubre los huérfanos que ya existen de envíos anteriores (no hay fila que los apunte): requiere un script aparte que compare bucket y base.

## Restricciones
Acciones críticas solo en producción (`reglas_entornos.md`); migración aditiva (`reglas_archivosSQL.md`); no editar `schema.sql`/`seed.sql`; SQL solo en repositorios, parametrizado; comentarios de una línea; CRLF; documentar en `.agents/modulos/vales de arte/`.

## Tareas
- [x] T1 · Migración `13_borradores_enviados` y repositorio (marcar enviado, filtros `enviado_en IS NULL`, listar enviados pendientes de limpieza).
- [x] T2 · `enviar` con el orden nuevo y limpieza por archivo; vigilante que reintenta enviados.
- [x] T3 · Documentación y verificación con almacenamiento simulado.

## Ruta
Delegated direct: un escritor (varios archivos, lectura previa para escribir).

## Verificación
`node --check`; script de un solo uso con `supabaseStorage.borradores` simulado (subir/descargar/eliminar) y vales de prueba borrados al final: envío normal (vale creado, archivos y fila borrados); fallo de `eliminar` (vale creado, borrador oculto, no cuenta en el tope, el vigilante reintenta y limpia); fallo de `crear` (borrador intacto y reenviable); reenvío de un borrador enviado → «no existe».

## Progreso
Plan creado. T1-T3 implementadas (sin commit): migración aplicada dos veces en desarrollo (segunda: 0 aplicadas), `node --check` OK, script con Storage simulado y `crear` simulado: 20/20 comprobaciones OK (envío normal, fallo parcial de borrado, fallo de `crear`, reenvío). `listarVencidos` ahora incluye `enviado_en IS NOT NULL`; `borradorService._limpiarEnviado` hace marcar, Storage por archivo y fila al final. Docs: `documentacion/borradores.md` y `flujo_vale_de_arte.md` §15. Sin probar: Storage real y navegador.
