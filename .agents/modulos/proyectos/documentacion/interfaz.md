# Interfaz del módulo: barra lateral y escala tipográfica

Mockups aprobados en Figma: **N1** (barra lateral de escritorio, página «06 · Administrador») y **N2** (menú del celular, página «02 · Asesor — celular»).

## Barra lateral con categorías desplegables

- Cada categoría (Mi trabajo, Cartera, Proyectos, Configuración) es una fila con su nombre, **cuántas opciones tiene la persona** y una flecha. **Se abre una sola a la vez**; al abrir otra, la anterior se cierra.
- Al entrar a una pantalla se abre **la categoría donde estás**, con tu opción resaltada. Si la pantalla no está en el menú (por ejemplo, la ficha de una empresa), queda abierta la categoría anterior.
- La categoría abierta se recuerda entre visitas (`localStorage`, solo comodidad: si falla, el menú funciona igual).
- Cada rol ve solo lo que puede usar: una categoría sin opciones permitidas no aparece. «Catálogos» pasó a ser una opción de Configuración.
- Con la barra **colapsada** (solo íconos, escritorio) queda **un ícono por categoría** (Mi trabajo, Cartera, Proyectos, Configuración; mockup N3). Tocar un ícono abre una **ventanita** al costado con el nombre de la categoría y sus opciones; se cierra al elegir una, con Esc, al tocar fuera o al expandir la barra. Pasar el cursor (o enfocar con el teclado) muestra un tooltip «Nombre · N opciones». La categoría donde estás lleva el ícono azul y una barrita. Cada opción tiene un ícono distinto. En el **celular** es un cajón con el comportamiento de acordeón.
- Se maneja con el teclado (Enter o Espacio en la cabecera) y avisa su estado con `aria-expanded`.
- Código: `index.html` (estructura), `js/layout/sidebar.js` (`abrirCategoria`, `marcarRuta`, `mostrarSoloPermitidas`) y `css/styles.css`.

## Escala tipográfica (la de Figma)

| Uso | Tamaño |
|---|---|
| Título de página | 24 px (Outfit, negrita) |
| Título de sección o panel | 20 px |
| Nombre de empresa en tarjetas | 15 px (semibold) |
| Texto base del módulo, tablas y botones | 13 px |
| Rótulos pequeños (encabezados de tabla, chips, pestañas de la barra inferior) | 12 px, el mínimo |

Antes, un texto sin tamaño propio salía en 16 px (el del navegador) junto a otros de 13 px; ahora la base del módulo es 13 px (`body` en `css/styles.css`). En celular la cabecera muestra el logo y el chip «Proyectos», sin el texto «Portal Empresarial» cortado.

## Accesibilidad (QA fase 5)

- **Ventanas (modales):** llevan `role="dialog"`, `aria-modal="true"` y `aria-labelledby` con su título. Al abrir, el foco entra a la ventana; el Tab no se escapa a la página de atrás (si estás en el último control, vuelve al primero); Esc la cierra y el foco regresa al botón que la abrió.
- **Contraste:** el texto secundario del módulo usa `--color-text-muted: #5B6B80` (5.4:1 sobre blanco, 5.2:1 sobre el fondo general), en vez del gris del portal (#94A3B8, 2.5:1). Las etiquetas de estado (Activa, Inactiva, No contactar) usan texto más oscuro para pasar 4.5:1. El cambio vive en `styles.css` del módulo, no en `global.css`.

