# Calculadora de Tiempos — cálculo y API

## Motor (`src/modules/tiempos/calculo/`)
Funciones puras sobre una `tabla` (la forma que arma `tablaRepository.cargarTabla`): sin base de datos, sin red.

**Pieza** — `calcularPieza(tabla, { productoClave, cantidad, colores?, moldesGrande?, lanyard?, uv?, urgente? })`
1. Valida: producto activo, cantidad entera ≥ 1, colores de 1 a 12, y que los extras apliquen al producto.
2. Busca el rango de la cantidad. Menor al mínimo → `bajo_minimo`; rango «a convenir» → `a_convenir`.
3. Días por etapa del rango + extras:
   - colores: `ceil((colores − incluidos) / colores_cada) × colores_dias`;
   - moldes: `moldes_dias` si `permiteMoldes`;
   - costura: días de la etapa `costura` del producto `protextil-lanyard` en el rango de la cantidad;
   - UV: días del rango del tipo elegido.
4. `total = etapas + extras + margen_dias` (los días al cliente).

**Pedido** — `calcularPedido(tabla, { fechaOrden, piezas }, { esHabil })`: cada pieza por separado; `dias` = el mayor `total`; `fechaEntrega` = ese número de días hábiles después del día de la orden (el día de la orden no cuenta). Una pieza inválida → `invalida`; con mínimos o «a convenir» no hay fecha.

**Fechas** (`fechas.js`): «AAAA-MM-DD» en UTC; `hacerDiaHabil(festivos)` → lunes a viernes sin festivos.
**Resumen** (`resumen.js`): el texto de «Copiar resumen».
**Validación** (`validacion.js`) y **diferencias** (`diferencias.js`): las reglas de lo que se puede guardar y el «qué cambió» entre dos tablas.

## Datos
Cada versión es una copia completa: `tiempos_versiones` (estado `borrador` | `publicada` | `reemplazada`), `tiempos_lineas`, `tiempos_etapas`, `tiempos_productos`, `tiempos_rangos` + `tiempos_rango_etapas`, `tiempos_extras` + `tiempos_extra_rangos`, `tiempos_parametros`, `tiempos_avisos`. `tiempos_historial` guarda quién cambió qué y no se borra con la versión. Claves estables (`clave`) identifican productos, etapas y líneas entre versiones.

## API (`/api/tiempos`, detrás de `requireAuth` y `tiempos.ver`)
| Ruta | Para qué |
|---|---|
| `GET /tabla` | Tabla publicada para las pantallas (con «Cliente» calculado) |
| `POST /calcular` | Calcula un pedido: `{ fechaOrden?, piezas: [...] }`; devuelve días, fecha, desglose y `resumen`; errores 400 por pieza y campo |
| `GET /festivos?desde&hasta` | Festivos de Guatemala para el calendario |

Los festivos salen de la tabla `feriados` del portal (país Guatemala; los que «se repiten cada año» se expanden).
La tabla publicada se guarda en memoria un minuto y se renueva al publicar.
