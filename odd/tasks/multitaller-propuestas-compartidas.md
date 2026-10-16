# multitaller-propuestas-compartidas

Rama: `fix/multitaller` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: plan creado, sin implementar.

## Objetivo
En un vale multitaller, que los talleres puedan **ver las propuestas aprobadas de los otros talleres** y reciban un **aviso** cuando otro taller termina, sin bloquear nada (cada taller avanza por su cuenta).

## Alcance
Talleres Diseño, Diseño 3D (UV/3D) y Protextil. **Diseño Local queda fuera.** Sin hardcodear nombres de taller en la lógica.

## Decisiones acordadas con el usuario (2026-10-16)
- **Regla:** columna `talleres.comparte_propuestas` (0/1, simétrica: un taller ve a otro solo si **ambos** la tienen en 1). Valores iniciales: Diseño, Diseño 3D y Protextil = 1; Diseño Local = 0.
- **Sin bloqueo** entre talleres.
- **Cuándo avisa:** solo cuando el **encargado aprueba** la propuesta de un taller. Entregar y desaprobar no avisan.
- **Quién recibe aviso y signo rojo** (en el/los talleres hermanos): encargado, asistentes y diseñador **asignado**. Los demás diseñadores del taller no.
- **Quién ve la sección de propuestas de otros talleres:** encargado, diseñadores y asistentes del taller hermano.
- **Qué se ve:** PDF + nota + enlaces, solo lectura, la última propuesta **aprobada** de cada taller hermano. Si el hermano aún no aprobó: etiqueta «En trabajo», sin archivo.
- **Aviso:** `valeEvents.notificar`, que ya queda en el centro de notificaciones.
- **Signo rojo «?»** sobre el vale en el buzón con tooltip; desaparece **por usuario al abrir la propuesta** del otro taller (tabla nueva de «visto»).
- **Descartado por el usuario:** endurecer el backend (`obtenerDetalle` y `GET /:id/propuesta` seguirán devolviendo propuestas de todos los talleres). Los datos no son sensibles. No hacerlo.

## Edge cases a cubrir
Desaprobar y reasignar (el hermano vuelve a «En trabajo»); reasignación a otro diseñador; vale de un solo taller o con Diseño Local (sin sección ni signo); taller quitado del vale (`activo=0`); vale `MOD-` (solo los hermanos del `MOD-`); flag cambiado con vales en vuelo (se evalúa al leer); autoaprobación del encargado (el hermano ve «Aprobada» de inmediato); una sola notificación por persona.

## Tareas
- [x] T1 · BD: script idempotente `database/09_comparte_propuestas.sql` (columna `talleres.comparte_propuestas` + tabla de «visto» por usuario/vale/taller de origen), valores iniciales, y espejo en `schema.sql`/`seed.sql` según `.agents/reglas/reglas_archivosSQL.md`. Ruta: delegada (escritor único). Commit 8179c8a.
- [x] T2 · Backend lectura: propuestas de talleres hermanos en el detalle del vale (respetando el flag y los estados) y endpoint para marcar «visto». Ruta: delegada. Commit 8242da1.
- [x] T3 · Backend aviso: al aprobar, `notificar` a encargado, asistentes y diseñador asignado de los hermanos con flag; indicador «propuesta nueva sin ver» por usuario en el buzón. Ruta: delegada. Commit 0b60266.
- [ ] T4 · Frontend: sección «Propuestas de otros talleres» en el detalle del vale y signo rojo «?» con tooltip en el buzón; marcar «visto» al abrir. Ruta: delegada.
- [ ] T5 · Documentación (`flujo_vale_de_arte.md`, `CLAUDE.md` si aplica, nota de producción con el script) y verificación de punta a punta en el servidor que levanta el usuario. Ruta: inline / delegada.

## Reglas de trabajo
- El servidor lo levanta siempre el usuario; las pruebas van contra ese servidor, sin crear procesos propios.
- Comentarios de código lo más cortos posible. Commits en español, Conventional Commits, sin atribución de IA.
- Cada tarea cierra con al menos un commit en `fix/multitaller` y su hash se anota aquí.
- Test-first: no hay suite de pruebas configurada; excepción documentada. Verificación con scripts contra la BD de desarrollo, eslint y navegador.
- Al reportar pruebas, solo resultados, no los datos locales modificados.

## Progreso y evidencia
- T1: script aplicado dos veces a la BD de desarrollo sin error (idempotente); Diseño, Diseño UV/3D y Protextil quedan en 1 y los Diseño Local en 0. Decisión: no se espejó en `schema.sql`/`seed.sql` (el repositorio no refleja allí los scripts 01–08; los cambios a producción van solo por script). La marca de «visto» guarda `propuesta_id`: una re-aprobación con otra propuesta vuelve a contar como no vista.
- T2: script desechable contra la BD de desarrollo, 22 comprobaciones OK (hermano aprobado/en trabajo, flag 0 oculta en ambos sentidos, vale de un taller, asesor/admin/gerente vacío, taller `activo=0`, «visto» idempotente y por usuario, re-aprobación vuelve a no visto). El endpoint HTTP no se probó (solo carga de rutas). No hay eslint configurado en el repositorio.
- T3: script desechable, 19 comprobaciones OK (aviso único a encargado, asistentes y diseñador asignado del hermano; no al actor, ni a otros diseñadores, ni a Diseño Local; flag 0 sin aviso; autoaprobación una por persona; indicador del buzón true/false según «visto», con desaprobar y re-aprobar).
- Contrato para T4: `propuestasOtrosTalleres` en el detalle; `POST /api/vales/:id/propuestas-otros/:tallerId/visto`; campo `propuestaOtroTallerNueva` en cada vale del buzón.

## Siguiente paso
T4 frontend.
