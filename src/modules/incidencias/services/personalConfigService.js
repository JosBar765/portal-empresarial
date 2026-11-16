// src/modules/incidencias/services/personalConfigService.js
// Quién atiende (técnicos) y quién verifica (verificadores). Las personas se crean en Administración; aquí solo se elige
// quiénes cumplen estas funciones y qué cubren. Si a alguien le falta el permiso de su rol, se avisa en el listado.
const configRepository = require('../repositories/configRepository');
const { errorDeValidacion, conflicto, limpio } = require('../errores');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');

const REVISAR = 'Revisa los datos marcados.';
const comoBooleano = (v) => (v === true || v === 'true' || v === 1 || v === '1' ? true : (v === false || v === 'false' || v === 0 || v === '0' ? false : null));

class PersonalConfigService {
  async _historial(usuario, entidad, clave, accion, antes, despues) {
    try { await configRepository.registrarHistorial({ usuarioId: usuario.id, entidad, clave, accion, antes, despues }); } catch (error) { console.error('[Incidencias] No se pudo anotar el cambio de configuración:', error.message); }
  }

  // --- Técnicos ---

  async tecnicos() {
    const filas = await configRepository.tecnicos();
    return {
      tecnicos: filas.map(f => ({
        usuarioId: f.usuario_id, nombre: f.nombre, email: f.email, rol: f.rol, activo: Boolean(f.activo), todasLasTiendas: Boolean(f.todas_las_tiendas),
        especialidades: f.especialidades, tiendas: f.tiendas, abiertas: Number(f.abiertas),
        // Sin el permiso «Atender incidencias» en su rol, la persona está registrada pero no podrá tomar nada.
        sinPermiso: !f.con_permiso
      }))
    };
  }

  async candidatos(query = {}) {
    const filas = await configRepository.candidatosTecnico(limpio(query.q).slice(0, 60));
    return { candidatos: filas.map(f => ({ id: f.id, nombre: f.nombre, email: f.email, rol: f.rol, sinPermiso: !f.con_permiso })) };
  }

  async candidatosVerificador(query = {}) {
    const filas = await configRepository.personasParaVerificar(limpio(query.q).slice(0, 60));
    return { candidatos: filas.map(f => ({ id: f.id, nombre: f.nombre, email: f.email, rol: f.rol, sinPermiso: !f.con_permiso })) };
  }

  async _cobertura(datos, { obligatorioSiNoTodas }) {
    const errores = {};
    const especialidadIds = [];
    if (datos.especialidadIds !== undefined) {
      if (!Array.isArray(datos.especialidadIds)) errores.especialidadIds = 'Elige las especialidades de la lista.';
      else {
        for (const e of datos.especialidadIds) {
          const id = aEntero(e);
          if (!id || !(await configRepository.existe('incidencia_especialidades', id))) { errores.especialidadIds = 'Una de las especialidades ya no existe.'; break; }
          especialidadIds.push(id);
        }
      }
    }
    let todasLasTiendas = null;
    if (datos.todasLasTiendas !== undefined) {
      todasLasTiendas = comoBooleano(datos.todasLasTiendas);
      if (todasLasTiendas === null) errores.todasLasTiendas = 'Indica si cubre todas las tiendas.';
    }
    const tiendaIds = [];
    if (datos.tiendaIds !== undefined) {
      if (!Array.isArray(datos.tiendaIds)) errores.tiendaIds = 'Elige las tiendas de la lista.';
      else {
        for (const t of datos.tiendaIds) {
          const id = aEntero(t);
          if (!id || !(await configRepository.existe('tiendas', id))) { errores.tiendaIds = 'Una de las tiendas ya no existe.'; break; }
          tiendaIds.push(id);
        }
      }
    }
    return { errores, especialidadIds: [...new Set(especialidadIds)], todasLasTiendas, tiendaIds: [...new Set(tiendaIds)], obligatorioSiNoTodas };
  }

  async agregarTecnico(usuario, datos) {
    const usuarioId = aEntero(datos.usuarioId);
    if (!usuarioId) throw errorDeValidacion(REVISAR, { usuarioId: 'Elige a la persona.' });
    const persona = await configRepository.usuarioActivo(usuarioId);
    if (!persona) throw errorDeValidacion(REVISAR, { usuarioId: 'Esa persona no existe o está desactivada.' });
    if (await configRepository.tecnico(usuarioId)) throw conflicto('Esa persona ya es técnico.');
    const c = await this._cobertura(datos, { obligatorioSiNoTodas: true });
    const todas = c.todasLasTiendas === null ? true : c.todasLasTiendas;
    if (!todas && !c.tiendaIds.length && !c.errores.tiendaIds) c.errores.tiendaIds = 'Elige al menos una tienda o marca «todas las tiendas».';
    if (Object.keys(c.errores).length) throw errorDeValidacion(REVISAR, c.errores);
    await configRepository.guardarTecnico(usuarioId, { activo: true, todasLasTiendas: todas, especialidadIds: c.especialidadIds, tiendaIds: c.tiendaIds }, true);
    await this._historial(usuario, 'tecnico', persona.nombre, 'crear', null, { todasLasTiendas: todas, especialidades: c.especialidadIds, tiendas: c.tiendaIds });
    return this.tecnicos();
  }

