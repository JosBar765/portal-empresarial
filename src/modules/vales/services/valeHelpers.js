// src/modules/vales/services/valeHelpers.js
const valeRepository = require('../repositories/valeRepository');
const historialRepository = require('../repositories/historialRepository');

const ESTADOS = {
  ESPERANDO_AUTORIZACION: 'ESPERANDO_AUTORIZACION',
  CREADO: 'CREADO',
  APROBADO_DEPARTAMENTO: 'APROBADO_DEPARTAMENTO',
  PENDIENTE_CONFIRMACION: 'PENDIENTE_CONFIRMACION',
  RECIBIDO: 'RECIBIDO',
  SOLICITANDO_MODIFICACION: 'SOLICITANDO_MODIFICACION',
  MODIFICADO: 'MODIFICADO',
  CONFIRMADO: 'CONFIRMADO'
};
const ESTADOS_TERMINALES = [ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];
const ESTADOS_CONFIRMADOS = [ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO, ESTADOS.SOLICITANDO_MODIFICACION];

const ESTADOS_TALLER = {
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
  TECNICO: 6,
  ASISTENTE_DISENO: 7,
  GERENTE: 8,
  ENCARGADO_PROTEXTIL: 9,
  ENCARGADO_DISENO_LOCAL: 10
};

const ROLES_ENCARGADO_TALLER = [ROL.ENCARGADO_DISENO, ROL.ENCARGADO_UV3D, ROL.ASISTENTE_DISENO, ROL.ENCARGADO_PROTEXTIL, ROL.ENCARGADO_DISENO_LOCAL];
const ROLES_TALLER_Y_TECNICO = [...ROLES_ENCARGADO_TALLER, ROL.TECNICO];

function esAdministrador(usuario) {
  return usuario.rolId === ROL.ADMINISTRADOR;
}

function esAsistenteDeDiseno(usuario) {
  return usuario.rolId === ROL.ASISTENTE_DISENO;
}

function inicialesAsesor(nombreCompleto) {
  const partes = String(nombreCompleto || '').trim().split(/\s+/);
  const p1 = (partes[0] || '?')[0];
  const p2 = (partes[1] || partes[0] || '?')[0];
  return `${p1}${p2}`.toUpperCase();
}

// Centroamérica (salvo Belice y Panamá) usa UTC-6 sin horario de verano —
// se calcula por aritmética de offset fijo en vez de depender de la zona
// horaria del sistema operativo del proceso Node, que en un host
// administrado (Hostinger) no se controla.
const OFFSET_UTC6_MS = 6 * 60 * 60 * 1000;

// Para generar STRINGS de hora de pared (hoyISO/horaActual): recorta el
// epoch real 6h hacia atrás antes de pedirle a toISOString() (que siempre
// renderiza en UTC) que dibuje los dígitos — el resultado son los dígitos
// de la hora de Guatemala. Nunca usar este valor para restar contra un
// instante real (parsearUTC6/new Date()) — para eso, ver más abajo.
function ahoraUTC6() {
  return new Date(Date.now() - OFFSET_UTC6_MS);
}

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

