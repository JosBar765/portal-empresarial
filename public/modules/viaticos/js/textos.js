// Catálogo central de textos del módulo (sin DOM): todo texto que el JS pinta sale de aquí.
// Marcadores {nombre}; una clave o un parámetro ausentes lanzan un error para detectarlo en pruebas.
export const TEXTOS = {
  // ---------- Comunes ----------
  'comun.cerrar': 'Cerrar',
  'comun.aceptar': 'Aceptar',
  'comun.cancelar': 'Cancelar',
  'comun.cargando': 'Cargando...',
  'comun.reintentar': 'Reintentar',
  'comun.si': 'Sí',
  'comun.no': 'No',
  'comun.errores.sinConexion': 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo; si el problema continúa, avisa al administrador.',
  'comun.errores.respuestaNoLegible': 'El servidor respondió de forma inesperada (código HTTP {estado}). Inténtalo de nuevo en unos minutos; si el problema continúa, avisa al administrador.',
  'comun.errores.sinMotivo': 'El servidor rechazó la solicitud (código HTTP {estado}) sin indicar el motivo. Revisa los datos e inténtalo de nuevo; si el problema continúa, avisa al administrador.',
  'comun.errores.revisaCampos': 'Revisa los campos marcados en el formulario y corrígelos antes de continuar.',

  // ---------- Validación nativa de campos ----------
  'validacion.obligatorioLista': 'Selecciona una opción.',
  'validacion.obligatorio': 'Este campo es obligatorio.',
  'validacion.correo': 'Ingresa un correo válido.',
  'validacion.formato': 'El valor no tiene un formato válido.',
  'validacion.minimo': 'El valor mínimo permitido es {min}.',
  'validacion.maximo': 'El valor máximo permitido es {max}.',
  'validacion.numerico': 'Ingresa un valor numérico válido.',
  'validacion.largo': 'Escribe como máximo {max} caracteres.',
  'validacion.revisa': 'Revisa este campo.',
  'validacion.fecha': 'Selecciona una fecha.',

  // ---------- Barra de período y calendario ----------
  'periodo.titulo': 'Período',
  'periodo.tipoAria': 'Tipo de período',
  'periodo.tipo.hoy': 'Hoy',
  'periodo.tipo.dia': 'Día',
  'periodo.tipo.semana': 'Semana',
  'periodo.tipo.mes': 'Mes',
  'periodo.tipo.rango': 'Desde–Hasta',
  'periodo.anterior': 'Período anterior',
  'periodo.siguiente': 'Período siguiente',
  'periodo.etiquetaHoy': 'Hoy · {dia}',
  'periodo.etiquetaRango': 'Desde – Hasta',
  'periodo.desde': 'Desde',
  'periodo.hasta': 'Hasta',
  'periodo.errorOrden': 'La fecha «Desde» no puede ser posterior a «Hasta». Elige un «Desde» igual o anterior a «Hasta».',
  'periodo.seleccionarFecha': 'Seleccionar fecha',
  'periodo.quitarFiltro': 'Quitar filtro',
  'periodo.quitarFiltroDe': 'Quitar filtro de {campo}',
  'periodo.mesAnterior': 'Mes anterior',
  'periodo.mesSiguiente': 'Mes siguiente',
  'periodo.anioAnterior': 'Año anterior',
  'periodo.anioSiguiente': 'Año siguiente',
  'periodo.elegirOtroMes': '{mes}, elegir otro mes',
  'periodo.elegir.dia': 'Elegir día',
  'periodo.elegir.semana': 'Elegir semana',
  'periodo.elegir.mes': 'Elegir mes',
  'periodo.ayudaSemana': 'Toca cualquier día para elegir su semana (lunes a domingo).',

  // ---------- Pipeline de estado ----------
  'pipeline.paso': 'Paso {n} de {total}: {etiqueta} ({estado})',
  'pipeline.estadoPaso.pendiente': 'pendiente',
  'pipeline.estadoPaso.actual': 'paso actual',
  'pipeline.estadoPaso.completado': 'completado',
  'pipeline.estadoPaso.rechazado': 'rechazado',
  'pipeline.estadoPaso.vencida': 'vencido',

  // ---------- Solicitudes ----------
  'solicitudes.nueva': 'Nueva solicitud',
  'solicitudes.buscar': 'Buscar por correlativo o fecha de viáticos…',
  'solicitudes.buscarAria': 'Buscar solicitudes',
  'solicitudes.tablaAria': 'Tabla de solicitudes de viáticos: se desplaza con las flechas del teclado',
  'solicitudes.col.correlativo': 'Correlativo',
  'solicitudes.col.fechaCreacion': 'Fecha creación',
  'solicitudes.col.fechaViaticos': 'Fecha viáticos',
  'solicitudes.col.tipo': 'Tipo',
  'solicitudes.col.estado': 'Estado',
  'solicitudes.col.acciones': 'Acciones',
  'solicitudes.tipo.mas_de_un_dia': '+1 día',
  'solicitudes.tipo.hasta_un_dia': '1 día o menos',
  'solicitudes.resumen.una': '1 solicitud',
  'solicitudes.resumen.varias': '{n} solicitudes',
  'solicitudes.cargando': 'Cargando solicitudes...',
  'solicitudes.vacio.titulo': 'No hay solicitudes en este período',
  'solicitudes.vacio.texto': 'Cambia el período o crea una nueva con el botón «Nueva solicitud».',
  'solicitudes.sinResultados.titulo': 'Sin resultados',
  'solicitudes.sinResultados.texto': 'No encontramos solicitudes para «{busqueda}» en este período. Revisa el correlativo o la fecha, o cambia el período.',
  'solicitudes.error.titulo': 'No se pudieron cargar las solicitudes',
  'solicitudes.accion.ver': 'Ver documentos',
  'solicitudes.accion.modificar': 'Modificar solicitud',
  'solicitudes.accion.darDeBaja': 'Dar de baja',
  'solicitudes.accion.liquidar': 'Liquidar',
  'solicitudes.baja.titulo': 'Dar de baja la solicitud',
  'solicitudes.baja.mensaje': '¿Dar de baja la solicitud {correlativo}? Se borrarán la solicitud y su PDF. Esta acción no se puede deshacer.',
  'solicitudes.baja.confirmar': 'Dar de baja',
  'solicitudes.baja.exito': 'La solicitud {correlativo} se dio de baja.',
  'solicitudes.baja.error': 'No se pudo dar de baja',
  'solicitudes.proximamente': 'Esta función se habilita en la siguiente entrega',

  // ---------- Estructura general ----------
  'shell.sinSecciones.titulo': 'Sin secciones asignadas',
  'shell.sinSecciones.texto': 'Tu rol puede ver el módulo, pero no tiene ningún permiso de uso asignado todavía.',
  'shell.cargando': 'Cargando...',
  'shell.errorCarga.titulo': 'No se pudo cargar',
  'shell.enConstruccion.titulo': 'En construcción',
  'shell.enConstruccion.texto': 'Esta pantalla se habilitará en una próxima entrega del módulo.',
  'shell.enConstruccion.paises': 'Países con los que puedes solicitar viáticos: {paises}.',
  'shell.enConstruccion.sinPaises': 'Todavía no tienes países asignados para solicitar viáticos.',

  // ---------- Pestañas ----------
  'tab.solicitudes': 'Solicitudes',
  'tab.gestiones': 'Gestiones',
  'tab.configuracion': 'Configuración',
  'tab.solicitudes.titulo': 'Mis solicitudes de viáticos',
  'tab.gestiones.titulo': 'Gestiones de viáticos',
  'tab.configuracion.titulo': 'Configuración de viáticos',

  // ---------- Tiempo real ----------
  'socket.titulo': 'Viáticos',
  'socket.accion.creada': 'Se creó la solicitud {correlativo}.',
  'socket.accion.modificada': 'Se modificó la solicitud {correlativo}.',
  'socket.accion.dada_de_baja': 'Se dio de baja la solicitud {correlativo}.',
  'socket.accion.autorizada': 'Se autorizó la solicitud {correlativo}.',
  'socket.accion.rechazada': 'Se rechazó la solicitud {correlativo}.',
  'socket.accion.liquidada': 'Se liquidó la solicitud {correlativo}.',
  'socket.propia.autorizada': 'Tu solicitud {correlativo} fue autorizada.',
  'socket.propia.rechazada': 'Tu solicitud {correlativo} fue rechazada. El motivo aparece en su estado.'
};

// Sustituye {marcador} por su valor; un parámetro ausente lanza error.
export function rellenar(texto, params = {}) {
  return String(texto).replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, nombre) => {
    if (!(nombre in params)) throw new Error(`Falta el parámetro «${nombre}» en el texto: ${texto}`);
    return String(params[nombre]);
  });
}

export function t(clave, params) {
  if (!Object.prototype.hasOwnProperty.call(TEXTOS, clave)) throw new Error(`Texto inexistente: ${clave}`);
  return rellenar(TEXTOS[clave], params);
}
