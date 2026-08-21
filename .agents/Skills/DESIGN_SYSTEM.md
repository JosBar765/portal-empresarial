# Sistema de diseño — eventos_mt (MundiTrofeos S.A. / Grupo Premia)

Referencia de la línea visual real del CRM, extraída directamente de
`css/global.css` y del resto de hojas de estilo del proyecto (no es un
sistema aspiracional: documenta lo que YA existe y se usa en producción).
Su propósito es que cualquier herramienta o persona que agregue una
pantalla, componente o página nueva lo haga de forma indistinguible del
resto del sistema.

**Antes de usar este documento**, dos restricciones duras que no son
omisiones a corregir, sino decisiones de producto vigentes:

- **No hay modo oscuro.** Cero `prefers-color-scheme`/`data-theme` en todo
  el CSS del proyecto. Todos los colores están escritos como valores fijos
  de tema claro. No agregar soporte de dark mode salvo que se pida
  explícitamente — sería alcance nuevo, no "completar" el sistema.
- **Es una herramienta de escritorio, no un sitio responsive.** El shell
  completo usa `height:100vh; overflow:hidden` (no hace scroll de página,
  solo paneles internos). Solo existen 2 `@media query` en las ~8.400
  líneas de CSS del proyecto (reduced-motion y un breakpoint de 768px que
  solo colapsa una grilla de KPIs de 4 a 2 columnas). No hay sidebar
  colapsable ni menú hamburguesa. No diseñar mobile-first para este
  sistema.

Sin framework, sin build step: CSS plano servido directo (`css/*.css`), sin
preprocesador, sin utilidades tipo Tailwind. Los tokens abajo son variables
CSS nativas definidas en `:root` (`css/global.css:9-101`).

---

## 1. Tokens de diseño

### 1.1 Color

Paleta canónica de toda la app (Eventos, Gestión de Venta, Contactos,
Admin) — definida una sola vez en `css/global.css`:

```css
/* Primario — azul institucional profundo */
--color-primary:        #2563EB;
--color-primary-hover:  #1D4ED8;
--color-primary-light:  #EFF6FF;
--color-primary-border: #C7D5E8;
--color-primary-rgb:    37, 99, 235;   /* para rgba() */

/* Secundario — acento naranja */
--color-secondary:       #E85D04;
--color-secondary-hover: #CC5200;

/* Estados semánticos (cada uno con su bg tenue a juego) */
--color-success: #16A34A;  --color-success-bg: #F0FDF4;
--color-warning: #D97706;  --color-warning-bg: #FFFBEB;
--color-danger:  #DC2626;  --color-danger-bg:  #FEF2F2;
--color-info:    #3B82F6;  --color-info-bg:    #EFF6FF;  --color-info-text: #1D4ED8;

/* Superficies */
--color-bg:            #F8FAFC;  /* fondo general de la app */
--color-surface:       #FFFFFF;  /* cards, modales */
--color-surface-muted: #F1F5F9;  /* áreas secundarias, hover de filas */
--color-border:        #E2E8F0;
--color-border-focus:  #93C5FD;

/* Texto */
--color-text:           #0F172A;  /* primario */
--color-text-secondary: #475569;
--color-text-muted:     #94A3B8;  /* terciario / placeholder */
```

**Dos paletas de estado que NO se deben mezclar entre sí** (uso distinto,
comentado explícitamente en el código fuente):

```css
/* Semáforo operativo de eventos (4 valores, kanban de Eventos) */
--color-estado-programado:  #2563EB;
--color-estado-seguimiento: #D97706;
--color-estado-urgencia:    #DC2626;
--color-estado-descartado:  #6B7280;

/* Pipeline comercial de Gestión de Venta (5 valores, deliberadamente
   separado del semáforo de arriba — no reutilizar uno por otro) */
--gv-pipe-0: #CBD5E1;              /* no contactado */
--gv-pipe-1: #EAB308;              /* contactado — amarillo */
--gv-pipe-2: var(--color-secondary); /* cotizado — naranja */
--gv-pipe-3: var(--color-success);   /* vendido — verde */
--gv-pipe-4: var(--color-danger);    /* perdido — rojo */
```

