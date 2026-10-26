# Esquema, plantilla y contrato de API del Generador de Prompts

Fuente única para backend, frontend y administración. Si algo cambia, se actualiza aquí primero.

## 1. Esquema de un producto (JSON)

```json
{ "esquema_version": 1, "grupos": [ { "clave": "frente", "etiqueta": "Parte frontal", "parametros": [ { "clave": "...", "etiqueta": "...", "tipo": "..." } ] } ] }
```

Campos comunes de un parámetro: `clave` (snake_case, única en el producto, inmutable al publicar), `etiqueta`, `tipo`, `requerido` (bool), `ayuda` (texto corto), `visible_si` (`{ "parametro": "<clave>", "igual": <valor> }`).

| Tipo | Campos propios | Valor que envía el asesor |
|---|---|---|
| `texto` | `max_largo` (def. 150) | string |
| `texto_largo` | `max_largo` (def. 600), `separador` (opcional, p. ej. `","`) | string |
| `numero` | `min`, `max`, `unidad_de` (clave de un parámetro `opciones`), `defecto` | number |
| `opciones` | `opciones: [{valor, etiqueta, texto_prompt}]`, `defecto` | string (un `valor`) |
| `si_no` | `defecto` | boolean |
| `imagenes` | `max`, `max_mb`, `formatos` (`png`, `jpg`, `svg`, `webp`), `ubicaciones` (opcional: hasta 12 textos de 1 a 40 caracteres, únicos), `sugerencias` (opcional: hasta 12 textos de 1 a 60 caracteres, únicos) | no va en `valores`; va en `imagenes` como `[{ nombre, descripcion, ubicacion }]` |
| `calculado` | `igual_a` (clave de otro parámetro) | no se envía |

Reglas de validación del esquema (al guardar el borrador y al publicar):

- `clave` única por producto y con formato `^[a-z][a-z0-9_]{1,59}$`; `etiqueta` obligatoria.
- `visible_si.parametro`, `unidad_de` e `igual_a` deben apuntar a una clave existente, y no a sí mismo.
- `opciones` exige al menos una opción con `valor` único y `texto_prompt` no vacío.
- `imagenes`: `max` entre 1 y 20; `max_mb` entre 1 y 10; `ubicaciones` y `sugerencias`, si existen, son listas de hasta 12 textos únicos (40 y 60 caracteres como máximo). Las listas viven en el esquema para que el administrador las edite; el código no trae ninguna.
- Al publicar, además: al menos un parámetro y una plantilla válida (sección 3).

## 2. Validación de lo que envía el asesor

- Se rechazan claves desconocidas y se ignora todo parámetro oculto por `visible_si` o de tipo `calculado`.
- `requerido` aplica solo a parámetros visibles; para `imagenes` significa al menos una.
- `texto` y `texto_largo`: se recorta; no supera `max_largo`.
- `numero`: finito, dentro de `min` y `max`.
- `opciones`: debe ser un `valor` declarado. `si_no`: boolean.
- `imagenes[clave]`: arreglo que no supera `max` de objetos `{ nombre, descripcion, ubicacion }` (un string suelto se toma como `{ nombre }`):
  - `nombre`: 1 a 150 caracteres y extensión dentro de `formatos`.
  - `descripcion`: opcional, se recorta, hasta 120 caracteres.
  - `ubicacion`: opcional, se recorta. Si el parámetro define `ubicaciones`, debe ser una de ellas; si no define ninguna, se descarta.
  - La respuesta limpia conserva los objetos (sin los campos vacíos).

## 3. Plantilla del prompt

Texto con esta sintaxis, sin evaluar código y sin anidar bloques:

- `{{clave}}` inserta el valor formateado.
- `{{#si clave}}…{{/si}}` solo sale si la variable tiene valor.
- `{{#no clave}}…{{/no}}` solo sale si no lo tiene.

"Tiene valor": texto no vacío; número presente; opción elegida; `si_no` verdadero; `imagenes` con al menos un nombre; un parámetro oculto cuenta como sin valor.

Formato por tipo:

