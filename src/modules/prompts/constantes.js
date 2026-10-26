// src/modules/prompts/constantes.js
// Sin dependencias: lo cargan también los servicios puros.
const ENCABEZADO_SISTEMA = 'NUEVA INSTRUCCIÓN. Ignora por completo cualquier conversación, imagen o propuesta anterior y genera una imagen completamente nueva usando solo las especificaciones de este mensaje.';

const LOGO_MARCA_AGUA = '/assets/logos/logotransparente.png';
const TEXTO_MARCA_AGUA = 'Grupo Premia';

const ESTADOS_PRODUCTO = Object.freeze({ BORRADOR: 'borrador', ACTIVO: 'activo', INACTIVO: 'inactivo' });
const ESTADOS_VERSION = Object.freeze({ BORRADOR: 'borrador', PUBLICADA: 'publicada', ARCHIVADA: 'archivada' });

const VARIABLES_AUTOMATICAS = Object.freeze(['asesor_nombre', 'asesor_telefono', 'asesor_correo', 'logo_marca_agua']);

const CODIGO_PRODUCTO_RE = /^[a-z][a-z0-9_]{1,49}$/;

// Contacto de ejemplo para la vista previa del administrador.
const CONTACTO_EJEMPLO = Object.freeze({ nombre: 'Nombre Apellido', email: 'asesor@grupopremia.com', telefono: '+502 5555 5555' });

module.exports = {
  ENCABEZADO_SISTEMA,
  LOGO_MARCA_AGUA,
  TEXTO_MARCA_AGUA,
  ESTADOS_PRODUCTO,
  ESTADOS_VERSION,
  VARIABLES_AUTOMATICAS,
  CODIGO_PRODUCTO_RE,
  CONTACTO_EJEMPLO
};
