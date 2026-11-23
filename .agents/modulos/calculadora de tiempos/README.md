# Calculadora de Tiempos (`tiempos`)

Módulo del portal que convierte la **Tabla de tiempos** (hoy Ver. 5.0, 27/07/2026) en una herramienta de consulta: el usuario elige producto y cantidad, y el módulo devuelve los días por etapa, los días que se le dan al cliente y la fecha de entrega.

Estado: **idea definida y mockup hecho en Figma (pendiente de aprobación); falta código.** Mockup: https://www.figma.com/design/b0CqDb0IHG3IpXRzGesFI5 (páginas «01 · Calculadora — escritorio», «02 · Calculadora — celular» y «03 · Referencia y administración»). Las imágenes de referencia están en `referencias/`.

## 1. Decisiones tomadas (2026-11-21)

| Tema | Decisión |
|---|---|
| Varias piezas en un pedido | Cada pieza se calcula aparte (con sus complementos) y la **entrega es la de la pieza más larga**. |
| Resultado | Días por etapa, **días al cliente** y **fecha de entrega** (solo lunes a viernes, sin contar el día de la orden; se puede elegir otra fecha de inicio). |
| Quién mantiene las tablas | El **administrador, desde el portal**, con versiones y fecha de versión (hoy 5.0) e historial de cambios. |
| Historial de cálculos | **No se guarda nada por usuario.** Botón «Copiar resumen» para pegarlo en la cotización o el chat. |
| Festivos | La fecha **descuenta los festivos** del calendario del portal (por país), además de sábados y domingos. |
| Urgente | Solo **avisa** que requiere autorización del gerente; se muestran los tiempos normales (la tabla no trae tiempos urgentes). |
| UV | Suma días a la etapa de producción/fábrica **y al total al cliente**. |
| Margen +1 | Se suma **una sola vez por pieza, al final** (etapas + complementos + 1). En un pedido con varias piezas se toma la más larga, sin otro día extra. |

## 2. Cómo está armada la tabla (lo que se lee de las imágenes)

- **Dos hojas:** hoja 1 de producción (piezas fundidas, fotograbado, metal, carpintería, vidrio/mármol, resina, 3D, UV) y hoja 2 de las líneas **Mundi** y **Protextil**.
- **Producto → rangos de cantidad → días por etapa.** Etapas que aparecen: Piloto, Fundición, Diseño, Molde, Corte, 3D, Producción, Fábrica, Costura, Ensamble. Cada producto usa solo algunas.
- **Columna «Cliente» = suma de las etapas + 1 día de margen** (se comprobó en las filas revisadas: 2+2+3+1=8 → 9; 7+4+1=12 → 13; 1+3=4 → 5). Se calcula, no se captura.
- **Último rango de cada producto:** «Tiempo a convenir» (sin días; se muestra el aviso y no se calcula fecha).
- **UV** no es un producto aparte: suma días a la etapa de producción/fábrica del producto trabajado (+1 a +13 según cantidad y tipo).

### Reglas de las observaciones
1. Los tiempos **no incluyen el arte interno**.
2. Fundición cubre hasta **3.5"**; si es mayor, **+2 días** (moldes).
3. Todos los tiempos suponen **pieza de tamaño estándar y detalle medio**.
4. **Urgente** debe estar autorizado por **gerente**.
5. El día de elaboración de la orden **no cuenta** para fábrica.
6. Días de producción: **lunes a viernes**.
7. Los tiempos incluyen **2 colores**; desde el 3.º, **+1 día por cada 2 colores** (3.º y 4.º: +1; 5.º y 6.º: +2).
8. Los tiempos son **por pieza trabajada**; un reconocimiento con 2 o más piezas cuenta cada una como individual al definir la cantidad.
9. Impresión UV: la tonalidad puede variar en producciones masivas; logos y textos deben ser editables.

### Avisos por producto
- Pieza fundida con listón o lanyard cosido → sumar el tiempo de **costura de Protextil**.
- Vidrio/mármol grabado → verificar existencias de planchas.
- 3D (filamento, llavero NFC) → consultar existencias de filamento; piezas hasta 8", otros tamaños se consultan.
- Listón sublimado/seda → consultar existencias de listón de seda.
- Resina → «molde nuevo» (la etapa Molde ya viene en la tabla).

## 3. Cómo calcula

Para cada **pieza** del pedido:
1. Se busca el rango que contiene la cantidad. Si cae en «Tiempo a convenir» → no hay cálculo.
2. Días por etapa = los del rango. Se suman los **complementos** elegidos: UV, costura de Protextil, moldes por tamaño, colores extra.
3. **Días al cliente = suma de etapas + 1.**

Para el **pedido**: días al cliente = **el mayor** de las piezas. La fecha de entrega se cuenta en días hábiles (lunes a viernes) desde el día siguiente al de la orden. Si alguna pieza es «a convenir», el pedido completo queda «a convenir».

Ejemplo: 300 piezas fundidas «Antique con color» (rango 75–500: 2+2+5+1 = 10, al cliente 11) más un lanyard cosido de 300 (rango 251–500: 6+1 = 7, al cliente 8). Se calcula cada una y la entrega es de **11 días** (la mayor).

## 4. Pantallas

| # | Pantalla | Quién | Notas |
|---|---|---|---|
| 1 | **Calculadora** | todos con acceso | Línea → producto → cantidad → opciones (colores, tamaño, UV, costura, urgente) → resultado con etapas, días al cliente y fecha. «Agregar otra pieza» arma el pedido; «Copiar resumen». |
| 2 | **Tabla de referencia** | todos con acceso | La hoja original, navegable y buscable, por línea y producto. |
| 3 | **Administración de tablas** | administrador | Líneas, productos, etapas, rangos y días; complementos y avisos; versión y fecha. |
| 4 | **Historial de cambios** | administrador | Quién cambió qué, antes y después. |

Diseño: escritorio y celular (390 px); las reglas de UI del portal (`.agents/reglas/reglas_disenoUI.md`).

## 5. Datos (propuesta)

Tablas con prefijo `tiempos_` (migración aditiva e idempotente):
- `tiempos_versiones` (número, fecha, vigente), `tiempos_lineas` (Mundi, Protextil, Producción…), `tiempos_productos` (línea, nombre, aviso, orden, activo).
- `tiempos_etapas` (catálogo: Piloto, Fundición, Diseño…), `tiempos_rangos` (producto, desde, hasta, `a_convenir`), `tiempos_rango_etapas` (rango, etapa, días).
- `tiempos_complementos` (UV, costura, molde por tamaño, color extra) con su regla y `tiempos_historial`.
- Los datos iniciales salen de las dos imágenes (carga inicial revisada contigo).

Permisos: `tiempos.ver` (calculadora y referencia) y `tiempos.administrar`. Se registra en `MODULOS` (`src/core/permissions/modulesCatalog.js`). Sin archivos ni Storage.

## 6. Por confirmar
1. **Revisión de la carga inicial:** validar fila por fila las tablas transcritas de las imágenes.
2. **Colores extra:** confirmar el conteo (3.º y 4.º color: +1 día; 5.º y 6.º: +2).

## 7. Fases
1. Idea y reglas (este documento) → 2. Mockup en Figma, aprobado → 3. Base de datos y carga inicial → 4. Motor de cálculo con pruebas → 5. Calculadora y tabla de referencia → 6. Administración e historial → 7. Documentación, revisión en celular y PR a `dev`.