| Tipo | Se escribe como |
|---|---|
| `texto` | el texto recortado |
| `texto_largo` | el texto; con `separador`, cada frase entre comillas dobles y unidas por `, ` (`"run 4 life", "keep running"`) |
| `numero` | número sin ceros sobrantes (máx. 2 decimales) + espacio + `texto_prompt` de la unidad elegida (`7 cm`, `3 pulgadas`) |
| `opciones` | el `texto_prompt` de la opción |
| `si_no` | `sí` o `no` |
| `imagenes` | `imagen 1 (Logo del organizador; ubicación: Centro)`; sin ubicación: `imagen 1 (Logo del organizador)`; sin descripción: `imagen 1` (o `imagen 1 (ubicación: Centro)`). Varias, unidas por `, ` y la última por ` e `: `imagen 1 (A), imagen 2 (B) e imagen 3 (C)`. La ubicación se escribe tal como está en el esquema |
| `calculado` | el valor formateado del parámetro `igual_a` |

Variables automáticas (nombres reservados; no pueden ser clave de un parámetro):

| Variable | Valor |
|---|---|
| `asesor_nombre`, `asesor_telefono`, `asesor_correo` | datos de contacto del asesor |
| `total_imagenes` | `1 imagen` o `N imágenes`, contando el logo; siempre tiene valor |
| `lista_imagenes` | una línea por imagen en orden y al final el logo: `- Imagen 1 (parte frontal): Logo del organizador. Ubicación: Centro.` (etiqueta del grupo en minúsculas; `sin descripción` si falta; `Ubicación: x.` solo si existe) y `- Imagen N (marca de agua): logo de Grupo Premia.`; siempre tiene valor |
| `logo_marca_agua` | `imagen N`, el número del logo (el último) |
| `otros_parametros` | los parámetros visibles con valor que la plantilla no nombra (ver abajo); vacío si no queda ninguno |

`otros_parametros`: «nombrado» es aparecer como `{{clave}}`, `{{#si clave}}` o `{{#no clave}}`; el parámetro `unidad_de` de un `numero` nombrado y el `igual_a` de un `calculado` nombrado también cuentan como nombrados, y los `calculado` nunca se agregan. Formato, un encabezado por grupo con al menos un parámetro pendiente, en el orden del esquema:

```text
ESPECIFICACIONES ADICIONALES
EXTRA
- Nota del cliente: Entregar el viernes
- Empaque regalo: sí
```

Los valores se escriben igual que con `{{clave}}`. Si la plantilla no contiene `{{otros_parametros}}`, el sistema agrega una línea en blanco y `{{otros_parametros}}` al final antes de renderizar; así un grupo o parámetro nuevo del editor nunca queda fuera del prompt. En la vista previa de administración, `sinUsar` lista los parámetros (visibles o no, sin `calculado`) que la plantilla no nombra.

Reglas de render:

1. Los valores se insertan en una sola pasada: el texto del usuario nunca se vuelve a interpretar como plantilla.
2. Una línea que contenía una etiqueta `{{#si}}` o `{{#no}}` y quedó vacía se elimina completa.
3. Tres o más saltos de línea seguidos se reducen a dos.
4. Una variable inexistente impide publicar; en el render queda vacía.
5. El sistema antepone siempre el encabezado fijo y una línea en blanco.

Encabezado fijo (`ENCABEZADO_SISTEMA`):

```text
NUEVA INSTRUCCIÓN. Ignora por completo cualquier conversación, imagen o propuesta anterior y genera una imagen completamente nueva usando solo las especificaciones de este mensaje.
```

Numeración de las imágenes: no hay lámina; el asesor copia cada imagen por separado y luego el prompt. Se numeran de 1 en adelante recorriendo los parámetros `imagenes` visibles en el orden del esquema (grupos y parámetros) y, dentro de cada uno, en el orden de `imagenes[clave]`. El logo de marca de agua es siempre la última imagen.

## 4. Plantilla v2 de la medalla (optimizada para Gemini)

Criterios: referencias primero (cada imagen numerada y descrita, porque el modelo las asocia mejor por rol que por posición), luego la escena; pedir la imagen de forma explícita, formato 16:9, texto exacto entre comillas, fondo plano y redacción en positivo. Sin imágenes de listón, el modelo inventa un diseño con los colores de los logos.

La versión 1 (con lámina y `recuadro N`) pasó a la versión 2 mediante la migración `prompts_plantilla_v2` (archiva la v1 y publica la v2 solo si el producto no tiene ya una versión 2 ni otra versión publicada).

