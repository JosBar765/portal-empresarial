# fix/supervisar-por-permiso: la supervisión de tiendas se decide por `vales.supervisar`, no por el rol 3

Rama: `fix/supervisar-por-permiso` (desde `dev` actualizado, 2026-11-14). Estado: **hecho y mergeado en `module/viaticos`** (12 de 12 tareas, 2026-11-14); la rama `fix/supervisar-por-permiso` se borró sin haberse publicado. Estrategia de entrega: `ask-on-risk`.

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
- [x] T11. Prueba exacta: `supervisor1@trofex.com` (rol 3) con vales de una tienda que cubre, antes y después de pasarlo al rol de prueba; acciones de vales, asignarlo a otra tienda, editar su teléfono, supervisión especial; devolverlo al rol 3.
- [x] T12. Vistas en navegador: `ventas1` (rol 3) frente al usuario de prueba (rol nuevo), mismas pantallas del módulo de vales y del panel admin; comparar contenido y capturas.
- Decisión T-red: la «red de seguridad» del rol 3 sin permiso (`rolVista`, `_rolDelBuzon`, `resolverAlcance`) no se generaliza: solo aplica si se QUITA `vales.supervisar` a un rol y no se puede inferir por el id de un rol nuevo; con el permiso el comportamiento es idéntico.

## Cierre y puesta en producción (2026-11-14)
Resultado: un rol con `vales.supervisar` (cualquier rol, no solo el 3) supervisa, autoriza, recibe notificaciones y se gestiona desde el panel igual que el rol 3. La rama no tiene migraciones ni cambios de esquema.

Rol para supervisores que también solicitan viáticos:
- Permisos del rol 3 + **solo `viaticos.ver`**. Solicitar (crear, modificar, dar de baja, ver las propias y liquidar) exige únicamente `viaticos.ver`; `viaticos.gestionar` muestra las solicitudes de TODOS en «Gestiones» y `viaticos.autorizar` autoriza (corrige la suposición inicial de que `gestionar` era «solicitar»).
- Cada supervisor debe estar dado de alta en Viáticos → Configuración → Personas (países y licencia); sin países el selector queda vacío y no puede crear solicitudes, sea cual sea su rol.

Orden en producción:
1. Correr Q1 a Q4 (abajo) antes de desplegar; si alguna difiere de lo esperado, no mover a nadie.
2. Desplegar; crear el rol con los permisos del rol 3 + `viaticos.ver` (el módulo de Viáticos debe estar desplegado para que ese permiso exista); correr Q5.
3. `UPDATE usuarios SET rol_id = <ID_NUEVO> WHERE id = <uno solo>;` pedirle que cierre sesión (el token conserva el rol viejo hasta renovarse); correr Q6, Q7 y Q8; probar una solicitud real.
4. Si todo cuadra, mover a los demás. Marcha atrás: `UPDATE usuarios SET rol_id = 3 WHERE id = ...` (probada en local, deja todo como estaba).

Resultado real de Q1 a Q4 en producción (2026-11-14): Q1 solo el rol 3; Q2 y Q3 vacías; Q4 con los ids 16, 17, 18 y 19.

