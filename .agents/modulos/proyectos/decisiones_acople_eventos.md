# Decisiones sobre el acople de Eventos

Estado: **aplicado a `propuesta_modulo.md`** (2026-11-05). Responde a `acople_flujo_eventos.md`, que propone diez ajustes (B1 a B10) tomados del sistema de Eventos (`eventos_mt`).
Este documento no repite el análisis de Eventos: dice **qué se adoptó, qué se adaptó y por qué**, después de contrastar cada ajuste con el código y la base de datos de este portal.

**Limitación honesta:** el repositorio de `eventos_mt` no está en este equipo. Tomé lo que dice `acople_flujo_eventos.md` sobre cómo funciona Eventos como cierto (no pude abrir sus archivos). Lo que sí verifiqué es **nuestro lado**: el esquema, los servicios del core, el catálogo de módulos, las notificaciones, la autenticación y la versión de la base de datos. Cuando algo choca con el portal, lo digo.

## 1. Tus respuestas, aplicadas

| Tema | Respuesta | Cómo quedó en la propuesta |
|---|---|---|
| Moneda | Local por defecto; se puede cambiar a dólares si lo requieren. | Cada cotización y venta lleva su moneda. Por defecto, la local del país de la tienda. Los informes muestran un total **por moneda**, sin convertir ni mezclar (regla 13, sección 10). |
| Tiendas | Un nicho como proyecto a la vez por tienda; no pueden ser dos. | Regla 3 confirmada y respaldada por un índice único en la base de datos (ajuste B1). |
| Importación | CSV está bien. | Decidido: CSV (UTF-8) con plantilla descargable. `.xlsx` queda fuera de la primera versión. |
| Eventos | Está en `acople_flujo_eventos.md`; tomar lo útil. | Este documento. |

Detalle de la moneda local por país: Guatemala usa quetzal (GTQ), El Salvador usa dólar (USD), Honduras lempira (HNL), Nicaragua córdoba (NIO) y Costa Rica colón (CRC). Esa relación, junto con el prefijo telefónico y si la referencia es obligatoria, se guarda en una tabla pequeña (`proy_pais_config`) y no en `paises`, para no tocar una tabla compartida. Los importes usan `DECIMAL(12,2)`: Vales usa `DECIMAL(10,2)`, que se queda corto para cifras en colones.

## 2. Resumen de decisiones

| Ajuste | Qué propone | Decisión | Diferencia con el acople |
|---|---|---|---|
| **B1** | Unicidad garantizada en la base de datos (columna virtual + índice único). | **Adoptado** | Se agrega la comprobación de estado en la misma sentencia y se explica cómo se traduce el error al usuario. Se indica qué probar en `staging`. |
| **B2** | Referencia COT / OV en cotizaciones y ventas; sin referencia no hay venta. | **Adoptado** | La referencia de **cotización** también es obligatoria. Falta confirmar que todas las tiendas usan el mismo sistema (pregunta 15). |
| **B3** | Anular en vez de editar; permiso `proyectos.corregir`. | **Adoptado** | Se agrega que el estado de la participación se **recalcula** al anular. |
| **B4** | Alcance del supervisor en tres niveles; fila «Otra tienda». | **Adoptado** | Ninguna. Coincide con cómo funciona `supervisor_tiendas` aquí. |
| **B5** | Permisos por código, nunca por nombre de rol. | **Adoptado con corrección** | La nota de despliegue era inexacta para este portal (sección 3, B5). |
| **B6** | Una sola función de informe; tasas acumulativas; semáforo 75/50. | **Adoptado** | Se precisa **qué mide** el semáforo (cobertura durante el proyecto, efectividad al cierre) y que los umbrales viven en `constantes.js`. |
| **B7** | Una sola fecha de seguimiento y orden de prioridad; tiempo de reacción. | **Adoptado con ajuste** | «Hoy» no depende del país: toda la región usa UTC-6. |
| **B8** | Proyecto vencido: avisar y bloquear, sin cierre automático. | **Adoptado** | Se reutiliza el patrón de los vigilantes de Vales para no avisar dos veces. |
| **B9** | No avisar al propio autor; avisar a quien recibe y a quien pierde. | **Adoptado** | Sin cambios. |
| **B10** | Índices compuestos desde el inicio; listas por lotes. | **Adoptado con ajuste** | Lotes de **50**, no de 60: es el tamaño del Buzón de Vales y así se ve igual. |

