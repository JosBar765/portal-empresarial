# Sistema de Diseño UI/UX (Especificación para Agentes de IA)

Este documento resume, a grandes rasgos, la paleta de colores y la línea de
diseño visual que sigue el **Portal Web de Herramientas Empresariales**, para
que cualquier agente de IA pueda mantener consistencia sin tener que
redescubrirla leyendo cada CSS del proyecto. No sustituye al código — ante
cualquier duda o discrepancia, `public/css/global.css` es la fuente de
verdad.

---

## 1. Dónde vive el sistema

Todo el sistema de diseño (tokens + componentes compartidos + utilidades)
está centralizado en **`public/css/global.css`**, dentro de un bloque
`:root` con variables CSS. Cada CSS de página/módulo lo hereda con:

```css
@import url('global.css');
```

Así lo hacen `public/css/login.css`, `public/css/dashboard.css` y
`public/modules/vales/css/styles.css`. **Ningún CSS de módulo debe redefinir
un color de marca con un valor hexadecimal propio** — si falta un matiz,
se agrega como token nuevo en `global.css`, no como valor suelto en el
archivo del módulo. Esto es lo que ha permitido, por ejemplo, recolorear
toda la app (login, dashboard, botones) cambiando un puñado de variables en
un solo lugar.

No hay framework de frontend ni Tailwind — HTML/CSS/JS vanilla, con
Ionicons para iconografía (`<ion-icon>`).

---

## 2. Paleta de colores

### 2.1 Azul de marca — dos roles, no un solo azul

El sistema usa **dos azules con roles distintos y deliberados**. No son
intercambiables:

| Token | Valor | Rol |
|---|---|---|
| `--color-primary` | `#2563EB` | **Selección / énfasis**: ítem activo del sidebar, chip de filtro activo, foco de teclado (`:focus-visible`), enlaces, hover de iconos de acción, texto de títulos/headings de card. |
| `--color-primary-hover` | `#1D4ED8` | Hover de elementos que usan `--color-primary`. |
| `--color-primary-light` | `#EFF6FF` | Fondos tenues (chips, estados info). |
| `--color-primary-dark` | `#1B2130` | **Fondo de acción primaria / superficie de marca sólida**: `.btn--primary` (todos los botones "Crear", "Confirmar", "Aprobar", "Ingresar al Portal"…), panel de marca del login, sidebar oscuro. El hero del dashboard **no** usa esta superficie — es intencionalmente minimalista, texto plano sobre `--color-bg` (ver §5). |
| `--color-primary-dark-hover` | `#242C3B` | Hover de `--color-primary-dark`. |

Regla práctica al tocar UI nueva: **¿es un botón/CTA o una superficie de
marca sólida (fondo grande)? → `--color-primary-dark`. ¿Es texto, un
borde, un estado "seleccionado/activo" o un detalle de énfasis? →
`--color-primary`.** Ver `--sidebar-bg`/`--sidebar-bg-footer` (§2.3): son
alias de `--color-primary-dark`/`-hover`, no un tercer azul.

### 2.2 Secundario y estados semánticos

| Token | Valor | Uso |
|---|---|---|
| `--color-secondary` / `-hover` | `#E85D04` / `#CC5200` | Acento naranja (enlaces secundarios, barra de acento del header). |
| `--color-success` / `-bg` | `#16A34A` / `#F0FDF4` | Estados positivos. |
| `--color-warning` / `-bg` | `#D97706` / `#FFFBEB` | Alertas, avisos. |
| `--color-danger` / `-bg` | `#DC2626` / `#FEF2F2` | Errores, acciones destructivas. |
| `--color-info` / `-bg` / `-text` | `#3B82F6` / `#EFF6FF` / `#1D4ED8` | Información neutra. |

### 2.3 Sidebar oscuro (dashboard shell)

Paleta tomada de `Pruebas/imagen sidebar.avif` (variante oscura), adaptada
para no introducir un tercer azul de marca:

```css
--sidebar-bg:         var(--color-primary-dark);       /* #1B2130 */
--sidebar-bg-footer:  var(--color-primary-dark-hover);  /* #242C3B */
--sidebar-border:     rgba(255, 255, 255, .08);
--sidebar-text:       #E7EAF0;
--sidebar-text-muted: #94A3B8;
--sidebar-hover-bg:   rgba(255, 255, 255, .07);
```

El ítem **seleccionado** del sidebar (`.sidebar-item-active`) usa
`--color-primary` (azul claro), no el fondo oscuro — es intencional, ver
§2.1.

### 2.4 Superficies y texto (modo claro — resto de la app)

