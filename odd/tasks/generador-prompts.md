# Módulo Generador de Prompts

Rama: `module/generador-prompts` (desde dev 884a872). Sin push.
Base: `.agents/modulos/generador de prompts/analisis_modulo.md` y `propuesta_modulo.md`. Mockup: https://www.figma.com/design/XB3lOHqrqObxxQnr78rIiT

## Objetivo
Módulo nuevo e independiente. El asesor completa los parámetros de un producto (hoy, la medalla) y el portal arma un prompt de texto para pegar en un generador de imágenes (Gemini). No genera imágenes. La vista de administración define los productos y sus parámetros sin tocar código.

## Decisiones (todas del usuario)
- Parámetros de cada producto en JSON dentro de una columna MySQL, por versión inmutable. Un borrador y una versión publicada por producto.
- Nada se guarda por propuesta: sin historial, sin número de propuesta, sin tabla de propuestas. El servidor arma el prompt y lo devuelve sin escribir.
- Las imágenes viven solo en el navegador. Se copian como una lámina numerada única (canvas) más el prompt, en un solo ítem del portapapeles (`image/png` + `text/plain`); si el generador no toma ambos, quedan dos botones separados.
- Roles: usan el módulo Asesor (rol 2) y Supervisor (rol 3); administra el Administrador (rol 1).
- Contacto del pie desde `asesores.telefono` o `supervisores.telefono`. Si falta el teléfono, el servidor responde con una excepción y el asesor puede aceptar generar sin número (solo nombre y correo).
- Siempre en español. Pie fijo: logo del portal y colores del logo.
- Marca de agua obligatoria (regla de gerencia): el prompt pide el logo y la frase «Grupo Premia». Se prueba así; si falla se analiza una segunda etapa.
- Cada prompt es una instrucción nueva: encabezado fijo del sistema que pide ignorar cualquier propuesta anterior; se pega en un chat nuevo.
- Plantilla v1 optimizada para Gemini (texto exacto entre comillas, formato 16:9, fondo plano, lámina de referencia, sin negaciones).
- Sin sockets ni `events.js`. El único acoplamiento con otro módulo es leer el contacto del asesor.

## Tareas
- [x] T0 Documentos de análisis y propuesta en la rama. (cae7a0d)
- [x] T1 BD: tablas en `schema.sql`, permisos en `seed.sql` y migración idempotente (tablas, permisos, producto Medalla v1 publicada con esquema y plantilla). (commit «tablas, permisos y migración»)
- [x] T2 Backend: `src/modules/prompts` (esquema, plantilla, contacto, productos, versiones, rutas), catálogo `MODULOS` y montaje en `app.js`. (commit «backend del módulo»)
- [x] T3 Front asesor: formulario dinámico, lámina numerada, copiar todo, modal sin teléfono. (commit «vista del asesor»)
- [x] T4 Front administración: lista, editor de parámetros, plantilla, vista previa y JSON. (commit «vista de administración»)
- [x] T5 Documentación del módulo y mapa de docs de `CLAUDE.md`. (commit «README del módulo»)
- [x] T6 Verificación final (sintaxis, pruebas de funciones puras) y resumen. (ci:sintaxis 245 archivos OK; 40 aserciones de plantilla/esquema; esquemaOps y calcularLayout probados; router con 12 rutas carga con config simulada)

## Ronda 2 (2026-10-26, tras probar con Gemini)
Decisiones del usuario:
- Imágenes sueltas en lugar de la lámina: el asesor copia y pega cada imagen y luego el prompt. Sin preparación de imágenes (sin recortes ni avisos de resolución).
- Cada imagen lleva una descripción corta y, si el parámetro lo define, una ubicación (listas definidas en el esquema, nada hardcodeado). El prompt las numera y las describe por rol.
- Prompt reordenado: primero las referencias, después la escena. Si no hay imágenes de listón: diseño arbitrario con los colores de los logos.
- Todo parámetro o grupo nuevo del esquema entra solo al prompt: variable automática `{{otros_parametros}}` (y se agrega al final si la plantilla no la usa).
- Quitar los íconos de la forma (nada hardcodeado en el formulario).
- Migración 16 con la plantilla v2 (no se edita la 15, ya aplicada en local).
- [x] T7 Backend: formato de imágenes, variables automáticas, otros_parametros, API sin lámina, migración plantilla v2 y contrato. (commit «imágenes descritas, otros parámetros…»)
- [x] T8 Front asesor: descripción y ubicación por imagen, copiado una por una, sin lámina ni íconos de forma. (commit «imágenes sueltas…»; sin verificar en navegador)
- [x] T9 Front administración: ubicaciones y sugerencias por parámetro de imágenes, parámetros sin usar en la plantilla. (commit «administración con ubicaciones…»; sin verificar en navegador)

