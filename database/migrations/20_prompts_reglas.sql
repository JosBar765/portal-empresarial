-- 20_prompts_reglas.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   El prompt deja de salir de una plantilla editable y se autogenera: encabezado + reglas «inicio» + sección generada
--   (imágenes y parámetros) + reglas «fin» (esquema_y_contrato.md). Este script prepara los datos para ese modelo.
--
-- Qué cambia:
--   1. «textos_prompt» suma «imagenes_titulo» e «imagenes_intro»; «limites» suma «regla_etiqueta_max»,
--      «regla_texto_max», «reglas_max» y «recursos_min_publicar». Solo se agregan las claves que faltan: nada de lo
--      que el administrador ya editó se pisa.
--   2. La plantilla de cada versión que la tenga y aún no tenga «reglas» se parte en reglas del esquema, una por
--      párrafo (separados por línea en blanco), todas en posición «inicio» y con el texto intacto (misma sintaxis
--      {{…}}). Un bloque {{#si}}…{{/si}} que abarque varios párrafos queda en una sola regla. Clave «bloque_NN»;
--      etiqueta: el encabezado del párrafo si lo tiene, o «Bloque NN». El administrador las renombra después.
--      El prompt resultante es idéntico al que producía la plantilla.
--      - Versión publicada: se publica una versión nueva (número siguiente) con el esquema anterior más las reglas, y
--        la anterior pasa a «archivada». Ninguna versión publicada se modifica.
--      - Borrador: se convierte en su lugar (aún no es público).
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Solo toca versiones con plantilla y sin «reglas»; las que ya las tienen, o un producto sin versiones, no cambian.
--   Requiere funciones de ventana y JSON_MERGE_PATCH: MySQL 8 o MariaDB 10.3.15 / 10.4+.
--   La tabla auxiliar «prompt_tmp_reglas» solo existe mientras corre el script.
--
-- Reversa (solo si hace falta deshacerlo; la plantilla original sigue en las versiones archivadas):
--   Elimina la versión publicada creada (la publicada con plantilla vacía) y vuelve a marcar como publicada la
--   versión anterior del mismo producto. Los ajustes nuevos pueden quedarse: no estorban.

SET NAMES utf8mb4;
SET SESSION group_concat_max_len = 16777216;

-- textos_prompt: título y presentación de la sección de imágenes (los textos de la plantilla actual).
UPDATE `prompt_ajustes`
SET `valor` = JSON_MERGE_PATCH(
  '{"imagenes_titulo":"IMÁGENES DE REFERENCIA","imagenes_intro":"Adjunté {total} en este orden. Son elementos reales del cliente: reprodúcelos con la mayor fidelidad posible (formas, colores y letras) y no los reemplaces ni los reinventes."}',
  `valor`)
WHERE `clave` = 'textos_prompt'
  AND (JSON_EXTRACT(`valor`, '$.imagenes_titulo') IS NULL OR JSON_EXTRACT(`valor`, '$.imagenes_intro') IS NULL);

-- limites: de las reglas y de los recursos mínimos para publicar.
UPDATE `prompt_ajustes`
SET `valor` = JSON_MERGE_PATCH(
  '{"regla_etiqueta_max":80,"regla_texto_max":3000,"reglas_max":30,"recursos_min_publicar":1}',
  `valor`)
WHERE `clave` = 'limites'
  AND (JSON_EXTRACT(`valor`, '$.regla_etiqueta_max') IS NULL OR JSON_EXTRACT(`valor`, '$.regla_texto_max') IS NULL
    OR JSON_EXTRACT(`valor`, '$.reglas_max') IS NULL OR JSON_EXTRACT(`valor`, '$.recursos_min_publicar') IS NULL);

-- Tabla auxiliar: las reglas (JSON) de cada versión por convertir.
DROP TABLE IF EXISTS `prompt_tmp_reglas`;
CREATE TABLE `prompt_tmp_reglas` (
  `version_id` INT      NOT NULL PRIMARY KEY,
  `reglas`     LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parte cada plantilla en párrafos y une los que dejan un bloque {{#…}} sin cerrar; con más de 30 reglas, el resto se suma a la última.
INSERT INTO `prompt_tmp_reglas` (`version_id`, `reglas`)
SELECT d.`id`,
       GROUP_CONCAT(CONCAT(
         '{"clave":', JSON_QUOTE(CONCAT('bloque_', LPAD(d.`grupo`, 2, '0'))),
         ',"etiqueta":', JSON_QUOTE(CASE
           WHEN d.`linea` NOT LIKE '%{{%' AND d.`linea` NOT LIKE '-%' AND CHAR_LENGTH(d.`linea`) BETWEEN 1 AND 80
             THEN IF(BINARY d.`linea` = BINARY UPPER(d.`linea`), CONCAT(UPPER(LEFT(d.`linea`, 1)), LOWER(SUBSTRING(d.`linea`, 2))), d.`linea`)
           ELSE CONCAT('Bloque ', LPAD(d.`grupo`, 2, '0'))
         END),
         ',"texto":', JSON_QUOTE(d.`texto`),
         ',"posicion":"inicio","activo":true}'
       ) ORDER BY d.`grupo` SEPARATOR ',')
FROM (
  SELECT c.`id`, c.`grupo`, c.`texto`, TRIM(SUBSTRING_INDEX(c.`texto`, '\n', 1)) AS `linea`
  FROM (
    SELECT b.`id`, LEAST(b.`grupo`, 30) AS `grupo`,
           GROUP_CONCAT(b.`parte` ORDER BY b.`n` SEPARATOR '\n\n') AS `texto`
    FROM (
      SELECT p.`id`, p.`n`, p.`parte`,
             SUM(CASE WHEN (CHAR_LENGTH(REPLACE(p.`previo`, '{{/', '')) - CHAR_LENGTH(REPLACE(p.`previo`, '{{#', ''))) / 3 <= 0 THEN 1 ELSE 0 END)
               OVER (PARTITION BY p.`id` ORDER BY p.`n`) AS `grupo`
      FROM (
        SELECT f.`id`, num.`n`,
               TRIM(BOTH '\n' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(f.`txt`, '\n\n', num.`n`), '\n\n', -1)) AS `parte`,
               SUBSTRING_INDEX(f.`txt`, '\n\n', num.`n` - 1) AS `previo`
        FROM (
          SELECT v.`id`, REPLACE(REPLACE(v.`plantilla`, '\r\n', '\n'), '\r', '\n') AS `txt`
          FROM `prompt_producto_versiones` v
          WHERE v.`plantilla` <> ''
            AND JSON_EXTRACT(v.`esquema`, '$.reglas') IS NULL
            AND (v.`estado` = 'borrador'
              OR (v.`estado` = 'publicada' AND NOT EXISTS (
                    SELECT 1 FROM `prompt_producto_versiones` s
                    WHERE s.`producto_id` = v.`producto_id` AND s.`estado` = 'publicada' AND s.`numero` > v.`numero`)))
        ) f
        JOIN (
          SELECT u0.`x` + u1.`x` * 10 + u2.`x` * 100 + u3.`x` * 1000 + 1 AS `n`
          FROM (SELECT 0 AS `x` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) u0
          CROSS JOIN (SELECT 0 AS `x` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) u1
          CROSS JOIN (SELECT 0 AS `x` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) u2
          CROSS JOIN (SELECT 0 AS `x` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) u3
        ) num ON num.`n` <= 1 + (CHAR_LENGTH(f.`txt`) - CHAR_LENGTH(REPLACE(f.`txt`, '\n\n', ''))) / 2
      ) p
      WHERE p.`parte` <> ''
    ) b
    GROUP BY b.`id`, LEAST(b.`grupo`, 30)
  ) c
) d
GROUP BY d.`id`;

-- Borradores: se convierten en su lugar.
UPDATE `prompt_producto_versiones` v
JOIN `prompt_tmp_reglas` t ON t.`version_id` = v.`id`
SET v.`esquema` = JSON_MERGE_PATCH(v.`esquema`, CONCAT('{"reglas":[', t.`reglas`, ']}'))
WHERE v.`estado` = 'borrador'
  AND JSON_EXTRACT(v.`esquema`, '$.reglas') IS NULL;

-- Versión publicada: una versión nueva con el esquema anterior más las reglas (a nombre de quien creó la anterior).
INSERT INTO `prompt_producto_versiones` (`producto_id`, `numero`, `estado`, `esquema`, `plantilla`, `creado_por`, `publicado_en`)
SELECT v.`producto_id`,
       (SELECT MAX(x.`numero`) + 1 FROM `prompt_producto_versiones` x WHERE x.`producto_id` = v.`producto_id`),
       'publicada',
       JSON_MERGE_PATCH(v.`esquema`, CONCAT('{"reglas":[', t.`reglas`, ']}')),
       '', v.`creado_por`, CURRENT_TIMESTAMP
FROM `prompt_producto_versiones` v
JOIN `prompt_tmp_reglas` t ON t.`version_id` = v.`id`
WHERE v.`estado` = 'publicada'
  AND JSON_EXTRACT(v.`esquema`, '$.reglas') IS NULL;

-- La publicada anterior pasa a archivada cuando ya existe otra publicada con número mayor del mismo producto.
UPDATE `prompt_producto_versiones` v
JOIN `prompt_producto_versiones` n ON n.`producto_id` = v.`producto_id` AND n.`estado` = 'publicada' AND n.`numero` > v.`numero`
SET v.`estado` = 'archivada'
WHERE v.`estado` = 'publicada';

DROP TABLE IF EXISTS `prompt_tmp_reglas`;
