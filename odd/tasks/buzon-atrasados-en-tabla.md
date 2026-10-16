# buzon-atrasados-en-tabla

Rama: `fix/ordenamiento-aparicion-vales` · Estrategia de entrega: `ask-on-risk` · Estado: en curso (rediseño del 2026-10-16).

## Objetivo
En el Buzón, con cualquier filtro de fecha (día, «Hoy», mes o rango), cada usuario ve los vales que **viene arrastrando** (siguen pendientes en su buzón y su entrega es anterior al inicio del período) **además** de los que le toca hacer en el período. Aplica a todos los roles (encargados y asistentes, diseñadores, asesores, supervisores, administrador y gerente). Es clave para que los encargados vean lo que no han trabajado.

## Decisiones acordadas con el usuario (2026-10-16)
- Sin títulos de sección: la tabla es una sola lista.
- **Arrastrado** = vale que sigue pendiente en el buzón del usuario con entrega anterior al inicio del período, aunque su atraso esté congelado (p. ej. un vale «Por confirmar» del asesor). No depende de que esté atrasado.
- **Orden (decisión final):** una sola regla, días de atraso de mayor a menor, sin agrupar por estado (los filtros de estado son las tarjetas); sin atraso, por fecha de entrega. Con orden por columna manda el orden del usuario. Se descartó dejar los arrastrados primero y debajo la jerarquía del rol: seguía rompiéndose. Arrastrado = anterior al inicio del período (el usuario confirmó que "sin importar la ventana" fue un error).
- «Trabajo realizado» no muestra arrastrados (es un registro de lo hecho).
- Los asistentes tienen la misma vista que su encargado.
- **Administrador y Gerente** (misma vista general de solo lectura): se separan en Buzón y Trabajo realizado. Trabajo realizado = vales cerrados (`RECIBIDO`/`CONFIRMADO`), como la vista del asesor pero de todos; Buzón = todo lo que sigue en curso.
- El panel de «Atrasados vigentes» de **Reportes** no se toca.
- Cada vista se revisa con el usuario, rol por rol.

## Diseño
- `dentroDeVentana` (`valeHelpers.js`) acepta `ventana.incluirArrastrados`: un vale con entrega anterior al inicio de la ventana cuenta como dentro de ella. Solo se activa en la vista Buzón. Los buzones por rol ya filtran lo pendiente antes, así que contadores, filtros de contador y paginación quedan coherentes.
- `obtenerBuzon` (sin orden por columna) ordena todo por días de atraso desc y, sin atraso, por fecha de entrega.
- Administrador/Gerente: `_buzonAdministrador` excluye los cerrados; `_trabajoGeneral` lista los cerrados con los contadores del asesor (`recibidosHoy`, `totalRecibidos`).
- Frontend: sin encabezados de sección; el sidebar muestra «Trabajo realizado» al administrador y al gerente, con sus contadores.

## Tareas
- [x] T1 · Backend: bandera de ventana y retiro del bloque aparte en `obtenerBuzon` (primera versión, solo atrasados vigentes). Commit b44de8a.
- [x] T2 · Frontend: quitar el bloque del Buzón. Commit ef4956f.
- [x] T3 · Docs de la primera versión. Commit 5fd006b.
- [x] T3b · Correcciones: solo anteriores al período (34460c9), dos secciones con título y orden por días de atraso (0083f3b). Superadas por T4–T5.
- [x] T4 · Backend: arrastrados = pendientes con entrega anterior al período, orden y sin secciones. Ruta: inline. Verificado por API con encargado de Diseño, UV/3D, supervisor y asesor (arrastrados primero, 0 saltos de orden; supervisor y asesor incluyen los «Por confirmar» con atraso congelado). Commit: ver «Progreso».
- [x] T5 · Frontend: quitar encabezados y estilos de sección. Ruta: inline. Commit: ver «Progreso».
- [x] T6 · Backend: administrador y gerente separados en Buzón y Trabajo realizado. Ruta: inline. Verificado por API: Buzón 94 + Trabajo realizado 159 = 253 vales (el total), solo `RECIBIDO` en Trabajo realizado.
- [x] T7 · Frontend: sidebar y contadores de Trabajo realizado para administrador y gerente. Ruta: inline.
- [x] T4b · Orden único por días de atraso, sin jerarquía por estado (verificado por API en 6 roles, 0 saltos en día, mes y «Todo»).
- [x] T4c · Contador «En revisión» en el Buzón del diseñador (pedido tras revisar su vista; las demás tarjetas siguen contando lo del filtro de fecha, el usuario lo aceptó).
- [x] T4d · «Atrasados» se recalcula al combinarlo con otra tarjeta (decisión del usuario, opción A: solo el número recalculado). Verificado por API con el encargado de Diseño: «Por asignar» 0, «Asignado» 10, «Por revisar» 3, siempre igual a los atrasados de la lista.
- [ ] T8 · Documentación y revisión de cada vista con el usuario, rol por rol.

## Reglas de trabajo
- El servidor lo levanta siempre el usuario (puerto 3000); las pruebas van contra ese servidor.
- Probar siempre con roles de trabajo reales (no inferir del administrador) y verificar quién está logueado en la pestaña.
- Comentarios de código lo más cortos posible. Commits en español, Conventional Commits, sin atribución de IA.
- Test-first: no hay suite de pruebas configurada; excepción documentada. Verificación con la API y el navegador.
- Al reportar pruebas, solo resultados, no los datos locales modificados.

## Progreso y evidencia
- El atraso congelado es por diseño: MTC-RR-138 (entrega 26/09, taller aprobó, por confirmar del asesor) quedó congelado el 02/10 con 6 días.
- El calendario del encargado cuenta 13 vales con entrega el 10/10 pero su buzón muestra 5: 8 ya los aprobó su taller. Discrepancia previa, no se toca.
