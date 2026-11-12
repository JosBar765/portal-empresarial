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
  'socket.accion.liquidada': 'Se liquidó la solicitud {correlativo}.'
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
