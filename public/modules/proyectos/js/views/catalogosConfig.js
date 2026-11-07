// Cómo se ve cada catálogo en A1: sus columnas, su formulario y su aviso. Agregar un catálogo es una entrada más
// (además de la del servidor). Los textos salen del mockup aprobado.
const EFECTOS = [['ninguno', 'Ninguno'], ['en_gestion', 'En gestión'], ['interesada', 'Interesada']];

const nombre = (etiqueta = 'Nombre') => ({ clave: 'nombre', tipo: 'texto', etiqueta, obligatorio: true });
const descripcion = { clave: 'descripcion', tipo: 'area', etiqueta: 'Descripción (opcional)' };

export const CATALOGOS = {
  nichos: {
    titulo: 'Nichos', singular: 'nicho', nuevo: 'Nuevo nicho',
    columnas: [{ titulo: 'Nombre', tipo: 'nombre' }, { titulo: 'Empresas', tipo: 'usos' }, { titulo: 'Activo', tipo: 'activo' }, { titulo: 'Orden', tipo: 'orden' }],
    campos: [nombre(), descripcion],
    aviso: { titulo: 'Solo el Administrador crea nichos', texto: 'Evita duplicados como «Banco» y «Bancos».' }
  },
  articulos: {
    titulo: 'Artículos', singular: 'artículo', nuevo: 'Nuevo artículo',
    columnas: [{ titulo: 'Nombre', tipo: 'nombre' }, { titulo: 'Descripción', tipo: 'texto', clave: 'descripcion' }, { titulo: 'Proyectos', tipo: 'usos' }, { titulo: 'Activo', tipo: 'activo' }],
    campos: [nombre(), descripcion],
    aviso: { titulo: 'La existencia no vive aquí', texto: 'Se define por proyecto y baja con cada entrega.' }
  },
  areas: {
    titulo: 'Áreas', singular: 'área', nuevo: 'Nueva área',
    columnas: [{ titulo: 'Nombre', tipo: 'nombre' }, { titulo: 'Contactos', tipo: 'usos' }, { titulo: 'Activo', tipo: 'activo' }, { titulo: 'Orden', tipo: 'orden' }],
    campos: [nombre()]
  },
  canales: {
    titulo: 'Canales', singular: 'canal', nuevo: 'Nuevo canal',
    columnas: [{ titulo: 'Nombre', tipo: 'nombre' }, { titulo: 'Presencial', tipo: 'si_no', clave: 'presencial' }, { titulo: 'Gestiones', tipo: 'usos' }, { titulo: 'Activo', tipo: 'activo' }],
    campos: [nombre(), { clave: 'presencial', tipo: 'interruptor', etiqueta: 'Presencial' }],
    aviso: { titulo: 'Presencial alimenta un informe', texto: 'El informe compara las gestiones presenciales con las remotas.' }
  },
  resultados: {
    titulo: 'Resultados', singular: 'resultado', nuevo: 'Nuevo resultado',
    columnas: [
      { titulo: 'Resultado', tipo: 'nombre' }, { titulo: 'Contacto logrado', tipo: 'si_no', clave: 'contactoLogrado' },
      { titulo: 'Pide fecha', tipo: 'si_no', clave: 'requiereProxima' }, { titulo: 'Empuja a', tipo: 'efecto', clave: 'efectoEstado' },
      { titulo: 'Activo', tipo: 'activo' }, { titulo: 'Orden', tipo: 'orden' }
    ],
    campos: [
      nombre('Resultado'),
      { clave: 'contactoLogrado', tipo: 'interruptor', etiqueta: 'Contacto logrado' },
      { clave: 'requiereProxima', tipo: 'interruptor', etiqueta: 'Pide próxima fecha' },
      { clave: 'efectoEstado', tipo: 'lista', etiqueta: 'Empuja el estado a', opciones: EFECTOS, valorInicial: 'ninguno' }
    ],
    aviso: { titulo: 'El estado nunca baja', texto: 'Cotizada y vendida salen de la cotización y la venta.' }
  },
  motivos: {
    titulo: 'Motivos', singular: 'motivo', nuevo: 'Nuevo motivo',
    columnas: [{ titulo: 'Motivo', tipo: 'nombre' }, { titulo: 'Pérdidas', tipo: 'usos' }, { titulo: 'Activo', tipo: 'activo' }, { titulo: 'Orden', tipo: 'orden' }],
    campos: [nombre('Motivo')],
    aviso: { titulo: 'Alimenta un informe', texto: 'El informe agrupa las perdidas por motivo.' }
  },
  estructuras: {
    titulo: 'Estructuras', singular: 'estructura', nuevo: 'Nueva estructura',
    columnas: [{ titulo: 'Estructura', tipo: 'nombre' }, { titulo: 'Empresas', tipo: 'usos' }, { titulo: 'Activa', tipo: 'activo' }, { titulo: 'Orden', tipo: 'orden' }],
    campos: [nombre('Estructura')]
  },
  monedas: {
    titulo: 'Monedas', singular: 'moneda', nuevo: 'Nueva moneda',
    columnas: [
      { titulo: 'Código', tipo: 'texto', clave: 'codigo' }, { titulo: 'Nombre', tipo: 'texto', clave: 'nombre' },
      { titulo: 'Símbolo', tipo: 'texto', clave: 'simbolo' }, { titulo: 'Registros', tipo: 'usos' }, { titulo: 'Activa', tipo: 'activo' }
    ],
    campos: [
      { clave: 'codigo', tipo: 'texto', etiqueta: 'Código (3 letras)', obligatorio: true, soloAlCrear: true, mayusculas: true, maximo: 3 },
      nombre(), { clave: 'simbolo', tipo: 'texto', etiqueta: 'Símbolo', obligatorio: true, maximo: 5 }
    ],
    aviso: { titulo: 'Un total por moneda', texto: 'Los informes no convierten ni mezclan monedas.' }
  }
};

// El orden de las pestañas; «paises» no sale de este registro porque se edita con otro formulario.
export const PESTANAS = [...Object.keys(CATALOGOS), 'paises'];
export const CONFIRMACION_VENTAS = [['heredar', 'Heredar'], ['si', 'Sí'], ['no', 'No']];
export const EFECTOS_ETIQUETA = Object.fromEntries(EFECTOS);
