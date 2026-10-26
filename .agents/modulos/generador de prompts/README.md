# Módulo Generador de Prompts

Arma, a partir de los parámetros que llena un asesor, un prompt de texto para pegar en un generador de imágenes (hoy Gemini). No genera imágenes ni guarda propuestas. El Administrador define los productos (hoy, la medalla) y los parámetros que pide cada uno, sin tocar código.

## Dependencias

- **Montaje:** `/api/prompts` en `src/app.js`, detrás de `requireAuth` y `requirePermission('prompts.ver')`. El estático `public/modules/prompts/` lo sirve `/modules` con la entrada `prompts` de `MODULOS`.
- **Servicios del core:** `permissionMiddleware`, `erroresHttp` (`ErrorDeNegocio`, `responderError`), `validar` (`idObligatorio`), `config/database` (`db.query`, `db.transaccion`).
- **Reutiliza del frontend:** `public/css/global.css`, `public/css/dashboard.css`, `sessionGuard.js`, `toast.js`.
- **Tablas:** `prompt_productos`, `prompt_producto_versiones` y `prompt_ajustes` (ajustes globales editables). Lee `usuarios`, `asesores` y `supervisores` solo para el contacto del pie (único acoplamiento con otros módulos).
- **Permisos:** `prompts.ver`, `prompts.generar`, `prompts.administrar`.
- **Variables de entorno:** ninguna.
- **Sockets y `events.js`:** no usa.
- **Persistencia:** nada se guarda por propuesta. Las imágenes viven solo en el navegador.

## Dónde está el código

- **Backend:** `src/modules/prompts/`
  - `routes.js`, `controllers/` (`promptsController.js` para el asesor, `adminProductoController.js`).
  - `services/esquemaService.js` y `plantillaService.js` son puros (sin base de datos): validan el esquema y los valores, y arman el prompt.
  - `services/promptsService.js` (asesor) y `adminProductoService.js` (productos, borradores, publicación).
  - `repositories/` (`productoRepository`, `versionRepository`, `contactoRepository`, `ajustesRepository`) con todo el SQL.
  - `services/ajustesService.js` y `ajustesEsquema.js` (ajustes globales y su validación), `recursoService.js` y `recursos.js` (lectura de las imágenes fijas) y `mensajes.js`, el catálogo central de todos los mensajes al usuario.
- **Base de datos:** tablas al final de `database/schema.sql`; permisos 29 a 31 en `database/seed.sql`; migración `prompts` (tablas, permisos y el producto Medalla con su versión 1 publicada) y `prompts_plantilla_v2` (publica la versión 2 de la Medalla: imágenes descritas, plantilla reordenada).
- **Frontend:** `public/modules/prompts/`
  - `js/views/asesor/`: formulario dinámico (`formulario.js`, `campos.js`), vista de resultado con copiado guiado, una imagen a la vez (`resultado.js`, `pasosCopiado.js`, `portapapeles.js`).
  - `js/views/adminProductos.js` y `js/views/admin/`: lista de productos, editor, pestañas de parámetros, plantilla, vista previa y JSON, y `esquemaOps.js` (operaciones puras sobre el esquema).
  - `js/api/` (`promptsApi.js`, `promptsAdminApi.js`), `js/config.js` (límites y formatos que entrega el servidor), `js/textos.js` (catálogo de textos de interfaz y errores) y `js/views/adminAjustes.js`.

## Reglas clave