  async actualizarTecnico(usuario, usuarioId, datos) {
    const actual = await configRepository.tecnico(usuarioId);
    if (!actual) throw new ErrorDeNegocio('Esa persona no es técnico.', 404);
    const persona = await configRepository.usuarioActivo(usuarioId);
    const errores = {};
    let activo = Boolean(actual.activo);
    if (datos.activo !== undefined) {
      const a = comoBooleano(datos.activo);
      if (a === null) errores.activo = 'Indica si está activo.'; else activo = a;
    }
    const c = await this._cobertura(datos, { obligatorioSiNoTodas: true });
    Object.assign(errores, c.errores);
    const todas = c.todasLasTiendas === null ? Boolean(actual.todas_las_tiendas) : c.todasLasTiendas;
    // Lo que no se manda se conserva.
    const filas = await configRepository.tecnicos();
    const previo = filas.find(f => f.usuario_id === usuarioId) || { especialidades: [], tiendas: [] };
    const especialidadIds = datos.especialidadIds !== undefined ? c.especialidadIds : previo.especialidades.map(e => e.id);
    const tiendaIds = datos.tiendaIds !== undefined ? c.tiendaIds : previo.tiendas.map(t => t.id);
    if (!todas && !tiendaIds.length && !errores.tiendaIds) errores.tiendaIds = 'Elige al menos una tienda o marca «todas las tiendas».';
    if (!activo && actual.activo) {
      const abiertas = await configRepository.abiertasDeTecnico(usuarioId);
      if (abiertas > 0) errores.activo = `Tiene ${abiertas} incidencia${abiertas === 1 ? '' : 's'} abierta${abiertas === 1 ? '' : 's'}. Reasígnalas o devuélvelas al buzón antes de desactivarlo.`;
    }
    if (Object.keys(errores).length) throw errorDeValidacion(REVISAR, errores);
    await configRepository.guardarTecnico(usuarioId, { activo, todasLasTiendas: todas, especialidadIds, tiendaIds }, false);
    await this._historial(usuario, 'tecnico', (persona && persona.nombre) || String(usuarioId), activo !== Boolean(actual.activo) ? (activo ? 'encender' : 'apagar') : 'cambiar',
      { activo: Boolean(actual.activo), todasLasTiendas: Boolean(actual.todas_las_tiendas), especialidades: previo.especialidades.map(e => e.id), tiendas: previo.tiendas.map(t => t.id) },
      { activo, todasLasTiendas: todas, especialidades: especialidadIds, tiendas: tiendaIds });
    return this.tecnicos();
  }

  // --- Verificadores ---

  // Por país y por tienda, con quién verifica de verdad cada tienda y cuáles se quedan sin verificador.
  async verificadores() {
    const [tiendas, filas, paises] = await Promise.all([configRepository.tiendasHabilitadas(), configRepository.verificadores(), configRepository.paises()]);
    const persona = (v) => ({ id: v.id, usuarioId: v.usuario_id, nombre: v.nombre, sinPermiso: !v.con_permiso });
    const porPais = new Map();
    for (const p of paises.filter(x => x.habilitado)) porPais.set(p.id, { id: p.id, nombre: p.nombre, verificadores: filas.filter(v => v.pais_id === p.id).map(persona) });
    const listaTiendas = tiendas.map(t => {
      const propios = filas.filter(v => v.tienda_id === t.id).map(persona);
      const delPais = (porPais.get(t.pais_id) || { verificadores: [] }).verificadores;
      return { id: t.id, codigo: t.codigo, empresa: t.empresa, departamento: t.departamento, subdivision: t.subdivision, pais: t.pais, paisId: t.pais_id, verificadores: propios, efectivo: propios.length ? 'tienda' : (delPais.length ? 'pais' : null) };
    });
    return { paises: [...porPais.values()], tiendas: listaTiendas, sinVerificador: listaTiendas.filter(t => !t.efectivo).length };
  }

  async agregarVerificador(usuario, datos) {
    const usuarioId = aEntero(datos.usuarioId);
    const tiendaId = datos.tiendaId === undefined || datos.tiendaId === null || datos.tiendaId === '' ? null : aEntero(datos.tiendaId);
    const paisId = datos.paisId === undefined || datos.paisId === null || datos.paisId === '' ? null : aEntero(datos.paisId);
    const errores = {};
    if (!usuarioId) errores.usuarioId = 'Elige a la persona.';
    else if (!(await configRepository.usuarioActivo(usuarioId))) errores.usuarioId = 'Esa persona no existe o está desactivada.';
    if ((tiendaId && paisId) || (!tiendaId && !paisId)) errores.tiendaId = 'Elige una tienda o un país (no los dos).';
    else if (tiendaId && !(await configRepository.existe('tiendas', tiendaId))) errores.tiendaId = 'Esa tienda no existe.';
    else if (paisId && !(await configRepository.pais(paisId))) errores.paisId = 'Ese país no existe.';
    if (Object.keys(errores).length) throw errorDeValidacion(REVISAR, errores);
    if (await configRepository.verificadorExiste(usuarioId, tiendaId, paisId)) throw conflicto(tiendaId ? 'Esa persona ya verifica esta tienda.' : 'Esa persona ya verifica este país.');
    const id = await configRepository.agregarVerificador(usuarioId, tiendaId, paisId);
    const persona = await configRepository.usuarioActivo(usuarioId);
    await this._historial(usuario, 'verificador', persona.nombre, 'crear', null, { tiendaId, paisId });
    return { ...(await this.verificadores()), creadoId: id };
  }

  async quitarVerificador(usuario, id) {
    const actual = await configRepository.verificador(id);
    if (!actual) throw new ErrorDeNegocio('Ese verificador ya no existe.', 404);
    await configRepository.quitarVerificador(id);
    await this._historial(usuario, 'verificador', actual.nombre, 'quitar', { tiendaId: actual.tienda_id, paisId: actual.pais_id }, null);
    return this.verificadores();
  }
}

module.exports = new PersonalConfigService();
