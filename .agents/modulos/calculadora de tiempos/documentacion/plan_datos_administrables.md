# Plan: extras y catálogos administrables (aprobado e implementado, 2026-11-28)

Objetivo: que quien mantiene la tabla maneje **todos** los datos del módulo desde la administración, sin cambios de código.

## 1. Qué está fijo hoy

| Parte | Hoy | Problema |
|---|---|---|
| Impresión UV | Único extra con tabla editable (rangos y días de sus 3 tipos) | No se pueden crear tipos ni extras nuevos, ni renombrarlos; se ofrece en todos los productos |
| Moldes | Regla en el motor (+`moldes_dias`) y casilla `permite_moldes` en el producto; texto «más de 3.5 pulgadas» en el código | Solo se cambian los días |
| Colores | Regla en el motor (`colores_incluidos`, `colores_cada`, `colores_dias`); máximo 12 en el código | Siempre aparece, en todos los productos |
| Costura del lanyard | Atada en el código al producto `protextil-lanyard` y su etapa `costura`, con la casilla `permite_lanyard` | Si se renombra o cambia el producto, deja de funcionar |
| Categorías (grupo) | Texto suelto en cada producto | No se renombran de una vez, no se ordenan |
| Orden | Fijo por carga inicial | No se reordena nada |
| Líneas y etapas | Se agregan y renombran | No se pueden ocultar |
| Urgente, 20 piezas, 12 colores | En el código | No editables |

## 2. Decisiones (2026-11-28)
- Tres tipos de extra: **Sí/No con días fijos**, **Por cantidad** (tabla de rangos, con una o varias opciones) y **Por unidades** (incluye N, +X días cada Y).
- Moldes, Colores y Costura del lanyard pasan a ser extras editables con sus valores actuales; los cálculos no cambian.
- Cada extra se ofrece **por línea, categoría o producto**.
- También: categorías administrables, ordenar todo, ocultar líneas y etapas, textos y límites como parámetros.

## 3. Modelo de datos
Se mantiene el versionado (todo va al borrador y se publica).

- `tiempos_extras` gana: `tipo` (`si_no` | `por_cantidad` | `por_unidades`), `etiqueta` (texto de la calculadora), `ayuda`, `dias_fijos`, `unidades_incluidas`, `unidades_cada`, `unidades_dias`, `unidades_max`, `activo`, `orden`.
- `tiempos_extra_opciones` (nuevo): las opciones de un extra «por cantidad» (los 3 tipos de UV); cada opción tiene sus rangos en `tiempos_extra_rangos`. Un extra con una sola opción no muestra el selector.
- `tiempos_extra_alcance` (nuevo): a qué aplica el extra (`linea` | `categoria` | `producto` + clave). Sin filas = todos.
- `tiempos_categorias` (nuevo): clave, línea, nombre, orden, activo. `tiempos_productos.grupo` pasa a `categoria_clave`.
- `tiempos_lineas` y `tiempos_etapas` ganan `activo`; `orden` ya existe.
- `tiempos_parametros`: `max_piezas` (20), `aviso_urgente` (texto), además de los actuales; los de colores y moldes se mudan a sus extras.
- `permite_moldes` y `permite_lanyard` se reemplazan por el alcance del extra.
- La costura deja de leer el producto Lanyard: se carga como extra «por cantidad» con los mismos rangos de la columna Costura.

**Migración:** `64_tiempos_datos_administrables.sql`, aditiva e idempotente. La `54_tiempos_nucleo` NO se toca: ya llegó a staging con el PR #206 (en un primer intento se editó la 54; se revirtió el 2026-11-28 al detectar que ya estaba en staging). La 64 agrega columnas y tablas y convierte los datos de todas las versiones (grupos → categorías, tipos de UV → opciones del extra «uv», Colores/Moldes/Costura → extras con los mismos valores y el mismo alcance, reglas nuevas). Las columnas `grupo`, `permite_moldes`, `permite_lanyard` y `tiempos_extra_rangos.extra_id` quedan sin uso.

## 4. Motor
`calcularPieza` recorre los extras activos que aplican al producto, en su orden, según el tipo. Se quitan las reglas fijas de moldes, colores y costura. La pieza recibe `extras: { [clave]: true | opción | unidades }`; la API sigue aceptando el formato anterior durante la transición.

