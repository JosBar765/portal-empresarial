# Esquema, reglas y contrato de API del Generador de Prompts

Fuente única para backend, frontend y administración. Si algo cambia, se actualiza aquí primero.

Principio: en el código no queda contenido de negocio ni límites numéricos. El contenido y los límites viven en la tabla de ajustes globales `prompt_ajustes` (sección 7) y el frontend los lee de `GET /config`. En el código solo quedan los tipos de parámetro (cada tipo es un comportamiento), las expresiones regulares que definen la estructura de claves y códigos, los códigos de permiso, las rutas, los nombres de tablas, los estados, los NOMBRES de las variables automáticas y la FORMA de cada ajuste.

## 1. Esquema de un producto (JSON)

```json
{ "esquema_version": 1, "grupos": [ { "clave": "frente", "etiqueta": "Parte frontal", "parametros": [ { "clave": "...", "etiqueta": "...", "tipo": "..." } ] } ], "recursos": [ { "clave": "plantilla_base", "etiqueta": "Plantilla base", "descripcion": "...", "url": "https://...", "posicion": "inicio", "activo": true } ], "reglas": [ { "clave": "marca_de_agua", "etiqueta": "Marca de agua", "texto": "...", "posicion": "fin", "activo": true } ] }
```

Campos comunes de un parámetro: `clave` (snake_case, única en el producto, inmutable al publicar), `etiqueta`, `tipo`, `requerido` (bool), `ayuda` (texto corto), `visible_si` (`{ "parametro": "<clave>", "igual": <valor> }`).

Los números entre paréntesis son el valor inicial del ajuste `limites` indicado; el código nunca los escribe.

| Tipo | Campos propios | Valor que envía el asesor |
|---|---|---|
| `texto` | `max_largo` (def. `texto_max_largo_defecto`, 150) | string |
| `texto_largo` | `max_largo` (def. `texto_largo_max_largo_defecto`, 600), `separador` (opcional, p. ej. `","`) | string |
| `numero` | `min`, `max`, `unidad_de` (clave de un parámetro `opciones`), `defecto` | number |
| `opciones` | `opciones: [{valor, etiqueta, texto_prompt}]`, `defecto` | string (un `valor`) |
| `si_no` | `defecto` | boolean |
| `imagenes` | `max` (def. `imagenes_max_defecto`, 3), `max_mb` (def. `imagenes_mb_defecto`, 5), `formatos` (claves de `formatos_imagen`; sin ellas, todos), `ubicaciones` (opcional: hasta `lista_max_items` textos de 1 a `ubicacion_max` caracteres, únicos), `sugerencias` (opcional: hasta `lista_max_items` textos de 1 a `sugerencia_max` caracteres, únicos), `descripcion_requerida` (opcional, booleano; por defecto falso) | no va en `valores`; va en `imagenes` como `[{ nombre, descripcion, ubicacion }]` |
| `calculado` | `igual_a` (clave de otro parámetro) | no se envía |

### Cómo agregar un tipo de parámetro

El comportamiento de cada tipo vive en un solo archivo de `src/modules/prompts/services/tipos/`; `esquemaService`, `plantillaService` y `promptsService` no ramifican por nombre de tipo, consultan el registro (`tipos/index.js`: `obtenerTipo(clave)`, `tipoDe(parametro)`, `clavesDeTipos()`).

1. Crear `tipos/<tipo>.js` con `module.exports = definirTipo({ clave: '<tipo>', ... })` (contrato completo y valores por defecto en `tipos/_base.js`).
2. Sumar UNA línea `require('./<tipo>')` a `DEFINICIONES` en `tipos/index.js`. El orden de la lista es el de los mensajes («Elige uno de estos: ...»).

La definición declara solo lo propio del tipo:

- `validarEsquema(p, ctx)`: errores de sus campos propios y límites (los límites salen de `ajustes.limites`; los textos, de `mensajes.js`).
- `validarValor(p, crudo, ctx)`: devuelve `{ valor }` limpio, `{ error }` o `{}` si falta un dato opcional (`faltante(p)` aplica `requerido`).
- `formatear(p, crudo, ctx, profundidad)`: texto del valor en el prompt, con las frases de `textos_prompt` (`ctx.t`, `ctx.T`); `''` si no hay valor.
- `tieneValor(...)`: opcional; por defecto, que `formatear` no devuelva `''`. Lo usan `{{#si}}`, `{{#no}}`, `grupo_<g>_vacio` y `otros_parametros`.
- `destino`: `'valores'` (por defecto), `'imagenes'` (viaja en `imagenes` y aporta imágenes numeradas con `adjuntos`) o `'ninguno'` (no se envía, como `calculado`).
- Peculiaridades como propiedades: `cuentaParaGrupoVacio` (si cuenta para `grupo_<g>_vacio`; `si_no` y `calculado` no), `enOtrosParametros`, `ofreceUnidades` (puede ser el destino de `unidad_de`), `valorAusente(p)` (valor sin envío ni defecto; `si_no` vale `false`), `referencias(p)` y `acompanantes(p)` (claves que un parámetro arrastra consigo).

Un tipo fuera del registro sigue dando el error `param.tipoInvalido` al validar el esquema. El frontend (`public/modules/prompts/js`: formulario del asesor y editor del esquema) todavía ramifica por tipo; un tipo nuevo se agrega ahí por separado.

Reglas de validación del esquema (al guardar el borrador y al publicar):

- `clave` única por producto y con formato `^[a-z][a-z0-9_]{1,59}$`; `etiqueta` obligatoria.
- `visible_si.parametro`, `unidad_de` e `igual_a` deben apuntar a una clave existente, y no a sí mismo.
- `opciones` exige al menos una opción con `valor` único y `texto_prompt` no vacío.
- `texto` y `texto_largo`: `max_largo` entre 1 y `max_largo_tope`; `separador` de 1 a `separador_max` caracteres.
- `imagenes`: `max` entre 1 y `imagenes_max_tope`; `max_mb` entre 1 y `imagenes_mb_tope`; `formatos` son claves de `formatos_imagen`; `ubicaciones` y `sugerencias`, si existen, son listas de textos únicos; `descripcion_requerida`, si existe, es booleano (si no, error `param.descripcionRequerida`). Las listas viven en el esquema para que el administrador las edite; el código no trae ninguna.
- Reglas específicas (`reglas`, ver abajo): estructura y límites al guardar; la sintaxis de cada texto (sección 3) también al guardar y al publicar.
- Al publicar, además: al menos un parámetro y al menos `recursos_min_publicar` recursos activos con URL válida (error bajo el campo `recursos` con el mínimo y la cantidad actual).

