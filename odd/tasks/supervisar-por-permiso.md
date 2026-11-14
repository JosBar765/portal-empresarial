# fix/supervisar-por-permiso: la supervisión de tiendas se decide por `vales.supervisar`, no por el rol 3

Rama: `fix/supervisar-por-permiso` (desde `dev` actualizado, 2026-11-14). Estado: en curso. Estrategia de entrega: `ask-on-risk`.

## Objetivo
Un rol nuevo con `vales.supervisar` (copia del rol 3 + permisos de viáticos) debe poder asignarse a tiendas y supervisar desde el panel admin igual que el rol 3. El comportamiento del rol 3 en producción debe quedar IDÉNTICO.

## Problema
El flujo de vales ya decide por permiso + datos (`supervisor_tiendas`, `asesor_supervisores`, `asesores`), pero el panel admin sigue atado a `rol_id = 3`: guard que solo deja el permiso al rol 3, asignación de cobertura a tiendas, listado «Ver personal», candidatos y selector de roles con ids fijos.

## Alcance
- Solo admin: `adminService.js`, `tiendaAdminRepository.js`, `usuarioAdminRepository.js`, `supervisionAsesorRepository.js` (solo para extraer el helper), `tiendaPersonal.js`, `roles.js` (admin), `menuCascada.js`, docs.
- Fuera de alcance (decisión del dueño): supervisión especial por asesor, fila `supervisores`/teléfono en crear/editar usuario, el `UPDATE` de usuarios en producción, el rol 3 y sus `rol_permisos`.
- Antes de desplegar (lo corre el dueño en producción): roles con el permiso = solo el 3; usuarios rol 3 sin el permiso = vacío; `supervisor_tiendas` sin usuarios de otro rol.

## Tareas
- [x] T1. Extraer el helper SQL `CON_PERMISO_SUPERVISAR` (hoy `supervisionAsesorRepository.js:5-6`) a un módulo compartido sin cambiar su resultado.
- [x] T2. `tiendaAdminRepository.js` («Ver personal»): `rol_id = 3` pasa a permiso.
- [x] T3. `adminService.js` agregar/quitar cobertura: `rol_id === ROL_SUPERVISOR` pasa a permiso del rol.
- [x] T4. Candidatos: campo `es_supervisor` en `usuarioAdminRepository.js` y `tiendaPersonal.js` lo usa.
- [x] T5. Levantar el guard (`adminService.js` `_exigirSupervisarSoloEnSupervisor` y `roles.js` admin) y actualizar comentarios «solo el rol 3».
- [x] T6. `menuCascada.js`: mostrar al final los roles activos no listados.
- [x] T7. Docs en `.agents/modulos/admin/` y vales.
- [x] T8. Prueba comparativa en la BD local: rol de prueba + usuario de prueba en la misma tienda que un supervisor existente; comparar «Ver personal», candidatos, buzón/autorización de vales y un vale creado por cada uno. Control: resultados del rol 3 idénticos a `dev`.

## Fase 2 (2026-11-14): que TODO funcione igual para quien cambie al rol nuevo
Pedido del dueño tras la primera prueba: cerrar lo que quedó fuera de alcance, porque el supervisor existente (`supervisor1@trofex.com`) pasará al rol nuevo y no debe notar diferencia.
- [x] T9. Crear/editar usuario: la fila `supervisores` y el teléfono se deciden por el permiso del rol, no por el rol 3 (backend `adminService.crearUsuario`/`actualizarUsuario`, `actualizarSupervisor` que inserte si falta la fila, y `usuarioForm.js` que muestra el teléfono para ese rol).
- [x] T10. Supervisión especial por asesor: quién puede ser supervisor asignable y cómo se valida se decide por el permiso (`supervisionAsesorRepository.listarAsignables`, `supervisionAsesorService`, y el frontend si filtra por rol).
- [ ] T11. Prueba exacta: `supervisor1@trofex.com` (rol 3) con vales de una tienda que cubre, antes y después de pasarlo al rol de prueba; acciones de vales, asignarlo a otra tienda, editar su teléfono, supervisión especial; devolverlo al rol 3.
- [ ] T12. Vistas en navegador: `ventas1` (rol 3) frente al usuario de prueba (rol nuevo), mismas pantallas del módulo de vales y del panel admin; comparar contenido y capturas.
- Decisión T-red: la «red de seguridad» del rol 3 sin permiso (`rolVista`, `_rolDelBuzon`, `resolverAlcance`) no se generaliza: solo aplica si se QUITA `vales.supervisar` a un rol y no se puede inferir por el id de un rol nuevo; con el permiso el comportamiento es idéntico.

