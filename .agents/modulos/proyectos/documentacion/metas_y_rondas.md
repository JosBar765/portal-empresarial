# Metas por asesor y tienda, y rondas de reparto (fase 9f)

Mockups aprobados en Figma: **S20** (Seguimiento · pestaña «Metas»), **S21** (Repartir reserva por tandas) y **M16** (Mi proyecto con mi meta).

## Metas de ventas

- **Quién tiene metas:** solo un proyecto con **meta de monto** (`meta_monto` y `meta_moneda`, de la plantilla o del asistente). Sin ella no hay pestaña ni tarjeta.
- **Cómo se fija:** la meta del proyecto se reparte en **partes iguales** entre los asesores que tienen empresas en él. El supervisor puede **ajustar** la de cada asesor de sus tiendas (`proy_metas_asesor`, solo guarda lo ajustado); dejar el monto vacío vuelve a la parte igual. Ajustar una meta **no cambia las demás**: la suma puede pasar de la meta del proyecto o quedar por debajo.
- **Tienda:** su meta es la suma de la de sus asesores.
- **Avance:** lo vendido con venta **confirmada y vigente** (no anulada, rechazada ni «por confirmar») en la **moneda de la meta**. Las ventas en otras monedas se muestran aparte; nunca se mezclan ni se convierten. «Falta» no baja de cero.
- **Quién ve qué:** el supervisor y gerencia ven la pestaña «Metas» del Seguimiento (cifras: meta del proyecto, vendido, avance, falta, asesores en meta, tiendas en meta). Los asesores de otra tienda salen **sin montos y con candado**, como en el resto del seguimiento. El asesor ve su propia meta en **Mi proyecto** (tarjeta con barra).
- **Ajustar:** con `proyectos.reasignar` y solo asesores de las tiendas del supervisor, con el proyecto activo. Queda en el historial del proyecto (`ajustar_meta`) y se avisa al asesor (evento «Meta de ventas ajustada», configurable en Notificaciones).

## Rondas de reparto de la reserva

- **Qué es la reserva:** las empresas que sobraron del reparto inicial porque todos llegaron al tope por asesor (`proy_participaciones` con `asesor_id` vacío).
- **Cuándo se puede:** el parámetro **«Repartir la reserva en una segunda ronda»** (`reparto.rondas`) debe estar encendido, el proyecto activo y debe haber empresas en reserva. Solo con `proyectos.reasignar`.
- **Quiénes reciben:** los asesores **de las tiendas del supervisor** que ya gestionaron el **80 % o más** de sus empresas (parámetro `reparto.ronda_umbral`, del 1 al 100). Una persona de otra tienda no recibe, aunque haya avanzado.
- **Cuánto:** el supervisor elige la **tanda** (de 1 a 100 empresas más por asesor). Reparte con la misma regla de siempre: por país, una por una al que menos tiene (diferencia máxima de una empresa) y afinidad de tienda como desempate. Lo que sobre **sigue en reserva**.
- **Vista previa:** antes de repartir se ve cuánto recibe cada asesor y cuántas quedarían en reserva; no se guarda nada.
- **Garantías:** una sola vez por operación (clave de idempotencia), con el proyecto y la reserva bloqueados mientras se reparte; si otra persona repartió justo antes, responde 409 y pide ver la vista previa otra vez. Queda en el historial (`repartir_reserva`), se avisa a cada asesor que recibe («Reparto recibido») y se actualiza su pantalla en tiempo real.
- **Si no se puede:** nadie llegó al umbral, no hay reserva, o ninguna empresa de la reserva es del país de quienes pueden recibir: 409 con el motivo.

## API (`/api/proyectos`)

| Ruta | Quién | Qué |
|---|---|---|
| `GET /proyectos/:id/metas` | supervisor, gerencia, administración | metas y avance por asesor, cifras del proyecto |
| `PUT /proyectos/:id/metas/asesores/:asesorId` | `proyectos.reasignar` | ajusta (o `monto` vacío: quita el ajuste) |
| `GET /proyectos/:id/reserva` | supervisor, gerencia, administración | reserva, umbral y asesores de las tiendas de quien pregunta |
| `POST /proyectos/:id/reserva/repartir` | `proyectos.reasignar` | `{ tanda, soloVistaPrevia?, idempotencyKey }` |
| `GET /mi-proyecto` | asesor | ahora trae `meta` (o `null`) |

## Código

`metas.js` (reglas puras) · `services/metasCalculoService.js` · `services/metasService.js` · `services/rondasService.js` · `repositories/metasRepository.js` · `controllers/metasController.js` · migración `43_proyectos_metas_asesor.sql` · frontend `views/seguimiento.js` (pestaña, aviso de reserva y las dos ventanas) y `views/miProyecto.js` (tarjeta).

## Verificación

`node scripts/proyectos/verificar-metas-rondas.js` (base desechable; 42 comprobaciones): reglas puras, metas (vista, enmascarado, avance, otras monedas, ajuste y permisos) y rondas (apagadas, umbral, vista previa, reparto, solo tiendas del supervisor, idempotencia, avisos y proyecto cerrado).