**Convención de badges/pills**: fondo del tono `-bg`/`-light` del color
semántico + texto en el color base + borde 1px de un tono intermedio,
`radius-full`, 10px, `font-weight:700`, mayúsculas, `letter-spacing:.05em`
(ver `.badge-estado--*`, `.badge-rol--*` en `css/admin.css:213-240`).

**⚠️ `login.html`/`login.css` es una paleta aparte, a propósito.** Define su
propio `:root` ("Precision Logistics Architecture Design Tokens", estilo
Material 3) y redefine `--color-primary` como `#022448` (azul marino
oscuro, nada que ver con el `#2563EB` del resto del sistema), con su propia
escala de radios (4/8/12/16/24). Es un espacio visual intencionalmente
distinto — la "puerta de entrada" — no una inconsistencia a corregir. No
copiar sus tokens al resto de la app, ni viceversa.

### 1.2 Tipografía

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800;900&display=swap');

--font-title: 'Outfit', 'Inter', sans-serif;   /* h1-h6, KPIs, títulos de modal */
--font-body:  'Inter', sans-serif;             /* todo lo demás */
```

- **Outfit** solo para titulares/valores destacados (h1-h3 en 600,
  h4-h6 en 500, cifras de KPI, títulos de modal). **Inter** para todo el
  resto — cuerpo, tablas, formularios, botones.
- Escala tipográfica (rem, base 16px):

  | Token | Valor | Uso |
  |---|---|---|
  | `--text-xs` | 0.75rem (12px) | badges, etiquetas |
  | `--text-sm` | 0.8125rem (13px) | texto secundario |
  | `--text-base` | 0.9375rem (15px) | cuerpo principal |
  | `--text-md` | 1.0625rem (17px) | subtítulos |
  | `--text-lg` | 1.25rem (20px) | títulos de sección |
  | `--text-xl` | 1.5rem (24px) | títulos de página |
  | `--text-2xl` | 2rem (32px) | KPIs grandes |

- Etiquetas en mayúsculas (encabezados de tabla, títulos de sidebar,
  badges) llevan siempre `letter-spacing: .05em–.1em` + `font-weight:700`.
- `body` activa `font-feature-settings: "tnum" 1, "cv02" 1, "cv03" 1, "cv04" 1`
  — numerales tabulares (columnas de cifras alineadas) + alternos
  estilísticos de Inter. Es deliberado: cualquier UI nueva con muchos
  números (KPIs, tablas de montos) debe heredar esto vía `body`, no
  desactivarlo.

### 1.3 Radios, sombras y transiciones

```css
/* Radios */
--radius-xs: 4px;    /* detalles pequeños */
--radius-sm: 6px;    /* botones, inputs, chips pequeños */
--radius-md: 10px;   /* cards, íconos en caja */
--radius-lg: 16px;   /* cards grandes, modales, paneles */
--radius-xl: 24px;
--radius-full: 9999px; /* badges, pills, avatares */

/* Sombras — 4 niveles neutros + 1 con tinte de marca */
--shadow-sm: 0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.05);
--shadow-md: 0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.05);
--shadow-lg: 0 12px 32px rgba(0,0,0,.10), 0 4px 8px rgba(0,0,0,.06);
--shadow-xl: 0 24px 48px rgba(0,0,0,.14), 0 8px 16px rgba(0,0,0,.06);
--shadow-premium: 0 20px 25px -5px rgba(37,99,235,.1), 0 10px 10px -5px rgba(37,99,235,.04);