- Un producto tiene como máximo un borrador y una versión publicada. Publicar archiva la anterior. Una versión publicada o archivada nunca se modifica.
- El prompt siempre lleva el encabezado fijo «NUEVA INSTRUCCIÓN. Ignora…»; no está en la plantilla y no se puede quitar. Cada prompt se pega en un chat nuevo.
- La identidad y el contacto salen siempre de `req.user`, nunca del cuerpo. Si el usuario no tiene teléfono, `POST /generar` responde 409 con `codigo: TELEFONO_FALTANTE`; el asesor puede aceptar generar sin número.
- El servidor valida los valores contra el esquema de la versión publicada: rechaza claves desconocidas e ignora los parámetros ocultos por `visible_si`.
- Los valores del asesor se insertan en una sola pasada: lo que escriba nunca se interpreta como plantilla.
- Todo parámetro o grupo nuevo del esquema entra solo al prompt: los que la plantilla no nombra se agregan en «ESPECIFICACIONES ADICIONALES» (donde se ponga `{{otros_parametros}}` o al final).
- Cada imagen lleva una descripción y, si el parámetro define `ubicaciones`, una ubicación; ambas listas (`ubicaciones` y `sugerencias`) viven en el esquema, nada está fijo en el código. No hay lámina: el asesor copia cada imagen por separado y al final el prompt, y el logo de Grupo Premia va siempre como última imagen.
- Nada de contenido de negocio ni de límites está fijo en el código: el encabezado, las frases que arma el prompt, los límites y los formatos viven en `prompt_ajustes` (pestaña «Ajustes», solo Administrador) y el frontend los lee de `GET /api/prompts/config`. Lo que sigue en código es estructural: tipos de parámetro, permisos, rutas, tablas y la forma de cada ajuste.
- Las imágenes fijas de un producto (por ejemplo, la plantilla de la imagen final, con la franja inferior de la empresa, los espacios para los datos del asesor y el logo arriba a la derecha) son «recursos» del esquema (pestaña «Recursos»). El servidor las entrega por `/api/prompts/recursos/:productoId/:clave` y solo acepta URLs https del host de `SUPABASE_URL` o rutas `/assets/`; leer no es una acción crítica según `reglas_entornos.md`.
- Los textos de interfaz y los mensajes de error están centralizados (`js/textos.js` y `mensajes.js`) y todo error explica qué falló, la regla con sus números y cómo corregirlo.
- La marca de agua («Grupo Premia») es regla de gerencia. El logo ya viene en la plantilla; la segunda etapa que la aplique de forma exacta sigue pendiente, a decidir según los resultados con Gemini.
- UI en español neutro (tú). Estados en palabras completas.

## Roles

- Asesor de Ventas (2) y Supervisor de Ventas (3): `prompts.ver` y `prompts.generar`.
- Administrador (1): además `prompts.administrar`.
- Los permisos viajan en el token: tras aplicar la migración hay que cerrar sesión y volver a entrar.

## Probar en local

1. Estar en la rama del módulo y detener el servidor.
2. `npm run migrate` (aplica `prompts`, `prompts_plantilla_v2`, `prompts_ajustes` y `prompts_marca_de_agua`). Las migraciones `prompts_ajustes` y `prompts_marca_de_agua` publican las versiones 3 y 4 de la Medalla solo si no existe ya una versión 3 u otra publicada; si hay versiones de prueba con número 3 o mayor, bórralas antes (SQL en la cabecera de la migración).
3. Iniciar el servidor, cerrar sesión y volver a entrar con un Asesor (ver `database/users.sql`) y con el Administrador.
4. Sube la imagen de la plantilla a un bucket público de Supabase, copia su URL pública y, como Administrador, entra a Productos → Medalla → «Crear borrador» → pestaña Recursos → «Plantilla base»: pega la URL, actívala y publica.
5. Asesor: crear una propuesta de medalla con imágenes descritas, copiar cada imagen y luego el prompt en un chat nuevo de Gemini, y probar un usuario sin teléfono.
6. Administrador: abrir Productos, crear un borrador de la Medalla, editar un parámetro, revisar la plantilla y publicar.

## Pendientes y puntos por probar

- Todo el comportamiento del navegador (formulario, lámina, copiado, modales, editor) está verificado solo por sintaxis y pruebas de funciones puras; falta una prueba manual.
- Gemini no tiene una forma oficial de referirse a una imagen por su número (Google las nombra por rol), por eso cada imagen se numera y se describe; falta comprobar con pedidos reales si respeta el orden y la marca de agua.
- Si un pedido supera las 14 imágenes de referencia de Gemini, la pantalla de resultado solo avisa.
- La clave de un parámetro no se bloquea todavía entre versiones en el servidor; el editor solo la bloquea si ya existe en la versión publicada.
- El mockup de Figma quedó desactualizado en tres puntos: ya no hay historial ni número de propuesta, el aviso de teléfono ausente es un modal y no hay KPI de propuestas generadas.

## Documentos del módulo

- `analisis_modulo.md`: requerimiento original.
- `propuesta_modulo.md`: propuesta inicial; la decisión de no guardar propuestas la deja parcialmente desactualizada.
- `documentacion/esquema_y_contrato.md`: esquema JSON, sintaxis y plantilla v1, y API. Es la fuente de verdad técnica.
