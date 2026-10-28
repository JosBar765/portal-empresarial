// src/core/files/supabaseStorage.js
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const config = require('../../config/env');
const { extensionParaTipo } = require('./fileSignature');
const { StorageUploadError } = require('./errores');

// Supabase se construye una sola vez, en el primer uso real.
let client = null;
function obtenerCliente() {
  if (client) return client;
  if (!config.supabase.url) {
    throw new StorageUploadError('Supabase Storage no está configurado (faltan SUPABASE_URL en .env).');
  } else if (!config.supabase.secretKey) {
    throw new StorageUploadError('Supabase Storage no está configurado (faltan SUPABASE_SERVICE_ROLE_KEY en .env).');
  }
  client = createClient(config.supabase.url, config.supabase.secretKey);
  return client;
}

function detalleError(error, bucketUsado) {
  const partes = [error.message];
  if (error.status || error.statusCode) partes.push(`HTTP ${error.status || error.statusCode}`);
  if (error.error && error.error !== error.message) partes.push(`código: ${error.error}`);
  partes.push(`bucket: "${bucketUsado}"`);
  return partes.join(' | ');
}

// Supabase responde 409 / "The resource already exists" cuando el objeto ya existe.
function esDuplicado(error) {
  return Number(error.status || error.statusCode) === 409 || /already exists/i.test(error.message || '');
}

function prefijoUrlPublica(bucket) {
  const { data } = obtenerCliente().storage.from(bucket).getPublicUrl('');
  return data.publicUrl;
}

// Un objeto se identifica por la URL pública guardada en BD, dentro del bucket de esta instancia.
function rutaDeObjeto(url, bucket) {
  const prefijo = prefijoUrlPublica(bucket);
  return url.startsWith(prefijo) ? url.slice(prefijo.length) : path.basename(url);
}

class SupabaseStorage {
  constructor(bucket) {
    this.bucket = bucket;
  }

  /**
   * Sube un archivo ya optimizado (ver imageOptimizer, aplicado por
   * subirYRegistrarArchivo antes de llegar aquí) al bucket. Lanza un Error
   * genérico con el mensaje crudo de Supabase — es subirYRegistrarArchivo
   * quien lo reclasifica como StorageUploadError (evita el doble prefijo
   * "No se pudo subir..." que salía cuando esta función también clasificaba).
   * `opciones.esHuerfano` (async, opcional; solo con `nombreObjeto`): si el objeto ya existe, decide si es un huérfano;
   * de serlo se borra y se reintenta UNA vez. Sin la opción, el comportamiento no cambia.
   * @returns {Promise<{path: string, url: string, size: number}>}
   */
  async subir(buffer, nombreOriginal, mimeType, nombreObjeto, { esHuerfano } = {}) {
    // La extensión sale del tipo YA VERIFICADO por magic bytes
    // (valeController.validarArchivos), nunca del nombre que mandó el
    // usuario — path.extname(nombreOriginal) es 100% controlado por quien
    // sube el archivo y permitía guardar, por ejemplo, un .svg/.html
    // disfrazado bajo esa extensión en un bucket público.
    const extension = extensionParaTipo(mimeType) || path.extname(nombreOriginal);
    // `nombreObjeto` (sin extensión) fija el nombre; sin él se usa un token aleatorio.
    if (nombreObjeto !== undefined && !/^[A-Za-z0-9_.-]+$/.test(nombreObjeto)) {
      throw new StorageUploadError(`Nombre de archivo no válido para Storage: "${nombreObjeto}".`);
    }
    const objectPath = (nombreObjeto || crypto.randomBytes(16).toString('hex')) + extension;
    const bucket = this.bucket;
    const subirObjeto = () => obtenerCliente().storage.from(bucket).upload(objectPath, buffer, {
      contentType: mimeType,
      upsert: false
    });
    let { error } = await subirObjeto();
    if (error && esHuerfano && nombreObjeto && esDuplicado(error)) {
      const sinBorrar = new StorageUploadError(
        `Ya existe un archivo con el nombre "${objectPath}" en Storage y no se pudo reemplazar. Avisa al administrador para limpiarlo.`
      );
      let huerfano = false;
      try { huerfano = await esHuerfano(); } catch (e) { throw sinBorrar; }
      if (!huerfano) throw sinBorrar;
      try {
        if (!(await this.eliminar(objectPath))) throw sinBorrar;
      } catch (e) {
        throw sinBorrar;
      }
      console.warn(`[Storage] Huérfano eliminado: ${objectPath} (su vale ya no existe)`);
      ({ error } = await subirObjeto());
      if (error && esDuplicado(error)) throw sinBorrar;
    }
    if (error) {
      throw new StorageUploadError(detalleError(error, bucket));
    }
    const { data } = obtenerCliente().storage.from(bucket).getPublicUrl(objectPath);
    return { path: objectPath, url: data.publicUrl, size: buffer.length };
  }

  /**
   * Elimina un objeto del bucket a partir de la URL pública guardada en BD.
   * Lanza un Error genérico — quien llama decide qué significa un fallo
   * aquí (p. ej. subirYRegistrarArchivo lo reclasifica como
   * StorageRollbackError cuando la eliminación es un rollback).
   * Fuera de producción no borra nada y devuelve false: una BD de desarrollo restaurada de un
   * backup apunta a los archivos reales de producción.
   */
  async eliminar(url) {
    if (config.nodeEnv !== 'production') {
      console.log(`[Storage] NODE_ENV=${config.nodeEnv}: no se borra el archivo de Storage (solo se borra en producción).`);
      return false;
    }
    const bucket = this.bucket;
    const objectPath = rutaDeObjeto(url, bucket);
    const { error } = await obtenerCliente().storage.from(bucket).remove([objectPath]);
    if (error) {
      throw new StorageUploadError(`No se pudo eliminar "${objectPath}" de Supabase Storage: ${detalleError(error, bucket)}`);
    }
    return true;
  }

  /** Descarga un objeto de este bucket a partir de su URL guardada en BD. */
  async descargar(url) {
    const bucket = this.bucket;
    const objectPath = rutaDeObjeto(url, bucket);
    const { data, error } = await obtenerCliente().storage.from(bucket).download(objectPath);
    if (error) {
      throw new StorageUploadError(`No se pudo descargar "${objectPath}" de Supabase Storage: ${detalleError(error, bucket)}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }
}

// El bucket de siempre; `borradores` es la misma clase apuntando al bucket de los adjuntos de borradores.
const storage = new SupabaseStorage(config.supabase.bucket);
storage.borradores = new SupabaseStorage(config.supabase.bucketBorradores);

module.exports = storage;
