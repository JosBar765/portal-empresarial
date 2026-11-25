// Dónde ve un usuario un vale concreto (pestaña, mes de entrega y correlativo), para abrirlo desde un aviso.
// Se pregunta al propio buzón con el mes y la búsqueda que usará la pantalla: así nunca promete algo que luego no aparece.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

const VISTAS = ['buzon', 'trabajo', 'mios'];

const porDefecto = () => ({
  obtenerVale: (id) => require('../repositories/valeRepository').obtenerPorId(id),
  obtenerBuzon: (usuario, filtros) => require('./valeBuzonService').obtenerBuzon(usuario, filtros)
});

const noDisponible = () => new ErrorDeNegocio('Ese vale ya no está disponible para tu usuario.', 404);

async function ubicar(usuario, valeId, dependencias = porDefecto()) {
  const vale = await dependencias.obtenerVale(valeId);
  if (!vale) throw noDisponible();
  const fechaEntrega = String(vale.fecha_entrega).slice(0, 10);
  const vistas = [];
  for (const vista of VISTAS) {
    try {
      const lista = await dependencias.obtenerBuzon(usuario, { vista, ventana: 'mes', fecha: fechaEntrega, busqueda: vale.correlativo });
      if (lista.vales.some(v => Number(v.id) === Number(valeId))) vistas.push(vista);
    } catch (error) {
      if (error.status !== 403) throw error; // «Mis vales» no existe para quien no crea vales
    }
  }
  if (!vistas.length) throw noDisponible();
  return { correlativo: vale.correlativo, fechaEntrega, vistas };
}

module.exports = { ubicar };
