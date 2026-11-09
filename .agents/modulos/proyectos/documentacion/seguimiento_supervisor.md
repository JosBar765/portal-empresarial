# Seguimiento del supervisor (fase 5)

El supervisor ve el avance de su equipo, mueve empresas entre asesores, corrige registros equivocados y confirma las ventas «por confirmar». Aquí se describe el **servidor** (rama 5a).

## Alcance: tres niveles

| Nivel | Regla |
|---|---|
| **Lectura del proyecto** | Un supervisor ve el proyecto completo si al menos una de **sus** tiendas (`supervisor_tiendas`) está en él; si no, responde 404. Gerencia (`proyectos.ver_gerencia`) y administración ven todos. |
| **Acción** | Reasignar, anular y confirmar solo sobre participaciones cuya `tienda_id` sea de sus tiendas (403 si no). Administración actúa en todas; gerencia nunca. |
| **Fila** | Un asesor sigue viendo solo lo suyo (fase 4). |

**«Otra tienda».** Lo de tiendas ajenas sale del servidor con empresa, asesor, estado y días sin gestión, y **contacto, teléfono, referencia y monto en `null`** (`alcanceSeguimiento.enmascararFila`); la ficha de una empresa ajena viene sin contactos ni historial y sin acciones. En «por asesor» las tiendas ajenas solo muestran asignadas y gestionadas. Gerencia ve el detalle de todas.

## Avance

- **Cifras** del proyecto: asignadas, gestionadas, interesadas, cotizadas, vendidas y efectividad; acumulativas, sin lo anulado y sin las ventas «por confirmar».
- **Semáforo de cobertura** (gestionadas ÷ asignadas): verde desde `semaforo.cobertura_verde` %, ámbar desde `semaforo.cobertura_ambar` %, rojo debajo. Usa los valores de la **foto de configuración** del proyecto.
- **Tiempo de reacción** por asesor: días entre su primera asignación y su primera gestión (si aún no gestiona, los días desde que se le asignó).
- **Estancados**: sin gestión desde `seguimiento.dias_estancado` días (la asignación cuenta si nunca se gestionó); de la más antigua a la más reciente; por defecto 7 filas y `?todos=1` trae todas. Vendidas, perdidas y descartadas no cuentan.

## Reasignación (`proyectos.reasignar`)

Una empresa, varias o **todas las pendientes de un asesor** (hasta 500), a un asesor participante de las tiendas del supervisor o con `aAsesorId: 'equitativo'` (usa `repartoService.calcular` con la carga actual, sin los asesores de origen y respetando el país). Motivo obligatorio. `soloVistaPrevia: true` devuelve cuántas recibe cada asesor sin escribir. Todo en una transacción (se bloquea el proyecto y luego las empresas en orden de id): cambia `asesor_id` y `tienda_id`, conserva el estado, escribe `proy_reasignaciones` e historial del proyecto. Solo en proyectos activos; no mueve vendidas, perdidas ni descartadas. Idempotente por `idempotencyKey`. **Avisa** a quien recibe y a quien cede (si no son quien reasigna) con una notificación del módulo y el evento de socket `proyectos_reasignacion` en las salas `usuario:<id>`.

## Anulación (`proyectos.corregir`)

Anular una **cotización** o una **venta** con motivo: quedan quién, cuándo y por qué (`anulada_*`), no cuentan, y el estado de la empresa se **recalcula** con `estadoParticipacion.derivar` (la venta anulada deja «cotizada»; luego, «interesada»). Una perdida o descartada conserva su marca. Solo en proyectos activos y de tiendas del supervisor; avisa al asesor. *Las gestiones no tienen columnas de anulación (migración 35): se verá en la fase 9.*

## Ventas por confirmar (`proyectos.confirmar_ventas`)

`GET /ventas?estado=por_confirmar|confirmada|rechazada` lista las de las tiendas de la persona con conteos y si la regla está activa. **Confirmar** pasa la venta a `confirmada` y la empresa a «vendida»; **rechazar** exige motivo y la venta queda `rechazada` (no cuenta). Una venta ya revisada responde 409. Avisa al asesor.

## API (`/api/proyectos`)

| Ruta | Permiso |
|---|---|
| `GET /seguimiento/proyectos` | supervisar · ver_gerencia · administrar |
| `GET /proyectos/:id/seguimiento` (+ `/asesores`, `/tiendas`, `/estancados`) | ídem |
| `GET /participaciones/:id/supervision` | ídem |
| `POST /proyectos/:id/reasignar` | `proyectos.reasignar` |
| `POST /participaciones/:id/cotizaciones/:cid/anular` · `/ventas/:vid/anular` | `proyectos.corregir` |
| `GET /ventas` · `POST /ventas/:id/confirmar` · `/rechazar` | `proyectos.confirmar_ventas` |

## Código

`alcanceSeguimiento.js` (reglas puras) · `repositories/seguimientoRepository.js` (SQL) · `services/seguimientoService.js` · `controllers/seguimientoController.js` · rutas en `routes.js`.

## Verificación

`node scripts/proyectos/verificar-seguimiento.js` (base desechable; 69 comprobaciones, también en MariaDB 11.8): niveles de alcance, fila «Otra tienda», cifras y semáforo, estancados, reasignación (una, masiva, equitativa, carrera), anulaciones con recálculo, cola de ventas y avisos.
