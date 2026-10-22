# Reorganizar la documentación del monolito modular

Rama: `docs/reorganizar-arquitectura` (desde dev 02733b6). Sin push.

## Objetivo
`CLAUDE.md` pasa a ser solo la Guía Maestra del monolito modular; todo lo específico de un módulo se reubica en `.agents/modulos/<módulo>/` (README general del módulo + detalle técnico en `documentacion/`). Los agentes de IA y las personas deben poder ubicar cada dato sin ambigüedad.

## Decisiones (del usuario)
- `CLAUDE.md` contiene solo: reglas globales (desarrollo, convenciones Express/Vanilla JS, nomenclatura), arquitectura de módulos, guía paso a paso para crear un módulo y la nota de migraciones.
- La carpeta de scripts de base de datos se llama `migrations` (antes `migraciones`): `database/migrations/`. Se renombra la carpeta para que la directiva sea verdadera.
- Información general del módulo: `README.md` en `.agents/modulos/<módulo>/`. Detalle técnico profundo: `.agents/modulos/<módulo>/documentacion/`.
- Las carpetas existentes (`vales de arte`, `admin`) no se renombran.
- Commit final con el mensaje: `docs: reestructuracion de documentacion para arquitectura modular y limpieza de CLAUDE.md`.

## Tareas
- [x] T1 Renombrar `database/migraciones` a `database/migrations` y actualizar referencias vigentes.
- [x] T2 Reescribir `CLAUDE.md` como Guía Maestra.
- [x] T3 Reubicar el contenido específico de módulo (sin perder información) y crear los README de módulo.
- [x] T4 Verificar enlaces y rutas, resumen de archivos y commit.

## Checks
Documentación solamente: cada ruta citada existe, ningún dato de `CLAUDE.md` se pierde (cada uno aparece en su destino), sin referencias vigentes a `database/migraciones`.

## Progreso
T1 hecho: commit 732fa82 (chore(database): renombrar migraciones a migrations).
T2-T4 hechos en el commit de docs que sigue a 732fa82 (ver git log): CLAUDE.md como guía maestra, README.md de vales de arte y admin, documentacion/crear_vale_de_arte.md, README raíz y reglas corregidos. Rutas verificadas con script; sin referencias vigentes a database/migraciones.
