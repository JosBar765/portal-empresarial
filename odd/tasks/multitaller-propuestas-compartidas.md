# multitaller-propuestas-compartidas

Rama: `fix/multitaller` (desde `dev`) · Estrategia de entrega: `ask-on-risk` · Estado: hecho, pendiente de PR.

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
- [x] T4 · Frontend: sección «Propuestas de otros talleres» en el detalle del vale y signo rojo «?» con tooltip en el buzón; marcar «visto» al abrir. Ruta: delegada. Commit 5129596.
- [x] T5 · Documentación (sección 14 de `flujo_vale_de_arte.md`, `CLAUDE.md`, notas de producción) y verificación de punta a punta. Ruta: delegada. Commit: ver «Commits de la rama».

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
- T4: `node --check` OK en los 4 JS tocados; lectura de datos/XSS (todo por `escapeHtml`, nota y enlaces por `propuestaInfo`) revisada. Comportamiento en navegador NO verificado (pendiente en T5). Decisión: no existe un «detalle» para roles de taller (el ojo abre el visor), así que la sección es un modal nuevo abierto desde una acción «Propuestas de otros talleres» (vales con varios talleres o aviso pendiente) y desde el propio «?».
- Correcciones tras navegador: el tooltip del «?» pasa a un único `div.pn-tip` en `<body>` con `position: fixed` (evita el stacking del `td` sticky y el recorte por overflow), posicionado por JS (debajo o encima, recortado al viewport; cubre móvil y «Atrasados antes del período»). Sin cambio de backend para la marca vieja tras desaprobar: ninguna ruta saca una fila de APROBADO (desaprobar solo parte de EN_REVISION, que los hermanos nunca vieron como aprobada). `node --check` OK y función de posición probada con node; re-verificación en navegador pendiente. Commit: 9acc005.

- Corrección final (dad15c5): la acción «Propuestas de otros talleres» usaba solo «el vale tiene varios talleres», así que un usuario de Diseño Local veía el icono y un modal vacío. El buzón (`vales[]` y `atrasadosVigentes.vales[]`) ahora trae `propuestasOtrosAplica`, calculado por lote (una consulta, sin N+1) con la misma regla del servicio de propuestas compartidas. Script desechable sobre `obtenerBuzon`, 9 comprobaciones OK: encargado, diseñador y encargado de Protextil sobre vale Diseño+Protextil = true; asesor = false; vale de un solo taller = false; Diseño Local sobre Diseño+Diseño Local = false (y en Diseño+Local+UV/3D sigue false, mientras Diseño = true); vale `MOD-` consistente (calculado con sus propias filas). Datos de prueba eliminados. `node --check` OK en los 4 JS. El servidor lo reinicia el usuario para cargar el cambio; navegador no verificado tras esta corrección.

## Resumen de verificación (T5)
Pruebas A–I en navegador el 2026-10-16 por verificadores, contra el servidor del usuario:
- Aprobación por la interfaz del encargado; aviso una sola vez por persona (encargado, asistente y diseñador asignado).
- Signo «?» en tiempo real; «visto» por usuario; con `comparte_propuestas = 0` no aparece nada; Diseño Local no ve nada; vale de un taller no muestra nada.
- Desaprobar y volver a aprobar vuelve a mostrar el signo.
- Tooltip corregido (posición fija en `body`, recortado al viewport en celular, Escape lo cierra).
- Ancho de celular con iframe de 390 px: modal, visor y tarjetas correctos; área táctil de 44 px mediante `::after`.
- Nota y enlaces a salvo de XSS; caso de propuesta sin URL correcto; sin errores en la consola; rol diseñador correcto.

**No verificado:** eventos táctiles reales, visor de PDF en un celular real, taller hermano Protextil en navegador, vale `MOD-`, consola del Administrador, captura en vivo del aviso emergente para diseñadores, y el comportamiento en navegador tras la corrección dad15c5.

## Notas para producción
1. Importar `database/09_comparte_propuestas.sql` **antes** de desplegar el código (idempotente).
2. El script asigna 1 por **nombre exacto** ('Diseño', 'Diseño UV/3D', 'Protextil'). Revisar antes los nombres en producción: si no coinciden, la marca queda en 0 y la función queda apagada sin error. El UPDATE solo corre al crear la columna; para repetirlo a mano: `UPDATE talleres SET comparte_propuestas = 1 WHERE nombre IN ('Diseño', 'Diseño UV/3D', 'Protextil');` y comprobar con `SELECT id, nombre, comparte_propuestas FROM talleres;`.
3. Reiniciar el servidor tras desplegar (cambios de backend).
4. No hay migración de datos para el «visto».
5. El «?» es retroactivo en vales cuyo hermano aprobó antes de la función; se aceptó porque en producción hay un solo vale en proceso y nadie ha entregado propuesta.
6. Restricción solo de interfaz: el detalle sigue devolviendo todas las propuestas (decisión del usuario); las URL de Supabase son públicas.

## Commits de la rama (`e61d502..HEAD`)
8179c8a (T1), 8242da1 (T2), 0b60266 (T3), c75c2ec, 5129596 (T4), 6abf17d, 9acc005, e49ea73, 34f5f12, 185fbc4, dad15c5 (corrección final) y el commit de documentación de T5 (último de la rama).

## Siguiente paso
Abrir el PR hacia dev (decisión del usuario) y ejecutar el script 09 en producción a mano.
