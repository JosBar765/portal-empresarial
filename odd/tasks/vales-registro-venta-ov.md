# Vales: registro de venta por orden de venta (OV)

Rama: `feat/vales-registro-venta-ov` (desde `origin/dev` d7004d0c).

## Objetivo
Registrar la venta de un vale recibido mediante su OV, con confirmación del supervisor, para medir la efectividad de los vales.

## Problema y motivo
Gerencia necesita saber si los vales terminan en venta o solo cargan a los talleres. La confirmación del supervisor evita números inventados.

## Alcance
Incluye registro, corrección, borrado, confirmación, rechazo, vista en «Trabajo realizado», avisos e historial.
No incluye reportes (pendiente por decisión del dueño). La venta no es un estado del vale ni un sexto paso del pipeline.

## Reglas aprobadas (2026-11-27)
- La OV pertenece a un solo correlativo; un `MOD-` no hereda nada.
- OV: entero de 1 a 12 dígitos, sin cero inicial, sin estructura; se copia y pega (limpiar espacios e invisibles).
- Única en toda la empresa entre OV pendientes y confirmadas, garantizada por índice único en la base. Rechazar o borrar libera el número. El error dice qué correlativo la usa.
- Registra solo el dueño (`vales.crear`), solo con el vale recibido (no basta con que aparezca en «Trabajo realizado»). Sin plazo. Aplica también a vales ya recibidos.
- Pendiente: el dueño puede corregir o borrar desde un solo modal que abre un botón de tuerca (borrar pide confirmación). El supervisor ve un aviso de que la OV cambió; solo puede confirmar el número que vio.
- Confirma o rechaza el supervisor del asesor (`vales.supervisar`, incluida la supervisión especial); en vales propios, él mismo. Doble modal en ambas acciones. Sin motivo. Gana el primero (mutex y escritura condicional).
- Confirmada: «VENDIDO», sin anulación. No bloquea solicitar modificación.
- Rechazada: vuelve a sin OV, sin marca ni bloqueo.
- Cada intento (incluidos correcciones, borrados y duplicados bloqueados) queda registrado con número, usuario y fecha.
- Ven el estado de venta: dueño, supervisor, Administrador y Gerente (lectura). Talleres y diseñadores no cambian.
- «Trabajo realizado»: la columna Estado muestra «POR CONFIRMAR OV» o «VENDIDO» en lugar del pipeline; las pendientes van arriba (la más antigua primero), se muestran siempre sin importar el período; orden y paginación en el servidor. Tarjeta contador «POR CONFIRMAR OV» para el supervisor.
- Sugerencia: botón «Usar <cotización>» solo si la cotización no tiene decimales; nunca prellenado.
- Avisos (categoría nueva «Ventas», `vales.crear` / `vales.supervisar`): registrar → supervisores; confirmar y rechazar → asesor (rechazo con el número). Corregir y borrar → supervisores, solo campana. Administrador recibe todos; talleres y Gerente ninguno.
- Sin permisos nuevos.

## Tareas
- [x] T1. Mockup en Figma (escritorio y celular; vacío, cargando, error) y aprobación del dueño. Sin código antes.
- [ ] T2. Migración y registro de la venta en el backend (repositorio, servicio, rutas, historial, unicidad). Implementado en 5cea449f; falta verificar con base de datos.
- [ ] T3. «Trabajo realizado»: datos, orden, excepción de período y contador. Implementado en a3bfc13e; falta verificar con base de datos.
- [x] T4. Avisos, tiempo real, categoría «Ventas» y sus pruebas (`node --test scripts/notificaciones/`). 5cea449f; pruebas en verde.
- [ ] T5. Frontend según el mockup aprobado. Implementado en d1092cf0; falta verlo en navegador (escritorio y celular).
- [ ] T6. Documentación (`flujo_vale_de_arte.md`, `reglas_notificaciones.md`) y recorrido de punta a punta, escritorio y celular. Documentación hecha (flujo sección 17, README, notificaciones); falta el recorrido.

Ruta prevista: T1 directo; T2 a T6 con un escritor delegado (2 o más archivos no triviales).

## Criterios de aceptación
Cada regla aprobada se comprueba en el servidor y en pantalla; dos registros simultáneos de la misma OV dejan uno solo.

## Entrega
`exception-ok` por decisión del dueño (2026-11-27): todo en esta rama, con commits por unidad de trabajo y un solo PR al terminar. Pronóstico: unas 900 líneas.

## Progreso y evidencia
- 2026-11-27: reglas cerradas y rama creada. Sin código.
- 2026-11-27: mockup listo en https://www.figma.com/design/bn6CidWc35t40LccVjVlJo (equipo Team UMG), pendiente de aprobación.