### Reglas específicas del producto (`reglas`)

Texto que el administrador escribe para ESTE producto y que viaja versionado con él. Es opcional y admite hasta `reglas_max` (30). Ya no existe una plantilla editable: el prompt se arma solo (sección 3) y las reglas lo enmarcan por delante y por detrás.

| Campo | Regla |
|---|---|
| `clave` | mismo formato que la de un parámetro; única entre reglas Y parámetros, grupos y recursos; no puede ser una variable automática, ni `recurso_<r>`, ni `grupo_<g>_vacio` |
| `etiqueta` | obligatoria, hasta `regla_etiqueta_max` (80) caracteres; nombra la regla en los mensajes y en la vista previa |
| `texto` | texto con la sintaxis de la sección 3 (variables, `{{#si}}`, `{{#no}}`, `recurso_<clave>`, `grupo_<g>_vacio`; sin anidar bloques); hasta `regla_texto_max` (3000) caracteres; no vacío si la regla está activa |
| `posicion` | `inicio` (después del encabezado y antes de lo generado) o `fin` (después de lo generado) |
| `activo` | booleano; solo una regla activa se renderiza |

Los errores nombran la regla por su etiqueta, por ejemplo: «En la regla «Marca de agua»: La variable «nada» no existe: …». Los errores de reglas se agrupan bajo el campo `reglas`.

### Recursos fijos (`recursos`)

Imágenes que siempre acompañan al prompt de un producto (por ejemplo, la plantilla de la imagen final con la franja del diseño de la empresa, los espacios para los datos del asesor y el logo arriba a la derecha). El administrador sube la imagen a Supabase y pega su URL pública. Es opcional y admite hasta `recursos_max` (10) recursos.

| Campo | Regla |
|---|---|
| `clave` | mismo formato que la de un parámetro; única entre parámetros Y recursos; no puede ser una variable automática; tampoco puede existir un parámetro llamado `recurso_<clave>`, ni una clave igual a `grupo_<g>_vacio` o al `recurso_<otro>` de otro recurso |
| `etiqueta` | obligatoria, hasta `recurso_etiqueta_max` (80) caracteres; es el «origen» en la lista de imágenes |
| `descripcion` | opcional, hasta `recurso_descripcion_max` (300) caracteres; se escribe en la lista de imágenes del prompt |
| `url` | texto; `https://…` (se lee con `new URL`) o una ruta que empiece por `/assets/` |
| `posicion` | `inicio` (se numera antes de las imágenes del asesor) o `fin` (después) |
| `activo` | booleano; solo un recurso activo se numera, se lista y se sirve |

Regla: `activo: true` exige una `url` válida; un recurso inactivo puede tener la URL vacía (espera su imagen). Los errores nombran el recurso y dicen cómo corregirlo, por ejemplo: «El recurso «Plantilla base» está activo pero no tiene URL. Pega la URL pública de la imagen en Supabase o desactívalo.» Los errores de recursos se agrupan bajo el campo `recursos`.

Numeración: recursos activos con `posicion: "inicio"` (en el orden del arreglo), luego las imágenes del asesor (orden del esquema) y al final los recursos activos con `posicion: "fin"`.

Variable `{{recurso_<clave>}}`: se escribe `imagen N` (formato `imagen_ref`) con el número del recurso; en `{{#si recurso_<clave>}}` solo cuenta como verdadera cuando el recurso está activo. Un nombre `recurso_x` que no corresponde a ningún recurso impide guardar la plantilla, con un mensaje que lista los recursos disponibles.

## 2. Validación de lo que envía el asesor

- Se rechazan claves desconocidas y se ignora todo parámetro oculto por `visible_si` o de tipo `calculado`.
- `requerido` aplica solo a parámetros visibles; para `imagenes` significa al menos una.
- `texto` y `texto_largo`: se recorta; no supera `max_largo`.
- `numero`: finito, dentro de `min` y `max`.
- `opciones`: debe ser un `valor` declarado. `si_no`: boolean.
- `imagenes[clave]`: arreglo que no supera `max` de objetos `{ nombre, descripcion, ubicacion }` (un string suelto se toma como `{ nombre }`):
  - `nombre`: 1 a `imagen_nombre_max` (150) caracteres y una extensión de alguno de los `formatos` del parámetro (cada formato aporta las `extensiones` de `formatos_imagen`).
  - `descripcion`: opcional, se recorta, hasta `imagen_descripcion_max` (120) caracteres. Si el parámetro tiene `descripcion_requerida: true`, es obligatoria: una descripción ausente o solo de espacios falla con `valor.imagenDescripcionFalta`, que nombra el archivo y el parámetro y trae un ejemplo («Logo de Sportline, texto blanco en cursiva sobre fondo negro»). Sin la marca, `sin descripción` sigue permitido. El formulario del asesor aplica la misma regla antes de generar.
  - `ubicacion`: opcional, se recorta. Si el parámetro define `ubicaciones`, debe ser una de ellas; si no define ninguna, se descarta.
  - La respuesta limpia conserva los objetos (sin los campos vacíos).

## 3. Prompt autogenerado y sintaxis de las reglas

El prompt completo se arma siempre por un único camino (`renderizar` en `plantillaService`), sin plantilla editable:

