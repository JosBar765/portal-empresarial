// Textos de la pestaña Reportes, en un solo lugar.
const servidor = { titulo: 'Ocurrió un problema en el servidor', texto: 'No se pudo completar la consulta. Inténtalo de nuevo; si persiste, avisa a soporte con la referencia.' };
export const TEXTOS = {
  titulo: 'Reportes',
  ayuda: 'Elige un reporte, ajusta sus filtros y la ventana de tiempo, y presiona «Generar» para ver los datos.',
  comboEtiqueta: 'Reporte',
  comboVacio: 'Selecciona un reporte',
  generar: 'Generar',
  descargarPdf: 'Descargar PDF',
  subir: 'Subir al inicio',
  pdfSinSoporte: 'Este reporte no tiene PDF.',
  pdfElegirReporte: 'Elige un reporte para descargar su PDF.',
  pdfGenerarPrimero: 'Presiona Generar para ver el reporte antes de descargar el PDF.',
  pdfObsoleto: 'Presiona Generar para actualizar el reporte antes de descargar el PDF.',
  vacioTitulo: 'Selecciona un reporte',
  vacioTexto: 'Elige un reporte en la lista para verlo aquí.',
  vacioSinCatalogo: 'Aún no hay reportes disponibles en esta pestaña.',
  sinGenerarTitulo: 'Elige los filtros y presiona Generar',
  sinGenerarTexto: 'El reporte se consulta solo cuando presionas «Generar».',
  obsoleto: 'Cambiaste los filtros. Presiona «Generar» para actualizar el reporte.',
  cargando: 'Cargando el reporte…',
  filtrosCargando: 'Cargando los filtros…',
  filtrosErrorTitulo: 'No se pudieron cargar los filtros',
  reintentar: 'Reintentar',
  restablecerFiltros: 'Restablecer filtros',
  pdfErrorTitulo: 'No se pudo descargar el PDF',
  pdfExito: 'Reporte exportado',
  // Línea con la que se ubica un fallo en el log del servidor.
  referencia: (referencia, etapa) => [referencia && `Referencia: ${referencia}`, etapa && `Etapa: ${etapa}`].filter(Boolean).join(' · '),
  // Causa de cada fallo, por código del servidor (o del navegador: REPORTE_RED, REPORTE_CLIENTE, REPORTE_RESPUESTA).
  errores: {
    REPORTE_FILTRO_INVALIDO: { titulo: 'Algún filtro no es válido', texto: 'Un filtro guardado ya no corresponde a lo que puedes ver. Restablécelos y vuelve a elegir.' },
    REPORTE_SIN_ACCESO: { titulo: 'No tienes acceso a este reporte', texto: 'Tu usuario no tiene permiso para consultarlo. Si lo necesitas, pídelo al administrador.' },
    REPORTE_NO_ENCONTRADO: { titulo: 'El reporte no existe', texto: 'El servidor no reconoce este reporte. Elige otro de la lista.' },
    REPORTE_LIMITE: { titulo: 'Demasiadas consultas seguidas', texto: (segundos) => (segundos ? `Espera ${segundos} ${segundos === 1 ? 'segundo' : 'segundos'} y vuelve a presionar «Generar».` : 'Espera unos segundos y vuelve a presionar «Generar».') },
    REPORTE_BD: servidor,
    REPORTE_INTERNO: servidor,
    REPORTE_PDF: servidor,
    REPORTE_NEGOCIO: servidor,
    REPORTE_RED: { titulo: 'No hay conexión con el servidor', texto: 'Revisa tu conexión a internet e inténtalo de nuevo.' },
    REPORTE_RESPUESTA: { titulo: 'Respuesta inesperada del servidor', texto: 'El servidor respondió en un formato que no se pudo leer. Inténtalo de nuevo; si persiste, avisa a soporte.' },
    REPORTE_CLIENTE: { titulo: 'No se pudo mostrar el reporte', texto: 'Ocurrió un error en la pantalla al armar el reporte. Avisa a soporte.' },
    generico: { titulo: 'No se pudo cargar el reporte', texto: 'Ocurrió un error inesperado. Inténtalo de nuevo; si persiste, avisa a soporte.' }
  }
};

// Desglose de vales (todos los reportes de actividad): dibujo a demanda.
export const TEXTOS_DESGLOSE = {
  verMas: (n, quedan) => `Ver ${n} más (quedan ${quedan})`
};

