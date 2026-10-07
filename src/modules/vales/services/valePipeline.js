// src/modules/vales/services/valePipeline.js
// Pipeline de estado de 5 pasos que reemplaza la píldora de estado en las tablas. Solo traduce los estados
// reales (vales.estado y vale_talleres.estado) a un paso, un modificador y unas marcas: no cambia ninguno.
// Para agregar un estado nuevo basta una entrada en ETAPA_TALLER o un caso en calcularPipeline.
const {
  ESTADOS, ESTADOS_TALLER, ROLES_TALLER_Y_TECNICO, esValeDeModificacion
} = require('./valeHelpers');

const PASOS = ['Autorización', 'Asignación', 'Producción', 'Revisión', 'Confirmación'];
const MINUTOS_VENCE_URGENTE = 6 * 60;

// Etapa de un taller (vale_talleres.estado) dentro del pipeline; `orden` decide cuál va más atrasado.
const ETAPA_TALLER = {
  [ESTADOS_TALLER.PENDIENTE_ASIGNACION]: { orden: 1, paso: 2, etiqueta: 'Por asignar', detalle: 'Encargado' },
  [ESTADOS_TALLER.ASIGNADO]: { orden: 2, paso: 2, etiqueta: 'Asignado', detalle: 'Sin iniciar' },
  [ESTADOS_TALLER.EN_PROCESO]: { orden: 3, paso: 3, etiqueta: 'En proceso', detalle: 'Diseñador' },
  [ESTADOS_TALLER.EN_PAUSA]: { orden: 4, paso: 3, etiqueta: 'En pausa', detalle: 'Diseñador', nodo: 'pausa', tono: 'warning' },
  [ESTADOS_TALLER.EN_REVISION]: { orden: 5, paso: 4, etiqueta: 'En revisión', detalle: 'Encargado' }
};

const ESTADOS_CON_VIGENCIA = [ESTADOS.ESPERANDO_AUTORIZACION, ESTADOS.SOLICITANDO_MODIFICACION, ESTADOS.RECHAZADO];

const plural = (n, singular, pluralTxt) => `${n} ${n === 1 ? singular : pluralTxt}`;

function nodosHasta(paso, nodoActual) {
  return PASOS.map((_, i) => (i < paso - 1 ? 'completado' : (i === paso - 1 ? nodoActual : 'pendiente')));
}

function etapaDeTalleres(vale, filas, estadoPropio) {
  const aprobadas = filas.filter(f => f.estado === ESTADOS_TALLER.APROBADO).length;
  if (estadoPropio === ESTADOS_TALLER.APROBADO) {
    return { nodos: nodosHasta(5, 'pendiente'), paso: 4, etiqueta: 'Aprobado', detalle: 'Esperando a otros talleres', tono: 'success', nodo: 'completado' };
  }
  let ref = estadoPropio ? ETAPA_TALLER[estadoPropio] : null;
  if (!ref) {
    const activas = filas.filter(f => ETAPA_TALLER[f.estado]).map(f => ETAPA_TALLER[f.estado]);
    ref = activas.sort((a, b) => a.orden - b.orden)[0]
      || (filas.length ? ETAPA_TALLER[ESTADOS_TALLER.EN_REVISION] : ETAPA_TALLER[ESTADOS_TALLER.PENDIENTE_ASIGNACION]);
  }
  const etiqueta = vale.estado === ESTADOS.MODIFICADO ? `Modificado · ${ref.etiqueta}` : ref.etiqueta;
  const detalle = !estadoPropio && filas.length > 1 ? `${aprobadas} de ${filas.length} talleres listos` : ref.detalle;
  return { paso: ref.paso, nodo: ref.nodo || 'actual', etiqueta, detalle, tono: ref.tono || 'info' };
}

