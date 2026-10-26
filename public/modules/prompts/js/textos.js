// Catálogo central de textos del módulo (sin DOM): todo texto que el JS pinta sale de aquí.
// Marcadores {nombre}; una clave o un parámetro ausentes lanzan un error para detectarlo en pruebas.
// Los textos de negocio editables (avisos y notas del asesor) vienen del servidor en /config.
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

  // ---------- Estructura general ----------
  'shell.sinSecciones.titulo': 'Sin secciones asignadas',
  'shell.sinSecciones.texto': 'Tu rol puede ver el módulo, pero no tiene ningún permiso de uso asignado todavía.',
  'shell.cargando': 'Cargando...',
  'shell.errorCarga.titulo': 'No se pudo cargar',

  // ---------- Asesor: formulario ----------
  'asesor.formulario.sinProductos': 'Todavía no hay productos disponibles. Pídele al administrador que active uno.',
  'asesor.formulario.cambiarProducto.titulo': 'Cambiar de producto',
  'asesor.formulario.cambiarProducto.mensaje': 'Perderás lo que ya completaste, incluidas las imágenes. ¿Quieres continuar?',
  'asesor.formulario.cambiarProducto.aceptar': 'Cambiar de producto',
  'asesor.formulario.titulo': 'Nueva propuesta',
  'asesor.formulario.subtitulo': 'Completa los datos y genera un prompt listo para pegar en tu generador de imágenes (Gemini).',
  'asesor.formulario.producto': 'PRODUCTO',
  'asesor.formulario.productoAria': 'Producto',
  'asesor.formulario.resumen': 'Resumen',
  'asesor.formulario.resumenVacio': 'Aún no has completado datos.',
  'asesor.formulario.pie': 'Pie de la imagen',
  'asesor.formulario.pieSinTelefono': 'Tu perfil no tiene teléfono: se te preguntará antes de generar.',
  'asesor.formulario.generar': 'Generar prompt',
  'asesor.formulario.sinTelefono.titulo': 'Falta tu número de teléfono',
  'asesor.formulario.sinTelefono.mensaje': 'Tu perfil no tiene teléfono. ¿Quieres generar el prompt sin número? El pie de la imagen saldrá solo con tu nombre y tu correo.',
  'asesor.formulario.sinTelefono.aceptar': 'Generar sin número',
  'asesor.formulario.toastRevisar': 'Revisa el formulario',
  'asesor.formulario.toastNoGenerado': 'No se pudo generar el prompt',

  // ---------- Asesor: campos ----------
  'asesor.campos.seleccionaOpcion': 'Selecciona una opción',
  'asesor.campos.separador': 'Sepáralas con comas',
  'asesor.campos.calculado': 'Se calcula a partir de «{origen}».',
  'asesor.campos.zonaTitulo': 'Arrastra, haz clic o pega (Ctrl+V) imágenes',
  'asesor.campos.zonaAyuda': 'Para pegar, pon el cursor sobre este recuadro · Máximo de imágenes: {max} · {formatos} · máx. {maxMb} MB cada una',
  'asesor.campos.contador': '{n} de {max}',
  'asesor.campos.archivoRechazado': 'Archivo no agregado',
  'asesor.campos.descripcionEtiqueta': '¿Qué es?',
  'asesor.campos.descripcionEjemplo': 'Ej.: Logo del organizador',
  'asesor.campos.descripcionAria': '¿Qué es? ({archivo})',
  'asesor.campos.ubicacionEtiqueta': 'Ubicación',
  'asesor.campos.ubicacionAria': 'Ubicación ({archivo})',
  'asesor.campos.sinUbicacion': 'Sin ubicación específica',
  'asesor.campos.quitar': 'Quitar {archivo}',
  'asesor.campos.imagenPegada': 'imagen-pegada-{n}.{ext}',
  'asesor.campos.formatosUnion': ' o ',

  // ---------- Asesor: resultado ----------
  'asesor.resultado.titulo': 'Prompt generado',
  'asesor.resultado.editar': 'Editar y generar otra propuesta',
  'asesor.resultado.empezarDeNuevo': 'Empezar de nuevo',
  'asesor.resultado.todoCopiado': 'Todo copiado',
  'asesor.resultado.copiarImagenN': 'Copiar imagen {numero} de {total}',
  'asesor.resultado.copiarPrompt': 'Copiar prompt',
  'asesor.resultado.promptCopiado': 'Copiado',
  'asesor.resultado.copiar': 'Copiar',
  'asesor.resultado.copiada': 'Copiada',
  'asesor.resultado.descargar': 'Descargar imagen',
  'asesor.resultado.descargarAria': 'Descargar imagen {numero}',
  'asesor.resultado.seccionPrompt': 'Prompt',
  'asesor.resultado.caracteres': '{n} caracteres',
  'asesor.resultado.seccionImagenes': 'Imágenes para pegar',
  'asesor.resultado.imagenAsesor': 'Imagen {numero} · {descripcion}',
  'asesor.resultado.imagenRecurso': 'Imagen {numero} · {etiqueta}',
  'asesor.resultado.sinDescripcion': 'sin descripción',
  'asesor.resultado.recursoFijo': 'Recurso fijo del producto',
  'asesor.resultado.toastCopiaManual': 'Copia manual',
  'asesor.resultado.toastPromptCopiado': 'Prompt copiado',
  'asesor.resultado.toastPromptCopiadoTexto': 'Pégalo en el chat después de las imágenes.',
  'asesor.resultado.toastImagenCopiada': 'Imagen {numero} copiada',
  'asesor.resultado.toastImagenCopiadaTexto': 'Pégala en el chat de tu generador de imágenes.',
  'asesor.resultado.toastImagenNoCopiada': 'No se pudo copiar la imagen',
  'asesor.resultado.toastNoDescargada': 'No se pudo descargar',
  'asesor.resultado.nombreImagen': 'imagen-{numero}',

  // ---------- Asesor: errores y validaciones ----------
  'asesor.formulario.cargaTitulo': 'No se pudo cargar el generador',
  'asesor.errores.cargaAyuda': 'Pulsa «Reintentar» para volver a cargarlo; si el problema continúa, avisa al administrador.',
  'asesor.errores.configIncompleta': 'El servidor devolvió una configuración incompleta del generador (falta «{parte}»). Avisa al administrador para que revise los ajustes del módulo.',
  'asesor.errores.requerido': 'Falta completar «{etiqueta}»: es un dato obligatorio. Escríbelo para poder generar el prompt.',
  'asesor.errores.textoLargo': '«{etiqueta}» tiene {largo} caracteres y el máximo permitido es {max}. Acórtalo al menos {exceso} caracteres.',
  'asesor.errores.numeroRequerido': 'Falta completar «{etiqueta}»: escribe un número para poder generar el prompt.',
  'asesor.errores.numeroInvalido': '«{etiqueta}» no es un número válido. Escribe solo cifras, por ejemplo 12 o 12.5.',
  'asesor.errores.numeroMin': '«{etiqueta}» no puede ser menor que {min} (escribiste {valor}). Escribe un número igual o mayor que {min}.',
  'asesor.errores.numeroMax': '«{etiqueta}» no puede ser mayor que {max} (escribiste {valor}). Escribe un número igual o menor que {max}.',
  'asesor.errores.opcionRequerida': 'Falta elegir una opción en «{etiqueta}». Selecciona una de la lista para continuar.',
  'asesor.errores.imagenesRequeridas': 'Falta subir al menos una imagen en «{etiqueta}». Arrastra, pega o selecciona un archivo.',
  'asesor.errores.imagenesExceso': 'Subiste {n} imágenes en «{etiqueta}» y el máximo es {max}. Quita las que sobren.',
  'asesor.errores.descripcionLarga': 'La descripción de «{archivo}» en «{etiqueta}» tiene {largo} caracteres y el máximo es {max}. Acórtala.',
  'asesor.errores.tipoNoSoportado': 'El dato «{etiqueta}» es de un tipo ({tipo}) que este formulario no reconoce. Avisa al administrador para que lo revise.',
  'asesor.errores.archivoLimite': 'El archivo «{archivo}» no se puede subir: «{etiqueta}» admite como máximo {max} imágenes y ya llegaste al límite. Quita una imagen para poder agregar otra.',
  'asesor.errores.archivoSinExtension': 'El archivo «{archivo}» no se puede subir: no tiene extensión y no se sabe su formato para «{etiqueta}». Renómbralo con una de estas extensiones: {formatos}.',
  'asesor.errores.archivoFormato': 'El archivo «{archivo}» no se puede subir: el formato {extension} no está permitido para «{etiqueta}». Usa uno de estos formatos: {formatos}.',
  'asesor.errores.archivoPesado': 'El archivo «{archivo}» no se puede subir: pesa {mb} MB y el máximo para «{etiqueta}» es {maxMb} MB. Reduce su tamaño o elige otra imagen.',
  'asesor.errores.archivoNombreLargo': 'El archivo «{archivo}» no se puede subir: su nombre tiene {largo} caracteres y el máximo es {max}. Renómbralo con un nombre más corto.',
  'asesor.errores.archivoNoDisponible': 'No se encontró en el navegador el archivo de la imagen {numero}. Vuelve a editar la propuesta y súbelo de nuevo.',
  'asesor.errores.recursoNoCargo': 'No se pudo cargar la imagen fija «{etiqueta}» (código HTTP {estado}). Pulsa «Copiar» para reintentar; si el problema continúa, avisa al administrador.',
  'asesor.errores.copiaImagenNoPermitida': 'No se pudo copiar la imagen: tu navegador no permitió el acceso al portapapeles (necesita conexión segura y el permiso del sitio). Revisa el permiso del navegador o usa el botón de descarga y adjunta la imagen a mano.',
  'asesor.errores.copiaTextoManual': 'El navegador no permitió copiar el prompt automáticamente, pero quedó seleccionado. Cópialo con Ctrl+C.',
  'asesor.errores.descargaFallo': 'No se pudo descargar la imagen. Inténtalo de nuevo; si es una imagen fija del producto, revisa tu conexión a internet.',
  'asesor.errores.imagenNoLegible': 'La imagen no se pudo leer para copiarla. Descárgala con el botón de descarga y adjúntala a mano en tu generador de imágenes.',

  // ---------- Administración (lo llena la tarea de las vistas de administración) ----------
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