## Ronda 3 (2026-10-26): plantilla en Supabase y sin hardcodeo
Decisiones del usuario:
- La plantilla de la imagen final la sube el usuario a Supabase (recursos). Trae la franja inferior con el diseño de la empresa, los espacios para los datos del asesor y el logo en la esquina superior derecha. El color de fondo lo decide el prompt.
- La marca de agua exacta queda pendiente (segunda etapa); el logo ya viene en la plantilla, así que se elimina el logo fijo del código.
- Nada hardcodeado: contenido de negocio y límites van a la tabla `prompt_ajustes` (pestaña «Ajustes» del admin); el front lee los límites de `GET /api/prompts/config` (una sola fuente). Los textos de interfaz y los mensajes de error se centralizan en archivos (`textos.js`, `mensajes.js`); solo los textos que el negocio querría ajustar viven en ajustes (`textos_asesor`).
- Los mensajes de error deben ser explicativos: qué falló (nombrando el campo), la regla con sus números y cómo corregirlo.
Diseño:
- Recursos fijos por producto en `esquema.recursos` (clave, etiqueta, descripcion, url, posicion inicio/fin, activo). Variable `{{recurso_<clave>}}` = «imagen N». La plantilla base es la imagen 1.
- El servidor entrega cada recurso por `GET /api/prompts/recursos/:productoId/:clave` (proxy de solo lectura; solo https del host de SUPABASE_URL o rutas `/assets/`), para no depender del CORS del bucket.
- Plantilla v3 en la migración 17 (la v2 queda archivada); el recurso `plantilla_base` se siembra inactivo y sin URL hasta que el usuario la suba.
- [x] T10 Backend: ajustes, config, recursos fijos, proxy, migración 17 y contrato. (commit «ajustes en base de datos, recursos fijos…»)
- [x] T11 Backend: mensajes de error centralizados y explicativos. (commit «catálogo central de mensajes…»; 146 claves)
- [x] T12 Front asesor: config, recursos, textos centralizados y errores explicativos. (commit «vista del asesor con configuración del servidor…»)
- [x] T13 Front administración: pestañas Recursos y Ajustes, config compartida, textos centralizados. (commit «administración con pestañas de recursos y ajustes…»)
- [x] T14 Documentación y verificación. (ci:sintaxis 262 archivos OK; pruebas puras de plantilla, ajustes, mensajes, textos y operaciones del editor; claves de límites del front verificadas contra el backend; sin verificar en navegador ni contra Supabase real)

## Ronda 4 (2026-10-26): reverso estricto
Hallazgo (prueba real con Gemini): el reverso salió con el diseño del frente. Causa probable: la frase «Diseña el reverso en armonía con el frente» invitaba a copiarlo, y la imagen del reverso llegó «sin descripción».
Decisión del usuario: el reverso es el espejo de la silueta del frente; lleva solo el diseño que se pide y, si no hay ninguno, es liso.
Diseño:
- Variables automáticas por grupo `grupo_<claveGrupo>_vacio`: verdadera cuando ningún parámetro visible del grupo (texto, texto_largo, numero, opciones, imagenes) tiene valor. Genéricas: la plantilla (dato) decide a qué grupo apuntan.
- Plantilla v5 en la migración 19: reverso con la misma silueta y solo lo indicado (o liso); regla de no agregar elementos no indicados. La v4 queda archivada. La migración se salta si ya hay otra versión publicada (el usuario edita su plantilla desde el admin).
- [x] T15 Variables `grupo_<clave>_vacio`, plantilla v5, migración 19, chips del editor y contrato. (commit «reverso estricto…»; t19 y pruebas anteriores OK; migración 19 sin ejecutar)

## Ronda 5 (2026-10-26): pruebas con Gemini
Decisiones del usuario: opción «Al corte», texto principal solo en el frente y regla en positivo (publicadas como v11 en su BD local); descripción de imagen obligatoria y configurable por parámetro (código + v12).
- [x] T16 Descripción obligatoria por parámetro de imágenes (commit «descripción obligatoria configurable…»; pruebas puras OK; sin verificar en navegador).
- [ ] T17 Prueba real en Gemini con el prompt generado, aprobación del usuario y documento de hallazgos.

## Ronda 6 (2026-10-27): ajustes de UI/UX y primer push
Rama publicada en origin (31 commits). Regla del usuario: todo cambio no experimental se commitea y se pushea a `module/generador-prompts`.
Decisiones del usuario (solo estos cambios):
- La pestaña «Nueva propuesta» pasa a llamarse «Genera tu prompt».
- Se quita la tarjeta «Pie de la imagen» y la tarjeta «Resumen».
- El selector de producto pasa de chips a un combobox con el mismo diseño del portal.
- En «Prompt generado» el scroll no es de toda la pantalla: la ventana mantiene su alto y el scroll es interno en el apartado del prompt y en el de imágenes para pegar; menos padding en el aviso «Abre un chat nuevo…».
- [x] T18 UI/UX del módulo según la lista anterior. (commit «pestaña Genera tu prompt, combobox…»; reutiliza public/js/menuCascada.js; layout y combobox sin verificar en navegador)
- [x] T19 Compactar «Prompt generado» para 1366x768: botón y contador de copiar en el encabezado del prompt, botón guiado dentro de la tarjeta de imágenes, menos padding, sin tarjeta de imágenes si no hay imágenes, piso de alto 34rem (commit «compactar la pantalla del prompt generado…»; alturas sin verificar en navegador).

## Checks
Sin suite de tests (excepción a RED/GREEN): `node --check` en todo JS tocado y comprobaciones con `node -e` de las funciones puras (validación de esquema, render de plantilla). El servidor lo levanta el usuario; las migraciones no se ejecutan contra bases reales desde aquí.

## Route declaration
- T1 a T5: delegated direct (un escritor por tarea, varias carpetas y archivos no triviales), tras un mapeo de patrones por un explorador de solo lectura.

## Progreso
T0, T1 y T2 hechas. Contrato técnico en .agents/modulos/generador de prompts/documentacion/esquema_y_contrato.md. Verificado: node --check y 40 aserciones de funciones puras (plantilla y esquema); la migración no se ejecutó (la corre el usuario con npm run migrate). T3 hecha (ci:sintaxis 236 archivos OK; calcularLayout probado; comportamiento en navegador sin verificar). T4 hecha (ci:sintaxis 245 archivos OK; esquemaOps probado; navegador sin verificar). Todas las tareas hechas. Falta la prueba manual en el navegador (el usuario corre npm run migrate, reinicia el servidor y vuelve a iniciar sesión). Sin push.
