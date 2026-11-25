// Categorías de avisos que cada persona puede recibir como notificación del sistema, por módulo.
// Un tipo sin categoría solo llega a la campana. `permisos`: quién puede recibirla (basta uno).
const ROL_ADMINISTRADOR = 1;

const CREA = 'vales.crear';
const SUPERVISA = 'vales.supervisar';
const TALLER = 'vales.gestionar_taller';
const DISENA = 'vales.trabajar';
const FUSIONA = 'vales.aprobar_general';

const cat = (id, nombre, descripcion, permisos, tipos) => Object.freeze({ id, nombre, descripcion, permisos, tipos });

const CATALOGO = Object.freeze({
  vales: [
    cat('pendientes_autorizacion', 'Pendientes de autorización', 'Un vale creado, una modificación solicitada, un vale reenviado o uno que pasó a tu autorización.',
      [SUPERVISA], ['CREADO', 'MODIFICACION_SOLICITADA', 'REENVIADO', 'PASA_A_AUTORIZACION']),
    cat('autorizados_rechazados', 'Autorizados y rechazados', 'Un vale fue autorizado (creación o modificación) o rechazado.',
      [CREA, SUPERVISA, TALLER], ['AUTORIZADO', 'RECHAZADO']),
    cat('asignacion', 'Asignación de diseño', 'Un vale fue asignado a un diseñador, o desaprobado y reasignado.',
      [CREA, SUPERVISA, TALLER, DISENA], ['ASIGNADO', 'DESAPROBADO_REASIGNADO']),
    cat('avance_diseno', 'Avance del diseño', 'Un diseñador canceló su proceso o entregó una propuesta.',
      [CREA, SUPERVISA, TALLER, DISENA], ['PROCESO_CANCELADO', 'PROPUESTA_ENTREGADA']),
    cat('aprobacion_entrega', 'Aprobación y entrega', 'Un taller aprobó, se compartió una propuesta, se hizo la fusión general o se confirmó de recibido.',
      [CREA, SUPERVISA, TALLER, DISENA, FUSIONA], ['TALLER_APROBADO', 'PROPUESTA_COMPARTIDA', 'FUSION_APROBADA', 'RECIBIDO_CONFIRMADO']),
    cat('rechazo_propuesta', 'Rechazo de propuesta', 'Un rechazo de propuesta fue solicitado, aceptado, rechazado o cancelado.',
      [CREA, TALLER], ['RECHAZO_PROPUESTA_SOLICITADO', 'RECHAZO_PROPUESTA_ACEPTADO', 'RECHAZO_PROPUESTA_RECHAZADO', 'RECHAZO_PROPUESTA_CANCELADO']),
    cat('revision_adjuntos', 'Revisión de adjuntos', 'Los adjuntos de un vale fueron verificados, rechazados o respondidos.',
      [CREA, SUPERVISA, TALLER], ['ADJUNTOS_VERIFICADOS', 'ADJUNTOS_RECHAZADOS', 'ADJUNTOS_RESPONDIDOS']),
    cat('mensajes', 'Mensajes', 'Mensajes nuevos en las conversaciones de rechazo de adjuntos y de propuesta.',
      [CREA, TALLER], ['MENSAJE_RECHAZO', 'RECHAZO_PROPUESTA_MENSAJE']),
    cat('atrasos_vencimientos', 'Atrasos y por vencer', 'Un vale se atrasó, o su vigencia o el plazo de sus adjuntos está por vencer.',
      [CREA, SUPERVISA, TALLER, DISENA, FUSIONA], ['ATRASO', 'POR_EXPIRAR', 'ADJUNTOS_POR_VENCER']),
    cat('bajas', 'Bajas y eliminaciones', 'Un vale o un taller fue dado de baja, o un vale venció y se eliminó o pasó a Borradores.',
      [CREA, SUPERVISA, TALLER, DISENA], ['VALE_DADO_DE_BAJA', 'TALLER_DADO_DE_BAJA', 'TALLER_DADO_DE_BAJA_AUTOMATICA', 'EXPIRADO', 'EXPIRADO_A_BORRADOR', 'ADJUNTOS_VENCIDOS'])
  ],
  viaticos: [
    cat('por_autorizar', 'Por autorizar', 'Solicitudes nuevas o modificadas que esperan autorización.', ['viaticos.autorizar'], ['solicitud_nueva', 'solicitud_modificada']),
    cat('autorizadas_rechazadas', 'Autorizadas y rechazadas', 'Tu solicitud fue autorizada o rechazada.', ['viaticos.gestionar'], ['solicitud_autorizada', 'solicitud_rechazada']),
    cat('liquidadas', 'Liquidadas', 'Una solicitud fue liquidada.', ['viaticos.liquidar'], ['solicitud_liquidada']),
    cat('vencimientos', 'Vencimientos', 'Tu solicitud rechazada está por vencer o ya venció.', ['viaticos.gestionar'], ['solicitud_por_vencer', 'solicitud_vencida'])
  ],
  incidencias: [
    cat('buzon_asignacion', 'Buzón y asignación', 'Incidencias nuevas, devueltas al buzón, reasignadas o con cambio de prioridad.',
      ['incidencias.resolver'], ['incidencia_nueva', 'incidencia_devuelta', 'incidencia_reasignada', 'incidencia_prioridad']),
    cat('avance', 'Avance', 'Tu incidencia fue tomada, tiene un avance, quedó en espera o se reanudó.',
      ['incidencias.reportar'], ['incidencia_tomada', 'incidencia_avance', 'incidencia_espera', 'incidencia_reanudada']),
    cat('verificacion_cierre', 'Verificación y cierre', 'Una incidencia pasó a verificación, pidió corrección, se cerró o se descartó.',
      ['incidencias.reportar', 'incidencias.resolver', 'incidencias.verificar'], ['incidencia_a_verificacion', 'incidencia_correccion', 'incidencia_cerrada', 'incidencia_descartada']),
    cat('comentarios', 'Comentarios', 'Comentarios nuevos en una incidencia.',
      ['incidencias.reportar', 'incidencias.resolver', 'incidencias.verificar'], ['incidencia_comentario'])
  ],
  proyectos: [
    cat('reparto', 'Reparto', 'Empresas que te asignan o te quitan y cambios en tu meta de ventas.',
      ['proyectos.gestionar'], ['reparto_recibido', 'meta_ajustada', 'reasignada_recibe', 'reasignada_pierde']),
    cat('seguimiento', 'Seguimiento', 'Seguimientos que están por vencer o ya vencidos.',
      ['proyectos.gestionar', 'proyectos.supervisar'], ['seguimiento_vence', 'seguimiento_vencido']),
    cat('proyecto', 'Proyecto', 'Proyectos por cerrar, vencidos o que no se pudieron activar solos.',
      ['proyectos.supervisar', 'proyectos.ver_gerencia', 'proyectos.administrar'], ['proyecto_por_cerrar', 'proyecto_vencido', 'activacion_automatica_fallo']),
    cat('aprobaciones', 'Aprobaciones', 'Activaciones pedidas, resueltas o automáticas y vistos buenos de cierre.',
      ['proyectos.supervisar', 'proyectos.ver_gerencia', 'proyectos.aprobar_activacion', 'proyectos.dar_visto_bueno'],
      ['activacion_automatica', 'activacion_pedida', 'activacion_resuelta', 'cierre_pendiente', 'visto_bueno_resuelto']),
    cat('ventas', 'Ventas', 'Ventas por confirmar o revisadas y registros anulados.',
      ['proyectos.gestionar', 'proyectos.supervisar'], ['venta_por_confirmar', 'venta_revisada', 'registro_anulado']),
    cat('muestras', 'Muestras', 'La existencia de muestras está baja.', ['proyectos.supervisar'], ['existencia_baja'])
  ]
});

