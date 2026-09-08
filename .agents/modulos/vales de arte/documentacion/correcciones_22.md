# Correcciones #22 — Auditoría del proyecto contra `.agents/reglas/*`

Origen: `analisis_correcciones_22.md`, sección "Análisis de Proyecto". Este
documento es **solo el informe de auditoría** — ninguna de las correcciones
que propone aquí abajo se ha aplicado todavía; se documentan para que el
usuario y su equipo las validen primero, tal como pide el propio documento
fuente. Los tres puntos numerados de `analisis_correcciones_22.md` (broadcast
de autorización a todos los supervisores, catálogo de producto/material →
texto libre, y quitar el fallback de base de datos en memoria) se manejan
aparte, como una implementación directa, no como parte de esta auditoría.

## Método

Se leyeron los 6 archivos de `.agents/reglas/` completos
(`reglas_arquitectura.md`, `reglas_archivosSQL.md`, `reglas_autenticacion.md`,
`reglas_disenoUI.md`, `reglas_implementacion.md`, `reglas_modulo.md`) y se
contrastaron contra: la estructura real de `src/` y `public/`, el tamaño y
contenido de los archivos de `services/`, los tres archivos SQL de
`database/`, y las referencias cruzadas entre documentos de `.agents/`.

---

## 1. Comentarios de ciclo de corrección en todo el backend

