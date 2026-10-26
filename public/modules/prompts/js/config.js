// Configuración compartida del servidor (límites, formatos y textos del asesor): una carga por sesión.
import { obtenerConfig } from './api/promptsApi.js';
import { t } from './textos.js';

const PARTES = ['limites', 'formatosImagen', 'textosAsesor'];
let promesa = null;

async function leer() {
  const config = await obtenerConfig();
  for (const parte of PARTES) {
    if (!config || typeof config[parte] !== 'object' || config[parte] === null) {
      throw new Error(t('asesor.errores.configIncompleta', { parte }));
    }
  }
  return config;
}

// Reusa la promesa; `recargar` la descarta (p. ej. al reintentar o tras editar ajustes).
export function cargarConfig(recargar = false) {
  if (!promesa || recargar) promesa = leer().catch((error) => { promesa = null; throw error; });
  return promesa;
}
