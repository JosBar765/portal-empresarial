// La campana de Vales sigue las tiendas que el supervisor marca en el Buzón. El servidor decide qué puede marcar.
const alcanceRepository = require('../../../core/notifications/alcanceRepository');
const valeCatalogoService = require('./valeCatalogoService');
const { esSupervisor, esAdministrador } = require('./valeHelpers');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

const MODULO = 'vales';
const aplica = (usuario) => esSupervisor(usuario) && !esAdministrador(usuario);

async function permitidos(usuario) {
  const { tiendasGerencia = [], asesoresEspeciales = [] } = await valeCatalogoService.obtenerCatalogos(usuario);
  return { tiendas: new Set(tiendasGerencia.map(t => t.id)), asesores: new Set(asesoresEspeciales.map(a => a.id)) };
}

const recortar = (lista, validos) => [...new Set((Array.isArray(lista) ? lista : []).map(Number))].filter(id => validos.has(id));

class ValeFiltroAvisosService {
  // Descarta (y borra) lo que ya no aplica: tiendas que dejó de cubrir o un rol que ya no es de supervisor.
  async leer(usuario) {
    if (!aplica(usuario)) {
      await alcanceRepository.borrar(usuario.id, MODULO);
      return { aplica: false, guardado: false, tiendas: [], asesores: [] };
    }
    const filas = await alcanceRepository.leer(usuario.id, MODULO);
    const deClase = (clase) => filas.filter(f => f.clase === clase).map(f => f.ref_id);
    const validos = await permitidos(usuario);
    const seleccion = { tiendas: recortar(deClase('tienda'), validos.tiendas), asesores: recortar(deClase('asesor'), validos.asesores) };
    if (seleccion.tiendas.length !== deClase('tienda').length || seleccion.asesores.length !== deClase('asesor').length) {
      await alcanceRepository.reemplazar(usuario.id, MODULO, seleccion);
    }
    return { aplica: true, guardado: filas.length > 0, ...seleccion };
  }

  async guardar(usuario, { tiendas, asesores } = {}) {
    if (!aplica(usuario)) throw new ErrorDeNegocio('Solo un supervisor puede filtrar sus avisos por tienda.', 403);
    const validos = await permitidos(usuario);
    const seleccion = { tiendas: recortar(tiendas, validos.tiendas), asesores: recortar(asesores, validos.asesores) };
    await alcanceRepository.reemplazar(usuario.id, MODULO, seleccion);
    return { aplica: true, guardado: true, ...seleccion };
  }
}

module.exports = new ValeFiltroAvisosService();
