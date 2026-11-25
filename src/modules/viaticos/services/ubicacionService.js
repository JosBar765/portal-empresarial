// Dónde ve un usuario una solicitud (pestañas, fecha de creación y correlativo), para abrirla desde un aviso.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { PERMISOS } = require('../constantes');
const { msg } = require('../mensajes');

const porDefecto = () => ({
  leerEncabezado: (id) => require('./solicitudService').leerEncabezado(id)
});

async function ubicar(usuario, idCrudo, dependencias = porDefecto()) {
  const fila = await dependencias.leerEncabezado(idCrudo);
  const vistas = [];
  if (Number(fila.solicitanteId) === Number(usuario.id)) vistas.push('solicitudes');
  if ((usuario.permissions || []).includes(PERMISOS.GESTIONAR)) vistas.push('gestiones');
  // A quien no puede verla se le responde igual que si no existiera.
  if (!vistas.length) throw new ErrorDeNegocio(msg('solicitud.noExiste', { id: fila.id }), 404);
  return { correlativo: fila.correlativo, fechaCreacion: String(fila.creadoEn).slice(0, 10), vistas };
}

module.exports = { ubicar };