```sql
-- Q1: roles con vales.supervisar. ESPERADO: solo el rol 3
SELECT r.id, r.nombre FROM roles r
JOIN rol_permisos rp ON rp.rol_id = r.id
JOIN permisos p ON p.id = rp.permiso_id
WHERE p.codigo = 'vales.supervisar';

-- Q2: usuarios rol 3 activos SIN el permiso. ESPERADO: vacío
SELECT u.id, u.email FROM usuarios u
WHERE u.rol_id = 3 AND u.activo = 1 AND NOT EXISTS (
  SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id
  WHERE rp.rol_id = u.rol_id AND p.codigo = 'vales.supervisar');

-- Q3 (solo ANTES del cambio): cobertura de usuarios que no son rol 3. ESPERADO: vacío
SELECT st.usuario_id, u.email, u.rol_id, st.tienda_id
FROM supervisor_tiendas st JOIN usuarios u ON u.id = st.usuario_id
WHERE u.rol_id <> 3;

-- Q4: estado de los usuarios a mover (guardar el resultado para compararlo con Q6)
SELECT u.id, u.email, u.rol_id, u.activo,
  (SELECT COUNT(*) FROM supervisores s WHERE s.usuario_id = u.id) AS fila_supervisores,
  (SELECT COUNT(*) FROM asesores a WHERE a.usuario_id = u.id) AS fila_asesores,
  (SELECT COUNT(*) FROM supervisor_tiendas st WHERE st.usuario_id = u.id) AS tiendas_cubiertas,
  (SELECT COUNT(*) FROM asesor_supervisores x WHERE x.supervisor_id = u.id) AS supervision_especial
FROM usuarios u WHERE u.email IN ('correo1', 'correo2');

-- Q5: permisos del rol nuevo frente al 3. ESPERADO: solo viaticos.ver
SELECT p.codigo, MAX(rp.rol_id = 3) AS en_rol_3, MAX(rp.rol_id = <ID_NUEVO>) AS en_rol_nuevo
FROM permisos p JOIN rol_permisos rp ON rp.permiso_id = p.id
WHERE rp.rol_id IN (3, <ID_NUEVO>) GROUP BY p.codigo HAVING en_rol_3 <> en_rol_nuevo;

-- Q6: repetir Q4 tras el UPDATE. ESPERADO: igual salvo rol_id

-- Q7 (después del cambio): cobertura de usuarios cuyo rol NO tiene el permiso. ESPERADO: vacío
SELECT st.usuario_id, u.email, u.rol_id FROM supervisor_tiendas st
JOIN usuarios u ON u.id = st.usuario_id WHERE NOT EXISTS (
  SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id
  WHERE rp.rol_id = u.rol_id AND p.codigo = 'vales.supervisar');

-- Q8 (después del cambio): supervisión especial a usuarios sin el permiso. ESPERADO: vacío
SELECT x.asesor_id, x.supervisor_id, u.email FROM asesor_supervisores x
JOIN usuarios u ON u.id = x.supervisor_id WHERE NOT EXISTS (
  SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id
  WHERE rp.rol_id = u.rol_id AND p.codigo = 'vales.supervisar');
```

Límites conocidos: si algún día se QUITA `vales.supervisar` a un rol que no sea el 3, sus usuarios dejan de comportarse como supervisores (la «red de seguridad» del buzón y de reportes solo se aplica al rol 3). El selector de rol de «Nuevo usuario» y el filtro de la lista ahora muestran al final los roles que no están en la jerarquía fija (por ejemplo Piloto). No se probó una solicitud de viáticos enviada de punta a punta ni autorizada con `viaticos.autorizar`.

## Rutas
Delegado (un escritor): T1-T7 (2+ archivos no triviales, lectura que prepara la escritura). T8: delegado a un verificador; la BD local y el servidor (puerto 3000, reinicio automático) los levantó el dueño.

## Pruebas
Sin runner automatizado en el proyecto; RED/GREEN no aplica (excepción registrada). Verificación: comparación de resultados viejos vs nuevos para el rol 3 y prueba funcional en la BD de desarrollo autorizada por el dueño (2026-11-14), verificando `NODE_ENV=development` antes de escribir.

