# Correcciones 40 — Contadores del Buzón por paso y por rol

Rama: `feature/contadores-por-paso` (desde `dev`). Solo cambian los contadores del **Buzón**; Trabajo realizado y Administrador quedan igual.

## Contadores nuevos

| Rol | Contadores (filtran) | Interruptores combinables |
|---|---|---|
| Asesor y Supervisor | Por autorizar *(Gerencia)* · Por asignar *(Encargado de taller)* · En proceso *(Diseñador)* · En revisión *(Encargado de taller)* · Por recibir *(Asesor)* | Modificados · Atrasados (el Supervisor conserva «Autorizados hoy (equipo)», informativo) |
| Encargado de taller | Por asignar · Asignado *(Diseñadores)* · Mis asignaciones · Por revisar · Por fusionar *(con `vales.aprobar_general`)* + combobox de diseñadores | Atrasados |
| Diseñador | Mis asignaciones (Sin retraso) · Mis asignaciones (Con atraso) · Vale en proceso | — |

## Reglas

- **Asesor y Supervisor** clasifican cada vale por el **paso del pipeline** (`calcularPipeline(v).paso`, `valePipeline.js`): Por autorizar = paso 1 (incluye solicitando modificación y rechazados); Por asignar = paso 2 (por asignar y asignado); En proceso = paso 3 (en proceso y en pausa); En revisión = paso 4 (en revisión y fusión pendiente); Por recibir = paso 5. Cada vale cuenta en un solo contador, y con varios talleres cuenta el del taller más atrasado.
- **Modificados** = vales `MOD-` y sus originales (`modificado = 1` o con una modificación en trámite). **Atrasados** y **Modificados** son interruptores que se combinan con el contador activo y entre sí.
- El **Supervisor** ahora ve todos los vales activos de su equipo (antes solo lo que debía autorizar y sus propios), porque los contadores por paso lo necesitan.
- **Encargado:** Asignado = asignado, en proceso o en pausa con un diseñador que no es él; Mis asignaciones = filas de su taller asignadas a él (asignado, en proceso, en pausa o en revisión); Por revisar = en revisión; Por fusionar = fusión pendiente. Desaparecen las tarjetas En proceso y En pausa (esos vales siguen en la lista y en el filtro de estado). El combobox filtra por el diseñador de la fila de su taller y se combina con los contadores; solo aparece en el Buzón.
- **Diseñador:** solo cambia el nombre de las dos primeras tarjetas.
- Los números de las tarjetas no cambian al activar un filtro; debajo de la etiqueta va «quién actúa» en texto pequeño y gris.

## Alerta de urgente

El aviso del formulario ahora dice «El vale se marcará como urgente, entrega en menos de 3 días».

## Archivos

- Backend: `valeBuzonService.js` (contadores, `esModificado`, `conPaso`, filtros `soloModificados` y `disenadorId`), `valeController.js` (parámetros del buzón).
- Frontend: `config/contadores.js`, `views/buzon.js`, `layout/toolbar.js` y `layout/sidebar.js` (combobox), `state.js`, `index.html`, `css/styles.css`, `forms/valeForm.js`.

## Verificación

Probado con 16 vales de ejemplo en una base local (todos los pasos, `MOD-`, originales modificados, atrasados, autoasignados del encargado y fusión): por API para asesor, supervisor, encargado y diseñador, y en el navegador para supervisor y encargado. La suma de los 5 contadores del asesor y del supervisor coincide con el total, y Modificados, Atrasados y el combobox combinan como se espera.
