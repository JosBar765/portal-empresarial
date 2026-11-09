# Avisos y vigilante (fase 6c)

Qué eventos avisan, a quién y con cuánta anticipación lo decide el administrador en la pantalla **Notificaciones** (A8). Un servicio único entrega los avisos y un vigilante revisa los recordatorios.

## Registro de eventos

`eventos.js` lista los eventos con sus roles (asesor, supervisor, gerente) y su valor por defecto. La clave del evento es también el `tipo` de la notificación.

| Grupo | Evento (clave) | Avisa por defecto a | Anticipación |
|---|---|---|---|
| Reparto | Reparto recibido (`reparto_recibido`) · La recibe (`reasignada_recibe`) · La pierde (`reasignada_pierde`) | asesor | |
| Seguimiento | Seguimiento que vence (`seguimiento_vence`) | asesor | 0 horas antes |
| | Seguimiento vencido (`seguimiento_vencido`) | asesor y supervisor | |
| Proyecto | Proyecto por cerrar (`proyecto_por_cerrar`) | supervisor | 3 días antes |
| | Proyecto vencido (`proyecto_vencido`) | supervisor y gerente | |
| Aprobaciones | Activación pedida (`activacion_pedida`) | gerente | |
| | Activación aprobada o rechazada (`activacion_resuelta`) | supervisor | |
| | Cierre pendiente de visto bueno (`cierre_pendiente`) | gerente | |
| | Visto bueno dado o devuelto (`visto_bueno_resuelto`) | supervisor | |
| Ventas | Venta por confirmar (`venta_por_confirmar`) | supervisor | |
| | Venta confirmada o rechazada (`venta_revisada`) | asesor | |
| | Cotización o venta anulada (`registro_anulado`) | asesor | |
| Muestras | Existencia baja (`existencia_baja`, fase 9) | supervisor | 20 unidades |

## Cómo se decide a quién se avisa (`avisosService.notificar`)

- Se leen los valores por defecto de `eventos.js` y lo que cambió el administrador (tablas `proy_avisos_config` y `proy_avisos_anticipacion`, migración 40: solo guardan los cambios; sin filas, todo está en su valor por defecto).
- **Asesor:** los que da la acción (el que recibe o pierde la empresa, el dueño de la venta). **Supervisor:** los que cubren alguna tienda del proyecto (`supervisor_tiendas`), o quien pidió la activación o cerró el proyecto. **Gerente:** quien tiene `proyectos.ver_gerencia` o `proyectos.dar_visto_bueno`.
- **Nunca se avisa a quien hace la acción**, y quien cae en dos roles recibe un solo aviso.
- Se entrega por el centro de notificaciones (campana, con un ícono por tipo) y por socket; las reasignaciones y anulaciones repintan además la pantalla del asesor.
- Un fallo al avisar nunca deshace la operación.

## Matriz A8 (`#/notificaciones`, `proyectos.administrar`)

`GET /config/avisos`, `PUT /config/avisos` (`celdas: [{ evento, rol, activo }]`, `anticipaciones: { evento: valor }`) y `POST /config/avisos/restaurar`. Cada cambio se guarda al momento, se valida (celda que no aplica, anticipación fuera de rango) y queda en el historial de cambios (A10, área «Notificaciones»). «Restaurar valores por defecto» borra los cambios.

## Vigilante (`proyectosWatcher.js`)

Cada 15 minutos, en el mismo proceso (como los de Vales), revisa:

- **Seguimiento que vence:** el de hoy cuya hora ya llegó (o llega dentro de la anticipación). **Seguimiento vencido:** el de un día anterior. Los dos solo en proyectos activos y empresas sin resultado final.
- **Proyecto por cerrar:** la fecha de fin está dentro de la anticipación (días). **Proyecto vencido:** la fecha de fin más los días hábiles de gracia (`vencimiento.gracia_dias_habiles`, los de la foto de configuración del proyecto) ya pasó; se sella en `proy_proyectos.aviso_vencido_en`.
- Cada aviso sale **una sola vez** (sello por evento y fecha). **No cierra nada solo**: el cierre pide las conclusiones.

## Código

`eventos.js` · `services/avisosService.js` · `repositories/avisosRepository.js` · `proyectosWatcher.js` (iniciado en `app.js`) · `controllers/avisosController.js` · frontend `views/avisos.js` y los íconos de la campana en `public/js/notificaciones.js` · migración `40_proyectos_avisos`.

## Verificación

`node scripts/proyectos/verificar-avisos.js` (base desechable; 34 comprobaciones, también en MariaDB 11.8): matriz, validaciones, historial, restaurar, quién recibe cada aviso (nunca el autor), reparto, aprobación, cierre, visto bueno, venta por confirmar y las cuatro revisiones del vigilante sin repetidos.
