// src/modules/viaticos/services/archivosViaticoService.js
// Archivos del módulo (fotos de defectos y comprobantes): validación contra los ajustes, subida a Storage y borrado.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { tipoRealCoincide } = require('../../../core/files/fileSignature');
const { excedeElLimiteDePixeles } = require('../../../core/files/imagenDimensiones');
const subirYRegistrarArchivo = require('../../../core/files/subirYRegistrarArchivo');
const { StorageUploadError } = require('../../../core/files/errores');
const supabaseStorage = require('../../../core/files/supabaseStorage');
const nombreArchivo = require('../../../core/files/nombreArchivo');
const ajusteRepo = require('../repositories/ajusteRepository');
const { MODALIDADES, ARCHIVOS } = require('../constantes');
const { parsearJson } = require('../utilidades');
const { msg } = require('../mensajes');

const BYTES_POR_MB = 1024 * 1024;

// El navegador puede declarar «image/jpg»; Storage y la base usan el tipo canónico.
const tipoCanonico = mime => (mime === 'image/jpg' ? 'image/jpeg' : mime);

// Tipos y tamaño máximo vigentes (viaticos_ajustes); sin ellos no se puede validar nada.
async function leerAjustes() {
  const filas = await ajusteRepo.listar();
  const valor = clave => {
    const fila = filas.find(f => f.clave === clave);
    return fila ? parsearJson(fila.valor) : null;
  };
  const tipos = valor(ARCHIVOS.AJUSTE_TIPOS);
  const maxMb = Number(valor(ARCHIVOS.AJUSTE_MAX_MB));
  if (!Array.isArray(tipos) || tipos.length === 0 || !(maxMb > 0)) throw new ErrorDeNegocio(msg('archivo.ajustesFaltan'), 400);
  return { tipos, maxMb, maxBytes: maxMb * BYTES_POR_MB };
}

// Errores de un archivo suelto: tipo declarado, contenido real, tamaño y dimensiones.
function erroresDeArchivo(archivo, ajustes, campo) {
  const nombre = String(archivo.originalname || '').slice(0, 80);
  const mime = tipoCanonico(archivo.mimetype);
  const falla = mensaje => [{ campo, mensaje }];
  if (!ajustes.tipos.includes(mime)) return falla(msg('archivo.tipoNoPermitido', { nombre, tipo: mime || 'desconocido', permitidos: ajustes.tipos.join(', ') }));
  if (!tipoRealCoincide(archivo.buffer, mime)) return falla(msg('archivo.contenidoNoCoincide', { nombre, tipo: mime }));
  if (archivo.size > ajustes.maxBytes) {
    return falla(msg('archivo.demasiadoGrande', { nombre, tamano: (archivo.size / BYTES_POR_MB).toFixed(1), max: ajustes.maxMb }));
  }
  if (mime.startsWith('image/') && excedeElLimiteDePixeles(archivo.buffer, mime)) return falla(msg('archivo.dimensiones', { nombre }));
  return [];
}

// Cada defecto referencia su foto por `archivoIndice`; no pueden sobrar fotos ni repetirse.
function validarDefectos({ datos, archivos, ajustes }) {
  if (datos.modalidad === MODALIDADES.MAS_DE_UN_DIA) {
    return archivos.length > 0 ? [{ campo: ARCHIVOS.CAMPO_DEFECTOS, mensaje: msg('defecto.archivosSinInspeccion') }] : [];
  }
  const errores = [];
  const defectos = datos.inspeccion ? datos.inspeccion.defectos : [];
  const usados = new Set();
  defectos.forEach((defecto, i) => {
    const campo = `inspeccion.defectos[${i}]`;
    const archivo = archivos[defecto.archivoIndice];
    if (!archivo) errores.push({ campo, mensaje: msg('defecto.sinArchivo', { numero: i + 1, indice: defecto.archivoIndice }) });
    else if (usados.has(defecto.archivoIndice)) errores.push({ campo, mensaje: msg('defecto.archivoRepetido', { indice: defecto.archivoIndice }) });
    else errores.push(...erroresDeArchivo(archivo, ajustes, campo));
    usados.add(defecto.archivoIndice);
  });
  if (archivos.some((_, indice) => !usados.has(indice))) {
    errores.push({ campo: ARCHIVOS.CAMPO_DEFECTOS, mensaje: msg('defecto.archivoSobrante', { cantidad: archivos.length, usadas: usados.size }) });
  }
  return errores;
}