// Reporte de actividad de tienda.
export const TEXTOS_TIENDA = {
  etiqueta: 'Reporte de actividad de tiendas',
  filtroTienda: 'Tienda',
  todasLasTiendas: 'Todas las tiendas',
  todasMisTiendas: 'Todas mis tiendas',
  columna: 'Tienda',
  unidad: ['tienda', 'tiendas'],
  panel: 'Desglose de Vales de Arte',
  actualizado: 'Generado',
  evaluandoA: 'Evaluando a:',
  limpiar: 'Limpiar',
  quitarA: (nombre) => `Quitar a ${nombre}`,
  vacioTitulo: 'Sin vales con entrega en este período',
  vacioTexto: 'Cambia el período o los filtros para ver otros vales.',
  verMes: 'Ver el mes completo',
  desgloseOmitidoTitulo: 'Demasiados vales para listarlos',
  desgloseOmitidoTexto: (n) => `El período tiene ${n.toLocaleString('es-GT')} vales: son demasiados para mostrar el desglose. Se muestran los contadores y la gráfica. Acota el período o los filtros para ver el desglose.`,
  subVigentes: 'Entrega antes del período, vencidos y aún abiertos',
  subEntregados: 'Ya llegaron al asesor',
  notasTitulo: 'Cómo funciona este reporte',
  notas: [
    '<strong>Vales incluidos:</strong> solo los autorizados; los que esperan autorización no cuentan.',
    '<strong>Período:</strong> se filtra por la <strong>fecha de entrega</strong> de los vales. La única excepción es «Atrasados (anteriores al período)»: vales abiertos y vencidos con entrega anterior al período.',
    '<strong>Entregado:</strong> el vale ya llegó al asesor. Los atrasados y los vales por vencer siguen abiertos.',
    '<strong>Ingresados:</strong> vales autorizados con entrega en el período.',
    '<strong>Por vencer:</strong> vales del período que siguen en curso y dentro del plazo.',
    '<strong>Atrasados:</strong> vales abiertos y vencidos. Anteriores: su entrega fue antes del período, por eso no cuentan en Ingresados; actuales: su entrega es dentro del período.',
    '<strong>Entregados:</strong> vales que ya llegaron al asesor. Con atraso: llegaron después de su fecha de entrega; sin atraso: llegaron el mismo día de su fecha de entrega o antes.',
    '<strong>Urgentes:</strong> porcentaje de los vales ingresados que fueron marcados como urgentes.',
    '<strong>Tiendas:</strong> quien supervisa ve solo las tiendas a su cargo; los demás ven todas.'
  ],
  // Contadores del encabezado (solo en el reporte de tienda).
  contadoresAria: 'Resumen del período',
  contIngresados: 'Ingresados',
  contUrgentes: 'Urgentes',
  contEntregados: 'Entregados',
  contSinEntregar: 'Por vencer',
  contAtrasados: 'Atrasados',
  contAnteriores: 'Anteriores',
  contActuales: 'Actuales',
  seccionSinEntregar: 'Por vencer',
  seccionAtrasados: 'Atrasados (período actual)',
  tituloVigentes: 'Atrasados (anteriores al período)',
  contConAtraso: 'Con atraso',
  contSinAtraso: 'Sin atraso',
  // Filtro por contador: pulsar una tarjeta o categoría filtra el desglose (sin consultar).
  filtroCategoria: (grupo, categoria) => `${grupo}: ${categoria}`,
  filtrosActivos: 'Filtrando por:',
  quitarFiltro: (rotulo) => `Quitar el filtro ${rotulo}`,
  quitarFiltros: 'Quitar filtros',
  filtroSinVales: 'Ningún vale cumple el filtro elegido.',
  // Gráfica de vales por tienda (solo con más de una tienda en el filtro).
  graficaTitulo: 'Vales ingresados por tienda',
  // Modal al descargar el PDF del reporte de tienda.
  pdfModalTitulo: 'Descargar PDF',
  pdfModalPregunta: '¿Quieres incluir el desglose de Vales de Arte en el reporte?',
  pdfModalDetalle: 'El desglose lista los vales de cada sección: atrasados, por vencer y entregados. Los contadores y la gráfica se incluyen siempre.',
  // Modal con filtros de vista activos (barra enfocada o contadores): tres opciones.
  pdfModalFiltrosActivos: 'Tienes estos filtros aplicados en pantalla:',
  pdfModalConFiltros: 'Con los filtros aplicados',
  pdfModalTodo: 'Todo el desglose',
  pdfModalVales: (n) => `${n} ${n === 1 ? 'vale' : 'vales'}`,
  pdfFiltroGrupo: (columna, nombre, urgentes) => `${columna}: ${nombre}${urgentes ? ' (solo vales urgentes)' : ''}`,
  // Modal al presionar el nombre de una tienda en la gráfica: sugiere ir al reporte de actividad de asesores de esa tienda.
  graficaIrAAsesores: (nombre) => `Ir al reporte de actividad de asesores de ${nombre}`,
  irAsesoresTitulo: 'Ir al reporte de asesores',
  irAsesoresPregunta: (nombre) => `¿Quieres ir al reporte de actividad de asesores de ${nombre}?`,
  irAsesoresDetalle: 'Verás los contadores, los vales ingresados por asesor y el desglose de esa tienda, con el mismo período.',
  irAsesoresSi: 'Sí, ir al reporte',
  irAsesoresNo: 'No, quedarme aquí',
  pdfModalSi: 'Sí, incluir el desglose',
  pdfModalNo: 'No, sin desglose',
  pdfModalFilasMuchas: (n) => `El desglose tiene ${n} vales: el PDF tendrá varias páginas.`,
  // Gráfica apilada (reporte de asesores): leyenda y detalle de cada barra.
  graficaUrgentes: 'Urgentes',
  graficaNoUrgentes: 'No urgentes',
  graficaTotal: (total) => `${total} ${total === 1 ? 'vale' : 'vales'}`, // ayuda de la barra simple (tiendas)
  graficaDetalle: (total, urgentes) => `${total} ${total === 1 ? 'vale' : 'vales'} · ${urgentes} ${urgentes === 1 ? 'urgente' : 'urgentes'}`,
  graficaVerDe: (nombre) => `Ver los contadores y el desglose de ${nombre}`,
  graficaQuitar: (nombre) => `Quitar el enfoque en ${nombre} y ver todas las tiendas`,
  graficaRestantes: (n) => `Ver las ${n} restantes`,
  graficaMenos: 'Ver menos',
  contDetalleUrgentes: (total, ingresados) => `${total} de ${ingresados} ${ingresados === 1 ? 'vale' : 'vales'}`
};

