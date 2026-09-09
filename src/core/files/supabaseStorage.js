// src/core/files/supabaseStorage.js
// Almacenamiento de los PDFs/imágenes de Vales de Arte en Supabase Storage
// — exclusivamente eso, la base de datos de negocio del portal sigue siendo
// MySQL. Reemplaza al extinto src/core/files/fileStorage.js (disco local,
// servido bajo /uploads con JWT requerido vía authenticateJWT) para ese
// módulo. El bucket es público por decisión explícita del usuario — a
// diferencia de /uploads, un adjunto ya no exige sesión iniciada para
// verse, solo conocer su URL (nombre de archivo aleatorio, no listable).
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const config = require('../../config/env');
const { StorageUploadError } = require('./errores');

const bucket = config.supabase.bucket;

// Cliente perezoso: a diferencia de MySQL (imprescindible para todo el
// portal, ver src/config/database.js), Supabase solo hace falta para el
// módulo de Vales de Arte — construirlo al cargar este archivo tumbaría el
// servidor entero si SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY todavía no
// están configuradas, aunque nadie esté subiendo un archivo. Se construye
// una sola vez, en el primer uso real.
let client = null;
function obtenerCliente() {
  if (client) return client;
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    // Error genérico a propósito: tanto subir() como eliminar() lo dejan
    // subir sin atrapar, y es subirYRegistrarArchivo quien lo reclasifica
    // como StorageUploadError o StorageRollbackError según en cuál de los
    // dos pasos ocurrió.
    throw new Error('Supabase Storage no está configurado (faltan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY en .env).');
  }
  client = createClient(config.supabase.url, config.supabase.serviceRoleKey);
  return client;
}

// Prefijo exacto que arma getPublicUrl() para este bucket — se usa para
// recuperar el path dentro del bucket a partir de la URL guardada en BD,
// sin tener que guardar ambos valores por separado.
function prefijoUrlPublica() {
  const { data } = obtenerCliente().storage.from(bucket).getPublicUrl('');
  return data.publicUrl;
}

class SupabaseStorage {
  /**
   * Sube un archivo ya optimizado (ver imageOptimizer, aplicado por
   * subirYRegistrarArchivo antes de llegar aquí) al bucket.
   * @returns {Promise<{path: string, url: string, size: number}>}
   */
  async subir(buffer, nombreOriginal, mimeType) {
    const extension = path.extname(nombreOriginal);
    const objectPath = crypto.randomBytes(16).toString('hex') + extension;
    const { error } = await obtenerCliente().storage.from(bucket).upload(objectPath, buffer, {
      contentType: mimeType,
      upsert: false
    });
    if (error) {
      throw new StorageUploadError(`No se pudo subir "${nombreOriginal}" a Supabase Storage: ${error.message}`);
    }
    const { data } = obtenerCliente().storage.from(bucket).getPublicUrl(objectPath);
    return { path: objectPath, url: data.publicUrl, size: buffer.length };
  }

  /**
   * Elimina un objeto del bucket a partir de la URL pública guardada en BD.
   * Lanza un Error genérico — quien llama decide qué significa un fallo
   * aquí (p. ej. subirYRegistrarArchivo lo reclasifica como
   * StorageRollbackError cuando la eliminación es un rollback).
   */
  async eliminar(url) {
    const prefijo = prefijoUrlPublica();
    const objectPath = url.startsWith(prefijo) ? url.slice(prefijo.length) : path.basename(url);
    const { error } = await obtenerCliente().storage.from(bucket).remove([objectPath]);
    if (error) {
      throw new Error(`No se pudo eliminar "${objectPath}" de Supabase Storage: ${error.message}`);
    }
    return true;
  }
}

module.exports = new SupabaseStorage();
