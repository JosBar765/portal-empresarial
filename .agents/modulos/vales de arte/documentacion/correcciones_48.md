# Correcciones 48 — El Asistente de taller opera como su encargado

Rama: `fix/asistente-taller` (desde `dev`). Sin cambios de base de datos ni de lógica de negocio.

## Diagnóstico

El Asistente (rol 7) no es dueño de un taller: opera **el taller al que está asignado** en `taller_disenadores` (el servidor lo resuelve en `valeCatalogoService.idEncargadoEfectivo`). Con esa asignación, buzón, trabajo realizado, diseñadores a cargo, asignar, revisar, verificar adjuntos, fusión, reportes y notificaciones funcionan **igual que el encargado** (comprobado: mismos 10 vales, mismos contadores, 7 diseñadores, y asignar un vale responde 200). Los permisos del rol 7 son los mismos que los del rol 4.

**Causa de que «no pueda hacer lo mismo»:** el asistente existente (`asistente@grupopremia.com`) **no tiene ninguna fila en `taller_disenadores`** (ni local ni en `database/users.sql`). Sin taller asignado el servidor lo trata como encargado de nada: buzón vacío salvo la cola de fusión, 0 diseñadores y «Tu usuario no tiene un taller asignado» al actuar.

**Solución de datos (no de código):** asignarlo en el panel de administración → *Gestionar Taller* → personal del taller → agregar al Asistente (solo se permite en Diseño, Diseño UV/3D y Protextil). Un asistente trabaja para **un** solo taller.

## Corrección de código

La interfaz resolvía «mi taller» del Asistente con un taller fijo («Diseño»), así que un asistente de UV/3D o Protextil se habría unido a las salas de tiempo real equivocadas. Ahora el servidor manda `miTallerId` en el catálogo (solo para el Asistente, desde su asignación real) y `miTaller()` lo usa; sin asignación no hay taller.

Archivos: `src/modules/vales/services/valeCatalogoService.js`, `public/modules/vales/js/permisos.js`.