// Los reportes de talleres, diseñadores y asesores comparten textos; cambia quién se evalúa y qué significa «Entregado».
// `notasContadores` (solo el de asesores, que lleva contadores) se suman a las notas; `extra` pisa textos propios (p. ej. el título de la gráfica).
const textosEquipo = ({ etiqueta, columna, unidad, filtro, todos, todosMis, entregado, sub, ultimaNota, notasContadores = [], extra = {} }) => ({
  ...TEXTOS_TIENDA,
  etiqueta,
  columna,
  unidad,
  filtro,
  todos,
  todosMis,
  subEntregados: sub,
  notas: [
    TEXTOS_TIENDA.notas[0],
    TEXTOS_TIENDA.notas[1],
    `<strong>Entregado:</strong> ${entregado} Los atrasados y los vales por vencer siguen abiertos.`,
    ...notasContadores,
    ultimaNota
  ],
  ...extra
});

export const TEXTOS_DISENADOR = textosEquipo({
  etiqueta: 'Reporte de actividad de diseñadores', columna: 'Diseñador', unidad: ['diseñador', 'diseñadores'],
  filtro: 'Diseñadores', todos: 'Todos los diseñadores', todosMis: 'Todos mis diseñadores',
  entregado: 'el Encargado del taller ya aprobó la propuesta; en revisión todavía no cuenta.',
  sub: 'Ya aprobados por el Encargado',
  // Los cinco contadores de siempre, más Efectividad y Entregas a tiempo, y cómo se cuenta y se presiona la gráfica por diseñador.
  notasContadores: [
    ...TEXTOS_TIENDA.notas.slice(3, 8),
    '<strong>Efectividad:</strong> vales entregados ÷ vales ingresados de todo el alcance. <strong>Entregas a tiempo:</strong> entregados sin atraso ÷ entregados. Los porcentajes llevan hasta dos decimales.',
    '<strong>Vales compartidos:</strong> si un vale lo trabajan dos diseñadores, aparece en la barra de cada uno y la suma de los diseñadores puede ser mayor que los totales, pero en el desglose sale una sola vez, con todos sus diseñadores en la columna. Un vale compartido se entrega, o se atrasa, para todos sus diseñadores a la vez: solo cuenta como entregado cuando todos sus Encargados lo aprobaron.',
    '<strong>E y T:</strong> E (Efectividad) = vales entregados ÷ vales asignados del diseñador. T (Entregas tardías) = entregas con atraso ÷ vales entregados del diseñador.',
    '<strong>Gráfica por diseñador:</strong> presiona el nombre o la barra «Asignados» para ver los contadores y el desglose de todos sus vales; presiona la parte verde de «Entregados» para ver solo lo entregado a tiempo; presiona la parte roja para ver solo las entregas tarde. Presiona de nuevo el mismo lugar para quitar el enfoque. Si cambias el selector de talleres o de diseñadores, el enfoque se quita.'
  ],
  ultimaNota: '<strong>Diseñadores:</strong> quien gestiona talleres ve solo los diseñadores de sus talleres; los demás ven todos. El selector de talleres acota los diseñadores que se ofrecen y todo el reporte a esos talleres.',
  extra: {
    graficaTitulo: 'Vales asignados y entregados por diseñador',
    graficaQuitar: (nombre) => `Quitar el enfoque en ${nombre} y ver todos los diseñadores`,
    // Leyenda de colores y de las columnas E y T (los colores no son lo único que las distingue: cada barra lleva su cifra).
    gdLeyendaAsignados: 'Asignados',
    gdLeyendaATiempo: 'Entregados a tiempo',
    gdLeyendaTarde: 'Entregados tarde',
    gdLeyendaE: 'Efectividad', gdLeyendaT: 'Entregas tardías', // la leyenda dibuja «E» y «T» en negrita; el cálculo va en las notas del reporte
    gdColE: 'E', gdColT: 'T',
    gdTituloE: 'Efectividad',
    gdTituloT: 'Entregas tardías',
    gdDetalle: (asignados, entregados, tarde) => `${asignados} ${asignados === 1 ? 'asignado' : 'asignados'} · ${entregados} ${entregados === 1 ? 'entregado' : 'entregados'} · ${tarde} ${tarde === 1 ? 'entrega tarde' : 'entregas tarde'}`,
    // Blancos pulsables: el nombre y «Asignados» enfocan todo; la parte verde, lo entregado; la roja, las entregas tarde.
    gdVerEntregados: (nombre) => `Ver solo los vales entregados de ${nombre}`,
    gdQuitarEntregados: (nombre) => `Quitar el enfoque en los vales entregados de ${nombre}`,
    gdVerTarde: (nombre) => `Ver solo las entregas tarde de ${nombre}`,
    gdQuitarTarde: (nombre) => `Quitar el enfoque en las entregas tarde de ${nombre}`,
    gdBarraAsignados: 'Asignados',
    gdBarraEntregados: 'Entregados',
    // Ícono de información junto al título de la gráfica (en el PDF esto mismo va impreso como nota).
    gdInfo: 'Un vale compartido cuenta en cada diseñador que lo trabaja y se entrega, o se atrasa, para todos ellos a la vez; por eso la suma de los diseñadores puede superar los totales.',
    // Tarjetas nuevas de los contadores.
    contEfectividad: 'Efectividad',
    contATiempo: 'Entregas a tiempo',
    // Los atrasados del período (los que no se entregaron y ya vencieron) explican la diferencia; sin atrasados no se menciona.
    contDetalleEfectividad: (entregados, ingresados, atrasados = 0) => `${entregados} de ${ingresados} ${ingresados === 1 ? 'vale entregado' : 'vales entregados'}${atrasados > 0 ? ` (${atrasados} ${atrasados === 1 ? 'atrasado' : 'atrasados'})` : ''}`,
    contDetalleATiempo: (aTiempo, entregas) => `${aTiempo} de ${entregas} ${entregas === 1 ? 'entrega' : 'entregas'}`,
    // Modal del PDF: etiqueta del enfoque de la gráfica.
    pdfFiltroGrupo: (columna, nombre, urgentes, modo) => `${columna}: ${nombre}${modo === 'entregados' ? ' (solo entregados)' : modo === 'tarde' ? ' (solo entregas tarde)' : urgentes ? ' (solo vales urgentes)' : ''}`
  }
});