1. `encabezado_sistema` (ajuste global).
2. Reglas activas con `posicion: "inicio"`, en el orden del esquema. Cada una se renderiza por separado; si queda vacía (todo condicional sin valor), se omite.
3. Sección generada, separada por una línea en blanco: (a) el bloque de imágenes, si hay alguna (`imagenes_titulo`, `imagenes_intro` con `{total}` y la `lista_imagenes` numerada); (b) la sección de parámetros (`extras_titulo`, y por cada grupo con datos su `extras_grupo` y una `extras_linea` por parámetro visible con valor, en el orden del esquema).
4. Reglas activas con `posicion: "fin"`.

Las partes se unen con una línea en blanco. Un parámetro que alguna regla activa nombra (`{{clave}}`, `{{#si clave}}` o `{{#no clave}}`) no se repite en la sección generada; tampoco las unidades (`unidad_de`) de los parámetros `numero` (la unidad ya acompaña al número) ni los `calculado`. Si una regla nombra `{{lista_imagenes}}`, el bloque de imágenes generado se omite; si nombra `{{otros_parametros}}`, esa regla es el lugar de la sección de parámetros y no se agrega otra. La numeración y el formato de cada dato son los de abajo.

El texto de cada regla usa esta sintaxis, sin evaluar código y sin anidar bloques:

- `{{clave}}` inserta el valor formateado.
- `{{#si clave}}…{{/si}}` solo sale si la variable tiene valor.
- `{{#no clave}}…{{/no}}` solo sale si no lo tiene.

"Tiene valor": texto no vacío; número presente; opción elegida; `si_no` verdadero; `imagenes` con al menos un nombre; un recurso solo si está activo; un parámetro oculto cuenta como sin valor.

Todo el texto que arma el código al formatear viene del ajuste `textos_prompt` (sección 7); abajo se muestra el valor inicial.

Formato por tipo:

| Tipo | Se escribe como |
|---|---|
| `texto` | el texto recortado |
| `texto_largo` | el texto; con `separador`, cada frase con `frase_comillas` y unidas con `frases_union` (`"run 4 life", "keep running"`) |
| `numero` | número sin ceros sobrantes (máx. 2 decimales) con `numero_unidad` y el `texto_prompt` de la unidad elegida (`7 cm`, `3 pulgadas`) |
| `opciones` | el `texto_prompt` de la opción |
| `si_no` | `si` o `no` de `textos_prompt` (`sí` / `no`) |
| `imagenes` | `imagen_ref` + `imagen_detalle`: `imagen 1 (Logo del organizador; ubicación: Centro)`; sin ubicación: `imagen 1 (Logo del organizador)`; sin descripción: `imagen 1` (o `imagen 1 (ubicación: Centro)`). Varias, unidas con `union` y la última con `union_final`: `imagen 1 (A), imagen 2 (B) e imagen 3 (C)`. La ubicación se escribe tal como está en el esquema |
| `calculado` | el valor formateado del parámetro `igual_a` |

Variables automáticas (nombres reservados; no pueden ser clave de un parámetro, de un recurso ni de un grupo):

| Variable | Valor |
|---|---|
| `asesor_nombre`, `asesor_telefono`, `asesor_correo` | datos de contacto del asesor |
| `total_imagenes` | `1 imagen` o `N imágenes` (`total_uno` / `total_varios`), contando recursos activos e imágenes del asesor; **cadena vacía si no hay ninguna** |
| `lista_imagenes` | una línea por imagen en orden de numeración, con `lista_linea`: `- Imagen 1 (Parte frontal): Logo del organizador. Ubicación: Centro.`. El origen es la etiqueta del grupo (imágenes del asesor) o la etiqueta del recurso; la descripción es la de la imagen o la del recurso, o `lista_sin_descripcion`; `lista_ubicacion` solo si hay ubicación. **Cadena vacía si no hay ninguna imagen** |
| `otros_parametros` | la sección de parámetros generada: los visibles con valor que ninguna regla nombra (ver abajo); vacío si no queda ninguno |
| `recurso_<clave>` | familia derivada de los recursos del esquema (ver sección 1); no es una variable fija |
| `grupo_<clave>_vacio` | familia derivada de los grupos del esquema, una por grupo (ver abajo); no es una variable fija |

Ya no existe `logo_marca_agua`: el logo viene dentro de la imagen de la plantilla (un recurso).

`grupo_<clave>_vacio` (una por grupo del esquema; la plantilla decide a qué grupo apunta, el código no sabe de ningún grupo concreto): es **verdadera cuando ningún parámetro visible del grupo de tipo `texto`, `texto_largo`, `numero`, `opciones` o `imagenes` tiene valor**, con la misma regla de «tiene valor» de `{{#si}}`. Los parámetros `si_no` y `calculado` se ignoran, y un parámetro oculto por `visible_si` cuenta como sin valor. Se usa en `{{#si grupo_x_vacio}}` y `{{#no grupo_x_vacio}}`; escrita como `{{grupo_x_vacio}}` se reemplaza por `sí` o `no` (ajustes `textos_prompt.si` / `textos_prompt.no`). Nombres reservados: ningún parámetro, recurso ni grupo puede tener una clave igual a `grupo_<g>_vacio` (de cualquier grupo) ni a `recurso_<r>` (de cualquier recurso); el esquema no se puede guardar y el mensaje dice qué variable choca y cómo corregirlo. Una plantilla que nombre `grupo_x_vacio` con un grupo `x` inexistente no se puede guardar: el mensaje lista los grupos disponibles. No afecta a `otros_parametros` ni a los parámetros «sin usar».

`otros_parametros` (la sección de parámetros generada): «nombrado» es aparecer como `{{clave}}`, `{{#si clave}}` o `{{#no clave}}`; el parámetro `unidad_de` de un `numero` nombrado y el `igual_a` de un `calculado` nombrado también cuentan como nombrados, y los `calculado` nunca se agregan. Formato: el título `extras_titulo` y, por cada grupo con al menos un parámetro pendiente (orden del esquema), su encabezado `extras_grupo` y una línea `extras_linea` por parámetro; el código no cambia mayúsculas ni minúsculas:

```text
ESPECIFICACIONES ADICIONALES
Extra
- Nota del cliente: Entregar el viernes
- Empaque regalo: sí
```

