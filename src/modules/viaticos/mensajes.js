// src/modules/viaticos/mensajes.js
// Catálogo de mensajes explicativos: qué falló, la regla con sus números y cómo corregirlo.
// Sin dependencias: lo cargan también los servicios puros.
const MARCADOR_RE = /\{([A-Za-z_]+)\}/g;

const CATALOGO = Object.freeze({
  // ---- Validación general ----
  'validacion.revisar': 'Hay datos que no son válidos. Corrige los campos marcados e inténtalo de nuevo.',
  'validacion.cuerpo': 'Envía los datos como un objeto JSON en el cuerpo de la petición.',
  'campo.obligatorio': '«{etiqueta}» es obligatorio. Complétalo para continuar.',
  'campo.texto': '«{etiqueta}» debe ser un texto. Escríbelo como texto.',
  'campo.textoLargo': '«{etiqueta}» debe tener entre 1 y {max} caracteres (tiene {largo}). Acórtalo.',
  'campo.formato': '«{etiqueta}» no tiene el formato esperado: {regla} (recibido: {valor}). Corrígelo.',
  'campo.entero': '«{etiqueta}» debe ser un número entero entre {min} y {max} (recibido: {valor}). Escribe un entero dentro del rango.',
  'campo.decimalFormato': '«{etiqueta}» debe ser un número con hasta 2 decimales, escrito con punto (recibido: {valor}). Corrígelo.',
  'campo.decimalRango': '«{etiqueta}» debe ser {condicion} (recibido: {valor}). Escribe un número dentro de ese rango.',
  'campo.fecha': '«{etiqueta}» debe ser una fecha válida con formato AAAA-MM-DD, por ejemplo 2026-03-31 (recibido: {valor}). Corrígela.',
  'campo.booleano': '«{etiqueta}» debe ser verdadero o falso (true o false). Corrige ese valor.',
  'campo.id': '«{etiqueta}» no es un identificador válido (recibido: {valor}). Elige una opción de la lista.',

  // ---- Catálogos simples ----
  'catalogo.noExiste': 'No existe {articulo} con el identificador {id}. Recarga la lista e inténtalo de nuevo.',
  'catalogo.duplicado': 'Ya existe {articulo} con {detalle}. Usa otro valor o edita la que ya existe.',
  'pais.noExiste': 'El país elegido no existe. Elige uno de la lista de países.',

  // ---- Tramos ----
  'tramo.noExiste': 'No existe el tramo con el identificador {id}. Recarga la lista e inténtalo de nuevo.',
  'tramo.ubicacionNoExiste': 'La ubicación elegida como {rol} no existe. Elige una de la lista de ubicaciones.',
  'tramo.mismoLugar': 'El origen y el destino de un tramo deben ser distintos (elegiste «{nombre}» en ambos). Elige otra ubicación como destino.',
  'tramo.duplicado': 'Ya existe el tramo entre «{origen}» y «{destino}»: un tramo sirve en ambos sentidos. Edita el existente en lugar de crear otro.',

  // ---- Valores de comida ----
  'comida.lista': 'Envía «valores» como una lista de objetos con monedaId, tipoComidaId y valor. Corrige el formato y vuelve a guardar.',
  'comida.monedaNoExiste': 'La moneda {id} no existe. Recarga la matriz e inténtalo de nuevo.',
  'comida.tipoNoExiste': 'El tipo de comida {id} no existe. Recarga la matriz e inténtalo de nuevo.',
  'comida.repetido': 'La combinación de moneda {monedaId} y tipo de comida {tipoComidaId} aparece más de una vez. Deja una sola por celda.',

  // ---- Reglas de licencia ----
  'regla.noExiste': 'No existe esa regla de licencia. Recarga la lista e inténtalo de nuevo.',
  'regla.duplicada': 'Ya existe una regla para ese país, tipo de licencia y tipo de placa. Edita sus límites en lugar de crear otra.',
  'regla.tipoLicenciaNoExiste': 'El tipo de licencia elegido no existe. Elige uno de la lista.',
  'regla.tipoPlacaNoExiste': 'El tipo de placa elegido no existe. Elige uno de la lista.',
  'regla.placaOtroPais': 'El tipo de placa elegido pertenece a otro país. Elige un tipo de placa del país de la regla.',

  // ---- Vehículos ----
  'vehiculo.noExiste': 'No existe el vehículo con el identificador {id}. Recarga la lista e inténtalo de nuevo.',
  'vehiculo.duplicado': 'Ya existe un vehículo con la placa «{placa}» en ese país. Revisa la placa o edita el vehículo existente.',
  'vehiculo.placaOtroPais': 'El tipo de placa elegido pertenece a otro país distinto al del vehículo. Elige un tipo de placa del mismo país.',
  'vehiculo.tipoPlacaNoExiste': 'El tipo de placa elegido no existe. Elige uno de la lista.',
  'vehiculo.combustibleNoExiste': 'El combustible elegido no existe. Elige uno de la lista.',
  'vehiculo.propietarioNoExiste': 'El propietario elegido no existe. Elige un usuario de la lista o deja vacío si el vehículo es de la empresa.',
  'vehiculo.polizaIncompleta': 'La póliza necesita número y fecha de vencimiento a la vez. Completa los dos o deja ambos vacíos si el vehículo no tiene póliza.',

  // ---- Personas ----
  'persona.noExiste': 'No existe un usuario activo con el identificador {id}. Recarga la lista e inténtalo de nuevo.',
  'persona.licenciaIncompleta': 'La licencia necesita tipo, número y fecha de vencimiento a la vez. Completa los tres o déjalos vacíos para quitarla.',
  'persona.licenciaObjeto': '«Licencia» debe ser un objeto con tipoLicenciaId, numero y venceEl, o null para quitarla. Corrige el formato.',
  'persona.paisesLista': '«Países» debe ser una lista de identificadores de país, aunque quede vacía. Corrige el formato.',
  'persona.tipoLicenciaNoExiste': 'El tipo de licencia elegido no existe. Elige uno de la lista.',
  'persona.paisNoExiste': 'Uno de los países elegidos no existe. Recarga la lista de países e inténtalo de nuevo.',

  // ---- Ajustes ----
  'ajuste.noExiste': 'No existe el ajuste «{clave}». Elige uno de los ajustes disponibles: {disponibles}.',
  'ajuste.sinValor': 'Envía el nuevo valor del ajuste «{clave}» en el campo «valor».',
  'ajuste.faltante': 'Falta el ajuste «{clave}» en la tabla viaticos_ajustes. Aplica la migración «viaticos_semilla» (en desarrollo: npm run migrate; en staging y producción se aplica al iniciar el servidor).',
  'ajuste.lista': '«{clave}» debe ser una lista con al menos un tipo de archivo, sin repetidos, elegidos entre: {permitidos}. Corrígela.',
  'ajuste.entero': '«{clave}» debe ser un número entero entre {min} y {max} (recibido: {valor}). Escribe un entero dentro del rango.',

  // ---- Solicitudes: forma del payload ----
  'campo.fechaHora': '«{etiqueta}» debe ser una fecha y hora válidas con formato AAAA-MM-DD HH:mm, por ejemplo 2026-03-31 08:30 (recibido: {valor}). Corrígela.',
  'solicitud.modalidad': '«Modalidad» debe ser «mas_de_un_dia» o «hasta_un_dia» (recibido: {valor}). Elige una de las dos.',
  'solicitud.lista': '«{etiqueta}» debe ser una lista (puede ir vacía). Corrige el formato.',
  'solicitud.listaMaxima': '«{etiqueta}» admite como máximo {max} renglones (enviaste {cantidad}). Quita los que sobren.',
  'solicitud.renglon': 'Cada renglón de «{etiqueta}» debe ser un objeto con sus datos. Corrige el formato.',
  'solicitud.objeto': '«{etiqueta}» debe ser un objeto con sus datos. Corrige el formato.',
  'solicitud.noAplica': 'Un viaje de {modalidad} no admite «{etiqueta}». Quítalo de la solicitud.',
  'solicitud.tramosVacio': 'Agrega al menos un tramo a la ruta del viaje.',
  'solicitud.inspeccionFalta': 'Un viaje de 1 día o menos necesita la inspección del vehículo (odómetro, fluidos y kit). Complétala.',
  'solicitud.busquedaLarga': 'La búsqueda admite como máximo {max} caracteres (escribiste {largo}). Acórtala.',
  'solicitud.rangoFechas': 'El rango no es válido: «desde» ({desde}) no puede ser posterior a «hasta» ({hasta}). Corrige las fechas.',
  'solicitud.noExiste': 'No existe la solicitud con el identificador {id}. Recarga la lista e inténtalo de nuevo.',
  'solicitud.ajena': 'Esa solicitud pertenece a otra persona: solo puedes ver tus propias solicitudes.',
  'modalidad.texto.mas_de_un_dia': 'más de 1 día',
  'modalidad.texto.hasta_un_dia': '1 día o menos',

  // ---- Solicitudes: reglas de negocio ----
  'solicitud.sinPaises': 'No tienes ningún país asignado para solicitar viáticos. Pide a un administrador que te asigne uno.',
  'solicitud.paisNoAsignado': 'El país elegido no está entre los países que tienes asignados. Elige uno de tu lista o pide a un administrador que te lo asigne.',
  'solicitud.monedaNoExiste': 'La moneda elegida no existe. Elige una de la lista.',
  'solicitud.monedaInactiva': 'La moneda «{nombre}» está desactivada. Elige otra moneda activa.',
  'solicitud.motivoNoExiste': 'El motivo elegido no existe. Elige uno de la lista.',
  'solicitud.motivoInactivo': 'El motivo «{nombre}» está desactivado. Elige otro motivo activo.',
  'solicitud.vehiculoNoExiste': 'El vehículo elegido no existe. Elige uno de la lista.',
  'solicitud.vehiculoInactivo': 'El vehículo {placa} está desactivado. Elige otro vehículo.',
  'solicitud.vehiculoOtroPais': 'El vehículo {placa} pertenece a otro país distinto al de la solicitud. Elige un vehículo del país de la solicitud.',
  'solicitud.vehiculoAjeno': 'El vehículo {placa} es propiedad de otra persona. Elige un vehículo de la empresa o uno tuyo.',
  'solicitud.vehiculoPropioViajeCorto': 'Un viaje de 1 día o menos solo admite vehículos de la empresa, y {placa} es un vehículo propio. Elige uno de la empresa.',
  'solicitud.tarjetaVencida': 'La tarjeta de circulación del vehículo {placa} venció el {fecha} y un viaje de 1 día o menos no puede salir con ella vencida. Elige otro vehículo o renueva la tarjeta.',
  'solicitud.depreciacionObligatoria': '«Depreciación por km» es obligatoria con un vehículo propio y debe ser mayor que cero. Complétala.',
  'solicitud.licenciaFaltante': 'No tienes una licencia de conducir registrada, así que no puedes solicitar viáticos. Pide a un administrador que la registre.',
  'solicitud.licenciaVencida': 'Tu licencia venció el {fecha} (hoy es {hoy}) y no puedes solicitar viáticos con ella vencida. Renuévala y pide que actualicen tu registro.',
  'solicitud.licenciaNoSirve': 'Tu licencia tipo {tipo} no autoriza manejar el vehículo {placa} (placa tipo {tipoPlaca}) en {pais}. Elige un vehículo que tu licencia permita.',
  'solicitud.licenciaTonelaje': 'Tu licencia tipo {tipo} permite hasta {max} de tonelaje con placa {tipoPlaca} en {pais}, y el vehículo {placa} tiene {valor}. Elige otro vehículo.',
  'solicitud.licenciaTonelajeSinDato': 'La regla de licencias de {pais} limita el tonelaje a {max}, pero el vehículo {placa} no tiene tonelaje registrado. Pide que lo registren o elige otro vehículo.',
  'solicitud.licenciaPasajeros': 'Tu licencia tipo {tipo} permite hasta {max} pasajeros con placa {tipoPlaca} en {pais}, y el vehículo {placa} tiene {valor}. Elige otro vehículo.',
  'solicitud.licenciaPasajerosSinDato': 'La regla de licencias de {pais} limita los pasajeros a {max}, pero el vehículo {placa} no tiene pasajeros registrados. Pide que los registren o elige otro vehículo.',
  'solicitud.fechaPasada': '«{etiqueta}» ({fecha}) ya pasó y hoy es {hoy}. Elige hoy o una fecha futura.',
  'solicitud.horaPasada': 'La hora de salida ({fecha}) ya pasó y ahora son las {ahora}. Elige una hora posterior.',
  'solicitud.regresoAnterior': 'La fecha de regreso ({regreso}) debe ser posterior a la de salida ({salida}): un viaje de más de 1 día incluye al menos una noche fuera. Si regresas el mismo día, elige «1 día o menos».',
  'solicitud.traslape': 'Ya tienes la solicitud {correlativo} del {desde} al {hasta}, que se traslapa con estas fechas. Cambia las fechas o da de baja esa solicitud.',
  'solicitud.ubicacionNoExiste': 'La ubicación elegida en el tramo {numero} no existe. Elige una de la lista.',
  'solicitud.tramoMismoLugar': 'El tramo {numero} sale y llega a «{nombre}». Elige un destino distinto del origen.',
  'solicitud.tramoNoExiste': 'No hay una ruta registrada entre «{origen}» y «{destino}» (tramo {numero}). Elige un destino con ruta o pide que registren el tramo.',
  'solicitud.tramoInactivo': 'La ruta entre «{origen}» y «{destino}» (tramo {numero}) está desactivada. Elige otro destino o pide que la activen.',
  'solicitud.tramoEncadenado': 'El tramo {numero} debe salir de «{esperado}», donde terminó el tramo anterior, y sale de «{origen}». Corrige el origen.',
  'solicitud.comidaFueraDeFechas': 'La comida del {fecha} cae fuera del viaje ({salida} al {regreso}). Marca solo días dentro del viaje.',
  'solicitud.comidaRepetida': 'El {comida} del {fecha} está marcado más de una vez. Déjalo una sola vez.',
  'solicitud.tipoComidaNoExiste': 'El tipo de comida elegido no existe. Elige uno de la lista.',
  'solicitud.comidaSinValor': 'Falta configurar el valor del {comida} en {moneda}. Pide a un administrador que lo cargue en Configuración y vuelve a calcular.',
  'solicitud.tipoGastoNoExiste': 'El tipo de gasto elegido no existe. Elige uno de la lista.',
  'solicitud.tipoGastoNoSeleccionable': 'El tipo de gasto «{nombre}» no se puede usar en «Otros gastos». Elige otro tipo.',
  'solicitud.tipoGastoInactivo': 'El tipo de gasto «{nombre}» está desactivado. Elige otro tipo.',
  'solicitud.fluidoNoExiste': 'El fluido elegido no existe. Elige uno de la lista.',
  'solicitud.fluidoRepetido': 'El nivel de «{fluido}» está registrado más de una vez. Déjalo una sola vez.',
  'solicitud.fluidoFaltante': 'Falta registrar el nivel de «{fluido}». Completa todos los fluidos.',
  'solicitud.nivelNoExiste': 'El nivel elegido para el fluido no existe. Elige uno de la lista.',
  'solicitud.nivelNoAplica': 'El nivel «{nivel}» no es válido para «{fluido}». Elige otro nivel.',
  'solicitud.kitNoExiste': 'El elemento del kit de emergencia elegido no existe. Elige uno de la lista.',
  'solicitud.kitRepetido': 'El elemento «{item}» del kit está registrado más de una vez. Déjalo una sola vez.',
  'solicitud.defectoNoExiste': 'El tipo de defecto elegido no existe. Elige uno de la lista.',
  'solicitud.defectoInactivo': 'El tipo de defecto «{nombre}» está desactivado. Elige otro tipo.',
  'solicitud.defectoDescripcion': 'Describe el defecto «{nombre}» (hasta {max} caracteres): con el tipo «otros» la descripción es obligatoria.',

  // ---- Solicitudes: guardado ----
  'solicitud.datosFalta': 'Envía los datos de la solicitud en el campo «datos» (JSON) o como cuerpo JSON.',
  'solicitud.datosJson': 'El campo «datos» no es un JSON válido. Corrige el formato e inténtalo de nuevo.',
  'solicitud.llaveIdempotencia': 'La clave de reintento («idempotencyKey») debe ser un texto de 1 a {max} caracteres. Corrígela o no la envíes.',
  'solicitud.noModificable': 'La solicitud {correlativo} está «{estado}» y ya no se puede modificar: solo se modifica mientras espera autorización, está rechazada o venció.',
  'solicitud.noSeDaDeBaja': 'La solicitud {correlativo} está «{estado}» y ya no se puede dar de baja: solo se da de baja mientras espera autorización, está rechazada o venció.',
  'archivo.ajustesFaltan': 'Los ajustes de archivos del módulo no están configurados. Avisa a un administrador.',
  'archivo.tipoNoPermitido': 'El archivo «{nombre}» es de un tipo no permitido ({tipo}). Sube uno de estos tipos: {permitidos}.',
  'archivo.contenidoNoCoincide': 'El contenido del archivo «{nombre}» no corresponde al tipo {tipo}. Súbelo de nuevo en un formato válido.',
  'archivo.demasiadoGrande': 'El archivo «{nombre}» pesa {tamano} MB y el máximo permitido es {max} MB. Reduce su tamaño y vuelve a subirlo.',
  'archivo.dimensiones': 'La imagen «{nombre}» tiene dimensiones demasiado grandes o no se puede leer. Sube una foto de menor resolución.',
  'defecto.sinArchivo': 'El defecto {numero} no tiene foto en la posición {indice} del campo «defectos». Adjunta una foto por cada defecto.',
  'defecto.archivoRepetido': 'La foto en la posición {indice} está asignada a más de un defecto. Cada defecto lleva su propia foto.',
  'defecto.archivoSobrante': 'Adjuntaste {cantidad} fotos pero solo {usadas} están asignadas a un defecto. Quita las que sobran o registra su defecto.',
  'defecto.archivosSinInspeccion': 'Un viaje de más de 1 día no lleva fotos de defectos. Quita los archivos adjuntos.',

  // ---- Notificaciones y documentos ----
  'notificacion.solicitudNueva': 'Nueva solicitud de viáticos {correlativo} de {solicitante}: espera tu autorización.',
  'notificacion.solicitudModificada': 'La solicitud de viáticos {correlativo} de {solicitante} fue modificada y espera tu autorización.',
  'notificacion.solicitudAutorizada': 'Tu solicitud {correlativo} fue autorizada.',
  'notificacion.solicitudRechazada': 'Tu solicitud {correlativo} fue rechazada. Motivo: {motivo}',
  'documento.tituloPdf': 'Solicitud {correlativo}',
  'documento.tituloDefecto': 'Defecto {numero}: {tipo}',

  // ---- Gestiones ----
  'gestion.etiquetaMotivo': 'Motivo del rechazo',
  'gestion.motivoObligatorio': 'Escribe el motivo del rechazo (entre 1 y {max} caracteres): el solicitante lo leerá para saber qué corregir.',
  'gestion.noSeAutoriza': 'La solicitud {correlativo} está «{estado}» y no se puede autorizar: solo se autoriza mientras espera autorización y antes de la fecha de salida. Si venció o fue rechazada, el solicitante debe modificarla para que vuelva a esperar autorización.',
  'gestion.noSeRechaza': 'La solicitud {correlativo} está «{estado}» y no se puede rechazar: solo se rechaza mientras espera autorización y antes de la fecha de salida. Si venció o ya fue decidida, no hay nada que rechazar.',

  // ---- Solicitudes: advertencias (salvedades) ----
  'advertencia.licenciaVence': 'Tu licencia vence el {fecha}, antes de que termine el viaje. Puedes continuar; quedará como salvedad en el PDF.',
  'advertencia.tarjetaVence': 'La tarjeta de circulación del vehículo {placa} vence el {fecha}, antes de que termine el viaje. Puedes continuar; quedará como salvedad en el PDF.',
  'advertencia.tarjetaVencida': 'La tarjeta de circulación del vehículo {placa} venció el {fecha}. Puedes continuar; quedará como salvedad en el PDF.',
  'advertencia.seguroVence': 'El seguro del vehículo {placa} vence el {fecha}, antes de que termine el viaje. Puedes continuar; quedará como salvedad en el PDF.',
  'advertencia.seguroVencido': 'El seguro del vehículo {placa} venció el {fecha}. Puedes continuar; quedará como salvedad en el PDF.',

  // ---- PDF de la solicitud ----
  'pdf.textoInvalido': 'Se están usando caracteres que el PDF no puede dibujar en «{etiqueta}» ({caracteres}). Quítalos e inténtalo de nuevo.',
  'pdf.titulo': 'SOLICITUD DE VIÁTICOS',
  'pdf.tituloReferencia': 'VALE DE ARTE',
  'pdf.subtitulo': 'MundiTrofeos S.A. · Generado {fecha}',
  'pdf.correlativo': 'CORRELATIVO',
  'pdf.secSolicitante': 'INFORMACIÓN DEL SOLICITANTE',
  'pdf.secVehiculo': 'INFORMACIÓN DEL VEHÍCULO',
  'pdf.secViaje': 'INFORMACIÓN DEL VIAJE',
  'pdf.solicitante': 'SOLICITANTE',
  'pdf.puesto': 'PUESTO',
  'pdf.licencia': 'LICENCIA',
  'pdf.vehiculo': 'VEHÍCULO',
  'pdf.placa': 'PLACA',
  'pdf.poliza': 'NO. DE PÓLIZA',
  'pdf.combustible': 'COMBUSTIBLE',
  'pdf.empresarial': 'EMPRESARIAL',
  'pdf.fechaSalida': 'FECHA DE SALIDA',
  'pdf.fechaRegreso': 'FECHA DE REGRESO',
  'pdf.fechaHoraSalida': 'FECHA Y HORA DE SALIDA',
  'pdf.motivo': 'MOTIVO DEL VIAJE',
  'pdf.si': 'Sí',
  'pdf.no': 'No',
  'pdf.siMayusculas': 'SÍ',
  'pdf.noMayusculas': 'NO',
  'pdf.ruta': 'RUTA Y KILOMETRAJE',
  'pdf.colNumero': 'N.º',
  'pdf.colOrigenDestino': 'ORIGEN Y DESTINO',
  'pdf.colHoras': 'HORAS',
  'pdf.colKm': 'KM',
  'pdf.combustibleTitulo': 'COMBUSTIBLE',
  'pdf.depreciacion': 'DEPRECIACIÓN',
  'pdf.hospedaje': 'HOTEL Y HOSPEDAJE',
  'pdf.colHotel': 'HOTEL',
  'pdf.colLugar': 'LUGAR',
  'pdf.colNoches': 'NOCHES',
  'pdf.colValorNoche': 'VALOR NOCHE',
  'pdf.colTotal': 'TOTAL',
  'pdf.comidas': 'COMIDAS',
  'pdf.otrosGastos': 'OTROS GASTOS',
  'pdf.colTipo': 'TIPO',
  'pdf.colDescripcion': 'DESCRIPCIÓN',
  'pdf.colMonto': 'MONTO',
  'pdf.totalSolicitado': 'TOTAL SOLICITADO',
  'pdf.fluidos': 'NIVEL DE FLUIDOS',
  'pdf.odometro': 'LECTURA ODÓMETRO',
  'pdf.kit': 'KIT DE EMERGENCIA',
  'pdf.defectos': 'DEFECTOS ENCONTRADOS',
  'pdf.colImagen': 'IMAGEN',
  'pdf.imagenes': 'IMÁGENES DE DEFECTOS',
  'pdf.imagenNoDisponible': 'Imagen no disponible',
  'pdf.sinRegistros': 'Sin registros',
  'pdf.salvedades': 'SALVEDADES',
  'pdf.tomarEnCuenta': 'TOMAR EN CUENTA',
  'pdf.firmaSolicitante': 'SOLICITANTE',
  'pdf.firmaAdministracion': 'ADMINISTRACIÓN',
  'pdf.calcCombustible': '({km} km / {rendimiento} km/gal) × {precio} = {importe}',
  'pdf.calcDepreciacion': '{km} km × {tasa} = {importe}',
  'pdf.lineaComida': '{cantidad} {nombre} × {valor} = {total}',
  'pdf.unidadHoras': '{horas} h',
  'pdf.unidadKm': '{km} km',
  'pdf.licenciaValor': '{tipo} · {numero}',
  'pdf.vehiculoValor': '{marca} {modelo} {anio}',
  'pdf.comida.desayuno': 'Desayunos',
  'pdf.comida.almuerzo': 'Almuerzos',
  'pdf.comida.cena': 'Cenas',

  // ---- Pipeline ----
  'pipeline.paso.autorizacion': 'Esperando autorización',
  'pipeline.paso.autorizado': 'Autorizado',
  'pipeline.paso.enCurso': 'En curso',
  'pipeline.paso.terminado': 'Terminado',
  'pipeline.paso.liquidado': 'Liquidado',
  'pipeline.estado.esperando': 'Esperando autorización',
  'pipeline.estado.vencida': 'Vencida',
  'pipeline.estado.rechazada': 'Rechazada',
  'pipeline.estado.autorizada': 'Autorizado',
  'pipeline.estado.en_curso': 'En curso',
  'pipeline.estado.terminada': 'Terminado',
  'pipeline.estado.liquidada': 'Liquidado',
  'pipeline.detalle.esperando': 'Pendiente de autorización',
  'pipeline.detalle.vencida': 'Sin autorizar al iniciar el viaje',
  'pipeline.detalle.rechazada': 'Motivo: {motivo}',
  'pipeline.detalle.rechazadaSinMotivo': 'Rechazada sin motivo registrado',
  'pipeline.detalle.autorizadaInicia': 'Inicia el {fecha}',
  'pipeline.detalle.autorizadaViaja': 'Viaja el {fecha}',
  'pipeline.detalle.en_curso': 'Termina el {fecha}',
  'pipeline.detalle.terminada': 'Pendiente de liquidar',
  'pipeline.detalle.liquidada': 'Liquidado el {fecha}',
  'pipeline.detalle.liquidadaSinFecha': 'Liquidado'
});

// Una sola pasada: un valor que contenga «{x}» no se vuelve a interpretar. Un marcador sin valor es un error del programa.
function rellenar(texto, params = {}) {
  return String(texto).replace(MARCADOR_RE, (_, nombre) => {
    if (!Object.prototype.hasOwnProperty.call(params, nombre)) throw new Error(`Falta el valor del marcador {${nombre}}.`);
    return String(params[nombre]);
  });
}

function msg(clave, params = {}) {
  if (!Object.prototype.hasOwnProperty.call(CATALOGO, clave)) throw new Error(`El mensaje «${clave}» no existe en mensajes.js.`);
  try {
    return rellenar(CATALOGO[clave], params);
  } catch (error) {
    throw new Error(`Mensaje «${clave}»: ${error.message}`);
  }
}

module.exports = { msg, rellenar, CATALOGO };
