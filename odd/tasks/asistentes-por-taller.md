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
- [x] T6 · Documentación y verificación liviana.

## Preguntas abiertas
Ninguna.

## Verificación y evidencia
- T1: `05_asistentes_por_taller.sql` aplicado 2 veces en dev (munditrofeos): columna existe; roles nuevos ids 11, 12, 13 sin duplicados; hereda_de 7->4, 11->5, 12->9, 13->10; permisos de cada rol nuevo = los de su padre (5/5/5); rol 7 intacto (6).

- T2: ruta delegada (escritor; disparador: 2+ archivos no triviales). Sin runner de tests: RED/GREEN no aplica, verificado funcionalmente contra la API local. PUT roles/11 con permiso ajeno al padre -> 400 con mensaje; quitar permiso al rol 9 lo quita del 12 (restaurado después); rol 12 a taller Diseño -> 400, a Protextil -> 201 para 2 asistentes (datos de prueba borrados).

- T3: ruta delegada (escritor; disparador: 2+ archivos no triviales). Claim JWT nuevo `heredaDeRolId` (leído de roles.hereda_de_rol_id en login y refresco; el rol 7 cuenta como asistente aunque el token no lo traiga). Helpers `esAsistente/rolEncargadoDe/esDeTaller/esTallerODisenador` en valeHelpers.js reemplazan `ROL.ASISTENTE_DISENO` y `ROLES_ENCARGADO_TALLER.includes`; `idEncargadoEfectivo` ya no devuelve null si el taller no tiene encargado; `listarDeTaller` toma cualquier rol con padre. Verificado en dev: asistente rol 12 en Protextil -> login 200, claim 9, buzón 200 con vales de Protextil, miTallerId 3, sin vales.aprobar_general; asistente rol 7 -> buzón 200, miTallerId 1, con fusión. Usuario temporal borrado.

- T4/T5: ruta delegada (escritor; disparador: 2+ archivos no triviales). Sin runner: RED/GREEN no aplica. `node --check` como módulo OK en los 14 archivos editados; los estáticos responden 302 (login) sin servidor reiniciado. Admin: `roles.js` config data-driven (`rolEncargadoDeTaller`, `rolPadreDe`), `tallerPersonal.js` lista asistentes por rol padre, `usuarioForm` ya no bloquea roles de asistente, permisos del rol hijo atenuados/deshabilitados si el padre no los tiene (el error del API ya se muestra con `mostrarErrorModal`). Vales: `rolEncargadoDe/esAsistente` en `config/roles.js` (fallback rol 7 -> 4). Sin verificar visualmente en navegador.

- T6: ruta delegada (escritor; disparador: preparación de la escritura + verificación con servidor y BD). Doc `.agents/modulos/admin/documentacion/asistentes_por_taller.md` y una frase en CLAUDE.md. Verificado en dev: taller 3 (Protextil) con encargado_id NULL temporal, usuario temporal rol 12 -> login 200 (claim heredaDeRolId 9), GET /api/vales -> error con «El taller al que fuiste asignado no tiene un encargado.» (HTTP 500 con ese mensaje). encargado_id restaurado a 25 y usuario temporal borrado.

## Revisión visual (navegador, 127.0.0.1:3000, cuenta de pruebas admin)
- OK · Roles y Permisos, rol «Asistente de Protextil»: nota «Este rol hereda de un encargado…» y permisos que el encargado no tiene atenuados y deshabilitados (fusión, admin.*, crear, etc.); los heredables siguen marcados.
- OK · «Marcar/Desmarcar todos» solo cambia los permisos habilitados y no toca los atenuados.
- OK · Los 4 roles de asistente aparecen en el listado de roles.
- Discrepancia (menor, texto): en Gestionar Talleres > Personal, la sección se llama «Diseñadores» y el botón «Agregar diseñador», pero ahora también agrupa asistentes. Pendiente decidir si se renombra a «Personal».
- No verificado: lista de candidatos del selector (en dev no hay usuarios sin taller con rol de asistente ni diseñadores libres; el selector solo mostró «Seleccionar…»); buzón visual de un asistente (el botón «Cerrar sesión» no respondió y se detuvo la revisión); sockets y notificaciones en vivo.

## Segunda revisión (usuarios de prueba creados en dev, ver Engram `dev/usuarios-prueba-asistentes`)
- OK · Selector de personal del taller Protextil: solo ofrece los asistentes de rol Protextil sin taller (no los de UV/3D ni Local), con la etiqueta «(Asistente)».
- OK · Asignar dos asistentes de Protextil al mismo taller desde la interfaz: ambos quedan en `taller_disenadores` (taller 3).
- OK · Buzón visual del asistente de Protextil: ve los vales de Protextil con las acciones del encargado (revisar, asignar) y sin cola de fusión.
- OK · Tiempo real: con el asistente conectado, el encargado asignó el vale 201; el buzón del asistente se refrescó solo (Por asignar 1→0, Asignado 2→3) y apareció la notificación con aviso en la campana.
- Efecto en dev: el vale 201 quedó asignado a Katherine Recinos (antes PENDIENTE_ASIGNACION); los 4 usuarios de prueba y las 2 asignaciones se dejaron en la BD de desarrollo.
- No probado: que un asistente de OTRO taller no reciba el evento, y el caso de taller sin encargado en el navegador.

## Siguiente paso
Revisar y abrir el PR (decisión del usuario). Recordar importar `asistentes_por_taller.sql` antes de desplegar.
