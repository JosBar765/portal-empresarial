// src/modules/proyectos/catalogos.js
// Registro de catálogos que el administrador edita (pantalla A1). Un catálogo nuevo es una entrada más.
// Los nombres de tabla y columna salen solo de aquí, nunca de la petición, así el SQL genérico no inyecta nada.
// `usos` cuenta dónde se usa cada fila (alias `t`); nunca se borra una fila, solo se desactiva.
const EFECTOS_ESTADO = ['ninguno', 'en_gestion', 'interesada'];

const nombre = { clave: 'nombre', etiqueta: 'Nombre', columna: 'nombre', tipo: 'texto', max: 100, obligatorio: true };
const descripcion = { clave: 'descripcion', etiqueta: 'Descripción', columna: 'descripcion', tipo: 'texto', max: 255 };

const CATALOGOS = {
  nichos: {
    plural: 'Nichos',
    tabla: 'proy_nichos', pk: 'id', activo: 'activo', orden: 'orden', singular: 'un nicho',
    campos: [nombre, descripcion],
    usos: '(SELECT COUNT(*) FROM proy_clientes x WHERE x.nicho_id = t.id)'
  },
  articulos: {
    plural: 'Artículos',
    tabla: 'proy_articulos', pk: 'id', activo: 'activo', orden: null, singular: 'un artículo',
    campos: [nombre, descripcion],
    usos: '(SELECT COUNT(*) FROM proy_proyectos x WHERE x.articulo_id = t.id)'
  },
  areas: {
    plural: 'Áreas de contacto',
    tabla: 'proy_areas_contacto', pk: 'id', activo: 'activo', orden: 'orden', singular: 'un área',
    campos: [nombre],
    usos: '(SELECT COUNT(*) FROM proy_contactos x WHERE x.area_id = t.id)'
  },
  canales: {
    plural: 'Canales',
    tabla: 'proy_canales', pk: 'id', activo: 'activo', orden: null, singular: 'un canal',
    campos: [nombre, { clave: 'presencial', etiqueta: 'Presencial', columna: 'presencial', tipo: 'booleano' }],
    usos: '(SELECT COUNT(*) FROM proy_gestiones x WHERE x.canal_id = t.id)'
  },
  resultados: {
    plural: 'Resultados de gestión',
    tabla: 'proy_resultados_gestion', pk: 'id', activo: 'activo', orden: 'orden', singular: 'un resultado',
    campos: [
      nombre,
      { clave: 'contactoLogrado', etiqueta: 'Contacto logrado', columna: 'contacto_logrado', tipo: 'booleano' },
      { clave: 'requiereProxima', etiqueta: 'Pide próxima fecha', columna: 'requiere_proxima', tipo: 'booleano' },
      { clave: 'efectoEstado', etiqueta: 'Empuja a', columna: 'efecto_estado', tipo: 'lista', opciones: EFECTOS_ESTADO, obligatorio: true }
    ],
    usos: '(SELECT COUNT(*) FROM proy_gestiones x WHERE x.resultado_id = t.id)'
  },
  motivos: {
    plural: 'Motivos de pérdida',
    tabla: 'proy_motivos_perdida', pk: 'id', activo: 'activo', orden: 'orden', singular: 'un motivo',
    campos: [nombre],
    usos: '(SELECT COUNT(*) FROM proy_participaciones x WHERE x.motivo_perdida_id = t.id)'
  },
  no_contactar: {
    plural: 'Motivos de «No contactar»',
    tabla: 'proy_motivos_no_contactar', pk: 'id', activo: 'activo', orden: 'orden', singular: 'un motivo',
    campos: [nombre],
    usos: '(SELECT COUNT(*) FROM proy_cliente_eventos x WHERE x.motivo = t.nombre)'
  },
  estructuras: {
    plural: 'Estructuras de empresa',
    tabla: 'proy_estructuras', pk: 'id', activo: 'activa', orden: 'orden', singular: 'una estructura',
    campos: [nombre],
    usos: '(SELECT COUNT(*) FROM proy_clientes x WHERE x.estructura_id = t.id)'
  },
  monedas: {
    plural: 'Monedas',
    tabla: 'proy_monedas', pk: 'codigo', activo: 'activa', orden: null, singular: 'una moneda',
    // El código es la clave: se escribe al crear y no se cambia después.
    campos: [
      { clave: 'codigo', etiqueta: 'Código', columna: 'codigo', tipo: 'codigo', soloAlCrear: true, obligatorio: true },
      { clave: 'nombre', etiqueta: 'Nombre', columna: 'nombre', tipo: 'texto', max: 50, obligatorio: true },
      { clave: 'simbolo', etiqueta: 'Símbolo', columna: 'simbolo', tipo: 'texto', max: 5, obligatorio: true }
    ],
    usos: '(SELECT COUNT(*) FROM proy_cotizaciones x WHERE x.moneda = t.codigo) + (SELECT COUNT(*) FROM proy_ventas y WHERE y.moneda = t.codigo)'
  }
};

const definicion = id => (Object.prototype.hasOwnProperty.call(CATALOGOS, id) ? CATALOGOS[id] : null);

module.exports = { CATALOGOS, EFECTOS_ESTADO, definicion };
