# Trazabilidad de cambios — `analisis_correcciones_13.md`, puntos 1-5

Este documento cubre los primeros 5 puntos del archivo de arreglo #13 — 5
correcciones puntuales al dashboard/modales de Vales de Arte ya existentes.
El punto 6 (Vista Administrador, una funcionalidad nueva y grande) se
implementa aparte, en un ciclo posterior — el propio documento pide
explícitamente commitear y pushear este trabajo antes de tocar el punto 6.

## 1. Contador "Atrasados" del dashboard: reactivo al contador combinado

**Archivo:** `src/modules/vales/services/valeService.js` — `obtenerDashboardGerencia`

Antes, `atrasados`/`porcentajeAtrasados` siempre se calculaban sobre el total
global de `enVentana`, sin importar si el usuario tenía seleccionado
"Modificados"/"Recibidos"/"En Progreso". Ahora, si hay un `filtroContador`
activo, "Atrasados" se recalcula sobre ESE subconjunto — tanto el número
como el % (interpretado como "de mis vales modificados, qué % está
atrasado", no como fracción del gran total). Sin selección, vuelve al total
global. Los otros 3 contadores nunca cambian con la selección — solo
Atrasados es reactivo, tal como pide el punto.

## 2. Modal "Aprobar y Fusionar": propuestas originales + corrección marcada con `*`

**Archivo:** `public/modules/vales/js/app.js` — `abrirModalAprobarGeneral`

Antes, para un vale `MOD-`, el modal solo mostraba el/los taller(es) al que
se mandó la corrección — perdiendo de vista las propuestas de los demás
talleres del vale original. Ahora, si `vale.vale_original_id` existe, se pide
también el detalle del vale ORIGINAL y se arma la lista a partir de SUS
talleres completos: para cada uno, si fue parte de la corrección se muestra
la propuesta corregida (con un `*` junto al nombre del taller) y si no, la
propuesta original tal cual. Se agregó una nota "* Corregido en esta
modificación." debajo de la lista cuando aplica. El hipervínculo "Ver vale de
arte (PDF)" se mantiene exactamente igual (apunta al vale de corrección
actual).

## 3. Vale `MOD-` no pasaba a "Confirmado" al ser recibido

**Archivo:** `src/modules/vales/services/valeService.js` — `estadoVisibleAsesor`

Bug real: esta función serví­a tanto al vale ORIGINAL (que al modificarse
queda `RECIBIDO` congelado para siempre y debe seguir viéndose como
"Modificado") como al vale `MOD-` NUEVO (que tiene su propio ciclo de vida y,
al ser confirmado, ya es un `RECIBIDO` real). El `case RECIBIDO` de la rama
de modificación siempre devolvía `'MODIFICADO'`, disfrazando para siempre al
vale nuevo también. Ahora se distingue por `vale.vale_original_id` (solo el
vale nuevo lo tiene poblado): si lo tiene, `RECIBIDO` → `'CONFIRMADO'`; si no
(es el original), sigue siendo `'MODIFICADO'`. Afecta tanto al asesor como al
Supervisor en Trabajo Realizado (ambos reusan esta misma función — el
comentario que mencionaba una `estadoVisibleSupervisor` aparte estaba
desactualizado, esa función nunca existió, se corrigió el comentario).

## 4. Modal "Ver info" del Supervisor: Taller(es) siempre en "-"

**Archivo:** `src/modules/vales/services/valeService.js` — `_enriquecerConTaller`

Bug real: el campo `taller` de un vale se armaba solo a partir de las filas
de `vale_talleres`, que no existen todavía para un vale en
`ESPERANDO_AUTORIZACION` (el fan-out ocurre recién al autorizar) — quedaba
`''` (string vacío), y el modal lo mostraba como "-". Justo el caso que más
le importa ver al Supervisor antes de autorizar. Ahora, si no hay filas
reales todavía, se resuelve desde `talleres_solicitados` (el CSV de ids que
el vale ya trae desde que se creó). Este helper es compartido por
`obtenerBuzon` y `obtenerDashboardGerencia`, así que el fix aplica
automáticamente a ambos (incluida la columna "Taller" del buzón normal, no
solo el modal de info).

## 5. Técnico: el filtro de estado del Buzón ya no ofrece "Aprobado"

**Archivo:** `public/modules/vales/js/app.js` — `poblarFiltroEstado`

El filtrado real (backend) y la acción "Ver propuesta" en Trabajo Realizado
ya estaban correctos desde `analisis_correcciones_12.md #5` (verificado
leyendo el código, sin bugs ahí). Lo único desalineado era el desplegable
"Todos los estados": ofrecía `APROBADO` incluso en el Buzón, donde un vale
aprobado nunca aparece (se muda a Trabajo realizado). Se separó
`CLAVES_ESTADOS_TECNICO` en `CLAVES_ESTADOS_TECNICO_BUZON`
(`ASIGNADO`/`EN_PROCESO`/`EN_REVISION`) y `CLAVES_ESTADOS_TECNICO_TRABAJO`
(`APROBADO`), elegidas según `state.vista` — mismo patrón que ya usan los
roles de encargado.

---

## Verificación

- `node --check` sobre los `.js` tocados.
- **Smoke test backend** (`smoke-correcciones13-puntos1a5.js`, 11
  aserciones): el contador de atrasados cambia al combinar con "modificados"
  sin afectar a los otros 3; un vale `MOD-` confirmado se ve `CONFIRMADO` en
  Trabajo Realizado, mientras su original sigue `MODIFICADO`; un vale recién
  creado en `ESPERANDO_AUTORIZACION` expone su(s) taller(es) solicitados
  antes de autorizar; un vale original multi-taller conserva sus 2 talleres
  para el merge del frontend, mientras su `MOD-` solo trae el taller
  corregido.
- **`npm run dev` + navegador** (Claude in Chrome, multi-rol vía fetch
  directo): dashboard de Gerente — clic en "Modificados" cambia la tarjeta
  de Atrasados de "12 (92%)" a "1 (50%)", y vuelve a "12 (92%)" al
  deseleccionar; modal "Aprobar y fusionar" de un vale `MOD-` corrigiendo
  solo Diseño UV/3D de un original Diseño+Diseño UV/3D muestra ambos
  talleres con sus propuestas reales y distintas ("Diseño" → propuesta
  original, "Diseño UV/3D*" → propuesta corregida, con la nota al pie); el
  vale `MOD-` confirmado aparece como "Confirmado" (verde) en Trabajo
  Realizado del asesor, su original sigue "Modificado"; "Ver info" del
  Supervisor sobre un vale `ESPERANDO_AUTORIZACION` multi-taller muestra
  "Diseño, Diseño UV/3D" en vez de "-"; el filtro de estado del técnico en
  Buzón ofrece solo Asignado/En Proceso/En Revisión, y en Trabajo realizado
  solo Aprobado. Sin errores en consola.
- Commiteado y subido a `vales-de-arte` — instrucción explícita del propio
  documento de correcciones antes de empezar el punto 6.

## Siguiente paso

Punto 6: Vista de Administrador — funcionalidad nueva (Gestionar Usuarios,
Roles y Permisos, Actividad de Usuarios, Gestionar Categorías, Gestionar
Tiendas, Modo Mantenimiento) que reemplaza el dashboard normal solo para el
rol Administrador. Se planea aparte. El documento de instrucciones tiene un
hueco: la pestaña "Gestionar Categorías" aparece en la lista del sidebar
pero no tiene sección de contenido definida — se le preguntará al usuario
qué debe contener antes de planear.
