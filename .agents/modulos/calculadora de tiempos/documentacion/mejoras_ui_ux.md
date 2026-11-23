# Mejoras de interfaz (2026-11-23)

Mockup aprobado: Figma `b0CqDb0IHG3IpXRzGesFI5`, página «04 · Mejoras de interfaz» (N1 a N6).

## Selector de producto por categorías
Componente único `public/modules/tiempos/js/components/listaProductos.js`, usado en tres sitios:
- **Calculadora** (`selectorProducto.js`): popover en computadora y hoja desde abajo en celular. El campo «Línea» se quitó del formulario: el selector ya trae las pestañas por línea. El botón muestra la línea del producto como etiqueta.
- **Tabla de referencia**: lista fija a la izquierda; en celular, el mismo selector en hoja.
- **Administración**: la misma lista, con filtros **Todos / Ocultos / Sin rangos** y los días de cada producto calculados con el margen de la tabla.

Qué trae: buscador (en Referencia también busca en los avisos), pestañas por línea con contador (con una búsqueda pasa sola a la línea que tiene resultados), categorías plegables con contador (la del producto elegido abre sola), días al cliente de cada producto («11–16 d»), «Ver los N productos restantes» en categorías largas y «Usados hace poco» (solo en el selector; se guarda en el navegador, sin tocar la base de datos).

## Referencia
- Migas «Línea › Categoría», etiqueta «Desde N piezas».
- **«¿Cuántas piezas?»** marca la fila (o tarjeta) del rango que corresponde y dice los días al cliente.
- **«Calcular este producto»** abre la calculadora con producto y cantidad (`#/calculadora?producto=clave&cantidad=300`); en celular es una barra fija abajo.
- La calculadora también acepta `producto` y `cantidad` en la dirección y calcula al abrir.

## Calculadora
- **Atajos de cantidad**: el inicio de cada rango del producto.
- **«Ver la tabla de este producto»** lleva a `#/referencia?producto=clave` (no aparece en pedidos de varias piezas).

## Administración
- **Duplicar este producto**: crea una variante con las mismas etapas, rangos, días, avisos y opciones (moldes, lanyard) y el mismo grupo. Nace oculta, como todo producto nuevo, y entra al borrador (se publica con el resto). No requirió cambios en la API: usa `POST /admin/productos`.

## Corrección incluida
En pantallas angostas la tabla ancha de Referencia se mostraba junto a las tarjetas; la regla que la mostraba era de Administración y ahora solo aplica allí.
