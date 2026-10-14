# Merge de `feature/reportes-gerencia` en `dev` (resolución de conflictos y verificación)

Rama: `merge/reportes-gerencia-en-dev` (desde `origin/dev`). La rama original `feature/reportes-gerencia` NO se toca. NO se sube a PROD hasta que el dueño lo indique.

## Contexto
`feature/reportes-gerencia` partió de `dev` en el PR #66 y quedó atrasada (dev sumó asistentes por taller, horarios laborales, nombres de archivo en Supabase, etc.). GitHub no permite mergearla: 13 archivos en conflicto (11 de contenido + 2 modificados en dev y borrados en la rama).

## Decisiones del dueño
- Rendimiento, Encontrar vale y el botón «Ver propuesta» de las filas DEBEN desaparecer (como hace la rama): se aceptan los borrados.
- Regla: no suponer nada; preguntar lo que no se entienda.

## Puntos delicados detectados antes de resolver
1. `valeBuzonService.obtenerBuzon` fue reestructurado por la rama (`_resolverPorRol`); dev le había agregado `await prepararPipeline()` (horarios). Si se pierde, el pipeline con horarios deja de funcionar.
2. Código nuevo de la rama que decide por `usuario.rolId` sin contar asistentes (soportados por dev desde el PR #81): `capacidadEntregaService.obtenerCalendarioBuzon` y etiquetas en `valeReporteGruposService`.
3. Regiones que Git unió solo (ambos lados tocaron el archivo sin chocar): pueden esconder fallos de lógica.
4. Numeración de documento: la rama usa `correcciones_53.md`.

## Plan de verificación
- [ ] V1 Sin marcadores de conflicto; `node --check` en todo JS tocado; carga de todos los módulos de backend.
- [ ] V2 Comprobación automática de que ninguna línea agregada por dev desde la base se pierde (salvo los borrados aceptados).
- [ ] V3 Revisión de las zonas unidas automáticamente por Git (lectura dirigida) y de los puntos delicados.
- [ ] V4 Pruebas por API con cada rol (Asesor, Supervisor, Encargado, Asistente, Diseñador, Gerente, Administrador): buzón, calendario del buzón, reportes (actividad/rendimiento/PDF), propuestas con nota y enlaces, fusión, horarios y fechas de entrega, asignación a asistentes, notificaciones.
- [ ] V5 Pruebas en navegador (Chrome) por rol: sidebar, buzón, reportes, visor emergente.
- [ ] V6 Informe honesto de lo probado y lo no probado.

## Progreso / evidencia
(pendiente)
