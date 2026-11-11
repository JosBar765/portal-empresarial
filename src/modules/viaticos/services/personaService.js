// src/modules/viaticos/services/personaService.js
// Quién puede viajar: licencia y países de cada usuario activo.
const db = require('../../../config/database');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const repo = require('../repositories/personaRepository');
const referencias = require('../repositories/referenciaRepository');
const { Validador, cuerpoObjeto, vacio } = require('../validacion');
const { errorDeValidacion } = require('../errores');
const { aEntero } = require('../../../core/utils/validar');
const { msg } = require('../mensajes');

function licenciaDe(fila) {
  if (!fila) return null;
  const { usuarioId, ...licencia } = fila;
  return licencia;
}

function paisesDe(filas) {
  return filas.map(({ id, codigo, nombre }) => ({ id, codigo, nombre }));
}

// Devuelve { licencia: {...} | null, paisIds: [...] } ya validado.
function validar(cuerpo) {
  const datos = cuerpoObjeto(cuerpo);
  const v = new Validador();
  let licencia = null;

  if (datos.licencia !== undefined && datos.licencia !== null) {
    if (typeof datos.licencia !== 'object' || Array.isArray(datos.licencia)) throw new ErrorDeNegocio(msg('persona.licenciaObjeto'), 400);
    const l = datos.licencia;
    const todoVacio = vacio(l.tipoLicenciaId) && vacio(l.numero) && vacio(l.venceEl);
    if (!todoVacio) {
      const campos = {
        tipoLicenciaId: v.id(l, 'tipoLicenciaId', 'Tipo de licencia', { requerido: false }),
        numero: v.texto(l, 'numero', 'Número de licencia', { max: 50, requerido: false }),
        venceEl: v.fecha(l, 'venceEl', 'Vencimiento de la licencia', { requerido: false })
      };
      const incompleta = Object.values(campos).some(valor => valor === null);
      if (incompleta && Object.keys(v.campos).length === 0) v.falla('licencia', msg('persona.licenciaIncompleta'));
      licencia = campos;
    }
  }

  let paisIds = [];
  if (!Array.isArray(datos.paisIds)) {
    v.falla('paisIds', msg('persona.paisesLista'));
  } else {
    paisIds = datos.paisIds.map(aEntero);
    if (paisIds.includes(null)) v.falla('paisIds', msg('persona.paisesLista'));
    paisIds = [...new Set(paisIds)];
  }
  v.lanzar();
  return { licencia, paisIds };
}

class PersonaService {
  async listar() {
    const [usuarios, licencias, paises] = await Promise.all([repo.listarUsuariosActivos(), repo.listarLicencias(), repo.listarPaisesDeTodos()]);
    const licenciaPorUsuario = new Map(licencias.map(l => [l.usuarioId, licenciaDe(l)]));
    const paisesPorUsuario = new Map();
    for (const fila of paises) {
      if (!paisesPorUsuario.has(fila.usuarioId)) paisesPorUsuario.set(fila.usuarioId, []);
      paisesPorUsuario.get(fila.usuarioId).push({ id: fila.id, codigo: fila.codigo, nombre: fila.nombre });
    }
    return usuarios.map(u => ({ ...u, licencia: licenciaPorUsuario.get(u.id) || null, paises: paisesPorUsuario.get(u.id) || [] }));
  }

  async obtener(usuarioId) {
    const usuario = await repo.obtenerUsuarioActivo(usuarioId);
    if (!usuario) throw new ErrorDeNegocio(msg('persona.noExiste', { id: usuarioId }), 404);
    const [licencia, paises] = await Promise.all([repo.obtenerLicencia(usuarioId), repo.listarPaisesDe(usuarioId)]);
    return { ...usuario, licencia: licenciaDe(licencia), paises: paisesDe(paises) };
  }

  // Licencia y países se guardan juntos: o quedan los dos o ninguno.
  async guardar(usuarioId, cuerpo) {
    const { licencia, paisIds } = validar(cuerpo);
    if (!(await repo.obtenerUsuarioActivo(usuarioId))) throw new ErrorDeNegocio(msg('persona.noExiste', { id: usuarioId }), 404);

    const campos = {};
    if (licencia && !(await referencias.tipoLicenciaExiste(licencia.tipoLicenciaId))) campos.licencia = msg('persona.tipoLicenciaNoExiste');
    if ((await referencias.contarPaises(paisIds)) !== paisIds.length) campos.paisIds = msg('persona.paisNoExiste');
    if (Object.keys(campos).length > 0) throw errorDeValidacion(msg('validacion.revisar'), campos);

    await db.transaccion(async tx => {
      if (licencia) await repo.guardarLicencia(usuarioId, licencia, tx);
      else await repo.quitarLicencia(usuarioId, tx);
      await repo.reemplazarPaises(usuarioId, paisIds, tx);
    });
    return this.obtener(usuarioId);
  }
}

module.exports = new PersonaService();
