// src/modules/vales/services/valeDetalleService.js
// Detalle de un vale: control de acceso por rol y filtrado del historial de
// auditoría según qué le corresponde ver a cada rol.
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const documentoRepository = require('../repositories/documentoRepository');
const historialRepository = require('../repositories/historialRepository');
const solicitudModificacionRepository = require('../repositories/solicitudModificacionRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeCatalogoService = require('./valeCatalogoService');
const {
  ESTADOS, ROL, ROLES_ENCARGADO_TALLER, ROLES_TALLER_Y_TECNICO,
  esAdministrador, enriquecer
} = require('./valeHelpers');

// Clasifica cada fila de vale_historial en una categoría estable, a partir
// de (estado_anterior, estado_nuevo, accion) — el mismo par de estados
// nunca se reutiliza con un significado distinto salvo el caso
// EN_PROCESO→EN_REVISION (entrega vs. cancelación), donde el texto de
// `accion` sí distingue. `filtrarHistorialPorRol` arma sus listas blancas
// por rol sobre estas categorías en vez de comparar estados sueltos a mano.
function categoriaHistorial(h) {
  const ea = h.estado_anterior;
  const en = h.estado_nuevo;
  if (ea === null) return 'CREACION'; // crearVale() y la creación del vale MOD- nuevo
  if (ea === 'ESPERANDO_AUTORIZACION' && en === 'CREADO') return 'AUTORIZACION_CREACION';
  if (ea === 'PENDIENTE_ASIGNACION' && en === 'ASIGNADO') return 'ASIGNACION';
  if (ea === 'ASIGNADO' && en === 'EN_PROCESO') return 'EN_PROCESO';
  if (ea === 'EN_PROCESO' && en === 'EN_PAUSA') return 'PAUSA';
  if (ea === 'EN_PAUSA' && en === 'EN_PROCESO') return 'REANUDACION';
  if (ea === 'EN_PROCESO' && en === 'EN_REVISION') return /cancel/i.test(h.accion) ? 'CANCELACION_PROCESO' : 'ENTREGA_PROPUESTA';
  if (ea === 'EN_REVISION' && en === 'APROBADO') return 'APROBACION_TALLER';
  if (ea === 'EN_REVISION' && en === 'ASIGNADO') return 'DESAPROBACION_REASIGNACION';
  if (en === 'PENDIENTE_CONFIRMACION') return 'RETORNO_ASESOR'; // directo o por fusión — el vale "vuelve" al asesor
  if (en === 'APROBADO_DEPARTAMENTO') return 'PENDIENTE_FUSION'; // bookkeeping interno, nadie lo pidió ver
  if (ea === 'PENDIENTE_CONFIRMACION' && en === 'RECIBIDO') return 'CONFIRMACION_RECIBIDO';
  if (ea === 'SOLICITANDO_MODIFICACION' && en === 'CONFIRMADO') return 'APROBACION_MODIFICACION_ORIGINAL';
  if (en === 'SOLICITANDO_MODIFICACION') return 'SOLICITUD_MODIFICACION';
  return 'OTRO';
}

class ValeDetalleService {
  // Wrapper de _puedeVerVale que resuelve el vale y sus talleres a partir
  // del id — reusado por obtenerValeParaPdf (cierre del IDOR de descarga de
  // PDF) y por la validación de la sala `vale:<id>` en el WebSocket (ver
  // events.js), para no duplicar el criterio de pertenencia en 3 lugares.
  async puedeVerValePorId(usuario, valeId) {
    const vale = await valeRepository.obtenerPorId(valeId);
    if (!vale) return false;
    const talleres = await valeTallerRepository.listarPorVale(valeId);
    return this._puedeVerVale(usuario, vale, talleres);
  }

  async obtenerDetalle(usuario, valeId) {
    const vale = await valeRepository.obtenerPorId(valeId);
    if (!vale) throw new Error('Vale de arte no encontrado.');
    const talleres = await valeTallerRepository.listarPorVale(valeId);
    if (!(await this._puedeVerVale(usuario, vale, talleres))) {
      throw new Error('No tienes acceso a este vale de arte.');
    }
    const [propuestas, documentos, historial] = await Promise.all([
      propuestaRepository.listarPorVale(valeId),
      documentoRepository.listarPorVale(valeId),
      historialRepository.listarPorVale(valeId)
    ]);
    const talleresConNombre = await this._enriquecerTalleresConNombre(talleres);
    const historialConActor = await this._enriquecerHistorialConActor(historial);
    const historialVisible = await this._filtrarHistorialPorRol(usuario, historialConActor);

    // El supervisor necesita ver la justificación al decidir si autoriza la
    // modificación — se adjunta solo cuando aplica, reusando la misma
    // consulta que ya usa aprobarModificacion() en valeConfirmacionService.
    let solicitudModificacion = null;
    if (vale.estado === ESTADOS.SOLICITANDO_MODIFICACION) {
      const solicitud = await solicitudModificacionRepository.obtenerPendientePorValeOriginal(valeId);
      if (solicitud) solicitudModificacion = { justificacion: solicitud.justificacion };
    }

    return { ...enriquecer(vale), talleres: talleresConNombre, propuestas, documentos, historial: historialVisible, solicitudModificacion };
  }

  // Control de propiedad: cada rol solo puede pedir el detalle de un vale
  // dentro de su propia cobertura (mismo criterio que usa el buzón), nunca
  // de cualquier vale por id sin importar su rol/cobertura.
  async _puedeVerVale(usuario, vale, talleres) {
    if (esAdministrador(usuario) || usuario.rolId === ROL.GERENTE) return true; // Gerente: solo lectura de todo
    if (usuario.rolId === ROL.ASESOR) return vale.asesor_id === usuario.id;
    if (usuario.rolId === ROL.SUPERVISOR) {
      const misAsesoresIds = new Set((await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id)).map(a => a.id));
      return misAsesoresIds.has(vale.asesor_id);
    }
    if (ROLES_TALLER_Y_TECNICO.includes(usuario.rolId)) {
      const tallerVisible = await this._tallerIdVisiblePara(usuario);
      return !!tallerVisible && talleres.some(t => t.taller_id === tallerVisible);
    }
    // Rol no contemplado explícitamente arriba: fail-closed. No explotable
    // con los roles actuales (todos caen en alguna rama de arriba) — es una
    // salvaguarda para si se agrega un rol nuevo sin actualizar esta
    // función, que antes fallaba abierto (veía TODOS los vales).
    return false;
  }

  // Cada rol tiene una lista blanca de categorías (ver categoriaHistorial):
  // - Asesor y Supervisor: creación, autorización de creación, retorno al
  //   asesor (directo o por fusión), confirmación de recibido, y — si hubo
  //   modificación — solicitud/aprobación de la modificación. Ambos ven
  //   exactamente lo mismo (el supervisor es quien autoriza y aprueba, pero
  //   nunca el detalle interno de un taller).
  // - Gerente: lo mismo que el asesor, más "cuándo se asignó" y "cuándo se
  //   aprobó" a nivel de TODOS los talleres, sin importar a quién ni cuál taller.
  // - Encargados de taller: autorización de creación (sin scope de taller) +
  //   su propio ciclo de asignación/proceso/pausa/reanudación/entrega-o-
  //   cancelación/aprobación/reasignación, acotado a SU taller — nunca lo que
  //   pasó en otro taller del mismo vale, ni los eventos de nivel de vale
  //   (creación, retorno, confirmación, modificación) que antes se colaban
  //   por tener taller_id null.
  // - Técnico: el mismo ciclo, pero acotado ADEMÁS a que el evento sea suyo —
  //   `usuario_id` para lo que él mismo ejecuta, `tecnico_id` para lo que un
  //   encargado hizo SOBRE él (asignación/aprobación/reasignación). Las filas
  //   sembradas antes de que existiera la columna `tecnico_id` caen a un
  //   respaldo por nombre en el texto de `accion` (best-effort, solo para
  //   datos históricos previos a esta corrección).
  async _filtrarHistorialPorRol(usuario, historial) {
    if (!usuario || usuario.rolId === ROL.ADMINISTRADOR) return historial; // Administrador: todo, sin filtrar

    const conCategoria = historial.map(h => ({ ...h, _categoria: categoriaHistorial(h) }));
    const sinCategoria = (h) => { const { _categoria, ...resto } = h; return resto; };

    if (usuario.rolId === ROL.ASESOR || usuario.rolId === ROL.SUPERVISOR) {
      const permitidas = new Set([
        'CREACION', 'AUTORIZACION_CREACION', 'RETORNO_ASESOR',
        'CONFIRMACION_RECIBIDO', 'SOLICITUD_MODIFICACION', 'APROBACION_MODIFICACION_ORIGINAL'
      ]);
      return conCategoria.filter(h => permitidas.has(h._categoria)).map(sinCategoria);
    }

    if (usuario.rolId === ROL.GERENTE) {
      const permitidas = new Set([
        'CREACION', 'AUTORIZACION_CREACION', 'ASIGNACION', 'APROBACION_TALLER',
        'RETORNO_ASESOR', 'CONFIRMACION_RECIBIDO', 'SOLICITUD_MODIFICACION', 'APROBACION_MODIFICACION_ORIGINAL'
      ]);
      return conCategoria.filter(h => permitidas.has(h._categoria)).map(sinCategoria);
    }

    if (ROLES_ENCARGADO_TALLER.includes(usuario.rolId)) {
      const tallerVisible = await this._tallerIdVisiblePara(usuario);
      if (!tallerVisible) return [];
      const cicloTaller = new Set([
        'ASIGNACION', 'EN_PROCESO', 'PAUSA', 'REANUDACION',
        'ENTREGA_PROPUESTA', 'CANCELACION_PROCESO', 'APROBACION_TALLER', 'DESAPROBACION_REASIGNACION'
      ]);
      return conCategoria
        .filter(h => h._categoria === 'AUTORIZACION_CREACION' || (cicloTaller.has(h._categoria) && h.taller_id === tallerVisible))
        .map(sinCategoria);
    }

    if (usuario.rolId === ROL.TECNICO) {
      const tallerVisible = await this._tallerIdVisiblePara(usuario);
      if (!tallerVisible) return [];
      const propias = new Set(['EN_PROCESO', 'PAUSA', 'REANUDACION', 'ENTREGA_PROPUESTA', 'CANCELACION_PROCESO']);
      const deUnEncargado = new Set(['ASIGNACION', 'APROBACION_TALLER', 'DESAPROBACION_REASIGNACION']);
      return conCategoria
        .filter(h => {
          if (h.taller_id !== tallerVisible) return false;
          if (propias.has(h._categoria)) return h.usuario_id === usuario.id;
          if (deUnEncargado.has(h._categoria)) {
            if (h.tecnico_id != null) return h.tecnico_id === usuario.id;
            return !!(usuario.nombre && h.accion && h.accion.includes(usuario.nombre));
          }
          return false;
        })
        .map(sinCategoria);
    }

    // Rol no contemplado explícitamente arriba: fail-closed (mismo criterio
    // que _puedeVerVale) — sin esto, un rol nuevo sin regla propia vería
    // TODO el historial de auditoría sin restricción.
    return [];
  }

  async _tallerIdVisiblePara(usuario) {
    const talleres = await tallerRepository.listarActivos();
    if (ROLES_ENCARGADO_TALLER.includes(usuario.rolId)) {
      const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
      const propio = talleres.find(t => t.encargado_id === idEfectivo);
      return propio ? propio.id : null;
    }
    if (usuario.rolId === ROL.TECNICO) {
      // El taller del técnico sale directo de `taller_tecnicos`, sin pasar
      // por el id del encargado.
      const tecnico = await usuarioValeRepository.obtenerPorId(usuario.id);
      return tecnico && tecnico.taller_id ? tecnico.taller_id : null;
    }
    return null;
  }

  async _enriquecerTalleresConNombre(talleres) {
    const catalogo = await tallerRepository.listarActivos();
    return Promise.all(talleres.map(async t => {
      const taller = catalogo.find(x => x.id === t.taller_id);
      const tecnico = t.tecnico_id ? await usuarioValeRepository.obtenerPorId(t.tecnico_id) : null;
      return { ...t, taller_nombre: taller ? taller.nombre : `#${t.taller_id}`, tecnico_nombre: tecnico ? tecnico.nombre : null };
    }));
  }

  // El historial solo guarda usuario_id; aquí se resuelve al nombre completo
  // del actor para mostrar quién hizo la acción, no solo su rol/qué pasó. Se
  // muestra el nombre completo tal cual (usuarios sembrados cuyo `nombre` es
  // un cargo, como "Encargado de Diseño", no deben truncarse a medias).
  async _enriquecerHistorialConActor(historial) {
    const idsUnicos = [...new Set(historial.map(h => h.usuario_id))];
    const usuarios = await Promise.all(idsUnicos.map(id => usuarioValeRepository.obtenerPorId(id)));
    const mapaNombres = new Map(idsUnicos.map((id, idx) => [id, usuarios[idx] ? usuarios[idx].nombre : null]));
    return historial.map(h => ({ ...h, actor_nombre: mapaNombres.get(h.usuario_id) || null }));
  }
}

module.exports = new ValeDetalleService();
