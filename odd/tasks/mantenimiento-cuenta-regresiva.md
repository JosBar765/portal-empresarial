# mantenimiento-cuenta-regresiva

Rama: `feature/mantenimiento-cuenta-regresiva` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: T1–T4 completas.

## Objetivo
Que el modo mantenimiento avise con una cuenta regresiva de **10 minutos** antes de bloquear, y que al terminar la cuenta se cierren las sesiones de todos los usuarios que no son Administrador. Además, que la pantalla de mantenimiento tenga un botón «Cerrar sesión» (hoy quien entra durante el mantenimiento no puede salir).

## Decisiones del usuario
- **Opción A:** al activar el mantenimiento empieza la cuenta regresiva de 10 minutos; durante ese tiempo los usuarios **siguen trabajando** y ven un aviso con la cuenta («El sistema entra en mantenimiento en MM:SS»). Al llegar a 0 se activa el bloqueo y se botan las sesiones de **todos menos las del rol Administrador**.
- El administrador puede **cancelar** (desactivar) durante la cuenta regresiva.
- La cuenta regresiva sobrevive a un reinicio del servidor (se guarda en la base); 10 minutos fijos en el código, no editables.
- La pantalla de mantenimiento lleva el botón «Cerrar sesión» (cierra la sesión y lleva al login); el cierre de sesión debe funcionar con el bloqueo activo.
- Cambio de base: script idempotente nuevo `database/04_mantenimiento_cuenta_regresiva.sql` (citado sin correlativo en la documentación). Recordar al usuario importarlo ANTES de desplegar.

## Tareas
- [x] T1 · Script de base de datos (`mantenimiento_cuenta_regresiva.sql`).
- [x] T2 · Backend: estado con cuenta regresiva, cierre de sesiones al terminar, tiempo real, endpoint de estado, recuperación tras reinicio.
- [x] T3 · Frontend: aviso con cuenta regresiva (dashboard y módulos), pantalla de mantenimiento con «Cerrar sesión», vista del administrador con cuenta y cancelar.
- [x] T4 · Documentación y verificación (con tiempos acortados en la base, sin esperar 10 minutos).

## Verificación y evidencia
- T1 (e727285): script aplicado dos veces a la BD de desarrollo; columnas `inicia_en` y `sesiones_cerradas_en` verificadas.
- T2 (4e03ce3): ruta delegada (escritor único). Pruebas HTTP/BD PASS: estado sin cookie 401; activar -> ~600 s y asesor opera (buzón 200); doble activación -> error sin reiniciar; cancelar restablece todo; con la cuenta vencida (reinicio del dev server rearma el temporizador) asesor y supervisor reciben 503 `mantenimiento`, sus `sesiones_activas` desaparecen, las del administrador `claude` y del admin real siguen; `sesiones_cerradas_en` sellado y no se repite; recuperación tras reinicio cierra y emite `sesion_revocada` (verificado con stub de `sendToUsers`); fila legada con `inicia_en` NULL bloquea sin cerrar sesiones; login con bloqueo activo y `POST /api/auth/logout` = 200.
- T3 (f06abe1): navegador (127.0.0.1:3000): barra con contador bajando en dashboard y Vales, desaparece al cancelar por socket; el socket del asesor lo llevó a /login/?expired=true al cerrarse; pantalla de mantenimiento con «Cerrar sesión» lleva a /login/; vista admin con «Entra en mantenimiento en MM:SS» y «Cancelar mantenimiento». eslint sin errores nuevos.
- T4: documentación `.agents/modulos/admin/documentacion/mantenimiento_cuenta_regresiva.md` y nota en CLAUDE.md.
- Decisión: activar estando ya activo devuelve error y no reinicia la cuenta.

## Siguiente paso
Revisión y PR (decisión del usuario). Recordar importar `mantenimiento_cuenta_regresiva.sql` antes de desplegar.