- 2026-11-27: el dueño aprobó el mockup con un cambio (tuerca con un modal único), ya aplicado.

- 2026-11-27: T2 a T5 implementados por un escritor delegado (ruta: delegado). Entrega `exception-ok`.
- Evidencia: `node --test "scripts/vales/*.test.js" scripts/notificaciones/` en verde, sin base de datos (repositorios sustituidos). RED observado antes del código en reglas de la OV, categorías, orden de «Trabajo realizado» y entrada del navegador; la prueba del servicio se escribió después.
- Sin verificar: migración, índices únicos y concurrencia en MySQL, pantalla en navegador, avisos en vivo.
- Decisiones del escritor: con otra tarjeta activa no se agregan pendientes fuera de su filtro; decide solo quien devuelve `obtenerSupervisoresDeAsesor` (en vales propios, si se cubre).
- No se hizo la pantalla de error con «Reintentar» del mockup: sigue la de error del buzón.
- Verificación del padre: `node --test "scripts/vales/*.test.js"`, 63 de 63.
- RDD: `review assess` sobre d7004d0c..89412c8d: riesgo medio, 1296 líneas, `review_due: false` (`under_budget`). Sin revisión nativa.

- 2026-11-27: migración `63_vales_ventas.sql` aplicada en la base local (`npm run migrate`, con autorización del dueño); 0 pendientes.

- 2026-11-27: recorrido en navegador (BD local, `ventas2` y `ventas1`). Correcto: formato, limpieza de espacios, duplicado con correlativo, corrección y borrado, orden y excepción de período, contador y filtro, doble modal de confirmar y rechazar, VENDIDO, rechazo sin marca, campana de ambos, abrir un aviso, celular a 390 px (listado del supervisor), consola sin errores desde su captura.
- Hallazgo: una pendiente fuera del período suma en la tarjeta «Atrasados» pero no en «Total recibidos».
- Sin probar: aviso «la OV cambió» y «ya fue resuelta» (dos sesiones), registro simultáneo, Administrador, Gerente y talleres, push al dispositivo, modales en celular.
- Datos de prueba: `GT-MTC-1126-9281` quedó VENDIDO con la OV 900000000003.

- 2026-11-27: el dueño decidió dejar la tarjeta «Atrasados» como está.
- Segunda ronda (API local y navegador): misma OV en dos vales a la vez, 5 de 5 deja una; permisos 403; talleres y diseñadores no reciben el número; vale no recibido 409; confirmar y rechazar a la vez resuelve una; borrar contra rechazar resuelve una; VENDIDO no se cambia ni reutiliza; «la OV cambió», «borró la OV» y «ya fue resuelta» en pantalla; modales a 390 px; Gerente en solo lectura; Encargado sin cambios.
- Discrepancia: en acciones simultáneas sobre un mismo vale, el segundo recibe «Este vale se está procesando…» y no «ya fue resuelta».
- Sin probar: Administrador (sin contraseña documentada), push al dispositivo, un segundo supervisor real (ninguna cuenta probada cubre a ese asesor; «ya fue resuelta» se simuló).
- Datos de prueba permanentes: `GT-MTC-1126-9281` y `MOD-GT-MTC-1126-9374` quedaron VENDIDO.

- Tercera ronda: el choque simultáneo quedó corregido (0532b4d4) y verificado en el servidor (3 de 3 «ya fue resuelta»). Administrador en solo lectura (403 al decidir) y recibe los avisos. Push de escritorio verificado: llegan registro y rechazo; corregir y borrar no. Cuenta local `gerentezona13@` restablecida a la contraseña del seed.
- Observado: al Administrador le llega el texto del rechazo dirigido al asesor («Puedes registrar otra»).
- Pendiente de decisión: la sugerencia de la cotización ofrece montos.

- El dueño dio por buenos los demás comportamientos. Corregido y verificado en el servidor: un supervisor que decide sobre un vale de un asesor que también supervisa ya puede abrirlo (antes 403); el dueño con rol de taller o diseñador ve las líneas de venta del historial. Pruebas 122 de 122.

- Pruebas con las dos ramas unidas (rama temporal, borrada): 122 de 122 y 8 de seguridad; ciclo completo de un vale (crear a recibir) con pausa y reanudación; dos supervisores reales sobre la misma OV (3 de 3 «ya fue resuelta»); modificación de un vale vendido sin bloqueo; reporte de asesores 238 a 239, igual al conteo directo. Datos de prueba: `GT-MTC-1126-9475` VENDIDO.

## Siguiente paso
Abrir el PR cuando el dueño lo pida.