Los valores se escriben igual que con `{{clave}}`. Así un grupo o parámetro nuevo del editor nunca queda fuera del prompt. `sinUsar` de la vista previa ya no tiene sentido y se devuelve siempre vacío.

Reglas de render:

1. Los valores se insertan en una sola pasada: el texto del usuario nunca se vuelve a interpretar como plantilla ni como marcador.
2. Una línea que contenía una etiqueta `{{#si}}` o `{{#no}}` y quedó vacía se elimina completa.
3. Tres o más saltos de línea seguidos se reducen a dos.
4. Una variable inexistente en el texto de una regla impide guardar y publicar; en el render queda vacía.
5. El sistema antepone siempre el ajuste `encabezado_sistema` y una línea en blanco (el encabezado no se reformatea).

Numeración de las imágenes: no hay lámina; el asesor copia cada imagen por separado y luego el prompt. Orden: recursos activos `inicio`, imágenes del asesor (parámetros `imagenes` visibles en el orden del esquema y, dentro de cada uno, en el orden de `imagenes[clave]`) y recursos activos `fin`.

## 4. Plantilla v3/v4/v5 de la medalla (histórica: la plantilla editable se eliminó en T20; la migración `prompts_reglas` la parte en reglas)

Criterios: referencias primero (cada imagen numerada y descrita, porque el modelo las asocia mejor por rol que por posición), luego la escena; pedir la imagen de forma explícita, formato 16:9, texto exacto entre comillas, fondo plano y redacción en positivo. Sin imágenes de listón, el modelo inventa un diseño con los colores de los logos. Con el recurso `plantilla_base` activo, la imagen final se compone sobre la plantilla (franja inferior de la empresa, espacios para los datos del asesor y logo arriba a la derecha); inactivo, el prompt pide un fondo liso y una franja al pie.

La versión 2 pasó a la versión 3 mediante la migración `prompts_ajustes` (crea y siembra `prompt_ajustes`, archiva la v2 y publica la v3 solo si el producto no tiene ya una versión 3 ni otra versión publicada). Esa migración agrega el recurso `plantilla_base` **inactivo y sin URL**: el administrador sube la imagen a Supabase, pega la URL en la pestaña Recursos y lo activa. La versión 2 (con lámina, luego con logo de marca de agua) quedó en el historial.

La sección `MARCA DE AGUA` llegó en la **versión 4** (migración `prompts_marca_de_agua`: archiva la v3 y publica la v4 con el mismo esquema, solo si el producto no tiene ya una versión 4 ni otra versión publicada). Regla: la marca de agua es únicamente el texto «GRUPO PREMIA»; el logo de la empresa viene dentro de la imagen de la plantilla base y el prompt nunca lo agrega, lo repite ni lo modifica (cuando la plantilla base está activa, además prohíbe cualquier otro logo o símbolo como marca de agua).

El reverso estricto llegó en la **versión 5** (migración `prompts_reverso_estricto`: archiva la v4 y publica la v5 con el mismo esquema, solo si el producto no tiene ya una versión 5 ni otra versión publicada). Regla: el reverso es el espejo horizontal de la silueta del frente (misma forma, contorno, argolla y grosor) y lleva ÚNICAMENTE el diseño que se pidió; si no se pidió nada (o `trasera_lisa` está marcada), queda totalmente liso. La v4 decía «diseña el reverso en armonía con el frente» y la IA copiaba el frente; la v5 lo reemplaza con la variable `grupo_trasera_vacio` y agrega una línea en `IMPORTANTE` que prohíbe elementos no indicados. La plantilla de abajo es la v5.

```text
{{#si lista_imagenes}}IMÁGENES DE REFERENCIA{{/si}}
{{#si lista_imagenes}}Adjunté {{total_imagenes}} en este orden. Son elementos reales del cliente: reprodúcelos con la mayor fidelidad posible (formas, colores y letras) y no los reemplaces ni los reinventes.{{/si}}
{{lista_imagenes}}

BASE DE LA COMPOSICIÓN
{{#si recurso_plantilla_base}}- Usa la {{recurso_plantilla_base}} como lienzo de la imagen final: conserva sin cambios su franja inferior con el diseño de la empresa y el logo de la esquina superior derecha, y coloca las dos caras de la medalla en el área central.{{/si}}
{{#no recurso_plantilla_base}}- Compón la imagen sobre un fondo liso, sin elementos adicionales.{{/no}}
- El fondo del área central debe ser un color liso que contraste con el metal y los colores de la medalla, sin degradados ni objetos adicionales.

OBJETIVO
Genera UNA sola imagen horizontal en formato 16:9, con calidad de fotografía de producto profesional, que muestre una MEDALLA vista de frente (cara izquierda) y de reverso (cara derecha), una al lado de la otra y a la misma escala.

PRODUCTO
Medalla {{forma}}{{#si relieve}} con relieve marcado{{/si}}{{#si textura}} y textura granulada fina{{/si}}.
Texto principal de la medalla: "{{evento}}".
Proporciones de referencia (tipo regla): ancho {{ancho}}, alto {{alto}}, argolla de {{argolla_ancho}} y listón de {{liston_ancho}}. Mantén estas proporciones; no necesitan estar a escala exacta. En formas irregulares, toma como medida el punto más alto y el más ancho.

FRENTE (cara izquierda)
{{#si frente_imagenes}}- Coloca {{frente_imagenes}}.{{/si}}
{{#si frente_frases}}- Frases exactas, con esta ortografía: {{frente_frases}}.{{/si}}
{{#si frente_indicaciones}}- Indicaciones de diseño: {{frente_indicaciones}}{{/si}}

REVERSO (cara derecha)
- El reverso tiene exactamente la misma silueta, contorno, argolla y grosor que el frente: es su espejo horizontal visto por detrás. No cambies la forma.
{{#si grupo_trasera_vacio}}- La superficie del reverso es totalmente lisa: sin imágenes, textos, grabados ni elementos decorativos. No copies ni repitas el diseño del frente.{{/si}}
{{#no grupo_trasera_vacio}}- Sobre esa silueta coloca ÚNICAMENTE lo siguiente y nada más; no copies ni repitas el diseño del frente:{{/no}}
{{#si trasera_imagenes}}- Coloca {{trasera_imagenes}}.{{/si}}
{{#si trasera_frases}}- Frases exactas, con esta ortografía: {{trasera_frases}}.{{/si}}
{{#si trasera_indicaciones}}- Indicaciones de diseño: {{trasera_indicaciones}}{{/si}}

LISTÓN
{{#si liston_imagenes}}- Usa {{liston_imagenes}} como motivo del listón, repetido a lo largo de la cinta.{{/si}}
{{#no liston_imagenes}}- Diseña el listón con un diseño arbitrario que use los colores de los logos adjuntos.{{/no}}

{{otros_parametros}}

COMPOSICIÓN
- Iluminación suave de estudio, sombras suaves y detalle nítido del relieve.
- Cada cara completa y centrada en su mitad del área central, con el listón colgando de la argolla.

MARCA DE AGUA
- Coloca como marca de agua únicamente el texto exacto "GRUPO PREMIA", en letras mayúsculas, discreto y semitransparente, en la parte baja del área central, sin tapar la medalla ni la franja inferior de la plantilla.
{{#si recurso_plantilla_base}}- No agregues ningún otro logo ni símbolo como marca de agua: el logo de la empresa ya está en la plantilla y no debe repetirse ni modificarse.{{/si}}

PIE DE LA IMAGEN
{{#si recurso_plantilla_base}}- Escribe en los espacios de la franja inferior de la plantilla, en texto blanco y uno debajo del otro:{{/si}}
{{#no recurso_plantilla_base}}- Al pie, una franja horizontal con los colores del logo de Grupo Premia y, en texto blanco apilado (uno debajo del otro):{{/no}}
{{asesor_nombre}}
{{#si asesor_telefono}}{{asesor_telefono}}{{/si}}
{{asesor_correo}}

IMPORTANTE
- El resultado es una MEDALLA, no una moneda, un trofeo ni una insignia.
- No agregues textos, logos, símbolos ni elementos decorativos que no estén indicados en este mensaje, ni en el frente ni en el reverso.
- Escribe los textos exactamente como aparecen entre comillas.
```

