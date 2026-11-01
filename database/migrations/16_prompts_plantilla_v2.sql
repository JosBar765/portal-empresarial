-- 16_prompts_plantilla_v2.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Publica la versión 2 del producto «Medalla» del Generador de Prompts. Cada imagen se copia por
--   separado y se numera y describe en el prompt (ya no hay lámina), el listón sin imágenes se
--   inventa con los colores de los logos y los parámetros que la plantilla no nombre se agregan solos.
--
-- Qué cambia:
--   1. La versión 1 publicada pasa a «archivada».
--   2. Se inserta la versión 2 publicada: el esquema de la versión 1 más «ubicaciones» y «sugerencias»
--      en los tres parámetros de imágenes, y la plantilla v2 del contrato (esquema_y_contrato.md).
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Si el producto ya tiene versión 2 o ya tiene otra versión publicada, no hace nada:
--   el administrador conserva el control de sus versiones.
--
-- Reversa (solo si hace falta deshacerlo; borra la versión 2 y vuelve a publicar la 1):
--   DELETE v FROM `prompt_producto_versiones` v JOIN `prompt_productos` p ON p.`id` = v.`producto_id`
--     WHERE p.`codigo` = 'medalla' AND v.`numero` = 2;
--   UPDATE `prompt_producto_versiones` v JOIN `prompt_productos` p ON p.`id` = v.`producto_id`
--     SET v.`estado` = 'publicada' WHERE p.`codigo` = 'medalla' AND v.`numero` = 1;

SET NAMES utf8mb4;

-- Archiva la versión 1 publicada, solo si aún no existe la versión 2.
UPDATE `prompt_producto_versiones` v
JOIN `prompt_productos` p ON p.`id` = v.`producto_id`
LEFT JOIN `prompt_producto_versiones` v2 ON v2.`producto_id` = v.`producto_id` AND v2.`numero` = 2
SET v.`estado` = 'archivada'
WHERE p.`codigo` = 'medalla'
  AND v.`numero` = 1
  AND v.`estado` = 'publicada'
  AND v2.`id` IS NULL;

