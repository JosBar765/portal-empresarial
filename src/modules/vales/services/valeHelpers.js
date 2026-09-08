// src/modules/vales/services/valeHelpers.js
// Constantes y funciones puras compartidas por todos los servicios de vales:
// estados, roles, fechas/formato, y los dos helpers de autorización que se
// usan en casi cualquier transición de estado.
const valeRepository = require('../repositories/valeRepository');
const historialRepository = require('../repositories/historialRepository');

// Estado GENERAL del vale de arte. El progreso DENTRO de cada taller
// (asignación/proceso/revisión/aprobado) vive en `vale_talleres`, no aquí —
// un vale con 2+ talleres puede tener uno EN_PROCESO y otro recién CREADO a
// la vez, algo que esta única columna no puede representar. Un vale recién
// creado no se reparte a los talleres de inmediato: nace
// ESPERANDO_AUTORIZACION y el Supervisor de Ventas dueño de los asesores que
// lo crearon debe autorizarlo antes de que exista ninguna fila en
// vale_talleres (ver `talleres_solicitados`).
const ESTADOS = {
  ESPERANDO_AUTORIZACION: 'ESPERANDO_AUTORIZACION',
  CREADO: 'CREADO',
  APROBADO_DEPARTAMENTO: 'APROBADO_DEPARTAMENTO',
  PENDIENTE_CONFIRMACION: 'PENDIENTE_CONFIRMACION',
  RECIBIDO: 'RECIBIDO',
  SOLICITANDO_MODIFICACION: 'SOLICITANDO_MODIFICACION',
  MODIFICADO: 'MODIFICADO',
  // Estado final del vale ORIGINAL una vez que su solicitud de modificación
  // fue aprobada (antes volvía a RECIBIDO, un estado indistinguible de un
  // vale que nunca tuvo modificación — eso hacía que el vale original
  // desapareciera de vistas que excluyen RECIBIDO explícitamente, como
  // Trabajo Realizado de los encargados).
  CONFIRMADO: 'CONFIRMADO'
};
const ESTADOS_TERMINALES = [ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];
// El asesor no debe "perder" un vale de la vista de trabajo realizado solo
// porque solicitó una modificación sobre él: el vale ya fue confirmado y ese
// hecho se conserva mientras la solicitud está en curso — la tabla de
// auditoría (vale_historial) nunca se toca, pero además la UI no debe
// "esconder" el registro de confirmación mientras tanto.
const ESTADOS_CONFIRMADOS = [ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO, ESTADOS.SOLICITANDO_MODIFICACION];

