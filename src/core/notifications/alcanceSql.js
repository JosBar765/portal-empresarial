// Qué avisos quiere ver un usuario según las tiendas (y asesores) que marcó. Sin filas marcadas se ve todo.
// Siempre pasan los avisos sin tienda y los de sus propios registros. Los argumentos son expresiones SQL de confianza, nunca datos.
function visibleSql({ usuario, modulo, tienda, asesor }) {
  const suyas = `SELECT 1 FROM notificacion_filtros f WHERE f.usuario_id = ${usuario} AND f.modulo = ${modulo}`;
  return `(${tienda} IS NULL OR ${asesor} = ${usuario}
    OR NOT EXISTS (${suyas} AND f.clase <> 'guardado')
    OR EXISTS (${suyas} AND ((f.clase = 'tienda' AND f.ref_id = ${tienda}) OR (f.clase = 'asesor' AND f.ref_id = ${asesor}))))`;
}

module.exports = { visibleSql };
