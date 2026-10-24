# Borradores de vales de arte

## Qué es
Quien tiene el permiso `vales.crear` (asesores y supervisores) puede guardar el formulario «Crear Vale de Arte» a medias con «Guardar como borrador». Un borrador NO es un vale: tablas aparte (`vale_borradores`, `vale_borrador_documentos`), sin correlativo, sin validaciones de vale. Al abrir un borrador desde la lista «Borradores», sus botones «Cancelar» y «Guardar borrador» regresan a esa lista (la «X» y Esc la cierran).

## Reglas
- No se guarda un borrador completamente vacío (ningún campo y ningún adjunto). Todo lo demás es opcional.
- Vive 30 días desde su creación (constante `DIAS_VIGENCIA` en `borradorService.js`); editarlo no lo renueva. `vence_en` se calcula con el reloj de MySQL.
- Es privado: solo su dueño lo lista, lee, edita, borra o envía (otro usuario recibe «El borrador no existe», también los supervisores).
- Tope por usuario: parámetro `max_borradores_por_usuario` (15 por defecto, entero de 1 a 200), editable por el Administrador en «Horarios y feriados». Se aplica al crear, no al editar.
- Adjuntos: mismos límites que un vale (5 MB c/u, JPG/PNG/WEBP y PDF, misma validación de firma). Viven en un bucket aparte (`SUPABASE_STORAGE_BUCKET_BORRADORES`) con nombre `BORRADOR-<id>_<IMAGEN|PDF>_<n>`.
- Sin sockets, sin notificaciones y sin aviso previo: la lista muestra «Vence en N días» (en rojo con 3 o menos).

## Envío
El usuario abre el borrador (mismo modal, precargado) y pulsa «Crear Vale de Arte»: corre el `crearVale` normal con TODAS sus validaciones y `borradorId` en el formulario. Los adjuntos del borrador que no se quitaron se descargan y se suben al bucket normal con el nombre definitivo `{CORR}_...`, sumados a los nuevos (la regla de «al menos un adjunto» y el máximo de 10 imágenes y 5 PDF aplican al conjunto). Si el vale se crea, el borrador se marca enviado (`vale_borradores.enviado_en`, migración `borradores_enviados`) y se borran sus archivos del bucket (también los que el usuario quitó), cada fila de documento en cuanto su archivo se borra y, si todos se borraron, la fila del borrador. Si algún archivo no se puede borrar, el borrador queda marcado como enviado y el vigilante lo reintenta; el error solo va al log `[Borradores]` y el usuario siempre recibe el vale. Un borrador enviado ya no existe para el usuario (no se lista, abre, edita, envía ni cuenta en el tope: «El borrador no existe»). Si `crearVale` falla, no se marca ni se borra nada: el borrador y sus archivos quedan intactos y se puede reenviar. Fuera de producción `eliminar` no borra de Storage (ver `storage_solo_produccion.md`), así que ahí la limpieza solo quita las filas. Un lock por `borradorId` evita crear dos vales con un mismo borrador; un reintento con la misma `idempotencyKey` devuelve el vale ya creado.

## Vencimiento
`src/modules/vales/borradorWatcher.js` (arranca en `app.js`, espera `db.listo`, corre cada hora): por cada borrador vencido, y por cada enviado pendiente de limpieza (sin esperar a su vencimiento), borra primero los objetos de Storage y luego la fila; si Storage falla deja la fila y reintenta en el siguiente ciclo. No cubre los archivos huérfanos de envíos anteriores a esta migración (no hay fila que los apunte).

## API (`/api/vales`, permiso `vales.crear`)
`GET /borradores`, `GET /borradores/:id`, `POST /borradores`, `PUT /borradores/:id` (`documentosQuitar` como al corregir un vale), `DELETE /borradores/:id`. `POST /` acepta `borradorId` y `documentosQuitar`.

## Cómo verificar
1. Crear un borrador solo con un campo y otro solo con un PDF; uno vacío debe rechazarse.
2. «Borradores (n)» muestra la lista; abrir, editar, quitar un adjunto y guardar.
3. Con el tope en 2, el tercer borrador nuevo falla; editar uno existente sigue permitido.
4. Con otro usuario, el borrador ajeno no aparece.
5. Abrir un borrador, completar y crear el vale: el vale tiene sus adjuntos con nombre `{CORR}_...` y el borrador desaparece. Si la fecha es inválida, el borrador queda.
6. Si el borrado de Storage falla al enviar, el vale se crea igual, el borrador no aparece y su fila `enviado_en` se limpia en el siguiente ciclo del vigilante.

## Pasos en producción
1. Importar `database/borradores_vales.sql` (idempotente) ANTES de desplegar. La columna `enviado_en` la agrega la migración `borradores_enviados`, que se aplica sola al arrancar en staging y producción.
2. Crear en Supabase Storage el bucket de borradores y definir `SUPABASE_STORAGE_BUCKET_BORRADORES` en el `.env` (es obligatoria: sin ella el servidor no arranca).
3. Desplegar. El tope se ajusta en Administración > Horarios y feriados.
