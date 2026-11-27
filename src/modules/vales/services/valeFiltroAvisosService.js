// La campana de Vales sigue las tiendas que cada uno marca en el Buzón. El servidor decide qué puede marcar.
const alcanceRepository = require('../../../core/notifications/alcanceRepository');
const valeCatalogoService = require('./valeCatalogoService');
const { ROL, esSupervisor, esAdministrador } = require('./valeHelpers');
const { compactar, expandir, ajustar, alcanza } = require('./valeAlcanceReglas');
const socketManager = require('../../../core/websocket/socketManager');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

const MODULO = 'vales';
// Las otras pantallas y dispositivos del usuario releen la selección.
const avisarCambio = (usuarioId) => socketManager.sendToUsers?.([usuarioId], 'alcance_avisos', {});
// Quienes tienen el selector de tiendas en el Buzón: Supervisor, Gerente y Administrador.
const aplica = (usuario) => esSupervisor(usuario) || esAdministrador(usuario) || usuario.rolId === ROL.GERENTE;

async function permitidos(usuario) {
  const { tiendasGerencia = [], asesoresEspeciales = [] } = await valeCatalogoService.obtenerCatalogos(usuario);
  return { tiendas: tiendasGerencia, asesores: new Set(asesoresEspeciales.map(a => a.id)) };
}

const firma = ({ tiendas, asesores }) => JSON.stringify([tiendas.map(t => t.id).sort((a, b) => a - b), [...asesores].sort((a, b) => a - b)]);

// Lo que un supervisor puede marcar según las asignaciones de este momento (misma regla que el catálogo).
async function elegiblesDeSupervisor(usuarioId) {
  const usuarios = require('../repositories/usuarioValeRepository');
  const catalogo = require('../repositories/catalogoRepository');
  const asesores = await usuarios.listarAsesoresPorSupervisor(usuarioId);
  const especiales = await usuarios.listarAsesoresEspeciales(usuarioId);
  const cubiertas = new Set(asesores.map(a => a.tienda_id).filter(Boolean));
  const tiendas = await catalogo.listarTiendas();
  return { tiendas: tiendas.filter(t => cubiertas.has(t.id)), asesores: especiales.map(a => a.id) };
}

const recortar = (lista, validos) => [...new Set((Array.isArray(lista) ? lista : []).map(Number))].filter(id => validos.has(id));

class ValeFiltroAvisosService {
  // Descarta (y borra) lo que ya no aplica: tiendas que dejó de cubrir o un rol que ya no tiene el selector.
  async leer(usuario) {
    if (!aplica(usuario)) {
      await alcanceRepository.borrar(usuario.id, MODULO);
      return { aplica: false, guardado: false, tiendas: [], asesores: [] };
    }
    const filas = await alcanceRepository.leer(usuario.id, MODULO);
    const validos = await permitidos(usuario);
    const vigente = (f) => (f.clase === 'asesor' ? validos.asesores.has(f.ref_id) : validos.tiendas.some(t => alcanza(f, t)));
    const elegidas = filas.filter(f => f.clase !== 'guardado');
    const vigentes = elegidas.filter(vigente);
    const de = (clase) => vigentes.filter(f => f.clase === clase).map(f => f.ref_id);
    if (vigentes.length !== elegidas.length) {
      await alcanceRepository.reemplazar(usuario.id, MODULO, { tiendas: de('tienda'), paises: de('pais'), grupos: de('grupo'), asesores: de('asesor') });
    }
    return { aplica: true, guardado: filas.length > 0, tiendas: expandir(vigentes, validos.tiendas), asesores: de('asesor') };
  }

  async guardar(usuario, { tiendas, asesores } = {}) {
    if (!aplica(usuario)) throw new ErrorDeNegocio('Tu rol no puede filtrar sus avisos por tienda.', 403);
    const validos = await permitidos(usuario);
    const ids = recortar(tiendas, new Set(validos.tiendas.map(t => t.id)));
    const todas = ids.length > 0 && ids.length === validos.tiendas.length;
    const especiales = todas ? [] : recortar(asesores, validos.asesores);
    await alcanceRepository.reemplazar(usuario.id, MODULO, { ...compactar(ids, validos.tiendas), asesores: especiales });
    avisarCambio(usuario.id);
    return { aplica: true, guardado: true, tiendas: todas ? [] : ids, asesores: especiales };
  }

  // Envuelve un cambio de asignaciones del administrador: las tiendas perdidas salen de la selección y las nuevas entran marcadas.
  // Un fallo aquí nunca deshace ni bloquea el cambio del administrador.
  async trasCambioDeAsignaciones(cambio) {
    const antes = new Map();
    try {
      for (const { usuario_id: id } of await alcanceRepository.usuariosConFiltro(MODULO)) antes.set(id, await elegiblesDeSupervisor(id));
    } catch (error) {
      console.error('[Notificaciones] No se pudo leer la selección antes del cambio:', error.message);
    }
    const resultado = await cambio();
    for (const [id, previo] of antes) {
      try {
        const ahora = await elegiblesDeSupervisor(id);
        const nueva = ajustar(await alcanceRepository.leer(id, MODULO), previo, ahora);
        if (nueva) await alcanceRepository.reemplazar(id, MODULO, nueva);
        // Con un país o grupo marcado la selección no cambia, pero sus tiendas sí.
        if (nueva || firma(previo) !== firma(ahora)) avisarCambio(id);
      } catch (error) {
        console.error(`[Notificaciones] No se pudo ajustar la selección del usuario ${id}:`, error.message);
      }
    }
    return resultado;
  }
}

module.exports = new ValeFiltroAvisosService();