## Rutas
Delegado (un escritor): T1-T7 (2+ archivos no triviales, lectura que prepara la escritura). T8: delegado a un verificador; la BD local y el servidor (puerto 3000, reinicio automático) los levantó el dueño.

## Pruebas
Sin runner automatizado en el proyecto; RED/GREEN no aplica (excepción registrada). Verificación: comparación de resultados viejos vs nuevos para el rol 3 y prueba funcional en la BD de desarrollo autorizada por el dueño (2026-11-14), verificando `NODE_ENV=development` antes de escribir.

## Evidencia
- Análisis de dependencias (2026-11-14): vales decide por permiso; el acoplamiento está en admin (`adminService.js:86,133,198,337,353`, `tiendaAdminRepository.js:121`, `tiendaPersonal.js:83`, `menuCascada.js:134-139`).
- T1-T7 hechas (2026-11-14), un escritor delegado: 10 archivos modificados + `permisoSupervisarSql.js` nuevo. `node --check` OK en backend y front. Diff revisado por el padre.
- Equivalencia (2026-11-14, BD local con `NODE_ENV=development`, por la conexión de la app; `.env` bloqueado): solo el rol 3 tiene `vales.supervisar`; ningún rol 3 activo sin el permiso; `supervisor_tiendas` sin usuarios de otros roles; «Ver personal» viejo vs nuevo en 27 tiendas: 0 diferencias; candidatos `es_supervisor` vs `rol_id = 3` en 92 usuarios: 0 diferencias.
- T8 por la API HTTP con la cuenta admin de pruebas (rol 42 «Supervisor con viáticos (prueba)» = permisos del rol 3 + `viaticos.ver` y `viaticos.gestionar`; usuario 136). Panel: crear el rol con `vales.supervisar` (201), guardar sus permisos (200), asignarlo a las tiendas 1 y 2, listarlo en «Ver personal», quitarlo y reasignarlo; la tienda 2 sigue mostrando a `ventas1` y `gerentesala`; control negativo: un encargado de taller sigue sin asignarse (400).
- T8 vales, `ventas1` (rol 3) vs usuario nuevo, mismo resultado en: permisos efectivos del token, detalle (`ESPERANDO_AUTORIZACION`), marcar visto, autorizar (`CREADO`), rechazar (`RECHAZADO`), crear vale como supervisor, autorizar el propio vale, doble autorización (mismo error) y dar de baja tras autorizar (mismo error). Con la misma cobertura el buzón difiere solo en los vales propios de cada uno (6 de `ventas1`, 1 del nuevo); 97 coinciden.
- Nota de método: autorizar o rechazar exige que ese supervisor marque «Ver» antes (visto por usuario); una primera corrida lo pasó por alto y no era una diferencia del código.
- Datos de prueba que quedan en la BD local: rol 42, usuario 136 (con fila en `asesores` de la tienda 1 y cobertura de las tiendas 1 y 2) y los vales 9433 a 9444 más los de la segunda corrida.
- No probado: notificaciones por socket y la UI en navegador; el comportamiento en producción depende de las 3 consultas previas (mismos resultados esperados que en local).