```text
IMÁGENES DE REFERENCIA
Adjunté {{total_imagenes}} en este orden. Son elementos reales del cliente: reprodúcelos con la mayor fidelidad posible (formas, colores y letras) y no los reemplaces ni los reinventes.
{{lista_imagenes}}

OBJETIVO
Con esas referencias, genera UNA sola imagen horizontal en formato 16:9, con calidad de fotografía de producto profesional, que muestre una MEDALLA vista de frente (cara izquierda) y de reverso (cara derecha), una al lado de la otra y a la misma escala.

PRODUCTO
Medalla {{forma}}{{#si relieve}} con relieve marcado{{/si}}{{#si textura}} y textura granulada fina{{/si}}.
Texto principal de la medalla: "{{evento}}".
Proporciones de referencia (tipo regla): ancho {{ancho}}, alto {{alto}}, argolla de {{argolla_ancho}} y listón de {{liston_ancho}}. Mantén estas proporciones; no necesitan estar a escala exacta. En formas irregulares, toma como medida el punto más alto y el más ancho.

FRENTE (cara izquierda)
{{#si frente_imagenes}}- Coloca {{frente_imagenes}}.{{/si}}
{{#si frente_frases}}- Frases exactas, con esta ortografía: {{frente_frases}}.{{/si}}
{{#si frente_indicaciones}}- Indicaciones de diseño: {{frente_indicaciones}}{{/si}}

REVERSO (cara derecha)
{{#si trasera_lisa}}- Reverso totalmente liso, sin grabados ni imágenes.{{/si}}
{{#si trasera_imagenes}}- Coloca {{trasera_imagenes}}.{{/si}}
{{#si trasera_frases}}- Frases exactas, con esta ortografía: {{trasera_frases}}.{{/si}}
{{#si trasera_indicaciones}}- Indicaciones de diseño: {{trasera_indicaciones}}{{/si}}
{{#no trasera_lisa}}- Diseña el reverso en armonía con el frente.{{/no}}

LISTÓN
{{#si liston_imagenes}}- Usa {{liston_imagenes}} como motivo del listón, repetido a lo largo de la cinta.{{/si}}
{{#no liston_imagenes}}- Diseña el listón con un diseño arbitrario que use los colores de los logos adjuntos.{{/no}}

{{otros_parametros}}

COMPOSICIÓN
- Fondo plano de un solo color que contraste con el metal y los colores de la medalla, sin degradados ni objetos adicionales.
- Iluminación suave de estudio, sombras suaves y detalle nítido del relieve.
- Cada cara completa y centrada en su mitad de la imagen, con el listón colgando de la argolla.

MARCA DE AGUA
- Coloca el logo de la {{logo_marca_agua}} junto con el texto exacto "Grupo Premia", como marca de agua discreta y semitransparente en la esquina superior derecha de la imagen, sin tapar la medalla.

PIE DE LA IMAGEN
- Al pie, una franja horizontal con los colores del logo de Grupo Premia y, en texto blanco apilado (uno debajo del otro):
{{asesor_nombre}}
{{#si asesor_telefono}}{{asesor_telefono}}{{/si}}
{{asesor_correo}}

IMPORTANTE
- El resultado es una MEDALLA, no una moneda, un trofeo ni una insignia.
- Escribe los textos exactamente como aparecen entre comillas.
```

## 5. Parámetros de la medalla (versiones 1 y 2)

La versión 2 usa el mismo esquema que la 1 más `ubicaciones` y `sugerencias` en los tres parámetros de imágenes (abajo).

Orden de grupos y parámetros (17):

1. **Datos generales** (`general`): `evento` (texto, requerido, «Nombre del evento o texto de la medalla»).
2. **Dimensiones** (`dimensiones`): `unidad` (opciones `cm` → «cm» y `pulg` → «pulgadas», defecto `cm`, requerido); `ancho` y `alto` (numero, `unidad_de: unidad`, min 0.5, max 60, defecto 7, requeridos); `argolla_ancho` (numero, `unidad_de: unidad`, min 0.3, max 10, defecto 2.5, requerido); `liston_ancho` (calculado, `igual_a: argolla_ancho`).
3. **Forma y acabado** (`acabados`): `forma` (opciones `cuadrada` → «cuadrada», `circular` → «circular», `irregular` → «de forma irregular»; defecto `circular`; requerido); `relieve` (si_no, defecto true); `textura` (si_no, defecto true).
4. **Parte frontal** (`frente`): `frente_imagenes` (imagenes, max 3, max_mb 5, png/jpg/svg/webp; v2: ubicaciones «Centro», «Arriba», «Abajo», «Izquierda», «Derecha», «Toda la cara (fondo)»; sugerencias «Logo del organizador», «Logo de patrocinador», «Imagen decorativa»); `frente_frases` (texto_largo, separador `,`); `frente_indicaciones` (texto_largo).
5. **Parte trasera** (`trasera`): `trasera_lisa` (si_no, defecto false); `trasera_imagenes`, `trasera_frases`, `trasera_indicaciones` (como el frente, con `visible_si: {parametro: trasera_lisa, igual: false}`; las sugerencias de `trasera_imagenes` en v2 son «Logo de patrocinador», «Ruta del recorrido», «Imagen decorativa»).
6. **Listón** (`liston`): `liston_imagenes` (imagenes, max 10, max_mb 5; v2: ubicaciones «Repetido a lo largo de la cinta», «En los extremos»; sugerencias «Patrón del listón», «Logo de patrocinador»).

