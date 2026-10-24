-- rechazo_propuesta.sql
-- Script de migración para una base YA EN PRODUCCIÓN (no forma parte de schema.sql ni seed.sql).
--
-- Para qué sirve:
--   El asesor dueño de un vale en PENDIENTE_CONFIRMACION puede rechazar la propuesta de uno o varios talleres.
--   Cada taller acepta (su fila vuelve a PENDIENTE_ASIGNACION) o rechaza el rechazo, y conversan en un hilo propio
--   por taller (mensajes de 200 caracteres como máximo). Reemplaza el chat de la modificación básica antigua.
--
-- Qué agrega:
--   1. Tabla `vale_rechazos_propuesta`: una ronda de rechazo de UN taller dentro de UN vale.
--   2. Tabla `vale_rechazo_propuesta_mensajes`: el hilo del taller; todas las rondas comparten el mismo hilo.
--   3. Permiso `vales.rechazar_propuesta` (rol Asesor de Ventas, id 2).
--   4. Permiso `vales.responder_rechazo_propuesta`, para los mismos roles que ya tienen `vales.responder_modificacion_basica`.
--   5. Limpieza de la modificación básica antigua (tabla `vale_modificaciones_basicas`): cada solicitud
--      EN_CONVERSACION pasa a CANCELADA y su vale recupera la fecha de entrega anterior a la solicitud. Si no hay
--      solicitudes en conversación (producción) no cambia nada.
--
-- Qué no hace: no borra tablas ni permisos de la modificación básica antigua (`vale_modificaciones_basicas`,
-- `vale_modificacion_mensajes`, `vales.responder_modificacion_basica`); quedan sin uso.
--
-- Cómo se relaciona (solo por llaves foráneas, sin triggers):
--   - `vale_id` -> `vales` y `vale_taller_id` -> `vale_talleres`, ambas con ON DELETE CASCADE: si el vale se
--     elimina, caen sus rechazos y con ellos el hilo. Los mensajes se conservan aunque el taller acepte.
--   - `solicitante_id`, `autor_id` y `resuelto_por` -> `usuarios`.
--
-- Cómo se importa (una sola vez, o las veces que haga falta: es idempotente):
--   mysql -u <usuario> -p <base_de_datos> < database/<correlativo>_rechazo_propuesta.sql
--   (el archivo lleva un número delante; en la documentación se cita sin él)
--   Importar ANTES de desplegar el código nuevo. Los usuarios deben cerrar sesión e iniciar de nuevo para que su
--   token incluya los permisos nuevos.
--
-- Cómo se revierte (solo si hiciera falta; borra los hilos de rechazo de propuesta):
--   DELETE rp FROM `rol_permisos` rp JOIN `permisos` p ON p.`id` = rp.`permiso_id`
--     WHERE p.`codigo` IN ('vales.rechazar_propuesta', 'vales.responder_rechazo_propuesta');
--   DELETE FROM `permisos` WHERE `codigo` IN ('vales.rechazar_propuesta', 'vales.responder_rechazo_propuesta');
--   DROP TABLE IF EXISTS `vale_rechazo_propuesta_mensajes`;
--   DROP TABLE IF EXISTS `vale_rechazos_propuesta`;

SET NAMES utf8mb4;

-- 1. Ronda de rechazo de un taller: ABIERTO hasta que el taller responde o el asesor lo cancela.
CREATE TABLE IF NOT EXISTS `vale_rechazos_propuesta` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `vale_id`        INT NOT NULL,
  `vale_taller_id` INT NOT NULL,
  `solicitante_id` INT NOT NULL,
  `estado`         ENUM('ABIERTO', 'ACEPTADO', 'RECHAZADO', 'CANCELADO') NOT NULL DEFAULT 'ABIERTO',
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resuelto_en`    DATETIME DEFAULT NULL,
  `resuelto_por`   INT DEFAULT NULL,
  FOREIGN KEY (`vale_id`)        REFERENCES `vales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`vale_taller_id`) REFERENCES `vale_talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (`resuelto_por`)   REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_rechazos_propuesta_vale` (`vale_id`, `estado`),
  INDEX `idx_rechazos_propuesta_taller` (`vale_taller_id`, `estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Hilo por taller (máximo 200 caracteres por mensaje; también se valida en el servidor).
CREATE TABLE IF NOT EXISTS `vale_rechazo_propuesta_mensajes` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `vale_taller_id` INT NOT NULL,
  `autor_id`       INT NOT NULL,
  `lado`           ENUM('TALLER', 'ASESOR') NOT NULL,
  `mensaje`        VARCHAR(200) NOT NULL,
  `creado_en`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`vale_taller_id`) REFERENCES `vale_talleres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`autor_id`)       REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_rechazo_propuesta_mensajes_hilo` (`vale_taller_id`, `creado_en`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. y 4. Permisos nuevos, sin id fijo (se usa el siguiente libre de esta base).
INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'vales.rechazar_propuesta', 'Rechazar Propuesta', 'vales',
       'Permite al asesor dueño rechazar la propuesta de uno o varios talleres antes de confirmar el vale'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'vales.rechazar_propuesta');

INSERT INTO `permisos` (`codigo`, `nombre`, `modulo`, `descripcion`)
SELECT 'vales.responder_rechazo_propuesta', 'Responder Rechazo de Propuesta', 'vales',
       'Permite al equipo del taller conversar, aceptar o rechazar el rechazo de propuesta del asesor'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permisos` WHERE `codigo` = 'vales.responder_rechazo_propuesta');

-- Rechazar la propuesta: Asesor de Ventas (rol 2).
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT 2, p.`id`
FROM `permisos` p
WHERE p.`codigo` = 'vales.rechazar_propuesta'
  AND EXISTS (SELECT 1 FROM `roles` WHERE `id` = 2)
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = 2 AND x.`permiso_id` = p.`id`);

-- Responder el rechazo: los mismos roles que respondían la modificación básica (encargados y asistentes de cada taller).
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT rp.`rol_id`, pn.`id`
FROM `rol_permisos` rp
JOIN `permisos` pv ON pv.`id` = rp.`permiso_id` AND pv.`codigo` = 'vales.responder_modificacion_basica'
JOIN `permisos` pn ON pn.`codigo` = 'vales.responder_rechazo_propuesta'
WHERE NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = rp.`rol_id` AND x.`permiso_id` = pn.`id`);

-- 5. Solicitudes antiguas en conversación: el vale recupera la fecha anterior a la solicitud (solo si nada más la cambió y
-- ninguna otra solicitud aceptada de esa fecha sigue vigente) y la solicitud se cancela.
UPDATE `vales` v
JOIN `vale_modificaciones_basicas` m ON m.`vale_id` = v.`id` AND m.`estado` = 'EN_CONVERSACION'
SET v.`fecha_entrega` = m.`fecha_entrega_anterior`, v.`actualizado_en` = v.`actualizado_en`
WHERE DATE(v.`fecha_entrega`) = DATE(m.`fecha_entrega_nueva`)
  AND DATE(m.`fecha_entrega_anterior`) <> DATE(m.`fecha_entrega_nueva`)
  AND NOT EXISTS (
    SELECT 1 FROM `vale_modificaciones_basicas` o
    WHERE o.`vale_id` = m.`vale_id` AND o.`estado` IN ('ACEPTADA', 'ENTREGADA')
      AND DATE(o.`fecha_entrega_nueva`) = DATE(m.`fecha_entrega_nueva`)
  );

UPDATE `vale_modificaciones_basicas`
SET `estado` = 'CANCELADA', `resuelto_en` = NOW()
WHERE `estado` = 'EN_CONVERSACION';
