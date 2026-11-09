// src/modules/proyectos/services/avisosService.js
// Avisos de Proyectos: lee la matriz (valores por defecto de `eventos.js` + lo que cambió el administrador en A8), decide a quién
// avisa un evento, nunca avisa al autor de la acción y entrega por el centro de notificaciones (campana + socket).
const db = require('../../../config/database');
const avisosRepository = require('../repositories/avisosRepository');
const configRepository = require('../repositories/configRepository');
const notificacionService = require('../../../core/notifications/notificacionService');
const { ROLES, EVENTOS, evento } = require('../eventos');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { errorDeValidacion } = require('../errores');

class AvisosService {
  // La matriz completa para la pantalla A8: por evento, cada rol (si aplica y si está encendido) y su anticipación.
  async matriz() {
    const { celdas, anticipaciones } = await avisosRepository.cambios();
    const activo = new Map(celdas.map(c => [`${c.evento}:${c.rol}`, Boolean(c.activo)]));
    const valor = new Map(anticipaciones.map(a => [a.evento, Number(a.valor)]));
    return {
      roles: ROLES,
      eventos: EVENTOS.map(e => ({
        clave: e.clave, nombre: e.nombre, grupo: e.grupo, fase9: Boolean(e.fase9),
        roles: Object.fromEntries(ROLES.map(r => [r, e.roles[r] === undefined ? { aplica: false, activo: false } : { aplica: true, activo: activo.has(`${e.clave}:${r}`) ? activo.get(`${e.clave}:${r}`) : e.roles[r], porDefecto: e.roles[r] }])),
        anticipacion: e.anticipacion ? { valor: valor.has(e.clave) ? valor.get(e.clave) : e.anticipacion.valor, porDefecto: e.anticipacion.valor, unidad: e.anticipacion.unidad, texto: e.anticipacion.texto, min: e.anticipacion.min, max: e.anticipacion.max } : null
      })),
      personalizada: celdas.length > 0 || anticipaciones.length > 0
    };
  }

  // `cambios`: { celdas: [{ evento, rol, activo }], anticipaciones: { evento: valor } }. Solo se guarda lo que difiere de lo que ya había.
  async guardar(usuarioId, cambios = {}) {
    const actual = await this.matriz();
    const porClave = new Map(actual.eventos.map(e => [e.clave, e]));
    const campos = {};
    const celdas = [];
    for (const c of Array.isArray(cambios.celdas) ? cambios.celdas : []) {
      const e = porClave.get(c && c.evento);
      if (!e || !ROLES.includes(c.rol) || !e.roles[c.rol].aplica || typeof c.activo !== 'boolean') { campos[`celdas.${c && c.evento}.${c && c.rol}`] = 'Esa celda no existe.'; continue; }
      if (e.roles[c.rol].activo !== c.activo) celdas.push({ evento: e.clave, rol: c.rol, activo: c.activo, antes: e.roles[c.rol].activo });
    }
    const anticipaciones = [];
    for (const [clave, valor] of Object.entries(cambios.anticipaciones && typeof cambios.anticipaciones === 'object' ? cambios.anticipaciones : {})) {
      const e = porClave.get(clave);
      const n = Number(valor);
      if (!e || !e.anticipacion) { campos[`anticipaciones.${clave}`] = 'Ese evento no tiene anticipación.'; continue; }
      if (!Number.isInteger(n) || n < e.anticipacion.min || n > e.anticipacion.max) { campos[`anticipaciones.${clave}`] = `Escribe un número entero entre ${e.anticipacion.min} y ${e.anticipacion.max}.`; continue; }
      if (e.anticipacion.valor !== n) anticipaciones.push({ evento: clave, valor: n, antes: e.anticipacion.valor });
    }
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos de los avisos.', campos);
    if (!celdas.length && !anticipaciones.length) return false;
    await db.transaccion(async (tx) => {
      for (const c of celdas) {
        await avisosRepository.guardarCelda(tx, { ...c, usuarioId });
        await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'aviso', clave: `${c.evento}:${c.rol}`, accion: 'cambiar', antes: { activo: c.antes }, despues: { activo: c.activo } });
      }
      for (const a of anticipaciones) {
        await avisosRepository.guardarAnticipacion(tx, { ...a, usuarioId });
        await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'aviso', clave: `${a.evento}:anticipacion`, accion: 'cambiar', antes: { valor: a.antes }, despues: { valor: a.valor } });
      }
    });
    return true;
  }

  async restaurar(usuarioId) {
    const { celdas, anticipaciones } = await avisosRepository.cambios();
    if (!celdas.length && !anticipaciones.length) return false;
    await db.transaccion(async (tx) => {
      await avisosRepository.borrarCambios(tx);
      await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'aviso', clave: 'todos', accion: 'restaurar', antes: { celdas: celdas.length, anticipaciones: anticipaciones.length }, despues: null });
    });
    return true;
  }

  async anticipacion(clave) {
    const m = await this.matriz();
    const e = m.eventos.find(x => x.clave === clave);
    return e && e.anticipacion ? e.anticipacion.valor : null;
  }

  // Avisa un evento. `explicitos`: { asesor: [ids], supervisor: [ids] } cuando los destinatarios no se deducen del proyecto.
  // Devuelve los usuarios avisados. Nunca avisa a `autorId`.
  async notificar(clave, { proyectoId = null, autorId = null, explicitos = {}, mensaje, referenciaTipo = 'participacion', referenciaId = null, nivel = 'info' }) {
    if (!evento(clave)) throw new ErrorDeNegocio(`Evento de aviso desconocido: ${clave}.`, 500);
    const m = await this.matriz();
    const fila = m.eventos.find(e => e.clave === clave);
    const destinatarios = new Set();
    for (const rol of ROLES) {
      if (!fila.roles[rol].aplica || !fila.roles[rol].activo) continue;
      let ids = explicitos[rol];
      if (!ids) ids = rol === 'supervisor' && proyectoId ? await avisosRepository.supervisoresDelProyecto(proyectoId) : rol === 'gerente' ? await avisosRepository.gerentes() : [];
      ids.forEach(id => destinatarios.add(id));
    }
    if (autorId !== null) destinatarios.delete(autorId);
    const lista = [...destinatarios];
    if (!lista.length) return [];
    await notificacionService.registrar(lista, { modulo: 'proyectos', tipo: clave, referenciaTipo, referenciaId, nivel, mensaje });
    return lista;
  }
}

module.exports = new AvisosService();