## 6. Constantes del módulo

- Módulo: id `prompts`, nombre «Generador de Prompts», color `#0E7C7B`, ícono Ionicons `sparkles-outline`, ruta `/modules/prompts`.
- Logo de marca de agua: `/assets/logos/logotransparente.png`. Texto de marca de agua: `Grupo Premia`.
- Permisos: `prompts.ver`, `prompts.generar`, `prompts.administrar`. Asesor de Ventas (rol 2) y Supervisor de Ventas (rol 3): `ver` y `generar`. Administrador (rol 1): los tres.

## 7. API (`/api/prompts`, ya detrás de `requireAuth` y `requirePermission('prompts.ver')`)

Errores: `{ "error": "mensaje" }`; los de validación suman `campos: { clave: "mensaje" }`. Nunca 401 por reglas de negocio.

Asesor (`prompts.generar`):

| Ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /productos` | — | `[{ id, codigo, nombre, descripcion, version: { id, numero, esquema } }]` solo de productos `activo` con versión `publicada` |
| `GET /contacto` | — | `{ nombre, email, telefono }` (`telefono` es `null` si falta) |
| `POST /generar` | `{ productoId, valores: {clave: valor}, imagenes: {clave: [{nombre, descripcion, ubicacion}]}, sinTelefono: bool }` | `{ prompt, imagenes: [{numero, parametro, grupo, nombre, descripcion, ubicacion}], logo: {numero, url, descripcion}, totalImagenes, contacto }` |

- `imagenes` del resultado trae un elemento por imagen del asesor, ya numerado, y `logo` es la última imagen; `totalImagenes` las cuenta con el logo. No hay lámina: el frontend muestra cada imagen por separado para copiarla antes del prompt.
- `POST /generar` no escribe nada en la base. Si el usuario no tiene teléfono y `sinTelefono` no es `true`, responde 409 con `{ error, codigo: "TELEFONO_FALTANTE" }`. Con `sinTelefono: true`, `asesor_telefono` queda vacío.
- El contacto sale siempre de `req.user.id`; nunca del cuerpo.

Administración (`prompts.administrar`):

| Ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /admin/productos` | — | `[{ id, codigo, nombre, estado, numeroVigente, tieneBorrador, totalParametros, actualizadoEn }]` |
| `POST /admin/productos` | `{ codigo, nombre, descripcion }` | producto creado con `estado: borrador` y borrador de versión 1 vacío |
| `GET /admin/productos/:id` | — | `{ producto, borrador, publicada }` (cada versión: `{ id, numero, estado, esquema, plantilla }` o `null`) |
| `POST /admin/productos/:id/borrador` | — | crea el borrador copiando la versión publicada; 409 si ya existe |
| `PUT /admin/productos/:id/borrador` | `{ esquema, plantilla }` | guarda el borrador (valida la estructura del esquema) |
| `DELETE /admin/productos/:id/borrador` | — | descarta el borrador (no si es la única versión del producto) |
| `POST /admin/productos/:id/publicar` | — | valida esquema y plantilla; el borrador pasa a `publicada`, la anterior a `archivada`; un producto en `borrador` pasa a `activo` |
| `PATCH /admin/productos/:id/estado` | `{ estado: "activo" \| "inactivo" }` | `activo` exige una versión publicada |
| `POST /admin/previsualizar` | `{ esquema, plantilla, valores?, imagenes? }` | `{ prompt, imagenes, logo, totalImagenes, sinUsar: [{clave, etiqueta, grupo}], errores: [] }` con valores por defecto y un contacto de ejemplo si no se envían; si el esquema o la plantilla tienen errores, `prompt` es `""` y `errores` los lista (más `sinUsar` si se puede calcular) |

Estados en palabras completas: producto `borrador`, `activo`, `inactivo`; versión `borrador`, `publicada`, `archivada`.
