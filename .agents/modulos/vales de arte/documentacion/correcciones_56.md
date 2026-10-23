# Correcciones 56 — Reportes: una tabla de vales por sección y estados vacío, cargando y error

Rama: `feature/reportes-tabla-vales` (desde `dev`). Diseño aprobado antes de programar en el mockup de Figma «Reportes — Vales de Arte» (https://www.figma.com/design/GdqAFk99ouL9B58BR7P7Sb): páginas «Actual vs tabla mejorada», «Admin y Gerente · tabla mejorada», «Celular · actual vs propuesta» y «Estados».

## Qué cambia

- **Una tabla por sección, sin desplegables.** En «Atrasados en el período», «No entregados» y «Entregados» (pestaña Actividad de Administrador, Gerente, Supervisor y Encargado/Asistente) los vales ya no están dentro de un desplegable por persona. Cada sección muestra una sola tabla con todos sus vales y la persona (o taller/tienda) es una columna: `Vale · {Tienda|Taller|Asesor|Diseñador} · [Fecha de ingreso] · Estado · Entrega · [Atraso] · Acciones`. «Fecha de ingreso» solo en la vista del Encargado/Asistente y «Atraso» en atrasados y entregados, como antes. Las secciones siguen siendo plegables (y se recuerda cuáles).
- **Se quitan «Expandir todo» y «Contraer todo»**, que ya no tienen sentido. El código del desplegable por persona (`htmlGrupo`, el alternado de filas) y sus reglas CSS (`.rep-tabla`, `.rep-grupo*`, `.rep-chip*`, `.rep-celda*`, `.rep-expandir`) se eliminaron; también el `.rep-chip--mini` huérfano.
- **Celular:** cada vale es una tarjeta compacta (código y atraso arriba; persona y entrega; estado y botón «Ver vale»); en la vista del Encargado se añade la fila de «Fecha de ingreso».
- **Estado vacío:** icono, «Sin vales con entrega en este período» y el texto de siempre. Si el período no es «Mes», agrega el botón «Ver el mes completo» (conserva la fecha de referencia y cambia el período a Mes).
- **Cargando:** la primera carga muestra un esqueleto con la forma del reporte (controles, aviso y tabla) en lugar del texto «Calculando el reporte...». Al refrescar con datos ya en pantalla se conserva el atenuado y se añade « · Actualizando…» a la línea de fecha.
- **Error:** mismo cuadro de siempre (`No se pudo cargar el reporte` y «Reintentar») con el diseño nuevo. Si falla la red (`TypeError` de `fetch`) se muestra «No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.» en lugar del texto técnico del navegador; los demás errores conservan el mensaje del servidor.

## Archivos

- `public/modules/vales/js/views/reportes.js`: `htmlTablaSeccion`, `renderGrupos`, `htmlEstadoVacio`, `verMesCompleto`, `htmlEsqueletoCuerpo` y el cuadro de error.
- `public/modules/vales/css/reportes.css`: tabla plana, tarjetas del celular, `.rep-estado*` y `.rep-esq*` (esqueleto con pulso de opacidad, sin animación con `prefers-reduced-motion`).

Sin cambios en el servidor, en la base de datos ni en el PDF.

## Verificación

Probado en local como Gerente y como Encargado de Diseño: tabla de escritorio en Mes y Semana, agrupada por Taller y por Diseñador; botón «Ver mes completo» desde el vacío de «Hoy»; esqueleto y cuadro de error con una petición retenida y rechazada; tarjetas en un marco de 390 px; el botón «Ver vale» abre el visor. `npm run ci:sintaxis` correcto.
