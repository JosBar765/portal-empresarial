// src/modules/admin/repositories/permisoSupervisarSql.js
// Condición SQL compartida: "el rol tiene vales.supervisar" (la fuente de verdad de quién supervisa).
const CON_PERMISO_SUPERVISAR = (rolColumna) =>
  `EXISTS (SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = ${rolColumna} AND p.codigo = 'vales.supervisar')`;

module.exports = { CON_PERMISO_SUPERVISAR };
