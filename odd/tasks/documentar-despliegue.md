# Documentar el despliegue

## Objetivo
Dejar en el repositorio un runbook único de cómo se despliega hoy (flujo, comandos, riesgos, configuración), para que el compañero del dueño y su agente de IA lo sigan sin depender de nadie.

## Decisiones
- Un solo documento completo: `.agents/reglas/reglas_despliegue.md`; el resto son punteros cortos.
- Solo documentación: ningún cambio de código, scripts ni base de datos.
- `CLAUDE.md` gana el bloque 7.1 Deployments y se mantiene en torno a 7,6 KB.
- Las reglas para agentes (no ejecutar refresco, marca, respaldo, migraciones ni SQL contra producción; solo PR) quedan explícitas en el runbook.

## Tareas
- [x] T1 Runbook `reglas_despliegue.md` (d37b6cc)
- [x] T2 Bloque en `CLAUDE.md`, sección en `README.md`, punteros en las cuatro reglas relacionadas y este plan

## Comprobaciones
- Todas las rutas citadas en el runbook existen en disco.
- Todos los `npm run` citados existen en `package.json`.
- Las variables citadas aparecen en `src/config/env.js`.
- Sin saltos de línea LF sueltos en archivos CRLF; tamaño de `CLAUDE.md` medido.
- Sin referencias a la carpeta antigua salvo la advertencia explícita.

## Progreso
- T1: d37b6cc
- T2: ver commit de documentación
