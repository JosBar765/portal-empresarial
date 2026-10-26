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
| `imagenes` | `max`, `max_mb`, `formatos` (`png`, `jpg`, `svg`, `webp`) | no va en `valores`; van solo los nombres en `imagenes` |
| `calculado` | `igual_a` (clave de otro parámetro) | no se envía |

Reglas de validación del esquema (al guardar el borrador y al publicar):

- `clave` única por producto y con formato `^[a-z][a-z0-9_]{1,59}$`; `etiqueta` obligatoria.
- `visible_si.parametro`, `unidad_de` e `igual_a` deben apuntar a una clave existente, y no a sí mismo.
- `opciones` exige al menos una opción con `valor` único y `texto_prompt` no vacío.
- `imagenes`: `max` entre 1 y 20; `max_mb` entre 1 y 10.
- Al publicar, además: al menos un parámetro y una plantilla válida (sección 3).

## 2. Validación de lo que envía el asesor

- Se rechazan claves desconocidas y se ignora todo parámetro oculto por `visible_si` o de tipo `calculado`.
- `requerido` aplica solo a parámetros visibles; para `imagenes` significa al menos una.
- `texto` y `texto_largo`: se recorta; no supera `max_largo`.
- `numero`: finito, dentro de `min` y `max`.
- `opciones`: debe ser un `valor` declarado. `si_no`: boolean.
- `imagenes[clave]`: arreglo de nombres (string 1 a 150 caracteres) que no supera `max` y cuya extensión está en `formatos`.

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
| `imagenes` | `recuadro 1 (logo.png)`; varias: `recuadro 1 (a.png), recuadro 2 (b.png) y recuadro 3 (c.png)` |
| `calculado` | el valor formateado del parámetro `igual_a` |

Variables automáticas: `asesor_nombre`, `asesor_telefono`, `asesor_correo` y `logo_marca_agua` (`recuadro N`, el último de la lámina).

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

Numeración de la lámina: los recuadros se numeran de 1 en adelante recorriendo los parámetros `imagenes` visibles en el orden del esquema (grupos y parámetros) y, dentro de cada uno, en el orden de `imagenes[clave]`. El logo de marca de agua es siempre el último recuadro.

## 4. Plantilla v1 de la medalla (optimizada para Gemini)

Criterios: pedir la imagen de forma explícita, formato 16:9, texto exacto entre comillas, indicaciones de ubicación, fondo plano, redacción en positivo y una lámina de referencia numerada.

