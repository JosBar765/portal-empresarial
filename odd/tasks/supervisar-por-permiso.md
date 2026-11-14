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
- [ ] T8. Prueba comparativa en la BD local: rol de prueba + usuario de prueba en la misma tienda que un supervisor existente; comparar «Ver personal», candidatos, buzón/autorización de vales y un vale creado por cada uno. Control: resultados del rol 3 idénticos a `dev`.

## Rutas
Delegado (un escritor): T1-T7 (2+ archivos no triviales, lectura que prepara la escritura). T8: delegado a un verificador; la BD local y el servidor (puerto 3000, reinicio automático) los levantó el dueño.

## Pruebas
Sin runner automatizado en el proyecto; RED/GREEN no aplica (excepción registrada). Verificación: comparación de resultados viejos vs nuevos para el rol 3 y prueba funcional en la BD de desarrollo autorizada por el dueño (2026-11-14), verificando `NODE_ENV=development` antes de escribir.

## Evidencia
- Análisis de dependencias (2026-11-14): vales decide por permiso; el acoplamiento está en admin (`adminService.js:86,133,198,337,353`, `tiendaAdminRepository.js:121`, `tiendaPersonal.js:83`, `menuCascada.js:134-139`).
- T1-T7 hechas (2026-11-14), un escritor delegado: 10 archivos modificados + `permisoSupervisarSql.js` nuevo. `node --check` OK en backend y front. Diff revisado por el padre.
- Pendiente: comparación viejo vs nuevo en la BD local (el escritor no pudo leer `.env`) y T8.
