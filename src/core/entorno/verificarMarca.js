// Marca de entorno: solo la base de STAGING lleva parametros_sistema.entorno = 'staging'; producción nunca tiene marca.
const CLAVE = 'entorno';
const VALOR_STAGING = 'staging';

// `consultar(sql, params)` devuelve las filas (db.query o un envoltorio de conexión). Sin tabla o sin fila -> null.
async function leerMarcaDeBase(consultar) {
  try {
    const filas = await consultar('SELECT valor FROM parametros_sistema WHERE clave = ?', [CLAVE], 'entorno:leer_marca');
    return filas.length ? String(filas[0].valor).trim().toLowerCase() : null;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return null;
    throw error;
  }
}

// Devuelve { ok, mensaje, fatal }. `leerMarca` es async y devuelve la marca guardada o null.
async function verificarMarca({ nodeEnv, leerMarca }) {
  if (nodeEnv !== 'staging' && nodeEnv !== 'production') return { ok: true, fatal: false, mensaje: null };

  let marca;
  try {
    marca = await leerMarca();
  } catch (error) {
    const detalle = `[${error.code || 'sin código'}] ${error.sqlMessage || error.message}`;
    // Staging falla cerrado; producción no se cae por no poder leer una marca que no debe tener.
    if (nodeEnv === 'staging') {
      return { ok: false, fatal: true, mensaje: `No se pudo leer la marca de entorno de la base: ${detalle}. El servidor de staging no arranca sin confirmar que su base es de staging.` };
    }
    return { ok: true, fatal: false, mensaje: `AVISO: no se pudo leer la marca de entorno (${detalle}); se continúa en producción.` };
  }

  if (nodeEnv === 'staging') {
    if (marca === VALOR_STAGING) return { ok: true, fatal: false, mensaje: 'Marca de entorno correcta (staging)' };
    const hallado = marca === null ? 'la base no tiene marca de entorno' : `la marca de la base es «${marca}»`;
    return {
      ok: false,
      fatal: true,
      mensaje: `El servidor de staging NO está conectado a una base de staging: ${hallado}. Si es la base de staging, márcala una vez con «npm run staging:marcar»; si no, revisa DB_* del .env.`
    };
  }

  if (marca === VALOR_STAGING) {
    return { ok: false, fatal: true, mensaje: 'Una base de STAGING está conectada a PRODUCCIÓN (lleva la marca entorno = staging). Revisa DB_* del .env o si se restauró un respaldo de staging.' };
  }
  return { ok: true, fatal: false, mensaje: 'Marca de entorno correcta (sin marca: producción)' };
}

module.exports = { CLAVE, VALOR_STAGING, leerMarcaDeBase, verificarMarca };
