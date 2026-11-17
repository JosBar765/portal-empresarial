// src/modules/incidencias/services/alcanceService.js
// Quién ve cada incidencia y qué puede hacer con ella. Todo se decide aquí, en el servidor: ocultar un botón no es control de acceso.
const db = require('../../../config/database');
const personal = require('../repositories/personalRepository');
const incidenciaRepository = require('../repositories/incidenciaRepository');
const { ESTADOS, ABIERTOS, EN_TRABAJO, PERMISO } = require('../constantes');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

const sinTerminar = [ESTADOS.EN_BUZON, ESTADOS.EN_PROCESO, ESTADOS.EN_ESPERA, ESTADOS.CORRECCION_PEDIDA];

// Cada acción: el permiso que pide, los estados en que cabe y la relación que debe tener la persona con esa incidencia.
const REGLAS = {
  tomar: { permiso: PERMISO.RESOLVER, estados: [ESTADOS.EN_BUZON], rol: (rel) => rel.cubre },
  avance: { permiso: PERMISO.RESOLVER, estados: EN_TRABAJO, rol: (rel) => rel.esResponsable },
  espera: { permiso: PERMISO.RESOLVER, estados: EN_TRABAJO, rol: (rel) => rel.esResponsable },
  reanudar: { permiso: PERMISO.RESOLVER, estados: [ESTADOS.EN_ESPERA], rol: (rel) => rel.esResponsable },
  enviarVerificacion: { permiso: PERMISO.RESOLVER, estados: EN_TRABAJO, rol: (rel) => rel.esResponsable },
  devolver: { permiso: PERMISO.RESOLVER, estados: [ESTADOS.EN_PROCESO, ESTADOS.EN_ESPERA, ESTADOS.CORRECCION_PEDIDA], rol: (rel) => rel.esResponsable },
  aprobar: { permiso: PERMISO.VERIFICAR, estados: [ESTADOS.EN_VERIFICACION], rol: (rel) => rel.verifica && !rel.esResponsable && !rel.trabajo },
  pedirCorreccion: { permiso: PERMISO.VERIFICAR, estados: [ESTADOS.EN_VERIFICACION], rol: (rel) => rel.verifica && !rel.esResponsable && !rel.trabajo },
  reasignar: { permiso: PERMISO.ASIGNAR, estados: sinTerminar, rol: (rel) => rel.verifica },
  descartar: { permiso: PERMISO.ASIGNAR, estados: sinTerminar, rol: (rel) => rel.verifica },
  cambiarPrioridad: { permiso: PERMISO.ASIGNAR, estados: ABIERTOS, rol: (rel) => rel.verifica },
  comentar: { permiso: PERMISO.VER, estados: ABIERTOS, rol: (rel) => rel.esReportante || rel.esResponsable || rel.verificaConPermiso }
};

const MENSAJES_ROL = {
  tomar: 'No cubres la tienda de esta incidencia.',
  aprobar: 'No puedes aprobar esta incidencia: quien trabajó en ella no puede verificarla, y solo verifica quien está a cargo de la tienda.',
  pedirCorreccion: 'No puedes pedir una corrección en esta incidencia: quien trabajó en ella no puede verificarla, y solo verifica quien está a cargo de la tienda.',
  reasignar: 'Solo quien está a cargo de la tienda puede reasignar esta incidencia.',
  descartar: 'Solo quien está a cargo de la tienda puede descartar esta incidencia.',
  cambiarPrioridad: 'Solo quien está a cargo de la tienda puede cambiar la prioridad.',
  comentar: 'No puedes comentar en esta incidencia.'
};
const MENSAJE_ROL_POR_DEFECTO = 'Solo el técnico que tomó esta incidencia puede hacer esto.';

class AlcanceService {
  tiene(usuario, permiso) {
    return ((usuario && usuario.permissions) || []).includes(permiso);
  }

  // La relación de una persona con una incidencia (la fila de `incidenciaRepository`). `ejecutor`: la conexión de la transacción.
  async relacion(usuario, inc, ejecutor = db) {
    const resolver = this.tiene(usuario, PERMISO.RESOLVER);
    const verificaConPermiso = this.tiene(usuario, PERMISO.VERIFICAR) || this.tiene(usuario, PERMISO.ASIGNAR);
    const cubre = resolver && inc.tecnico_id !== usuario.id ? await personal.tecnicoCubre(usuario.id, inc.tienda_id, ejecutor) : resolver;
    const verifica = verificaConPermiso ? await personal.verificaTienda(usuario.id, inc.tienda_id, ejecutor) : false;
    const trabajo = this.tiene(usuario, PERMISO.VERIFICAR) ? await incidenciaRepository.trabajoEn(inc.id, usuario.id, ejecutor) : false;
    return {
      esReportante: inc.reportada_por === usuario.id,
      esResponsable: inc.tecnico_id === usuario.id,
      cubre: Boolean(cubre),
      verifica: Boolean(verifica),
      verificaConPermiso: Boolean(verifica && verificaConPermiso),
      trabajo: Boolean(trabajo),
      lectura: this.tiene(usuario, PERMISO.VER_TODAS)
    };
  }

  // Un técnico solo ve del buzón lo que cubre; de lo demás, lo que tomó. Quien verifica ve todo lo de sus tiendas.
  puedeVer(rel, inc) {
    return rel.esReportante || rel.esResponsable || rel.lectura || rel.verificaConPermiso || (rel.cubre && inc.estado === ESTADOS.EN_BUZON);
  }

  // { permitida, motivo }: motivo = 'permiso' | 'rol' | 'estado' cuando no se puede.
  evaluar(usuario, rel, inc, accion) {
    const regla = REGLAS[accion];
    if (!regla) throw new Error(`Acción desconocida: ${accion}`);
    if (!this.tiene(usuario, regla.permiso)) return { permitida: false, motivo: 'permiso' };
    if (!regla.rol(rel)) return { permitida: false, motivo: 'rol' };
    if (!regla.estados.includes(inc.estado)) return { permitida: false, motivo: 'estado' };
    return { permitida: true, motivo: null };
  }

  // Lanza el error que corresponde si la acción no cabe: 403 (permiso o relación) o 409 (la incidencia cambió de estado).
  exigir(usuario, rel, inc, accion, mensajeEstado) {
    const { permitida, motivo } = this.evaluar(usuario, rel, inc, accion);
    if (permitida) return;
    if (motivo === 'permiso') throw new ErrorDeNegocio('No tienes permiso para hacer esto.', 403);
    if (motivo === 'rol') throw new ErrorDeNegocio(MENSAJES_ROL[accion] || MENSAJE_ROL_POR_DEFECTO, 403);
    throw new ErrorDeNegocio(mensajeEstado || 'Esta incidencia cambió de estado mientras la mirabas. Recarga la página.', 409);
  }

  // Lo que la pantalla puede ofrecer a esta persona en esta incidencia.
  acciones(usuario, rel, inc) {
    return Object.fromEntries(Object.keys(REGLAS).map(a => [a, this.evaluar(usuario, rel, inc, a).permitida]));
  }
}

module.exports = new AlcanceService();
