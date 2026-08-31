# Trazabilidad de cambios — `analisis_correcciones_12.md`, Fase 2d

Sesión interactiva de normalización de base de datos (punto 12). Se auditó
todo `database/schema.sql` cruzando cada tabla/columna contra su uso real en
el código (no solo lo que sugiere el nombre) y se presentaron 11 hallazgos al
usuario, con el formato que pidió: por qué parece inútil, cuándo podría
servir, cómo se usa hoy, y una propuesta de cómo proceder. El usuario dio su
veredicto punto por punto — este documento registra lo ya aplicado.

## Decisiones aplicadas

| # | Elemento | Veredicto | Acción |
|---|----------|-----------|--------|
| 1 | `usuario_paises` (tabla) | Eliminar | Tabla + seed quitados |
| 2 | `asesor_limites` (tabla) | Eliminar | Tabla + seed quitados |
| 3 | `vale_tecnicas` (tabla) | Eliminar | Tabla + seed + `catalogoRepository.listarTecnicas()` + handler del mock |
| 4 | `vale_acabados` (tabla) | Eliminar | Tabla + seed + `catalogoRepository.listarAcabados()` + handler del mock |
| 5 | `vales.justificacion_modificacion` | Eliminar | Columna quitada (siempre era `NULL`) |
| 6 | `vales.tiene_adjuntos` | Eliminar | Columna quitada + `valeRepository.actualizarTieneAdjuntos()` + su llamada en `crearVale` + handler del mock |
| 7 | `vale_propuestas.fecha_subida` | Eliminar | Columna quitada, `creado_en` la reemplaza donde hiciera falta (en la práctica, en ningún lado — era write-only) |
| 8 | `paises.moneda_codigo`/`moneda_simbolo` | Eliminar | Columnas quitadas |
| 9 | `vale_propuestas.es_cancelacion` | Opción B | Columna quitada; la cancelación de un técnico ya NO crea una fila "en blanco" — el evento vive solo en `vale_historial` |
| 10 | `usuarios.intentos_fallidos`/`bloqueado_hasta` | Pendiente | **Sin cambios** — columnas conservadas, queda como deuda técnica documentada (ver abajo) |
| 11 | `vales.descripcion_original` | Opción B | Columna quitada + bloque muerto en `valePdfService.js` (tenía lector, nunca escritor) |
| — | Handler `'catalog:talleres'` en el mock | Código huérfano | Eliminado (ningún repositorio lo usaba — los talleres se piden con el tag `'taller:list'`) |

## Detalle de los cambios en código de aplicación

Quitar una columna/tabla del esquema obligó a tocar cada punto donde el
código la escribía o leía:

- **`propuestaRepository.crear(valeId, tecnicoId, url)`** perdió los
  parámetros `esCancelacion`/`fechaSubida` — sus 2 llamadores en
  `valeService.js` (`entregar`, `cancelarProcesoTecnico`) se actualizaron.
- **`cancelarProcesoTecnico`**: ya no llama a `propuestaRepository.crear(...)`
  — el registro de auditoría de esa acción vive únicamente en
  `registrarHistorial` (que ya existía desde antes; se ajustó el texto del
  mensaje quitando "propuesta en blanco").
- **`revisarPropuesta`**: su chequeo de "no aprobar en blanco" simplificado —
  ya no compara `ultimaPropuesta.es_cancelacion`, basta con `!ultimaPropuesta
  || !ultimaPropuesta.url` (una cancelación ahora no deja ninguna fila que
  encontrar, así que el caso "cancelado" y "nunca entregado" convergen en el
  mismo `null`).
- **`obtenerTrabajoTecnico`/`_trabajoEncargadoTaller`** (2 sitios idénticos en
  `valeService.js`): su cálculo de `propuestaTallerUrl` ya no filtra por
  `es_cancelacion` (innecesario, mismo motivo de arriba).
