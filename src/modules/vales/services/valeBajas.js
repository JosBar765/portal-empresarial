// src/modules/vales/services/valeBajas.js
// Arma el registro permanente (tabla `vale_bajas`) que se guarda junto al borrado de un vale completo.
// El correo de quien eliminó se lee de `usuarios`, no del token: así el registro no depende de lo que traiga la sesión.
const usuarioValeRepository = require('../repositories/usuarioValeRepository');

const MOTIVOS_BAJA = {
  BAJA_ASESOR: 'BAJA_ASESOR',
  VENCIMIENTO_VIGENCIA: 'VENCIMIENTO_VIGENCIA',
  VENCIMIENTO_ADJUNTOS: 'VENCIMIENTO_ADJUNTOS',
  MODIFICACION_RECHAZADA: 'MODIFICACION_RECHAZADA',
  TALLER_QUITADO: 'TALLER_QUITADO'
};

// Sin correo (quitado por el sistema) el motivo son los adjuntos vencidos del taller.
const TEXTO_POR_MOTIVO = {
  [MOTIVOS_BAJA.BAJA_ASESOR]: (correo) => `eliminado por: ${correo}`,
  [MOTIVOS_BAJA.MODIFICACION_RECHAZADA]: (correo) => `rechazado por: ${correo}`,
  [MOTIVOS_BAJA.VENCIMIENTO_VIGENCIA]: () => 'vencimiento',
  [MOTIVOS_BAJA.VENCIMIENTO_ADJUNTOS]: () => 'vencimiento',
  [MOTIVOS_BAJA.TALLER_QUITADO]: (correo, { tallerNombre }) => (correo ? `taller quitado por: ${correo}` : `adjuntos vencidos: taller ${tallerNombre}`)
};

// `actorId` solo hace falta cuando una persona decide la baja; un vencimiento no tiene actor.
// `extra`: borradorId (borrador creado con el vale) y tallerId/tallerNombre (solo TALLER_QUITADO).
async function armarBaja(motivo, actorId = null, extra = {}) {
  if (!TEXTO_POR_MOTIVO[motivo]) throw new Error(`Motivo de baja desconocido: ${motivo}`);
  let correo = null;
  if (actorId) {
    const actor = await usuarioValeRepository.obtenerPorId(actorId);
    correo = actor ? actor.email : null;
  }
  const razon = TEXTO_POR_MOTIVO[motivo](correo || (actorId ? `usuario ${actorId}` : null), extra);
  return {
    motivo, razon, actorId, actorCorreo: correo,
    borradorId: extra.borradorId || null, tallerId: extra.tallerId || null, tallerNombre: extra.tallerNombre || null
  };
}

module.exports = { MOTIVOS_BAJA, armarBaja };