**Conversión de las plantillas existentes (migración `prompts_reglas`).** Cada versión que tenga plantilla y aún no tenga `reglas` se parte en reglas del esquema, una por párrafo (separados por línea en blanco), todas en posición `inicio` y con el texto intacto (misma sintaxis `{{…}}`). Un bloque `{{#si}}…{{/si}}` que abarque varios párrafos queda en una sola regla; con más de 30 párrafos el resto se suma a la regla 30 (`reglas_max`). Clave `bloque_NN`; etiqueta: el encabezado del párrafo si es una sola línea corta sin variables (un encabezado todo en mayúsculas pasa a «Mayúscula inicial»), o «Bloque NN». El administrador las renombra después. Como las reglas `inicio` conservan el orden y las que nombran `{{lista_imagenes}}` y `{{otros_parametros}}` suprimen la sección generada, el prompt resultante es idéntico al de la plantilla (verificado con el código previo a T20 en la v18 local y en la v5 de producción). Una plantilla que no nombrara `{{lista_imagenes}}` mostraría ahora el bloque generado de imágenes al final: es la única diferencia posible. La versión publicada no se modifica: se publica una versión nueva (número siguiente) con el esquema anterior más las reglas y la anterior pasa a `archivada`; un borrador se convierte en su lugar (puede quedar con un número menor que la nueva publicada, sin efecto). La plantilla original sigue en la columna deprecada de las versiones archivadas. Requiere funciones de ventana y `JSON_MERGE_PATCH`: MySQL 8 o MariaDB 10.3.15 / 10.4 en adelante.

**Medalla inicial (migración `prompts_medalla_inicial`).** Publica como versión nueva de la Medalla el esquema de la v20 local del dueño (recurso `plantilla_base` inactivo y con `url` vacía; lo demás idéntico) y archiva la anterior, solo si la publicada es la que dejó `prompts_reglas` (única publicada, plantilla vacía, reglas `bloque_NN`, ninguna archivada sin plantilla y la archivada más reciente es la v5 de `prompts_reverso_estricto` por huella SHA-256); un borrador se conserva intacto. También lleva `encabezado_sistema` al texto vigente solo si conserva exactamente el sembrado por `prompts_ajustes`.

## 5. Parámetros de la medalla (versiones 1 a 5; la 4 y la 5 usan el esquema de la 3)

La versión 2 usa el mismo esquema que la 1 más `ubicaciones` y `sugerencias` en los tres parámetros de imágenes (abajo). La versión 3 suma el recurso `plantilla_base` (etiqueta «Plantilla base», descripción «plantilla de la imagen final, con la franja inferior del diseño de la empresa, los espacios para los datos del asesor y el logo en la esquina superior derecha», `posicion: "inicio"`, `activo: false`, `url` vacía).

Orden de grupos y parámetros (17):

1. **Datos generales** (`general`): `evento` (texto, requerido, «Nombre del evento o texto de la medalla»).
2. **Dimensiones** (`dimensiones`): `unidad` (opciones `cm` → «cm» y `pulg` → «pulgadas», defecto `cm`, requerido); `ancho` y `alto` (numero, `unidad_de: unidad`, min 0.5, max 60, defecto 7, requeridos); `argolla_ancho` (numero, `unidad_de: unidad`, min 0.3, max 10, defecto 2.5, requerido); `liston_ancho` (calculado, `igual_a: argolla_ancho`).
3. **Forma y acabado** (`acabados`): `forma` (opciones `cuadrada` → «cuadrada», `circular` → «circular», `irregular` → «de forma irregular»; defecto `circular`; requerido); `relieve` (si_no, defecto true); `textura` (si_no, defecto true).
4. **Parte frontal** (`frente`): `frente_imagenes` (imagenes, max 3, max_mb 5, png/jpg/svg/webp; v2: ubicaciones «Centro», «Arriba», «Abajo», «Izquierda», «Derecha», «Toda la cara (fondo)»; sugerencias «Logo del organizador», «Logo de patrocinador», «Imagen decorativa»); `frente_frases` (texto_largo, separador `,`); `frente_indicaciones` (texto_largo).
5. **Parte trasera** (`trasera`): `trasera_lisa` (si_no, defecto false); `trasera_imagenes`, `trasera_frases`, `trasera_indicaciones` (como el frente, con `visible_si: {parametro: trasera_lisa, igual: false}`; las sugerencias de `trasera_imagenes` en v2 son «Logo de patrocinador», «Ruta del recorrido», «Imagen decorativa»).
6. **Listón** (`liston`): `liston_imagenes` (imagenes, max 10, max_mb 5; v2: ubicaciones «Repetido a lo largo de la cinta», «En los extremos»; sugerencias «Patrón del listón», «Logo de patrocinador»).

