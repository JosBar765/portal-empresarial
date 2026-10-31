-- prompts.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   Habilita el módulo «Generador de Prompts»: el asesor completa los parámetros de un producto
--   y el portal arma un prompt de texto para un generador de imágenes. Nada se guarda por propuesta.
--
-- Qué agrega:
--   1. Tablas `prompt_productos` y `prompt_producto_versiones` (esquema JSON y plantilla por versión).
--   2. Permisos `prompts.ver`, `prompts.generar` y `prompts.administrar` (tabla `permisos`).
--      Administrador recibe los tres; Asesor de Ventas y Supervisor de Ventas, `ver` y `generar`.
--   3. El producto «Medalla» (activo) con su versión 1 publicada (esquema de 17 parámetros y plantilla v1).
--      Se crea a nombre del usuario Administrador de menor id; si no existe ninguno, no se inserta.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Después, los usuarios afectados deben cerrar sesión e iniciar de nuevo para que su token
--   incluya los permisos nuevos.
--
-- Reversa (solo si hace falta deshacerlo; borra los datos cargados):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`modulo` = 'prompts';
--   DELETE FROM `permisos` WHERE `modulo` = 'prompts';
--   DROP TABLE IF EXISTS `prompt_producto_versiones`;
--   DROP TABLE IF EXISTS `prompt_productos`;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `prompt_productos` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `codigo`         VARCHAR(50)  NOT NULL UNIQUE,
  `nombre`         VARCHAR(100) NOT NULL,
  `descripcion`    VARCHAR(255) DEFAULT NULL,
  `estado`         VARCHAR(20)  NOT NULL DEFAULT 'borrador',
  `creado_por`     INT NOT NULL,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prompt_producto_versiones` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `producto_id`    INT NOT NULL,
  `numero`         INT NOT NULL,
  `estado`         VARCHAR(20) NOT NULL DEFAULT 'borrador',
  `esquema`        JSON NOT NULL,
  `plantilla`      MEDIUMTEXT NOT NULL,
  `creado_por`     INT NOT NULL,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `publicado_en`   TIMESTAMP NULL DEFAULT NULL,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_prompt_version` (`producto_id`, `numero`),
  FOREIGN KEY (`producto_id`) REFERENCES `prompt_productos` (`id`),
  FOREIGN KEY (`creado_por`)  REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permisos nuevos, sin id fijo (se usa el siguiente libre de esta base).
INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'prompts.ver', 'Ver Generador de Prompts', 'prompts', 'Permite acceder al módulo Generador de Prompts' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'prompts.ver');

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'prompts.generar', 'Generar prompts', 'prompts', 'Permite completar los parámetros de un producto y generar su prompt' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'prompts.generar');

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'prompts.administrar', 'Administrar productos del Generador de Prompts', 'prompts', 'Permite crear productos y definir sus parámetros y plantilla' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'prompts.administrar');

-- Roles por id (1 Administrador, 2 Asesor de Ventas, 3 Supervisor de Ventas); si el rol no existe, se omite.
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id` FROM `roles` r
JOIN `permisos` p ON p.`codigo` IN ('prompts.ver', 'prompts.generar', 'prompts.administrar')
WHERE r.`id` = 1
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = r.`id` AND rp.`permiso_id` = p.`id`);

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id` FROM `roles` r
JOIN `permisos` p ON p.`codigo` IN ('prompts.ver', 'prompts.generar')
WHERE r.`id` IN (2, 3)
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = r.`id` AND rp.`permiso_id` = p.`id`);

-- Producto Medalla, a nombre del Administrador de menor id (sin Administrador no se inserta).
INSERT INTO `prompt_productos` (`codigo`, `nombre`, `descripcion`, `estado`, `creado_por`)
SELECT 'medalla', 'Medalla', 'Medalla de evento con frente, reverso y listón', 'activo', a.`id`
FROM (SELECT MIN(u.`id`) AS `id` FROM `usuarios` u WHERE u.`rol_id` = 1) a
WHERE a.`id` IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `prompt_productos` WHERE `codigo` = 'medalla');