## 3. Detalle por ajuste: lo que verifiqué en el portal

### B1. Unicidad en la base de datos

- **Qué hay hoy.** El portal **no tiene ninguna columna generada** en `schema.sql` ni en las migraciones. Sería la primera.
- **Compatibilidad.** Producción es MariaDB 11.8 (`reglas_despliegue.md`) y el desarrollo local usa MySQL en Docker. Las dos soportan columnas virtuales con índice único. Además, las herramientas de respaldo y de refresco de `staging` **ya omiten las columnas generadas** al copiar filas (`reglas_respaldo_produccion.md` y `reglas_refresco_staging.md`), así que no rompen esos procesos.
- **Riesgo conocido.** Eventos reportó que una columna `STORED` con claves foráneas en cascada dio el error 1901 en MariaDB 11. Por eso la columna debe ser `VIRTUAL`, como dice el acople.
- **Adaptación 1: no usar `INSERT IGNORE`.** Ignorar el error esconde conflictos reales. Aquí se inserta normalmente dentro de la transacción y el servicio **captura el error de duplicado** (`ER_DUP_ENTRY`) para responder con claridad: qué tienda ya está en otro proyecto y cuál es.
- **Adaptación 2: activar compara el estado.** `UPDATE proy_proyectos SET estado='activo' … WHERE id=? AND estado='borrador'` y se revisan las filas afectadas. Un doble clic o un reintento no reparte dos veces. Se suma el `idempotencyKey` del portal (hallazgo N4).
- **Orden de bloqueo** (como propone el acople): `proy_proyectos` → `proy_proyecto_tiendas` → `proy_clientes` → `proy_participaciones`.
- **Alternativa si la columna virtual diera problemas en `staging`:** una tabla `proy_clientes_abiertos` con el cliente como clave primaria, mantenida dentro de la misma transacción. Es menos elegante pero no depende del motor. No hace falta decidirla ahora; se prueba primero en `staging`.

### B2. Referencia de cotización y de venta

- **Qué hay hoy.** `vales.cotizacion` es solo un importe (`DECIMAL(10,2)`), sin número. Proyectos quiere medir ventas reales, y un monto escrito a mano no se puede comprobar.
- **Decisión.** La venta no se guarda sin **referencia** (número de orden de venta). La cotización lleva su **número de cotización**.
- **Duplicados.** Si la misma referencia ya existe en una venta no anulada, el sistema **avisa** y pide confirmar (no bloquea: una orden puede cubrir varias empresas de un mismo grupo).
- **Pregunta abierta (15).** El acople supone que hay un sistema (Odoo) del que se copian los números. Hay que confirmar que **todas** las tiendas, incluida Centroamérica, cotizan y facturan ahí. Si alguna no, la referencia sería opcional para ese país.

### B3. Corregir sin borrar

- **Decisión.** Cotizaciones y ventas equivocadas se **anulan** con motivo (quién, cuándo) y se registra otra. Lo anulado no cuenta en ningún informe. Permiso nuevo `proyectos.corregir` para Supervisor y Administrador.
- **Adaptación: el estado se recalcula.** El estado de la participación sale de lo que existe, con este orden de precedencia: `vendida` > `cotizada` > `interesada` > `en_gestion` > `pendiente`, **ignorando lo anulado**. `perdida` y `descartada` son marcas explícitas que se quitan al reabrir. Así anular una venta devuelve la participación a `cotizada` sin editar nada a mano.