/* Transiciones — una sola curva "snappy" en 3 velocidades */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--transition-fast:   120ms var(--ease-out);
--transition-normal: 220ms var(--ease-out);
--transition-slow:   360ms var(--ease-out);
```

No hay una escala numérica de espaciado (`--space-1..n`); el espaciado es
puntual por componente, pero converge de forma consistente en
4/6/8/10/12/16/20/24px — usar esos valores, no inventar otros.

`--shadow-premium` está **teñida de azul de marca**, no es gris neutro
como las otras — se reserva para paneles flotantes "importantes"
(selector de año, panel de alertas), no para cualquier dropdown.

---

## 2. Estructura del shell

Layout fijo de escritorio, siempre el mismo esqueleto en todas las
pantallas internas (no en `login.html`):

```html
<div class="app-container">           <!-- flex column, 100vh, overflow:hidden -->
  <header class="app-header">…</header>   <!-- 70px, barra de acento degradada abajo -->
  <div class="main-wrapper">              <!-- flex row -->
    <aside class="app-sidebar">…</aside>  <!-- 288px fijo, blanco, borde derecho -->
    <main class="app-main">…</main>       <!-- flex:1, scroll propio, padding 24px -->
  </div>
</div>
```

El acento de marca del header **no** es un fondo de color ni un borde
superior — es una barra de 3px con gradiente de tres paradas debajo del
header:

```css
.app-header::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 3px;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-hover) 55%, var(--color-secondary) 100%);
}
```

Esta es la firma visual más reconocible del "chrome" de la app — cualquier
pantalla nueva que reutilice el shell la hereda automáticamente; no
recrearla con otro estilo (fondo sólido, borde superior, etc.) en una
pantalla nueva.

---

## 3. Componentes

### 3.1 Botones — sistema canónico: `.btn` + modificador

```html
<button class="btn btn--primary">Guardar</button>
<button class="btn btn--ghost">Cancelar</button>
<button class="btn btn--danger">Eliminar</button>
<button class="btn btn--primary btn--sm">Chico</button>
<button class="btn btn--primary btn--loading" disabled>Guardando…</button>
```

- Base: `inline-flex`, `gap:.375rem`, padding `.5625rem 1rem`,
  `radius-sm`, `font-weight:500`, `:active{transform:scale(.975)}`.
- `--primary` (relleno azul), `--ghost` (transparente + borde), `--danger`
  (relleno tenue rojo). Tamaños `--sm`/`--lg`. `--loading` agrega un
  spinner con `::after` y baja opacidad.
- Existen alias de compatibilidad `.btn-primary`/`.btn-secondary`/
  `.btn-light` — funcionan, pero para UI nueva usar `.btn .btn--*`.
- **`.btn-login` NO pertenece a este sistema** — es un botón de
  `css/login.css` (paleta propia). Se ve reutilizado por nombre de clase
  en algunas páginas de admin sin que esas páginas carguen `login.css`,
  apoyándose solo en `style="..."` inline para el color — es deuda
  técnica, no un patrón a copiar. Para un botón primario en cualquier
  pantalla que no sea el login, usar `.btn .btn--primary`.

**Botón de acción dentro de una tabla admin** (editar/activar/eliminar en
una fila): `.btn-admin-action` (`css/admin.css`) — más chico (`6px 12px`),
con variantes tintadas `--edit` (azul), `--toggle` (naranja), `--danger`
(rojo), cada una tomando el trío bg/borde/texto del color semántico
correspondiente.

### 3.2 Cards

```html
<!-- Tarjeta de estadística (paneles de admin) -->
<div class="stat-card">
  <div class="stat-icon primary"><ion-icon name="business-outline"></ion-icon></div>
  <div class="stat-info">
    <span class="stat-value">11</span>
    <span class="stat-label">Tiendas Activas</span>
  </div>
</div>
```

`.stat-card`: blanca, bordeada, `radius-md`, ícono en caja de 48px tintada
al 10% de opacidad del color semántico (`.stat-icon.primary/success/
warning/danger/info`), `hover{translateY(-2px); shadow-md}`.

`.admin-content-card`: contenedor exterior de tablas/listas de admin —
`radius-lg`, `shadow-sm`.

`.event-card` (la unidad "hero" del catálogo de Eventos/GV): blanca,
`radius-lg`, sombra doble suave, **sin borde lateral de color** — el
comentario del propio CSS lo deja explícito
(`css/eventos.css:311`: *"Sin borde lateral: el estado se comunica
mediante chip en la imagen"*). El estado se comunica con un chip sobre la
imagen de portada, no con el borde de la tarjeta. `hover{translateY(-3px)}`.

### 3.3 Tablas admin

```html
<table class="admin-table sticky-header">
  <thead>
    <tr><th data-sort="nombre">Tienda</th>…</tr>
  </thead>
  <tbody>…</tbody>
