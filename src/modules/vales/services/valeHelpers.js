// src/modules/vales/services/valeHelpers.js
const valeRepository = require('../repositories/valeRepository');
const historialRepository = require('../repositories/historialRepository');
const { ahoraUTC6 } = require('../../../core/calendario/calendarioLaboral');

const ESTADOS = {
  ESPERANDO_AUTORIZACION: 'ESPERANDO_AUTORIZACION',
  CREADO: 'CREADO',
  APROBADO_DEPARTAMENTO: 'APROBADO_DEPARTAMENTO',
  PENDIENTE_CONFIRMACION: 'PENDIENTE_CONFIRMACION',
  RECIBIDO: 'RECIBIDO',
  SOLICITANDO_MODIFICACION: 'SOLICITANDO_MODIFICACION',
  MODIFICADO: 'MODIFICADO',
  CONFIRMADO: 'CONFIRMADO',
  RECHAZADO: 'RECHAZADO'
};
// Estados en los que el asesor todavía puede corregir, reenviar o dar de baja su vale
// (SOLICITANDO_MODIFICACION es el "esperando autorización" de un vale MOD-).
const ESTADOS_EDITABLES_ASESOR = [ESTADOS.ESPERANDO_AUTORIZACION, ESTADOS.SOLICITANDO_MODIFICACION, ESTADOS.RECHAZADO];
const ESTADOS_TERMINALES = [ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];
const ESTADOS_CONFIRMADOS = [ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];

const ESTADOS_TALLER = {
  VERIFICANDO_ADJUNTOS: 'VERIFICANDO_ADJUNTOS',
  ADJUNTOS_RECHAZADOS: 'ADJUNTOS_RECHAZADOS',
  ADJUNTOS_RESPONDIDOS: 'ADJUNTOS_RESPONDIDOS',
  PENDIENTE_ASIGNACION: 'PENDIENTE_ASIGNACION',
  ASIGNADO: 'ASIGNADO',
  EN_PROCESO: 'EN_PROCESO',
  EN_PAUSA: 'EN_PAUSA',
  EN_REVISION: 'EN_REVISION',
  APROBADO: 'APROBADO'
};

// Numeración de roles (database/schema.sql `roles`) — único punto de verdad
// para cada rolId usado en los servicios de vales, en vez de literales
// sueltos que habría que volver a rastrear si la numeración cambia.
const ROL = {
  ADMINISTRADOR: 1,
  ASESOR: 2,
  SUPERVISOR: 3,
  ENCARGADO_DISENO: 4,
  ENCARGADO_UV3D: 5,
  DISENADOR: 6,
  ASISTENTE_DISENO: 7,
  GERENTE: 8,
  ENCARGADO_PROTEXTIL: 9,
  ENCARGADO_DISENO_LOCAL: 10
};

// Sala de quienes pueden fusionar vales multi-taller: se une por el permiso, no
// por el taller ni el rol.
const PERMISO_FUSION = 'vales.aprobar_general';
const SALA_FUSION = 'vales:fusion';

const ROLES_ENCARGADO_TALLER = [ROL.ENCARGADO_DISENO, ROL.ENCARGADO_UV3D, ROL.ASISTENTE_DISENO, ROL.ENCARGADO_PROTEXTIL, ROL.ENCARGADO_DISENO_LOCAL];
const ROLES_TALLER_Y_DISENADOR = [...ROLES_ENCARGADO_TALLER, ROL.DISENADOR];

function esAdministrador(usuario) {
  return usuario.rolId === ROL.ADMINISTRADOR;
}

// Asistente de cualquier taller: rol con padre (claim heredaDeRolId). El rol 7 cuenta aunque su token no traiga el claim.
function esAsistente(usuario) {
  return usuario.heredaDeRolId != null || usuario.rolId === ROL.ASISTENTE_DISENO;
}

// Rol de encargado cuyo buzón/permisos opera el usuario: el padre si es asistente, su propio rol si no.
function rolEncargadoDe(usuario) {
  if (!esAsistente(usuario)) return usuario.rolId;
  return usuario.heredaDeRolId != null ? usuario.heredaDeRolId : ROL.ENCARGADO_DISENO;
}

// Encargado de taller o asistente de cualquier taller.
function esDeTaller(usuario) {
  return ROLES_ENCARGADO_TALLER.includes(usuario.rolId) || esAsistente(usuario);
}

function esTallerODisenador(usuario) {
  return esDeTaller(usuario) || usuario.rolId === ROL.DISENADOR;
}

// `ahoraUTC6()` (core/calendario) devuelve un Date cuyos dígitos UTC son la hora de Guatemala: sirve para generar
// STRINGS de hora de pared (hoyISO/horaActual), nunca para restar contra un instante real (parsearUTC6/new Date()).

// Convierte un string de fecha/hora "naive" guardado en BD (se asume que
// ya representa la hora de pared en UTC-6) a un Date real, anclándolo
// explícitamente a ese offset — nunca a la zona horaria del proceso. El
// Date resultante SÍ es un instante real, comparable con `new Date()`.
function parsearUTC6(fechaHoraNaive) {
  return new Date(String(fechaHoraNaive).replace(' ', 'T') + '-06:00');
}