## Evidencia
- Análisis de dependencias (2026-11-14): vales decide por permiso; el acoplamiento está en admin (`adminService.js:86,133,198,337,353`, `tiendaAdminRepository.js:121`, `tiendaPersonal.js:83`, `menuCascada.js:134-139`).
- T1-T7 hechas (2026-11-14), un escritor delegado: 10 archivos modificados + `permisoSupervisarSql.js` nuevo. `node --check` OK en backend y front. Diff revisado por el padre.
- Equivalencia (2026-11-14, BD local con `NODE_ENV=development`, por la conexión de la app; `.env` bloqueado): solo el rol 3 tiene `vales.supervisar`; ningún rol 3 activo sin el permiso; `supervisor_tiendas` sin usuarios de otros roles; «Ver personal» viejo vs nuevo en 27 tiendas: 0 diferencias; candidatos `es_supervisor` vs `rol_id = 3` en 92 usuarios: 0 diferencias.
- T8 por la API HTTP con la cuenta admin de pruebas (rol 42 «Supervisor con viáticos (prueba)» = permisos del rol 3 + `viaticos.ver` y `viaticos.gestionar` en esta prueba; después se ajustó a solo `viaticos.ver`, que es lo que corresponde para solicitar (ver el cierre); usuario 136). Panel: crear el rol con `vales.supervisar` (201), guardar sus permisos (200), asignarlo a las tiendas 1 y 2, listarlo en «Ver personal», quitarlo y reasignarlo; la tienda 2 sigue mostrando a `ventas1` y `gerentesala`; control negativo: un encargado de taller sigue sin asignarse (400).
- T8 vales, `ventas1` (rol 3) vs usuario nuevo, mismo resultado en: permisos efectivos del token, detalle (`ESPERANDO_AUTORIZACION`), marcar visto, autorizar (`CREADO`), rechazar (`RECHAZADO`), crear vale como supervisor, autorizar el propio vale, doble autorización (mismo error) y dar de baja tras autorizar (mismo error). Con la misma cobertura el buzón difiere solo en los vales propios de cada uno (6 de `ventas1`, 1 del nuevo); 97 coinciden.
- Nota de método: autorizar o rechazar exige que ese supervisor marque «Ver» antes (visto por usuario); una primera corrida lo pasó por alto y no era una diferencia del código.
- Datos de prueba que quedan en la BD local: rol 42, usuario 136 (con fila en `asesores` de la tienda 1 y cobertura de las tiendas 1 y 2) y los vales 9433 a 9444 más los de la segunda corrida.
- (Las notificaciones por socket se probaron después, ver abajo.) Pendiente de verificar: el comportamiento en producción depende de las 3 consultas previas (mismos resultados esperados que en local).
- T9-T10 (commit 4660c36): crear/editar usuario y la supervisión especial deciden por el permiso; `actualizarSupervisor` hace INSERT ... ON DUPLICATE KEY (`supervisores.usuario_id` es UNIQUE). Docs de admin y de supervisión por asesor actualizadas.
- T11 (2026-11-14): `supervisor1@trofex.com` (id 18, cubre las tiendas 14 a 27) con el mismo guion ANTES (rol 3) y DESPUÉS de pasarlo por UPDATE al rol 42, usando el asesor `sanjuan@trofex.com` (tienda 14): IGUALES permisos y datos de sesión (sin los campos de rol), detalle de vales, marcar visto, autorizar (`CREADO`), rechazar (`RECHAZADO`), conjunto completo de ids del buzón (22 vs 22), vínculo en «Ver personal», asignarlo a otra tienda desde el panel y quitarlo, editar y limpiar su teléfono desde el panel (200, guarda `55551234` y luego NULL), aparecer como supervisor asignable y recibir supervisión especial de un asesor (asignar, ver el vale nuevo, quitar). Devuelto al rol 3 al final (verificado). Una primera corrida usó un teléfono inválido (más de 8 dígitos) y no contó como prueba.
- T12: navegador (Chrome, 127.0.0.1:3000) con el mismo usuario antes y después del cambio de rol, módulo de vales: 745 elementos con la misma estructura (tag, id, clases y atributos data-) y 168 líneas de texto; única diferencia: el nombre del rol en la cabecera («Supervisor de Ventas» frente al nombre del rol nuevo). Capturas visualmente iguales.
- CORRECCIÓN (2026-11-14): `/api/auth/me` NO existe (la sesión real es `GET /api/auth/session`), así que las líneas «permisos efectivos» y «datos de sesión» de las pruebas de T8 y T11 compararon respuestas vacías y no valen como evidencia. Se rehicieron con el endpoint correcto: rol 3 = 8 permisos y módulos vales y prompts; rol nuevo = esos 8 más `viaticos.ver` y `viaticos.gestionar` y el módulo viaticos; ninguna otra diferencia. El resto de las comparaciones de T8 y T11 usaban rutas reales (estados y códigos de vales, ids del buzón, panel) y siguen en pie.
- Notificaciones (2026-11-14): `supervisor1` en el rol nuevo con una tienda extra (tienda 1, con `ventas1` rol 3 y el usuario de prueba rol nuevo; cobertura 14 a 27 más la 1, asignada desde el panel). Socket (`vale_evento`): `supervisor1` recibió la creación y la autorización de un vale que autorizó él y de otro que autorizó `ventas1`. Guardadas (`notificaciones`): el vale autorizado por el rol nuevo y el autorizado por el rol 3 generaron 12 notificaciones cada uno con los mismos destinatarios y textos; el actor no recibe su propia notificación de autorización en ninguno de los dos casos. `supervisor1` restaurado al rol 3 y a sus tiendas 14 a 27.
- Pantallas del panel admin en navegador (2026-11-14, Chrome, admin de pruebas local): (1) «Nuevo usuario»: modal con el rol de prueba y con «Supervisor de Ventas», 35 elementos con la misma estructura y el mismo texto salvo el nombre del rol; el campo de teléfono aparece en ambos. (2) «Roles y Permisos» → Permisos: 72 elementos con la misma estructura; `vales.supervisar` marcado y habilitado en el rol de prueba; solo difieren los 2 permisos de viáticos. (3) «Gestionar personal» de la tienda 1: el rol de prueba aparece como grupo propio con su vínculo de supervisor; `ventas1` (rol 3) y el usuario de prueba se ven dos veces cada uno por tener fila de asesor y cobertura en la misma tienda (mismo patrón en ambos roles).
- Efecto visible a tener en cuenta: el selector de rol de «Nuevo usuario» y el filtro de la lista ahora muestran los roles que no están en la jerarquía fija (por ejemplo Piloto y los roles nuevos), al final de la lista.
- Consultas de verificación para producción validadas contra la BD local (Q1 a Q8); en local Q1 y Q3 muestran el rol y el usuario de prueba, como se espera.
- Q4 de producción (2026-11-14, pegado por el dueño): ids 16, 17, 18 y 19, todos rol 3 y activos, con fila en `supervisores` y sin fila en `asesores`; tiendas cubiertas 10, 10, 14 y 14; supervisión especial: 1, 1, 0 y 0 (los ids 16 y 17 tienen una asignación). Q1 devolvió solo al rol 3; Q2 y Q3 vacías.
- Supervisión especial YA existente que sobrevive al cambio de rol (local, `supervisor1` con una asignación previa sobre `sanjuan@trofex.com`, rol 3 y luego rol 42): IGUALES la lista de asignados, quién autoriza hoy, ver el vale, autorizarlo (`CREADO`) y verlo en el buzón. Limitación: el control del «otro supervisor» no es concluyente porque el supervisor 19 no cubre la tienda 14 en local (dio 403 en ambas fases). Restaurado al rol 3 y sin asignación.
- Nota de método: dejé un primer socket abierto por un intento fallido, por eso cada evento llegó duplicado a mi escucha; no es del servidor.
- Fuera de esta prueba: el panel admin no se abrió en el navegador con el rol nuevo (supervisor1 no tiene `admin.ver`); su flujo se probó por la API. Con `viaticos.ver` el rol nuevo debería ver además el módulo de Viáticos cuando esté desplegado (la sesión del rol nuevo ya incluye el módulo `viaticos` en `modulosPermitidos`; la pantalla del módulo no se probó porque `dev` aún no lo tiene).