-- Versión 2 publicada; solo si no hay versión 2 ni otra versión publicada (a nombre del Administrador de menor id).
INSERT INTO `prompt_producto_versiones` (`producto_id`, `numero`, `estado`, `esquema`, `plantilla`, `creado_por`, `publicado_en`)
SELECT p.`id`, 2, 'publicada',
'{"esquema_version":1,"grupos":[{"clave":"general","etiqueta":"Datos generales","parametros":[{"clave":"evento","etiqueta":"Evento","tipo":"texto","requerido":true,"ayuda":"Nombre del evento o texto de la medalla","max_largo":150}]},{"clave":"dimensiones","etiqueta":"Dimensiones","parametros":[{"clave":"unidad","etiqueta":"Unidad de medida","tipo":"opciones","requerido":true,"defecto":"cm","opciones":[{"valor":"cm","etiqueta":"cm","texto_prompt":"cm"},{"valor":"pulg","etiqueta":"pulg (\\")","texto_prompt":"pulgadas"}]},{"clave":"ancho","etiqueta":"Ancho","tipo":"numero","requerido":true,"min":0.5,"max":60,"unidad_de":"unidad","defecto":7},{"clave":"alto","etiqueta":"Alto","tipo":"numero","requerido":true,"min":0.5,"max":60,"unidad_de":"unidad","defecto":7},{"clave":"argolla_ancho","etiqueta":"Ancho de la argolla","tipo":"numero","requerido":true,"min":0.3,"max":10,"unidad_de":"unidad","defecto":2.5},{"clave":"liston_ancho","etiqueta":"Ancho del listón","tipo":"calculado","igual_a":"argolla_ancho","ayuda":"Igual al ancho de la argolla"}]},{"clave":"acabados","etiqueta":"Forma y acabado","parametros":[{"clave":"forma","etiqueta":"Forma","tipo":"opciones","requerido":true,"defecto":"circular","opciones":[{"valor":"cuadrada","etiqueta":"Cuadrada","texto_prompt":"cuadrada"},{"valor":"circular","etiqueta":"Circular","texto_prompt":"circular"},{"valor":"irregular","etiqueta":"Irregular","texto_prompt":"de forma irregular"}]},{"clave":"relieve","etiqueta":"Relieve","tipo":"si_no","defecto":true},{"clave":"textura","etiqueta":"Textura","tipo":"si_no","defecto":true}]},{"clave":"frente","etiqueta":"Parte frontal","parametros":[{"clave":"frente_imagenes","etiqueta":"Imágenes del frente","tipo":"imagenes","max":3,"max_mb":5,"formatos":["png","jpg","svg","webp"],"ubicaciones":["Centro","Arriba","Abajo","Izquierda","Derecha","Toda la cara (fondo)"],"sugerencias":["Logo del organizador","Logo de patrocinador","Imagen decorativa"]},{"clave":"frente_frases","etiqueta":"Frases del frente","tipo":"texto_largo","separador":",","ayuda":"Separa cada frase con una coma"},{"clave":"frente_indicaciones","etiqueta":"Indicaciones de diseño del frente","tipo":"texto_largo"}]},{"clave":"trasera","etiqueta":"Parte trasera","parametros":[{"clave":"trasera_lisa","etiqueta":"Trasera lisa","tipo":"si_no","defecto":false},{"clave":"trasera_imagenes","etiqueta":"Imágenes de la parte trasera","tipo":"imagenes","max":3,"max_mb":5,"formatos":["png","jpg","svg","webp"],"visible_si":{"parametro":"trasera_lisa","igual":false},"ubicaciones":["Centro","Arriba","Abajo","Izquierda","Derecha","Toda la cara (fondo)"],"sugerencias":["Logo de patrocinador","Ruta del recorrido","Imagen decorativa"]},{"clave":"trasera_frases","etiqueta":"Frases de la parte trasera","tipo":"texto_largo","separador":",","ayuda":"Separa cada frase con una coma","visible_si":{"parametro":"trasera_lisa","igual":false}},{"clave":"trasera_indicaciones","etiqueta":"Indicaciones de diseño de la parte trasera","tipo":"texto_largo","visible_si":{"parametro":"trasera_lisa","igual":false}}]},{"clave":"liston","etiqueta":"Listón","parametros":[{"clave":"liston_imagenes","etiqueta":"Imágenes del listón","tipo":"imagenes","max":10,"max_mb":5,"formatos":["png","jpg","svg","webp"],"ubicaciones":["Repetido a lo largo de la cinta","En los extremos"],"sugerencias":["Patrón del listón","Logo de patrocinador"]}]}]}',
'IMÁGENES DE REFERENCIA\nAdjunté {{total_imagenes}} en este orden. Son elementos reales del cliente: reprodúcelos con la mayor fidelidad posible (formas, colores y letras) y no los reemplaces ni los reinventes.\n{{lista_imagenes}}\n\nOBJETIVO\nCon esas referencias, genera UNA sola imagen horizontal en formato 16:9, con calidad de fotografía de producto profesional, que muestre una MEDALLA vista de frente (cara izquierda) y de reverso (cara derecha), una al lado de la otra y a la misma escala.\n\nPRODUCTO\nMedalla {{forma}}{{#si relieve}} con relieve marcado{{/si}}{{#si textura}} y textura granulada fina{{/si}}.\nTexto principal de la medalla: "{{evento}}".\nProporciones de referencia (tipo regla): ancho {{ancho}}, alto {{alto}}, argolla de {{argolla_ancho}} y listón de {{liston_ancho}}. Mantén estas proporciones; no necesitan estar a escala exacta. En formas irregulares, toma como medida el punto más alto y el más ancho.\n\nFRENTE (cara izquierda)\n{{#si frente_imagenes}}- Coloca {{frente_imagenes}}.{{/si}}\n{{#si frente_frases}}- Frases exactas, con esta ortografía: {{frente_frases}}.{{/si}}\n{{#si frente_indicaciones}}- Indicaciones de diseño: {{frente_indicaciones}}{{/si}}\n\nREVERSO (cara derecha)\n{{#si trasera_lisa}}- Reverso totalmente liso, sin grabados ni imágenes.{{/si}}\n{{#si trasera_imagenes}}- Coloca {{trasera_imagenes}}.{{/si}}\n{{#si trasera_frases}}- Frases exactas, con esta ortografía: {{trasera_frases}}.{{/si}}\n{{#si trasera_indicaciones}}- Indicaciones de diseño: {{trasera_indicaciones}}{{/si}}\n{{#no trasera_lisa}}- Diseña el reverso en armonía con el frente.{{/no}}\n\nLISTÓN\n{{#si liston_imagenes}}- Usa {{liston_imagenes}} como motivo del listón, repetido a lo largo de la cinta.{{/si}}\n{{#no liston_imagenes}}- Diseña el listón con un diseño arbitrario que use los colores de los logos adjuntos.{{/no}}\n\n{{otros_parametros}}\n\nCOMPOSICIÓN\n- Fondo plano de un solo color que contraste con el metal y los colores de la medalla, sin degradados ni objetos adicionales.\n- Iluminación suave de estudio, sombras suaves y detalle nítido del relieve.\n- Cada cara completa y centrada en su mitad de la imagen, con el listón colgando de la argolla.\n\nMARCA DE AGUA\n- Coloca el logo de la {{logo_marca_agua}} junto con el texto exacto "Grupo Premia", como marca de agua discreta y semitransparente en la esquina superior derecha de la imagen, sin tapar la medalla.\n\nPIE DE LA IMAGEN\n- Al pie, una franja horizontal con los colores del logo de Grupo Premia y, en texto blanco apilado (uno debajo del otro):\n{{asesor_nombre}}\n{{#si asesor_telefono}}{{asesor_telefono}}{{/si}}\n{{asesor_correo}}\n\nIMPORTANTE\n- El resultado es una MEDALLA, no una moneda, un trofeo ni una insignia.\n- Escribe los textos exactamente como aparecen entre comillas.',
a.`id`, CURRENT_TIMESTAMP
FROM `prompt_productos` p
JOIN (SELECT MIN(u.`id`) AS `id` FROM `usuarios` u WHERE u.`rol_id` = 1) a ON a.`id` IS NOT NULL
WHERE p.`codigo` = 'medalla'
  AND NOT EXISTS (SELECT 1 FROM `prompt_producto_versiones` v WHERE v.`producto_id` = p.`id` AND v.`numero` = 2)
  AND NOT EXISTS (SELECT 1 FROM `prompt_producto_versiones` v WHERE v.`producto_id` = p.`id` AND v.`estado` = 'publicada');