## 6. Constantes del módulo

- Módulo: id `prompts`, nombre «Generador de Prompts», color `#0E7C7B`, ícono Ionicons `sparkles-outline`, ruta `/modules/prompts`.
- Permisos: `prompts.ver`, `prompts.generar`, `prompts.administrar`. Asesor de Ventas (rol 2) y Supervisor de Ventas (rol 3): `ver` y `generar`. Administrador (rol 1): los tres.
- Ya no existen en el código el logo ni el texto de marca de agua: el logo viene en la imagen de la plantilla (recurso).

## 7. Ajustes globales (`prompt_ajustes`)

Tabla `prompt_ajustes` (`clave` PK, `valor` JSON, `descripcion`, `actualizado_en`), creada y sembrada por la migración `prompts_ajustes` (no pisa lo que el administrador ya editó); `marca_de_agua` la siembra la migración `prompts_ajuste_marca_de_agua`. Los siete ajustes son obligatorios: si falta alguno el servicio responde un error que indica cuál y que hay que aplicar la migración; nunca usa un valor por defecto del código. Se leen en cada petición (sin caché). El administrador los edita con `PUT /admin/ajustes/:clave`; cada valor se valida contra su forma (el código valida la FORMA, el contenido es del administrador).

| Clave | Qué controla | Forma |
|---|---|---|
| `encabezado_sistema` | Instrucción que se antepone a todo prompt | texto no vacío |
| `textos_prompt` | Frases que arma el código dentro del prompt | objeto con exactamente las 21 claves siguientes |
| `limites` | Límites numéricos | objeto con exactamente las 26 claves de abajo, enteros ≥ 1 |
| `formatos_imagen` | Formatos de imagen admitidos | objeto `{ <formato>: { extensiones: [..], mime } }` |
| `textos_asesor` | Avisos y notas que ve el asesor | objeto con exactamente 4 textos |
| `contacto_ejemplo` | Datos del asesor en la vista previa del administrador | `{ nombre, correo, telefono }` |
| `marca_de_agua` | Marca de agua que el asesor aplica a una imagen en su navegador | `{ texto, logo_url, opacidad, angulo, escala, separacion, color }` |

`textos_prompt` (marcadores entre llaves simples; todos los obligatorios deben aparecer y no se admiten otros):

| Clave | Valor inicial | Marcadores |
|---|---|---|
| `imagen_ref` | `imagen {numero}` | `{numero}` |
| `imagen_detalle` | ` ({detalle})` | `{detalle}` |
| `detalle_ubicacion` | `ubicación: {ubicacion}` | `{ubicacion}` |
| `detalle_union` | `; ` | ninguno |
| `union` | `, ` | ninguno |
| `union_final` | ` e ` | ninguno |
| `lista_linea` | `- Imagen {numero} ({origen}): {descripcion}.{ubicacion}` | `{numero}`, `{origen}`, `{descripcion}` obligatorios; `{ubicacion}` opcional |
| `lista_ubicacion` | ` Ubicación: {ubicacion}.` | `{ubicacion}` |
| `lista_sin_descripcion` | `sin descripción` | ninguno |
| `total_uno` | `{n} imagen` | `{n}` |
| `total_varios` | `{n} imágenes` | `{n}` |
| `si` / `no` | `sí` / `no` | ninguno |
| `frase_comillas` | `"{frase}"` | `{frase}` |
| `frases_union` | `, ` | ninguno |
| `numero_unidad` | `{valor} {unidad}` | `{valor}`, `{unidad}` |
| `extras_titulo` | `ESPECIFICACIONES ADICIONALES` | ninguno |
| `extras_grupo` | `{grupo}` | `{grupo}` |
| `extras_linea` | `- {etiqueta}: {valor}` | `{etiqueta}`, `{valor}` |
| `imagenes_titulo` | `IMÁGENES DE REFERENCIA` | ninguno |
| `imagenes_intro` | `Adjunté {total} en este orden. Son elementos reales del cliente: reprodúcelos con la mayor fidelidad posible (formas, colores y letras) y no los reemplaces ni los reinventes.` | `{total}` (el texto de `total_imagenes`, p. ej. `2 imágenes`) |

La migración `prompts_reglas` siembra `imagenes_titulo` e `imagenes_intro` (los textos de la plantilla vigente: con ellos, la sección generada de imágenes queda igual a la que escribía la plantilla) y los límites nuevos de abajo. Solo agrega las claves que faltan, sin pisar lo que el administrador ya editó (`JSON_MERGE_PATCH` con los valores iniciales como base y el valor guardado encima: vale igual en MySQL y MariaDB y repetirla no cambia nada). Hasta aplicarla, la tabla existente no trae esas claves y el servicio avisa que falta.

