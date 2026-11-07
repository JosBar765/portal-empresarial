// src/modules/proyectos/catalogos.js
// Registro de catálogos que el administrador edita (pantalla A1). Un catálogo nuevo es una entrada más.
// Los nombres de tabla y columna salen solo de aquí, nunca de la petición, así el SQL genérico no inyecta nada.
// `usos` cuenta dónde se usa cada fila (alias `t`); nunca se borra una fila, solo se desactiva.
const EFECTOS_ESTADO = ['ninguno', 'en_gestion', 'interesada'];

const nombre = { clave: 'nombre', columna: 'nombre', tipo: 'texto', max: 100, obligatorio: true };
const descripcion = { clave: 'descripcion', columna: 'descripcion', tipo: 'texto', max: 255 };

const CATALOGOS = {
  nichos: {
    tabla: 'proy_nichos', pk: 'id', activo: 'activo', orden: 'orden', singular: 'un nicho',
    campos: [nombre, descripcion],
    usos: '(SELECT COUNT(*) FROM proy_clientes x WHERE x.nicho_id = t.id)'
  },
  articulos: {
    tabla: 'proy_articulos', pk: 'id', activo: 'activo', orden: null, singular: 'un artículo',
    campos: [nombre, descripcion],
    usos: '(SELECT COUNT(*) FROM proy_proyectos x WHERE x.articulo_id = t.id)'
  },
  areas: {
    tabla: 'proy_areas_contacto', pk: 'id', activo: 'activo', orden: 'orden', singular: 'un área',
    campos: [nombre],
    usos: '(SELECT COUNT(*) FROM proy_contactos x WHERE x.area_id = t.id)'
  },
  canales: {
    tabla: 'proy_canales', pk: 'id', activo: 'activo', orden: null, singular: 'un canal',
    campos: [nombre, { clave: 'presencial', columna: 'presencial', tipo: 'booleano' }],
    usos: '(SELECT COUNT(*) FROM proy_gestiones x WHERE x.canal_id = t.id)'
  },
  resultados: {
    tabla: 'proy_resultados_gestion', pk: 'id', activo: 'activo', orden: 'orden', singular: 'un resultado',
    campos: [
      nombre,
      { clave: 'contactoLogrado', columna: 'contacto_logrado', tipo: 'booleano' },
      { clave: 'requiereProxima', columna: 'requiere_proxima', tipo: 'booleano' },
      { clave: 'efectoEstado', columna: 'efecto_estado', tipo: 'lista', opciones: EFECTOS_ESTADO, obligatorio: true }
    ],
    usos: '(SELECT COUNT(*) FROM proy_gestiones x WHERE x.resultado_id = t.id)'
  },
  motivos: {
    tabla: 'proy_motivos_perdida', pk: 'id', activo: 'activo', orden: 'orden', singular: 'un motivo',
    campos: [nombre],
    usos: '(SELECT COUNT(*) FROM proy_participaciones x WHERE x.motivo_perdida_id = t.id)'
  },
  estructuras: {
    tabla: 'proy_estructuras', pk: 'id', activo: 'activa', orden: 'orden', singular: 'una estructura',
    campos: [nombre],
    usos: '(SELECT COUNT(*) FROM proy_clientes x WHERE x.estructura_id = t.id)'
  },
  monedas: {
    tabla: 'proy_monedas', pk: 'codigo', activo: 'activa', orden: null, singular: 'una moneda',
    // El código es la clave: se escribe al crear y no se cambia después.
    campos: [
      { clave: 'codigo', columna: 'codigo', tipo: 'codigo', soloAlCrear: true, obligatorio: true },
      { clave: 'nombre', columna: 'nombre', tipo: 'texto', max: 50, obligatorio: true },
      { clave: 'simbolo', columna: 'simbolo', tipo: 'texto', max: 5, obligatorio: true }
    ],
    usos: '(SELECT COUNT(*) FROM proy_cotizaciones x WHERE x.moneda = t.codigo) + (SELECT COUNT(*) FROM proy_ventas y WHERE y.moneda = t.codigo)'
  }
};

const definicion = id => (Object.prototype.hasOwnProperty.call(CATALOGOS, id) ? CATALOGOS[id] : null);

module.exports = { CATALOGOS, EFECTOS_ESTADO, definicion };
