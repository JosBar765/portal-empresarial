# Correcciones 44 — Responsive para celulares

Rama: `feature/responsive-movil` (desde `dev`). Alcance: celulares (320 px en adelante); tablets y pantallas grandes quedan para después y no se tocaron. Solo presentación: no cambia el flujo ni la lógica.

## Cómo se auditó

Marcos (`iframe`) de 320, 375 y 414 px dentro del mismo origen, con medición automática de desborde horizontal, objetivos táctiles menores de 44 px y texto menor de 12 px, por rol (Supervisor, Encargado, Diseñador, Asesor y Administrador).

## Hallazgos y correcciones

| Pantalla | Hallazgo | Corrección |
|---|---|---|
| Cabecera (todos los módulos) | A 320 px el título se partía en 3 líneas y la página se ensanchaba 45 px | Padding compacto, título con elipsis, empresa oculta ≤380 px, logo oculto ≤340 px, safe-area (`dashboard.css`) |
| Controles táctiles | Botones, chips, flechas del mes, campos y filtros de 30 a 38 px | 44 px mínimo en celulares (`styles.css`, `global.css`, admin) |
| Campos de formulario | Texto menor de 16 px (zoom automático en iOS) | 16 px en ≤640 px (`global.css`) |
| Buzón | El pipeline se salía 5 px de la tarjeta a 320 px | Estado en columna dentro de la tarjeta y nodos de 22 px ≤380 px |
| Rendimiento | Tablas con scroll horizontal interno (hasta 656 px) | Tarjetas por fila; `utils/tablas.js` rellena `data-label` desde el encabezado |
| Admin | Tablas de 783 px que ensanchaban la página | Tarjetas por fila, celdas que ajustan el texto |
| Barra de período | Con tienda (Administrador) desbordaba 40 px a 320 px | Envuelve y el filtro de tienda ocupa todo el ancho |
| Modales | Botón de cerrar de 13×26 px, campos de 40 px | 44 px y pie con safe-area |
| Datepicker | Celdas de 32 px | 38 px de alto; el panel ya cabía en el viewport |

Sin desborde a 320, 375 y 414 px en Buzón, Trabajo realizado, Rendimiento, Reportes, Dashboard y Admin. Quedan textos de 11 px en etiquetas secundarias (insignias, `etiqueta-quien`), aceptados por ser rótulos de apoyo.

## Archivos

`public/css/{global,dashboard}.css`, `public/modules/vales/css/{styles,pipeline,rendimiento}.css`, `public/modules/admin/css/styles.css`, `public/modules/vales/js/utils/tablas.js` (nuevo) y `js/views/rendimientoGerencia.js`.

## Pendiente

- Prueba en celular real (teclado en pantalla, gestos y barras del navegador no se reproducen en la emulación).
- Orientación horizontal solo se revisó por reglas; falta confirmarla en dispositivo.
