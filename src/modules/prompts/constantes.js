// src/modules/prompts/constantes.js
// Sin dependencias: lo cargan también los servicios puros. Solo lo estructural; el contenido y los límites viven en prompt_ajustes.
const ESTADOS_PRODUCTO = Object.freeze({ BORRADOR: 'borrador', ACTIVO: 'activo', INACTIVO: 'inactivo' });
const ESTADOS_VERSION = Object.freeze({ BORRADOR: 'borrador', PUBLICADA: 'publicada', ARCHIVADA: 'archivada' });

// Nombres reservados: cada uno es un comportamiento del código (la familia recurso_<clave> sale de los recursos del esquema).
const VARIABLES_AUTOMATICAS = Object.freeze([
  'asesor_nombre', 'asesor_telefono', 'asesor_correo', 'total_imagenes', 'lista_imagenes', 'otros_parametros'
]);

// Familias derivadas del esquema: recurso_<clave> (un recurso) y grupo_<claveGrupo>_vacio (un grupo sin ningún dato).
const PREFIJO_RECURSO = 'recurso_';
const PREFIJO_GRUPO = 'grupo_';
const SUFIJO_GRUPO_VACIO = '_vacio';
const variableGrupoVacio = clave => `${PREFIJO_GRUPO}${clave}${SUFIJO_GRUPO_VACIO}`;

const CODIGO_PRODUCTO_RE = /^[a-z][a-z0-9_]{1,49}$/;

module.exports = {
  ESTADOS_PRODUCTO,
  ESTADOS_VERSION,
  VARIABLES_AUTOMATICAS,
  PREFIJO_RECURSO,
  PREFIJO_GRUPO,
  SUFIJO_GRUPO_VACIO,
  variableGrupoVacio,
  CODIGO_PRODUCTO_RE
};
