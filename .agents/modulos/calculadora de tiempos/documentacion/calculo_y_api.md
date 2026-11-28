# Calculadora de Tiempos — cálculo y API

## Motor (`src/modules/tiempos/calculo/`)
Funciones puras sobre una `tabla` (la forma que arma `tablaRepository.cargarTabla`): sin base de datos, sin red.

**Pieza** — `calcularPieza(tabla, { productoClave, cantidad, extras?: { clave: valor }, urgente? })`
1. Valida: producto activo, cantidad entera ≥ 1, y que cada extra elegido exista, esté visible y se ofrezca en el producto (`calculo/extras.js` → `aplica`).
2. Busca el rango de la cantidad. Menor al mínimo → `bajo_minimo`; rango «a convenir» → `a_convenir`.
3. Días por etapa del rango + extras, en el orden de la tabla:
   - **sí/no** (`true`): `diasFijos`;
   - **por unidades** (número; si no se manda, vale lo incluido): `ceil((n − incluidas) / cada) × dias`;
   - **por cantidad** (clave de la opción, o `true` si tiene una sola): días del rango de la opción para la cantidad de la pieza; menor al mínimo → `bajo_minimo`, «a convenir» → `a_convenir`.
4. `total = etapas + extras + margen_dias` (los días al cliente).

Compatibilidad: los campos de antes (`colores`, `moldesGrande`, `lanyard`, `uv`) se siguen aceptando y se pasan a los extras `colores`, `moldes`, `costura` y `uv` de la carga inicial; sus errores vuelven con el nombre del campo enviado. Los errores de un extra nuevo vuelven como `piezas.N.extras.<clave>`.

**Pedido** — `calcularPedido(tabla, { fechaOrden, piezas }, { esHabil })`: cada pieza por separado; `dias` = el mayor `total`; `fechaEntrega` = ese número de días hábiles después del día de la orden (el día de la orden no cuenta). Una pieza inválida → `invalida`; con mínimos o «a convenir» no hay fecha.

**Fechas** (`fechas.js`): «AAAA-MM-DD» en UTC; `hacerDiaHabil(festivos)` → lunes a viernes sin festivos.
**Resumen** (`resumen.js`): el texto de «Copiar resumen».
**Validación** (`validacion.js`) y **diferencias** (`diferencias.js`): las reglas de lo que se puede guardar y el «qué cambió» entre dos tablas.

## Datos
Cada versión es una copia completa: `tiempos_versiones` (estado `borrador` | `publicada` | `reemplazada`), `tiempos_lineas`, `tiempos_categorias`, `tiempos_etapas`, `tiempos_productos` (con `categoria_clave`), `tiempos_rangos` + `tiempos_rango_etapas`, `tiempos_extras` (tipo, textos, días fijos o regla de unidades, `todos`, `activo`, orden) + `tiempos_extra_opciones` + `tiempos_extra_rangos` + `tiempos_extra_alcance` (línea, categoría o producto), `tiempos_parametros` (número o texto), `tiempos_avisos`. Tablas: migraciones `54_tiempos_nucleo` (núcleo) y `64_tiempos_datos_administrables` (extras, categorías y reglas; convierte los datos de la 54). Las columnas `grupo`, `permite_moldes`, `permite_lanyard` y `tiempos_extra_rangos.extra_id` quedaron sin uso. `tiempos_historial` guarda quién cambió qué y no se borra con la versión. Claves estables (`clave`) identifican productos, etapas y líneas entre versiones.

## API (`/api/tiempos`, detrás de `requireAuth` y `tiempos.ver`)
| Ruta | Para qué |
|---|---|
| `GET /tabla` | Tabla publicada para las pantallas (con «Cliente» calculado y, en cada producto, `extras`: las claves de los extras que se le ofrecen) |
| `POST /calcular` | Calcula un pedido: `{ fechaOrden?, piezas: [...] }`; devuelve días, fecha, desglose y `resumen`; errores 400 por pieza y campo |
| `GET /festivos?desde&hasta` | Festivos de Guatemala para el calendario |

Los festivos salen de la tabla `feriados` del portal (país Guatemala; los que «se repiten cada año» se expanden).
La tabla publicada se guarda en memoria un minuto y se renueva al publicar.
