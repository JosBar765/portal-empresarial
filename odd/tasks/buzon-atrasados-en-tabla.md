# buzon-atrasados-en-tabla

Rama: `fix/ordenamiento-aparicion-vales` · Estrategia de entrega: `ask-on-risk` · Estado: en curso.

## Objetivo
Con un filtro de fecha (día, mes o rango) en el buzón, los vales **atrasados y abiertos con entrega fuera del período** deben salir **en la tabla principal, iguales a los demás** (mismas columnas, acciones, orden y paginación), no en un bloque aparte. Es clave para que los encargados de taller vean lo que no han trabajado.

## Decisiones acordadas con el usuario (2026-10-16)
- Opción B: mezclados en la tabla, sin bloque «Atrasados antes del período» en el Buzón.
- Aplica a todas las vistas de Buzón (administrador, asesor, supervisor, encargado, diseñador). «Trabajo realizado» no cambia: son vales ya terminados.
- El bloque de «Atrasados vigentes» de **Reportes** no se toca.

## Diseño
- `dentroDeVentana` (`valeHelpers.js`) acepta `ventana.incluirAtrasados`: con él, un vale atrasado y no terminal cuenta como dentro de la ventana. Todos los buzones por rol ya pasan por ahí, así que los contadores, el orden por grupos, los filtros de contador y la paginación quedan coherentes sin tocar cada rol.
- `obtenerBuzon` activa la bandera solo en la vista `buzon` y retira el cálculo y la respuesta de `atrasadosVigentes`.
- Frontend: se quita el bloque del Buzón (`renderVigentes`, `#atrasados-vigentes`, `state.atrasadosVigentes`); el componente compartido sigue sirviendo a Reportes.

## Tareas
- [x] T1 · Backend: bandera `incluirAtrasados` en `dentroDeVentana` y retiro del bloque aparte en `obtenerBuzon`. Ruta: inline (2 archivos acotados y ya entendidos). Commit: ver «Progreso».
- [ ] T2 · Frontend: quitar el bloque del Buzón. Ruta: inline.
- [ ] T3 · Documentación (`flujo_vale_de_arte.md`, `CLAUDE.md`) y verificación en navegador con los datos de prueba.

## Reglas de trabajo
- El servidor lo levanta siempre el usuario (puerto 3000); las pruebas van contra ese servidor.
- Comentarios de código lo más cortos posible. Commits en español, Conventional Commits, sin atribución de IA.
- Test-first: no hay suite de pruebas configurada; excepción documentada. Verificación con la API y el navegador.
- Al reportar pruebas, solo resultados, no los datos locales modificados.

## Progreso y evidencia
- Mapeo: todos los buzones por rol filtran con `dentroDeVentana`; el bloque aparte vivía en `obtenerBuzon` (`vigentesFuera`).
- T1: verificado por API contra :3000 con 4 roles (encargado de Diseño, encargado UV/3D, supervisor, asesor): con un día, la tabla trae todos sus atrasados abiertos (el mismo número que con «Todo») y la respuesta ya no trae `atrasadosVigentes`. Administrador, día 10/10: 49 filas (13 del día + 36 atrasados abiertos). «Trabajo realizado» sin cambios (13). El contador «Atrasados» del administrador pasó de 65 a 48 con filtro de fecha porque ya no cuenta los terminados con atraso final fuera del período; en «Todo» sigue en 65.