### B4. Alcance del supervisor en tres niveles

- **Qué verifiqué.** En este portal un supervisor **tampoco tiene tienda propia**: `supervisores` solo trae `usuario_id` y teléfono; las tiendas salen de `supervisor_tiendas` (relación muchos a muchos), y Vales ya filtra con ese join (`reporteRepository`, `tallerRepository`, `usuarioValeRepository`). Es exactamente el caso del que habla Eventos.
- **Decisión.** Tres niveles separados: **lectura** del proyecto completo si una de sus tiendas está en el alcance; **acción** (reasignar, anular, corregir) solo sobre asesores de **sus** tiendas; **fila** (un asesor ve solo lo suyo). Las filas de otras tiendas salen como «Otra tienda», con nombre de la empresa y etapa, **sin contactos, referencias ni montos**.
- **Por qué importa.** En los datos de desarrollo dos supervisores comparten las 10 tiendas de Centroamérica y los de Guatemala se reparten otras; además protege los datos personales de la sección 16 de la propuesta.

### B5. Permisos por código, con una corrección

- **Adoptado:** ningún servicio compara el nombre del rol. El alcance global es el permiso `proyectos.ver_gerencia`.
- **Corrección a la nota del acople.** El acople dice que quien ya tenga sesión abierta debe volver a entrar. En este portal los permisos **viajan en el token de sesión** (`req.user.permissions`) y existe un refresco en caliente (`reautorizar`) que se dispara cuando un administrador cambia los permisos de un rol **desde la pantalla de roles**. Una migración SQL que inserta o asigna permisos **no dispara** ese refresco: los usuarios los reciben al volver a iniciar sesión o en el siguiente refresco del token.
- **Consecuencia para la fase 8 (activación).** La lista de verificación incluye avisar a los usuarios o hacer la asignación desde la pantalla de roles de Administración.
- **Detalle técnico útil.** El portal considera «permitido» un módulo solo si el usuario tiene `<módulo>.ver`: por eso `proyectos.ver` es el que abre la puerta, y los permisos nuevos deben llevar `modulo = 'proyectos'`.

### B6. Cifras en un solo lugar y acumulativas

- **Decisión.** Una única función de informe; la pantalla, el PDF y la exportación solo la llaman. Tasas acumulativas (*Gestionadas* = todas menos las pendientes; *Cotizadas* = con cotización **o** con venta). Lo anulado no cuenta. Tablas del PDF cortadas en 20 filas con «y N más».
- **Precisión que faltaba.** El acople habla de «efectividad» con semáforo 75/50, pero Proyectos tiene dos medidas distintas. Quedó así: **durante el proyecto** el semáforo mide la **cobertura** (gestionadas ÷ asignadas, frente a lo esperado de la etapa); **al cierre** mide la **efectividad** (interesadas ÷ asignadas, como la hoja de 2020). Umbrales: verde desde 75 %, ámbar de 50 a 74 %, rojo por debajo de 50 %. Viven en `constantes.js`, así que ajustarlos no toca la base de datos.
- **Monedas.** Las cifras con dinero se muestran con un total por moneda; no se suman monedas distintas.

### B7. Seguimiento: una sola fuente

- **Decisión.** `proxima_gestion_en` vive solo en `proy_participaciones`; el valor en `proy_gestiones.proxima_en` es el dato histórico de cada registro. Orden de «Mi proyecto» y «Para hoy»: cerradas al final → vencidas primero → fecha más próxima → sin contactar antes que contactadas. Se agrega el **tiempo de reacción** (días entre la asignación y la primera gestión).
- **Ajuste por el portal.** El acople pide calcular «hoy» con la zona horaria del país. Aquí **no hace falta**: `src/core/calendario/calendarioLaboral.js` trabaja con una hora de pared fija UTC-6 para toda la región (`ahoraUTC6()`; Centroamérica no usa horario de verano). Se usa esa función y no se crean zonas por país.

