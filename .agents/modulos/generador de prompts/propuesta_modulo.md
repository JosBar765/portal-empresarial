# Propuesta del módulo Generador de Prompts

Estado: **propuesta para refinar**. No hay código ni migraciones; se construye solo cuando esta propuesta se apruebe.
Base: `analisis_modulo.md`. Mockup: [Figma](https://www.figma.com/design/XB3lOHqrqObxxQnr78rIiT).

## 1. Resumen

El asesor completa los parámetros de un producto (hoy, la medalla). El módulo arma un prompt de texto que el asesor pega en un generador de imágenes externo. No genera imágenes ni llama a ninguna IA.

Cada prompt es una instrucción nueva e independiente: lleva un encabezado fijo que pide ignorar cualquier propuesta anterior. Si el cliente pide cambios, el asesor vuelve al formulario y genera otro prompt.

La vista de administración permite crear productos y definir qué parámetros pide cada uno, sin tocar código.

## 2. Decisiones de diseño

| Tema | Propuesta | Por qué |
|---|---|---|
| Dónde viven los parámetros | Un JSON por versión de producto, **en una columna de MySQL**, no en un archivo | El hosting es gestionado y un deploy puede reemplazar el sistema de archivos. La base ya se respalda y se copia a staging. Da versionado y transacciones. |
| Versionado | Cada publicación crea una versión nueva e inmutable | Editar un producto no cambia cómo se generaron las propuestas pasadas. |
| Armado del prompt | En el backend, con una plantilla por versión | Una sola fuente de verdad; el navegador no puede alterar el resultado. |
| Contacto del asesor | Se copia (snapshot) a la propuesta al generar | Si el teléfono cambia después, la propuesta histórica no cambia. |
| Independencia | Solo dependencias con `usuarios`, `permisos` y la lectura del contacto del asesor | Bajo acoplamiento: sin eventos ni llamadas a otros módulos. |

Nota sobre MariaDB (producción): el tipo `JSON` es un alias de `LONGTEXT`. Se lee y escribe el documento completo y no se consulta por rutas JSON.

## 3. Modelo de datos

Prefijo `prompt_`, como `vale_` en Vales. Los estados se escriben completos.

```sql
CREATE TABLE IF NOT EXISTS `prompt_productos` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`      VARCHAR(50)  NOT NULL UNIQUE,
  `nombre`      VARCHAR(100) NOT NULL,
  `descripcion` VARCHAR(255) DEFAULT NULL,
  `estado`      VARCHAR(20)  NOT NULL DEFAULT 'borrador',
  `creado_por`  INT NOT NULL,
  `creado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prompt_producto_versiones` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `producto_id`  INT NOT NULL,
  `numero`       INT NOT NULL,
  `estado`       VARCHAR(20) NOT NULL DEFAULT 'borrador',
  `esquema`      JSON NOT NULL,
  `plantilla`    MEDIUMTEXT NOT NULL,
  `creado_por`   INT NOT NULL,
  `creado_en`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `publicado_en` TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY `uq_prompt_version` (`producto_id`, `numero`),
  FOREIGN KEY (`producto_id`) REFERENCES `prompt_productos` (`id`),
  FOREIGN KEY (`creado_por`)  REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prompt_propuestas` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id`  INT NOT NULL,
  `producto_id` INT NOT NULL,
  `version_id`  INT NOT NULL,
  `titulo`      VARCHAR(200) NOT NULL,
  `valores`     JSON NOT NULL,
  `contacto`    JSON NOT NULL,
  `prompt`      MEDIUMTEXT NOT NULL,
  `creado_en`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_prompt_propuesta_usuario` (`usuario_id`, `creado_en`),
  FOREIGN KEY (`usuario_id`)  REFERENCES `usuarios` (`id`),
  FOREIGN KEY (`producto_id`) REFERENCES `prompt_productos` (`id`),
  FOREIGN KEY (`version_id`)  REFERENCES `prompt_producto_versiones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Reglas que el service debe garantizar (no se expresan en SQL):

- `prompt_productos.estado`: `borrador`, `activo` o `inactivo`.
- `prompt_producto_versiones.estado`: `borrador`, `publicada` o `archivada`.
- Por producto hay como máximo un `borrador` y una `publicada`. La versión vigente es la `publicada`.
- Una versión `publicada` o `archivada` nunca se modifica.
- `titulo` se toma del parámetro principal (el nombre del evento) para listar el historial.
- `contacto` guarda `{nombre, telefono, correo}` tal como salió en el prompt.

Tabla opcional, solo si se decide guardar las imágenes (ver punto abierto 1): `prompt_propuesta_archivos` con `propuesta_id`, `parametro`, `orden`, `nombre_original`, `url` (Supabase Storage), `tipo_mime`, `tamano_bytes`.

### Permisos

| Código | Para qué |
|---|---|
| `prompts.ver` | Entrar al módulo (decide la tarjeta del dashboard y el acceso estático). |
| `prompts.generar` | Generar propuestas y ver el propio historial. |
| `prompts.administrar` | Vista de administración de productos. |

Se agregan a `database/seed.sql` (instalación nueva) y a una migración idempotente (producción). Asignación inicial propuesta: Asesor (`rol_id` 2): `ver` y `generar`. Administrador (`rol_id` 1): los tres.

## 4. Esquema JSON de un producto

```json
{
  "esquema_version": 1,
  "grupos": [
    {
      "clave": "frente",
      "etiqueta": "Parte frontal",
      "parametros": [
        { "clave": "frente_imagenes", "etiqueta": "Imágenes del frente", "tipo": "imagenes",
          "requerido": false, "max": 3, "max_mb": 5, "formatos": ["png", "jpg", "svg"] },
        { "clave": "frente_frases", "etiqueta": "Frases", "tipo": "texto_largo", "separador": "," }
      ]
    },
    {
      "clave": "trasera",
      "etiqueta": "Parte trasera",
      "parametros": [
        { "clave": "trasera_lisa", "etiqueta": "Trasera lisa", "tipo": "si_no", "defecto": false },
        { "clave": "trasera_frases", "etiqueta": "Frases", "tipo": "texto_largo",
          "visible_si": { "parametro": "trasera_lisa", "igual": false } }
      ]
    }
  ]
}
```

Tipos soportados:

| Tipo | Campos propios | Se escribe en el prompt como |
|---|---|---|
| `texto` | `max_largo` | el texto |
| `texto_largo` | `separador` (opcional) | el texto; con separador, una lista de frases entre comillas |
| `numero` | `min`, `max`, `unidad_de` (clave de un parámetro de unidad) | `7.0 cm` |
| `opciones` | `opciones: [{valor, etiqueta, texto_prompt}]` | el `texto_prompt` de la opción elegida |
| `si_no` | `defecto` | `sí` o `no` |
| `imagenes` | `max`, `max_mb`, `formatos` | `imagen 1 (logo.png) y imagen 2 (patrocinador.png)` |
| `calculado` | `igual_a` (clave de otro parámetro) | el valor del otro parámetro (ancho del listón = ancho de la argolla) |

Reglas:

- `clave`: `snake_case`, única en el producto e inmutable una vez publicada.
- `visible_si`: un parámetro oculto no se valida ni entra al prompt.
- El esquema se valida al guardar el borrador (claves únicas, referencias existentes, límites coherentes) y otra vez al publicar.
- El backend valida los `valores` del asesor contra el esquema de la versión publicada. Rechaza claves desconocidas.

## 5. Plantilla del prompt

Una plantilla de texto por versión. Sintaxis mínima, sin evaluar código:

- `{{clave}}` inserta el valor ya formateado según el tipo.
- `{{#si clave}}…{{/si}}` solo sale si el parámetro tiene valor (o es `sí`).
- `{{#no clave}}…{{/no}}` solo sale si no lo tiene.
- Variables automáticas del asesor: `asesor_nombre`, `asesor_telefono`, `asesor_correo`.

El encabezado «NUEVA INSTRUCCIÓN. Ignora cualquier propuesta anterior…» lo antepone el sistema a todos los productos y no está en la plantilla. Al publicar se rechaza una plantilla con variables inexistentes o bloques sin cerrar.

## 6. API propuesta

Montaje: `app.use('/api/prompts', requireAuth, requirePermission('prompts.ver'), routes)`.

| Método y ruta | Permiso | Qué hace |
|---|---|---|
| `GET /productos` | `prompts.generar` | Productos activos con su esquema vigente. |
| `POST /propuestas` | `prompts.generar` | Valida, arma el prompt, guarda y devuelve `{id, prompt}`. Acepta `idempotencyKey`. |
| `GET /propuestas` y `GET /propuestas/:id` | `prompts.generar` | Historial propio. |
| `GET/POST /admin/productos` | `prompts.administrar` | Listar y crear productos. |
| `GET/PUT /admin/productos/:id/borrador` | `prompts.administrar` | Leer y guardar el borrador (esquema y plantilla). |
| `POST /admin/productos/:id/publicar` | `prompts.administrar` | Valida y publica; la anterior pasa a `archivada`. |
| `POST /admin/productos/:id/descartar` | `prompts.administrar` | Elimina el borrador. |
| `PATCH /admin/productos/:id/estado` | `prompts.administrar` | Activar o desactivar. |
| `POST /admin/previsualizar` | `prompts.administrar` | Renderiza la plantilla con datos de ejemplo. |

La identidad (`usuario_id` y contacto) sale siempre de `req.user`, nunca del body.

## 7. Estructura e integración

```text
src/modules/prompts/
  controllers/  productoController.js, propuestaController.js
  services/     productoService.js, esquemaService.js, plantillaService.js, propuestaService.js
  repositories/ productoRepository.js, versionRepository.js, propuestaRepository.js
  routes.js
public/modules/prompts/   index.html, css/styles.css, js/app.js
.agents/modulos/generador de prompts/   README.md + documentacion/
```

Puntos de integración, todos aditivos:

1. Entrada `prompts` en `MODULOS` (`src/core/permissions/modulesCatalog.js`), permiso `prompts.ver`, color `#0E7C7B`.
2. Una línea `app.use` en `src/app.js`, después de `authenticateJWT`.
3. Tablas en `schema.sql`; permisos en `seed.sql`; una migración idempotente que también crea el producto Medalla (versión 1 publicada).
4. Sin `events.js` ni sockets: el módulo no necesita tiempo real.

El único acoplamiento con otro módulo es leer el teléfono del asesor, que hoy vive en `asesores.telefono` (`usuarios` no tiene teléfono). Se aísla en una sola consulta de lectura dentro del repository del módulo.

## 8. Pantallas (Figma)

Páginas del archivo:

- **Tokens y componentes**: tokens de `global.css` como variables y componentes reutilizables.
- **Asesor – Escritorio**: Nueva propuesta, Prompt generado y el tablero de estados (cargando, error, validación, límites, vacíos, copiado, perfil sin teléfono).
- **Asesor – Móvil**: formulario a 390 px con secciones plegables y barra de acción fija.
- **Administración**: lista de productos, editor de parámetros y pestaña de plantilla (escritorio).

Pendiente en el mockup: administración en móvil (se asume uso solo en escritorio), pestañas «Vista previa» y «Esquema JSON» del editor, y la pantalla de historial.

## 9. Puntos abiertos

1. **Imágenes: ¿se guardan?** Recomendación: no en la primera versión. Quedan solo en el navegador mientras el asesor trabaja. Evita Storage, retención y acciones críticas (`reglas_entornos.md`). El historial guarda texto, no imágenes.
2. **Copiar varias imágenes.** El portapapeles del navegador copia una imagen a la vez. Propuesta del mockup: copiar una lámina numerada (1 a N). Alternativa: descargar un ZIP.
3. **Teléfono ausente.** Si el asesor no tiene teléfono, el pie sale sin él y se avisa (hay estado diseñado).
4. **Roles.** ¿Quién usa el módulo además del Asesor (Supervisor, Gerente)? ¿Quién administra además del Administrador?
5. **Historial.** No estaba en el análisis. ¿Se quiere, y quién ve el de quién?
6. **Idioma del prompt.** El prototipo permitía español o inglés. ¿Se mantiene?
7. **Pie de la imagen.** El machote usa los colores del logo de la empresa. ¿Fijos o configurables por el administrador?
8. **Propuestas viejas.** Si se guardan, ¿hay que purgarlas después de cierto tiempo?
