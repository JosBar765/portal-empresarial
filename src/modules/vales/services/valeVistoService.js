// src/modules/vales/services/valeVistoService.js
// El supervisor debe abrir "Ver" en un vale pendiente antes de autorizarlo.
const valeRepository = require('../repositories/valeRepository');
const valeVistoRepository = require('../repositories/valeVistoRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const { ESTADOS, ROL, esAdministrador } = require('./valeHelpers');

class ValeVistoService {
  // Solo cuenta para un supervisor del asesor y sobre un vale pendiente de autorización; en otro caso se ignora.
  async marcarVisto(usuario, valeId) {
    if (usuario.rolId !== ROL.SUPERVISOR) return;
    const vale = await valeRepository.obtenerPorId(valeId);
    if (!vale || vale.estado !== ESTADOS.ESPERANDO_AUTORIZACION) return;
    const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
    if (!supervisores.some(s => s.id === usuario.id)) return;
    await valeVistoRepository.registrar(valeId, usuario.id);
  }

  async exigirVisto(usuario, valeId) {
    if (esAdministrador(usuario)) return;
    if (!(await valeVistoRepository.existe(valeId, usuario.id))) {
      throw new Error('Debes revisar este vale con el botón "Ver" antes de autorizarlo.');
    }
  }
}

module.exports = new ValeVistoService();
