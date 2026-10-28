# Generador de Prompts: prompt autogenerado con reglas generales y específicas

## Objetivo
Eliminar la plantilla editable. El prompt se arma solo con: encabezado del sistema (global) + reglas específicas `inicio` + sección generada por los parámetros y las imágenes + reglas específicas `fin`.

## Decisiones del usuario (2026-10-27)
- Reglas generales: ajustes globales (`encabezado_sistema`, `textos_prompt`).
- Reglas específicas del producto: lista en el esquema (`reglas`: clave, etiqueta, texto, posicion inicio|fin, activo). Versionadas con el producto. Aceptan la sintaxis de plantilla ({{var}}, {{#si}}, {{#no}}, recurso_<clave>, grupo_<g>_vacio).
- Sección generada: por grupo y parámetro, reutilizando la maquinaria de `otros_parametros` y los formatos de `textos_prompt`; nada de texto de negocio en el código.
- No hay plantilla editable ni modo avanzado. El editor muestra una vista previa de solo lectura con el prompt completo.
- Recursos requeridos para publicar: mínimo en `limites` (`recursos_min_publicar`), nunca en el código.
- Se autoriza correr la migración en la BD local de desarrollo (verificar `npm run migrate:estado`: development/localhost).
- La plantilla v18 de la medalla se parte en reglas con una migración; el prompt resultante debe ser idéntico al actual (verificar con un script de comparación).

## Decisiones posteriores (2026-10-27)
- Un parámetro que una regla nombra (`{{clave}}`, `{{#si clave}}`, `{{#no clave}}`) ya no aparece en `otros_parametros`; ahí solo caen los que ninguna regla nombra.
- Vista previa: usa valores de ejemplo (cada parámetro de texto aparece como su etiqueta entre corchetes) e imágenes de ejemplo inventadas; no toma nada del formulario del asesor. Lista de reglas compacta agrupada por posición; tarjeta «Recursos cargados» sin descripción; scroll interno por bloque en pantalla ancha.
- Si una migración falla porque la base no soporta una función o sintaxis, el error de arranque explica la versión de la base y el mínimo requerido (MySQL 8.0 o MariaDB 10.3.15).
- «Tipo» = tipo de PARÁMETRO (campo del formulario), no tipo de producto. Hay 7: texto, texto largo, número, opciones, sí/no, imágenes y calculado. El backend tiene un registro (un archivo por tipo). El frontend (`campos.js`, `formulario.js`, `esquemaOps.js`, `modalParametro.js`) todavía decide por tipo con `switch`: se deja así y solo se reorganiza si aparece un tipo nuevo de verdad (por ejemplo, «fecha»).

## Tareas
- [x] T20 Backend: esquema `reglas`, validación, render del prompt autogenerado, ajuste `recursos_min_publicar`, publicación sin plantilla. (Commit 0e8c4cf.)
- [x] T21 Frontend admin: pestaña Reglas, vista previa del prompt completo, quitar el editor de plantilla. (Commits 3e3ff71, 64f7174, 2849c02 y 4513380 —este último quita un «null» suelto en el editor cuando ya hay borrador—. Verificado en navegador el 2026-10-27: pestaña Reglas, vista previa sin errores, scroll interno por bloque y la página sin scroll.)
- [x] T22 Migración `prompts_reglas` (ajustes nuevos + plantillas existentes partidas en reglas) y prueba de equivalencia. (Commit 1974024. 18/18 prompts idénticos, local v18 y producción v5. Aplicada en la BD local `munditrofeos` (development/localhost). Sin probar en MariaDB.)
- [x] T23 Documentación (`esquema_y_contrato.md`, README del módulo). (Commit d6d3d65.)
- [ ] T24 Duplicar producto: botón en la fila de Productos; copia el esquema (grupos, parámetros, recursos, reglas) de la versión publicada (o del borrador) como borrador v1 de un producto con código y nombre nuevos. (Commit fa58509. Modal verificado en navegador; falta probar `POST /admin/productos/:id/duplicar` por HTTP tras reiniciar el servidor.)
- [x] T25 Registro de tipos de parámetro en `src/modules/prompts/services/tipos/`. (Commit e19a88b. 13.667 casos idénticos contra el código anterior; regresiones t20 y t24 sin cambios.)
- [ ] T26 Migración `prompts_medalla_inicial`: v20 local como versión inicial de staging/producción (plantilla inactiva y sin URL) y encabezado del sistema. (Aplicada en la BD local el 2026-10-27 sin cambios en versiones ni ajustes, como se esperaba: la guarda da «no aplicar» porque la v20 la publicó el dueño. Falta probarla en una base nueva. Verificado solo con SELECT: literal igual a la v20 salvo el recurso, esquema válido, prompt idéntico, la guarda da «no aplicar» en la BD local y «aplicar» en una base nueva simulada. Sin probar INSERT/UPDATE reales ni MariaDB.)

- [x] T27a Jerarquía de botones en «Prompt generado» (commit e1bf30f): botón guiado en la cabecera de «Imágenes para pegar», «Editar datos» arriba a la derecha, sin subtítulo, estados copiado/siguiente visibles.
- [ ] T27b «Copiar prompt» negro, «Editar datos» como botón blanco (ghost) y botón negro «Agregar marca de agua» arriba a la derecha. (Implementada, pendiente de aplicar migración y verificar en navegador. Ruta: delegada, un escritor junto con T28. Estado copiado del botón negro con fondo de éxito sin deshabilitarlo; acciones de la barra con padding vertical compacto para que no crezca; apiladas a ancho completo en menos de 640px.)
- [ ] T28 Marca de agua en el navegador: el asesor carga una imagen y obtiene la misma imagen con «GRUPO PREMIA» y el isotipo (LOGO_GP_isotipo.png) en diagonal y repetidos; botones copiar y descargar. Texto, logo, opacidad, ángulo y escala en el ajuste nuevo `marca_de_agua` (migración nueva) editable en Ajustes. (Implementada, pendiente de aplicar migración y verificar en navegador. Ruta: delegada, un escritor. Modal amplio `views/asesor/marcaDeAgua.js` y geometría pura `utils/mosaicoMarca.js`; ajuste `{ texto, logo_url, opacidad 0.05-0.6, angulo -90 a 90, escala 0.1-0.8, separacion 0.5-5, color hex }` con contorno derivado del color; migración `prompts_ajuste_marca_de_agua`; se edita en el editor JSON genérico de Ajustes. Comprobado por script: forma y mensajes, mosaico sin huecos en 8 proporciones x 6 ángulos x 3 escalas, literal de la migración igual al valor inicial; ci:sintaxis, cross18, t20b y t24 sin cambios.)

## Pendientes
- Probar «Duplicar» por HTTP (reiniciar el servidor).
- Confirmar la versión de MariaDB del hosting (10.3.15 o superior) antes del deploy.
- T26: aplicar y probar `prompts_medalla_inicial` en una base nueva (CI de migraciones) antes de promover a producción.
- Subir la imagen de `plantilla_base` a Supabase y activarla.
- Detalle visual menor: en el modal de duplicar, el aviso queda pegado a las etiquetas.

## Rutas de trabajo
- Cada tarea cierra con un commit convencional en español en `module/generador-prompts` y push.