// Sube las fotos en orden y registra cada defecto; `subidas` acumula las URLs para poder deshacer si algo falla después.
// `etapa` es CREACION o CORRECCION (ETAPAS_DOCUMENTO). `existentes` son las URLs de fotos previas: el contador de la etapa sigue desde ellas para no repetir nombres.
async function subirDefectos({ correlativo, etapa, defectos, archivos, existentes = [], registrar, subidas }) {
  let contador = nombreArchivo.siguienteContador(existentes, nombreArchivo.prefijoAdjunto(correlativo, ARCHIVOS.TIPO_NOMBRE_DEFECTO, etapa));
  for (const defecto of defectos) {
    const archivo = archivos[defecto.archivoIndice];
    const mimeType = tipoCanonico(archivo.mimetype);
    await subirYRegistrarArchivo({
      buffer: archivo.buffer,
      nombreOriginal: archivo.originalname,
      mimeType,
      storage: supabaseStorage.viaticos,
      nombreObjeto: nombreArchivo.adjunto(correlativo, ARCHIVOS.TIPO_NOMBRE_DEFECTO, etapa, contador),
      registrar: async subida => {
        await registrar({ ...defecto, ruta: subida.url, mimeType, tamano: subida.size });
        subidas.push(subida.url);
      }
    });
    contador += 1;
  }
}

// Sube el comprobante como <CORR>_LIQUIDACION_<RUBRO>_X. Storage no sobrescribe y fuera de producción el borrado no actúa, así que un nombre
// que quedó sin borrar choca: ante «ya existe» se prueba el contador siguiente (hasta ARCHIVOS.INTENTOS_NOMBRE intentos).
// `existentes` son las URLs de los comprobantes vigentes del mismo rubro. Devuelve el nombre que quedó guardado y los intentos usados.
async function subirComprobante({ correlativo, rubro, archivo, existentes = [], registrar, subidas }) {
  let contador = nombreArchivo.siguienteContador(existentes, nombreArchivo.prefijoLiquidacion(correlativo, rubro));
  const mimeType = tipoCanonico(archivo.mimetype);
  let nombreObjeto = null;
  for (let intento = 1; intento <= ARCHIVOS.INTENTOS_NOMBRE; intento += 1) {
    nombreObjeto = nombreArchivo.liquidacion(correlativo, rubro, contador);
    try {
      await subirYRegistrarArchivo({
        buffer: archivo.buffer,
        nombreOriginal: archivo.originalname,
        mimeType,
        storage: supabaseStorage.viaticos,
        nombreObjeto,
        registrar: async subida => {
          await registrar({ ruta: subida.url, mimeType, tamano: subida.size });
          subidas.push(subida.url);
        }
      });
      return { nombreObjeto, intentos: intento };
    } catch (error) {
      if (!(error instanceof StorageUploadError) || !ARCHIVOS.PATRON_NOMBRE_DUPLICADO.test(error.message)) throw error;
      contador += 1;
    }
  }
  throw new ErrorDeNegocio(msg('liquidacion.nombreAgotado', { rubro, intentos: ARCHIVOS.INTENTOS_NOMBRE, nombre: nombreObjeto }), 409);
}

// Borra de Storage (solo actúa en producción; ver supabaseStorage.eliminar). Un fallo se registra y no interrumpe.
async function eliminarArchivos(urls) {
  for (const url of urls.filter(Boolean)) {
    try {
      await supabaseStorage.viaticos.eliminar(url);
    } catch (error) {
      console.error('[Viáticos] No se pudo borrar un archivo de Storage:', error.message);
    }
  }
}

module.exports = { leerAjustes, erroresDeArchivo, validarDefectos, subirDefectos, subirComprobante, eliminarArchivos, tipoCanonico };
