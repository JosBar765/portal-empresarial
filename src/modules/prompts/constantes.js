// src/modules/prompts/constantes.js
// Sin dependencias: lo cargan también los servicios puros. Solo lo estructural; el contenido y los límites viven en prompt_ajustes.
const ESTADOS_PRODUCTO = Object.freeze({ BORRADOR: 'borrador', ACTIVO: 'activo', INACTIVO: 'inactivo' });
const ESTADOS_VERSION = Object.freeze({ BORRADOR: 'borrador', PUBLICADA: 'publicada', ARCHIVADA: 'archivada' });

// Nombres reservados: cada uno es un comportamiento del código (la familia recurso_<clave> sale de los recursos del esquema).
const VARIABLES_AUTOMATICAS = Object.freeze([
  'asesor_nombre', 'asesor_telefono', 'asesor_correo', 'total_imagenes', 'lista_imagenes', 'otros_parametros'
]);

const CODIGO_PRODUCTO_RE = /^[a-z][a-z0-9_]{1,49}$/;

module.exports = {
  ESTADOS_PRODUCTO,
  ESTADOS_VERSION,
  VARIABLES_AUTOMATICAS,
  CODIGO_PRODUCTO_RE
};