```css
--color-bg:            #F8FAFC; /* fondo general */
--color-surface:       #FFFFFF; /* cards, modales, header */
--color-surface-muted: #F1F5F9; /* hover de filas, áreas secundarias */
--color-border:        #E2E8F0;
--color-text:           #0F172A;
--color-text-secondary: #475569;
--color-text-muted:     #94A3B8;
```

El proyecto **no tiene modo oscuro global** — lo "oscuro" es solo el
sidebar y las superficies de marca (`surface-dark`, §4), no un theme
alternativo para toda la app.

### 2.5 Paleta propia del módulo Vales de Arte

Bloque de colores de estado (`--vale-estado-*`) separado a propósito, sin
mezclar con primary/secondary — mismo criterio que tendría el semáforo de
Eventos o el pipeline de Gestión de Venta en otros módulos. Cubre tanto los
estados por taller (`vale_talleres.estado`) como los generales
(`vales.estado`). Ver bloque completo en `global.css` antes de agregar un
estado nuevo al dominio.

### 2.6 Colores por módulo (catálogo del dashboard)

Cada módulo del catálogo (`src/app.js`, endpoint `/api/modules`) trae su
propio color de acento, usado como `--module-color` inline en cada
`.module-card`:

| Módulo | Color |
|---|---|
| Vales de Arte | `#3B4C8C` (índigo profundo) |
| Generador de Prompts | `#0E7C7B` (verde azulado/teal) |
| Eventos y Carreras | `#B5541A` (terracota) |
| Administración Central | `#52525B` (gris neutro) |

Paleta elegida deliberadamente **desaturada/"jewel tone"**, no los colores
saturados por defecto (azul-morado-naranja-gris genéricos que traía el
catálogo original) — evita el "morado de IA" (`--color-primary` ya cubre el
azul de marca; ningún color de módulo debe ser un azul saturado igual o muy
cercano a `#2563EB`, ni un violeta saturado tipo `#7C3AED`). Un módulo nuevo
debe elegir un tono igualmente contenido (saturación moderada) y distinguible
de los anteriores.

---

## 3. Tipografía y escala

```css
--font-title: 'Outfit', 'Inter', sans-serif; /* h1–h6, KPIs, títulos de modal */
--font-body:  'Inter', sans-serif;           /* todo lo demás */
```

`Inter` es una elección intencional y ya sancionada para este proyecto
(hay una excepción de diseño registrada en `.impeccable/config.json` para
no volver a marcarla como hallazgo) — **no reemplazar por otra fuente** solo
porque una skill de diseño genérica lo sugiera.

Escala de tamaños: `--text-xs` (12px) → `--text-2xl` (32px), ver
`global.css` para la tabla completa con su uso recomendado por nivel.

---

## 4. Utilidades compartidas

Para no duplicar CSS entre páginas, existen utilidades reusables en
`global.css`:

