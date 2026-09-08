# Correcciones #22, punto 2 — División de `valeService.js`

Origen: `.agents/modulos/vales de arte/documentacion/correcciones_22.md`,
hallazgo 2 ("`valeService.js` concentra 2264 líneas de lógica de negocio").

## Qué se hizo

Se dividió la única clase `ValeService` (2264 líneas) en 9 archivos dentro
de `src/modules/vales/services/`, siguiendo los mismos criterios que ya rigen
el frontend desde la corrección #21 (`.agents/reglas/reglas_implementacion.md`).
De paso se limpiaron los 110 comentarios de ciclo de corrección
(`analisis_correcciones_N.md`/`corrección #N`) que quedaron pendientes del
punto 1 a propósito, para no tocar cada línea dos veces.

**Regla que gobernó todo el trabajo: cero cambios de comportamiento.** Es
mover código, no reescribirlo — mismos endpoints, mismos mensajes de error,
mismas reglas de negocio, mismo orden de validaciones.

## Estructura resultante

```
src/modules/vales/services/
├── valeService.js              FACHADA — misma API pública exacta de antes
├── valeHelpers.js               Constantes (ESTADOS*, ROL*) + funciones puras
│                                 (fechas/formato/orden) + requerirVale/
│                                 assertPropioDelAsesor + registrarHistorial
├── valeMutex.js                  _conLockDeVale/_conColaDeCreacion, instancia
│                                 única compartida
├── valeCatalogoService.js        obtenerCatalogos, obtenerTalleres,
│                                 idEncargadoEfectivo, salaFusion
├── valeCreacionService.js        crearVale, autorizarCreacion,
│                                 obtenerLimiteColectivoSupervisor,
│                                 validarDatosVale, validarTalleresIds,
│                                 fanOutTalleres, nombresDeTalleres,
│                                 guardarAdjuntos, regenerarPdf
├── valeDetalleService.js         obtenerDetalle + sus helpers de permisos/
│                                 historial (incluye categoriaHistorial,
│                                 privada de este archivo)
├── valeBuzonService.js           obtenerBuzon + los ~15 _buzonX/_trabajoX +
│                                 obtenerDashboardGerencia + obtenerCargaTrabajo/
│                                 obtenerTecnicosAsignables/obtenerAsignacionesDeTecnico
├── valeTallerService.js          asignar/comenzar/entregar/pausar/reanudar/
│                                 cancelar/revisarPropuesta + aprobarGeneral (fusión)
├── valeConfirmacionService.js    confirmarRecibido, solicitarModificacion,
│                                 aprobarModificacion, obtenerValeParaPdf
└── valePdfService.js              (existente, sin cambios)
```

`valeService.js` pasó de 2264 líneas a una fachada de ~50 líneas que reexpone
los mismos 22 métodos que ya llamaba `valeController.js`, más los dos exports
estáticos (`ESTADOS`, `ESTADOS_TALLER`) que usa `atrasoWatcher.js` — ninguno
de los dos consumidores cambió una sola línea.

## Por qué `valeBuzonService.js` sigue siendo grande (~900 líneas)

Es una decisión consciente, no un descuido: todas las ramas por rol
(Administrador/Gerente/Asesor/Supervisor/Encargado/Técnico) del mismo listado
comparten `_enriquecerConTaller`/`_resolverVentana`/`_aplicarFiltroContador`/
`ordenarPorGrupos`. Partirlo por rol en más archivos habría obligado a esos
5-6 archivos hermanos a importarse estos mismos helpers entre sí sin ninguna
ganancia real de cohesión — exactamente la sobre-ingeniería que
`reglas_implementacion.md` pide evitar. Por el mismo motivo,
`obtenerDashboardGerencia` se quedó en este archivo (comparte
`_resolverVentana`/`_enriquecerConTaller`) en vez de un archivo aparte.

`aprobarGeneral` (fusión) se quedó en `valeTallerService.js` en vez de un
archivo propio de ~40 líneas — es, en esencia, el paso terminal del ciclo de
un taller (todos sus talleres llegan a `APROBADO` → alguien fusiona), no una
feature aparte.

## Dependencias cruzadas entre los nuevos archivos

- **`valeMutex.js`** exporta una única instancia (`module.exports = new
  ValeMutex()`), importada idéntica por `valeCreacionService.js`,
  `valeTallerService.js` y `valeConfirmacionService.js` — nunca cada uno crea
  la suya. Esto es lo que garantiza que una operación desde cualquiera de
  esos tres archivos bloquee a las demás sobre el mismo vale. Se verificó con
  una prueba puntual (ver abajo).