// Estado de un vale DENTRO de un taller específico (tabla vale_talleres).
const ESTADOS_TALLER = {
  PENDIENTE_ASIGNACION: 'PENDIENTE_ASIGNACION',
  ASIGNADO: 'ASIGNADO',
  EN_PROCESO: 'EN_PROCESO',
  // El técnico puede pausar su trabajo sin entregar propuesta, para tomar
  // otro vale, y luego reanudarlo.
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
// Encargados de taller (con o sin permiso de fusión) — comparten el ciclo
// asignar/revisar de su propio taller.
const ROLES_ENCARGADO_TALLER = [ROL.ENCARGADO_DISENO, ROL.ENCARGADO_UV3D, ROL.ASISTENTE_DISENO, ROL.ENCARGADO_PROTEXTIL, ROL.ENCARGADO_DISENO_LOCAL];
// Lo mismo + el propio Técnico — "cualquiera que trabaje dentro de un taller".
const ROLES_TALLER_Y_TECNICO = [...ROLES_ENCARGADO_TALLER, ROL.TECNICO];

function esAdministrador(usuario) {
  return usuario.rolId === ROL.ADMINISTRADOR;
}

// El Asistente de Diseño es un clon operativo COMPLETO del Encargado de
// Diseño (decisión de negocio confirmada explícitamente por el usuario) —
// actúa como si fuera el `encargado_id` del taller "Diseño" sin serlo
// literalmente (una fila de `talleres` solo admite un encargado_id). Esta
// excepción está hardcodeada a propósito, igual que `esAdministrador`.
function esAsistenteDeDiseno(usuario) {
  return usuario.rolId === ROL.ASISTENTE_DISENO;
}

function pad5(n) {
  return String(n).padStart(5, '0');
}

// {CODIGO_TIENDA}-{INICIALES}-{00001}. Si el nombre no tiene un segundo
// token (apellido), se repite la primera inicial en vez de fallar — caso
// borde, no debería bloquear la creación de un vale.
function inicialesAsesor(nombreCompleto) {
  const partes = String(nombreCompleto || '').trim().split(/\s+/);
  const p1 = (partes[0] || '?')[0];
  const p2 = (partes[1] || partes[0] || '?')[0];
  return `${p1}${p2}`.toUpperCase();
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function horaActual() {
  return new Date().toTimeString().slice(0, 8);
}

function calcularAtraso(vale) {
  const congelamiento = vale.atraso_congelado_en
    || (ESTADOS_TERMINALES.includes(vale.estado) ? vale.actualizado_en : null);
  const referencia = congelamiento ? new Date(congelamiento.replace(' ', 'T')) : new Date();
  const entrega = new Date(vale.fecha_entrega.replace(' ', 'T'));
  const diffMs = referencia - entrega;
  const atrasado = diffMs > 0;
  const dias = atrasado ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
  return { atrasado, diasAtraso: dias, venceHoy: atrasado && dias === 0 };
}

function enriquecer(vale) {
  const { atrasado, diasAtraso, venceHoy } = calcularAtraso(vale);
  return { ...vale, atrasado, diasAtraso, venceHoy };
}

function esValeDeModificacion(vale) {
  return vale.estado === ESTADOS.MODIFICADO || !!vale.vale_original_id || !!vale.modificado;
}

// comenzar/entregar/pausarProceso/reanudarProceso/cancelarProcesoTecnico
// resuelven la fila vía _filaDelTecnico, que solo la devuelve si
// fila.tecnico_id === usuario.id — eso sucede tanto para un técnico real
// (rol 6) como para un encargado autoasignado. El texto de la acción debe
// reflejar quién es el actor, no asumir siempre "Técnico".
function etiquetaActorTaller(usuario) {
  return usuario.rolId === ROL.TECNICO ? 'Técnico' : 'Encargado';
}

// El estado LÓGICO que ve el asesor no es el estado real de la máquina de
// estados: colapsa varios estados internos en un puñado de "cubetas" de
// negocio. Nunca se usa para autorización, solo para lo que el asesor
// ve/filtra/ordena. Un vale de modificación (MODIFICADO, con
// vale_original_id, o el vale ORIGINAL ya modificado — `vale.modificado`)
// usa un juego de 5 estados en vez de los 4 normales. Reusada tanto por el
// asesor (buzón/trabajo) como por el supervisor (trabajo realizado) — ambos
// comparten esta misma función.
function estadoVisibleAsesor(vale) {
  if (esValeDeModificacion(vale)) {
    switch (vale.estado) {
      case ESTADOS.MODIFICADO: return 'MODIFICADO';
      case ESTADOS.PENDIENTE_CONFIRMACION: return 'PENDIENTE_CONFIRMACION';
      // El vale MOD- NUEVO (tiene `vale_original_id`) sigue su propio ciclo
      // de vida normal: una vez que el asesor lo confirma de recibido, es un
      // RECIBIDO real y se muestra como CONFIRMADO igual que cualquier otro.
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

  // Las agrupaciones (predicados, arriba) son solo eso — agrupaciones. El
  // ordenamiento PRINCIPAL dentro de cada una sigue siendo la fecha de
  // entrega: entre atrasados, el que acumula MÁS atraso (fecha de entrega
  // más antigua) siempre va primero, sin que la urgencia pueda alterar ese
  // orden. La urgencia solo desempata entre vales que NO están atrasados.
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

// Las listas de "trabajo realizado" son un registro histórico: no llevan
// jerarquía, solo orden cronológico (más reciente primero) según cuándo se
// cerró el vale.
function ordenarPorFecha(vales) {
  return [...vales].sort((a, b) => new Date(b.actualizado_en) - new Date(a.actualizado_en));
}

function esHoy(fechaHora) {
  return String(fechaHora).slice(0, 10) === hoyISO();
}

function esVerdadero(valor) {
  return valor === true || valor === 'true' || valor === '1' || valor === 1;
}

// Normaliza una fecha ("2026-08-25", del selector de fecha propio del
// frontend, que ya no pide hora al usuario) o un datetime-local legado
// ("2026-08-25T17:00") a 'YYYY-MM-DD HH:MM:SS', el formato que usa MySQL
// DATETIME. Para una fecha sin hora, `finDelDia` decide si se completa como
// inicio (00:00:00) o fin (23:59:59) de ese día.
function normalizarDatetime(valor, finDelDia = false) {
  if (!valor) return valor;
  const limpio = String(valor).replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    return `${limpio} ${finDelDia ? '23:59:59' : '00:00:00'}`;
  }
  return limpio.length === 16 ? `${limpio}:00` : limpio;
}

// Si la fecha de entrega queda a menos de 3 días de hoy, el vale se marca
// urgente sin importar lo que mande el cliente — nunca confiar solo en el
// checkbox del frontend para una regla de negocio.
function calcularUrgente(fechaEntregaNorm, urgentePayload) {
  const entrega = new Date(fechaEntregaNorm.replace(' ', 'T'));
  const diffDias = (entrega - new Date()) / (1000 * 60 * 60 * 24);
  if (diffDias < 3) return true;
  return esVerdadero(urgentePayload);
}

// `tallerId` es NULL para eventos de nivel de vale (visibles para todos los
// roles con acceso al vale); se pasa cuando el evento es interno de UN
// taller específico (asignar/comenzar/entregar/revisar).
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
  pad5, inicialesAsesor, hoyISO, horaActual, calcularAtraso, enriquecer,
  esValeDeModificacion, etiquetaActorTaller, estadoVisibleAsesor,
  dentroDeVentana, ordenarPorGrupos, ordenarPorFecha, esHoy, esVerdadero,
  normalizarDatetime, calcularUrgente, registrarHistorial,
  requerirVale, assertPropioDelAsesor
};
