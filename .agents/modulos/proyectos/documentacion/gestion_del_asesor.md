# Gestión del asesor (fase 4)

El asesor trabaja las empresas que le tocaron en el proyecto activo: registra gestiones, entrega muestras, cotiza, vende, y marca las que se pierden o se descartan. Aquí se describe el **servidor** (rama 4a); las pantallas llegan en la 4b.

## Reglas

- **Solo lo propio.** Cada consulta y cada registro filtra por el asesor de la sesión (`req.user.id`, nunca el cuerpo ni la URL). Una empresa de otro asesor responde **404**, igual que una que no existe. Todo exige `proyectos.gestionar`.
- **Solo se agregan filas.** Gestiones, muestras, cotizaciones y ventas no se editan ni se borran; una equivocación se anula con motivo (fase 5).
- **Solo en proyectos activos.** Un proyecto cerrado o cancelado queda de lectura (la ficha sigue abriendo, los registros responden 409). Una empresa descartada tampoco recibe registros.
- **El estado se deriva de lo registrado** (`estadoParticipacion.js`, función pura) y solo sube: pendiente → en gestión (hay una gestión) → interesada (el resultado tiene efecto «interesada») → cotizada (hay una cotización vigente) → vendida (hay una venta **confirmada**). Una gestión posterior sin interés no lo baja. **Perdida** (con motivo) y **descartada** (con motivo escrito) las marca el asesor; una perdida se reabre sola con la siguiente gestión, cotización o venta.
- **Seguimiento.** La fecha vigente vive solo en `proy_participaciones.proxima_gestion_en`: cada gestión la fija o la despeja. Hay resultados que la exigen (`requiere_proxima`) y no puede ser una fecha pasada. «Hoy» es la hora de Guatemala (UTC-6).
- **Muestras.** La gestión puede traer «entregué muestra» (cantidad y área). La existencia del proyecto baja con un `UPDATE … WHERE existencia >= cantidad`; si no alcanza, 409 «Solo quedan N muestras» y no se guarda nada de esa gestión. Dos entregas a la vez se ponen en fila bloqueando primero la fila del proyecto.
- **Cotización y venta.** Monto mayor que cero con hasta dos decimales. **Moneda:** la local del país de la empresa o dólares; un país sin moneda local (hoy Belice) trabaja en dólares. **Referencia** (número de cotización u orden de venta): obligatoria según el país; sin número no se guarda. Una **orden de venta ya usada** en otra venta vigente responde 409 `REFERENCIA_REPETIDA` (con la empresa que la tiene) y solo se guarda con `confirmarReferenciaRepetida: true`.
- **Venta por confirmar.** Con la regla `reglas.confirmar_ventas` (o la del país) encendida, la venta nace `por_confirmar`: no cuenta en las cifras ni lleva la empresa a vendida hasta que el supervisor la confirme (fase 5).
- **Doble clic.** Cada registro lleva `idempotencyKey`; la clave se asienta dentro de la misma transacción que el registro, así repetirla devuelve la ficha con `repetida: true` y no duplica nada.

## API (`/api/proyectos`)

| Ruta | Qué hace |
|---|---|
| `GET /mi-proyecto` | Proyecto activo, etapa vigente, muestra restante, cifras (asignadas, gestionadas, interesadas, cotizadas, vendidas, efectividad), conteos por estado y las primeras de «Para hoy». Sin proyecto: `{ proyecto: null }`. |
| `GET /mi-proyecto/para-hoy` | Vencidos, de hoy y sin tocar (sin gestión desde `seguimiento.dias_estancado` días), sin repetir empresas ni incluir vendidas, perdidas o descartadas. |
| `GET /participaciones?estado=&q=&pagina=` | Lista de 50 en 50. Orden fijo: cerradas al final → vencidas primero → fecha más próxima → sin contactar antes que contactadas. |
| `GET /participaciones/:id` | Ficha: empresa, contactos por área, línea de tiempo y lo que necesitan las hojas (moneda por defecto, referencia obligatoria, venta por confirmar, muestra). |
| `GET /participaciones/opciones` | Canales, resultados, motivos de pérdida y monedas activos. |
| `POST /participaciones/:id/gestiones` | `canalId`, `resultadoId`, `contactoId?`, `nota?`, `proximaEn?`, `muestra?: { cantidad, areaId? }`, `idempotencyKey`. |
| `POST /participaciones/:id/cotizaciones` · `/ventas` | `monto`, `moneda?`, `referencia?`, `nota?` (solo cotización), `confirmarReferenciaRepetida?` (solo venta), `idempotencyKey`. |
| `POST /participaciones/:id/perdida` · `/descartar` | `motivoId` (+ `nota?`) · `motivo`; ambas quedan en el historial del proyecto. |
| `GET /mis-proyectos-anteriores` | Proyectos cerrados o cancelados donde la persona tuvo empresas, con sus cifras. |

## Código

`estadoParticipacion.js` (derivar el estado) · `repositories/participacionRepository.js` (todo el SQL) · `services/gestionService.js` (reglas) · `controllers/gestionController.js` · rutas al final del bloque de proyectos en `routes.js`. No hay migración nueva: usa las tablas de la migración 35.

## Verificación

`node scripts/proyectos/verificar-gestion.js` (base desechable; 72 comprobaciones, también en MariaDB 11.8): estado derivado, 404 con lo ajeno, gestiones y próxima fecha, muestras y existencias (incluida la carrera de dos entregas), referencia y moneda por país, OV repetida, venta por confirmar, perdida y descartada, «Para hoy», listas de 50 en 50 y proyecto cerrado.

> MariaDB 11.8 activa por defecto el aislamiento de instantánea: descontar sobre una fila ya leída en la misma transacción da `ER_CHECKREAD`. Por eso las entregas de muestra bloquean la fila del proyecto antes de cualquier otra lectura.
