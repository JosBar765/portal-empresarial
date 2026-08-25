# Restauración de `.impeccable/config.json` (excepciones de diseño huérfanas)

## Qué pasó

El hook de diseño (`impeccable`) lee las excepciones ya sancionadas
(`ignoreValues`) desde una ruta **fija**: `<raíz del repo>/.impeccable/config.json`
— no busca en ninguna otra ubicación, ni siquiera dentro de `.agents/`.

Los commits de reorganización de `.agents/` (`nueva estructura carpeta
.agents`, `quitando viejas rutas`) copiaron ese archivo a
`.agents/.impeccable/config.json` y luego borraron el original en la raíz,
asumiendo que ambos eran equivalentes. No lo son: el hook nunca leyó la copia
movida, así que las excepciones ya sancionadas quedaron huérfanas y
empezaron a reaparecer como hallazgos "nuevos" en cualquier sesión posterior
que tocara esos archivos.

## Qué se restauró

Se volvió a crear `.impeccable/config.json` en la raíz del repo con el
**mismo contenido exacto** (mismas 6 excepciones, mismas fechas y razones
originales) que ya existía en `.agents/.impeccable/config.json` desde el
24/08/2026:

| Regla | Alcance | Motivo (resumen) |
|---|---|---|
| `overused-font` = `inter` | Global | Tipografía de marca ya sancionada — no reemplazar Inter. |
| `side-tab` = `*` | `public/css/global.css` | Borde izquierdo de color en el toast según tipo (éxito/error/aviso/info) — indicador semántico, no un "tell" decorativo de card. |
| `side-tab` = `*` | `public/css/dashboard.css` | Barra de acento por módulo en las cards del dashboard (`module-card::after`) — toque de marca deliberado, ya comentado como intencional en el CSS. |
| `layout-transition` = `*` | `public/modules/vales/css/styles.css` | Transición de `margin-left` al colapsar el sidebar — un solo elemento de baja frecuencia que necesita reflow real, no un squash con transform. |
| `codex-grid-background` = `*` | `public/css/login.css` | Cuadrícula decorativa del panel de marca del login — línea de diseño original. |
| `codex-grid-background` = `*` | `public/css/global.css` | Misma textura, centralizada en `.surface-dark` para que el hero del dashboard reuse la superficie de marca sin duplicar CSS. |

Verificado con `node .claude/skills/impeccable/scripts/hook-admin.mjs status`
— las 6 excepciones vuelven a aparecer listadas bajo `ignoreValues`.

## Por qué no se tocó el CSS

Ninguno de los 6 hallazgos correspondía a código nuevo: son patrones
preexistentes, ya evaluados y aceptados como parte de la línea de diseño del
proyecto (ver `.agents/reglas/sistema_diseno_ui.md`). El problema era
puramente de configuración — el archivo de excepciones apuntando a una ruta
que el hook no lee — no un defecto de diseño a corregir.

## Nota para el futuro

`.agents/.impeccable/config.json` sigue existiendo como copia de referencia
dentro de la carpeta reorganizada, pero **no es la que usa el hook**. Si se
vuelve a reorganizar `.agents/` o se limpia el repo, `.impeccable/config.json`
en la raíz debe permanecer intacto (o migrarse junto con una actualización
de la herramienta que lo lee) para no perder las excepciones sancionadas otra
vez.