function hoyISO() {
  return ahoraUTC6().toISOString().slice(0, 10);
}

function horaActual() {
  return ahoraUTC6().toISOString().slice(11, 19);
}

// Atraso por día calendario (UTC-6): solo cuenta la fecha de fecha_entrega, no la hora.
// Todo el día de entrega es "Hoy"; desde el día siguiente hay 1 día de atraso, y así.
function calcularAtraso(vale, ahora = new Date()) {
  const congelamiento = vale.atraso_congelado_en
    || (ESTADOS_TERMINALES.includes(vale.estado) ? vale.actualizado_en : null);
  const refDia = congelamiento
    ? String(congelamiento).slice(0, 10)
    : new Date(ahora.getTime() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const aDiaUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const entregaDia = String(vale.fecha_entrega).slice(0, 10);
  const dias = Math.max(0, Math.round((aDiaUTC(refDia) - aDiaUTC(entregaDia)) / 86400000));
  return { atrasado: dias >= 1, diasAtraso: dias, venceHoy: !congelamiento && refDia === entregaDia };
}

function enriquecer(vale) {
  const { atrasado, diasAtraso, venceHoy } = calcularAtraso(vale);
  return { ...vale, atrasado, diasAtraso, venceHoy };
}

// `vale_original_id` es permanente (se fija al crear el vale MOD- y nunca
// cambia), a diferencia de `estado`, que solo vale MODIFICADO justo después
// de aprobarModificacion y luego avanza (RECIBIDO, PENDIENTE_CONFIRMACION,
// etc.) — comparar contra `estado` dejaba de detectar un vale MOD- apenas
// avanzaba de estado (analisis_correcciones_29.md #3).
function esValeDeModificacion(vale) {
  return vale.vale_original_id != null;
}

// El estado en que un vale espera la decisión del supervisor: un MOD- nace en SOLICITANDO_MODIFICACION.
function estadoEnAutorizacion(vale) {
  return esValeDeModificacion(vale) ? ESTADOS.SOLICITANDO_MODIFICACION : ESTADOS.ESPERANDO_AUTORIZACION;
}

function etiquetaActorTaller(usuario) {
  return usuario.rolId === ROL.DISENADOR ? 'Diseñador' : 'Encargado';
}

function estadoVisibleAsesor(vale) {
  if (esValeDeModificacion(vale)) {
    switch (vale.estado) {
      case ESTADOS.SOLICITANDO_MODIFICACION: return 'SOLICITANDO_MODIFICACION';
      case ESTADOS.RECHAZADO: return 'RECHAZADO';
      case ESTADOS.MODIFICADO: return 'MODIFICADO';
      case ESTADOS.PENDIENTE_CONFIRMACION: return 'PENDIENTE_CONFIRMACION';
      case ESTADOS.RECIBIDO: return 'CONFIRMADO';
      case ESTADOS.CONFIRMADO: return 'CONFIRMADO';
      default: return 'MODIFICADO'; // CREADO / APROBADO_DEPARTAMENTO de un vale MOD-
    }
  }
  switch (vale.estado) {
    case ESTADOS.ESPERANDO_AUTORIZACION: return 'ESPERANDO_AUTORIZACION';
    case ESTADOS.PENDIENTE_CONFIRMACION: return 'PENDIENTE_CONFIRMACION';
    case ESTADOS.RECHAZADO: return 'RECHAZADO';
    case ESTADOS.RECIBIDO: return 'CONFIRMADO';
    default: return 'CREADO'; // CREADO / APROBADO_DEPARTAMENTO
  }
}

// Primer día de la ventana (mes o `desde` del rango), o null si no tiene inicio.
function inicioDeVentana(ventana) {
  if (!ventana || !ventana.tipo || ventana.tipo === 'todo') return null;
  if (ventana.tipo === 'rango') return ventana.desde ? new Date(`${ventana.desde}T00:00:00`) : null;
  const ref = new Date(`${ventana.fecha || hoyISO()}T00:00:00`);
  return new Date(ref.getFullYear(), ref.getMonth(), 1);
}

// La entrega del vale es anterior al inicio de la ventana.
function esAnteriorAlPeriodo(vale, ventana) {
  const inicio = inicioDeVentana(ventana);
  return !!inicio && new Date(`${String(vale.fecha_entrega).slice(0, 10)}T00:00:00`) < inicio;
}

// La ventana de tiempo filtra por la fecha de ENTREGA del vale: 'todo', 'mes' (el de `ventana.fecha`) o 'rango'.
function dentroDeVentana(vale, ventana) {
  if (!ventana || !ventana.tipo || ventana.tipo === 'todo') return true;
  const fv = new Date(`${String(vale.fecha_entrega).slice(0, 10)}T00:00:00`);
  // Buzón: lo que se arrastra (entrega ANTERIOR al inicio del período) se ve igual; lo posterior no.
  const arrastrado = () => !!ventana.incluirArrastrados;

  if (ventana.tipo === 'rango') {
    if (!ventana.desde && !ventana.hasta) return true;
    if (ventana.desde && fv < new Date(`${ventana.desde}T00:00:00`)) return arrastrado();
    if (ventana.hasta && fv > new Date(`${ventana.hasta}T00:00:00`)) return false;
    return true;
  }
  if (ventana.tipo === 'mes') {
    const ref = new Date(`${ventana.fecha || hoyISO()}T00:00:00`);
    if (fv < new Date(ref.getFullYear(), ref.getMonth(), 1)) return arrastrado();
    return fv.getFullYear() === ref.getFullYear() && fv.getMonth() === ref.getMonth();
  }
  return true;
}

function ordenarPorGrupos(vales, predicados) {
  const grupos = predicados.map(() => []);
  const resto = [];

  vales.forEach(v => {
    const idx = predicados.findIndex(p => p(v));
    if (idx === -1) {
      resto.push(v);
    } else {
      grupos[idx].push(v);
    }
  });

  const comparador = (a, b) => {
    if (a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
    if (a.atrasado) return (b.diasAtraso || 0) - (a.diasAtraso || 0) || new Date(a.fecha_entrega) - new Date(b.fecha_entrega);
    if (!!a.urgente !== !!b.urgente) return a.urgente ? -1 : 1;
    return new Date(a.fecha_entrega) - new Date(b.fecha_entrega);
  };

  grupos.forEach(g => g.sort(comparador));
  resto.sort(comparador);

  return [...grupos.flat(), ...resto];
}

function ordenarPorFecha(vales) {
  return [...vales].sort((a, b) => new Date(b.actualizado_en) - new Date(a.actualizado_en));
}

function esHoy(fechaHora) {
  return String(fechaHora).slice(0, 10) === hoyISO();
}

function normalizarDatetime(valor, finDelDia = false) {
  if (!valor) return valor;
  const limpio = String(valor).replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    return `${limpio} ${finDelDia ? '23:59:59' : '00:00:00'}`;
  }
  return limpio.length === 16 ? `${limpio}:00` : limpio;
}

// Urgente lo marca el asesor: sin urgente la entrega pide 3 días naturales de antelación; con urgente basta el mínimo del calendario
// (no se salta la hora máxima de recibimiento). El formulario lo manda como casilla ('on' / 'true' / '1').
const DIAS_MINIMOS_SIN_URGENTE = 3;
function esUrgente(valor) {
  return valor === true || valor === 1 || ['on', 'true', '1'].includes(String(valor).toLowerCase());
}

const MAX_PALABRAS_MOTIVO = 50;

function validarMotivoRechazo(motivo) {
  const texto = String(motivo || '').trim();
  const palabras = texto.split(/\s+/).filter(Boolean).length;
  if (!palabras) throw new Error('Escribe el motivo del rechazo para que el asesor sepa qué corregir.');
  if (palabras > MAX_PALABRAS_MOTIVO) throw new Error(`El motivo no puede tener más de ${MAX_PALABRAS_MOTIVO} palabras.`);
  if (texto.length > 400) throw new Error('El motivo es demasiado largo. Resúmelo un poco.');
  return texto;
}

async function registrarHistorial(valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion, disenadorId) {
  await historialRepository.registrar(valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion, disenadorId);
}

async function requerirVale(valeId) {
  const vale = await valeRepository.obtenerPorId(valeId);
  if (!vale) throw new Error('Este vale ya no existe: fue dado de baja o rechazado.');
  return vale;
}

// Quien puede crear y gestionar vales propios: el asesor y también el supervisor de ventas (que debe tener además
// una fila en `asesores` para saber de qué tienda es). Autorizar su propio vale es una regla aparte: ver autorizarCreacion.
function puedeActuarComoAsesor(usuario) {
  return usuario.rolId === ROL.ASESOR || usuario.rolId === ROL.SUPERVISOR;
}

function assertPropioDelAsesor(usuario, vale) {
  if (esAdministrador(usuario)) return;
  if (vale.asesor_id !== usuario.id) {
    throw new Error('Este vale fue creado por otro asesor.');
  }
}

module.exports = {
  ESTADOS, ESTADOS_EDITABLES_ASESOR, ESTADOS_TERMINALES, ESTADOS_CONFIRMADOS, ESTADOS_TALLER,
  ROL, ROLES_ENCARGADO_TALLER, ROLES_TALLER_Y_DISENADOR, PERMISO_FUSION, SALA_FUSION,
  esAdministrador, esAsistente, rolEncargadoDe, esDeTaller, esTallerODisenador,
  hoyISO, horaActual, calcularAtraso, enriquecer,
  esValeDeModificacion, estadoEnAutorizacion, etiquetaActorTaller, estadoVisibleAsesor,
  dentroDeVentana, esAnteriorAlPeriodo, ordenarPorGrupos, ordenarPorFecha, esHoy,
  normalizarDatetime, esUrgente, DIAS_MINIMOS_SIN_URGENTE, registrarHistorial,
  requerirVale, assertPropioDelAsesor, puedeActuarComoAsesor, validarMotivoRechazo
};
