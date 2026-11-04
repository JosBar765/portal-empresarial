-- Supervisor de Ventas (rol 3) puede rechazar la propuesta de sus propios vales.
INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`)
SELECT 3, p.`id`
FROM `permisos` p
WHERE p.`codigo` = 'vales.rechazar_propuesta'
  AND EXISTS (SELECT 1 FROM `roles` WHERE `id` = 3)
  AND NOT EXISTS (SELECT 1 FROM `rol_permisos` x WHERE x.`rol_id` = 3 AND x.`permiso_id` = p.`id`);