// Reporte de talleres: el mismo diseño que el de diseñadores (tarjetas, gráfica agrupada, E y T) con el estado del vale completo.
const COMO_DISENADOR = Object.fromEntries(Object.entries(TEXTOS_DISENADOR).filter(([clave]) => /^(gd|cont|seccion|pdfFiltroGrupo)/.test(clave)));
export const TEXTOS_TALLER = {
  ...textosEquipo({
    etiqueta: 'Reporte de actividad de talleres', columna: 'Taller', unidad: ['taller', 'talleres'],
    filtro: 'Taller', todos: 'Todos los talleres', todosMis: 'Todos mis talleres',
    entregado: 'el Encargado del taller ya aprobó la propuesta; en revisión todavía no cuenta.',
    sub: 'Ya aprobados por el Encargado',
    notasContadores: [
      ...TEXTOS_TIENDA.notas.slice(3, 8),
      '<strong>Efectividad:</strong> vales entregados ÷ vales ingresados de todo el alcance. <strong>Entregas a tiempo:</strong> entregados sin atraso ÷ entregados. Los porcentajes llevan hasta dos decimales.',
      '<strong>Vales en varios talleres:</strong> si un vale pasa por dos talleres, aparece en la barra de cada uno y la suma de las barras puede ser mayor que los totales, pero en el desglose sale una sola vez, con todos sus talleres en la columna. Un vale compartido se entrega, o se atrasa, para todos sus talleres a la vez: solo cuenta como entregado cuando todos sus Encargados lo aprobaron. Los vales que aún no llegan a ningún taller no se cuentan.',
      '<strong>E y T:</strong> E (Efectividad) = vales entregados ÷ vales asignados del taller. T (Entregas tardías) = entregas con atraso ÷ vales entregados del taller.',
      '<strong>Gráfica por taller:</strong> presiona la barra «Asignados» para ver los contadores y el desglose de todos los vales del taller; presiona la parte verde de «Entregados» para ver solo lo entregado a tiempo y la roja para ver solo las entregas tarde. Presiona el nombre del taller para ir al reporte de diseñadores de ese taller. Presiona de nuevo el mismo lugar para quitar el enfoque. Si cambias el selector de talleres, el enfoque se quita.'
    ],
    ultimaNota: '<strong>Talleres:</strong> quien gestiona talleres ve solo los suyos; los demás ven todos.'
  }),
  ...COMO_DISENADOR,
  graficaTitulo: 'Vales asignados y entregados por taller',
  graficaQuitar: (nombre) => `Quitar el enfoque en ${nombre} y ver todos los talleres`,
  // Ícono de información junto al título de la gráfica (en el PDF esto mismo va impreso como nota).
  gdInfo: 'Un vale que pasa por varios talleres cuenta una sola vez en los contadores de arriba y una vez en cada taller de la gráfica; por eso la suma de las barras puede ser mayor que los totales.',
  gdIrA: (nombre) => `Ir al reporte de actividad de diseñadores de ${nombre}`,
  // El nombre del taller sugiere ir al reporte de diseñadores (mismo modal que tienda -> asesores).
  irAsesoresTitulo: 'Ir al reporte de diseñadores',
  irAsesoresPregunta: (nombre) => `¿Quieres ir al reporte de actividad de diseñadores de ${nombre}?`,
  irAsesoresDetalle: 'Verás los contadores, la gráfica por diseñador y el desglose de ese taller, con el mismo período.'
};

