# Diseño Local entre países

Rama: `feature/diseno-local-entre-paises` (desde `dev`). Estado: mergeado a dev dentro del PR #175 (la rama se borró del origin; sus commits viajan en `feature/fecha-entrega-dias-habiles`). Engram: `odd/diseno-local-entre-paises/tasks`.

## Decisión del dueño (2026-11-13)
- Los asesores de Centroamérica (excepto Guatemala) pueden enviar vales a cualquier taller de Diseño Local de los demás países de Centroamérica (p. ej. SSV → LEO, MAN). Se excluye Guatemala en ambos sentidos: sus asesores no usan Locales de otros países y el Local de Guatemala (P13) no se ofrece a los demás.
- Los talleres generales de Munditrofeos siguen disponibles para todos.
- Combinación en un vale: generales entre sí, o Locales entre sí SOLO del mismo país; nunca general con Local, nunca Locales de países distintos (entre países todavía no se comparten vales).
- Sin hardcodear: un dato por país en la BD, configurable desde el admin (`paises.comparte_diseno_local`: 1 en los países cuyos asesores pueden usar los Locales de otros países que también lo tengan en 1 y cuyos Locales se ofrecen a ellos; 0 en Guatemala).
- Orden del combobox de talleres: generales; Locales del país del asesor; demás Locales agrupados por país.
- El bypass del filtro de tienda para supervisión especial queda en el Buzón (incluye Trabajo realizado).

## Tareas
- [x] D1 Migración `35_pais_comparte_diseno_local.sql` (columna `paises.comparte_diseno_local`, 1 en El Salvador, Honduras, Nicaragua, Costa Rica; 0 en Guatemala; sin ids fijos).
- [x] D2 Elegibilidad y reglas de combinación (backend): Local elegible si atiende la tienda del asesor O (país del asesor con la bandera Y país del Local con la bandera); Locales de un mismo vale del mismo país.
- [x] D3 (sin probar en navegador) Combobox agrupado y ordenado (frontend vales).
- [x] D4 (sección en «Horarios y feriados») Admin: dónde editar la bandera por país.
- [x] D5 Pruebas (copia PROD) y documentación.
- [x] D6 (sin probar en navegador) (pedido adicional del dueño, 2026-11-13) En el formulario de vales, el selector del código de país del teléfono se preselecciona con el país del asesor/supervisor que crea el vale (por su tienda); el usuario puede cambiarlo.
