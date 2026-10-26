// src/modules/prompts/mensajes.js
// Catálogo de mensajes explicativos: qué falló (con la etiqueta del campo), la regla con sus números y cómo corregirlo.
// Sin dependencias: lo cargan también los servicios puros.
const MARCADOR_RE = /\{([A-Za-z_]+)\}/g; // los marcadores del catálogo pueden ir en camelCase

const CATALOGO = Object.freeze({
  // ---- Ajustes ----
  'ajuste.noExiste': 'No existe el ajuste «{clave}». Elige uno de los ajustes disponibles: {disponibles}.',
  'ajuste.sinValor': 'Envía el nuevo valor del ajuste «{clave}» en el campo «valor».',
  'ajuste.faltante': 'Falta el ajuste «{clave}» en la tabla prompt_ajustes. Aplica la migración «prompts_ajustes» (en desarrollo: npm run migrate; en staging y producción se aplica al iniciar el servidor).',
  'ajuste.texto': 'El texto «{clave}» debe tener entre 1 y {max} caracteres. Escríbelo dentro de ese largo.',
  'ajuste.objeto': '«{clave}» debe ser un objeto con estos textos: {claves}. Envía un objeto con todos ellos.',
  'ajuste.subtextoFalta': 'Falta el texto «{subclave}» dentro de «{clave}». Agrégalo para poder guardar.',
  'ajuste.subtextoDesconocido': '«{clave}» trae «{subclave}», que no existe. Quítalo o usa uno de los valores válidos: {validas}.',
  'ajuste.subtextoTipo': '«{clave}.{subclave}» debe ser un texto de 1 a {max} caracteres. Corrígelo.',
  'ajuste.subtextoTipoVacio': '«{clave}.{subclave}» debe ser un texto de hasta {max} caracteres (puede quedar vacío). Corrígelo.',
  'ajuste.marcadorFalta': 'El texto «{subclave}» debe incluir el marcador {marcador}. Agrégalo en el lugar donde deba insertarse el dato.',
  'ajuste.marcadorDesconocido': 'El texto «{subclave}» usa el marcador {marcador}, que no existe. Marcadores válidos: {validos}. Cámbialo por uno de ellos.',
  'ajuste.llaveSuelta': 'El texto «{subclave}» tiene una llave «{» o «}» sin cerrar o mal escrita. Un marcador va con llaves simples y solo minúsculas o guion bajo (marcadores válidos: {validos}); corrige la llave.',
  'ajuste.limiteDesconocido': '«limites» trae «{subclave}», que no existe. Quítalo o usa uno de los límites válidos: {validas}.',
  'ajuste.limiteFalta': 'Falta el límite «{subclave}» dentro de «limites». Agrégalo para poder guardar.',
  'ajuste.limiteEntero': 'El límite «{subclave}» debe ser un número entero de 1 en adelante (recibido: {valor}). Escribe un entero válido.',
  'ajuste.limiteTope': 'El límite «{defecto}» ({valorDefecto}) no puede superar «{tope}» ({valorTope}). Baja el primero o sube el segundo.',
  'ajuste.limiteMaximo': 'El límite «{subclave}» ({valor}) no puede superar {maximo}: {motivo}. Escribe un valor menor o igual.',
  'ajuste.limiteRango': 'El límite «{subclave}» debe estar entre {min} y {max} (recibido: {valor}). Escribe un valor dentro del rango.',
  'ajuste.formatosVacio': '«formatos_imagen» debe tener al menos un formato de imagen. Agrega uno, por ejemplo png.',
  'ajuste.formatoClave': 'La clave de formato «{formato}» no es válida: usa de 2 a 10 minúsculas o números. Corrígela.',
  'ajuste.formatoExtensiones': 'El formato «{formato}» necesita una lista «extensiones» con al menos una extensión en minúsculas y sin punto (por ejemplo: jpg).',
  'ajuste.formatoMime': 'El formato «{formato}» necesita un «mime» que empiece por image/ (por ejemplo: image/png); se recibió «{valor}». Corrígelo.',

  // ---- Estructura del esquema (pestaña Parámetros) ----
  'esquema.noObjeto': 'El esquema del producto debe ser un objeto con una lista de grupos. Recarga la pestaña Parámetros e inténtalo de nuevo.',
  'esquema.version': 'La versión de esquema {version} no está soportada: solo se admite la 1. Corrige «esquema_version» o quítalo.',
  'esquema.sinGrupos': 'El esquema debe tener una lista de «grupos» (puede estar vacía). Agrega «grupos» al esquema en la pestaña Parámetros.',
  'grupo.noValido': 'El grupo {numero} no es válido: cada grupo debe ser un objeto con clave, etiqueta y lista de parámetros. Revisa el grupo {numero} en la pestaña Parámetros.',
  'grupo.clave': 'La clave del grupo {numero} no es válida (recibida: {valor}): debe empezar con una letra minúscula y usar solo minúsculas, números y guion bajo (2 a 60 caracteres). Corrígela, por ejemplo: datos_del_cliente.',
  'grupo.claveDerivada': 'La clave de grupo «{clave}» coincide con la variable «{variable}», que el sistema genera para {origen}. Los nombres «grupo_<clave>_vacio» y «recurso_<clave>» están reservados; cambia la clave del grupo.',
  'esquema.origenGrupoVacio': 'indicar si el grupo «{grupo}» está vacío',
  'esquema.origenRecurso': 'insertar el recurso «{recurso}»',
  'grupo.claveRepetida': 'La clave de grupo «{clave}» está repetida: la usan dos grupos. Cada grupo necesita una clave distinta; cambia una de las dos.',
  'grupo.etiqueta': 'El grupo {numero} necesita una etiqueta: es el título que verá el asesor. Escríbela en el campo «Etiqueta» del grupo.',
  'grupo.parametros': 'El grupo {numero} necesita una lista de parámetros (puede estar vacía). Agrega «parametros» a ese grupo.',
  'param.noValido': 'El parámetro {numero} no es válido: cada parámetro debe ser un objeto con clave, etiqueta y tipo. Revisa el parámetro {numero} en la pestaña Parámetros.',
  'param.clave': 'La clave del parámetro {numero} no es válida (recibida: {valor}): debe empezar con una letra minúscula y usar solo minúsculas, números y guion bajo (2 a 60 caracteres). Corrígela, por ejemplo: frente_imagenes.',
  'param.reservada': 'La clave «{clave}» no se puede usar en un parámetro: es una variable reservada del sistema (reservadas: {reservadas}). Elige otra clave.',
  'param.claveDerivada': '{parametro}: su clave coincide con la variable «{variable}», que el sistema genera para {origen}. Los nombres «grupo_<clave>_vacio» y «recurso_<clave>» están reservados; cambia la clave del parámetro.',
  'param.claveRepetida': 'La clave «{clave}» está repetida: ya la usa otro parámetro. Cada parámetro necesita una clave única en todo el producto; cambia una de las dos.',
  'param.ciclo': '{parametro}: las condiciones «visible_si» forman un ciclo y ninguno de los parámetros implicados llegaría a mostrarse. Quita o cambia una de las condiciones.',

  // ---- Parámetros ----
  'param.etiqueta': '{parametro}: falta la etiqueta, que es el nombre que verá el asesor en el formulario. Escríbela.',
  'param.requerido': '{parametro}: «requerido» debe ser verdadero o falso. Corrige ese valor.',
  'param.ayuda': '{parametro}: la ayuda debe ser un texto. Escríbela como texto o déjala vacía.',
  'param.visibleSiForma': '{parametro}: «visible_si» debe indicar «parametro» (cuál se consulta) e «igual» (el valor que lo muestra). Complétalo o quita la condición.',
  'param.visibleSiNoExiste': '{parametro}: «visible_si» apunta a «{destino}», que no existe en el esquema. Elige un parámetro existente o quita la condición.',
  'param.visibleSiMismo': '{parametro}: «visible_si» no puede apuntar al mismo parámetro, porque nunca se mostraría. Elige otro parámetro para la condición.',
  'param.maxLargo': '{parametro}: «max_largo» debe ser un entero entre 1 y {tope} (recibido: {valor}). Corrígelo.',
  'param.separador': '{parametro}: «separador» debe ser un texto de 1 a {max} caracteres. Corrígelo.',
  'param.minTipo': '{parametro}: «min» debe ser un número. Escribe un número o déjalo vacío.',
  'param.maxTipo': '{parametro}: «max» debe ser un número. Escribe un número o déjalo vacío.',
  'param.minMayorQueMax': '{parametro}: «min» ({min}) no puede ser mayor que «max» ({max}). Corrige uno de los dos.',
  'param.defectoNumero': '{parametro}: «defecto» debe ser un número. Escribe un número o quita el defecto.',
  'param.defectoFueraDeRango': '{parametro}: «defecto» ({defecto}) está fuera del rango que marcan «min» y «max». Elige un valor dentro del rango.',
  'param.unidadNoExiste': '{parametro}: «unidad_de» apunta a «{destino}», que no existe. Elige un parámetro de tipo «opciones» existente o quita «unidad_de».',
  'param.unidadMismo': '{parametro}: «unidad_de» no puede apuntar al mismo parámetro. Elige el parámetro de tipo «opciones» que contiene las unidades.',
  'param.unidadTipo': '{parametro}: «unidad_de» debe apuntar a un parámetro de tipo «opciones», y «{destino}» es de tipo «{tipo}». Elige un parámetro de opciones.',
  'param.opcionesVacio': '{parametro}: necesita al menos una opción. Agrega las opciones entre las que podrá elegir el asesor.',
  'param.opcionValor': '{parametro}: cada opción necesita un «valor». Completa el valor de las opciones que lo tengan vacío.',
  'param.opcionRepetida': '{parametro}: el valor «{valor}» está repetido entre las opciones. Cada opción necesita un valor distinto.',
  'param.opcionEtiqueta': '{parametro}: la opción «{valor}» necesita una etiqueta, que es el texto que verá el asesor. Escríbela.',
  'param.opcionTexto': '{parametro}: la opción «{valor}» necesita «texto_prompt», el texto que se escribe en el prompt cuando se elige. Complétalo.',
  'param.defectoOpcion': '{parametro}: «defecto» debe ser el valor de una de sus opciones. Elige una opción existente o quita el defecto.',
  'param.defectoBooleano': '{parametro}: «defecto» debe ser verdadero o falso. Corrige ese valor o quita el defecto.',
  'param.imagenesMax': '{parametro}: «max» debe ser un entero entre 1 y {tope}. Corrígelo.',
  'param.imagenesMb': '{parametro}: «max_mb» debe estar entre 1 y {tope}. Corrígelo.',
  'param.formatos': '{parametro}: «formatos» debe ser una lista con valores de: {validos}. Corrígela.',
  'param.lista': '{parametro}: «{campo}» debe ser una lista de hasta {max} textos. Quita los que sobren.',
  'param.listaElemento': '{parametro}: cada elemento de «{campo}» debe tener entre 1 y {max} caracteres. Acorta o completa los que no cumplan.',
  'param.listaRepetido': '{parametro}: «{campo}» tiene el texto «{texto}» repetido. Quita el duplicado.',
  'param.igualANoExiste': '{parametro}: «igual_a» apunta a «{destino}», que no existe. Elige el parámetro del que toma su valor.',
  'param.igualAMismo': '{parametro}: «igual_a» no puede apuntar al mismo parámetro. Elige el parámetro del que toma su valor.',
  'param.tipoInvalido': '{parametro}: el tipo «{tipo}» no es válido. Elige uno de estos: {tipos}.',

  // ---- Recursos fijos (pestaña Recursos) ----
  'recurso.lista': '«recursos» debe ser una lista de hasta {max} recursos; este producto tiene {total}. Quita los que no uses o aumenta el límite «recursos_max» en los ajustes.',
  'recurso.invalido': 'El recurso {numero} no es válido: debe tener clave, etiqueta, URL, posición y «activo». Complétalo en la pestaña Recursos.',
  'recurso.claveInvalida': 'La clave del recurso {numero} no es válida. Usa minúsculas, números y guion bajo, de 2 a 60 caracteres, empezando con letra.',
  'recurso.claveReservada': 'La clave «{clave}» del recurso «{recurso}» es una variable reservada del sistema. Elige otra clave.',
  'recurso.claveRepetida': 'La clave «{clave}» del recurso «{recurso}» ya la usa un parámetro u otro recurso. Cada clave debe ser única en el producto; cámbiala por otra.',
  'recurso.choqueVariable': 'El parámetro «{variable}» usa el nombre de la variable que genera el recurso «{recurso}». Cambia la clave del parámetro o la del recurso.',
  'recurso.claveDerivada': 'La clave «{clave}» del recurso «{recurso}» coincide con la variable «{variable}», que el sistema genera para {origen}. Los nombres «grupo_<clave>_vacio» y «recurso_<clave>» están reservados; cambia la clave del recurso.',
  'recurso.etiqueta': 'El recurso «{recurso}» necesita una etiqueta de 1 a {max} caracteres. Escríbela o acórtala.',
  'recurso.descripcion': 'La descripción del recurso «{recurso}» debe ser un texto de hasta {max} caracteres; se escribe en la lista de imágenes del prompt. Acórtala.',
  'recurso.posicion': 'La posición del recurso «{recurso}» debe ser «inicio» (antes de las imágenes del asesor) o «fin» (después); se recibió «{valor}». Elige una de las dos.',
  'recurso.activoTipo': 'El campo «activo» del recurso «{recurso}» debe ser verdadero o falso. Corrige ese valor.',
  'recurso.urlTipo': 'La URL del recurso «{recurso}» debe ser un texto (déjala vacía si aún no la tienes y desactiva el recurso).',
  'recurso.activoSinUrl': 'El recurso «{recurso}» está activo pero no tiene URL. Pega la URL pública de la imagen en Supabase o desactívalo.',
  'recurso.activoUrlInvalida': 'El recurso «{recurso}» está activo pero su URL «{url}» no es válida. Usa una dirección que empiece por https:// o por /assets/, o desactiva el recurso.',

  // ---- Plantilla (pestaña Plantilla) ----
  'plantilla.vacia': 'La plantilla está vacía. Escribe en la pestaña Plantilla el texto del prompt, usando las variables de los parámetros.',
  'plantilla.larga': 'La plantilla no puede superar {max} caracteres (tiene {largo}). Acórtala.',
  'plantilla.llaveSuelta': 'Hay una llave doble «{abre}» o «{cierra}» sin cerrar o mal escrita en la plantilla. Cada variable debe tener la forma «{ejemplo}»; corrige la llave.',
  'plantilla.variableNoExiste': 'La variable «{variable}» no existe: no es la clave de un parámetro ni una variable del sistema ({sistema}). Corrige el nombre o crea el parámetro en la pestaña Parámetros.',
  'plantilla.recursoDesconocido': 'La variable «{variable}» no existe: el producto no tiene un recurso con la clave «{clave}». Recursos disponibles: {disponibles}. Agrega el recurso en la pestaña Recursos o corrige el nombre.',
  'plantilla.grupoDesconocido': 'La variable «{variable}» apunta al grupo «{grupo}», que no existe. Grupos disponibles: {disponibles}. Corrige el nombre o crea el grupo.',
  'plantilla.anidado': 'No se pueden anidar bloques: «{interno}» está dentro de «{externo}». Cierra el bloque «{externo}» antes de abrir otro.',
  'plantilla.cierreSinApertura': 'El cierre «{cierre}» no tiene un bloque abierto antes. Abre el bloque (por ejemplo «{ejemplo}») o quita el cierre.',
  'plantilla.cierreDistinto': 'El bloque «{apertura}» se cierra con «{cierre}», que no le corresponde. Ciérralo con «{esperado}».',
  'plantilla.etiquetaInvalida': 'La etiqueta «{etiqueta}» no es válida: entre llaves dobles solo van una clave en minúsculas (por ejemplo «{ejVariable}») o un bloque condicional («{ejBloque}» … «{ejCierre}»). Corrígela.',
  'plantilla.bloqueSinCerrar': 'El bloque «{apertura}» no está cerrado. Agrega «{cierre}» donde termine el bloque.',

  // ---- Productos y versiones (administración) ----
  'producto.revisar': 'Revisa los datos del producto: hay campos con errores. Corrígelos y vuelve a guardar.',
  'producto.codigo': 'El código del producto no es válido (recibido: {valor}): debe empezar con una letra minúscula y usar solo minúsculas, números y guion bajo (2 a 50 caracteres). Corrígelo, por ejemplo: medalla_dorada.',
  'producto.nombre': 'El nombre del producto es obligatorio y no puede superar {max} caracteres (tiene {largo}). Escríbelo o acórtalo.',
  'producto.descripcion': 'La descripción del producto no puede superar {max} caracteres (tiene {largo}). Acórtala.',
  'producto.codigoRepetido': 'Ya existe un producto con el código «{codigo}». Elige un código distinto.',
  'producto.noEncontrado': 'No se encontró el producto: pudo haber sido eliminado. Vuelve a la lista de productos y recarga la página.',
  'producto.yaTieneBorrador': 'El producto ya tiene un borrador. Edita ese borrador o descártalo antes de crear otro.',
  'producto.sinPublicada': 'El producto no tiene una versión publicada para copiar. Publica primero su borrador.',
  'producto.estadoInvalido': 'El estado del producto no es válido (recibido: {valor}). Usa «activo» o «inactivo».',
  'producto.activarSinPublicada': 'No se puede activar el producto porque no tiene una versión publicada. Publica una versión y vuelve a activarlo.',
  'version.sinBorrador': 'El producto no tiene borrador. Crea un borrador desde la versión publicada para poder editarlo.',
  'version.revisarBorrador': 'Revisa el borrador: tiene datos que no se pueden guardar. Corrige los campos indicados y vuelve a guardar.',
  'version.plantillaTexto': 'La plantilla debe ser un texto. Escríbela en la pestaña Plantilla y vuelve a guardar.',
  'version.borradorDesaparecido': 'El borrador ya no existe: alguien lo publicó o lo descartó mientras lo editabas. Recarga la página para ver el estado actual.',
  'version.unicaVersion': 'No se puede descartar el borrador porque es la única versión del producto. Publícalo o sigue editándolo.',
  'version.sinBorradorParaPublicar': 'El producto no tiene un borrador para publicar. Crea un borrador desde la versión publicada y vuelve a intentarlo.',
  'version.errores': 'El borrador tiene errores y no se puede publicar. Corrige los campos indicados y vuelve a publicar.',
  'version.sinParametros': 'Agrega al menos un parámetro: un producto sin parámetros no se puede publicar. Crea un grupo y un parámetro en la pestaña Parámetros.',

  // ---- Valores del asesor ----
  'valor.valoresObjeto': 'Los valores del formulario deben enviarse como un objeto, un dato por parámetro. Recarga el formulario e inténtalo de nuevo.',
  'valor.imagenesObjeto': 'Las imágenes del formulario deben enviarse como un objeto, una lista por parámetro. Recarga el formulario e inténtalo de nuevo.',
  'valor.desconocido': 'El dato «{clave}» no corresponde a ningún parámetro de este producto. Recarga el formulario: puede haber cambiado.',
  'valor.imagenesEnValores': '«{etiqueta}» es un parámetro de imágenes: sus archivos se envían en «imagenes», no en «valores». Recarga el formulario e inténtalo de nuevo.',
  'valor.imagenesDesconocido': 'Las imágenes enviadas en «{clave}» no corresponden a ningún parámetro de imágenes de este producto. Recarga el formulario: puede haber cambiado.',
  'valor.obligatorio': '«{etiqueta}» es obligatorio. Complétalo para continuar.',
  'valor.texto': '«{etiqueta}» debe ser un texto. Escribe el dato como texto.',
  'valor.textoLargo': '«{etiqueta}» no puede superar {max} caracteres (tiene {largo}). Acórtalo.',
  'valor.numero': '«{etiqueta}» debe ser un número. Escribe solo un número, con punto si lleva decimales.',
  'valor.rangoEntre': '«{etiqueta}» debe estar entre {min} y {max} (recibido: {valor}). Escribe un número dentro del rango.',
  'valor.rangoMinimo': '«{etiqueta}» no puede ser menor que {min} (recibido: {valor}). Escribe un número mayor o igual.',
  'valor.rangoMaximo': '«{etiqueta}» no puede ser mayor que {max} (recibido: {valor}). Escribe un número menor o igual.',
  'valor.opcion': 'La opción enviada para «{etiqueta}» no existe (recibido: {valor}). Elige una de estas: {permitidas}.',
  'valor.siNo': '«{etiqueta}» debe ser sí o no. Marca o desmarca la casilla.',
  'valor.imagenesLista': '«{etiqueta}» debe enviarse como una lista de imágenes. Vuelve a adjuntar las imágenes e inténtalo de nuevo.',
  'valor.imagenesMax': '«{etiqueta}» admite hasta {max} imágenes y enviaste {total}. Quita {sobran}.',
  'valor.imagenesObligatorio': '«{etiqueta}» es obligatorio: agrega al menos una imagen.',
  'valor.imagenForma': 'Una imagen de «{etiqueta}» no tiene el formato esperado: cada imagen necesita un nombre y puede llevar descripción y ubicación. Quítala y vuelve a adjuntarla.',
  'valor.imagenNombre': 'Cada nombre de imagen de «{etiqueta}» debe tener entre 1 y {max} caracteres. Renombra el archivo que no cumpla.',
  'valor.imagenFormato': 'La imagen «{nombre}» de «{etiqueta}» tiene un formato no permitido. Usa uno de estos: {permitidas}.',
  'valor.imagenDescripcionTipo': 'La descripción de la imagen «{nombre}» debe ser un texto. Escríbela como texto o déjala vacía.',
  'valor.imagenDescripcion': 'La descripción de la imagen «{nombre}» no puede superar {max} caracteres (tiene {largo}). Acórtala.',
  'valor.imagenUbicacion': 'La ubicación de la imagen «{nombre}» de «{etiqueta}» no es una de las permitidas (recibida: {valor}). Elige una de estas: {permitidas}.',

  // ---- Lado del asesor ----
  'asesor.usuarioNoEncontrado': 'No se encontró tu usuario en el sistema. Cierra sesión e inicia de nuevo; si persiste, avisa al administrador.',
  'asesor.productoNoDisponible': 'El producto no está disponible: pudo desactivarse o no tener una versión publicada. Actualiza la lista de productos y elige otro.',
  'asesor.revisarFormulario': 'Hay datos del formulario que no son válidos. Corrige los campos marcados e inténtalo de nuevo.',
  'asesor.sinTelefono': 'Tu perfil no tiene teléfono, así que el prompt no llevaría tu número. ¿Quieres generarlo sin número? Si no, agrega tu teléfono a tu perfil.',

  // ---- Lectura de recursos ----
  'recursoLectura.productoNoDisponible': 'El producto de este recurso no está disponible: está inactivo o no tiene una versión publicada. Actualiza la página e inténtalo de nuevo.',
  'recursoLectura.noExiste': 'El producto no tiene un recurso activo con la clave «{clave}». Revisa en la pestaña Recursos que exista y esté activo.',
  'recursoLectura.sinAlmacenamiento': 'El almacenamiento (Supabase) no está configurado en el servidor, así que no se puede leer el recurso «{recurso}». Avisa al administrador del sistema.',
  'recursoLectura.urlInvalida': 'La URL del recurso «{recurso}» no es una dirección válida. Corrígela en la pestaña Recursos del producto.',
  'recursoLectura.protocolo': 'La URL del recurso «{recurso}» no usa https. Usa la dirección pública https:// de la imagen en Supabase, en la pestaña Recursos del producto.',
  'recursoLectura.hostNoPermitido': 'La URL del recurso «{recurso}» apunta a {host}, que no es el almacenamiento configurado ({hostPermitido}). Corrige la URL en la pestaña Recursos del producto.',
  'recursoLectura.timeout': 'El almacenamiento tardó más de {segundos} segundos en responder al leer el recurso «{recurso}». Inténtalo de nuevo; si persiste, revisa la URL en la pestaña Recursos.',
  'recursoLectura.sinConexion': 'No se pudo conectar con el almacenamiento para leer el recurso «{recurso}». Revisa la URL en la pestaña Recursos del producto.',
  'recursoLectura.respuestaHttp': 'El almacenamiento respondió {estado} al leer el recurso «{recurso}». Comprueba que la imagen exista y sea pública, y corrige la URL en la pestaña Recursos.',
  'recursoLectura.noImagen': 'El recurso «{recurso}» no es una imagen: el almacenamiento devolvió «{tipo}». Sube una imagen y corrige la URL en la pestaña Recursos.',
  'recursoLectura.grande': 'El recurso «{recurso}» pesa más de {maxMb} MB, el máximo permitido. Sube una versión más liviana y corrige la URL.'
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
