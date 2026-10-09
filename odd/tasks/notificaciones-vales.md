# notificaciones-vales

Rama: `feature/notificaciones-vales` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: T1–T5 pendientes.

## Objetivo
Que cada actor reciba, en aviso y en tiempo real, los cambios de estado que le importan, según lo decidido con el usuario tras la auditoría por actor.

## Reglas acordadas
- **Asesor:** aviso al comenzar el trabajo (la pantalla pasa sola del paso 2 al 3); aviso cuando UN taller aprueba su parte aunque haya varios; aviso de la fusión. Ya NO recibe «cancelar proceso» (el taller conserva su alerta roja). Pausar y reanudar: sin cambios (no le importan).
- **Supervisor:** mismos avisos y tiempo real que el asesor sobre los vales de su equipo; toda corrección se avisa siempre (también si el vale estaba `RECHAZADO`); avisa la fusión.
- **Fusión (`vales.aprobar_general`, roles 4 y 7):** al fusionar un vale, todos los demás que fusionan se actualizan en tiempo real.
- **Taller (encargado + asistentes):** el atraso se avisa también con el proceso en `EN_PAUSA`; la confirmación de recibido no les llega (su flujo termina en el estado 4).
- **Diseñador:** aviso cuando su propuesta es aprobada; atraso también en pausa.
- **Autoaprobación:** una sola notificación por persona.
- **Redacción:** corregir los textos de pausar, reanudar y cancelar (usar `texto`).
- **Gerente y Administrador:** sin cambios (el gerente no recibe nada; el admin solo carteles).

## Tareas
- [x] T1 · Asesor: aviso en `comenzar`; aviso en `aprobar` (taller) siempre; quitar al asesor de `cancelar`; fusión avisa al asesor.
- [ ] T2 · Supervisor y fusión: corrección siempre al supervisor; fusión a supervisores (`supervisor:<id>`) y a `vales:fusion`.
- [ ] T3 · Taller y diseñador: atraso con `EN_PAUSA` (`atrasoWatcher.js`); aprobación al `disenador:<id>` de la fila; autoaprobación con una sola notificación.
- [ ] T4 · Redacción de pausar, reanudar y cancelar.
- [ ] T5 · Documentación (`flujo_vale_de_arte.md` §8, `CLAUDE.md` si aplica) y verificación de punta a punta con script contra la BD de desarrollo.

## Verificación y evidencia
- T1: eslint sin errores; script `nt.js` contra la BD de desarrollo: comenzar notifica al asesor; aprobar un taller (vale de 2 talleres) notifica al asesor (1 fila); cancelar proceso: asesor sin fila, taller con fila alerta; fusión mantiene el aviso al asesor.

## Ruta por tarea
(pendiente: se registra al ejecutar cada una)

## Siguiente paso
Delegar un escritor para T1–T4 y verificar.
