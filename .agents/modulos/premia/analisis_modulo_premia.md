# Módulo PremIA — análisis y mockup (v2: armado por piezas visuales)

Estado: **solo diseño (mockup en Figma)**. No hay código, tablas ni permisos creados todavía.

- Figma: https://www.figma.com/design/cCSlgRIoujngb4xJVO2tGP (archivo «PremIA – Mockup», equipo personal de Andrés Ixcajoc)
- Páginas: **Componentes** (íconos, 19 ilustraciones de piezas `ilus/*`, botones, chips, sidebar, campos, badges, stepper, tarjetas de producto y de pieza, recurso descargable, zona de texto, opción visual de admin…), **Pantallas** (23 frames con prototipo clicable), **Flujo** (mapa de navegación).

## Idea

El asesor **arma el reconocimiento** eligiendo piezas con imágenes (estilo de medalla, tipo de vidrio, base de mármol o madera…), escribe los textos por zona y al final copia **el prompt y descarga los mockups elegidos**. Con eso genera en cualquier agente de IA la imagen de referencia que comparte con su cliente. El portal no genera imágenes ni recibe archivos del cliente: arma el prompt y entrega los recursos.

## Decisiones tomadas con el usuario

| Tema | Decisión |
|---|---|
| Quién genera | Asesores y Supervisores |
| Quién configura | Administrador: catálogo visual (imágenes y piezas), textos del prompt, plantillas |
| Armado | Por piezas: cada producto tiene piezas (trofeo: cuerpo, base, placa, material y acabado, medidas) y cada pieza tiene opciones con imagen |
| Vista previa | Panel «Tu reconocimiento» con miniaturas de las piezas elegidas + prompt en vivo (sin imagen compuesta) |
| Textos | Por **zona del producto** (trofeo: placa frontal, frente de la base, dedicatoria); el prompt dice dónde va cada texto |
| Archivos | Los **mockups elegidos** se numeran solos (Archivo 1…n) y se descargan (.zip o individual); los archivos del cliente (logo) van en un checklist, sin subirse al portal |
| Pasos (6) | 1 Producto → 2 Diseño → 3 Textos y colores → 4 Estilo de imagen → 5 Archivos → 6 Revisión |
| Idioma | **Solo español.** Sin selector ES/EN ni textos en inglés en el catálogo |
| Compartir | Con usuarios específicos («Compartidos conmigo») |
| Extras | Historial (con miniaturas), plantillas que precargan piezas, favoritos |
| Imágenes del mockup | Ilustraciones vectoriales planas (placeholders). Las imágenes reales las sube el admin en el catálogo visual |

## Línea visual

Tokens de `public/css/global.css` como variables de Figma («Tokens PremIA»). Sidebar oscuro y header iguales al shell de `public/modules/admin/index.html`. Acento del módulo: **teal `#0E7C7B`** (`reglas_disenoUI.md` §2.6); botones primarios en `--color-primary-dark`, selección en `--color-primary`.

## Pantallas

| # | Pantalla | Rol |
|---|---|---|
| 01 | Dashboard del portal (card PremIA) | Todos |
| 02 | Inicio PremIA (plantillas con piezas, recientes, favoritos) | Asesor/Supervisor |
| 03 | Paso 1 Producto (tarjetas con ilustración) | Asesor/Supervisor |
| 04 | Paso 2 Diseño (piezas con imágenes, material, medidas) | Asesor/Supervisor |
| 05 | Paso 3 Textos y colores (zonas de texto, logo, colores, tipografía) | Asesor/Supervisor |
| 06 | Paso 4 Estilo de imagen (estilo, salida, fondo, ángulo, proporción) | Asesor/Supervisor |
| 07 | Paso 5 Archivos (mockups numerados + archivos del cliente) | Asesor/Supervisor |
| 08 | Paso 6 Revisión y resultado (prompt, descargar mockups, compartir) | Asesor/Supervisor |
| 09 | Estados: validación, copiado/descargado, salir sin guardar, pieza sin elegir | Asesor/Supervisor |
| 10 | Plantillas | Asesor/Supervisor |
| 11 / 11b | Historial (menú de acciones) / vacío | Asesor/Supervisor |
| 12 | Detalle de prompt guardado (piezas y recursos) | Asesor/Supervisor |
| 13 | Favoritos | Asesor/Supervisor |
| 14 | Compartidos conmigo | Asesor/Supervisor |
| 15 | Modal Compartir | Asesor/Supervisor |
| 16 / 16b | Configuración de catálogos de texto (materiales, acabados, estilos, salidas, proporciones) / editar opción | Administrador |
| 17 / 17b | **Catálogo visual** (productos → piezas → opciones con imagen, zonas de texto) / subir imagen | Administrador |
| 18 | Gestionar plantillas (piezas preseleccionadas) | Administrador |
| 19 / 20 | Móvil 390 px: Paso 2 Diseño y Resultado con descargas | Asesor/Supervisor |

## Estructura del prompt (ejemplo ES)

1. Qué crear: salida + producto + piezas elegidas (texto ES de cada opción del catálogo) + material, acabado y medidas; los Archivos 1–3 se citan como referencia visual de cada pieza.
2. Textos grabados por zona.
3. Colores y uso de los archivos del cliente (Archivo 4 = logo, Archivo 5 = escudo…).
4. Estilo, fondo, ángulo, iluminación, proporción, restricciones y número de variantes.

Cada opción del catálogo (visual y de texto) guarda un único texto en español para el prompt.

## Pendiente para implementar (no decidido)

- Modelo de datos: productos → piezas → opciones visuales (imagen, nombre, texto para el prompt, orden, activo); zonas de texto por producto (nombre, ayuda, máx. caracteres); catálogos de texto; plantillas con piezas preseleccionadas; prompts guardados con piezas elegidas, textos por zona, borrador, favorito y comparticiones. Seguir `.agents/reglas/reglas_modulo.md`.
- Imágenes del catálogo visual en Supabase Storage (ya usado en el portal). Los archivos del cliente siguen sin subirse.
- Descarga en .zip: generarla en servidor o en el navegador.
- Permisos propuestos: `premia.ver`, `premia.crear`, `premia.compartir`, `premia.admin`; registrar en `src/core/permissions/modulesCatalog.js` (id `premia`, color `#0E7C7B`, ícono `sparkles-outline`).
- Dónde vive el borrador; quién ve el historial global.
- Piezas obligatorias vs opcionales por producto (el estado «Falta elegir una pieza» asume que Base es obligatoria en Trofeo).