</table>
```

`th` en mayúsculas 12px con letter-spacing sobre `#F8FAFC`; encabezados
ordenables por clic vía `js/sortable_table.js` (`data-sort="campo"` +
`iniciarTablaOrdenable()`) — hover pasa a azul primario, la columna activa
muestra el ícono de orden relleno. Filas con hover que tinta el fondo,
padding `14px 20px`, sin borde en la última fila.

### 3.4 Modales

```html
<div class="admin-modal-overlay">
  <div class="admin-modal-card">
    <h3><ion-icon name="business-outline"></ion-icon> Título</h3>
    …
  </div>
</div>
```

Overlay `rgba(15,23,42,.4)` + `backdrop-filter: blur(8px)`. Tarjeta:
blanca, `radius-lg`, 32px de padding, `max-width` según contenido
(típicamente 420-500px), `shadow-xl`, entra con `modalFadeIn .3s`
(escala + translateY). Título = ícono 22px en azul primario + `h3` en
Outfit 700.

### 3.5 Toasts — usar `window.toast`, no `.roles-toast`

```js
window.toast.success('Guardado', 'La tienda se actualizó correctamente.');
window.toast.error('Error', 'No se pudo guardar.');
window.toastDeshacer(`"${nombre}" desactivada`, async () => { /* revertir */ });
```

`window.toast` es el sistema canónico: pila fija abajo-a-la-derecha,
tarjeta blanca con **borde izquierdo de 3px** de color (no relleno
completo), entra deslizando desde la derecha. La variante
`toastDeshacer`/`.toast--undo` agrega un botón "Deshacer" inline con una
barra de progreso que se agota — es el patrón preferido para acciones
destructivas reversibles (desactivar, quitar) **en vez de** un diálogo de
confirmación modal.

`.roles-toast` (banner inline, fondo tintado completo, usado en un par de
pantallas de admin) es un patrón secundario/heredado — no usarlo para UI
nueva salvo que se necesite un aviso inline no flotante.

### 3.6 Formularios

```html
<div class="form-group">
  <label for="t-nombre">Nombre de la tienda</label>
  <input id="t-nombre" type="text" class="form-input" required>
</div>
```

`.form-group` + `.form-input`/`.form-select` es el sistema más usado
(label en mayúsculas 11px, input compacto `8px/12px`). Existe también un
sistema paralelo más nuevo `.field`/`.field__input`/`.field__label`
(BEM, con modificador `required` para el asterisco) — ambos comparten el
mismo estilo de foco (`border-color:primary` + halo
`box-shadow:0 0 0 3px rgba(primary,.1)`). Para UI nueva, cualquiera de los
dos es válido — son visualmente idénticos — pero no mezclar ambos dentro
de un mismo formulario.

### 3.7 Otros patrones reutilizables

- **Switch** (`.switch`/`.slider`): toggle estilo iOS, 44×24px, azul
  cuando está activo.
- **Chips de selección** (`.country-chip`): checkbox disfrazado de chip
  (código de país + nombre); seleccionado = fondo `primary-light` + borde
  primario + badge de código invertido a relleno primario.
- **Nav en pastilla** (`.modules-nav`): contenedor blanco bordeado,
  `radius-lg`, alberga botones-pastilla (ej. selector Eventos / Gestión de
  Venta).
- **Tabs de estado con brillo por color** (`.status-tab-btn`): cada
  `data-tab` tiene su propio color activo hardcodeado + una sombra de
  "glow" a juego + `translateY(-2px)` al activarse (ej. programado en
  azul con `box-shadow:0 4px 14px rgba(59,130,246,.35)`). No es un solo
  estilo "activo" genérico reutilizado — cada estado tiene su propio
  tratamiento. Ver `css/eventos.css:79-133`, reutilizado en Gestión de
  Venta.

