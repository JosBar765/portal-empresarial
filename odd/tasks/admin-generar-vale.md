# admin-generar-vale

Rama: `feature/admin-generar-vale` (desde `origin/dev`) · Estado: T1–T3 hechas.

## Objetivo
Una pestaña «Crear Vale de Arte» en Administración que genera el PDF de un vale a partir de campos arbitrarios (correcciones, p. ej. regenerar un vale con otra fecha de entrega), lo sube a Supabase y muestra el link. El cambio de `vales.pdf_url` en la BD lo hace el usuario a mano.

## Reglas acordadas con el usuario
- **Acceso**: permiso nuevo `admin.vales.generar`, solo Administrador.
- **No crea ni modifica vales**, no toca `vales.pdf_url` ni ninguna tabla de vales. Solo genera el PDF, lo sube y deja una fila de auditoría.
- **Campos** (todo lo que imprime `valePdfService`): correlativo (texto libre); fecha de generación (editable, por defecto ahora); asesor (combo con relleno automático de nombre, correo y teléfono, editables); cliente (empresa, nombre, teléfono, correo); venta (fecha y hora de ingreso, fecha de entrega, fecha del evento, urgente sí/no a mano, producto, material, técnica, acabado, cantidad, cotización, descripción); autorización (supervisor en combo, tipo Creación/Modificación, fecha y hora); casilla «MODIFICAR» del pie; imágenes y PDF adjuntos subidos en el formulario con los mismos límites que al crear un vale. **Sin talleres** (el PDF no los imprime).
- **Contraseña**: al generar pide la contraseña de la cuenta (modal). Límite propio de la acción: 5 intentos fallidos en 15 minutos bloquean esta acción para ese usuario, sin bloquear la cuenta.
- **PDF**: mismo generador que los vales, sin marca extra.
- **Resultado**: link de Supabase con botones copiar y abrir.
- **Auditoría**: tabla con quién lo generó, cuándo, correlativo y link; lista en la misma pestaña. No se guardan los demás campos.

## Hallazgos del mapeo
- `valePdfService.generarPdfVale(vale, documentos)` es puro (objeto → Buffer); asesor y firma entran por `__asesorNombre/Correo/Telefono` y `__firmaAutorizacion {nombre, tipo, fechaHora}`; la imagen se incrusta bajando `doc.ruta` por `fetch` (solo PNG y JPEG) y los PDF se fusionan al final: hay que aceptar buffers en vez de URLs sin cambiar el comportamiento de los llamadores actuales.
- `supabaseStorage.subir(buffer, nombre, mime)` devuelve `{path, url, size}`; nombre aleatorio.
- Agregar una pestaña de admin: botón en `index.html`, `PERMISO_POR_TAB` y `cargarTab` en `sidebar.js`, vista nueva, función en `adminApi.js`, ruta con `requirePermission`.
- No existe reconfirmación de contraseña: se hace con `bcrypt.compare` contra `usuarios.password_hash` del usuario del JWT.
- Análisis aparte (entregado al usuario): cambiar solo `fecha_entrega` en la BD elimina el atraso en todas las vistas (se calcula en vivo); quedan desactualizados `urgente`, `atraso_notificado_en` y el tope diario del taller, y no hay registro de la fecha original.

## Tareas
- [x] T1 · Backend: tabla de auditoría, permiso `admin.vales.generar`, endpoints (opciones, generar con verificación de contraseña y límite, listado), `valePdfService` acepta buffers. Ruta: escritor delegado. Los cambios de base van en el script `admin_generar_vale.sql` (en `database/`) (idempotente, sin ids fijos; probado dos veces en desarrollo), NO en schema.sql/seed.sql, porque el sistema ya está en producción. Verificado: 18/18 de punta a punta (PDF válido subido a Storage, auditoría, 403 sin permiso, 401 y 429 por contraseña, tipos de archivo, vales intactos) y una prueba de humo de que crear un vale con imagen sigue funcionando. Sin inspección visual del diseño del PDF.
- [x] T2 · Frontend: pestaña «Crear Vale de Arte» (formulario, modal de contraseña, resultado con link, lista de generados). Ruta: escritor delegado. Verificado en el navegador como Administrador: la pestaña aparece, el asesor rellena nombre/correo/teléfono, la firma se habilita al elegir supervisor, contraseña incorrecta muestra el mensaje en el modal, la correcta genera y sube el PDF (200, application/pdf), aparece el link y la fila de auditoría, y el PDF se ve bien armado. Se encontró y corrigió un bug: la contraseña incorrecta devolvía 401 y `sessionGuard.js` mostraba «Tu sesión ha expirado»; ahora responde 403.
- [x] T3 · Documentación y verificación de punta a punta (PDF válido, subido, auditoría, contraseña mala/límite, permisos). CLAUDE.md actualizado (scripts de base numerados y la pestaña). Pruebas de punta a punta hechas en T1 y T2; los archivos y filas de prueba se borraron. Sin probar: archivos adjuntos (imagen y PDF) desde el formulario en el navegador, y el diseño por debajo de 640 px.

## Verificación y evidencia
Sin suite de tests: scripts propios contra la BD y Supabase de desarrollo, y la interfaz en el navegador.
(pendiente)

## Ruta por tarea
(pendiente)

## Siguiente paso
T1.