- **`valePdfService.js`**: se eliminó la rama `if (vale.modificado &&
  vale.descripcion_original)` — nunca se ejecutaba en la práctica porque
  `descripcion_original` jamás se escribía; el código siempre terminaba en la
  rama `else`, que ahora es el único camino.
- **`public/modules/vales/js/app.js`**: `abrirModalRevisar` (modal "Revisar
  propuesta") y `abrirModalAprobarGeneral` (modal "Aprobar y fusionar") leían
  `.es_cancelacion` para decidir el texto a mostrar — ahora distinguen los 3
  casos reales por la sola presencia/ausencia de una fila y su `url`: sin
  fila = "el técnico canceló el proceso"; fila sin `url` = "no adjuntó
  documento"; fila con `url` = enlace a la propuesta.

## Hallazgo nuevo, surgido como efecto colateral (no aplicado, para tu criterio)

Al quitar la rama muerta de `descripcion_original` en `valePdfService.js`,
la columna `vale_documentos.es_modificacion` **se quedó sin ningún lector**
— antes esa misma rama era su único consumidor (filtraba imágenes “de antes”
vs “de la modificación”). Sigue escribiéndose normalmente (se marca al
adjuntar la propuesta original al vale `MOD-` en `aprobarModificacion`), pero
hoy nadie la vuelve a leer. No la toqué porque no era uno de los 11 puntos
que aprobaste — pero es exactamente el mismo patrón que el punto 6
(`tiene_adjuntos`): escribe pero no se lee. Si querés, la agrego a una
próxima ronda.

## Deuda pendiente documentada (punto 10)

`usuarios.intentos_fallidos` y `usuarios.bloqueado_hasta` quedan en el
esquema sin ninguna lógica de bloqueo de cuenta implementada en
`authService.login()`. Decisión del usuario: no priorizar ahora, no eliminar
las columnas. Si en algún momento se quiere implementar protección contra
fuerza bruta en el login, la estructura de datos ya está lista.

---

## Verificación

- `node --check` sobre todos los `.js` tocados (`database.js`, `valeService.js`,
  `valePdfService.js`, `valeRepository.js`, `propuestaRepository.js`,
  `catalogoRepository.js`, `app.js`).
- **Regresión**: se re-corrieron los smoke tests de las Fases 2a, 2b y 2c
  completos — los tres siguen pasando sin cambios, confirmando que la
  limpieza no rompió ningún flujo previamente verificado.
- **Smoke test nuevo** (`smoke-correcciones12-fase2d.js`, 15 aserciones):
  cancelar el proceso de un técnico no crea fila en `vale_propuestas` (antes
  sí); el evento de cancelación queda en `vale_historial` con el mensaje
  actualizado; `revisarPropuesta` rechaza aprobar tanto cuando el técnico
  canceló (sin fila) como cuando entregó sin documento (fila sin `url`);
  aprobar una propuesta real con documento sigue funcionando; ninguna fila de
  `vale_propuestas` trae ya `es_cancelacion`/`fecha_subida`;
  `catalogoRepository.listarTecnicas`/`listarAcabados` ya no existen; un vale
  ya no trae `tiene_adjuntos`/`descripcion_original`/`justificacion_modificacion`
  en su objeto; los países ya no traen `moneda_codigo`/`moneda_simbolo`.
- **`npm run dev` + navegador**: flujo completo crear → autorizar → asignar →
  comenzar → cancelar con fetch directo (multi-rol); el modal "Revisar
  propuesta" del Encargado de Diseño muestra correctamente "El técnico
  canceló el proceso — no hay propuesta que revisar." con el botón "Aprobar"
  deshabilitado; el PDF del vale se sirve con normalidad (200, redirige al
  archivo generado). Sin errores en consola.
- Sin commit ni push — pendiente de solicitud explícita del usuario.

## Siguiente paso

Falta el veredicto sobre el hallazgo colateral (`vale_documentos.es_modificacion`)
si se quiere seguir profundizando la Fase 2d. Con eso resuelto (o dejado
pendiente, como el punto 10), el ciclo completo de `analisis_correcciones_12.md`
queda cerrado.
