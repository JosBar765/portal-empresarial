# Buzón en laptops: layout fijo, scroll solo en la tabla

Muchos asesores usan laptops de 1366×768 y el Buzón se veía mal: toda la página hacía scroll, el encabezado de la tabla quedaba bajo el
navbar y la barra de scroll horizontal solo aparecía al final de los vales. Diseño aprobado en Figma («Buzón Vales de Arte - layout fijo
laptops (mockup)») y aplicado a **Buzón y Trabajo realizado de todos los roles** (Reportes no cambia).

- **Layout fijo (desde 901 px de ancho):** `sidebar.js` pone la clase `vista-tabla-fija` en el `body` mientras la vista es Buzón o Trabajo
  realizado. La página no se desplaza; barra de fecha, contadores y título/buscador quedan fijos y solo `.tabla-wrapper` hace scroll
  (vertical y horizontal). El encabezado de la tabla queda fijo y Correlativo y Acciones siguen ancladas a los costados. En ≤ 900 px todo
  queda como antes (tarjetas y scroll de página).
- **Scroll infinito:** ahora lo dispara el scroll de la tabla (`wireScrollInfinito` en `views/buzon.js`); en pantallas angostas sigue
  siendo el de la página. Al cambiar período, filtro u orden la tabla vuelve arriba (compara la consulta de la última carga); un refresco
  en vivo no la mueve.
- **Espaciados empatados:** una sola variable, `--sep-buzon` (16 px; 24 px con `min-height: 1000px`), para navbar → barra de fecha →
  contadores → tarjeta, y el aire interno de la tarjeta (arriba hasta la letra del título, izquierda, debajo del título). El navbar del
  módulo baja de 82 a 70 px desde 901 px (`--header-height` se redefine junto con su relleno porque el menú lateral arranca debajo).
- **Contadores en una sola fila** (cada rol se reparte el ancho; los textos largos se recortan con «…») y **compactación con poco alto**
  (≤ 800 px): contadores de 48 a 41 px y filas de la tabla de 79 a 71 px. Los monitores grandes conservan la densidad.
- **Scroll horizontal siempre accesible:** barra de 12 px al pie de la zona de la tabla, sombra en el borde (`tiene-scroll-izq` y
  `tiene-scroll-der`, activadas por `wireIndicadoresScrollHorizontal`), y la zona es enfocable con teclado (flechas, Inicio/Fin, Re Pág)
  con `role="region"` y etiqueta accesible.
- Sin cambios de backend ni migraciones. Probado con Asesor, Supervisor, Encargado, Diseñador y Gerente a 1920×1080, 1536×864,
  1440×900, 1366×768, 1280×720, 1024×768 y 901×700.
