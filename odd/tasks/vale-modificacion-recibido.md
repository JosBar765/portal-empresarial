# vale-modificacion-recibido

Rama: `fix/vale-de-arte-modificacion` (desde `origin/dev`) · Estado: T1–T5 hechas.

## Objetivo
Corregir el flujo de «solicitar modificación»: el vale original pasa a `RECIBIDO` en el momento de la solicitud, el vale `MOD-` nace completo con la propuesta original al final, y ningún PDF sale a medias.

## Reglas acordadas con el usuario
- **Al solicitar la modificación** el vale original pasa a `RECIBIDO` automáticamente, se autorice o se rechace después. Cuenta como confirmación: se congela el atraso, se registra la fecha de confirmación y aparece en «Trabajo realizado» del asesor y del supervisor.
- **El vale `MOD-` se arma por completo al solicitar**, con la propuesta del vale original adjunta al final del PDF (solo existen propuestas en PDF).
- **Autorizar el `MOD-`** solo lo manda a los talleres; el PDF se vuelve a generar únicamente para estampar la firma del supervisor y la fecha de autorización (igual que en los vales normales). No se vuelven a agregar documentos.
- **Rechazar o vencer el `MOD-` lo borra** (solo el `MOD-`; nunca la propuesta ni los archivos del vale original). El supervisor sigue escribiendo la justificación (hasta 50 palabras) y el asesor recibe una notificación con el motivo. Ya no hay corregir ni reenviar para las modificaciones: se hace una solicitud nueva.
- **Una nueva solicitud** es posible mientras no se haya autorizado una modificación del vale (si el `MOD-` se borra, el original puede pedir otra).
- **PDF sin adjuntos a medias, nunca (todos los vales)**: si un PDF adjunto no se puede descargar o leer, no se genera el PDF y el usuario ve un error con el nombre del archivo. Hasta **3 intentos automáticos** antes de fallar.
- **Log** con la causa distinguida (archivo inexistente 404, sin permiso 403, error del servidor 5xx, sin conexión o tiempo agotado, archivo no PDF o dañado) más correlativo, id del vale, nombre del archivo y URL.
- **Producción**: hoy no existe ningún vale de modificación, así que no hace falta script de datos. Si apareciera algún cambio de base, va en un script aparte con correlativo, citado sin el número en la documentación.

## Hallazgos del mapeo
- La propuesta original se adjunta hoy solo al autorizar (`valeModificacionService.js:139-147`); desde los commits `650fa32` y `529ae17` el `MOD-` nace al solicitar sin ella, por eso el PDF que revisa el supervisor no la trae.
- `_fusionarPdfExterno` solo hace `console.warn` ante cualquier falla, y `fetch` no lanza ante 404/403 (el cuerpo de error se intenta leer como PDF).
- El borrado de un `MOD-` puede borrar el archivo de la propuesta del original: `contarReferenciasEnOtrosVales` solo cuenta filas de `vale_documentos`, no `vales.propuesta_general_url` ni `vale_propuestas.url`.
- `aprobarModificacion` hoy marca `modificado`, pasa el original a `RECIBIDO` y congela el atraso, pero nunca registra la fecha de confirmación.
- Lugares afectados por el original en `RECIBIDO` al solicitar: `valeModificacionService`/`valeModificacionRepository`, contadores y listas del Buzón (`valeBuzonService`), «Trabajo realizado», `estadoVisibleAsesor`, acciones del Buzón (`buzon.js`, modal «Confirmar o solicitar modificación»), textos «queda sin cambios», Rendimiento (`confirmado_en`, `modificado`) e historial.

## Tareas
- [x] T1 · PDF estricto: descarga con 3 intentos, causa distinguida en el log y error con el nombre del archivo cuando un PDF adjunto falla (`valePdfService`). Ruta: escritor delegado. Verificado: 12/12 casos con fetch simulado (éxito, 404 y 403 sin reintento, 5xx con reintentos, red caída, tiempo agotado, cuerpo HTML, PDF dañado, propuesta original fallando, mensaje al usuario sin URL). Sin probar contra Storage real.
- [x] T2 · Sin estados a medias: que ningún flujo que genera el PDF (crear, autorizar, corregir, aprobar fusión) deje datos cambiados si el PDF falla. Ruta: escritor delegado. Verificado: 27/27 en proceso (fallo del PDF y fallo de subida a Storage en crear, autorizar y corregir dejan la base y el Storage como estaban; el camino normal sigue funcionando) y crear + autorizar por HTTP. `autorizarCreacion` ahora genera el PDF con la firma antes de tocar la base y confirma todo en una transacción (`autorizarCreacionAtomico`). Crear y corregir ya eran seguros; `aprobarGeneral` verificado solo por lectura.
- [x] T3 · Flujo de modificación en el servidor: original a `RECIBIDO` al solicitar, propuesta original en el PDF del `MOD-`, autorizar solo regenera la firma, rechazar borra, borrado seguro de archivos compartidos. Ruta: escritor delegado. Verificado: 60/60 en proceso (original a RECIBIDO al solicitar con atraso y confirmación sellados, propuesta original en el PDF del MOD-, fallo de descarga sin dejar nada, autorizar solo estampa la firma con tres variantes de fallo sin cambios, rechazar y vencer borran solo el MOD- sin tocar archivos del original, nueva solicitud posible, Buzón y Trabajo realizado) y crear + autorizar por HTTP. Sin probar por HTTP las rutas nuevas ni en el navegador. Ajustes posteriores del usuario: corregir un MOD- pendiente SÍ se permite (la propuesta original no se puede quitar ni los talleres cambiar), y si un MOD- autorizado se elimina después (baja o vencimiento de adjuntos) el original vuelve a poder pedir otra modificación (79/79 en proceso).
- [x] T4 · Interfaz: acciones y etiquetas del Buzón para el original y para el `MOD-`. Ruta: escritor delegado. Verificado en el navegador como asesor y supervisor: el modal de decisión y el formulario explican el nuevo comportamiento, el formulario no deja cambiar talleres, al solicitar el original queda RECIBIDO (atraso y confirmación sellados) y el MOD- aparece con Corregir, corregir muestra la propuesta original sin botón de quitar, el supervisor rechaza con justificación y el MOD- desaparece, el original y su propuesta siguen disponibles y el asesor recibe la notificación con el motivo.
- [x] T5 · Documentación y verificación de punta a punta. Documentación: sección 1.1 de `flujo_vale_de_arte.md` reescrita (flujo, estados, diagramas, vigencia, PDF sin adjuntos a medias) y `CLAUDE.md`. Verificación de punta a punta repartida por tarea (12 + 27 + 79 casos en proceso, y el recorrido completo en el navegador: solicitar, ver el original en Recibido, corregir el MOD- con la propuesta protegida y rechazarlo como supervisor con notificación del motivo).

## Verificación y evidencia
Sin suite de tests: scripts propios en proceso y por HTTP contra la BD y el Storage de desarrollo, y la interfaz en el navegador.
(pendiente)

## Ruta por tarea
(pendiente)

## Siguiente paso
T1.
