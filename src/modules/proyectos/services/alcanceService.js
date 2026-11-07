// src/modules/proyectos/services/alcanceService.js
// Qué países puede ver y trabajar cada persona. Quien tiene `proyectos.ver_gerencia` o `proyectos.administrar` ve todos;
// el resto, los de su tienda (o sus tiendas) con las excepciones del administrador. Se decide por permiso, nunca por rol.
const alcanceRepository = require('../repositories/alcanceRepository');

const PERMISOS_GLOBALES = ['proyectos.ver_gerencia', 'proyectos.administrar'];

class AlcanceService {
  // { todos, ids }: `ids` siempre trae la lista efectiva (todos los países si `todos`), lista para un `IN (?)`.
  async paisesDe(usuario) {
    const permisos = usuario.permissions || [];
    if (PERMISOS_GLOBALES.some(p => permisos.includes(p))) {
      return { todos: true, ids: await alcanceRepository.todosLosPaises() };
    }
    const efectivos = new Set(await alcanceRepository.paisesDeTiendas(usuario.id));
    for (const { pais_id: paisId, accion } of await alcanceRepository.excepciones(usuario.id)) {
      if (accion === 'agregar') efectivos.add(paisId);
      else if (accion === 'quitar') efectivos.delete(paisId);
    }
    return { todos: false, ids: [...efectivos] };
  }

  tiendaDe(usuarioId) {
    return alcanceRepository.tiendaDe(usuarioId);
  }
}

module.exports = new AlcanceService();
