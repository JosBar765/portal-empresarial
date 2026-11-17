# Otros gastos: la descripción solo se pide cuando el tipo es «Otros»

Rama: `module/viaticos`. Estado: hecho y probado (2026-11-16). Estrategia de entrega: `ask-on-risk`.

## Objetivo
En la sección «Otros gastos» de la solicitud de viáticos, el campo «Descripción» aparece, se pide y se valida SOLO cuando el tipo de gasto elegido es «Otros» (`esOtros`). Para peajes, parqueos y demás tipos no se muestra ni se exige.

## Problema
- El contrato NO documentaba esta regla para los gastos de la solicitud: la frase parecida de `contrato_api.md` pertenecía a los comprobantes de liquidación (un error al leerla inicialmente); la regla se añadió al contrato en este trabajo.
- El código no lo cumple: el servidor exige la descripción en todos los gastos (`validacionSolicitudService.js`, `s.texto(...)` con `requerido` por omisión) y el formulario siempre la muestra y la exige (`secciones/gastos.js`, `datos.js` `erroresLocales`).
- No hay constancia en Engram de que el dueño lo pidiera antes; se toma la instrucción de 2026-11-16.

## Decisiones
- Mismo patrón que los defectos: la descripción es opcional a nivel de formato y obligatoria solo si `tipo.esOtros` (como `solicitud.defectoDescripcion`).
- Para los tipos que no son «Otros» el servidor ignora la descripción que llegue y guarda vacío.
- En el formulario, al pasar de «Otros» a otro tipo la descripción se oculta y se vacía; las solicitudes y borradores ya guardados con descripción en un tipo que no es «Otros» la pierden al guardarse de nuevo.

## Tareas
- [x] T1. Servidor: descripción opcional a nivel de formato, obligatoria solo para `esOtros` (mensaje nuevo, explicativo), ignorada y guardada vacía en los demás tipos; el catálogo de la solicitud expone `esOtros` de cada tipo de gasto si aún no lo hace; PDF y listados no deben mostrar descripciones vacías de forma rara.
- [x] T2. Formulario: la descripción aparece solo si el tipo elegido es `esOtros` (escritorio y celular, sin romper la grilla de la fila), se vacía al cambiar a otro tipo, no se envía ni se exige para los demás tipos; reconciliación al abrir una solicitud o un borrador.
- [x] T3. Docs del módulo.
- [x] T4. Prueba: API (Otros sin descripción da error, otros tipos sin descripción pasan, una descripción en un tipo que no es Otros se guarda vacía) y navegador (escritorio y celular, crear y modificar).

## Rutas
Delegado (un escritor): T1 a T3. T4 la coordina el padre.

## Pruebas
Sin runner automatizado; RED/GREEN no aplica (excepción registrada). Verificación por API con el usuario de prueba y por navegador.

## Evidencia (2026-11-16)
- Servidor y formulario hechos por un escritor delegado y revisados por el padre: `validacionSolicitudService.js` (descripción opcional en la forma; error `solicitud.gastoDescripcion` solo con `esOtros`; para los demás tipos se guarda vacía porque la columna es NOT NULL), PDF sin descripciones nulas, `datos.js` (`gastoEsOtros`, payload y errores locales), `secciones/gastos.js` (campo visible solo con «Otros», se vacía al cambiar) y CSS. El catálogo ya exponía `esOtros`. Sin migración.
- API (usuario de prueba): tipo normal sin descripción válido; «Otros» sin descripción da error en `gastos[0].descripcion` con el mensaje nuevo; «Otros» con descripción válido; tipo normal con descripción se acepta y la línea del desglose trae vacío; al crear, la BD guarda vacío en «Ferry» y conserva el texto en «Otros».
- Navegador: escritorio (1536x730) y celular (390x740): un tipo normal oculta la descripción y el selector ocupa su espacio sin correr el monto; «Otros» la muestra; al volver a un tipo normal se oculta y se vacía; solo el renglón «Otros» sin texto muestra el error. Modificar `VIA-GT-000001`: las descripciones viejas de tipos normales se ven ocultas y, al guardar, quedan vacías en la BD con los montos intactos. Borradores: «Otros» conserva su texto y el gasto normal no muestra campo al reabrir.
- Límite conocido: a nivel de formato sigue valiéndose la longitud máxima (100) aunque el tipo no sea «Otros»; solo afecta a clientes directos de la API, porque el formulario no la envía.