### B8. Proyecto vencido

- **Decisión.** Un proyecto `activo` con la `fecha_fin` pasada (más los días de gracia) se marca **vencido**: aviso al supervisor y al gerente, bloqueo de nuevos proyectos en esas tiendas y **sin cierre automático** (el cierre necesita las conclusiones).
- **Cómo se implementa aquí.** Con el mismo patrón de los vigilantes de Vales (`vigenciaWatcher`, `atrasoWatcher`): una revisión periódica y una columna `aviso_vencido_en` para avisar **una sola vez**, igual que `atraso_notificado_en` en la tabla de vales.
- **¿Es una acción crítica?** No. Escribe en la base de datos y emite una notificación interna por socket; no envía correos ni push (`reglas_entornos.md`). Puede correr en todos los entornos.
- **Días de gracia:** pregunta 14 (recomiendo 3 días hábiles, contados con el calendario laboral).

### B9. No avisar al propio autor

- **Decisión.** Una acción notifica solo si el destinatario es distinto de quien la hizo; en una reasignación se avisa a quien recibe y a quien pierde.
- **Cómo.** `notificacionService.registrar(usuariosIds, datos)` recibe la lista de destinatarios; el filtro del autor se aplica en el servicio de Proyectos antes de llamar. Las notificaciones se purgan a los 30 días.

### B10. Índices y lotes

- **Índices.** Se crean con la tabla: `proy_gestiones (participacion_id, creado_en)`, `proy_gestiones (usuario_id, creado_en)` y `proy_participaciones (asesor_id, abierta, proxima_gestion_en)`.
- **Lotes.** El Buzón de Vales carga de **50 en 50** con cursor y scroll infinito (`limit: 50` en `valeBuzonService` y en el estado del frontend). «Base de clientes» y «Mi proyecto» usan el mismo tamaño y el mismo patrón, para que el comportamiento sea idéntico al que ya conocen los asesores.

## 4. Hallazgos propios del portal (no estaban en el acople)

Cosas que encontré al contrastar y que cambian el diseño.

| # | Hallazgo | Consecuencia |
|---|---|---|
| **N1** | `notificacionService` **valida el módulo contra `MODULOS`** (`validarModulo`). Si `proyectos` no está en el catálogo, no se puede notificar. | El módulo se registra en `MODULOS` **desde la primera subrama**. No lo expone: la tarjeta del portal solo aparece a quien tenga `proyectos.ver`, y nadie lo tiene hasta la fase 8. Corrige la propuesta, que decía registrarlo al final. |
| **N2** | `notificaciones` solo referencia `vale_id` (con clave foránea a `vales`) y `crearParaUsuarios` solo acepta `valeId`. | Migración aditiva con `referencia_tipo` y `referencia_id` opcionales, y un parámetro opcional nuevo en `crearParaUsuarios`. Lo que ya existe no cambia. |
| **N3** | Los permisos viajan en el token y se refrescan al editarlos desde Administración (no al correr una migración). | Ver B5 y la lista de verificación de la fase 8. |
| **N4** | El portal ya tiene una tabla genérica `idempotency_keys` y `idempotencyRepository` (usada al entregar o aprobar en Vales), y `CLAUDE.md` pide `idempotencyKey` en los endpoints que escriben. | Activar, registrar gestión, cotización o venta e importar aceptan `idempotencyKey`. Con señal débil en celular, un reintento no duplica. No se inventa un mecanismo nuevo. |
| **N5** | Hoy los asesores no tienen un campo de «moneda». Los importes de Vales no llevan código de moneda. | La moneda de Proyectos es propia (`proy_monedas`, `proy_pais_config`) y no toca Vales ni `paises`. |
| **N6** | Las columnas generadas no existen en el esquema actual. | Se prueba en `staging` antes de depender de ellas (B1). |
| **N7** | El portal usa MariaDB 11.8 en producción y MySQL en desarrollo. | Todo el SQL del módulo debe ser válido en las dos; lo comprueba el CI de migraciones (`ci:migraciones`). |

