# buzon-atrasados-en-tabla

Rama: `fix/ordenamiento-aparicion-vales` · Estrategia de entrega: `ask-on-risk` · Estado: hecho, pendiente de PR.

## Objetivo
Con un filtro de fecha en el Buzón, los atrasados con atraso **vigente** y entrega **anterior al inicio del período** salen **en la misma tabla**, en una sección «Atrasados anteriores al período» (del más al menos atrasado) sobre la sección «Vales del período» (jerarquía del rol), con filas iguales. Es clave para que los encargados de taller vean lo que no han trabajado.

## Decisiones acordadas con el usuario (2026-10-16)
- Opción 1 (decidida tras ver la 2): dos secciones en la tabla del Buzón, sin bloque aparte. La opción 2 (todos los atrasados juntos y debajo «Al día») se descartó: se evaluó con el administrador, que mezcla pendientes y terminados.
- Aplica a todas las vistas de Buzón (administrador, asesor, supervisor, encargado, diseñador). «Trabajo realizado» no cambia: son vales ya terminados.
- El bloque de «Atrasados vigentes» de **Reportes** no se toca.

## Diseño
- `dentroDeVentana` (`valeHelpers.js`) acepta `ventana.incluirAtrasados`: con él, un vale atrasado y no terminal con entrega **anterior al inicio** de la ventana cuenta como dentro de ella (los posteriores no). Todos los buzones por rol ya pasan por ahí, así que los contadores, el orden por grupos, los filtros de contador y la paginación quedan coherentes sin tocar cada rol.
- `obtenerBuzon` activa la bandera solo en la vista `buzon` y retira el cálculo y la respuesta de `atrasadosVigentes`.
- Frontend: se quita el bloque del Buzón (`renderVigentes`, `#atrasados-vigentes`, `state.atrasadosVigentes`); el componente compartido sigue sirviendo a Reportes.

## Tareas
- [x] T1 · Backend: bandera `incluirAtrasados` en `dentroDeVentana` y retiro del bloque aparte en `obtenerBuzon`. Ruta: inline (2 archivos acotados y ya entendidos). Commit b44de8a.
- [x] T2 · Frontend: quitar el bloque del Buzón. Ruta: inline. Commit ef4956f.
- [x] T3 · Documentación (`flujo_vale_de_arte.md`, `correcciones_53.md`) y verificación en navegador con los datos de prueba. Commit: ver «Progreso». `CLAUDE.md` no menciona el bloque: sin cambio.

## Reglas de trabajo
- El servidor lo levanta siempre el usuario (puerto 3000); las pruebas van contra ese servidor.
- Comentarios de código lo más cortos posible. Commits en español, Conventional Commits, sin atribución de IA.
- Test-first: no hay suite de pruebas configurada; excepción documentada. Verificación con la API y el navegador.
- Al reportar pruebas, solo resultados, no los datos locales modificados.

## Progreso y evidencia
- Mapeo: todos los buzones por rol filtran con `dentroDeVentana`; el bloque aparte vivía en `obtenerBuzon` (`vigentesFuera`).
- T1: verificado por API contra :3000 con 4 roles (encargado de Diseño, encargado UV/3D, supervisor, asesor): con un día, la tabla trae todos sus atrasados abiertos (el mismo número que con «Todo») y la respuesta ya no trae `atrasadosVigentes`. Administrador, día 10/10: 49 filas (13 del día + 36 atrasados abiertos). «Trabajo realizado» sin cambios (13). El contador «Atrasados» del administrador pasó de 65 a 48 con filtro de fecha porque ya no cuenta los terminados con atraso final fuera del período; en «Todo» sigue en 65.
- T2/T3: verificado en el navegador (administrador, `127.0.0.1:3000`, día 10/10): 49 filas, arrancan con los atrasados de septiembre y octubre y terminan con los del 10/10; sin bloque aparte; contadores 49 / 11 / 0 / 48. No verificado en el navegador: roles de taller, asesor y supervisor (solo por API), vista celular.
- Corrección (2026-10-16): la primera versión incluía también los atrasados con entrega POSTERIOR al período; el usuario lo detectó. Ahora solo entran los anteriores al inicio (rango con `desde`, o antes del primer día del mes). Verificado por API como administrador: día 10/10 = 45 filas (del 17/09 al 10/10), mes de octubre = 69, rango 5–10/10 = 47; ningún atrasado posterior al fin del período.
- Rediseño (2026-10-16): el usuario descartó la opción 2. Atraso vigente = atrasado, sin `atraso_congelado_en` y no terminal (un vale que el taller ya aprobó y espera confirmación tiene el atraso congelado, p. ej. MTC-RR-138: entrega 26/09, congelado el 02/10 con 6 días). Entre atrasados el orden ahora es por días de atraso desc. Verificado como encargado de Diseño en el navegador (día 10/10: 4 anteriores + 5 del período) y por API con encargado UV/3D, supervisor y asesor; «Trabajo realizado» sin secciones. La vista del administrador mezcla pendientes y terminados y no es representativa.
