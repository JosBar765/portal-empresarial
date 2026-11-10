// src/modules/proyectos/eventos.js
// Registro de los eventos que avisan en Proyectos: a qué roles avisa cada uno por defecto y con cuánta anticipación.
// Alimenta la matriz A8 (el administrador enciende o apaga cada celda) y `avisosService`. Las claves son también el `tipo` de la notificación.
const ROLES = ['asesor', 'supervisor', 'gerente'];

// `roles`: los roles a los que el evento puede avisar (y si avisa por defecto). Un rol que no aparece no aplica («—» en la matriz).
// `anticipacion`: { valor por defecto, unidad, texto, min, max }, solo en los recordatorios.
const EVENTOS = [
  { clave: 'reparto_recibido', nombre: 'Reparto recibido', grupo: 'Reparto', roles: { asesor: true } },
  { clave: 'meta_ajustada', nombre: 'Meta de ventas ajustada', grupo: 'Reparto', roles: { asesor: true } },
  { clave: 'reasignada_recibe', nombre: 'Empresa reasignada: la recibe', grupo: 'Reparto', roles: { asesor: true } },
  { clave: 'reasignada_pierde', nombre: 'Empresa reasignada: la pierde', grupo: 'Reparto', roles: { asesor: true } },
  { clave: 'seguimiento_vence', nombre: 'Seguimiento que vence', grupo: 'Seguimiento', roles: { asesor: true }, anticipacion: { valor: 0, unidad: 'horas', texto: 'horas antes', min: 0, max: 72 } },
  { clave: 'seguimiento_vencido', nombre: 'Seguimiento vencido', grupo: 'Seguimiento', roles: { asesor: true, supervisor: true } },
  { clave: 'proyecto_por_cerrar', nombre: 'Proyecto por cerrar', grupo: 'Proyecto', roles: { supervisor: true }, anticipacion: { valor: 3, unidad: 'días', texto: 'días antes', min: 0, max: 30 } },
  { clave: 'proyecto_vencido', nombre: 'Proyecto vencido', grupo: 'Proyecto', roles: { supervisor: true, gerente: true } },
  { clave: 'activacion_automatica', nombre: 'Proyecto activado por el plan del año', grupo: 'Aprobaciones', roles: { supervisor: true, gerente: true } },
  { clave: 'activacion_pedida', nombre: 'Activación pedida', grupo: 'Aprobaciones', roles: { gerente: true } },
  { clave: 'activacion_resuelta', nombre: 'Activación aprobada o rechazada', grupo: 'Aprobaciones', roles: { supervisor: true } },
  { clave: 'cierre_pendiente', nombre: 'Cierre pendiente de visto bueno', grupo: 'Aprobaciones', roles: { gerente: true } },
  { clave: 'visto_bueno_resuelto', nombre: 'Visto bueno dado o devuelto', grupo: 'Aprobaciones', roles: { supervisor: true } },
  { clave: 'venta_por_confirmar', nombre: 'Venta por confirmar', grupo: 'Ventas', roles: { supervisor: true } },
  { clave: 'venta_revisada', nombre: 'Venta confirmada o rechazada', grupo: 'Ventas', roles: { asesor: true } },
  { clave: 'registro_anulado', nombre: 'Cotización, venta o gestión anulada', grupo: 'Ventas', roles: { asesor: true } },
  { clave: 'existencia_baja', nombre: 'Existencia de muestras baja', grupo: 'Muestras', roles: { supervisor: true }, anticipacion: { valor: 20, unidad: 'unidades', texto: 'unidades', min: 1, max: 5000 } }
];

const porClave = new Map(EVENTOS.map(e => [e.clave, e]));
const evento = (clave) => porClave.get(clave) || null;

module.exports = { ROLES, EVENTOS, evento };
