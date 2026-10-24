# Reportes: una tabla de vales por sección y estados

## Objetivo
Leer los vales de la pestaña «Reportes» sin abrir desplegables por persona, y tener estados vacío, cargando y error cuidados. Solo cambia la tabla y los estados; el resto de la pestaña queda como está.

## Decisiones
- Diseño aprobado en Figma antes de programar (regla nueva: todo cambio de diseño parte de un mockup).
- Una tabla por sección (atrasados, no entregados, entregados); la persona/taller/tienda pasa a ser una columna. Sin «Expandir todo / Contraer todo».
- Se conservan las columnas, el indicador de pasos, los badges de atraso y las secciones plegables de hoy.
- Celular: tarjeta compacta por vale.
- Vacío con «Ver el mes completo»; cargando con esqueleto; error con mensaje amable ante fallos de red.
- Sin cambios en servidor, base de datos ni PDF.

## Tareas
- [x] T1 mockup en Figma y aprobación
- [x] T2 tabla plana por sección (escritorio y celular)
- [x] T3 estados vacío, cargando y error
- [x] T4 documentación (`correcciones_56`, flujo de Vales, regla de mockup en `reglas_disenoUI` y `CLAUDE.md`)

## Comprobaciones
- [x] Gerente: Mes y Semana, agrupado por Taller; Encargado: Semana, columna «Fecha de ingreso».
- [x] «Ver el mes completo» desde el vacío de «Hoy».
- [x] Esqueleto y cuadro de error con la petición retenida y rechazada.
- [x] Tarjetas en 390 px; «Ver vale» abre el visor.
- [x] `npm run ci:sintaxis`.
- [ ] Pendiente: revisión visual del dueño en el sistema.

## Cuidados
- La rama `feat/rendimiento-admin-gerente` (sin fusionar) toca `reportes.js`; al fusionar la segunda habrá que resolver conflictos en `renderGrupos`.
