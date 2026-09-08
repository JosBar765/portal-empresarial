# Correcciones #22, punto 1 — Comentarios de ciclo de corrección en el backend

Origen: `.agents/modulos/vales de arte/documentacion/correcciones_22.md`,
hallazgo 1 ("Comentarios de ciclo de corrección en todo el backend").

## Qué se hizo

Se recorrió, archivo por archivo, cada comentario que referenciaba un
documento de corrección (`analisis_correcciones_N.md #X`, o la variante
suelta `corrección #N`) y se aplicó el mismo criterio que ya rige el
frontend desde la corrección #21 (`.agents/reglas/reglas_implementacion.md`):

- Si el comentario solo databa el cambio ("esto se agregó en la corrección
  X"), se eliminó sin dejar rastro.
- Si el comentario mezclaba esa referencia con una razón de negocio no
  obvia, se reescribió conservando **solo** la razón, sin el número de
  documento.
- De paso se limpiaron un par de referencias del mismo espíritu que no
  coincidían con el patrón exacto `analisis_correcciones_N.md` pero
  igualmente señalaban documentos de corrección (`corrección #8` en
  `valePdfService.js`) o rutas de documentos que ya no existen
  (`.agents/correciones_mod_vales_de_arte_1.md` en `events.js`).

## Alcance de este punto

**21 de los 22 archivos que tenían este tipo de comentario ya quedaron
limpios** (0 ocurrencias, verificado con
`grep -rc "analisis_correcciones_" src --include="*.js"`):

- `src/app.js`
- `src/core/auth/authController.js`
- `src/core/auth/authRoutes.js`
- `src/core/auth/authService.js`
- `src/core/files/fileStorage.js`
- `src/core/files/imageOptimizer.js`
- `src/core/permissions/maintenanceMiddleware.js`
- `src/modules/admin/repositories/tallerAdminRepository.js`
- `src/modules/admin/repositories/tiendaAdminRepository.js`
- `src/modules/admin/repositories/usuarioAdminRepository.js`
- `src/modules/admin/services/adminService.js`
- `src/modules/vales/atrasoWatcher.js`
- `src/modules/vales/controllers/valeController.js`
- `src/modules/vales/events.js`
- `src/modules/vales/repositories/catalogoRepository.js`
- `src/modules/vales/repositories/historialRepository.js`
- `src/modules/vales/repositories/solicitudModificacionRepository.js`
- `src/modules/vales/repositories/usuarioValeRepository.js`
- `src/modules/vales/repositories/valeRepository.js`
- `src/modules/vales/repositories/valeTallerRepository.js`
- `src/modules/vales/routes.js`
- `src/modules/vales/services/valePdfService.js`

**`src/modules/vales/services/valeService.js` queda deliberadamente fuera de
este punto** — sus 110 comentarios de este tipo se limpian como parte del
punto 2 (`correcciones_22_2.md`), porque ese archivo se está dividiendo en
varios servicios más pequeños de todas formas: limpiar sus comentarios ahora
y volver a tocar cada línea al moverla a su nuevo archivo habría sido dos
pasadas sobre el mismo texto en vez de una.

## Verificación

- `node --check` sobre los 21 archivos: sin errores de sintaxis.
- `git diff --stat` sobre los 21 archivos: 175 inserciones / 223 eliminaciones
  repartidas en comentarios — ningún archivo tiene un diff que sugiera un
  cambio de lógica (las líneas de código ejecutable no se tocaron, solo las
  de comentario inmediatamente adyacentes).
- No se corrió el servidor para esta parte: es un cambio de solo comentarios,
  sin superficie de comportamiento que probar en el navegador.

## Qué no se tocó

Ningún comentario que explicaba una razón de negocio genuina y no obvia se
eliminó — solo se le quitó la referencia al documento de corrección. Los
comentarios que ya estaban limpios (sin ninguna referencia) no se tocaron.