- **`.surface-dark`** — la superficie "azul oscuro" completa: gradiente
  `--color-primary-dark → --color-primary-dark-hover`, cuadrícula técnica
  sutil (`::before`) y resplandor radial (`::after`). Hoy solo la usa el
  panel de marca del login — el hero del dashboard se probó con esta misma
  superficie y se revirtió a texto plano por pedido explícito ("minimalista
  sin fondo"), ver §5. **Cualquier superficie oscura de marca nueva debe
  reusar esta clase, no reinventar el gradiente**, pero no asumir que todo
  encabezado/hero debe llevarla — evaluar caso por caso.
- **`.text-accent`** — `color: var(--color-primary)`, para resaltar una
  palabra/frase puntual dentro de un saludo/titular (funciona tanto sobre
  `.surface-dark` como sobre fondo claro — se usa en ambos casos hoy: login
  y el saludo del dashboard). Patrón de "una sola palabra de énfasis", no
  abusar de él en un mismo bloque de texto.
- **`.btn` / `.btn--primary` / `.btn--ghost` / `.btn--danger`** — sistema
  canónico de botones. `.btn--primary` es la única definición de "botón de
  acción principal" de toda la app; no crear overrides locales de fondo por
  página (ver la limpieza que se hizo en `login.css`, que antes tenía su
  propio override redundante).
- **Scrollbars, `:focus-visible`, `prefers-reduced-motion`** — reglas
  globales aplicadas automáticamente a toda la app, no hay que repetirlas
  por módulo.

---

## 5. Patrones de componentes

- **Cards** (`.module-card`, `.data-table`, `.modal-box`): fondo
  `--color-surface`, borde `--color-border`, radios de `--radius-md`/`-lg`,
  sombra `--shadow-sm`/`-md`. Las cards de módulo del dashboard funcionan
  como fichas de un menú/launcher, no como cards de contenido, con un
  tratamiento **plano y directo** (nada de halos, degradados ni sombras
  difuminadas de color — se probaron y se retiraron por verse genéricas):
  barra superior sólida de 4px y bloque de ícono con relleno sólido, ambos en
  `--module-color`; ícono en blanco; borde y sombra neutra (`--shadow-lg`,
  sin tinte) al pasar el mouse, con el ícono escalando levemente
  (`transform: scale()`); título coloreado con `--module-color`; descripción
  recortada a 2 líneas (`-webkit-line-clamp`) para altura uniforme; y una
  fila de llamada a la acción **siempre visible** ("Abrir herramienta" +
  ícono anidado en círculo) — no un detalle que solo aparece en `:hover`,
  porque en un menú la afordancia de navegación debe ser explícita. Ver
  `public/css/dashboard.css` (`.module-card` y siguientes) y
  `public/js/dashboard.js` (`renderModules`).
- **Sidebar fijo del módulo Vales** (`public/modules/vales/`): patrón
  dashboard-shell — el header (`.app-header`) siempre ocupa el ancho
  completo arriba; el sidebar arranca *debajo* de él (`top:
  var(--header-height)`), nunca detrás. Colapsable, con offset propagado
  vía `--sidebar-offset` (JS hace `setProperty` en `documentElement`, y
  `.app-shell` lo usa como `margin-left`) en vez de duplicar lógica de
  ancho en dos sitios.
- **Botones/estados interactivos**: feedback táctil con `transform:
  scale()`/`translateY()` en `:active`, nunca cambios instantáneos.
- **Animaciones**: solo `transform`/`opacity` (GPU-safe) — nunca animar
  `width`/`height`/`top`/`left` directamente; ejemplo real: la barra de
  progreso de carga usa `transform: scaleX()` con `transform-origin`, no
  `width` animado. Todas las transiciones usan la curva única
  `--ease-out` en 3 velocidades (`--transition-fast/-normal/-slow`).
  Respetar siempre `prefers-reduced-motion` (ya resuelto a nivel global).

---

## 6. Filosofía de diseño (qué evitar)

Este es un **panel de herramientas B2B interno**, no una landing page de
marketing. La línea a seguir es la de dashboards funcionales tipo
Linear/Notion/Vercel: sobria, de alto contraste de información, con acentos
de color contenidos — no la de sitios "Awwwards" o agencia premium.

Evitar explícitamente, aunque una skill de diseño genérica lo sugiera:
- Glassmorphism/`backdrop-blur` pesado, mesh gradients, modo OLED negro puro.
- Whitespace masivo tipo landing page (`py-24`+), pills gigantes,
  animaciones "mágicas" de física de resorte, botones magnéticos.
- Cambiar la tipografía base (`Inter`/`Outfit`) sin que el usuario lo pida
  explícitamente — ya es una elección sancionada.
- Introducir un tercer azul de marca "porque queda bien" — extender el
  significado de `--color-primary` / `--color-primary-dark` en vez de sumar
  tokens nuevos redundantes.
- Halos/resplandores difuminados (`radial-gradient` translúcido, sombras
  con `color-mix()` esparcidas) como decoración de card — se probaron en las
  cards de módulo del dashboard y el usuario los mandó a quitar explícitamente
  por verse genéricos/"IA". Preferir bloques de color **sólidos y planos**
  (barra superior sólida, ícono con relleno sólido) para transmitir marca.
- Colores de acento saturados por defecto (azul/violeta/naranja/gris "de
  catálogo") para diferenciar módulos — usar una paleta desaturada tipo
  "jewel tone" (ver §2.6) en su lugar.

Cuando se instalen o usen skills de diseño externas (`.agents/Skills/*`),
tomar de ellas los principios técnicos/UX transferibles (jerarquía por
espaciado, contraste de acentos, feedback táctil, evitar sombras/bordes
genéricos) y descartar las que asuman un stack distinto (React/Tailwind) o
un tono de marca distinto (marketing/consumer) al de este proyecto.

---

## 7. Referencias cruzadas

- `.agents/reglas_autenticacion.md` — arquitectura de auth (no relacionado a
  diseño, pero mismo criterio de "un agente debe poder leer esto y no
  romper el sistema").
- `.agents/readme_modulo.md` — plantilla para módulos nuevos; su paso 2
  ("frontend, estilizado para calzar con `global.css`") remite a este
  documento para el detalle de paleta.
- Paleta oscura del sidebar/superficies de marca: tomada de una imagen de
  referencia (`Pruebas/imagen sidebar.avif`) que **no está versionada en el
  repo** — esa carpeta se dejó fuera de git a propósito porque contenía otro
  archivo sin relación (un documento personal). Los valores hex ya quedaron
  capturados en los tokens de `global.css` (§2.3), así que no depender de la
  imagen para reproducir la paleta.