## 5. Pantallas
- **Administración › Extras** (rediseño): lista de extras con orden, estado y «Extra nuevo». El asistente pide tipo, nombre, texto para la calculadora, a qué aplica (línea / categoría / producto con el selector por categorías) y los datos del tipo. Incluye vista previa del interruptor tal como lo verá el usuario y un cálculo de ejemplo.
- **Administración › Catálogos** (antes «Etapas y líneas»): líneas, categorías y etapas con renombrar, ordenar (flechas arriba/abajo, accesibles por teclado) y ocultar (solo si nada visible las usa). Mover un producto de categoría desde la ficha del producto.
- **Administración › Reglas**: margen, máximo de piezas, aviso de urgente.
- **Calculadora**: los extras salen del catálogo, solo los que aplican al producto, en el orden definido. Sin cambios para quien la usa si los datos son los de hoy.
- **Referencia**: muestra los extras que aplican al producto elegido.
- **Historial**: registra crear, editar, ocultar y ordenar extras y catálogos.

## 6. Fases
1. **Mockup en Figma** de Extras (lista y asistente de los 3 tipos), Catálogos y Reglas; aprobación del dueño. Sin código antes.
2. Migración y carga inicial convertidas (los 3 extras fijos y el UV como datos).
3. Motor genérico de extras y pruebas: los 38 + 55 + 135 casos actuales deben dar **lo mismo**; casos nuevos por tipo y por alcance.
4. API de administración (extras, opciones, alcance, categorías, orden, ocultar, parámetros) con validaciones y permisos.
5. Pantallas de administración.
6. Calculadora y referencia leyendo el catálogo.
7. Documentación, recorrido en navegador (escritorio y 390 px) y commits por tema en rama nueva.

## 7. Riesgos
- Cambiar el motor podría alterar resultados: lo cubren las pruebas de caja negra existentes, que deben pasar sin tocarlas.
- Un extra mal configurado afecta a muchos productos: vista previa con cálculo de ejemplo y cambios solo visibles al publicar.
- Ocultar una etapa en uso rompería tablas: se bloquea con mensaje si un producto visible la usa.

## 8. Mockup (Figma, página «05 · Datos administrables»)
https://www.figma.com/design/b0CqDb0IHG3IpXRzGesFI5 — aprobado el 2026-11-28.
- A1 Extras: lista (los 4 actuales como datos, orden, estado, editar).
- A2 Extra nuevo, paso 1: elegir tipo.
- A3 Por cantidad: datos, opciones con su tabla de rangos, vista previa y ejemplo calculado.
- A4 Dónde se ofrece: todos o árbol de líneas, categorías y productos.
- A5 Sí / No y Por unidades: datos, vista previa y tabla de cómo suma.
- A6 Catálogos: líneas, categorías y etapas (renombrar, ordenar, ocultar; candado si está en uso).
- A7 Reglas: margen, máximo de piezas y aviso de urgente.
- A8 Calculadora: cada producto ve solo sus extras.

## 9. Resultado (2026-11-28)
- Motor genérico (`calculo/extras.js`, `motor.js`): las pruebas anteriores dan lo mismo sin cambiar sus resultados esperados (motor 38, caja negra 55, API 16, datos 135 filas). Solo se adaptaron 3 comprobaciones de la forma del catálogo (los tipos de UV ahora son opciones del extra `uv`; «permite moldes» ahora es «se le ofrece el extra moldes»).
- Administración: `verificar-admin.js` pasa a 80 comprobaciones (extras de los tres tipos, alcance, ocultar y quitar, reglas, catálogos con ocultar bloqueado, categoría de producto y cálculo con los extras nuevos al publicar).
- Recorrido en el navegador (escritorio): las cinco pestañas de la administración, el asistente completo (por cantidad, alcance por categoría, revisar y guardar), la calculadora con los extras del catálogo y la tabla de referencia, sin errores en consola. Falta el recorrido en celular.

## 10. Prueba de la conversión (simulación de staging, 2026-11-28)
Base con el código de `dev` (migración 54 original, carga inicial y un borrador con cambios: UV cama plana 1–10 = 3 días, moldes 3 días, colores incluidos 3 y lanyard permitido en Comandos). Se calcularon 3150 piezas en la versión publicada y en el borrador antes y después de aplicar la 64: **0 diferencias** en ambas. La conversión dejó 4 extras por versión (Colores, Moldes, Costura, UV con 3 opciones), 8 categorías, Moldes y Costura en «Piezas fundidas» (y Costura también en Comandos en el borrador), sin rangos huérfanos. Re-ejecutar la 64 no cambia nada. Sobre esa base convertida pasan api 16, caja negra 55 y admin 80; en una base nueva pasan además motor 38 y datos; `ci:sintaxis`, `ci:migraciones` (A y B) y `ci:arranque` en verde.