- **`requerirVale`/`assertPropioDelAsesor`** (antes `_requerirVale`/
  `_assertPropioDelAsesor`) viven en `valeHelpers.js` — los usan Creación,
  Detalle (indirectamente vía obtenerDetalle), Taller y Confirmación/Modificación.
- **`idEncargadoEfectivo`/`salaFusion`** (antes `_idEncargadoEfectivo`/
  `_salaFusion`) viven en `valeCatalogoService.js` — los usan Detalle, Buzón
  y Taller.
- **`validarDatosVale`/`fanOutTalleres`/`nombresDeTalleres`/`regenerarPdf`**
  (antes `_validarDatosVale`/`_fanOutTalleres`/`_nombresDeTalleres`/
  `_regenerarPdf`) viven en `valeCreacionService.js`, exportados sin guion
  bajo porque los usa también `valeConfirmacionService.js`
  (`solicitarModificacion`/`aprobarModificacion`) y `valeTallerService.js`
  (`aprobarGeneral`, solo `regenerarPdf`) — dependencia que ya estaba
  documentada en el comentario original de `_validarDatosVale`
  ("Validaciones compartidas entre crearVale() y solicitarModificacion()").
  La dependencia es de un solo sentido (Creación nunca importa de
  Taller/Confirmación), así que no hay ciclo de imports.
- **`obtenerLimiteColectivoSupervisor`** estaba físicamente en el viejo
  bloque "Buzón" pero no dependía de nada de ahí (solo de
  `usuarioValeRepository`/`valeRepository`/`hoyISO`) — se reubicó en
  `valeCreacionService.js`, que es quien realmente la usa internamente
  (`autorizarCreacion`); el controller la sigue llamando igual vía la
  fachada.
- Funciones que solo las usa su propio archivo se quedaron como métodos
  `_privados` de su clase (`this._metodo()`), sin cambios de comportamiento.

## Verificación

- `node --check` sobre los 9 archivos nuevos/reescritos: sin errores de sintaxis.
- Smoke test con `require('./valeService')` desde
  `src/modules/vales/services/`: cargó sin errores de import circular ni
  rutas rotas — los 22 métodos públicos y los dos exports estáticos
  (`ESTADOS`/`ESTADOS_TALLER`) están presentes y son funciones/valores
  válidos. (El proceso termina con el error fatal esperado de conexión a
  MySQL — no hay base de datos en esta máquina — pero eso ocurre DESPUÉS de
  que todo el grafo de módulos cargó correctamente, así que no invalida la
  prueba.)
- Prueba puntual del mutex: dos llamadas casi simultáneas a
  `valeMutex.conLockDeVale(42, ...)` — la segunda, mientras la primera sigue
  en curso, se rechaza con "Ya hay una operación en curso sobre este vale de
  arte...", y una tercera llamada después de que la primera libera el lock
  se ejecuta con normalidad. Confirma que la instancia única sí bloquea entre
  sí a operaciones desde archivos distintos que importan el mismo
  `valeMutex.js`.
- `git diff` sobre `valeController.js` y `atrasoWatcher.js`: sin cambios
  atribuibles a este punto 2 (los únicos cambios que tenían, ya presentes
  antes de empezar este trabajo, son la limpieza de comentarios del punto 1,
  documentada en `correcciones_22_1.md`).
- `grep -c "analisis_correcciones_\|corrección #"` sobre los 9 archivos
  nuevos/reescritos: 0 en todos.
- Revisión manual: cada función movida se comparó línea por línea contra el
  original — el único cambio real en cada una es `this._foo()` → `foo()` (o
  `otroServicio.foo()`) donde la función cruzó de archivo.
- No se pudo levantar el servidor en esta máquina (sin base de datos MySQL
  real y sin fallback — ver corrección #22 punto 3). La prueba de
  comportamiento end-to-end queda pendiente para cuando el usuario despliegue
  con su base de datos real.

## Qué no se tocó

Ninguna regla de negocio, mensaje de error, validación o nombre de evento
cambió. El orden de las validaciones dentro de cada método es idéntico al
original. `valePdfService.js` no se tocó.

No se commiteó ni se subió nada — queda pendiente de pedido explícito.
