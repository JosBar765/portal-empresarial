# Correcciones #34 — Teléfonos, historial y archivos adjuntos

Rama: `fix/correcciones-admin-y-vales`.

## 1. Teléfono no aparecía al editar un usuario (Administración)

`usuarioAdminRepository.listarConDetalle` no seleccionaba el teléfono, y el modal "Editar información" lo lee de ese listado. Ahora devuelve `COALESCE(a.telefono, sup.telefono) AS telefono` (nuevo `LEFT JOIN supervisores`). El teléfono se guarda en `asesores` o `supervisores` según el rol.

## 2. Teléfono: máximo 8 números en todos los modales

- No existía un validador común (`components/validacion.js` es solo del módulo de vales y no cubre Administración). Se creó `public/js/telefono.js` (`limitarTelefono`), servido como estático público y importado por los dos módulos con `/js/telefono.js`.
- Acepta solo números, espacios y guiones y corta en el 8.º número, también al pegar. Se aplica a los tres campos de teléfono: editar/crear usuario, crear vale y solicitar modificación.
- El servidor repite la regla (`validarTelefono` en `core/utils/validar.js`): cuenta los números sin el código de país y responde "El teléfono no puede tener más de 8 números." Se usa en `crearUsuario`, `actualizarUsuario` y `validarDatosVale` (cubre creación y modificación de vales).
- Un teléfono ya guardado con más de 8 números se muestra completo al editar, pero no podrá guardarse hasta corregirlo.

## 3. Historial de asesor y supervisor

`_filtrarHistorialPorRol` (`valeDetalleService.js`) ahora incluye, además de lo que ya veían, las categorías `ASIGNACION` (cuando el encargado asigna el vale a un técnico, o a sí mismo) y `APROBACION_TALLER` (cuando cada taller termina su parte). El resto del historial no cambia; ya lo veía el Gerente.

## 4. Bloqueo de archivos no permitidos al subir

`wireDropzone` (`components/dropzone.js`) ahora valida el tipo de cada archivo contra el atributo `accept` de su zona, tanto al elegirlo como al arrastrarlo. Un archivo no permitido no se agrega y se muestra el aviso "Archivo no permitido: "x" no se puede subir. Solo se aceptan archivos JPG, PNG, WEBP." El servidor sigue validando el tipo real del archivo. Como el componente es compartido, aplica igual a la propuesta del técnico y al documento de fusión (solo PDF).

## 5. Badge de archivos subidos en verde

`.archivo-chip` (`public/modules/vales/css/styles.css`) usa los tokens `--color-success` y `--color-success-bg` (fondo, borde, ícono y tamaño en verde).

## 6. Miniatura y previsualización de los archivos antes de subirlos

Commit aparte (se puede revertir sin afectar el resto de esta corrección).

Un archivo elegido solo existe en memoria del navegador, pero se puede mostrar con una URL temporal (`URL.createObjectURL`) sin subirlo a ninguna parte. En `wireDropzone` (`components/dropzone.js`), común a todas las zonas de carga (imágenes y documentos al crear un vale, propuesta del técnico y documento de fusión):

- Las imágenes muestran una miniatura de 28 px en su badge; los PDF, el ícono de documento (no se genera miniatura de la primera página: haría falta una librería de PDF).
- Al pulsar la miniatura, el ícono o el nombre del archivo se abre una previsualización en un modal grande: la imagen completa, o el PDF en un visor integrado. El modal incluye "Abrir en otra pestaña" por si el navegador no muestra el PDF integrado.
- Escape cierra solo la previsualización, no el formulario que queda debajo.
- Las URL temporales se liberan al quitar el archivo, al cerrar la previsualización y al cerrar el formulario.
- De paso, el nombre del archivo en el badge ahora se escapa (`escapeHtml`) antes de insertarse en el HTML.

## Verificación

- En el navegador, como la asesora Alejandra Luna: el historial de un vale muestra las asignaciones y las aprobaciones por taller; en "Crear Vale de Arte", escribir `1234-5678901abc` en el teléfono deja `1234-5678`; subir `notas.txt` y `contrato.docx` a "Imágenes" los rechaza con aviso y una imagen PNG queda como badge verde.
- `validarTelefono`: acepta `+502 1234-5678` y `+503 12 34 56 78`; rechaza `+502 12345-6789`. Por API, crear un vale con 9 números responde 400 con el mensaje de arriba.
- El listado de administración devuelve `+502 1234578` para Alejandra Luna (consulta directa al repositorio). La comprobación del modal de edición en pantalla queda pendiente: requiere sesión de Administrador.