export const TEXTOS_ASESOR = textosEquipo({
  etiqueta: 'Reporte de actividad de asesores', columna: 'Asesor', unidad: ['asesor', 'asesores'],
  filtro: 'Asesores', todos: 'Todos los asesores', todosMis: 'Todos mis asesores',
  entregado: 'el vale ya llegó al asesor.',
  sub: TEXTOS_TIENDA.subEntregados,
  // Contadores (Ingresados, Sin entregar, Atrasados, Entregados, Urgentes) y la nota de tiendas, iguales a las del reporte de tiendas.
  notasContadores: [
    ...TEXTOS_TIENDA.notas.slice(3, 8), TEXTOS_TIENDA.notas[8],
    '<strong>Gráfica por asesor:</strong> presiona el nombre o la parte azul de una barra para ver los contadores y el desglose de todos los vales de ese asesor; presiona la parte ámbar para ver solo sus vales urgentes. Presiona de nuevo el mismo lugar para quitar el enfoque. Si cambias el selector de tienda o de asesores, el enfoque se quita.'
  ],
  ultimaNota: '<strong>Asesores:</strong> quien supervisa ve solo a sus asesores y a sí mismo; los demás ven todos.',
  extra: {
    graficaTitulo: 'Vales ingresados por asesor',
    // Barras pulsables: la barra y el nombre enfocan todos los vales del asesor; el tramo ámbar, solo los urgentes.
    graficaVerDe: (nombre) => `Ver los contadores y el desglose de ${nombre}`,
    graficaQuitar: (nombre) => `Quitar el enfoque en ${nombre} y ver todos los asesores`,
    graficaVerUrgentesDe: (nombre) => `La parte ámbar muestra solo los vales urgentes de ${nombre}`,
    graficaQuitarUrgentes: (nombre) => `Quitar el enfoque en los vales urgentes de ${nombre}`,
  }
});
