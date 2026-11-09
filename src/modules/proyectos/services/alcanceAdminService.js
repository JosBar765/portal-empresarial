// src/modules/proyectos/services/alcanceAdminService.js
// Alcance de usuarios por país (A7): el administrador amplía o quita países a una persona. Solo se guardan las
// excepciones al país de su tienda (`proy_usuario_paises`); quitar un país no borra ningún dato. Cada cambio queda en el
// historial de configuración.
const db = require('../../../config/database');
const alcanceRepository = require('../repositories/alcanceRepository');
const configRepository = require('../repositories/configRepository');
const configService = require('./configService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');

const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

class AlcanceAdminService {
  // Todas las personas con tienda (asesores y supervisores) más las que ya tienen excepciones, con sus países.
  async _personas() {
    const [filas, excepciones, paises] = await Promise.all([alcanceRepository.personasConTienda(), alcanceRepository.todasLasExcepciones(), configService.paises()]);
    const nombrePais = new Map(paises.map(p => [p.paisId, p.nombre]));
    const personas = new Map();
    const nueva = (f) => ({ id: f.usuario_id, nombre: f.nombre, rolId: f.rol_id, rol: f.rol, tiendas: new Set(), defecto: new Set(), agregados: new Set(), quitados: new Set() });
    for (const f of filas) {
      if (!personas.has(f.usuario_id)) personas.set(f.usuario_id, nueva(f));
      const p = personas.get(f.usuario_id);
      if (f.tienda) p.tiendas.add(f.tienda);
      if (f.pais_id) p.defecto.add(f.pais_id);
    }
    for (const e of excepciones) {
      if (!personas.has(e.usuario_id)) personas.set(e.usuario_id, nueva(e));
      personas.get(e.usuario_id)[e.accion === 'agregar' ? 'agregados' : 'quitados'].add(e.pais_id);
    }
    const ordenados = (ids) => [...ids].filter(id => nombrePais.has(id)).sort((a, b) => nombrePais.get(a).localeCompare(nombrePais.get(b), 'es')).map(id => ({ id, nombre: nombrePais.get(id) }));
    return {
      paises: paises.map(p => ({ id: p.paisId, nombre: p.nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      personas: [...personas.values()].map(p => {
        const efectivos = new Set([...p.defecto, ...p.agregados].filter(id => !p.quitados.has(id)));
        const tiendas = [...p.tiendas];
        return {
          id: p.id, nombre: p.nombre, rolId: p.rolId, rol: p.rol,
          tienda: tiendas.length > 1 ? `${tiendas.length} tiendas` : (tiendas[0] || '—'),
          paisesPorDefecto: ordenados(p.defecto), agregados: ordenados(p.agregados), quitados: ordenados(p.quitados), efectivos: ordenados(efectivos)
        };
      }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    };
  }

  async listar({ busqueda = '', rol = '', pais = '' } = {}) {
    const { personas, paises } = await this._personas();
    const texto = normal(busqueda).trim();
    const rolId = aEntero(rol);
    const paisId = aEntero(pais);
    const roles = [...new Map(personas.map(p => [p.rolId, p.rol])).entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const items = personas.filter(p => (!texto || normal(p.nombre).includes(texto)) && (rolId === null || p.rolId === rolId) && (paisId === null || p.efectivos.some(e => e.id === paisId)));
    return { items, total: personas.length, roles, paises };
  }

  // `paises`: los ids que la persona debe ver desde ahora. Se guardan solo las diferencias con los de su tienda.
  async guardar(usuarioId, datos, adminId) {
    const id = aEntero(usuarioId);
    const { personas, paises } = await this._personas();
    const persona = id === null ? null : personas.find(p => p.id === id);
    if (!persona) throw new ErrorDeNegocio('Esa persona no existe o no tiene tienda asignada.', 404);
    const crudos = Array.isArray(datos.paises) ? datos.paises.map(aEntero) : null;
    if (!crudos || !crudos.length || crudos.some(p => p === null || !paises.some(x => x.id === p))) {
      throw errorDeValidacion('Revisa los datos marcados.', { paises: 'Elige al menos un país de la lista.' });
    }
    const deseados = new Set(crudos);
    const defecto = new Set(persona.paisesPorDefecto.map(p => p.id));
    const agregar = [...deseados].filter(p => !defecto.has(p));
    const quitar = [...defecto].filter(p => !deseados.has(p));
    const nombres = (ids) => ids.map(p => paises.find(x => x.id === p).nombre);

    await db.transaccion(async (tx) => {
      await tx.query('DELETE FROM proy_usuario_paises WHERE usuario_id = ?', [persona.id], 'proyectos_alcance:borrar');
      for (const paisId of agregar) await tx.query("INSERT INTO proy_usuario_paises (usuario_id, pais_id, accion, creado_por) VALUES (?, ?, 'agregar', ?)", [persona.id, paisId, adminId], 'proyectos_alcance:agregar');
      for (const paisId of quitar) await tx.query("INSERT INTO proy_usuario_paises (usuario_id, pais_id, accion, creado_por) VALUES (?, ?, 'quitar', ?)", [persona.id, paisId, adminId], 'proyectos_alcance:quitar');
      const antes = { persona: persona.nombre, agregados: persona.agregados.map(p => p.nombre), quitados: persona.quitados.map(p => p.nombre) };
      const despues = { persona: persona.nombre, agregados: nombres(agregar), quitados: nombres(quitar) };
      if (JSON.stringify(antes) !== JSON.stringify(despues)) {
        await configRepository.registrarHistorial(tx, { usuarioId: adminId, entidad: 'alcance', clave: String(persona.id), accion: 'cambiar', antes, despues });
      }
    });
    return (await this.listar()).items.find(p => p.id === persona.id);
  }
}

module.exports = new AlcanceAdminService();