function calcularAtraso(vale) {
  const congelamiento = vale.atraso_congelado_en
    || (ESTADOS_TERMINALES.includes(vale.estado) ? vale.actualizado_en : null);
  const referencia = congelamiento ? parsearUTC6(congelamiento) : new Date();
  const entrega = parsearUTC6(vale.fecha_entrega);
  const diffMs = referencia - entrega;
  const atrasado = diffMs > 0;
  const dias = atrasado ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
  return { atrasado, diasAtraso: dias, venceHoy: atrasado && dias === 0 };
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

function etiquetaActorTaller(usuario) {
  return usuario.rolId === ROL.TECNICO ? 'Técnico' : 'Encargado';
}

function estadoVisibleAsesor(vale) {
  if (esValeDeModificacion(vale)) {
    switch (vale.estado) {
      case ESTADOS.MODIFICADO: return 'MODIFICADO';
      case ESTADOS.PENDIENTE_CONFIRMACION: return 'PENDIENTE_CONFIRMACION';
      case ESTADOS.RECIBIDO: return 'CONFIRMADO';
      case ESTADOS.CONFIRMADO: return 'CONFIRMADO';
      default: return 'MODIFICADO'; // CREADO / APROBADO_DEPARTAMENTO de un vale MOD-
    }
  }
  switch (vale.estado) {
    case ESTADOS.ESPERANDO_AUTORIZACION: return 'ESPERANDO_AUTORIZACION';
    case ESTADOS.SOLICITANDO_MODIFICACION: return 'SOLICITANDO_MODIFICACION';
    case ESTADOS.PENDIENTE_CONFIRMACION: return 'PENDIENTE_CONFIRMACION';
    case ESTADOS.RECIBIDO: return 'CONFIRMADO';
    default: return 'CREADO'; // CREADO / APROBADO_DEPARTAMENTO
  }
}

function dentroDeVentana(vale, ventana) {
  if (!ventana || !ventana.tipo || ventana.tipo === 'todo') return true;
  const fechaVale = vale.fecha_creacion;
  const fv = new Date(`${fechaVale}T00:00:00`);

  if (ventana.tipo === 'rango') {
    if (!ventana.desde && !ventana.hasta) return true;
    // Fecha fin ausente con fecha inicio presente: se toma como si fuera hoy.
    const hastaEfectiva = ventana.hasta || (ventana.desde ? hoyISO() : null);
    if (ventana.desde && fv < new Date(`${ventana.desde}T00:00:00`)) return false;
    if (hastaEfectiva && fv > new Date(`${hastaEfectiva}T00:00:00`)) return false;
    return true;
  }

  const referencia = ventana.fecha || hoyISO();
  const ref = new Date(`${referencia}T00:00:00`);

  if (ventana.tipo === 'dia') {
    return fechaVale === referencia;
  }
  if (ventana.tipo === 'semana') {
    const inicioSemana = new Date(ref);
    inicioSemana.setDate(ref.getDate() - ref.getDay());
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    return fv >= inicioSemana && fv <= finSemana;
  }
  if (ventana.tipo === 'mes') {
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
    if (a.atrasado) return new Date(a.fecha_entrega) - new Date(b.fecha_entrega);
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

function esVerdadero(valor) {
  return valor === true || valor === 'true' || valor === '1' || valor === 1;
}

function normalizarDatetime(valor, finDelDia = false) {
  if (!valor) return valor;
  const limpio = String(valor).replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    return `${limpio} ${finDelDia ? '23:59:59' : '00:00:00'}`;
  }
  return limpio.length === 16 ? `${limpio}:00` : limpio;
}

function calcularUrgente(fechaEntregaNorm, urgentePayload) {
  const entrega = parsearUTC6(fechaEntregaNorm);
  const diffDias = (entrega - new Date()) / (1000 * 60 * 60 * 24);
  if (diffDias < 3) return true;
  return esVerdadero(urgentePayload);
}

async function registrarHistorial(valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion, tecnicoId) {
  await historialRepository.registrar(valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion, tecnicoId);
}

async function requerirVale(valeId) {
  const vale = await valeRepository.obtenerPorId(valeId);
  if (!vale) throw new Error('Vale de arte no encontrado.');
  return vale;
}

function assertPropioDelAsesor(usuario, vale) {
  if (esAdministrador(usuario)) return;
  if (vale.asesor_id !== usuario.id) {
    throw new Error('Este vale de arte no pertenece a este asesor.');
  }
}

module.exports = {
  ESTADOS, ESTADOS_TERMINALES, ESTADOS_CONFIRMADOS, ESTADOS_TALLER,
  ROL, ROLES_ENCARGADO_TALLER, ROLES_TALLER_Y_TECNICO,
  esAdministrador, esAsistenteDeDiseno,
  inicialesAsesor, hoyISO, horaActual, calcularAtraso, enriquecer,
  esValeDeModificacion, etiquetaActorTaller, estadoVisibleAsesor,
  dentroDeVentana, ordenarPorGrupos, ordenarPorFecha, esHoy, esVerdadero,
  normalizarDatetime, calcularUrgente, registrarHistorial,
  requerirVale, assertPropioDelAsesor
};