// Avisos que se decidió dejar solo en la campana.
const SOLO_CAMPANA = Object.freeze({ vales: ['CORREGIDO', 'TOMADO', 'PAUSADO', 'REANUDADO'] });

// El administrador recibe todo lo de Vales sin tener los permisos de cada rol.
const MODULOS_COMPLETOS_PARA_ADMIN = ['vales'];

const categoriasDe = (modulo) => (Object.hasOwn(CATALOGO, modulo) ? CATALOGO[modulo] : []);

function categoriaDeTipo(modulo, tipo) {
  if (!tipo) return null;
  const hallada = categoriasDe(modulo).find(c => c.tipos.includes(tipo));
  return hallada ? hallada.id : null;
}

// Las categorías que este usuario puede llegar a recibir (exige además poder entrar al módulo).
function categoriasVisibles(modulo, usuario) {
  const permisos = usuario.permissions || [];
  if (!permisos.includes(`${modulo}.ver`)) return [];
  const todas = usuario.rolId === ROL_ADMINISTRADOR && MODULOS_COMPLETOS_PARA_ADMIN.includes(modulo);
  return categoriasDe(modulo).filter(c => todas || c.permisos.some(p => permisos.includes(p)));
}

module.exports = { categoriasDe, categoriaDeTipo, categoriasVisibles, SOLO_CAMPANA };
