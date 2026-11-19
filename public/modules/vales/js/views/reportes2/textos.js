// Textos de la pestaña Reportes 2, en un solo lugar.
export const TEXTOS = {
  titulo: 'Reportes 2',
  ayuda: 'Elige un reporte, ajusta la ventana de tiempo y usa «Actualizar» para ver los datos más recientes.',
  comboEtiqueta: 'Reporte',
  comboVacio: 'Selecciona un reporte',
  actualizar: 'Actualizar',
  descargarPdf: 'Descargar PDF',
  pdfSinSoporte: 'Este reporte no tiene PDF.',
  pdfElegirReporte: 'Elige un reporte para descargar su PDF.',
  vacioTitulo: 'Selecciona un reporte',
  vacioTexto: 'Elige un reporte en la lista para verlo aquí.',
  vacioSinCatalogo: 'Aún no hay reportes disponibles en esta pestaña.',
  cargando: 'Cargando el reporte…',
  errorTitulo: 'No se pudo cargar el reporte',
  errorRed: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  errorGenerico: 'Ocurrió un error inesperado. Pulsa «Reintentar»; si persiste, avisa a soporte.',
  reintentar: 'Reintentar',
  pdfErrorTitulo: 'No se pudo descargar el PDF',
  pdfExito: 'Reporte exportado'
};

// Reporte de actividad de tienda.
export const TEXTOS_TIENDA = {
  etiqueta: 'Reporte de actividad de tienda',
  filtroTienda: 'Tienda',
  todasLasTiendas: 'Todas las tiendas',
  todasMisTiendas: 'Todas mis tiendas',
  columna: 'Tienda',
  unidad: ['tienda', 'tiendas'],
  panel: 'Vales por tienda',
  actualizado: 'Actualizado',
  vacioTitulo: 'Sin vales con entrega en este período',
  vacioTexto: 'Cambia el período o los filtros para ver otros vales.',
  verMes: 'Ver el mes completo',
  recortado: 'Se muestran los vales más urgentes; acota el período o los filtros para ver el resto.',
  vigentesPeriodo: 'abiertos, con entrega anterior al período elegido',
  subEntregados: 'Ya llegaron al asesor',
  notasTitulo: 'Cómo funciona este reporte',
  notas: [
    '<strong>Vales incluidos:</strong> solo los autorizados; los que esperan autorización no cuentan.',
    '<strong>Período:</strong> se filtra por la <strong>fecha de entrega</strong> de los vales. La única excepción es «Atrasados antes del período»: vales abiertos y vencidos con entrega anterior al período.',
    '<strong>Entregado:</strong> el vale ya llegó al asesor. Los atrasados y los no entregados siguen abiertos.',
    '<strong>Tiendas:</strong> quien supervisa ve solo las tiendas a su cargo; los demás ven todas.'
  ]
};

// Los reportes de talleres, diseñadores y asesores comparten textos; cambia quién se evalúa y qué significa «Entregado».
const textosEquipo = ({ etiqueta, columna, unidad, filtro, todos, todosMis, entregado, sub, ultimaNota }) => ({
  ...TEXTOS_TIENDA,
  etiqueta,
  columna,
  unidad,
  filtro,
  todos,
  todosMis,
  panel: `Vales por ${unidad[0]}`,
  subEntregados: sub,
  notas: [
    TEXTOS_TIENDA.notas[0],
    TEXTOS_TIENDA.notas[1],
    `<strong>Entregado:</strong> ${entregado} Los atrasados y los no entregados siguen abiertos.`,
    ultimaNota
  ]
});

export const TEXTOS_TALLER = textosEquipo({
  etiqueta: 'Reporte de actividad de talleres', columna: 'Taller', unidad: ['taller', 'talleres'],
  filtro: 'Taller', todos: 'Todos los talleres', todosMis: 'Todos mis talleres',
  entregado: 'el Encargado del taller ya aprobó la propuesta; en revisión todavía no cuenta.',
  sub: 'Ya aprobados por el Encargado',
  ultimaNota: '<strong>Talleres:</strong> quien gestiona talleres ve solo los suyos; los demás ven todos.'
});

export const TEXTOS_DISENADOR = textosEquipo({
  etiqueta: 'Reporte de actividad de diseñadores', columna: 'Diseñador', unidad: ['diseñador', 'diseñadores'],
  filtro: 'Diseñadores', todos: 'Todos los diseñadores', todosMis: 'Todos mis diseñadores',
  entregado: 'el Encargado del taller ya aprobó la propuesta; en revisión todavía no cuenta.',
  sub: 'Ya aprobados por el Encargado',
  ultimaNota: '<strong>Diseñadores:</strong> quien gestiona talleres ve solo los diseñadores de sus talleres; los demás ven todos.'
});

export const TEXTOS_ASESOR = textosEquipo({
  etiqueta: 'Reporte de actividad de asesores', columna: 'Asesor', unidad: ['asesor', 'asesores'],
  filtro: 'Asesores', todos: 'Todos los asesores', todosMis: 'Todos mis asesores',
  entregado: 'el vale ya llegó al asesor.',
  sub: TEXTOS_TIENDA.subEntregados,
  ultimaNota: '<strong>Asesores:</strong> quien supervisa ve solo a sus asesores y a sí mismo; los demás ven todos.'
});
