-- viaticos_historial.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   La acción «Historial» de la pestaña Gestiones muestra el registro de los movimientos de una solicitud (quién hizo
--   qué y cuándo). Ese registro debe sobrevivir a la baja y al vencimiento de la solicitud, que la borran junto con su
--   `viaticos_historial` (CASCADE).
--
-- Qué agrega:
--   1. Permiso `viaticos.ver_historial` (tabla `permisos`), asignado solo al Administrador; el resto de roles lo reciben
--      desde Administración.
--   2. Tabla `viaticos_movimientos`: un renglón por movimiento (tipo, quién, frase corta). SIN llaves foráneas a
--      `viaticos_solicitudes` ni a `usuarios`: sus renglones permanecen aunque se borre la solicitud o la persona;
--      por eso guarda copia del correlativo y del nombre del actor (`usuario_id` NULL = el sistema).
--   3. Relleno inicial desde `viaticos_historial` (creada, modificada, autorizada, rechazada con su motivo y liquidada),
--      conservando la fecha y el actor originales. `viaticos_historial` no se modifica.
--
-- Cómo se aplica (es idempotente: repetirlo no cambia nada ni duplica filas):
--   Automáticamente al iniciar el servidor en staging y producción; en desarrollo: npm run migrate.
--   Se aplica después de `viaticos_recibos` (el ejecutor ordena por nombre).
--
-- Cómo se revierte (solo si hiciera falta; el historial dejaría de funcionar hasta quitar también su código):
--   DROP TABLE IF EXISTS `viaticos_movimientos`;
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id` WHERE p.`codigo` = 'viaticos.ver_historial';
--   DELETE FROM `permisos` WHERE `codigo` = 'viaticos.ver_historial';

SET NAMES utf8mb4;

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'viaticos.ver_historial', 'Ver historial de viáticos', 'viaticos', 'Permite ver el historial de movimientos de las solicitudes en Gestiones' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'viaticos.ver_historial');

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT r.`id`, p.`id` FROM `roles` r
JOIN `permisos` p ON p.`codigo` = 'viaticos.ver_historial'
WHERE r.`nombre` = 'Administrador'
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` rp WHERE rp.`rol_id` = r.`id` AND rp.`permiso_id` = p.`id`);

CREATE TABLE IF NOT EXISTS `viaticos_movimientos` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `solicitud_id`   INT NOT NULL COMMENT 'Referencia sin llave foránea: el renglón sobrevive a la solicitud',
  `correlativo`    VARCHAR(30) NOT NULL COMMENT 'Copia del correlativo de la solicitud',
  `tipo`           VARCHAR(30) NOT NULL COMMENT 'Clave del movimiento (creada, modificada, revisada, autorizada...)',
  `usuario_id`     INT DEFAULT NULL COMMENT 'Sin llave foránea; NULL = el sistema',
  `usuario_nombre` VARCHAR(150) NOT NULL COMMENT 'Copia del nombre del actor',
  `accion`         VARCHAR(500) NOT NULL COMMENT 'Frase corta del movimiento',
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_viaticos_movimientos_solicitud` (`solicitud_id`),
  INDEX `idx_viaticos_movimientos_correlativo` (`correlativo`),
  INDEX `idx_viaticos_movimientos_creado` (`creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relleno: el primer renglón «esperando autorización» de cada solicitud es su creación y los siguientes, modificaciones.
-- Un renglón ya copiado (misma solicitud, tipo, fecha y actor) no se vuelve a copiar.
INSERT INTO `viaticos_movimientos` (`solicitud_id`, `correlativo`, `tipo`, `usuario_id`, `usuario_nombre`, `accion`, `creado_en`)
SELECT x.`solicitud_id`, x.`correlativo`, x.`tipo`, x.`usuario_id`, x.`usuario_nombre`, x.`accion`, x.`creado_en`
FROM (
  SELECT h.`solicitud_id`, s.`correlativo`,
    CASE e.`nombre`
      WHEN 'esperando autorización' THEN
        IF(h.`id` = (SELECT MIN(h2.`id`) FROM `viaticos_historial` h2 WHERE h2.`solicitud_id` = h.`solicitud_id` AND h2.`estado_id` = h.`estado_id`),
           'creada', 'modificada')
      ELSE e.`nombre`
    END AS `tipo`,
    h.`usuario_id`, u.`nombre` AS `usuario_nombre`,
    CASE e.`nombre`
      WHEN 'esperando autorización' THEN
        IF(h.`id` = (SELECT MIN(h2.`id`) FROM `viaticos_historial` h2 WHERE h2.`solicitud_id` = h.`solicitud_id` AND h2.`estado_id` = h.`estado_id`),
           'Creó la solicitud', 'Modificó la solicitud')
      WHEN 'autorizada' THEN 'Autorizó la solicitud'
      WHEN 'rechazada' THEN IF(h.`motivo` IS NULL OR h.`motivo` = '', 'Rechazó la solicitud', CONCAT('Rechazó la solicitud. Motivo: ', h.`motivo`))
      WHEN 'liquidada' THEN 'Liquidó la solicitud'
    END AS `accion`,
    h.`creado_en`
  FROM `viaticos_historial` h
  JOIN `viaticos_solicitudes` s ON s.`id` = h.`solicitud_id`
  JOIN `viaticos_estados` e ON e.`id` = h.`estado_id`
  JOIN `usuarios` u ON u.`id` = h.`usuario_id`
  WHERE e.`nombre` IN ('esperando autorización', 'autorizada', 'rechazada', 'liquidada')
) x
WHERE NOT EXISTS (
  SELECT 1 FROM `viaticos_movimientos` m
  WHERE m.`solicitud_id` = x.`solicitud_id` AND m.`tipo` = x.`tipo` AND m.`creado_en` = x.`creado_en` AND m.`usuario_id` = x.`usuario_id`
)
ORDER BY x.`creado_en`, x.`solicitud_id`;