---

## 4. Patrones distintivos (lo que hace que esto se vea "de la casa")

Estos son los detalles que, si se omiten, hacen que una pantalla nueva se
sienta genérica en vez de parte del sistema:

1. **Sombras con tinte de marca en elementos flotantes** (`--shadow-premium`,
   azul, no gris) — reservada para dropdowns "importantes" (selector de
   año, panel de alertas).
2. **Pestañas de estado con brillo por color propio**, no un solo estilo
   "activo" genérico (ver 3.7).
3. **El pipeline comercial de 5 etapas es una fila de puntos clicables
   conectados por líneas** (`.gv-dot`/`.gv-line`), no un `<select>`:
   círculos de 16px coloreados por `--gv-pipe-N`, con `hover{scale(1.2)}`
   y un estado "bloqueado" con anillo punteado. Es central a la identidad
   visual de Gestión de Venta — preferir este patrón sobre un dropdown
   para cualquier flujo de etapas similar.
4. **El estado de una tarjeta de evento se comunica con un chip sobre la
   imagen, nunca con el borde de la tarjeta** (ver 3.2).
5. **El acento de marca del header es una barra de gradiente de 3px**, no
   un header de color sólido (ver sección 2).
6. **Numerales tabulares activados globalmente** (`font-feature-settings`
   en `body`) — cualquier tabla o KPI con cifras hereda esto automático;
   no hay que activarlo aparte.
7. **Patrón "Deshacer" en vez de diálogo de confirmación** para acciones
   reversibles (desactivar, quitar de una lista) — ver 3.5. Reservar el
   diálogo de confirmación modal para lo verdaderamente irreversible.

---

## 5. Iconografía

Ionicons **v7.1.0** vía CDN, siempre con el par módulo/no-módulo:

```html
<script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
<script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
```

Sin token fijo de tamaño — se controla con `font-size` inline en el propio
`<ion-icon>`, según contexto: ~14px en botones de acción de tabla, 18-22px
en encabezados/títulos de modal, 32-38px en estados vacíos.

---

## 6. Qué usar vs. qué no propagar

| Necesitas… | Usa esto | No esto (heredado/inconsistente) |
|---|---|---|
| Botón primario | `.btn .btn--primary` | `.btn-login` fuera del login |
| Notificación flotante | `window.toast.success/error(...)` | `.roles-toast` (solo para bandas inline puntuales) |
| Acción reversible | `window.toastDeshacer(...)` | Diálogo de confirmación modal |
| Campo de formulario | `.form-group`/`.form-input` o `.field`/`.field__input` (no mezclar los dos en un mismo form) | — |
| Paleta de color | tokens de `css/global.css` | tokens de `css/login.css` (paleta aparte, solo para el login) |

---

## 7. Checklist rápido para una pantalla/componente nuevo

- [ ] Usa los tokens de la sección 1 (colores, radios, sombras,
      transición) — nunca un hex/px suelto que no esté ya en la paleta.
- [ ] Si vive dentro del shell de la app, reutiliza `.app-container`/
      `.app-header`/`.app-sidebar`/`.app-main` tal cual, sin recrear el
      acento de marca del header a mano.
- [ ] Botones vía `.btn .btn--*`; toasts vía `window.toast`.
- [ ] Etiquetas/encabezados en mayúsculas siguen el patrón
      `letter-spacing:.05-.1em; font-weight:700`.
- [ ] No agrega soporte de dark mode ni diseño responsive/mobile salvo
      que se pida explícitamente — no son huecos del sistema, son alcance
      fuera de este proyecto.
- [ ] Si el color de estado que necesitas ya existe en el semáforo de
      Eventos (4 valores) o el pipeline de Gestión de Venta (5 valores),
      reutiliza esa paleta — no inventes una tercera.
