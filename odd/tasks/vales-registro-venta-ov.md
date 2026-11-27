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
- RDD: sin evaluar por el escritor.

## Siguiente paso
Aplicar la migración en desarrollo (`npm run migrate`), reiniciar el servidor y hacer el recorrido de punta a punta.
