# Módulo Generador de Prompts

Arma, a partir de los parámetros que llena un asesor, un prompt de texto para pegar en un generador de imágenes (hoy Gemini). No genera imágenes ni guarda propuestas. El Administrador define los productos (hoy, la medalla) y los parámetros que pide cada uno, sin tocar código.

## Dependencias

- **Montaje:** `/api/prompts` en `src/app.js`, detrás de `requireAuth` y `requirePermission('prompts.ver')`. El estático `public/modules/prompts/` lo sirve `/modules` con la entrada `prompts` de `MODULOS`.
- **Servicios del core:** `permissionMiddleware`, `erroresHttp` (`ErrorDeNegocio`, `responderError`), `validar` (`idObligatorio`), `config/database` (`db.query`, `db.transaccion`).
- **Reutiliza del frontend:** `public/css/global.css`, `public/css/dashboard.css`, `sessionGuard.js`, `toast.js`.
- **Tablas:** `prompt_productos` y `prompt_producto_versiones`. Lee `usuarios`, `asesores` y `supervisores` solo para el contacto del pie (único acoplamiento con otros módulos).
- **Permisos:** `prompts.ver`, `prompts.generar`, `prompts.administrar`.
- **Variables de entorno:** ninguna.
- **Sockets y `events.js`:** no usa.
- **Persistencia:** nada se guarda por propuesta. Las imágenes viven solo en el navegador.

## Dónde está el código

- **Backend:** `src/modules/prompts/`
  - `routes.js`, `controllers/` (`promptsController.js` para el asesor, `adminProductoController.js`).
  - `services/esquemaService.js` y `plantillaService.js` son puros (sin base de datos): validan el esquema y los valores, y arman el prompt.
  - `services/promptsService.js` (asesor) y `adminProductoService.js` (productos, borradores, publicación).
  - `repositories/` (`productoRepository`, `versionRepository`, `contactoRepository`) con todo el SQL.
- **Base de datos:** tablas al final de `database/schema.sql`; permisos 29 a 31 en `database/seed.sql`; migración `prompts` (tablas, permisos y el producto Medalla con su versión 1 publicada).
- **Frontend:** `public/modules/prompts/`
  - `js/views/asesor/`: formulario dinámico (`formulario.js`, `campos.js`), vista de resultado (`resultado.js`) y lámina numerada por canvas (`lamina.js`).
  - `js/views/adminProductos.js` y `js/views/admin/`: lista de productos, editor, pestañas de parámetros, plantilla, vista previa y JSON, y `esquemaOps.js` (operaciones puras sobre el esquema).
  - `js/api/` (`promptsApi.js`, `promptsAdminApi.js`).

## Reglas clave

- Un producto tiene como máximo un borrador y una versión publicada. Publicar archiva la anterior. Una versión publicada o archivada nunca se modifica.
- El prompt siempre lleva el encabezado fijo «NUEVA INSTRUCCIÓN. Ignora…»; no está en la plantilla y no se puede quitar. Cada prompt se pega en un chat nuevo.
- La identidad y el contacto salen siempre de `req.user`, nunca del cuerpo. Si el usuario no tiene teléfono, `POST /generar` responde 409 con `codigo: TELEFONO_FALTANTE`; el asesor puede aceptar generar sin número.
- El servidor valida los valores contra el esquema de la versión publicada: rechaza claves desconocidas e ignora los parámetros ocultos por `visible_si`.
- Los valores del asesor se insertan en una sola pasada: lo que escriba nunca se interpreta como plantilla.
- La marca de agua («Grupo Premia» y el logo) es regla de gerencia. Hoy solo se pide en el prompt; si Gemini no la respeta bien, se analiza una segunda etapa que la aplique de forma exacta.
- UI en español neutro (tú). Estados en palabras completas.

## Roles

- Asesor de Ventas (2) y Supervisor de Ventas (3): `prompts.ver` y `prompts.generar`.
- Administrador (1): además `prompts.administrar`.
- Los permisos viajan en el token: tras aplicar la migración hay que cerrar sesión y volver a entrar.

## Probar en local

1. Estar en la rama del módulo y detener el servidor.
2. `npm run migrate` (aplica la migración `prompts` en la base local).
3. Iniciar el servidor, cerrar sesión y volver a entrar con un Asesor (ver `database/users.sql`) y con el Administrador.
4. Asesor: crear una propuesta de medalla, probar «Copiar todo» pegando en Gemini en un chat nuevo, y probar un usuario sin teléfono.
5. Administrador: abrir Productos, crear un borrador de la Medalla, editar un parámetro, revisar la plantilla y publicar.

## Pendientes y puntos por probar

- Todo el comportamiento del navegador (formulario, lámina, copiado, modales, editor) está verificado solo por sintaxis y pruebas de funciones puras; falta una prueba manual.
- El copiado conjunto de imagen y texto (`image/png` más `text/plain`) puede no funcionar en todos los generadores; el respaldo son los botones «Copiar prompt» y «Copiar lámina».
- La clave de un parámetro no se bloquea todavía entre versiones en el servidor; el editor solo la bloquea si ya existe en la versión publicada.
- El mockup de Figma quedó desactualizado en tres puntos: ya no hay historial ni número de propuesta, el aviso de teléfono ausente es un modal y no hay KPI de propuestas generadas.

## Documentos del módulo

- `analisis_modulo.md`: requerimiento original.
- `propuesta_modulo.md`: propuesta inicial; la decisión de no guardar propuestas la deja parcialmente desactualizada.
- `documentacion/esquema_y_contrato.md`: esquema JSON, sintaxis y plantilla v1, y API. Es la fuente de verdad técnica.
