# mantenimiento-cuenta-regresiva

Rama: `feature/mantenimiento-cuenta-regresiva` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: T1–T4 pendientes.

## Objetivo
Que el modo mantenimiento avise con una cuenta regresiva de **10 minutos** antes de bloquear, y que al terminar la cuenta se cierren las sesiones de todos los usuarios que no son Administrador. Además, que la pantalla de mantenimiento tenga un botón «Cerrar sesión» (hoy quien entra durante el mantenimiento no puede salir).

## Decisiones del usuario
- **Opción A:** al activar el mantenimiento empieza la cuenta regresiva de 10 minutos; durante ese tiempo los usuarios **siguen trabajando** y ven un aviso con la cuenta («El sistema entra en mantenimiento en MM:SS»). Al llegar a 0 se activa el bloqueo y se botan las sesiones de **todos menos las del rol Administrador**.
- El administrador puede **cancelar** (desactivar) durante la cuenta regresiva.
- La cuenta regresiva sobrevive a un reinicio del servidor (se guarda en la base); 10 minutos fijos en el código, no editables.
- La pantalla de mantenimiento lleva el botón «Cerrar sesión» (cierra la sesión y lleva al login); el cierre de sesión debe funcionar con el bloqueo activo.
- Cambio de base: script idempotente nuevo `database/04_mantenimiento_cuenta_regresiva.sql` (citado sin correlativo en la documentación). Recordar al usuario importarlo ANTES de desplegar.

## Tareas
- [ ] T1 · Script de base de datos (`mantenimiento_cuenta_regresiva.sql`).
- [ ] T2 · Backend: estado con cuenta regresiva, cierre de sesiones al terminar, tiempo real, endpoint de estado, recuperación tras reinicio.
- [ ] T3 · Frontend: aviso con cuenta regresiva (dashboard y módulos), pantalla de mantenimiento con «Cerrar sesión», vista del administrador con cuenta y cancelar.
- [ ] T4 · Documentación y verificación (con tiempos acortados en la base, sin esperar 10 minutos).

## Verificación y evidencia
(pendiente)

## Siguiente paso
Delegar un escritor para T1–T4.