function marcasDe(vale) {
  const marcas = [];
  if (esValeDeModificacion(vale)) marcas.push({ tipo: 'mod', texto: 'MOD' });
  if (ESTADOS_CON_VIGENCIA.includes(vale.estado) && vale.vigencia_minutos != null) {
    const minutos = Math.max(0, Number(vale.vigencia_minutos));
    marcas.push({
      tipo: minutos <= MINUTOS_VENCE_URGENTE ? 'vence-urgente' : 'vence',
      texto: minutos >= 60 ? `Vence en ${Math.ceil(minutos / 60)} h` : `Vence en ${minutos} min`
    });
  }
  return marcas;
}

function calcularPipeline(vale, opciones = {}) {
  const filas = vale._talleresDetalle || vale._filasTaller || [];
  const estadoPropio = ROLES_TALLER_Y_TECNICO.includes(opciones.rolId) ? vale.estado_taller : null;
  let r;
  switch (vale.estado) {
    case ESTADOS.ESPERANDO_AUTORIZACION:
    case ESTADOS.SOLICITANDO_MODIFICACION:
      r = {
        paso: 1, nodo: 'actual', tono: 'info', detalle: 'Supervisor',
        etiqueta: vale.estado === ESTADOS.SOLICITANDO_MODIFICACION ? 'Solicitando modificación' : 'Esperando autorización'
      };
      break;
    case ESTADOS.RECHAZADO:
      r = { paso: 1, nodo: 'devuelto', tono: 'danger', etiqueta: 'Rechazado', detalle: 'El asesor corrige' };
      break;
    case ESTADOS.CREADO:
    case ESTADOS.MODIFICADO:
      r = etapaDeTalleres(vale, filas, estadoPropio);
      break;
    case ESTADOS.APROBADO_DEPARTAMENTO:
      r = { paso: 4, nodo: 'actual', tono: 'info', etiqueta: 'Fusión pendiente', detalle: 'Encargado de Diseño' };
      break;
    case ESTADOS.PENDIENTE_CONFIRMACION:
      r = { paso: 5, nodo: 'actual', tono: 'info', etiqueta: 'Por confirmar', detalle: 'Asesor' };
      break;
    case ESTADOS.RECIBIDO:
    case ESTADOS.CONFIRMADO:
      r = {
        paso: 5, nodo: 'completado', tono: 'success', etiqueta: 'Recibido',
        detalle: vale.atrasado && vale.diasAtraso >= 1 ? `Atraso final: ${plural(vale.diasAtraso, 'día', 'días')}` : 'Completado'
      };
      break;
    default:
      r = { paso: 1, nodo: 'actual', tono: 'info', etiqueta: String(vale.estado || ''), detalle: '' };
  }

  const terminado = r.nodo === 'completado' && r.paso === 5 && !r.nodos;
  const conAtraso = !terminado && vale.atrasado && vale.diasAtraso >= 1 && r.nodo === 'actual';
  if (conAtraso) {
    r.nodo = 'atrasado';
    r.tono = 'danger';
    r.detalle = `${plural(vale.diasAtraso, 'día', 'días')} de atraso`;
  }
  const nodos = r.nodos || (terminado ? PASOS.map(() => 'completado') : nodosHasta(r.paso, r.nodo));
  const marcas = marcasDe(vale);
  const talleres = filas.length > 1
    ? filas.map(f => ({ nombre: f.nombre || `Taller ${f.taller_id}`, etiqueta: (ETAPA_TALLER[f.estado] || {}).etiqueta || 'Aprobado', estado: f.estado }))
    : [];
  const resumen = [
    terminado ? 'Paso 5 de 5 completado' : `Paso ${r.paso} de 5`,
    `: ${r.etiqueta}`,
    r.detalle ? `. ${r.detalle}` : '',
    marcas.length ? `. ${marcas.map(m => m.texto).join(', ')}` : ''
  ].join('');
  return {
    paso: r.paso, terminado, nodos, etiqueta: r.etiqueta, detalle: r.detalle, tono: r.tono, alerta: conAtraso,
    marcas, talleres, motivo: vale.estado === ESTADOS.RECHAZADO ? (vale.rechazo_motivo || '') : '', pasos: PASOS, resumen
  };
}

module.exports = { calcularPipeline, PASOS };