## 5. Preguntas nuevas

Se suman a la sección 18 de la propuesta. **Las cuatro quedaron respondidas el 2026-11-05**, con la recomendación de cada una (la 15 con un supuesto explícito, ver abajo).

| # | Pregunta | Recomendación |
|---|---|---|
| 13 | ¿Quién confirma una venta? En Eventos el asesor sin permiso de cierre **solicita** y el supervisor **aprueba**. | Que el asesor la registre directamente con la referencia obligatoria y que el supervisor pueda anularla. La aprobación previa añade tablas y pasos que no aportan en un proyecto mensual. |
| 14 | ¿Cuántos días de gracia tras la `fecha_fin` antes de marcar un proyecto como vencido? | 3 días hábiles. |
| 15 | ¿Todas las tiendas (incluida Centroamérica) cotizan y facturan en el mismo sistema, de modo que siempre exista número de cotización y de orden de venta? | Sí → referencias obligatorias. Si algún país no, referencia opcional solo para ese país. |
| 16 | ¿El semáforo mide la cobertura durante el proyecto y la efectividad al cierre, con 75 % y 50 % de umbral? | Sí. Los umbrales se pueden ajustar sin tocar la base de datos. |

## 6. Qué cambió en `propuesta_modulo.md`

| Sección | Cambio |
|---|---|
| Cabecera | Referencia a este documento y al acople. |
| 1 Decisiones confirmadas | Filas nuevas: moneda, tiendas, importación, flujo de Eventos. |
| 2.1 | La fila de «mismo flujo que el evento» ya no dice «no tengo el documento». |
| 4.2 | Permiso `proyectos.corregir` y nota sobre cómo llegan los permisos al usuario. |
| 4.3 | Reemplazada por los tres niveles de alcance y la fila «Otra tienda». |
| 6 | Reglas 2, 3, 6 y 13 ajustadas; reglas nuevas 17 a 20. |
| 9 | Pantallas transversales: «Otra tienda», proyecto vencido y anulación con motivo. |
| 10.1 | Tablas `proy_monedas` y `proy_pais_config`. |
| 10.3 | Columnas `abierta`, `cliente_abierto_id`, `proyecto_abierto`, `tienda_abierta_id` con sus índices únicos, y su explicación. |
| 10.4 | Referencias, anulación, índices de gestiones, `DECIMAL(12,2)` y aviso de vencido. |
| 11 | Reglas de cálculo, semáforo, tiempo de reacción, seguimiento y corte del PDF. |
| 12 | Catálogo (registro temprano), notificaciones, calendario, importación, reintentos y lotes. |
| 14 | Registro en `MODULOS` desde la primera subrama; lista de verificación de la fase 8. |
| 18 | Preguntas 4, 5, 9 y 10 marcadas como respondidas; preguntas 13 a 16. |

## 7. Lo que sigue sin verificar

- Que Eventos realmente funcione como describe el acople (no pude abrir `eventos_mt`).
- Que la columna virtual con índice único se comporte igual en la base de `staging` (MariaDB). Es lo primero que se prueba en la fase 1.
- Que todas las tiendas usen el mismo sistema para numerar cotizaciones y órdenes. La pregunta 15 se respondió **suponiendo que sí** (referencias obligatorias en todas); es un dato de la operación que no se pudo comprobar desde el portal. Si un país no lo usa, la referencia pasa a ser opcional solo para él.

## Nota del 2026-11-06

La pregunta 13 de la propuesta (aprobar ventas) pasó a ser un interruptor del administrador: la confirmación de ventas por el supervisor viene apagada; encendida, la venta queda «por confirmar» y no cuenta en los informes hasta confirmarse. Ver `documentacion/configuracion_administrador.md`.
