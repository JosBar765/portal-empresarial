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
