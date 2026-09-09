// src/core/files/errores.js
// Excepciones explícitas para cada paso de subirYRegistrarArchivo — permiten
// distinguir en logs/manejo de errores exactamente cuál de los tres pasos
// falló (subida a Storage, inserción en la base de datos, o el rollback de
// la propia subida cuando la inserción falla).
class StorageUploadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageUploadError';
  }
}

class DatabaseInsertError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseInsertError';
  }
}

class StorageRollbackError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageRollbackError';
  }
}

module.exports = { StorageUploadError, DatabaseInsertError, StorageRollbackError };