```text
OBJETIVO
Genera UNA sola imagen horizontal en formato 16:9, con calidad de fotografía de producto profesional, que muestre una MEDALLA vista de frente (cara izquierda) y de reverso (cara derecha), una al lado de la otra y a la misma escala.

PRODUCTO
Medalla {{forma}}{{#si relieve}} con relieve marcado{{/si}}{{#si textura}} y textura granulada fina{{/si}}.
Texto principal de la medalla: "{{evento}}".
Proporciones de referencia (tipo regla): ancho {{ancho}}, alto {{alto}}, argolla de {{argolla_ancho}} y listón de {{liston_ancho}}. Mantén estas proporciones; no necesitan estar a escala exacta. En formas irregulares, toma como medida el punto más alto y el más ancho.

REFERENCIAS
Adjunto una lámina con recuadros numerados. Usa cada recuadro solo para lo que se indica abajo y reproduce los logos y elementos con fidelidad.

FRENTE (cara izquierda)
{{#si frente_imagenes}}- Incluye los elementos de {{frente_imagenes}}.{{/si}}
{{#si frente_frases}}- Frases exactas, con esta ortografía: {{frente_frases}}.{{/si}}
{{#si frente_indicaciones}}- Indicaciones de diseño: {{frente_indicaciones}}{{/si}}

REVERSO (cara derecha)
{{#si trasera_lisa}}- Reverso totalmente liso, sin grabados ni imágenes.{{/si}}
{{#si trasera_imagenes}}- Incluye los elementos de {{trasera_imagenes}}.{{/si}}
{{#si trasera_frases}}- Frases exactas, con esta ortografía: {{trasera_frases}}.{{/si}}
{{#si trasera_indicaciones}}- Indicaciones de diseño: {{trasera_indicaciones}}{{/si}}
{{#no trasera_lisa}}- Diseña el reverso en armonía con el frente.{{/no}}

LISTÓN
{{#si liston_imagenes}}- Usa {{liston_imagenes}} como motivo del listón, repetido a lo largo de la cinta.{{/si}}
{{#no liston_imagenes}}- Listón liso, en un color que combine con la medalla.{{/no}}

COMPOSICIÓN
- Fondo plano de un solo color que contraste con el metal y los colores de la medalla, sin degradados ni objetos adicionales.
- Iluminación suave de estudio, sombras suaves y detalle nítido del relieve.
- Cada cara completa y centrada en su mitad de la imagen, con el listón colgando de la argolla.

MARCA DE AGUA
- Coloca el logo del {{logo_marca_agua}} junto con el texto exacto "Grupo Premia", como marca de agua discreta y semitransparente en la esquina superior derecha de la imagen, sin tapar la medalla.

PIE DE LA IMAGEN
- Al pie, una franja horizontal con los colores del logo de Grupo Premia y, en texto blanco apilado (uno debajo del otro):
{{asesor_nombre}}
{{#si asesor_telefono}}{{asesor_telefono}}{{/si}}
{{asesor_correo}}

IMPORTANTE
- El resultado es una MEDALLA, no una moneda, un trofeo ni una insignia.
- Escribe los textos exactamente como aparecen entre comillas.
```

## 5. Parámetros de la medalla (versión 1)

Orden de grupos y parámetros (17):

1. **Datos generales** (`general`): `evento` (texto, requerido, «Nombre del evento o texto de la medalla»).
2. **Dimensiones** (`dimensiones`): `unidad` (opciones `cm` → «cm» y `pulg` → «pulgadas», defecto `cm`, requerido); `ancho` y `alto` (numero, `unidad_de: unidad`, min 0.5, max 60, defecto 7, requeridos); `argolla_ancho` (numero, `unidad_de: unidad`, min 0.3, max 10, defecto 2.5, requerido); `liston_ancho` (calculado, `igual_a: argolla_ancho`).
3. **Forma y acabado** (`acabados`): `forma` (opciones `cuadrada` → «cuadrada», `circular` → «circular», `irregular` → «de forma irregular»; defecto `circular`; requerido); `relieve` (si_no, defecto true); `textura` (si_no, defecto true).
4. **Parte frontal** (`frente`): `frente_imagenes` (imagenes, max 3, max_mb 5, png/jpg/svg/webp); `frente_frases` (texto_largo, separador `,`); `frente_indicaciones` (texto_largo).
5. **Parte trasera** (`trasera`): `trasera_lisa` (si_no, defecto false); `trasera_imagenes`, `trasera_frases`, `trasera_indicaciones` (como el frente, con `visible_si: {parametro: trasera_lisa, igual: false}`).
6. **Listón** (`liston`): `liston_imagenes` (imagenes, max 10, max_mb 5).

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
| `POST /generar` | `{ productoId, valores: {clave: valor}, imagenes: {clave: [nombres]}, sinTelefono: bool }` | `{ prompt, lamina: { items: [{numero, parametro, nombre}], logo: {numero, url} }, contacto }` |

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
| `POST /admin/previsualizar` | `{ esquema, plantilla, valores?, imagenes? }` | `{ prompt, errores: [] }` con valores por defecto y un contacto de ejemplo si no se envían |

Estados en palabras completas: producto `borrador`, `activo`, `inactivo`; versión `borrador`, `publicada`, `archivada`.
