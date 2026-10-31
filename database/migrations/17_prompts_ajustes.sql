-- 17_prompts_ajustes.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Saca del código el contenido y los límites del Generador de Prompts: crea la tabla de ajustes globales
--   «prompt_ajustes» (editables por el administrador) y publica la versión 3 del producto «Medalla», que usa un
--   recurso fijo «Plantilla base» (la imagen de la plantilla final, que se sube a Supabase) en lugar del logo
--   de marca de agua que antes ponía el código.
--
-- Qué cambia:
--   1. Crea la tabla «prompt_ajustes» si no existe.
--   2. Inserta los 6 ajustes (encabezado_sistema, textos_prompt, limites, formatos_imagen, textos_asesor,
--      contacto_ejemplo) solo si no existen: nunca pisa lo que el administrador ya editó.
--   3. La versión 2 publicada pasa a «archivada».
--   4. Se inserta la versión 3 publicada: el esquema de la versión 2 más el recurso «plantilla_base» (inactivo y
--      sin URL: el administrador sube la imagen, pega su URL y lo activa), y la plantilla v3 del contrato
--      (esquema_y_contrato.md).
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Si el producto ya tiene versión 3 (o una numeración mayor, p. ej. versiones de prueba) o ya tiene otra versión
--   publicada, los pasos 3 y 4 no hacen nada: el administrador conserva el control de sus versiones. Para
--   limpiar a mano versiones de prueba numeradas 3 o más, usa el SQL de la reversa (más abajo).
--
-- Reversa (solo si hace falta deshacerlo; borra la versión 3, vuelve a publicar la 2 y elimina los ajustes):
--   DELETE v FROM `prompt_producto_versiones` v JOIN `prompt_productos` p ON p.`id` = v.`producto_id`
--     WHERE p.`codigo` = 'medalla' AND v.`numero` >= 3;
--   UPDATE `prompt_producto_versiones` v JOIN `prompt_productos` p ON p.`id` = v.`producto_id`
--     SET v.`estado` = 'publicada' WHERE p.`codigo` = 'medalla' AND v.`numero` = 2;
--   DROP TABLE IF EXISTS `prompt_ajustes`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `prompt_ajustes` (
  `clave`          VARCHAR(60)  NOT NULL PRIMARY KEY,
  `valor`          JSON         NOT NULL,
  `descripcion`    VARCHAR(255) NOT NULL,
  `actualizado_en` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- encabezado_sistema
INSERT INTO `prompt_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'encabezado_sistema',
'"NUEVA INSTRUCCIÓN. Ignora por completo cualquier conversación, imagen o propuesta anterior y genera una imagen completamente nueva usando solo las especificaciones de este mensaje."',
'Instrucción que se antepone a todo prompt generado: le pide a la IA ignorar cualquier conversación o imagen anterior.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `prompt_ajustes` WHERE `clave` = 'encabezado_sistema');

-- textos_prompt
INSERT INTO `prompt_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'textos_prompt',
'{"imagen_ref":"imagen {numero}","imagen_detalle":" ({detalle})","detalle_ubicacion":"ubicación: {ubicacion}","detalle_union":"; ","union":", ","union_final":" e ","lista_linea":"- Imagen {numero} ({origen}): {descripcion}.{ubicacion}","lista_ubicacion":" Ubicación: {ubicacion}.","lista_sin_descripcion":"sin descripción","total_uno":"{n} imagen","total_varios":"{n} imágenes","si":"sí","no":"no","frase_comillas":"\\"{frase}\\"","frases_union":", ","numero_unidad":"{valor} {unidad}","extras_titulo":"ESPECIFICACIONES ADICIONALES","extras_grupo":"{grupo}","extras_linea":"- {etiqueta}: {valor}"}',
'Frases que el sistema arma dentro del prompt (referencias a imágenes, lista numerada, totales, sí/no, comillas de frases, unidad y especificaciones adicionales). Los marcadores van entre llaves, por ejemplo {numero}.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `prompt_ajustes` WHERE `clave` = 'textos_prompt');

-- limites
INSERT INTO `prompt_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'limites',
'{"gemini_max_imagenes":14,"plantilla_max_largo":50000,"texto_max_largo_defecto":150,"texto_largo_max_largo_defecto":600,"max_largo_tope":5000,"separador_max":5,"imagenes_max_defecto":3,"imagenes_max_tope":20,"imagenes_mb_defecto":5,"imagenes_mb_tope":10,"imagen_nombre_max":150,"imagen_descripcion_max":120,"lista_max_items":12,"ubicacion_max":40,"sugerencia_max":60,"producto_nombre_max":100,"producto_descripcion_max":255,"recurso_max_mb":8,"recurso_timeout_ms":10000,"recursos_max":10,"recurso_etiqueta_max":80,"recurso_descripcion_max":300}',
'Límites numéricos del módulo: largos de texto, cantidad y peso de imágenes, tamaños de producto, recursos fijos y tiempo de espera de lectura.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `prompt_ajustes` WHERE `clave` = 'limites');

-- formatos_imagen
INSERT INTO `prompt_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'formatos_imagen',
'{"png":{"extensiones":["png"],"mime":"image/png"},"jpg":{"extensiones":["jpg","jpeg"],"mime":"image/jpeg"},"svg":{"extensiones":["svg"],"mime":"image/svg+xml"},"webp":{"extensiones":["webp"],"mime":"image/webp"}}',
'Formatos de imagen admitidos: por cada formato, sus extensiones de archivo y su tipo MIME.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `prompt_ajustes` WHERE `clave` = 'formatos_imagen');

-- textos_asesor
INSERT INTO `prompt_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'textos_asesor',
'{"aviso_pegado":"Abre un chat nuevo en tu generador de imágenes y pega primero las imágenes, una por una y en este orden; al final pega el prompt. El prompt le indica que ignore cualquier propuesta anterior.","aviso_exceso_imagenes":"Gemini admite hasta {limite} imágenes de referencia y este pedido tiene {total}. Quita algunas imágenes para mejores resultados.","nota_prompt_nuevo":"Cada prompt es una instrucción nueva: la IA debe ignorar cualquier propuesta anterior. Pégalo en un chat nuevo.","nota_orden_imagenes":"Se copian en orden. Pégalas una por una en el mismo mensaje de tu generador de imágenes."}',
'Avisos y notas que el asesor ve al copiar las imágenes y el prompt. El aviso de exceso usa los marcadores {limite} y {total}.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `prompt_ajustes` WHERE `clave` = 'textos_asesor');

-- contacto_ejemplo
INSERT INTO `prompt_ajustes` (`clave`, `valor`, `descripcion`)
SELECT 'contacto_ejemplo',
'{"nombre":"Nombre Apellido","correo":"asesor@grupopremia.com","telefono":"+502 5555 5555"}',
'Datos del asesor que se usan en la vista previa del administrador: nombre, correo y teléfono (el teléfono puede quedar vacío).'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `prompt_ajustes` WHERE `clave` = 'contacto_ejemplo');

-- Archiva la versión 2 publicada, solo si aún no existe la versión 3.
UPDATE `prompt_producto_versiones` v
JOIN `prompt_productos` p ON p.`id` = v.`producto_id`
LEFT JOIN `prompt_producto_versiones` v3 ON v3.`producto_id` = v.`producto_id` AND v3.`numero` = 3
SET v.`estado` = 'archivada'
WHERE p.`codigo` = 'medalla'
  AND v.`numero` = 2
  AND v.`estado` = 'publicada'
  AND v3.`id` IS NULL;

-- Versión 3 publicada; solo si no hay versión 3 ni otra versión publicada (a nombre del Administrador de menor id).
INSERT INTO `prompt_producto_versiones` (`producto_id`, `numero`, `estado`, `esquema`, `plantilla`, `creado_por`, `publicado_en`)
SELECT p.`id`, 3, 'publicada',
'{"esquema_version":1,"grupos":[{"clave":"general","etiqueta":"Datos generales","parametros":[{"clave":"evento","etiqueta":"Evento","tipo":"texto","requerido":true,"ayuda":"Nombre del evento o texto de la medalla","max_largo":150}]},{"clave":"dimensiones","etiqueta":"Dimensiones","parametros":[{"clave":"unidad","etiqueta":"Unidad de medida","tipo":"opciones","requerido":true,"defecto":"cm","opciones":[{"valor":"cm","etiqueta":"cm","texto_prompt":"cm"},{"valor":"pulg","etiqueta":"pulg (\\")","texto_prompt":"pulgadas"}]},{"clave":"ancho","etiqueta":"Ancho","tipo":"numero","requerido":true,"min":0.5,"max":60,"unidad_de":"unidad","defecto":7},{"clave":"alto","etiqueta":"Alto","tipo":"numero","requerido":true,"min":0.5,"max":60,"unidad_de":"unidad","defecto":7},{"clave":"argolla_ancho","etiqueta":"Ancho de la argolla","tipo":"numero","requerido":true,"min":0.3,"max":10,"unidad_de":"unidad","defecto":2.5},{"clave":"liston_ancho","etiqueta":"Ancho del listón","tipo":"calculado","igual_a":"argolla_ancho","ayuda":"Igual al ancho de la argolla"}]},{"clave":"acabados","etiqueta":"Forma y acabado","parametros":[{"clave":"forma","etiqueta":"Forma","tipo":"opciones","requerido":true,"defecto":"circular","opciones":[{"valor":"cuadrada","etiqueta":"Cuadrada","texto_prompt":"cuadrada"},{"valor":"circular","etiqueta":"Circular","texto_prompt":"circular"},{"valor":"irregular","etiqueta":"Irregular","texto_prompt":"de forma irregular"}]},{"clave":"relieve","etiqueta":"Relieve","tipo":"si_no","defecto":true},{"clave":"textura","etiqueta":"Textura","tipo":"si_no","defecto":true}]},{"clave":"frente","etiqueta":"Parte frontal","parametros":[{"clave":"frente_imagenes","etiqueta":"Imágenes del frente","tipo":"imagenes","max":3,"max_mb":5,"formatos":["png","jpg","svg","webp"],"ubicaciones":["Centro","Arriba","Abajo","Izquierda","Derecha","Toda la cara (fondo)"],"sugerencias":["Logo del organizador","Logo de patrocinador","Imagen decorativa"]},{"clave":"frente_frases","etiqueta":"Frases del frente","tipo":"texto_largo","separador":",","ayuda":"Separa cada frase con una coma"},{"clave":"frente_indicaciones","etiqueta":"Indicaciones de diseño del frente","tipo":"texto_largo"}]},{"clave":"trasera","etiqueta":"Parte trasera","parametros":[{"clave":"trasera_lisa","etiqueta":"Trasera lisa","tipo":"si_no","defecto":false},{"clave":"trasera_imagenes","etiqueta":"Imágenes de la parte trasera","tipo":"imagenes","max":3,"max_mb":5,"formatos":["png","jpg","svg","webp"],"visible_si":{"parametro":"trasera_lisa","igual":false},"ubicaciones":["Centro","Arriba","Abajo","Izquierda","Derecha","Toda la cara (fondo)"],"sugerencias":["Logo de patrocinador","Ruta del recorrido","Imagen decorativa"]},{"clave":"trasera_frases","etiqueta":"Frases de la parte trasera","tipo":"texto_largo","separador":",","ayuda":"Separa cada frase con una coma","visible_si":{"parametro":"trasera_lisa","igual":false}},{"clave":"trasera_indicaciones","etiqueta":"Indicaciones de diseño de la parte trasera","tipo":"texto_largo","visible_si":{"parametro":"trasera_lisa","igual":false}}]},{"clave":"liston","etiqueta":"Listón","parametros":[{"clave":"liston_imagenes","etiqueta":"Imágenes del listón","tipo":"imagenes","max":10,"max_mb":5,"formatos":["png","jpg","svg","webp"],"ubicaciones":["Repetido a lo largo de la cinta","En los extremos"],"sugerencias":["Patrón del listón","Logo de patrocinador"]}]}],"recursos":[{"clave":"plantilla_base","etiqueta":"Plantilla base","descripcion":"plantilla de la imagen final, con la franja inferior del diseño de la empresa, los espacios para los datos del asesor y el logo en la esquina superior derecha","url":"","posicion":"inicio","activo":false}]}',
'{{#si lista_imagenes}}IMÁGENES DE REFERENCIA{{/si}}\n{{#si lista_imagenes}}Adjunté {{total_imagenes}} en este orden. Son elementos reales del cliente: reprodúcelos con la mayor fidelidad posible (formas, colores y letras) y no los reemplaces ni los reinventes.{{/si}}\n{{lista_imagenes}}\n\nBASE DE LA COMPOSICIÓN\n{{#si recurso_plantilla_base}}- Usa la {{recurso_plantilla_base}} como lienzo de la imagen final: conserva sin cambios su franja inferior con el diseño de la empresa y el logo de la esquina superior derecha, y coloca las dos caras de la medalla en el área central.{{/si}}\n{{#no recurso_plantilla_base}}- Compón la imagen sobre un fondo liso, sin elementos adicionales.{{/no}}\n- El fondo del área central debe ser un color liso que contraste con el metal y los colores de la medalla, sin degradados ni objetos adicionales.\n\nOBJETIVO\nGenera UNA sola imagen horizontal en formato 16:9, con calidad de fotografía de producto profesional, que muestre una MEDALLA vista de frente (cara izquierda) y de reverso (cara derecha), una al lado de la otra y a la misma escala.\n\nPRODUCTO\nMedalla {{forma}}{{#si relieve}} con relieve marcado{{/si}}{{#si textura}} y textura granulada fina{{/si}}.\nTexto principal de la medalla: "{{evento}}".\nProporciones de referencia (tipo regla): ancho {{ancho}}, alto {{alto}}, argolla de {{argolla_ancho}} y listón de {{liston_ancho}}. Mantén estas proporciones; no necesitan estar a escala exacta. En formas irregulares, toma como medida el punto más alto y el más ancho.\n\nFRENTE (cara izquierda)\n{{#si frente_imagenes}}- Coloca {{frente_imagenes}}.{{/si}}\n{{#si frente_frases}}- Frases exactas, con esta ortografía: {{frente_frases}}.{{/si}}\n{{#si frente_indicaciones}}- Indicaciones de diseño: {{frente_indicaciones}}{{/si}}\n\nREVERSO (cara derecha)\n{{#si trasera_lisa}}- Reverso totalmente liso, sin grabados ni imágenes.{{/si}}\n{{#si trasera_imagenes}}- Coloca {{trasera_imagenes}}.{{/si}}\n{{#si trasera_frases}}- Frases exactas, con esta ortografía: {{trasera_frases}}.{{/si}}\n{{#si trasera_indicaciones}}- Indicaciones de diseño: {{trasera_indicaciones}}{{/si}}\n{{#no trasera_lisa}}- Diseña el reverso en armonía con el frente.{{/no}}\n\nLISTÓN\n{{#si liston_imagenes}}- Usa {{liston_imagenes}} como motivo del listón, repetido a lo largo de la cinta.{{/si}}\n{{#no liston_imagenes}}- Diseña el listón con un diseño arbitrario que use los colores de los logos adjuntos.{{/no}}\n\n{{otros_parametros}}\n\nCOMPOSICIÓN\n- Iluminación suave de estudio, sombras suaves y detalle nítido del relieve.\n- Cada cara completa y centrada en su mitad del área central, con el listón colgando de la argolla.\n\nPIE DE LA IMAGEN\n{{#si recurso_plantilla_base}}- Escribe en los espacios de la franja inferior de la plantilla, en texto blanco y uno debajo del otro:{{/si}}\n{{#no recurso_plantilla_base}}- Al pie, una franja horizontal con los colores del logo de Grupo Premia y, en texto blanco apilado (uno debajo del otro):{{/no}}\n{{asesor_nombre}}\n{{#si asesor_telefono}}{{asesor_telefono}}{{/si}}\n{{asesor_correo}}\n\nIMPORTANTE\n- El resultado es una MEDALLA, no una moneda, un trofeo ni una insignia.\n- Escribe los textos exactamente como aparecen entre comillas.',
a.`id`, CURRENT_TIMESTAMP
FROM `prompt_productos` p
JOIN (SELECT MIN(u.`id`) AS `id` FROM `usuarios` u WHERE u.`rol_id` = 1) a ON a.`id` IS NOT NULL
WHERE p.`codigo` = 'medalla'
  AND NOT EXISTS (SELECT 1 FROM `prompt_producto_versiones` v WHERE v.`producto_id` = p.`id` AND v.`numero` = 3)
  AND NOT EXISTS (SELECT 1 FROM `prompt_producto_versiones` v WHERE v.`producto_id` = p.`id` AND v.`estado` = 'publicada');
