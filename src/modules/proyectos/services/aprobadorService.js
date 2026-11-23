// src/modules/proyectos/services/aprobadorService.js
// Quién aprueba la activación de un proyecto y quién da el visto bueno al cierre: lo asigna el administrador por persona.
// En la sesión se traducen a los permisos virtuales `proyectos.aprobar_activacion` y `proyectos.dar_visto_bueno`, así las
// guardas y los servicios siguen decidiendo por permiso. Cada cambio queda en el historial de configuración.
const db = require('../../../config/database');
const aprobadorRepository = require('../repositories/aprobadorRepository');
const configRepository = require('../repositories/configRepository');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');

const PASOS = { activacion: 'proyectos.aprobar_activacion', visto_bueno: 'proyectos.dar_visto_bueno' };
const PERMISOS_VIRTUALES = Object.values(PASOS);

class AprobadorService {
  // Permisos de la sesión: los de su rol, sin los dos de aprobación, más los de los pasos que tiene asignados.
  async permisosDe(usuario) {
    const base = (usuario.permissions || []).filter(p => !PERMISOS_VIRTUALES.includes(p));
    const pasos = await aprobadorRepository.pasosDe(usuario.id);
    return [...base, ...pasos.map(p => PASOS[p])];
  }

  async listar() {
    const [filas, candidatos] = await Promise.all([aprobadorRepository.listar(), aprobadorRepository.candidatos()]);
    const porPaso = (paso) => filas.filter(f => f.paso === paso).map(f => ({ id: f.id, nombre: f.nombre, rol: f.rol }));
    return { activacion: porPaso('activacion'), vistoBueno: porPaso('visto_bueno'), candidatos: candidatos.map(c => ({ id: c.id, nombre: c.nombre, rol: c.rol })) };
  }

  // `cambios`: { activacion: [ids], vistoBueno: [ids] }; lo que no venga no se toca.
  async guardar(cambios, usuarioId) {
    const candidatos = new Set((await aprobadorRepository.candidatos()).map(c => c.id));
    const actuales = await this.listar();
    const nombre = new Map(actuales.candidatos.map(c => [c.id, c.nombre]));
    const pasos = [['activacion', 'activacion', 'Quién aprueba la activación'], ['visto_bueno', 'vistoBueno', 'Quién da el visto bueno']];
    const trabajos = [];
    for (const [paso, clave, etiqueta] of pasos) {
      if (!(clave in cambios)) continue;
      if (!Array.isArray(cambios[clave])) throw errorDeValidacion('Revisa los aprobadores.', { [clave]: 'Elige personas de la lista.' });
      const ids = [...new Set(cambios[clave].map(aEntero))];
      if (ids.some(id => id === null || !candidatos.has(id))) throw errorDeValidacion('Revisa los aprobadores.', { [clave]: 'Elige solo personas con acceso a Proyectos.' });
      const antes = actuales[clave].map(p => p.id).sort((a, b) => a - b);
      if (JSON.stringify(antes) === JSON.stringify([...ids].sort((a, b) => a - b))) continue;
      trabajos.push({ paso, ids, etiqueta, antes: actuales[clave].map(p => p.nombre).join(', ') || 'Nadie', despues: ids.map(id => nombre.get(id)).join(', ') || 'Nadie' });
    }
    if (!trabajos.length) return this.listar();
    await db.transaccion(async (tx) => {
      for (const t of trabajos) {
        await aprobadorRepository.reemplazar(tx, t.paso, t.ids, usuarioId);
        await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'aprobadores', clave: t.paso, accion: 'cambiar', antes: { personas: t.antes }, despues: { personas: t.despues } });
      }
    });
    return this.listar();
  }

  idsDe(paso) {
    return aprobadorRepository.idsDe(paso);
  }
}

module.exports = new AprobadorService();
module.exports.PASOS = PASOS;
