# Correcciones #36 — Corregir un vale antes de ser autorizado

Rama: `feature/corregir-vale`.

## Qué hace

Nuevo permiso `vales.corregir`, asignado al rol Asesor de Ventas. El asesor dueño de un vale en `ESPERANDO_AUTORIZACION` puede corregir todos los datos del formulario de creación (cliente, teléfono, correo, talleres, fechas, producto, material, técnica, acabado, cantidad, cotización, urgente, descripción y archivos). El vale **no se vuelve a crear**: conserva su id, correlativo y estado; solo se actualizan sus datos y se regenera el PDF. Exclusivo del asesor de ventas (ni Supervisor ni Administrador, aunque se les asigne el permiso).

## Archivos adjuntos

El modal muestra los archivos actuales (con enlace y una "×") y permite agregar nuevos. Al guardar: se borran (base y Storage) solo los que el asesor quitó, se suben los nuevos, y los que no tocó se conservan.

## Transacciones y archivos huérfanos

`valeCorreccionService.corregirVale` sigue este orden, dentro del lock del vale (no puede cruzarse con una autorización o baja simultánea):

1. Validaciones sin efectos: rol, dueño, estado, datos del formulario, fechas, cupo diario, archivos a quitar y límites de archivos.
2. Se suben a Storage los archivos nuevos y el PDF regenerado (con los datos y documentos finales). Cada URL subida se anota al instante.
3. `valeCorreccionRepository.aplicar` ejecuta **una transacción** (nuevo `db.transaccion` en `config/database.js`): actualiza el vale (solo si sigue esperando autorización), borra los documentos quitados, inserta los nuevos y registra el historial. Si cualquier paso falla, hay rollback.
4. Si algo falla en los pasos 2 o 3, se borran de Storage los archivos recién subidos y la base queda intacta.
5. Solo después del commit se borran de Storage los archivos reemplazados (documentos quitados y PDF anterior), con un reintento. Si aun así un borrado falla, queda registrado en el log (`[Storage] Archivo huérfano sin borrar: <url>`); es el único punto donde puede quedar un archivo suelto, y nunca una referencia rota en la base.

El cupo diario por taller se revalida dentro de la cola de capacidad, justo antes de la transacción, y **no cuenta al propio vale** (`validarLimiteDiario` y `obtenerCapacidadMes` aceptan un `excluirValeId`; el calendario del modal lo usa).

## Cambios

- Backend: `POST /api/vales/:id/corregir` (`requirePermission('vales.corregir')`, mismos adjuntos que crear), `valeCorreccionService`, `valeCorreccionRepository`, `valeCreacionService.generarBufferPdf` (separa la generación del PDF de su guardado) y `db.transaccion`.
- Seed: permiso `vales.corregir` (id 25) asignado al rol 2.
- Historial: nueva categoría `CORRECCION` ("Asesor corrigió los datos del vale de arte antes de su autorización"), visible para asesor, supervisor y gerente.
- Frontend: acción "Corregir" (tuerca) en el buzón del asesor para vales esperando autorización; el formulario de creación se reutiliza en modo corrección (`abrirModalCorregirVale`) con botón "Guardar cambios", y el selector de fechas gana `setDate`.

## Aviso al supervisor

Si el supervisor tiene abierto el modal "Autorizar creación" de un vale y el asesor lo corrige, el modal **no se recarga solo**: aparece arriba un aviso ámbar ("El asesor modificó este vale. Cierra esta ventana y ábrela de nuevo para ver los datos actualizados.") y los botones siguen activos. El evento en tiempo real de la corrección lleva `tipo: 'CORREGIDO'` (nuevo campo opcional de `valeEvents.notificar`) y `socket.js` se lo pasa a `avisarCambioEnModalAutorizar` (`actions/supervisor.js`), que solo actúa si el modal abierto es el de ese vale.

## Mensajes de error

| Situación | Mensaje |
|---|---|
| Vale ya autorizado | "Este vale ya fue autorizado, así que ya no se puede corregir." |
| Vale ya dado de baja o rechazado | "Este vale ya no existe: fue dado de baja o rechazado." |
| Vale de otro asesor | "Solo puedes corregir tus propios vales." |
| Sin el permiso | "No tienes permiso para realizar esta acción." |
| Archivo a quitar que ya no existe | "Alguno de los archivos que quieres quitar ya no existe en este vale. Actualiza la página e inténtalo de nuevo." |
| Demasiados archivos | "Un vale admite hasta 10 imágenes y 5 documentos." |
| Fechas, cupo diario y demás datos | Los mismos mensajes que al crear. |

## Bases de datos existentes

```sql
INSERT INTO `permisos` (`id`, `codigo`, `nombre`, `modulo`, `descripcion`) VALUES (25, 'vales.corregir', 'Corregir Vales de Arte', 'vales', 'Permite al asesor corregir los datos de un vale de arte propio antes de que sea autorizado');
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES (2, 25);
```

Los asesores con sesión abierta lo reciben al iniciar sesión de nuevo (o a la siguiente renovación de su token).

## Verificación

- Por API, con Storage real de pruebas: corregir quitando una imagen, agregando otra y cambiando datos (mismo correlativo; el conteo de archivos del bucket no cambia; imagen y PDF anteriores desaparecen de Storage y el PDF nuevo existe); fallo forzado en la base **después** de subir archivos (rollback y sin archivos huérfanos); archivo ajeno; fecha pasada; supervisor sin permiso (403); vale ya autorizado; vale dado de baja; cupo diario (corregir el 4.º vale de un taller con límite 4, conservando fecha y taller, funciona, y el 5.º vale nuevo se rechaza).
- En el navegador, como la asesora Alejandra Luna: la tuerca aparece solo en vales esperando autorización, entre el PDF y el historial (dar de baja sigue al final); el modal abre precargado (cliente, teléfono, taller, fechas, descripción y archivos actuales); guardar cambia datos y archivos con aviso de éxito; con el modal abierto, el supervisor autorizó el vale y al guardar apareció "Este vale ya fue autorizado, así que ya no se puede corregir."; con el modal "Autorizar creación" abierto como supervisor, al corregir el asesor el vale apareció el aviso ámbar sobre el modal
- Una URL pública de Storage puede seguir respondiendo unos minutos después de borrar el archivo por la caché del CDN; la comprobación de borrado se hizo contra la API de Storage.
