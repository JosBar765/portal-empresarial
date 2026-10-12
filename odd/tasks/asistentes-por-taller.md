# asistentes-por-taller

Rama: `feature/asistentes-por-taller` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: plan creado, sin código.

## Objetivo
Que el Asistente pueda asignarse a cualquier taller (Diseño, Diseño UV/3D, Protextil y Diseño Local), con varios asistentes por taller, y que sus permisos sean los de su encargado. Sin romper producción.

## Decisiones del usuario
- Asistentes en cualquier taller; sin límite de uno por taller ni por tienda (2026-10-12).
- La fusión (`vales.aprobar_general`) solo la tiene el asistente si el rol del encargado de su taller la tiene. Si no la tiene, dar ese permiso al rol del asistente debe **fallar con error**, tanto en la pestaña de roles del admin como desde la API.
- Modelo: un rol de asistente por tipo de taller. El rol 7 (Asistente de Diseño) se queda como está; roles nuevos para UV/3D, Protextil y Diseño Local. Cada uno hereda de su rol de encargado (4, 5, 9, 10) mediante `roles.hereda_de_rol_id`.
- Los permisos del rol de asistente se editan solo hacia abajo (menos que su encargado, nunca más). Si se quita un permiso al rol del encargado, se quita en cascada, en la misma operación, a sus roles de asistente. Si se agrega un permiso al encargado, el asistente NO lo recibe: se agrega a mano.
- Producción tiene un solo usuario con rol 7, en el taller Diseño: no hay datos que migrar.
- Pruebas livianas (no saturar la API local ni gastar tokens). Cuenta de pruebas en Engram `dev/cuenta-admin-pruebas`.

## Tareas
- [x] T1 · Script SQL idempotente `asistentes_por_taller.sql`: columna `roles.hereda_de_rol_id`, roles nuevos (por nombre, sin ids fijos), permisos copiados del rol padre, rol 7 marcado como hijo del 4.
- [x] T2 · Backend admin: validar permisos de roles heredados (crear/actualizar), quitar unicidad del asistente, permitir asignarlo a cualquier taller según su tipo de rol, varios por taller.
- [x] T3 · Backend vales: tratar los 4 roles de asistente como el encargado de su taller (buzón, fusión, sockets, detalle).
- [x] T4 · Frontend admin: error visual en la pestaña de roles, formulario de usuario y gestión de personal del taller.
- [x] T5 · Frontend vales: roles de asistente en `config/roles.js` y `permisos.js`.
- [ ] T6 · Documentación y verificación liviana.

## Preguntas abiertas
Ninguna.

## Verificación y evidencia
- T1: `05_asistentes_por_taller.sql` aplicado 2 veces en dev (munditrofeos): columna existe; roles nuevos ids 11, 12, 13 sin duplicados; hereda_de 7->4, 11->5, 12->9, 13->10; permisos de cada rol nuevo = los de su padre (5/5/5); rol 7 intacto (6).

- T2: ruta delegada (escritor; disparador: 2+ archivos no triviales). Sin runner de tests: RED/GREEN no aplica, verificado funcionalmente contra la API local. PUT roles/11 con permiso ajeno al padre -> 400 con mensaje; quitar permiso al rol 9 lo quita del 12 (restaurado después); rol 12 a taller Diseño -> 400, a Protextil -> 201 para 2 asistentes (datos de prueba borrados).

- T3: ruta delegada (escritor; disparador: 2+ archivos no triviales). Claim JWT nuevo `heredaDeRolId` (leído de roles.hereda_de_rol_id en login y refresco; el rol 7 cuenta como asistente aunque el token no lo traiga). Helpers `esAsistente/rolEncargadoDe/esDeTaller/esTallerODisenador` en valeHelpers.js reemplazan `ROL.ASISTENTE_DISENO` y `ROLES_ENCARGADO_TALLER.includes`; `idEncargadoEfectivo` ya no devuelve null si el taller no tiene encargado; `listarDeTaller` toma cualquier rol con padre. Verificado en dev: asistente rol 12 en Protextil -> login 200, claim 9, buzón 200 con vales de Protextil, miTallerId 3, sin vales.aprobar_general; asistente rol 7 -> buzón 200, miTallerId 1, con fusión. Usuario temporal borrado.

- T4/T5: ruta delegada (escritor; disparador: 2+ archivos no triviales). Sin runner: RED/GREEN no aplica. `node --check` como módulo OK en los 14 archivos editados; los estáticos responden 302 (login) sin servidor reiniciado. Admin: `roles.js` config data-driven (`rolEncargadoDeTaller`, `rolPadreDe`), `tallerPersonal.js` lista asistentes por rol padre, `usuarioForm` ya no bloquea roles de asistente, permisos del rol hijo atenuados/deshabilitados si el padre no los tiene (el error del API ya se muestra con `mostrarErrorModal`). Vales: `rolEncargadoDe/esAsistente` en `config/roles.js` (fallback rol 7 -> 4). Sin verificar visualmente en navegador.

## Siguiente paso
Resolver la pregunta abierta y empezar T1.