-- Versión 1 publicada; solo si el producto no tiene ninguna versión (esquema y plantilla v1 del contrato).
INSERT INTO `prompt_producto_versiones` (`producto_id`, `numero`, `estado`, `esquema`, `plantilla`, `creado_por`, `publicado_en`)
SELECT p.`id`, 1, 'publicada',
'{"esquema_version":1,"grupos":[{"clave":"general","etiqueta":"Datos generales","parametros":[{"clave":"evento","etiqueta":"Evento","tipo":"texto","requerido":true,"ayuda":"Nombre del evento o texto de la medalla","max_largo":150}]},{"clave":"dimensiones","etiqueta":"Dimensiones","parametros":[{"clave":"unidad","etiqueta":"Unidad de medida","tipo":"opciones","requerido":true,"defecto":"cm","opciones":[{"valor":"cm","etiqueta":"cm","texto_prompt":"cm"},{"valor":"pulg","etiqueta":"pulg (\\")","texto_prompt":"pulgadas"}]},{"clave":"ancho","etiqueta":"Ancho","tipo":"numero","requerido":true,"min":0.5,"max":60,"unidad_de":"unidad","defecto":7},{"clave":"alto","etiqueta":"Alto","tipo":"numero","requerido":true,"min":0.5,"max":60,"unidad_de":"unidad","defecto":7},{"clave":"argolla_ancho","etiqueta":"Ancho de la argolla","tipo":"numero","requerido":true,"min":0.3,"max":10,"unidad_de":"unidad","defecto":2.5},{"clave":"liston_ancho","etiqueta":"Ancho del listón","tipo":"calculado","igual_a":"argolla_ancho","ayuda":"Igual al ancho de la argolla"}]},{"clave":"acabados","etiqueta":"Forma y acabado","parametros":[{"clave":"forma","etiqueta":"Forma","tipo":"opciones","requerido":true,"defecto":"circular","opciones":[{"valor":"cuadrada","etiqueta":"Cuadrada","texto_prompt":"cuadrada"},{"valor":"circular","etiqueta":"Circular","texto_prompt":"circular"},{"valor":"irregular","etiqueta":"Irregular","texto_prompt":"de forma irregular"}]},{"clave":"relieve","etiqueta":"Relieve","tipo":"si_no","defecto":true},{"clave":"textura","etiqueta":"Textura","tipo":"si_no","defecto":true}]},{"clave":"frente","etiqueta":"Parte frontal","parametros":[{"clave":"frente_imagenes","etiqueta":"Imágenes del frente","tipo":"imagenes","max":3,"max_mb":5,"formatos":["png","jpg","svg","webp"]},{"clave":"frente_frases","etiqueta":"Frases del frente","tipo":"texto_largo","separador":",","ayuda":"Separa cada frase con una coma"},{"clave":"frente_indicaciones","etiqueta":"Indicaciones de diseño del frente","tipo":"texto_largo"}]},{"clave":"trasera","etiqueta":"Parte trasera","parametros":[{"clave":"trasera_lisa","etiqueta":"Trasera lisa","tipo":"si_no","defecto":false},{"clave":"trasera_imagenes","etiqueta":"Imágenes de la parte trasera","tipo":"imagenes","max":3,"max_mb":5,"formatos":["png","jpg","svg","webp"],"visible_si":{"parametro":"trasera_lisa","igual":false}},{"clave":"trasera_frases","etiqueta":"Frases de la parte trasera","tipo":"texto_largo","separador":",","ayuda":"Separa cada frase con una coma","visible_si":{"parametro":"trasera_lisa","igual":false}},{"clave":"trasera_indicaciones","etiqueta":"Indicaciones de diseño de la parte trasera","tipo":"texto_largo","visible_si":{"parametro":"trasera_lisa","igual":false}}]},{"clave":"liston","etiqueta":"Listón","parametros":[{"clave":"liston_imagenes","etiqueta":"Imágenes del listón","tipo":"imagenes","max":10,"max_mb":5,"formatos":["png","jpg","svg","webp"]}]}]}',
'OBJETIVO\nGenera UNA sola imagen horizontal en formato 16:9, con calidad de fotografía de producto profesional, que muestre una MEDALLA vista de frente (cara izquierda) y de reverso (cara derecha), una al lado de la otra y a la misma escala.\n\nPRODUCTO\nMedalla {{forma}}{{#si relieve}} con relieve marcado{{/si}}{{#si textura}} y textura granulada fina{{/si}}.\nTexto principal de la medalla: "{{evento}}".\nProporciones de referencia (tipo regla): ancho {{ancho}}, alto {{alto}}, argolla de {{argolla_ancho}} y listón de {{liston_ancho}}. Mantén estas proporciones; no necesitan estar a escala exacta. En formas irregulares, toma como medida el punto más alto y el más ancho.\n\nREFERENCIAS\nAdjunto una lámina con recuadros numerados. Usa cada recuadro solo para lo que se indica abajo y reproduce los logos y elementos con fidelidad.\n\nFRENTE (cara izquierda)\n{{#si frente_imagenes}}- Incluye los elementos de {{frente_imagenes}}.{{/si}}\n{{#si frente_frases}}- Frases exactas, con esta ortografía: {{frente_frases}}.{{/si}}\n{{#si frente_indicaciones}}- Indicaciones de diseño: {{frente_indicaciones}}{{/si}}\n\nREVERSO (cara derecha)\n{{#si trasera_lisa}}- Reverso totalmente liso, sin grabados ni imágenes.{{/si}}\n{{#si trasera_imagenes}}- Incluye los elementos de {{trasera_imagenes}}.{{/si}}\n{{#si trasera_frases}}- Frases exactas, con esta ortografía: {{trasera_frases}}.{{/si}}\n{{#si trasera_indicaciones}}- Indicaciones de diseño: {{trasera_indicaciones}}{{/si}}\n{{#no trasera_lisa}}- Diseña el reverso en armonía con el frente.{{/no}}\n\nLISTÓN\n{{#si liston_imagenes}}- Usa {{liston_imagenes}} como motivo del listón, repetido a lo largo de la cinta.{{/si}}\n{{#no liston_imagenes}}- Listón liso, en un color que combine con la medalla.{{/no}}\n\nCOMPOSICIÓN\n- Fondo plano de un solo color que contraste con el metal y los colores de la medalla, sin degradados ni objetos adicionales.\n- Iluminación suave de estudio, sombras suaves y detalle nítido del relieve.\n- Cada cara completa y centrada en su mitad de la imagen, con el listón colgando de la argolla.\n\nMARCA DE AGUA\n- Coloca el logo del {{logo_marca_agua}} junto con el texto exacto "Grupo Premia", como marca de agua discreta y semitransparente en la esquina superior derecha de la imagen, sin tapar la medalla.\n\nPIE DE LA IMAGEN\n- Al pie, una franja horizontal con los colores del logo de Grupo Premia y, en texto blanco apilado (uno debajo del otro):\n{{asesor_nombre}}\n{{#si asesor_telefono}}{{asesor_telefono}}{{/si}}\n{{asesor_correo}}\n\nIMPORTANTE\n- El resultado es una MEDALLA, no una moneda, un trofeo ni una insignia.\n- Escribe los textos exactamente como aparecen entre comillas.',
p.`creado_por`, CURRENT_TIMESTAMP
FROM `prompt_productos` p
WHERE p.`codigo` = 'medalla'
  AND NOT EXISTS (SELECT 1 FROM `prompt_producto_versiones` v WHERE v.`producto_id` = p.`id`);