`limites` (valor inicial): `gemini_max_imagenes` 14; `plantilla_max_largo` 50000; `texto_max_largo_defecto` 150; `texto_largo_max_largo_defecto` 600; `max_largo_tope` 5000; `separador_max` 5; `imagenes_max_defecto` 3; `imagenes_max_tope` 20; `imagenes_mb_defecto` 5; `imagenes_mb_tope` 10; `imagen_nombre_max` 150; `imagen_descripcion_max` 120; `lista_max_items` 12; `ubicacion_max` 40; `sugerencia_max` 60; `producto_nombre_max` 100; `producto_descripcion_max` 255; `recurso_max_mb` 8; `recurso_timeout_ms` 10000; `recursos_max` 10; `recurso_etiqueta_max` 80; `recurso_descripcion_max` 300; `regla_etiqueta_max` 80; `regla_texto_max` 3000; `reglas_max` 30; `recursos_min_publicar` 1 (los siembra la migración `prompts_reglas`). `plantilla_max_largo` queda sin uso (deprecado) pero sigue en la forma. Validación: `recursos_min_publicar` no supera `recursos_max`; cada `*_defecto` no supera su `*_tope` (`texto_max_largo_defecto` y `texto_largo_max_largo_defecto` con `max_largo_tope`); `producto_nombre_max` ≤ 100 y `producto_descripcion_max` ≤ 255 (tamaño de las columnas); `imagenes_mb_tope` ≤ 20; `recurso_timeout_ms` entre 1000 y 60000.

`formatos_imagen` (valor inicial): `png` (`png`, `image/png`), `jpg` (`jpg`, `jpeg`, `image/jpeg`), `svg` (`svg`, `image/svg+xml`), `webp` (`webp`, `image/webp`). Validación: al menos un formato; clave `^[a-z0-9]{2,10}$`; `extensiones` lista no vacía de minúsculas y números sin punto; `mime` con `^image/[a-z0-9.+-]+$`.

`textos_asesor` (valor inicial): `aviso_pegado` (cómo pegar imágenes y prompt en un chat nuevo), `aviso_exceso_imagenes` (marcadores obligatorios `{limite}` y `{total}`: «Gemini admite hasta {limite} imágenes de referencia y este pedido tiene {total}. Quita algunas imágenes para mejores resultados.»), `nota_prompt_nuevo`, `nota_orden_imagenes`.

`contacto_ejemplo` (valor inicial): `nombre` «Nombre Apellido», `correo` «asesor@grupopremia.com», `telefono` «+502 5555 5555» (`nombre` y `correo` obligatorios; `telefono` puede quedar vacío).

`marca_de_agua` (valor inicial, lo siembra `prompts_ajuste_marca_de_agua` solo si no existe): `texto` «GRUPO PREMIA» (texto no vacío de hasta 60 caracteres); `logo_url` `/assets/logos/LOGO_GP_isotipo.png` (ruta `/assets/` sin `..` o `https` del host exacto de `SUPABASE_URL`, la misma regla de los recursos; si `SUPABASE_URL` no está configurado solo se acepta `/assets/`); `opacidad` 0.18 (de 0.05 a 0.6); `angulo` -30 (grados, de -90 a 90); `escala` 0.3 (ancho de cada baldosa relativo al lado menor de la imagen, de 0.1 a 0.8); `separacion` 1.5 (espacio entre baldosas en altos de baldosa, de 0.5 a 5); `color` `#FFFFFF` (hexadecimal de 6 cifras con `#`). El contorno del texto no es un ajuste: se deriva del color (negro para un color claro, blanco para uno oscuro), así el texto se lee sobre fondos claros y oscuros. Cada baldosa es el logo y, a su derecha, el texto; se repite en filas alternadas (ladrillo) girada `angulo` grados y cubre toda la imagen. Como es obligatorio, sin esa migración `GET /config` y `POST /generar` responden 500 con el mensaje que pide aplicar `prompts_ajuste_marca_de_agua` (el asesor no puede generar), la pestaña Ajustes no muestra su tarjeta y guardarlo responde el mismo error.

## 8. API (`/api/prompts`, ya detrás de `requireAuth` y `requirePermission('prompts.ver')`)

Errores: `{ "error": "mensaje" }`; los de validación suman `campos: { clave: "mensaje" }`. Nunca 401 por reglas de negocio.

Asesor (`prompts.generar`):

| Ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /config` | — | `{ limites, formatosImagen, textosAsesor, marcaDeAgua, variablesAutomaticas }`: `limites` = ajuste `limites`; `formatosImagen` = `formatos_imagen`; `textosAsesor` = `textos_asesor`; `marcaDeAgua` = `marca_de_agua` (el navegador del asesor compone la marca: la imagen no se sube ni se guarda); `variablesAutomaticas` = nombres fijos del código (`asesor_nombre`, `asesor_telefono`, `asesor_correo`, `total_imagenes`, `lista_imagenes`, `otros_parametros`). El frontend toma de aquí todos los límites y formatos |
| `GET /productos` | — | `[{ id, codigo, nombre, descripcion, version: { id, numero, esquema } }]` solo de productos `activo` con versión `publicada` (el esquema incluye `recursos`) |
| `GET /contacto` | — | `{ nombre, email, telefono }` (`telefono` es `null` si falta) |
| `POST /generar` | `{ productoId, valores: {clave: valor}, imagenes: {clave: [{nombre, descripcion, ubicacion}]}, sinTelefono: bool }` | `{ prompt, imagenes: [ … ], totalImagenes, contacto }` (sin `logo` ni `lamina`) |
| `GET /recursos/:productoId/:clave` | — | la imagen del recurso (ver abajo) |

Elementos de `imagenes` (en orden de numeración, ya numerados):

- Del asesor: `{ numero, origen: "asesor", parametro, grupo, nombre, descripcion, ubicacion }`.
- De un recurso: `{ numero, origen: "recurso", clave, etiqueta, descripcion, url }`; `url` es `/api/prompts/recursos/<productoId>/<clave>` para recursos `https`, o la ruta `/assets/…` tal cual para los locales.
- `totalImagenes` cuenta recursos activos e imágenes del asesor. El frontend muestra cada imagen por separado para copiarla antes del prompt.

`POST /generar` no escribe nada en la base. Si el usuario no tiene teléfono y `sinTelefono` no es `true`, responde 409 con `{ error, codigo: "TELEFONO_FALTANTE" }`. Con `sinTelefono: true`, `asesor_telefono` queda vacío. El contacto sale siempre de `req.user.id`; nunca del cuerpo.

`GET /recursos/:productoId/:clave`: el producto debe estar `activo` con versión `publicada` y el recurso debe existir y estar `activo` (si no, 404). Si su `url` empieza por `/assets/`, responde `302` a esa ruta. Si no, solo se lee una URL `https:` cuyo host sea exactamente el de `SUPABASE_URL` (sin credenciales, sin redirecciones), con plazo `recurso_timeout_ms`; se rechaza una respuesta no 2xx, un `content-type` que no sea `image/*` o un cuerpo mayor que `recurso_max_mb`. Responde la imagen con su `content-type`, `Cache-Control: private, max-age=300`, `X-Content-Type-Options: nosniff` y una política que impide ejecutar scripts de un SVG. Los fallos del almacenamiento o de la URL responden 502 con un mensaje que dice qué falló y cómo corregirlo. Leer un recurso externo no es una acción crítica (`reglas_entornos.md`): no hay guarda de entorno.

Administración (`prompts.administrar`):

| Ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /admin/productos` | — | `[{ id, codigo, nombre, estado, numeroVigente, tieneBorrador, totalParametros, actualizadoEn }]` |
| `POST /admin/productos` | `{ codigo, nombre, descripcion }` | producto creado con `estado: borrador` y borrador de versión 1 vacío |
| `POST /admin/productos/:id/duplicar` | `{ codigo, nombre, descripcion }` | igual que crear: producto `borrador` con una única versión borrador número 1, cuyo esquema (grupos, parámetros, recursos con su URL y estado activo, y reglas) es una copia de la versión publicada del origen o, si no tiene, de su borrador; 409 si el origen no tiene ninguna. Mismas validaciones que `POST /admin/productos`; nunca queda publicado |
| `GET /admin/productos/:id` | — | `{ producto, borrador, publicada }` (cada versión: `{ id, numero, estado, esquema, plantilla }` o `null`; `plantilla` está deprecada y siempre es `""`) |
| `POST /admin/productos/:id/borrador` | — | crea el borrador copiando la versión publicada; 409 si ya existe |
| `PUT /admin/productos/:id/borrador` | `{ esquema }` | guarda el borrador (valida la estructura del esquema, incluidos recursos y reglas, y la sintaxis del texto de las reglas); un campo `plantilla` en el cuerpo se ignora |
| `DELETE /admin/productos/:id/borrador` | — | descarta el borrador (no si es la única versión del producto) |
| `POST /admin/productos/:id/publicar` | — | valida el esquema, la sintaxis de las reglas, al menos un parámetro y `recursos_min_publicar` recursos activos; el borrador pasa a `publicada`, la anterior a `archivada`; un producto en `borrador` pasa a `activo` |
| `PATCH /admin/productos/:id/estado` | `{ estado: "activo" \| "inactivo" }` | `activo` exige una versión publicada |
| `POST /admin/previsualizar` | `{ esquema, valores?, imagenes? }` | `{ prompt, imagenes, totalImagenes, reglas: [{clave, etiqueta, posicion, activo, incluida}], sinUsar: [], errores: [] }`: el prompt completo autogenerado desde el esquema del borrador (encabezado, reglas `inicio`, sección generada, reglas `fin`; sección 3), con valores por defecto y el contacto de `contacto_ejemplo` si no se envían; `reglas` indica qué reglas están activas e `incluida` si aportaron texto al prompt; `imágenes` con los mismos elementos de `/generar`, usando la `url` guardada de los recursos activos (el borrador aún no se sirve por el proxy); `sinUsar` queda siempre vacío (compatibilidad) y un campo `plantilla` en el cuerpo se ignora; si el esquema o el texto de una regla tienen errores, `prompt` es `""`, `imagenes` `[]`, `totalImagenes` `0`, `reglas` `[]` y `errores` los lista |
| `GET /admin/ajustes` | — | `[{ clave, descripcion, valor, actualizadoEn }]` de los siete ajustes |
| `PUT /admin/ajustes/:clave` | `{ valor }` | la fila actualizada `{ clave, descripcion, valor, actualizadoEn }`; clave desconocida: 404; valor con forma incorrecta: 400 con `{ error, campos: { <clave>: mensajes } }` |

Estados en palabras completas: producto `borrador`, `activo`, `inactivo`; versión `borrador`, `publicada`, `archivada`.

## 9. Estilo de los mensajes de error

Todo mensaje que el usuario pueda leer debe ser explicativo: (1) qué falló, nombrando el campo por su etiqueta (y la clave cuando ayude), (2) la regla con sus números, y (3) cómo corregirlo. Ejemplo: «El límite «imagenes_max_defecto» (25) no puede superar «imagenes_max_tope» (20).» Los mensajes nuevos salen de `src/modules/prompts/mensajes.js` con `msg(clave, params)`: un catálogo con marcadores `{nombre}`; una clave o un parámetro ausentes lanzan un error interno claro. Todos los mensajes del módulo (esquema, plantilla, valores del asesor, productos, versiones, ajustes y lectura de recursos) salen ya de ese catálogo; los servicios puros lo cargan porque no importa base de datos ni configuración.

Guía de estilo, válida para todo mensaje nuevo:

- Qué falló: nombra el campo por su etiqueta (y la clave entre paréntesis si ayuda al administrador) y dónde está (grupo, parámetro o pestaña Parámetros, Plantilla, Recursos, Ajustes).
- Por qué: la regla con sus números reales; si el número es un ajuste, se pasa como parámetro y nunca se escribe en el catálogo.
- Cómo corregirlo: una frase en imperativo ("Acórtala", "Elige otra clave").
- Español con «tú», frases completas que terminan en punto, sin jerga técnica, sin texto crudo de errores de librerías, SQL ni trazas.
- Los errores de negocio mantienen su código HTTP (400, 403, 404, 409; nunca 401) y la forma de la respuesta (`{ error, campos }`, `codigo`).
- Para el asesor se nombra solo la etiqueta; la clave solo se muestra en la administración.
