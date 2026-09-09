// src/core/files/supabaseStorage.js
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const config = require('../../config/env');
const { StorageUploadError } = require('./errores');

const bucket = config.supabase.bucket;

// Supabase se construye una sola vez, en el primer uso real.
let client = null;
function obtenerCliente() {
  if (client) return client;
  if (!config.supabase.url) {
    throw new Error('Supabase Storage no está configurado (faltan SUPABASE_URL en .env).');
  } else if (!config.supabase.secretKey) {
    throw new Error('Supabase Storage no está configurado (faltan SUPABASE_SERVICE_ROLE_KEY en .env).');
  }
  client = createClient(config.supabase.url, config.supabase.secretKey);
  return client;
}

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
