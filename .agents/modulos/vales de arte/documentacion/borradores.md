# Borradores de vales de arte

## Qué es
Quien tiene el permiso `vales.crear` (asesores y supervisores) puede guardar el formulario «Crear Vale de Arte» a medias con «Guardar como borrador». Un borrador NO es un vale: tablas aparte (`vale_borradores`, `vale_borrador_documentos`), sin correlativo, sin validaciones de vale.

## Reglas
- No se guarda un borrador completamente vacío (ningún campo y ningún adjunto). Todo lo demás es opcional.
- Vive 30 días desde su creación (constante `DIAS_VIGENCIA` en `borradorService.js`); editarlo no lo renueva. `vence_en` se calcula con el reloj de MySQL.
- Es privado: solo su dueño lo lista, lee, edita, borra o envía (otro usuario recibe «El borrador no existe», también los supervisores).
- Tope por usuario: parámetro `max_borradores_por_usuario` (15 por defecto, entero de 1 a 200), editable por el Administrador en «Horarios y feriados». Se aplica al crear, no al editar.
- Adjuntos: mismos límites que un vale (5 MB c/u, JPG/PNG/WEBP y PDF, misma validación de firma). Viven en un bucket aparte (`SUPABASE_STORAGE_BUCKET_BORRADORES`) con nombre `BORRADOR-<id>_<IMAGEN|PDF>_<n>`.
- Sin sockets, sin notificaciones y sin aviso previo: la lista muestra «Vence en N días» (en rojo con 3 o menos).

## Envío
El usuario abre el borrador (mismo modal, precargado) y pulsa «Crear Vale de Arte»: corre el `crearVale` normal con TODAS sus validaciones y `borradorId` en el formulario. Los adjuntos del borrador que no se quitaron se descargan y se suben al bucket normal con el nombre definitivo `{CORR}_...`, sumados a los nuevos (la regla de «al menos un adjunto» y el máximo de 10 imágenes y 5 PDF aplican al conjunto). Si el vale se crea, el borrador y sus archivos se borran (de mejor esfuerzo, con log `[Borradores]`); si falla, quedan intactos. Un lock por `borradorId` evita crear dos vales con un mismo borrador; un reintento con la misma `idempotencyKey` devuelve el vale ya creado.

## Vencimiento
`src/modules/vales/borradorWatcher.js` (arranca en `app.js`, espera `db.listo`, corre cada hora): por cada borrador vencido borra primero los objetos de Storage y luego la fila; si Storage falla deja la fila y reintenta en el siguiente ciclo.

## API (`/api/vales`, permiso `vales.crear`)
`GET /borradores`, `GET /borradores/:id`, `POST /borradores`, `PUT /borradores/:id` (`documentosQuitar` como al corregir un vale), `DELETE /borradores/:id`. `POST /` acepta `borradorId` y `documentosQuitar`.

## Cómo verificar
1. Crear un borrador solo con un campo y otro solo con un PDF; uno vacío debe rechazarse.
2. «Borradores (n)» muestra la lista; abrir, editar, quitar un adjunto y guardar.
3. Con el tope en 2, el tercer borrador nuevo falla; editar uno existente sigue permitido.
4. Con otro usuario, el borrador ajeno no aparece.
5. Abrir un borrador, completar y crear el vale: el vale tiene sus adjuntos con nombre `{CORR}_...` y el borrador desaparece. Si la fecha es inválida, el borrador queda.

## Pasos en producción
1. Importar `database/borradores_vales.sql` (idempotente) ANTES de desplegar.
2. Crear en Supabase Storage el bucket de borradores y definir `SUPABASE_STORAGE_BUCKET_BORRADORES` en el `.env` (es obligatoria: sin ella el servidor no arranca).
3. Desplegar. El tope se ajusta en Administración > Horarios y feriados.