**Regla relacionada:** `reglas_implementacion.md` ("nunca referencies un
ciclo de correcciones en un comentario... esa información va en el
changelog, no en el código") — regla escrita a raíz del refactor del
frontend de Vales (#21), nunca aplicada al backend.

**Qué se encontró:** 232 comentarios `// analisis_correcciones_N.md...`
repartidos en los **23 archivos JS de `src/`** (backend completo:
`valeService.js`, `valePdfService.js`, todos los repositorios de vales y de
admin, `authService.js`, `authController.js`, `database.js`, `app.js`,
etc.) — ninguno se salva. Es el mismo patrón que ya se limpió del frontend de
Vales en la corrección #21, pero nunca se replicó hacia el backend.

**Archivos afectados:** los 23 listados arriba (ver
`grep -rc "analisis_correcciones_" src --include="*.js"` para el detalle por
archivo).

**Qué se corregirá (pendiente de validación):** una pasada archivo por
archivo que conserve el *porqué* no obvio de cada comentario (reescrito, sin
el nombre del documento de corrección) y elimine el resto. Es un cambio de
solo comentarios — cero riesgo de romper comportamiento — pero por su tamaño
(23 archivos) se recomienda hacerlo en 2–3 lotes, no en una sola pasada, para
poder revisar el diff con calma.

**Por qué queda pendiente:** el volumen (23 archivos, 232 ocurrencias) hace
que sea un cambio significativo por sí solo; el propio documento fuente pide
no actuar todavía sobre los hallazgos de esta sección.

---

## 2. `valeService.js`: 2264 líneas, un solo archivo

**Regla relacionada:** `reglas_arquitectura.md` §14.2 ("no crear archivos
monolíticos con cientos o miles de líneas si la lógica puede dividirse") y
§7 ("los services contienen la lógica de negocio") sin más detalle sobre
tamaño — `reglas_implementacion.md` sí da un criterio concreto (aplicado
hasta ahora solo al frontend): "mezcla responsabilidades no relacionadas" +
"cuesta trabajo encontrar una función".

**Qué se encontró:** `src/modules/vales/services/valeService.js` es el
archivo más grande de todo el backend (2264 líneas — el siguiente más grande,
`valePdfService.js`, tiene 433). Mezcla, en una sola clase: catálogos,
creación de vale, autorización de creación, asignación/revisión por taller,
aprobación y fusión, decisión del asesor, solicitud/aprobación de
modificación, historial, carga de trabajo, y los helpers de bajo nivel
(`_conLockDeVale`, `_validarDatosVale`, `_fanOutTalleres`, etc.) — es, en
espíritu, el mismo problema que tenía `public/modules/vales/js/app.js` antes
de la corrección #21, del lado del backend.

**Archivos afectados:** `src/modules/vales/services/valeService.js`.

**Qué se corregirá (pendiente de validación):** dividir en varios servicios
más pequeños por responsabilidad (p. ej. `valeCreacionService`,
`valeAutorizacionService`, `valeTallerService`, `valeModificacionService`),
siguiendo el mismo criterio ya documentado en `reglas_implementacion.md` para
el frontend — sin cambiar ningún endpoint, contrato de datos ni regla de
negocio. `_conLockDeVale`/`_colaCreacionPorAsesor` (el mutex en memoria por
vale) tendría que vivir en un lugar compartido por todos los servicios
resultantes, ya que hoy lo comparten todas las transiciones de estado.

**Por qué queda pendiente:** es un cambio de alto riesgo relativo (un
service de 2264 líneas con un mutex compartido y transiciones de estado
entrelazadas) — exactamente el tipo de refactor que este mismo documento pide
no aplicar sin validación previa.

---

## 3. Referencias a documentos que ya no existen

**Regla relacionada:** ninguna regla explícita — es una inconsistencia de
mantenimiento de la propia documentación (`.agents/`), que igualmente compete
a "coherencia entre distintas partes del proyecto" (punto 3 del documento
fuente).

**Qué se encontró:** `CLAUDE.md` y `reglas_disenoUI.md` remiten a
`.agents/autenticacion_jwt.md` y `.agents/readme_modulo.md` como las fuentes
autoritativas de autenticación y de creación de módulos — ninguno de los dos
archivos existe hoy en el repo. Ese contenido ya vive, consolidado, en
`.agents/reglas/reglas_autenticacion.md` y `.agents/reglas/reglas_modulo.md`
respectivamente — pero las referencias cruzadas nunca se actualizaron.

**Archivos afectados:** `CLAUDE.md` (sección "Adding a new business module" y
la nota sobre "Auth is JWT, not sessions"), `.agents/reglas/reglas_disenoUI.md`
(§7, "Referencias cruzadas").

**Qué se corregirá (pendiente de validación):** actualizar ambas referencias
para que apunten a `reglas_autenticacion.md`/`reglas_modulo.md`.

**Por qué queda pendiente:** cambio trivial y de cero riesgo — se deja
agrupado con el resto para que el usuario revise el paquete completo de una
vez, no porque sea complejo.

---

## 4. `reglas_autenticacion.md`: rutas de archivo de otra máquina

**Regla relacionada:** ninguna regla explícita — defecto de mantenimiento de
la documentación.

**Qué se encontró:** todos los enlaces `file:///c:/Users/Usuario-PC/Desktop/
Proyectos/portal-empresarial/...` de `reglas_autenticacion.md` apuntan a una
ruta de un equipo distinto al de este repositorio (`Usuario-PC`, carpeta
`Proyectos`) — quedaron así desde que se redactó el documento en otra
máquina.

**Archivos afectados:** `.agents/reglas/reglas_autenticacion.md` (todo el
§3).

**Qué se corregirá (pendiente de validación):** quitar los enlaces
`file://` absolutos (que nunca pueden ser correctos de forma portable entre
máquinas) y dejar solo las rutas relativas al repo, que es como se referencia
todo lo demás en `.agents/`.

**Por qué queda pendiente:** cambio trivial, agrupado con el punto 3.

---

## 5. Regla contradictoria: ¿dónde van los permisos nuevos?

**Regla relacionada:** `reglas_autenticacion.md` §4 punto 4 ("Añade los
permisos correspondientes... en `database/schema.sql`") **contradice**
`reglas_archivosSQL.md` ("`schema.sql` — estructura pura. Solo `CREATE
TABLE`... Ningún `INSERT`"; los catálogos como `permisos`/`rol_permisos` van
en `seed.sql`).

**Qué se encontró:** dos reglas del propio proyecto se contradicen sobre
dónde debe ir un `INSERT` de permisos nuevo. La implementación real
(`database/seed.sql` contiene los `INSERT INTO permisos`/`rol_permisos`, no
`schema.sql`) confirma que `reglas_archivosSQL.md` es la regla correcta y
`reglas_autenticacion.md` quedó desactualizada — probablemente escrita antes
de que existiera la separación `schema.sql`/`seed.sql`/`mock.sql`.

**Archivos afectados:** `.agents/reglas/reglas_autenticacion.md` §4.

**Regla que debería revisarse:** `reglas_autenticacion.md` §4 punto 4 — debe
decir `seed.sql`, no `schema.sql`, para no contradecir `reglas_archivosSQL.md`
ni la implementación real.

**Qué se corregirá (pendiente de validación):** corregir esa única línea.

---

## 6. `reglas_arquitectura.md`: estructura de `database/` desalineada

**Regla relacionada:** `reglas_arquitectura.md` §5 describe
`database/migrations/` + `database/seeds/` (carpetas, plural) como la
estructura esperada.

**Qué se encontró:** la implementación real —y la única documentada con
detalle, en `reglas_archivosSQL.md`— es `database/schema.sql`,
`database/seed.sql`, `database/mock.sql` (tres archivos planos, no
carpetas). `reglas_arquitectura.md` nunca se actualizó cuando se adoptó ese
esquema.

**Archivos afectados:** `.agents/reglas/reglas_arquitectura.md` §5.

**Regla que debería revisarse:** el sketch de `database/` en
`reglas_arquitectura.md` §5 — debería reemplazarse por el esquema real de
tres archivos (o simplemente remitir a `reglas_archivosSQL.md` en vez de
duplicar/discrepar).

**Qué se corregirá (pendiente de validación):** actualizar el sketch.

**Nota menor relacionada:** el mismo §5 de `reglas_arquitectura.md` también
lista `src/core/notifications/` como carpeta esperada del core; hoy `src/core/`
solo tiene `auth/`, `files/`, `permissions/`, `websocket/` — las
notificaciones en tiempo real se resuelven vía el mismo `websocket/`
(`vale_evento`) y hay notificaciones de escritorio de Windows aparte
(`.agents/modulos/vales de arte/documentacion/notificaciones_windows.md`).
El propio documento aclara que su estructura es "aproximada", así que esto no
se marca como incumplimiento — se anota solo como posible ajuste editorial.

---

## 7. Aspectos que ya cumplen correctamente las reglas

Para que el informe no sea solo una lista de problemas:

- **Permisos en el backend, nunca solo en el frontend** (regla de
  `reglas_arquitectura.md` §9): cada ruta de `src/modules/admin/routes.js` y
  `src/modules/vales/routes.js` está guardada con `requirePermission(...)` a
  nivel de ruta — no hay ningún endpoint de escritura sin guardia.
- **Patrón de módulo backend** (`reglas_modulo.md`): `valeController.js`,
  `adminController.js`, `valeService.js`, `adminService.js` y todos los
  repositorios siguen el patrón `class X { ... } module.exports = new X()`
  documentado en la guía, de forma consistente en los dos módulos existentes.
- **SQL solo en repositories**: no se encontró ninguna consulta SQL fuera de
  `repositories/` en ninguno de los dos módulos.
- **Un único sistema de autenticación/WebSocket transversal**
  (`reglas_arquitectura.md` §14.6/§14.7): ambos módulos reutilizan
  `authenticateJWT`/`requirePermission` y `socketManager` — no hay ninguna
  reimplementación paralela.
- **Concurrencia sobre un mismo vale**: `valeService._conLockDeVale` ya
  serializa correctamente las transiciones de estado sobre un mismo vale
  (mutex en memoria, válido porque el sistema corre en un solo proceso Node)
  — no hay una condición de carrera real de "doble autorización"; lo que
  faltaba (ver corrección #22, punto 1) era la sincronización en tiempo real
  hacia los supervisores que NO ejecutaron la acción, no la integridad del
  dato en sí.

---

## 8. Recomendaciones adicionales

- Antes de emprender el punto 2 (dividir `valeService.js`), conviene
  documentar primero un mapa de qué función depende de qué otra (mismo primer
  paso que se siguió para la corrección #21 del frontend) — un archivo de
  2264 líneas con un mutex compartido tiene más superficie de riesgo que el
  `app.js` de 2732 líneas del frontend, porque acá sí hay estado de
  concurrencia real entre las funciones, no solo estado de UI.
- La limpieza de comentarios (punto 1) es mecánicamente segura pero grande;
  conviene hacerla en lotes por módulo (`vales` primero, `admin`/`core`
  después) para que cada commit sea revisable.
- Los puntos 3–6 (referencias cruzadas y una regla contradicha) son de costo
  casi nulo — se podrían aplicar en un solo commit corto una vez validados,
  sin necesidad de más análisis.
- Ninguna regla de `.agents/reglas/` resultó "innecesariamente compleja" ni
  en conflicto con la arquitectura real más allá de lo ya señalado en los
  puntos 3–6 — el resto de lo auditado (autenticación JWT, permisos,
  estructura de módulos, diseño UI) está alineado con la implementación
  actual.
