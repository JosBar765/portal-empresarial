// A qué pantalla lleva cada aviso de la campana. El aviso nombra lo que pasó (tipo) y sobre qué (referencia): aquí se traduce a
// una ruta del módulo según lo que la persona puede ver. Si no hay pantalla para ese aviso, devuelve null.
const NOMBRES_DE_PANTALLA = {
  miproyecto: 'Mi proyecto', parahoy: 'Para hoy', empresa: 'la empresa', anteriores: 'Proyectos anteriores', clientes: 'Clientes',
  proyectos: 'Proyectos', seguimiento: 'Seguimiento', participacion: 'la empresa', ganados: 'Clientes ganados', ventas: 'Ventas por confirmar',
  panel: 'el panel', vistobueno: 'Por dar visto bueno', aprobaciones: 'Por aprobar', inicio: 'el Centro de configuración', plan: 'Plan del año',
  importar: 'Importar', plantillas: 'Plantillas', notificaciones: 'Notificaciones'
};

export const nombreDePantalla = (ruta) => NOMBRES_DE_PANTALLA[ruta] || 'lo anterior';

export function destinoDeAviso(aviso, permisos) {
  const tiene = (p) => permisos.includes(p);
  const id = aviso.referencia_id;
  const deProyecto = aviso.referencia_tipo === 'proyecto' && id;
  const deEmpresa = aviso.referencia_tipo === 'participacion' && id;
  switch (aviso.tipo) {
    case 'reparto_recibido': case 'meta_ajustada': case 'reasignada_pierde':
      return tiene('proyectos.gestionar') ? '#/miproyecto' : null;
    case 'reasignada_recibe': case 'seguimiento_vence': case 'seguimiento_vencido': case 'registro_anulado': case 'venta_revisada':
      if (!deEmpresa) return tiene('proyectos.gestionar') ? '#/miproyecto' : null;
      if (tiene('proyectos.supervisar')) return `#/participacion/${id}`;
      return tiene('proyectos.gestionar') ? `#/empresa/${id}` : null;
    case 'venta_por_confirmar':
      return tiene('proyectos.confirmar_ventas') ? '#/ventas' : null;
    case 'proyecto_por_cerrar': case 'proyecto_vencido': case 'existencia_baja': case 'activacion_automatica': case 'activacion_resuelta': case 'visto_bueno_resuelto':
      if (!deProyecto) return null;
      if (['proyectos.activar', 'proyectos.ver_gerencia', 'proyectos.administrar'].some(tiene)) return `#/proyectos/${id}`;
      return ['proyectos.supervisar'].some(tiene) ? `#/seguimiento/${id}` : null;
    case 'activacion_pedida':
      return tiene('proyectos.aprobar_activacion') ? '#/aprobaciones' : null;
    case 'cierre_pendiente':
      return tiene('proyectos.dar_visto_bueno') ? '#/vistobueno' : null;
    case 'activacion_automatica_fallo':
      return ['proyectos.configurar', 'proyectos.administrar'].some(tiene) ? '#/plan' : null;
    default:
      return null;
  }
}
