# Trazabilidad de cambios — `analisis_correcciones_12.md`, Fase 2b

Esta fase implementa el punto **11** (el de mayor blast-radius del documento —
"IMPORTANTÍSIMO" en palabras del propio usuario), el punto **13** (nuevo
formato de correlativo, que dependía de los códigos de tienda entregados en la
Fase 2a) y el resto pendiente del punto **6** (fusión del buzón de fusión
dentro del buzón de quien fusiona).

Regla de negocio que cambia (punto 11): **el rol "Encargado General" deja de
existir**. Antes, dos roles aparte (8 y 9) eran los únicos que podían fusionar
vales multi-taller o de modificación, sin ser dueños de ningún taller. A
partir de esta fase:

- La fusión (`vales.aprobar_general`) es un permiso del **Encargado de
  Diseño** (rol 5) — la persona real, dueña del taller "Diseño".
- El rol 9 se recicla como **"Asistente de Diseño"**: clon operativo COMPLETO
  del Encargado de Diseño (ver, asignar, revisar, fusionar) — decisión
  confirmada explícitamente por el usuario (pregunta directa: "clon
  operativo completo" vs "solo fusión"), ya que el usuario semilla (id 11)
  cambia de correo a `asistente@munditrofeos.com` (instrucción literal del
  documento).
- El rol 8 ("Encargado General") queda descontinuado: sin permisos en
  `rol_permisos`, sin usuario activo (`usuarios.activo = 0`, id 10) — nunca
  se borra ni el rol ni el usuario (preserva `vale_historial`/FKs), mismo
  criterio que ya se usó para `usuarios.encargado_id` en la Fase 2a.
- Se agregan talleres nuevos: **Protextil** (uno solo, toda la empresa) y
  **Diseño Local** — uno por cada tienda que lo tiene (todas menos MTC, MTS
  y las 14 tiendas Trofex R1/R2 — quedan 11: P13, SSV, SAA, SMG, ECL, CMY,
  TEG, SPS, MAN, LEO, SJO). En vez de un rol por taller, se creó un rol
  genérico **"Encargado de Taller"** (id 11) que comparten los 12 encargados
  mockup nuevos.
- El flujo de modificación cambia: ya no existe `reenviarModificacion()`. El
  asesor mismo indica el destino al solicitar la modificación, con reglas
  automáticas cuando el destino es obvio.
- Punto 13: nuevo formato de correlativo `{CODIGO_TIENDA}-{INICIALES}-{00001}`
  (5 dígitos).

---

## 1. Esquema: talleres nuevos, rol genérico, roles descontinuados

**Archivos:** `database/schema.sql`, `src/config/database.js`

- `talleres` gana `tienda_id` (nullable, FK a `tiendas`): `NULL` = taller de
  toda la empresa (Diseño, Diseño UV/3D, Protextil); no nulo = Diseño Local de
  esa tienda. Un solo campo cubre tanto "¿es local?" como "¿de cuál tienda?" —
  evita el booleano `es_local` redundante que el propio punto 12 pediría
  eliminar después.
- Talleres nuevos: id 3 "Protextil" (`tienda_id NULL`), ids 4-14 "Diseño Local
  - `<CÓDIGO>`" (uno por cada una de las 11 tiendas elegibles).
- 24 usuarios mockup nuevos (ids 25-48): un encargado (rol 11, "Encargado de
  Taller") + un técnico (rol 7) por cada taller nuevo — necesarios para que el
  flujo asignar→trabajar→revisar sea probable de punta a punta, igual que ya
  existía para Diseño/Diseño UV3D. Encargados reusan el hash de
  `encargado.diseno@...` (disenoenc123); técnicos, el de `tecnico.a@...`
  (tecnico123).
- Rol 5 "Encargado de Diseño": gana el permiso 16 (`vales.aprobar_general`).
- Rol 9: renombrado "Asistente de Diseño"; usuario 11 cambia de correo a
  `asistente@munditrofeos.com`; permisos pasan a ser el mismo set atómico que
  el rol 5 (ver, asignar, revisar, fusionar).
- Rol 8 "Encargado General": pierde todos sus permisos en `rol_permisos`;
  `descripcion` se reescribe para marcarlo obsoleto; el usuario semilla (id
  10) se desactiva (`activo = 0`) — no se borra ni el rol ni el usuario.
- Nuevo rol 11 "Encargado de Taller": permisos ver/asignar/revisar, sin
  fusión — lo usan los 12 encargados mockup de Protextil/Diseño Local.
- Dato de semilla corregido de paso: el vale demo `MOD-GUA-3-0008` (id 12)
  quedaba a propósito sin fila en `vale_talleres` — era el caso demo del
  viejo "pendiente de reenvío". Como ahora el fan-out es inmediato (ver §4),
  se le agregó su fila (`taller_id = 1`, `PENDIENTE_ASIGNACION`) para que
  siga siendo un vale operable en vez de quedar huérfano.

## 2. Backend: resolución de "mi taller" centralizada (clon del Asistente)

**Archivo:** `src/modules/vales/services/valeService.js`

Nuevo helper `async _idEncargadoEfectivo(usuario)`: devuelve `usuario.id`
salvo que `usuario` sea el Asistente de Diseño (rol 9, hardcodeado a
propósito — el documento avisa que "quién fusiona" podría cambiar de nuevo en
un ciclo futuro con vista de administrador), en cuyo caso devuelve el
`encargado_id` real del taller "Diseño". Todos los sitios que antes
comparaban `talleres.encargado_id === usuario.id` inline (8 en total:
`_tallerIdVisiblePara`, `_buzonEncargado`, `_trabajoEncargadoTaller`,
`_resolverFilaTallerParaEncargado`, `asignar()`, `obtenerTecnicosAsignables`,
`obtenerCargaTrabajo` (ahora recibe el `usuario` completo, no solo un id — se
actualizó el controller), `obtenerAsignacionesDeTecnico`) pasan por este único
punto — es lo que hace posible que el Asistente asigne técnicos, revise
propuestas y aparezca en "Trabajo realizado" exactamente como el Encargado de
Diseño, sin tocar la regla de "un taller, un encargado_id" de la tabla.
`esEncargadoGeneral()` se eliminó.

## 3. Backend: la fusión vive DENTRO del buzón de quien la tiene

**Archivo:** `src/modules/vales/services/valeService.js`

En vez de decidir por `rolId` quién ve la cola de fusión, se decide por el
permiso atómico (`usuario.permissions.includes('vales.aprobar_general')`) —
tal como pide el punto 11 ("en algún momento lleguen a otro acuerdo... tengo
que poder cambiar los permisos"). `obtenerBuzon()` pierde el `case 8: case 9:`
y las funciones `_buzonEncargadoGeneral`/`_trabajoEncargadoGeneral`; el `case
5: case 6:` se amplía a `5/6/9/11` y ahora resuelve `_buzonEncargado`/
`_trabajoEncargadoTaller` con `await` (pasaron a async).

- `_buzonEncargado`: si el usuario tiene `vales.aprobar_general`, agrega al
  arreglo `vales` los `APROBADO_DEPARTAMENTO` (sin scope de taller — son
  multi-taller por definición) y un contador `pendientesFusion` — sin
  duplicados, porque un vale ahí ya tiene la fila de MI taller en `APROBADO`,
  así que el filtro normal de "mis pendientes" ya lo excluye.
- `_trabajoEncargadoTaller`: mismo patrón para "ya fusionados" (mismo
  predicado que tenía `_trabajoEncargadoGeneral`), marcados con un flag
  interno `_esFusion` para no confundirlos con un vale de un solo taller
  (que también trae `propuesta_general_url` poblado, por `_recalcularEstadoVale`).
- El viejo contador `valesModificados` (MODIFICADO sin talleres, esperando
  reenvío) no se traslada — ya no puede ocurrir (ver §4).
- `_filtrarHistorialPorRol`, `estadoActivoDe` (backend) y sus equivalentes en
  el frontend (`estadoActivo`, `oculta-taller`, arrays de rol) se ampliaron de
  `[5,6,7]` a `[5,6,7,9,11]`.

## 4. Backend: talleres elegibles, exclusividad, y flujo de modificación

**Archivo:** `src/modules/vales/services/valeService.js`,
`src/modules/vales/repositories/tallerRepository.js`

- `obtenerCatalogos(usuario)` (gana el parámetro) sigue devolviendo el
  catálogo COMPLETO de talleres (lo necesitan todos los roles para resolver
  nombres — no solo el asesor eligiendo destino), pero agrega `miTiendaId`
  (la tienda del usuario que pide el catálogo) para que el FRONTEND filtre las
  opciones que le ofrece al asesor sin meter `tienda_id` en el JWT. La
  validación real e inapelable sigue siendo server-side.
- `_validarTalleresIds(talleresIdsRaw, tiendaIdAsesor)` gana el segundo
  parámetro: rechaza mezclar un taller `tienda_id IS NOT NULL` (Diseño Local)
  con uno `tienda_id IS NULL` (Munditrofeos), y rechaza un Diseño Local que no
  sea el de la tienda del propio asesor.
- `solicitarModificacion`: resuelve primero los talleres ACTIVOS del vale
  original. Si es uno solo, el destino es automático (no se pide nada); si
  son 2+ (solo puede pasar entre los 3 de Munditrofeos), el asesor debe mandar
  `talleresIds`, validado como subconjunto no vacío de esos mismos talleres.
  Esto también corrige un bug latente: `vale_solicitudes_modificacion.talleres_ids`
  quedaba siempre en `''` porque `_validarDatosVale` corría con
  `requiereTalleres:false`.
- `aprobarModificacion`: justo después de crear el vale `MOD-`, llama a
  `_fanOutTalleres` con los talleres ya decididos — nace con sus filas de
  `vale_talleres` en `PENDIENTE_ASIGNACION`, igual que un vale nuevo
  autorizado. Se eliminó `reenviarModificacion()` (servicio, ruta
  `POST /:id/reenviar-modificacion`, controller).
- Notificaciones que apuntaban a la sala fija `'vales:encargado_general'`
  (ya no existe) pasan a un nuevo helper `_salaFusion()`, que resuelve la
  sala del taller "Diseño" en tiempo real (mismo criterio en
  `atrasoWatcher.js`).

## 5. Backend: correlativo nuevo formato (punto 13)

**Archivo:** `src/modules/vales/services/valeService.js`

`inicialesAsesor(nombre)` (primera letra del primer nombre + primera letra
del segundo token, o repite la primera si no hay segundo token) + `pad5`
(antes `pad4`). `crearVale` cambia `${tienda.codigo}-${usuario.id}-${pad4(...)}`
por `${tienda.codigo}-${inicialesAsesor(...)}-${pad5(...)}`. El contador
(vales de este asesor) no cambia, solo el formato — `MOD-` sigue
antepuesto sobre el correlativo ya en el nuevo formato. Los correlativos
históricos no se renumeran.

## 6. Frontend

**Archivo:** `public/modules/vales/js/app.js`

- Eliminado todo lo de reenvío: `abrirModalReenviarModificacion`, el `case
  'reenviarModificacion'` de `puede()`, el botón "Reenviar a taller",
  `CLAVES_ESTADOS_ENCARGADO_GENERAL`.
- `abrirModalSolicitarModificacion`: si `vale._filasTaller.length > 1`, agrega
  el selector de talleres (mismo componente de creación, pero con
  `opcionesTalleres` restringido a los talleres del vale original).
- `htmlSelectorTalleres`/`wireSelectorTalleres` ganan exclusividad Diseño
  Local ↔ Munditrofeos en el cliente (deshabilita opciones incompatibles en
  el `<select>`) como ayuda de UX — la validación real sigue en el backend.
  El selector de creación, por defecto, solo ofrece talleres de toda la
  empresa + el Diseño Local de la tienda del propio usuario
  (`talleresSeleccionablesAsesor()`, usa `state.catalogos.miTiendaId`).
- `CONTADORES_CONFIG`: rol 5 gana las tarjetas de fusión (`pendientesFusion`,
  `fusionadosHoy`, `totalFusionados`); rol 6 y el nuevo rol 11 comparten una
  forma sin fusión; rol 9 clona la de rol 5.
- `miTaller()` y `roomsParaUsuario()` resuelven la misma excepción del
  Asistente de Diseño (taller "Diseño") que el backend.
- `poblarFiltroEstado` agrega `APROBADO_DEPARTAMENTO` (buzón) o los 3 estados
  de fusión (trabajo realizado) a las opciones de quien tiene
  `vales.aprobar_general`.

---

## Verificación

- `node --check` sobre todos los `.js` tocados.
- **Smoke test backend** (`smoke-correcciones12-fase2b.js`, contra el mock):
  24 aserciones — permisos atómicos de cada rol; usuario 10 desactivado no
  puede autenticarse; talleres nuevos existen con el `tienda_id` correcto;
  exclusividad y ownership de Diseño Local al crear (ambos rechazos);
  correlativo con formato `TIENDA-XX-00000`; Encargado de Diseño fusiona un
  vale multi-taller; su buzón mezcla taller propio + cola de fusión (y
  Encargado UV/3D NO ve esa tarjeta); Asistente de Diseño asigna, revisa y
  fusiona sin ser literalmente `encargado_id` de ningún taller; modificación
  de un solo taller no exige elegir destino y fusiona (fan-out) automático;
  modificación de 2 talleres exige elección, restringida al subconjunto
  original; `reenviarModificacion` ya no existe; flujo completo de punta a
  punta en un Diseño Local con su encargado/técnico mockup.
- **`npm run dev` + navegador** (Claude in Chrome): login como Encargado de
  Diseño — el buzón muestra 6 tarjetas (4 de taller + "Vales por fusionar" +
  Atrasados) mezcladas correctamente, filtrar por "Vales por fusionar"
  funciona, y el modal "Aprobar y fusionar" abre con la propuesta de cada
  taller; login como asesor de MTC — el selector de creación solo ofrece
  Diseño/Diseño UV/3D/Protextil (MTC no tiene Diseño Local), y seleccionar
  "Diseño" deshabilita esa opción sin bloquear las otras dos (mismo grupo,
  sin conflicto de exclusividad). Sin errores en consola.
- Sin commit ni push — pendiente de solicitud explícita del usuario.

## Siguiente paso

Queda la **Fase 2c** (rediseño del dashboard de Gerencia/Supervisor — nuevos
contadores con drill-down, buscador en vivo, quitar gráficas) y, al final, la
**Fase 2d** (sesión interactiva de normalización de BD, punto 12).
