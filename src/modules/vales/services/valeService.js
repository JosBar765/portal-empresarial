// src/modules/vales/services/valeService.js
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const documentoRepository = require('../repositories/documentoRepository');
const historialRepository = require('../repositories/historialRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const solicitudModificacionRepository = require('../repositories/solicitudModificacionRepository');
const fileStorage = require('../../../core/files/fileStorage');
const valePdfService = require('./valePdfService');
const valeEvents = require('../events');

// Estado GENERAL del vale de arte (ver .agents/vales de arte/analisis_correcciones_3.md).
// El progreso DENTRO de cada taller (asignación/proceso/revisión/aprobado) vive en
// `vale_talleres`, no aquí — un vale con 2+ talleres puede tener uno EN_PROCESO y
// otro recién CREADO a la vez, algo que esta única columna no puede representar.
// Ya no existe una acción de "rechazar" ni el estado EN_CORRECCION
// (analisis_correcciones_5.md #5): un vale PENDIENTE_CONFIRMACION que el asesor no
// acepta sigue el mismo camino que cualquier otra corrección — solicitar
// modificación (ver solicitarModificacion, que ahora acepta ambos estados).
// analisis_correcciones_10.md #5: un vale recién creado ya no se reparte a los
// talleres de inmediato — nace ESPERANDO_AUTORIZACION y el Supervisor de Ventas
// (dueño de los asesores que lo crearon) debe autorizarlo (autorizarCreacion())
// antes de que exista ninguna fila en vale_talleres (ver `talleres_solicitados`).
const ESTADOS = {
  ESPERANDO_AUTORIZACION: 'ESPERANDO_AUTORIZACION',
  CREADO: 'CREADO',
  APROBADO_DEPARTAMENTO: 'APROBADO_DEPARTAMENTO',
  PENDIENTE_CONFIRMACION: 'PENDIENTE_CONFIRMACION',
  RECIBIDO: 'RECIBIDO',
  SOLICITANDO_MODIFICACION: 'SOLICITANDO_MODIFICACION',
  MODIFICADO: 'MODIFICADO',
  // analisis_correcciones_15.md #1: estado final del vale ORIGINAL una vez que
  // su solicitud de modificación fue aprobada (antes volvía a RECIBIDO, un
  // estado indistinguible de un vale que nunca tuvo modificación — eso hacía
  // que el vale original desapareciera de vistas que excluyen RECIBIDO
  // explícitamente, como Trabajo Realizado de los encargados).
  CONFIRMADO: 'CONFIRMADO'
};
const ESTADOS_TERMINALES = [ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO];
// El asesor no debe "perder" un vale de la vista de trabajo realizado solo porque
// solicitó una modificación sobre él (analisis_correcciones_4.md #13): el vale ya fue
// confirmado y ese hecho se conserva mientras la solicitud está en curso — la tabla de
// auditoría (vale_historial) nunca se toca, pero además la UI no debe "esconder" el
// registro de confirmación mientras tanto.
const ESTADOS_CONFIRMADOS = [ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO, ESTADOS.SOLICITANDO_MODIFICACION];

// Estado de un vale DENTRO de un taller específico (tabla vale_talleres).
const ESTADOS_TALLER = {
  PENDIENTE_ASIGNACION: 'PENDIENTE_ASIGNACION',
  ASIGNADO: 'ASIGNADO',
  EN_PROCESO: 'EN_PROCESO',
  // analisis_correcciones_14.md #10: el técnico puede pausar su trabajo sin
  // entregar propuesta, para tomar otro vale, y luego reanudarlo.
  EN_PAUSA: 'EN_PAUSA',
  EN_REVISION: 'EN_REVISION',
  APROBADO: 'APROBADO'
};

function pad5(n) {
  return String(n).padStart(5, '0');
}

// analisis_correcciones_12.md #13: {CODIGO_TIENDA}-{INICIALES}-{00001}. Si el
// nombre no tiene un segundo token (apellido), se repite la primera inicial en
// vez de fallar — caso borde, no debería bloquear la creación de un vale.
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

/**
 * El atraso es una CONDICIÓN calculada, nunca un estado persistido. Se congela
 * de forma PERMANENTE la primera vez que el vale es confirmado de recibido o
 * se aprueba su modificación (columna `atraso_congelado_en`, fijada por
 * congelarAtraso() en esos dos puntos exactos) — antes solo se congelaba
 * mientras el vale seguía en estado RECIBIDO, así que solicitar una
 * modificación sobre un vale ya recibido (que lo mueve a
 * SOLICITANDO_MODIFICACION) hacía que el atraso se "descongelara" y
 * volviera a correr en vivo, aunque el vale ya hubiese sido entregado
 * (analisis_correcciones_8.md #7). `ESTADOS_TERMINALES`/`actualizado_en`
 * quedan solo como respaldo para datos de semilla/histórico sin la columna
 * nueva poblada. Para el resto de vales (nunca entregados) se calcula
 * contra la hora actual porque el atraso sigue corriendo de verdad.
 *
 * analisis_correcciones_12.md #1/#7: "atraso" ya no es simplemente "pasó la
 * fecha de entrega" — un vale que cruzó su fecha_entrega hace menos de 24h
 * está en diasAtraso === 0, y eso NO cuenta como atraso todavía ("no hay
 * atrasado de 0 días"). Ese caso pasa a ser su propio flag `venceHoy` (badge
 * amarillo "Hoy" en el frontend); `atrasado` sigue significando "pasó la
 * fecha" para no romper los contadores/filtros que ya lo usan así, pero el
 * vigilante de atraso (atrasoWatcher) y la lectura visual del badge se basan
 * en `diasAtraso >= 1`, no en `atrasado`.
 */
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

// analisis_correcciones_15.md #7: clasifica cada fila de vale_historial en una
// categoría estable, a partir de (estado_anterior, estado_nuevo, accion) — el
// mismo par de estados nunca se reutiliza con un significado distinto salvo
// el caso EN_PROCESO→EN_REVISION (entrega vs. cancelación), donde el texto de
// `accion` sí distingue. `_filtrarHistorialPorRol` arma sus listas blancas por
// rol sobre estas categorías en vez de comparar estados sueltos a mano.
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

// El estado LÓGICO que ve el asesor no es el estado real de la máquina de estados:
// colapsa varios estados internos en un puñado de "cubetas" de negocio (ver
// analisis_correcciones_3.md #11). Nunca se usa para autorización, solo para lo
// que el asesor ve/filtra/ordena. Un vale de modificación (MODIFICADO, con
// vale_original_id, O el vale ORIGINAL ya modificado — `vale.modificado`, ver
// analisis_correcciones_7.md #2) usa un juego de 5 estados en vez de los 4
// normales.
function esValeDeModificacion(vale) {
  return vale.estado === ESTADOS.MODIFICADO || !!vale.vale_original_id || !!vale.modificado;
}

// analisis_correcciones_16.md #3: comenzar/entregar/pausarProceso/reanudarProceso/
// cancelarProcesoTecnico resuelven la fila vía _filaDelTecnico, que solo la
// devuelve si fila.tecnico_id === usuario.id — eso sucede tanto para un técnico
// real (rol 7) como para un encargado autoasignado (analisis_correcciones_14.md
// #1). El texto de la acción debe reflejar quién es el actor, no asumir
// siempre "Técnico".
function etiquetaActorTaller(usuario) {
  return usuario.rolId === ROL.TECNICO ? 'Técnico' : 'Encargado';
}

// Reusada tanto por el asesor (buzón/trabajo) como por el supervisor (trabajo
// realizado, vía _trabajoSupervisor más abajo — no hay una función aparte
// para el supervisor, ambos comparten esta misma) — analisis_correcciones_7.md #2.
function estadoVisibleAsesor(vale) {
  if (esValeDeModificacion(vale)) {
    switch (vale.estado) {
      case ESTADOS.MODIFICADO: return 'MODIFICADO';
      case ESTADOS.PENDIENTE_CONFIRMACION: return 'PENDIENTE_CONFIRMACION';
      // El vale MOD- NUEVO (tiene `vale_original_id`) sigue su propio ciclo de
      // vida normal: una vez que el asesor lo confirma de recibido, es un
      // RECIBIDO real y se muestra como CONFIRMADO igual que cualquier otro.
      case ESTADOS.RECIBIDO: return 'CONFIRMADO';
      // analisis_correcciones_15.md #1: el vale ORIGINAL, al aprobarse su
      // modificación, pasa a un estado real propio (CONFIRMADO, ver
      // aprobarModificacion) en vez de reciclar RECIBIDO — ya no hace falta
      // distinguirlo por `vale_original_id` como antes.
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
  // ordenamiento PRINCIPAL dentro de cada una sigue siendo la fecha de entrega
  // (analisis_correcciones_8.md #3): entre atrasados, el que acumula MÁS
  // atraso (fecha de entrega más antigua) siempre va primero, sin que la
  // urgencia pueda alterar ese orden — antes un vale urgente con poco atraso
  // se colaba delante de uno no urgente con mucho más atraso. La urgencia
  // solo sigue desempatando entre vales que NO están atrasados.
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

// Las listas de "trabajo realizado" son un registro histórico: no llevan jerarquía,
// solo orden cronológico (más reciente primero) según cuándo se cerró el vale.
function ordenarPorFecha(vales) {
  return [...vales].sort((a, b) => new Date(b.actualizado_en) - new Date(a.actualizado_en));
}

function esHoy(fechaHora) {
  return String(fechaHora).slice(0, 10) === hoyISO();
}

function esVerdadero(valor) {
  return valor === true || valor === 'true' || valor === '1' || valor === 1;
}

// Normaliza una fecha ("2026-08-25", del selector de fecha propio del frontend
// — analisis_correcciones_6.md, ya no se pide hora al usuario) o un datetime-local
// legado ("2026-08-25T17:00") a 'YYYY-MM-DD HH:MM:SS', el formato que usan tanto
// MySQL DATETIME como el mock. Para una fecha sin hora, `finDelDia` decide si se
// completa como inicio (00:00:00) o fin (23:59:59) de ese día.
function normalizarDatetime(valor, finDelDia = false) {
  if (!valor) return valor;
  const limpio = String(valor).replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    return `${limpio} ${finDelDia ? '23:59:59' : '00:00:00'}`;
  }
  return limpio.length === 16 ? `${limpio}:00` : limpio;
}

// Corrección #3: si la fecha de entrega queda a menos de 3 días de hoy, el vale se
// marca urgente sin importar lo que mande el cliente — nunca confiar solo en el
// checkbox del frontend para una regla de negocio.
function calcularUrgente(fechaEntregaNorm, urgentePayload) {
  const entrega = new Date(fechaEntregaNorm.replace(' ', 'T'));
  const diffDias = (entrega - new Date()) / (1000 * 60 * 60 * 24);
  if (diffDias < 3) return true;
  return esVerdadero(urgentePayload);
}

// `tallerId` es NULL para eventos de nivel de vale (visibles para todos los roles con
// acceso al vale); se pasa cuando el evento es interno de UN taller específico
// (asignar/comenzar/entregar/revisar) — ver analisis_correcciones_4.md #12.
async function registrarHistorial(valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion, tecnicoId) {
  await historialRepository.registrar(valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion, tecnicoId);
}

// analisis_correcciones_16.md #7: numeración de roles (database/schema.sql
// `roles`) tras eliminar "Diseñador" y "Encargado General" y renumerar sin
// huecos — único punto de verdad para cada rolId usado en este archivo, en
// vez de literales sueltos que habría que volver a rastrear si la numeración
// cambia de nuevo.
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

// analisis_correcciones_12.md #11: el rol Encargado General desaparece. El
// Asistente de Diseño es un clon operativo COMPLETO del Encargado de Diseño
// (decisión confirmada explícitamente por el usuario) — actúa como si fuera
// el `encargado_id` del taller "Diseño" sin serlo literalmente (una fila de
// `talleres` solo admite un encargado_id). Esta excepción está hardcodeada a
// propósito, igual que `esAdministrador`: el documento fuente avisa que la
// asignación de "quién fusiona" podría volver a cambiar en un ciclo futuro
// con una vista de administrador — hasta entonces es la única excepción de
// este tipo en todo el módulo.
function esAsistenteDeDiseno(usuario) {
  return usuario.rolId === ROL.ASISTENTE_DISENO;
}

class ValeService {
  constructor() {
    // Mutex en memoria por vale: garantiza idempotencia de las transiciones de estado
    // a nivel de core (no solo de frontend). Válido porque el sistema corre como un
    // único proceso Node (monolito modular, sin infraestructura distribuida).
    this._locksEnVale = new Set();
    // Cola de creación por asesor (analisis_correcciones_8.md #6): el correlativo
    // se arma leyendo "cuántos vales tiene ya este asesor" e insertando con ese
    // número — dos creaciones casi simultáneas del MISMO asesor podían leer el
    // mismo conteo antes de que la primera terminara de insertar, y generar un
    // correlativo duplicado. A diferencia de _conLockDeVale (que RECHAZA la
    // segunda operación porque es un conflicto de edición sobre el mismo vale),
    // aquí la segunda solicitud debe simplemente ESPERAR su turno — crear dos
    // vales en paralelo para el mismo asesor es un flujo normal, no un error.
    // Válido por el mismo motivo que _locksEnVale: un único proceso Node.
    this._colaCreacionPorAsesor = new Map();
  }

  async _conLockDeVale(valeId, fn) {
    const key = Number(valeId);
    if (this._locksEnVale.has(key)) {
      throw new Error('Ya hay una operación en curso sobre este vale de arte. Intenta de nuevo en un momento.');
    }
    this._locksEnVale.add(key);
    try {
      return await fn();
    } finally {
      this._locksEnVale.delete(key);
    }
  }

  _conColaDeCreacion(asesorId, fn) {
    const key = Number(asesorId);
    const anterior = this._colaCreacionPorAsesor.get(key) || Promise.resolve();
    const actual = anterior.then(fn, fn);
    // La cola interna nunca debe quedar "envenenada" por un rechazo — el siguiente
    // en la fila debe poder correr igual; el error real lo sigue recibiendo quien
    // llamó a esta creación en particular a través de `actual`.
    this._colaCreacionPorAsesor.set(key, actual.catch(() => {}));
    return actual;
  }

  // -----------------------------------------------------------------------
  // Catálogos para el formulario
  // -----------------------------------------------------------------------
  // `talleres` sigue devolviendo el catálogo COMPLETO (lo usan todos los roles
  // para resolver nombres de taller — encargados, técnicos, admin, tablas del
  // buzón — no solo el asesor eligiendo destino al crear). `miTiendaId` es un
  // dato adicional para que el FRONTEND filtre las opciones que le ofrece al
  // asesor (su propio Diseño Local, nunca el de otra tienda) sin tener que
  // meter tienda_id en el JWT — la validación real e inapelable sigue siendo
  // server-side, en `_validarTalleresIds` (analisis_correcciones_12.md #11).
  async obtenerCatalogos(usuario) {
    const [tiendas, productos, materiales, paises, talleres] = await Promise.all([
      catalogoRepository.listarTiendas(),
      catalogoRepository.listarProductos(),
      catalogoRepository.listarMateriales(),
      catalogoRepository.listarPaises(),
      tallerRepository.listarActivos()
    ]);
    const solicitante = usuario ? await usuarioValeRepository.obtenerPorId(usuario.id) : null;
    // analisis_correcciones_12.md #10 (Fase 2c): `tiendasGerencia` es el
    // conjunto de tiendas que el filtro del dashboard le puede ofrecer a ESTE
    // usuario — el catálogo completo para Administrador/Gerente, solo las de
    // sus asesores cubiertos para el Supervisor (mismo alcance que su buzón).
    let tiendasGerencia = tiendas;
    if (usuario && usuario.rolId === ROL.SUPERVISOR) {
      const asesores = await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id);
      const idsTienda = new Set(asesores.map(a => a.tienda_id).filter(Boolean));
      tiendasGerencia = tiendas.filter(t => idsTienda.has(t.id));
    }
    // tecnicas/acabados ya no son catálogo (corrección #1: ahora son textbox libre).
    return { tiendas, productos, materiales, paises, talleres, miTiendaId: (solicitante && solicitante.tienda_id) || null, tiendasGerencia };
  }

  async obtenerTalleres() {
    return tallerRepository.listarActivos();
  }

  // -----------------------------------------------------------------------
  // Resolución de "mi taller" (clon operativo del Asistente de Diseño)
  // -----------------------------------------------------------------------
  // analisis_correcciones_12.md #11: el Asistente de Diseño opera un taller
  // como si fuera su propio encargado_id, sin serlo. Todo sitio que hoy
  // compara `talleres.encargado_id === usuario.id` para resolver "mi
  // taller"/"mis técnicos" pasa por AQUÍ en su lugar, para que la excepción
  // viva en un solo punto en vez de repetirse en cada función.
  // analisis_correcciones_19.md #10: a QUÉ taller "clona" el Asistente ya no
  // está hardcodeado a 'Diseño' — sale de `taller_tecnicos` (mismo mecanismo
  // que usa un Técnico), asignable desde "Editar usuario".
  async _idEncargadoEfectivo(usuario) {
    if (!esAsistenteDeDiseno(usuario)) return usuario.id;
    const asistente = await usuarioValeRepository.obtenerPorId(usuario.id);
    if (!asistente || !asistente.taller_id) return usuario.id;
    const talleres = await tallerRepository.listarActivos();
    const taller = talleres.find(t => t.id === asistente.taller_id);
    return taller ? taller.encargado_id : usuario.id;
  }

  // Sala de socket a notificar cuando un vale queda listo para fusión. Se
  // ancla al taller "Diseño" (el único con `vales.aprobar_general` fijo por
  // rol — el Encargado de Diseño y su clon, el Asistente, ya están unidos a
  // `taller:<id>` de ese taller, sin importar qué taller disparó la
  // transición a APROBADO_DEPARTAMENTO). analisis_correcciones_19.md #10 solo
  // hace configurable A QUÉ taller clona el Asistente su BUZÓN — si el
  // negocio algún día reasigna también la fusión a otro taller, esta sala fija
  // tendría que revisarse aparte.
  async _salaFusion() {
    const talleres = await tallerRepository.listarActivos();
    const diseno = talleres.find(t => t.nombre === 'Diseño');
    return diseno ? `taller:${diseno.id}` : 'vales:admin';
  }

  // -----------------------------------------------------------------------
  // Creación
  // -----------------------------------------------------------------------
  async crearVale(usuario, payload, archivos) {
    const solicitante = await usuarioValeRepository.obtenerPorId(usuario.id);
    if (!solicitante || !solicitante.tienda_id) {
      throw new Error('El asesor no tiene una tienda asignada, no se puede generar el correlativo.');
    }
    const tienda = await catalogoRepository.obtenerTiendaPorId(solicitante.tienda_id);
    if (!tienda) {
      throw new Error('Tienda del asesor no encontrada.');
    }
    // analisis_correcciones_12.md #11: los talleres elegibles/exclusividad
    // dependen de la tienda del propio asesor — se resuelve ANTES de validar.
    const datos = await this._validarDatosVale(payload, { tiendaIdAsesor: tienda.id });

    // Corrección #8.6: el conteo "cuántos vales tiene ya este asesor" (para el
    // correlativo) + el insert que depende de él se serializan por asesor — dos
    // creaciones casi simultáneas del mismo asesor antes leían el mismo conteo y
    // podían generar un correlativo duplicado. El servidor sigue siendo la única
    // fuente del conteo (nunca el cliente); esto solo cierra la ventana de
    // carrera entre leer y escribir.
    // analisis_correcciones_10.md #11: el límite diario dejó de ser individual
    // por asesor (y de correr aquí desplazando la fecha de creación) — ahora es
    // colectivo por Supervisor y se valida al AUTORIZAR (autorizarCreacion), no
    // al crear. Crear un vale ya nunca se pospone ni se bloquea.
    const valeId = await this._conColaDeCreacion(usuario.id, async () => {
      const hoy = hoyISO();
      const fechaCreacionDate = new Date(`${hoy}T00:00:00`);
      if (!(datos.fechaEventoDate > datos.fechaEntregaDate && datos.fechaEntregaDate >= fechaCreacionDate)) {
        throw new Error('Las fechas no son válidas: el evento debe ser posterior a la entrega, y la entrega igual o posterior a la creación.');
      }

      const secuencia = (await valeRepository.contarValesPorAsesor(usuario.id)) + 1;
      // analisis_correcciones_12.md #13: {TIENDA}-{INICIALES}-{00001}. El
      // contador (vales de este asesor) no cambia, solo el formato impreso —
      // los correlativos históricos (GUA-3-0001, etc.) no se renumeran.
      const correlativo = `${tienda.codigo}-${inicialesAsesor(solicitante.nombre)}-${pad5(secuencia)}`;

      return valeRepository.crear({
        correlativo,
        asesorId: usuario.id,
        tiendaId: tienda.id,
        fechaCreacion: hoy,
        horaCreacion: horaActual(),
        fechaEntrega: datos.fechaEntregaNorm,
        fechaEvento: datos.fechaEventoNorm,
        urgente: datos.urgente,
        clienteEmpresa: datos.clienteEmpresa,
        clienteNombre: datos.clienteNombre,
        clienteTelefono: datos.clienteTelefono,
        clienteCorreo: datos.clienteCorreo,
        productoId: datos.productoId,
        materialId: datos.materialId,
        tecnica: datos.tecnica,
        acabado: datos.acabado,
        cantidad: datos.cantidad,
        cotizacion: datos.cotizacion,
        descripcion: datos.descripcion,
        talleresSolicitados: datos.talleresIds.join(','),
        estado: ESTADOS.ESPERANDO_AUTORIZACION
      });
    });

    await this._guardarAdjuntos(valeId, archivos, usuario.id, false);
    const nombresTalleres = await this._nombresDeTalleres(datos.talleresIds);
    await registrarHistorial(valeId, usuario.id, null, null, ESTADOS.ESPERANDO_AUTORIZACION,
      `Vale de arte creado por el asesor — esperando autorización del Supervisor (taller${datos.talleresIds.length > 1 ? 'es' : ''} solicitado${datos.talleresIds.length > 1 ? 's' : ''}: ${nombresTalleres})`);
    await this._regenerarPdf(valeId);

    const vale = await valeRepository.obtenerPorId(valeId);
    // analisis_correcciones_12.md #10: un asesor puede tener MÁS de un
    // supervisor cubriéndolo a la vez (supervisores rotativos) — se notifica
    // a todos, no solo a "el" supervisor.
    const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id);
    valeEvents.notificar({
      vale, accion: 'creado, esperando autorización', actor: solicitante.nombre, actorId: usuario.id,
      salas: [`asesor:${usuario.id}`, ...supervisores.map(s => `supervisor:${s.id}`)]
    });
    return enriquecer(vale);
  }

  // analisis_correcciones_10.md #5/#11: el Supervisor de Ventas autoriza el
  // envío a talleres de un vale creado por uno de SUS asesores — recién aquí
  // se reparten las filas de vale_talleres (antes ocurría de inmediato en
  // crearVale). Gated por el cupo colectivo diario del propio Supervisor
  // (obtenerLimiteColectivoSupervisor) — ver punto 11.
  async autorizarCreacion(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      if (vale.estado !== ESTADOS.ESPERANDO_AUTORIZACION) {
        throw new Error('Solo se puede autorizar un vale en estado ESPERANDO_AUTORIZACION.');
      }
      if (!esAdministrador(usuario)) {
        // analisis_correcciones_12.md #10: "bajo su mando" ya no es
        // encargado_id — es pertenecer a una tienda que este supervisor cubre.
        const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
        if (!supervisores.some(s => s.id === usuario.id)) {
          throw new Error('Este vale de arte no pertenece a un asesor bajo su mando.');
        }
        const { autorizados, limite } = await this.obtenerLimiteColectivoSupervisor(usuario.id);
        if (autorizados >= limite) {
          throw new Error('Se alcanzó el límite diario colectivo de autorizaciones de creación de tu equipo. Vuelve a intentar mañana.');
        }
      }
      const talleresIds = (vale.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
      if (talleresIds.length === 0) {
        throw new Error('Este vale de arte no tiene talleres solicitados registrados.');
      }

      await this._fanOutTalleres(valeId, talleresIds);
      const ahora = `${hoyISO()} ${horaActual()}`;
      await valeRepository.sellarAutorizacion(valeId, { autorizadoPor: usuario.id, autorizadoEn: ahora, autorizacionTipo: 'CREACION' });
      await valeRepository.actualizarEstado(valeId, ESTADOS.CREADO);
      const nombresTalleres = await this._nombresDeTalleres(talleresIds);
      await registrarHistorial(valeId, usuario.id, null, ESTADOS.ESPERANDO_AUTORIZACION, ESTADOS.CREADO,
        `Supervisor autorizó la creación — enviado a taller${talleresIds.length > 1 ? 'es' : ''}: ${nombresTalleres}`);
      // Regenera el PDF para que la firma de autorización (analisis_correcciones_10.md #6) aparezca.
      await this._regenerarPdf(valeId);

      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'autorizado (creación)', actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${vale.asesor_id}`, `supervisor:${usuario.id}`, ...talleresIds.map(id => `taller:${id}`)]
      });
      return enriquecer(actualizado);
    });
  }

  // Validaciones compartidas entre crearVale() y solicitarModificacion() (el
  // formulario de modificación es literalmente el mismo formulario de creación,
  // salvo por los talleres: analisis_correcciones_12.md #11 resuelve el destino
  // de una modificación con su propia lógica, ver solicitarModificacion() — así
  // que crearVale() sigue exigiendo `talleresIds` aquí pero solicitarModificacion()
  // no pasa por este camino para elegir taller).
  async _validarDatosVale(payload, { requiereTalleres = true, tiendaIdAsesor = null } = {}) {
    const {
      clienteEmpresa, clienteNombre, clienteTelefono, clienteCorreo,
      fechaEntrega, fechaEvento, urgente, productoId, materialId, tecnica, acabado,
      cantidad, cotizacion, descripcion
    } = payload;

    if (!clienteNombre || !clienteTelefono || !clienteCorreo) {
      throw new Error('Los datos del cliente (nombre, teléfono, correo) son obligatorios.');
    }
    if (!fechaEntrega || !fechaEvento) {
      throw new Error('Las fechas de entrega y de evento son obligatorias.');
    }
    // Técnica y acabado son opcionales (analisis_correcciones_5.md #8) — se
    // guardan en blanco si no se indican, valePdfService ya maneja ese caso.
    // Entrega se normaliza a fin de día (es una fecha límite: vale durante todo
    // ese día) y evento a inicio de día, para que, ahora que ambas son solo
    // fecha, la validación "evento posterior a entrega" siga exigiendo que el
    // evento caiga en un día calendario distinto (y posterior) al de entrega.
    const fechaEntregaNorm = normalizarDatetime(fechaEntrega, true);
    const fechaEventoNorm = normalizarDatetime(fechaEvento, false);
    const cantidadNum = Number(cantidad);
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 1) {
      throw new Error('La cantidad debe ser mayor a 1.');
    }
    const cotizacionNum = Number(cotizacion);
    if (!Number.isFinite(cotizacionNum) || cotizacionNum <= 0) {
      throw new Error('La cotización debe ser un valor numérico mayor a 0.');
    }

    const talleresIds = requiereTalleres ? await this._validarTalleresIds(payload.talleresIds, tiendaIdAsesor) : [];

    return {
      clienteEmpresa, clienteNombre, clienteTelefono, clienteCorreo,
      fechaEntregaNorm, fechaEventoNorm,
      fechaEntregaDate: new Date(fechaEntregaNorm.replace(' ', 'T')),
      fechaEventoDate: new Date(fechaEventoNorm.replace(' ', 'T')),
      urgente: calcularUrgente(fechaEntregaNorm, urgente),
      productoId: productoId ? Number(productoId) : null,
      materialId: materialId ? Number(materialId) : null,
      tecnica: (tecnica || '').trim(), acabado: (acabado || '').trim(),
      cantidad: cantidadNum, cotizacion: cotizacionNum, descripcion,
      talleresIds
    };
  }

  // Validación de talleres compartida entre _validarDatosVale() (creación /
  // solicitud de modificación) — acepta tanto un array real como el JSON string
  // que manda el formulario. `tiendaIdAsesor` (analisis_correcciones_12.md #11)
  // aplica, cuando se indica, las dos reglas de Diseño Local: nunca se mezcla
  // con un taller de toda la empresa en la misma selección, y nunca se elige el
  // Diseño Local de una tienda distinta a la del propio asesor — server-side,
  // nunca confiando en que el frontend ya filtró las opciones.
  async _validarTalleresIds(talleresIdsRaw, tiendaIdAsesor = null) {
    let talleresIds;
    try {
      talleresIds = Array.isArray(talleresIdsRaw) ? talleresIdsRaw : JSON.parse(talleresIdsRaw || '[]');
    } catch {
      throw new Error('Los talleres seleccionados no tienen un formato válido.');
    }
    talleresIds = [...new Set((talleresIds || []).map(Number).filter(Number.isFinite))];
    if (talleresIds.length === 0) {
      throw new Error('Debe seleccionar al menos un taller para el vale de arte.');
    }
    const talleresActivos = await tallerRepository.listarActivos();
    const idsValidos = new Set(talleresActivos.map(t => t.id));
    if (!talleresIds.every(id => idsValidos.has(id))) {
      throw new Error('Uno o más talleres seleccionados no son válidos.');
    }
    if (tiendaIdAsesor !== null) {
      const seleccionados = talleresIds.map(id => talleresActivos.find(t => t.id === id));
      const locales = seleccionados.filter(t => t.tienda_id !== null);
      const generales = seleccionados.filter(t => t.tienda_id === null);
      if (locales.length > 0 && generales.length > 0) {
        throw new Error('No se puede combinar Diseño Local con talleres de Munditrofeos en el mismo vale.');
      }
      if (locales.some(t => t.tienda_id !== tiendaIdAsesor)) {
        throw new Error('Solo se puede enviar a Diseño Local de su propia tienda.');
      }
    }
    return talleresIds;
  }

  async _fanOutTalleres(valeId, talleresIds) {
    for (const tallerId of talleresIds) {
      await valeTallerRepository.crear(valeId, tallerId);
    }
  }

  async _nombresDeTalleres(talleresIds) {
    const talleres = await tallerRepository.listarActivos();
    return talleresIds.map(id => (talleres.find(t => t.id === id) || {}).nombre || `#${id}`).join(', ');
  }

  async _guardarAdjuntos(valeId, archivos, subidoPor, esModificacion) {
    if (!archivos) return;
    const imagenes = archivos.imagenes || [];
    const documentos = archivos.documentos || [];

    for (const file of imagenes) {
      const saved = await fileStorage.saveFile(file.buffer, file.originalname, file.mimetype);
      await documentoRepository.crear({
        valeId, nombreOriginal: file.originalname, ruta: saved.path, tipo: 'imagen',
        mimeType: file.mimetype, tamano: saved.size, esModificacion, subidoPor
      });
    }
    for (const file of documentos) {
      const saved = await fileStorage.saveFile(file.buffer, file.originalname, file.mimetype);
      await documentoRepository.crear({
        valeId, nombreOriginal: file.originalname, ruta: saved.path, tipo: 'documento',
        mimeType: file.mimetype, tamano: saved.size, esModificacion, subidoPor
      });
    }
  }

  async _regenerarPdf(valeId) {
    const vale = await valeRepository.obtenerPorId(valeId);
    const asesor = await usuarioValeRepository.obtenerPorId(vale.asesor_id);
    // analisis_correcciones_10.md #6: firma roja de autorización — solo existe
    // una vez que el Supervisor autorizó (creación o modificación); antes de eso
    // la caja de firma del PDF sigue vacía (ver valePdfService).
    let firmaAutorizacion = null;
    if (vale.autorizado_por && vale.autorizacion_tipo) {
      const supervisor = await usuarioValeRepository.obtenerPorId(vale.autorizado_por);
      if (supervisor) firmaAutorizacion = `${supervisor.nombre} ${vale.autorizacion_tipo}`;
    }
    const valeConAsesor = {
      ...vale,
      __asesorNombre: asesor ? asesor.nombre : null,
      __asesorCorreo: asesor ? asesor.email : null,
      __asesorTelefono: asesor ? asesor.telefono : null,
      __firmaAutorizacion: firmaAutorizacion
    };
    // Las imágenes se conservan (no se eliminan tras generar el PDF): una modificación
    // posterior necesita poder regenerar el documento completo desde cero.
    const documentos = await documentoRepository.listarPorVale(valeId);
    const pdfBuffer = await valePdfService.generarPdfVale(valeConAsesor, documentos);
    const pdfUrlAnterior = vale.pdf_url;
    const saved = await fileStorage.saveFile(pdfBuffer, `${vale.correlativo}.pdf`, 'application/pdf');
    await valeRepository.actualizarPdfUrl(valeId, saved.path);
    if (pdfUrlAnterior) {
      await fileStorage.deleteFile(pdfUrlAnterior);
    }
  }

  // -----------------------------------------------------------------------
  // Detalle
  // -----------------------------------------------------------------------
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
    // modificación (analisis_correcciones_5.md #3) — se adjunta solo cuando
    // aplica, reusando la misma consulta que ya usa aprobarModificacion().
    let solicitudModificacion = null;
    if (vale.estado === ESTADOS.SOLICITANDO_MODIFICACION) {
      const solicitud = await solicitudModificacionRepository.obtenerPendientePorValeOriginal(valeId);
      if (solicitud) solicitudModificacion = { justificacion: solicitud.justificacion };
    }

    return { ...enriquecer(vale), talleres: talleresConNombre, propuestas, documentos, historial: historialVisible, solicitudModificacion };
  }

  // analisis_correcciones_15.md #8: obtenerDetalle no tenía NINGÚN control de
  // propiedad — cualquier usuario con `vales.ver` podía pedir el detalle
  // completo de CUALQUIER vale por id, sin importar su rol/cobertura (un
  // supervisor de Costa Rica podía ver por API un vale de Guatemala aunque
  // nunca apareciera en su buzón). Mismo criterio de cobertura que ya usan
  // _buzonSupervisor (asesores cubiertos) y _tallerIdVisiblePara (taller propio).
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
    return true; // rol desconocido: no restringir de más, mismo criterio que _filtrarHistorialPorRol
  }

  // analisis_correcciones_15.md #7: rediseño completo, por categoría en vez de
  // comparar estados sueltos. Cada rol tiene una lista blanca de categorías
  // (ver categoriaHistorial) — documentado tal cual en el propio archivo de
  // correcciones, rol por rol:
  // - Asesor y Supervisor: creación, autorización de creación, retorno al
  //   asesor (directo o por fusión), confirmación de recibido, y — si hubo
  //   modificación — solicitud/aprobación de la modificación. Ambos ven
  //   exactamente lo mismo (el supervisor es quien autoriza y aprueba, pero
  //   nunca el detalle interno de un taller).
  // - Gerente: lo mismo que el asesor, más "cuándo se asignó" y "cuándo se
  //   aprobó" a nivel de TODOS los talleres, sin importar a quién ni cuál
  //   taller ("no me importa a quién" — el propio documento).
  // - Encargados de taller (5/6/9/11/12): autorización de creación (sin scope
  //   de taller) + su propio ciclo de asignación/proceso/pausa/reanudación/
  //   entrega-o-cancelación/aprobación/reasignación, acotado a SU taller
  //   (analisis_correcciones_4.md #12) — nunca lo que pasó en otro taller del
  //   mismo vale, ni los eventos de nivel de vale (creación, retorno,
  //   confirmación, modificación) que antes se colaban por tener taller_id null.
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

    return historial;
  }

  async _tallerIdVisiblePara(usuario) {
    const talleres = await tallerRepository.listarActivos();
    if (ROLES_ENCARGADO_TALLER.includes(usuario.rolId)) {
      const idEfectivo = await this._idEncargadoEfectivo(usuario);
      const propio = talleres.find(t => t.encargado_id === idEfectivo);
      return propio ? propio.id : null;
    }
    if (usuario.rolId === ROL.TECNICO) {
      // analisis_correcciones_18.md #5: reemplaza `usuarios.encargado_id` —
      // el taller del técnico sale directo de `taller_tecnicos`, sin pasar
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
  // del actor para mostrar quién hizo la acción, no solo su rol/qué pasó.
  // analisis_correcciones_16.md #3: antes se truncaba a "nombre + primer
  // apellido" (asumiendo un nombre de persona) — con usuarios sembrados cuyo
  // `nombre` es un cargo ("Encargado de Diseño"), el truncado producía
  // "Encargado de" a secas. Se muestra el nombre completo tal cual.
  async _enriquecerHistorialConActor(historial) {
    const idsUnicos = [...new Set(historial.map(h => h.usuario_id))];
    const usuarios = await Promise.all(idsUnicos.map(id => usuarioValeRepository.obtenerPorId(id)));
    const mapaNombres = new Map(idsUnicos.map((id, idx) => [id, usuarios[idx] ? usuarios[idx].nombre : null]));
    return historial.map(h => ({ ...h, actor_nombre: mapaNombres.get(h.usuario_id) || null }));
  }

  // -----------------------------------------------------------------------
  // Buzón / listado por rol
  // -----------------------------------------------------------------------
  _resolverVentana(filtros = {}) {
    if (filtros.ventana === 'rango') {
      return { tipo: 'rango', desde: filtros.desde || null, hasta: filtros.hasta || null };
    }
    return { tipo: filtros.ventana || 'todo', fecha: filtros.fecha };
  }

  // Adjunta a cada vale el nombre legible de sus talleres (columna "Taller"
  // del buzón, corrección #7) y sus filas crudas de `vale_talleres`
  // (`_filasTaller`, usado por varias vistas para saber en cuántos talleres
  // trabajó un vale). Compartido por `obtenerBuzon` y `obtenerDashboardGerencia`.
  async _enriquecerConTaller(vales) {
    const talleresTodos = await tallerRepository.listarActivos();
    const valeTalleresTodos = await valeTallerRepository.listarTodos();
    const mapaTalleresPorVale = new Map();
    valeTalleresTodos.forEach(vt => {
      const lista = mapaTalleresPorVale.get(vt.vale_id) || [];
      lista.push(vt);
      mapaTalleresPorVale.set(vt.vale_id, lista);
    });
    const nombreTaller = (id) => (talleresTodos.find(t => t.id === id) || {}).nombre || `#${id}`;
    return vales.map(v => {
      const filas = mapaTalleresPorVale.get(v.id) || [];
      // analisis_correcciones_13.md #4: un vale en ESPERANDO_AUTORIZACION
      // todavía no tiene filas reales en vale_talleres (el fan-out ocurre
      // recién al autorizar) — sin este respaldo, `taller` quedaba '' y el
      // Supervisor no podía ver qué talleres pidió el asesor antes de
      // autorizar (justo cuando más lo necesita).
      const idsTaller = filas.length > 0
        ? filas.map(f => f.taller_id)
        : String(v.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
      return { ...v, taller: idsTaller.map(nombreTaller).join(', '), _filasTaller: filas };
    });
  }

  async obtenerBuzon(usuario, filtros = {}) {
    const ventana = this._resolverVentana(filtros);
    const vista = filtros.vista === 'trabajo' ? 'trabajo' : 'buzon';
    const filtroContador = filtros.filtroContador || null;
    const todos = (await valeRepository.listarTodos()).map(enriquecer);
    const talleresTodos = await tallerRepository.listarActivos();
    const valeTalleresTodos = await valeTallerRepository.listarTodos();
    let todosConTaller = await this._enriquecerConTaller(todos);

    // Filtro por tienda (analisis_correcciones_7.md, Vista Gerencia): solo lo
    // manda el frontend de Gerencia (y, opcionalmente, Administrador) para acotar
    // el listado/dashboard a una sola tienda; el resto de roles nunca lo envían.
    if (filtros.tiendaId) {
      const tiendaId = Number(filtros.tiendaId);
      todosConTaller = todosConTaller.filter(v => v.tienda_id === tiendaId);
    }

    let resultado;
    switch (usuario.rolId) {
      case ROL.ADMINISTRADOR: // ve todo
        resultado = this._buzonAdministrador(todosConTaller, ventana, filtroContador);
        break;
      case ROL.GERENTE: // mismo listado de solo lectura que el administrador (Vista Gerencia)
        resultado = this._buzonAdministrador(todosConTaller, ventana, filtroContador);
        break;
      case ROL.ASESOR:
        resultado = vista === 'trabajo'
          ? this._trabajoAsesor(usuario, todosConTaller, ventana, filtroContador)
          : this._buzonAsesor(usuario, todosConTaller, ventana, filtroContador);
        break;
      case ROL.SUPERVISOR: // scoped a los asesores bajo su mando (analisis_correcciones_10.md #11)
        resultado = vista === 'trabajo'
          ? await this._trabajoSupervisor(usuario, todosConTaller, ventana, filtroContador)
          : await this._buzonSupervisor(usuario, todosConTaller, ventana, filtroContador);
        break;
      case ROL.ENCARGADO_DISENO:
      case ROL.ENCARGADO_UV3D:
      case ROL.ASISTENTE_DISENO: // clon operativo del taller "Diseño"
      case ROL.ENCARGADO_PROTEXTIL:
      case ROL.ENCARGADO_DISENO_LOCAL: // buzón individual, scoped a su propio taller
        // analisis_correcciones_12.md #11: quien tenga vales.aprobar_general
        // (Encargado de Diseño y Asistente) ve también, mezclada, la cola de
        // fusión — ya no es un buzón de rol aparte (ver §3 del plan / _buzonEncargado).
        resultado = vista === 'trabajo'
          ? await this._trabajoEncargadoTaller(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador)
          : await this._buzonEncargado(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador);
        break;
      case ROL.TECNICO:
        resultado = vista === 'trabajo'
          ? await this.obtenerTrabajoTecnico(usuario, ventana, filtroContador)
          : await this.obtenerBuzonTecnico(usuario, ventana, filtroContador);
        break;
      default:
        resultado = { vales: [], contadores: {} };
    }

    // "Atrasados" en general (analisis_correcciones_6.md #3): a diferencia de
    // filtroContador (mutuamente excluyente), este es el ÚNICO contador que se
    // puede COMBINAR con cualquier otro filtro activo — se aplica aparte, sobre
    // el resultado ya filtrado por rol/ventana/contador, sin tocar las contadores
    // (mismo criterio que _aplicarFiltroContador).
    const soloAtrasados = ['1', 'true', true].includes(filtros.soloAtrasados);
    const valesConAtraso = soloAtrasados ? resultado.vales.filter(v => v.atrasado) : resultado.vales;

    // Filtro de estado (analisis_correcciones_9.md #3, opción A de
    // documentacion/solucion_paginacion.md): antes lo aplicaba SOLO el frontend
    // sobre la página ya cargada (`state.vales`), así que un estado que solo
    // existiera más allá de la primera página de 50 era invisible para el
    // filtro hasta que el usuario scrolleara lo suficiente. Corre aquí, sobre
    // el conjunto completo, con el MISMO criterio de "estado activo por rol"
    // que ya usa el frontend para pintar la píldora — nunca dos fuentes de
    // verdad divergentes: estado_visible para el asesor (y el supervisor en su
    // vista de trabajo), estado_taller para encargados/técnico, estado general
    // para el resto.
    const usaEstadosVisiblesParaFiltro = usuario.rolId === ROL.ASESOR || (usuario.rolId === ROL.SUPERVISOR && vista === 'trabajo');
    const estadoActivoDe = (v) => {
      if (usaEstadosVisiblesParaFiltro) return v.estado_visible;
      if (ROLES_TALLER_Y_TECNICO.includes(usuario.rolId)) return v.estado_taller || v.estado;
      return v.estado;
    };
    const estadoFiltro = filtros.estado || null;
    const valesPorEstado = estadoFiltro ? valesConAtraso.filter(v => estadoActivoDe(v) === estadoFiltro) : valesConAtraso;

    // Búsqueda (analisis_correcciones_5.md #12): corre sobre la lista COMPLETA ya
    // filtrada por rol/ventana/contador (no solo sobre la página ya cargada en el
    // navegador — `resultado.vales` en este punto no tiene límite todavía), con el
    // mismo criterio que antes aplicaba el frontend. Las contadores no se ven
    // afectadas, mismo criterio que _aplicarFiltroContador (ver comentario abajo).
    const busqueda = String(filtros.busqueda || '').trim().toLowerCase();
    const valesBuscados = busqueda
      ? valesPorEstado.filter(v => `${v.correlativo} ${v.cliente_nombre} ${v.cliente_empresa || ''}`.toLowerCase().includes(busqueda))
      : valesPorEstado;

    // Orden por columna (analisis_correcciones_9.md #3, opción A): un clic en un
    // encabezado de la tabla pide un orden explícito que REEMPLAZA por completo
    // la jerarquía de negocio mientras esté activo — mismo criterio que ya tenía
    // el frontend (antes solo sobre la página cargada), ahora sobre el conjunto
    // completo ya filtrado.
    const sortKey = filtros.sortKey || null;
    const sortDir = filtros.sortDir === 'desc' ? -1 : 1;
    const valorOrden = (v) => {
      switch (sortKey) {
        case 'correlativo': return v.correlativo || '';
        case 'fecha_ingreso': return v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`;
        case 'fecha_entrega': return v.fecha_entrega || '';
        case 'fecha_evento': return v.fecha_evento || '';
        default: return '';
      }
    };
    const valesOrdenados = sortKey
      ? [...valesBuscados].sort((a, b) => {
          const va = valorOrden(a), vb = valorOrden(b);
          if (va < vb) return -1 * sortDir;
          if (va > vb) return 1 * sortDir;
          return 0;
        })
      : valesBuscados;

    // Paginación por cursor (analisis_correcciones_9.md #3, opción B de
    // documentacion/solucion_paginacion.md): en vez de un `offset` numérico
    // contra un conjunto que puede recalcularse distinto en cada request (el
    // atraso es relativo a "ahora" y el estado de cualquier vale puede cambiar
    // entre una página y la siguiente), se pide "lo que sigue después de este
    // vale" por id. Si el cursor ya no aparece en el conjunto recalculado
    // (p. ej. cambió de estado justo entre medio) se cae a `offset` como
    // respaldo — el frontend además descarta cualquier fila duplicada al unir
    // páginas, así que este respaldo nunca produce filas repetidas en pantalla.
    const limit = 50;
    const total = valesOrdenados.length;
    // analisis_correcciones_16.md #4/#5: en Trabajo Realizado un mismo vale
    // puede producir 2 filas (fusión + propuesta propia, ver
    // _trabajoEncargadoTaller) que comparten `id` — el cursor usa `_rowKey`
    // cuando existe para no confundir ambas filas entre páginas.
    const claveFila = v => String(v._rowKey || v.id);
    let indiceInicio;
    if (filtros.cursor) {
      const idx = valesOrdenados.findIndex(v => claveFila(v) === String(filtros.cursor));
      indiceInicio = idx === -1 ? Math.max(0, Number(filtros.offset) || 0) : idx + 1;
    } else {
      indiceInicio = Math.max(0, Number(filtros.offset) || 0);
    }
    const pagina = valesOrdenados.slice(indiceInicio, indiceInicio + limit);
    const nextCursor = pagina.length ? claveFila(pagina[pagina.length - 1]) : null;
    return {
      vales: pagina,
      contadores: resultado.contadores,
      total,
      hasMore: indiceInicio + limit < total,
      nextCursor
    };
  }

  // -----------------------------------------------------------------------
  // Vista Gerencia (analisis_correcciones_7.md): panel de solo lectura con
  // métricas agregadas — total de vales, % entregados a tiempo/atrasados, y
  // desgloses por estado y por tienda, respetando la misma ventana de tiempo y
  // el mismo filtro de tienda que la lista de vales del gerente (obtenerBuzon
  // con filtros.tiendaId). Lo más importante para gerencia son los vales
  // atrasados (spec explícita), por eso van primero en la respuesta.
  // NOTA (analisis_correcciones_12.md #10, fase 2a): este método todavía NO
  // acota por las tiendas que cubre un Supervisor — eso y el rediseño de
  // contadores/listas de drill-down son la fase 2c.
  // -----------------------------------------------------------------------
  // analisis_correcciones_12.md #10: rediseño completo (Fase 2c) — 4
  // contadores con drill-down (Modificados/Recibidos/En Progreso/Atrasados,
  // el último combinable con cualquiera de los otros tres, mismo patrón que
  // `soloAtrasados` en `obtenerBuzon`) + Total sin función de lista. Sin
  // gráficas ni desglose por tienda: se quitan `porEstado`/`porTienda`. El
  // Supervisor comparte este dashboard con el Gerente, acotado a los
  // asesores que cubre (mismo alcance que su propio buzón).
  async obtenerDashboardGerencia(usuario, filtros = {}) {
    const ventana = this._resolverVentana(filtros);
    let todos = (await valeRepository.listarTodos()).map(enriquecer);

    if (usuario.rolId === ROL.SUPERVISOR) {
      const asesorIds = new Set((await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id)).map(a => a.id));
      todos = todos.filter(v => asesorIds.has(v.asesor_id));
    }
    todos = await this._enriquecerConTaller(todos);

    const base = filtros.tiendaId
      ? todos.filter(v => v.tienda_id === Number(filtros.tiendaId))
      : todos;
    const enVentana = base.filter(v => dentroDeVentana(v, ventana));

    // Estados lógicos del punto 10: un vale de modificación
    // (esValeDeModificacion, ya usado por estadoVisibleAsesor) manda sobre
    // "recibido" — el original que ya usó su modificación se cuenta como
    // Modificado, no Recibido, aunque su estado real siga siendo RECIBIDO.
    const clasificar = (v) => esValeDeModificacion(v) ? 'modificados'
      : v.estado === ESTADOS.RECIBIDO ? 'recibidos'
      : 'enProgreso';

    const total = enVentana.length;
    const contarClase = (clave) => enVentana.filter(v => clasificar(v) === clave).length;
    const modificados = contarClase('modificados');
    const recibidos = contarClase('recibidos');
    const enProgreso = contarClase('enProgreso');
    const pct = (n, deTotal) => deTotal ? Math.round((n / deTotal) * 100) : 0;

    // Drill-down: la lista solo se arma si hay algo activo (contador, atraso
    // combinable, o búsqueda) — nunca por defecto. No se actualiza en tiempo
    // real (eso es exclusivo del buzón, ver initSocket en el frontend).
    const filtroContador = ['modificados', 'recibidos', 'enProgreso'].includes(filtros.filtroContador) ? filtros.filtroContador : null;
    const soloAtrasados = ['1', 'true', true].includes(filtros.soloAtrasados);
    const busqueda = String(filtros.busqueda || '').trim().toLowerCase();

    // analisis_correcciones_13.md #1: "Atrasados" es la ÚNICA tarjeta reactiva
    // al contador combinado — si hay un filtroContador activo (Modificados/
    // Recibidos/En Progreso), pasa a mostrar los atrasados DENTRO de ese
    // subconjunto (y su % es sobre ese subconjunto, no sobre el gran total:
    // "de mis vales modificados, qué % está atrasado"). Sin selección, vuelve
    // al total global. Los otros 3 contadores nunca cambian con la selección.
    const baseAtrasados = filtroContador ? enVentana.filter(v => clasificar(v) === filtroContador) : enVentana;
    const atrasados = baseAtrasados.filter(v => v.atrasado).length;
    const porcentajeAtrasados = pct(atrasados, baseAtrasados.length);

    let vales = [];
    if (filtroContador || soloAtrasados || busqueda) {
      let lista = enVentana;
      if (filtroContador) lista = lista.filter(v => clasificar(v) === filtroContador);
      if (soloAtrasados) lista = lista.filter(v => v.atrasado);
      if (busqueda) lista = lista.filter(v => `${v.correlativo} ${v.cliente_nombre} ${v.cliente_empresa || ''}`.toLowerCase().includes(busqueda));
      vales = ordenarPorGrupos(lista, [v => v.atrasado]);
    }

    return {
      total, modificados, recibidos, enProgreso, atrasados,
      porcentajeModificados: pct(modificados, total),
      porcentajeRecibidos: pct(recibidos, total),
      porcentajeEnProgreso: pct(enProgreso, total),
      porcentajeAtrasados,
      vales
    };
  }

  // Aplica el filtro de un contador (corrección #10) DESPUÉS de calcular las
  // contadores (para que el número de la tarjeta no cambie al activarse) y ANTES
  // de la paginación (para no romper el scroll infinito).
  _aplicarFiltroContador(vales, filtroContador, predicados) {
    if (!filtroContador || !predicados[filtroContador]) return vales;
    return vales.filter(predicados[filtroContador]);
  }

  _buzonAdministrador(todos, ventana, filtroContador) {
    const enVentana = todos.filter(v => dentroDeVentana(v, ventana));
    const predicados = {
      atrasados: v => v.atrasado,
      pendientesConfirmacion: v => v.estado === ESTADOS.PENDIENTE_CONFIRMACION,
      aprobadoDepartamento: v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO
    };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, predicados);
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO,
      v => v.estado === ESTADOS.CREADO || v.estado === ESTADOS.MODIFICADO
    ]);
    return { vales, contadores: this._contadoresGenerales(enVentana) };
  }

  _contadoresGenerales(vales) {
    return {
      total: vales.length,
      atrasados: vales.filter(v => v.atrasado).length,
      recibidosHoy: vales.filter(v => (v.estado === ESTADOS.RECIBIDO || v.estado === ESTADOS.CONFIRMADO) && esHoy(v.actualizado_en)).length,
      pendientesConfirmacion: vales.filter(v => v.estado === ESTADOS.PENDIENTE_CONFIRMACION).length,
      aprobadoDepartamento: vales.filter(v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO).length
    };
  }

  // ---- Asesor: sidebar Buzón (pipeline activo, sin recibidos/rechazados) ----
  _buzonAsesor(usuario, todos, ventana, filtroContador) {
    const propios = todos.filter(v => v.asesor_id === usuario.id).map(v => ({ ...v, estado_visible: estadoVisibleAsesor(v) }));
    const activos = propios.filter(v => !ESTADOS_TERMINALES.includes(v.estado));
    const enVentana = activos.filter(v => dentroDeVentana(v, ventana));

    const contadores = {
      // analisis_correcciones_10.md #11: el contador de límite diario deja de ser
      // del asesor (era individual) y pasa al Supervisor, como colectivo por
      // equipo — ver obtenerLimiteColectivoSupervisor().
      esperandoAutorizacion: enVentana.filter(v => v.estado_visible === 'ESPERANDO_AUTORIZACION').length,
      valesPorRevisar: enVentana.filter(v => v.estado_visible === 'PENDIENTE_CONFIRMACION').length,
      valesPendientesModificacion: enVentana.filter(v => v.estado_visible === 'SOLICITANDO_MODIFICACION').length,
      // "Atrasados en general" (analisis_correcciones_6.md #3): ya no es un filtro
      // más de _aplicarFiltroContador — se combina con cualquier otro filtro activo,
      // ver el manejo de `soloAtrasados` en obtenerBuzon().
      atrasados: enVentana.filter(v => v.atrasado).length
    };
    const predicados = {
      esperandoAutorizacion: v => v.estado_visible === 'ESPERANDO_AUTORIZACION',
      valesPorRevisar: v => v.estado_visible === 'PENDIENTE_CONFIRMACION',
      valesPendientesModificacion: v => v.estado_visible === 'SOLICITANDO_MODIFICACION'
    };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, predicados);
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado_visible === 'PENDIENTE_CONFIRMACION',
      v => v.estado_visible === 'SOLICITANDO_MODIFICACION',
      v => v.estado_visible === 'MODIFICADO',
      v => v.estado_visible === 'ESPERANDO_AUTORIZACION',
      v => v.estado_visible === 'CREADO'
    ]);
    return { vales, contadores };
  }

  // ---- Asesor: sidebar Trabajo realizado (confirmados, orden por fecha) ----
  // Un vale confirmado permanece visible aquí incluso mientras tiene una modificación
  // en curso (ESTADOS_CONFIRMADOS incluye SOLICITANDO_MODIFICACION) — solicitar una
  // modificación no debe "borrar" el registro de que ya fue confirmado
  // (analisis_correcciones_4.md #13; el historial completo vive en vale_historial).
  _trabajoAsesor(usuario, todos, ventana, filtroContador) {
    const propios = todos.filter(v => v.asesor_id === usuario.id).map(v => ({ ...v, estado_visible: estadoVisibleAsesor(v) }));
    const cerrados = propios.filter(v => ESTADOS_CONFIRMADOS.includes(v.estado));
    const enVentana = cerrados.filter(v => dentroDeVentana(v, ventana));

    const contadores = {
      totalRecibidos: enVentana.length,
      recibidosHoy: enVentana.filter(v => esHoy(v.actualizado_en)).length
    };
    const predicados = {
      totalRecibidos: () => true,
      recibidosHoy: v => esHoy(v.actualizado_en)
    };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, predicados);
    return { vales: ordenarPorFecha(filtrados), contadores };
  }

  // analisis_correcciones_10.md #11: el límite diario deja de ser individual del
  // asesor y pasa a ser COLECTIVO del Supervisor — "vales_autorizados_crear/asesores",
  // ascendente. El denominador es la cantidad de asesores activos bajo su mando
  // (analisis_correcciones_18.md #5: `listarAsesoresPorSupervisor`, vía
  // `supervisor_tiendas`/`asesores.tienda_id`). Administrador no tiene límite.
  async obtenerLimiteColectivoSupervisor(supervisorId) {
    const asesores = await usuarioValeRepository.listarAsesoresPorSupervisor(supervisorId);
    const limite = asesores.length;
    const autorizados = await valeRepository.contarAutorizacionesCreacionPorSupervisorYFecha(supervisorId, hoyISO());
    return { autorizados, limite };
  }

  // ---- Supervisor: sidebar Buzón (autorización de creación, modificaciones,
  // pendientes de confirmación) — scoped a los asesores bajo su mando, ya que
  // ahora cada tienda tiene su propio Supervisor (analisis_correcciones_10.md #11) ----
  async _buzonSupervisor(usuario, todos, ventana, filtroContador) {
    const misAsesoresIds = new Set((await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id)).map(a => a.id));
    const propios = todos.filter(v => misAsesoresIds.has(v.asesor_id));
    const visibles = propios.filter(v => [
      ESTADOS.ESPERANDO_AUTORIZACION, ESTADOS.SOLICITANDO_MODIFICACION, ESTADOS.MODIFICADO, ESTADOS.PENDIENTE_CONFIRMACION
    ].includes(v.estado));
    const enVentana = visibles.filter(v => dentroDeVentana(v, ventana));
    const contadores = {
      // Se calcula por separado en obtenerLimiteColectivoSupervisor() — la tarjeta
      // arma el texto "N/M" igual que ya hacía el asesor (analisis_correcciones_9.md #1).
      valesAutorizadosHoy: null,
      pendientesAutorizacion: enVentana.filter(v => v.estado === ESTADOS.ESPERANDO_AUTORIZACION).length,
      pendientesConfirmarModificacion: enVentana.filter(v => v.estado === ESTADOS.SOLICITANDO_MODIFICACION).length,
      modificados: enVentana.filter(v => v.estado === ESTADOS.MODIFICADO).length,
      pendientesConfirmacion: enVentana.filter(v => v.estado === ESTADOS.PENDIENTE_CONFIRMACION).length,
      atrasados: enVentana.filter(v => v.atrasado).length
    };
    const predicados = {
      pendientesAutorizacion: v => v.estado === ESTADOS.ESPERANDO_AUTORIZACION,
      pendientesConfirmarModificacion: v => v.estado === ESTADOS.SOLICITANDO_MODIFICACION,
      modificados: v => v.estado === ESTADOS.MODIFICADO,
      pendientesConfirmacion: v => v.estado === ESTADOS.PENDIENTE_CONFIRMACION
    };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, predicados);
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado === ESTADOS.ESPERANDO_AUTORIZACION,
      v => v.estado === ESTADOS.SOLICITANDO_MODIFICACION,
      v => v.estado === ESTADOS.MODIFICADO,
      v => v.estado === ESTADOS.PENDIENTE_CONFIRMACION
    ]);
    return { vales, contadores };
  }

  // ---- Supervisor: sidebar Trabajo realizado (analisis_correcciones_10.md #7) ----
  // Dos grupos, cada uno ordenado por su propia fecha (no por actualizado_en):
  // 1) vales que ÉL autorizó (creación o modificación), por autorizado_en desc;
  // 2) vales de SUS asesores confirmados de recibido, por confirmado_en desc.
  async _trabajoSupervisor(usuario, todos, ventana, filtroContador) {
    const misAsesoresIds = new Set((await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id)).map(a => a.id));
    const propios = todos.filter(v => misAsesoresIds.has(v.asesor_id)).map(v => ({ ...v, estado_visible: estadoVisibleAsesor(v) }));

    const autorizadosPorMi = propios.filter(v => v.autorizado_por === usuario.id && v.autorizado_en && dentroDeVentana(v, ventana));
    const confirmadosDeMisAsesores = propios.filter(v => v.confirmado_en && dentroDeVentana(v, ventana));

    const contadores = {
      autorizadosHoy: autorizadosPorMi.filter(v => esHoy(v.autorizado_en)).length,
      totalAutorizados: autorizadosPorMi.length,
      confirmadosHoy: confirmadosDeMisAsesores.filter(v => esHoy(v.confirmado_en)).length,
      totalConfirmados: confirmadosDeMisAsesores.length
    };

    let grupoAutorizados = autorizadosPorMi;
    let grupoConfirmados = confirmadosDeMisAsesores;
    if (filtroContador === 'autorizadosHoy') {
      grupoAutorizados = autorizadosPorMi.filter(v => esHoy(v.autorizado_en));
      grupoConfirmados = [];
    } else if (filtroContador === 'totalAutorizados') {
      grupoConfirmados = [];
    } else if (filtroContador === 'confirmadosHoy') {
      grupoAutorizados = [];
      grupoConfirmados = confirmadosDeMisAsesores.filter(v => esHoy(v.confirmado_en));
    } else if (filtroContador === 'totalConfirmados') {
      grupoAutorizados = [];
    }

    // Un vale puede calificar para AMBOS grupos a la vez (lo autorizó él Y ya lo
    // confirmó el asesor) — los contadores de arriba son métricas independientes
    // a propósito, pero en el LISTADO cada vale aparece una sola vez: el grupo de
    // autorización (jerárquicamente primero) se queda con él.
    const idsEnGrupoAutorizados = new Set(grupoAutorizados.map(v => v.id));
    const grupoConfirmadosSinDuplicar = grupoConfirmados.filter(v => !idsEnGrupoAutorizados.has(v.id));

    const vales = [
      ...[...grupoAutorizados].sort((a, b) => new Date(b.autorizado_en) - new Date(a.autorizado_en)),
      ...[...grupoConfirmadosSinDuplicar].sort((a, b) => new Date(b.confirmado_en) - new Date(a.confirmado_en))
    ];
    return { vales, contadores };
  }

  // ---- Encargado de un taller: buzón INDIVIDUAL, scoped a las filas de su propio taller ----
  // analisis_correcciones_11.md #2: los vales ya APROBADOS por este taller salen
  // del buzón — ese es justo el contenido de "Trabajo Realizado"
  // (_trabajoEncargadoTaller, más abajo), verlos en ambos lados era redundante.
  // analisis_correcciones_12.md #11: quien tenga el permiso `vales.aprobar_general`
  // (hoy Encargado de Diseño y Asistente de Diseño) ve ADEMÁS, mezclados en el
  // mismo buzón, los vales `APROBADO_DEPARTAMENTO` pendientes de fusión — ya no
  // es un buzón de rol aparte (el viejo "Encargado General"). Un vale en ese
  // estado ya tiene su fila de ESTE taller en `APROBADO` (se necesitan TODOS los
  // talleres aprobados para llegar ahí), así que el filtro `!== APROBADO` de
  // arriba ya lo excluyó de "mis pendientes" — el merge es aditivo, sin duplicados.
  async _buzonEncargado(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador) {
    const puedeFusionar = (usuario.permissions || []).includes('vales.aprobar_general');
    const idEfectivo = esAdministrador(usuario) ? null : await this._idEncargadoEfectivo(usuario);
    const miTaller = esAdministrador(usuario) ? null : talleresTodos.find(t => t.encargado_id === idEfectivo);
    if (!esAdministrador(usuario) && !miTaller && !puedeFusionar) {
      return { vales: [], contadores: this._contadoresVaciosEncargado() };
    }
    const misFilas = miTaller
      ? valeTalleresTodos.filter(f => f.taller_id === miTaller.id).filter(f => f.estado !== ESTADOS_TALLER.APROBADO)
      : (esAdministrador(usuario) ? valeTalleresTodos.filter(f => f.estado !== ESTADOS_TALLER.APROBADO) : []);
    const valeIdsVisibles = new Set(misFilas.map(f => f.vale_id));

    // Cada vale se muestra con el estado DE SU FILA en este taller, no el estado
    // general del vale (que puede diferir si hay otro taller involucrado).
    const vistos = todosConTaller
      .filter(v => valeIdsVisibles.has(v.id))
      .map(v => {
        const fila = misFilas.find(f => f.vale_id === v.id);
        return { ...v, estado_taller: fila.estado, tecnico_id: fila.tecnico_id, _filaTallerId: fila.id };
      });
    const enVentana = vistos.filter(v => dentroDeVentana(v, ventana));

    const pendientesAsignacion = enVentana.filter(v => v.estado_taller === ESTADOS_TALLER.PENDIENTE_ASIGNACION);
    const asignados = enVentana.filter(v => v.estado_taller === ESTADOS_TALLER.ASIGNADO);
    const enProceso = enVentana.filter(v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO);
    // analisis_correcciones_16.md #2: faltaba contar/ordenar EN_PAUSA para el
    // encargado (el buzón del técnico sí lo hacía) — un vale recién pausado
    // dejaba de matchear cualquier tarjeta/filtro activo y, al no tener grupo
    // de orden, caía hasta el final de la lista y podía quedar fuera de la
    // página (por eso "desaparecía" hasta recargar, que resetea los filtros).
    const enPausa = enVentana.filter(v => v.estado_taller === ESTADOS_TALLER.EN_PAUSA);
    const enRevision = enVentana.filter(v => v.estado_taller === ESTADOS_TALLER.EN_REVISION);

    // Cola de fusión (analisis_correcciones_12.md #6/#11): vales multi-taller (o
    // de modificación) con TODOS sus talleres ya aprobados, sin scope de taller
    // — es exactamente lo que hacía el viejo buzón del Encargado General.
    const pendientesFusion = puedeFusionar
      ? todosConTaller.filter(v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO && dentroDeVentana(v, ventana))
      : [];

    // analisis_correcciones_6.md #3: contadores por estado (conteo completo, sin
    // desglosar atrasado/no atrasado) + el "Atrasados en general" combinable que
    // maneja obtenerBuzon() aparte. Ya no incluye "Aprobados hoy" (ver arriba).
    const contadores = {
      pendientesAsignacion: pendientesAsignacion.length,
      asignados: asignados.length,
      enProceso: enProceso.length,
      enPausa: enPausa.length,
      enRevision: enRevision.length,
      atrasados: enVentana.filter(v => v.atrasado).length
    };
    if (puedeFusionar) contadores.pendientesFusion = pendientesFusion.length;
    const predicados = {
      pendientesAsignacion: v => v.estado_taller === ESTADOS_TALLER.PENDIENTE_ASIGNACION,
      asignados: v => v.estado_taller === ESTADOS_TALLER.ASIGNADO,
      enProceso: v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO,
      enPausa: v => v.estado_taller === ESTADOS_TALLER.EN_PAUSA,
      enRevision: v => v.estado_taller === ESTADOS_TALLER.EN_REVISION
    };
    if (puedeFusionar) predicados.pendientesFusion = v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO;
    const filtrados = this._aplicarFiltroContador([...enVentana, ...pendientesFusion], filtroContador, predicados);
    // analisis_correcciones_17.md #1: el trabajo activo de los técnicos
    // (en proceso/en pausa) y lo ya asignado suben por encima de lo que
    // requiere acción del propio encargado (revisar/asignar) — antes iba al
    // revés. La cola de fusión se queda al final, sin cambios.
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO,
      v => v.estado_taller === ESTADOS_TALLER.EN_PAUSA,
      v => v.estado_taller === ESTADOS_TALLER.ASIGNADO,
      v => v.estado_taller === ESTADOS_TALLER.EN_REVISION,
      v => v.estado_taller === ESTADOS_TALLER.PENDIENTE_ASIGNACION,
      v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO
    ]);
    return { vales, contadores };
  }

  _contadoresVaciosEncargado() {
    return { pendientesAsignacion: 0, asignados: 0, enProceso: 0, enPausa: 0, enRevision: 0, atrasados: 0 };
  }

  // ---- Encargado de un taller: sidebar Trabajo realizado (analisis_correcciones_10.md
  // #8) — vales con una fila APROBADA en SU taller, orden por fecha (mismo criterio
  // de ordenarPorFecha que usan las demás vistas de "trabajo realizado": la fecha
  // de aprobación real vive en vale_talleres.actualizado_en, pero se ordena por la
  // del vale para ser consistente con _trabajoAsesor).
  // analisis_correcciones_11.md #2: cada fila trae también `propuesta_taller_url`
  // — la propuesta REAL que este taller aprobó (vale_propuestas, por técnico),
  // no `vale.propuesta_general_url` (que en un vale multi-taller es la fusión,
  // no el trabajo de este taller en particular).
  // analisis_correcciones_12.md #6/#11: quien tenga `vales.aprobar_general` ve
  // ADEMÁS, mezclados, los vales que YA fusionó (mismo criterio que tenía el
  // viejo "Trabajo realizado" del Encargado General: multi-taller o de
  // modificación, con `propuesta_general_url` propio y ya en un estado
  // posterior a la fusión — nunca CREADO/MODIFICADO/APROBADO_DEPARTAMENTO). ----
  async _trabajoEncargadoTaller(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador) {
    const puedeFusionar = (usuario.permissions || []).includes('vales.aprobar_general');
    const idEfectivo = esAdministrador(usuario) ? null : await this._idEncargadoEfectivo(usuario);
    const miTaller = esAdministrador(usuario) ? null : talleresTodos.find(t => t.encargado_id === idEfectivo);
    if (!esAdministrador(usuario) && !miTaller && !puedeFusionar) {
      return { vales: [], contadores: { aprobadosHoy: 0, totalAprobados: 0 } };
    }
    const filasDeMiTaller = miTaller
      ? valeTalleresTodos.filter(f => f.taller_id === miTaller.id)
      : (esAdministrador(usuario) ? valeTalleresTodos : []);
    const filasAprobadas = filasDeMiTaller.filter(f => f.estado === ESTADOS_TALLER.APROBADO);
    const mapaFilaPorVale = new Map(filasAprobadas.map(f => [f.vale_id, f]));
    // analisis_correcciones_15.md #3: es un estado LÓGICO congelado — desde que
    // el taller aprueba, Trabajo Realizado lo muestra como "Aprobado" para
    // siempre, sin importar qué le pase al vale después (RECIBIDO, CONFIRMADO,
    // fusión, modificación). analisis_correcciones_14.md #11 excluía RECIBIDO
    // explícitamente; se revierte esa exclusión (contradecía este mismo punto).
    const vistos = todosConTaller.filter(v => mapaFilaPorVale.has(v.id));
    const enVentana = vistos.filter(v => dentroDeVentana(v, ventana));

    // `estado_taller` fijo en 'APROBADO' (igual que _buzonEncargado) para que la
    // píldora de la tabla muestre el estado DE SU taller, no el general del vale
    // (que puede seguir cambiando si hay otros talleres involucrados).
    // analisis_correcciones_16.md #4/#5: `_rowKey`/`_tipoRegistro` identifican
    // esta fila como la PROPUESTA propia del taller — necesario porque un
    // mismo vale puede además traer una fila de FUSIÓN (ver `fusionados` abajo)
    // con el mismo `v.id`.
    const conPropuesta = await Promise.all(enVentana.map(async v => {
      const fila = mapaFilaPorVale.get(v.id);
      const propuesta = fila.tecnico_id ? await propuestaRepository.obtenerUltimaPorValeYTecnico(v.id, fila.tecnico_id) : null;
      const propuestaTallerUrl = propuesta ? propuesta.url : null;
      // analisis_correcciones_15.md #2: la fecha de "aprobado hoy" debe ser la
      // de ESTA fila de taller (fila.actualizado_en), no la del vale general
      // (v.actualizado_en) — esa última se pisa con cualquier transición
      // posterior del vale (fusión, confirmación, etc.), lo que antes hacía
      // que "aprobados hoy" contara aprobaciones viejas cuyo vale cambió hoy.
      return {
        ...v, estado_taller: ESTADOS_TALLER.APROBADO, propuesta_taller_url: propuestaTallerUrl, aprobado_en: fila.actualizado_en,
        _rowKey: `${v.id}-P`, _tipoRegistro: 'PROPUESTA'
      };
    }));

    // analisis_correcciones_16.md #4/#5: antes se adivinaba quién fusionó a
    // partir del estado/forma del vale (multi-taller o modificación +
    // propuesta_general_url poblado) — eso producía falsos positivos (p. ej.
    // un vale de UN solo taller que luego se modificó, sin que nadie lo
    // fusionara nunca) y no distinguía QUIÉN fusionó. Ahora se filtra por la
    // identidad real que dejó `aprobarGeneral` (`vales.fusionado_por`).
    // También lleva `estado_taller`/`aprobado_en` congelados, igual que
    // `conPropuesta` — antes esta lista no los tenía y la píldora caía al
    // estado general del vale (RECIBIDO/PENDIENTE_CONFIRMACION/...).
    const fusionados = puedeFusionar
      ? todosConTaller
          .filter(v =>
            v.fusionado_por &&
            (esAdministrador(usuario) || v.fusionado_por === idEfectivo) &&
            dentroDeVentana(v, ventana)
          )
          .map(v => ({
            ...v, _esFusion: true, estado_taller: ESTADOS_TALLER.APROBADO, aprobado_en: v.fusionado_en,
            _rowKey: `${v.id}-F`, _tipoRegistro: 'FUSION'
          }))
      : [];

    const contadores = {
      aprobadosHoy: conPropuesta.filter(v => esHoy(v.aprobado_en)).length,
      totalAprobados: conPropuesta.length
    };
    if (puedeFusionar) {
      contadores.fusionadosHoy = fusionados.filter(v => esHoy(v.fusionado_en)).length;
      contadores.totalFusionados = fusionados.length;
    }
    // analisis_correcciones_15.md #2: "Total aprobados" no tenía predicado —
    // al filtrar por esa tarjeta, _aplicarFiltroContador devolvía la lista sin
    // filtrar y mezclaba fusionados con aprobados propios.
    const predicados = {
      aprobadosHoy: v => esHoy(v.aprobado_en) && !v._esFusion,
      totalAprobados: v => !v._esFusion
    };
    if (puedeFusionar) {
      predicados.fusionadosHoy = v => !!v._esFusion && esHoy(v.fusionado_en);
      predicados.totalFusionados = v => !!v._esFusion;
    }
    const filtrados = this._aplicarFiltroContador([...conPropuesta, ...fusionados], filtroContador, predicados);
    return { vales: ordenarPorFecha(filtrados), contadores };
  }

  async obtenerTecnicosAsignables(usuario) {
    if (esAdministrador(usuario)) {
      return usuarioValeRepository.listarTodosLosTecnicos();
    }
    return usuarioValeRepository.listarTecnicosPorEncargado(await this._idEncargadoEfectivo(usuario));
  }

  // analisis_correcciones_10.md #9: ordenado por fecha de ENTREGA más próxima —
  // antes no llevaba ningún orden (ni de técnicos ni de sus vales). Un técnico
  // sin vales activos no tiene "próxima entrega": va al final.
  async obtenerCargaTrabajo(usuario) {
    const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(await this._idEncargadoEfectivo(usuario));
    const resultado = [];
    for (const tecnico of tecnicos) {
      const activas = await valeTallerRepository.listarActivasPorTecnico(tecnico.id);
      const vales = (await Promise.all(activas.map(a => valeRepository.obtenerPorId(a.vale_id)))).filter(Boolean);
      const filaEnProceso = activas.find(a => a.estado === ESTADOS_TALLER.EN_PROCESO);
      const valeEnProceso = filaEnProceso ? vales.find(v => v.id === filaEnProceso.vale_id) : null;
      const vigentes = activas.filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_REVISION].includes(a.estado));
      const fechasEntrega = vigentes
        .map(a => vales.find(v => v.id === a.vale_id))
        .filter(Boolean)
        .map(v => new Date(v.fecha_entrega).getTime());
      resultado.push({
        tecnicoId: tecnico.id,
        nombre: tecnico.nombre,
        asignaciones: vigentes.length,
        enProceso: valeEnProceso ? valeEnProceso.correlativo : null,
        _proximaEntrega: fechasEntrega.length ? Math.min(...fechasEntrega) : null
      });
    }
    resultado.sort((a, b) => {
      if (a._proximaEntrega === null && b._proximaEntrega === null) return 0;
      if (a._proximaEntrega === null) return 1;
      if (b._proximaEntrega === null) return -1;
      return a._proximaEntrega - b._proximaEntrega;
    });
    return resultado.map(({ _proximaEntrega, ...r }) => r);
  }

  async obtenerAsignacionesDeTecnico(usuario, tecnicoId) {
    if (!esAdministrador(usuario)) {
      const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(await this._idEncargadoEfectivo(usuario));
      if (!tecnicos.some(t => t.id === Number(tecnicoId))) {
        throw new Error('El técnico indicado no está bajo su mando.');
      }
    }
    const activas = await valeTallerRepository.listarActivasPorTecnico(tecnicoId);
    const activasVigentes = activas.filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_REVISION].includes(a.estado));
    const vales = await Promise.all(activasVigentes.map(async a => {
      const vale = await valeRepository.obtenerPorId(a.vale_id);
      return vale ? { ...enriquecer(vale), estado_taller: a.estado } : null;
    }));
    // analisis_correcciones_10.md #9: ordenado por fecha de entrega más próxima.
    return vales.filter(Boolean).sort((a, b) => new Date(a.fecha_entrega) - new Date(b.fecha_entrega));
  }

  // ---- Técnico: sidebar Buzón (asignaciones activas, sin aprobados/desaprobados) ----
  async obtenerBuzonTecnico(usuario, ventana, filtroContador) {
    const activas = (await valeTallerRepository.listarActivasPorTecnico(usuario.id))
      .filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_REVISION].includes(a.estado));
    const vales = (await Promise.all(activas.map(async a => {
      const vale = await valeRepository.obtenerPorId(a.vale_id);
      return vale ? { ...enriquecer(vale), estado_taller: a.estado } : null;
    })))
      .filter(Boolean)
      .filter(v => dentroDeVentana(v, ventana));

    // analisis_correcciones_6.md #3: se dejan únicamente 3 contadores para el
    // técnico ("asignados sin atraso", "asignados con atraso" y el vale en
    // proceso) — no está en la lista de roles con el "Atrasados en general"
    // combinable, así que "asignadosAtrasados" sigue siendo su propio filtro
    // normal (mutuamente excluyente), no el mecanismo global de soloAtrasados.
    const contadores = {
      asignados: vales.filter(v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && !v.atrasado).length,
      asignadosAtrasados: vales.filter(v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && v.atrasado).length,
      enProceso: vales.find(v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO)?.correlativo || null
    };
    const predicados = {
      asignados: v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && !v.atrasado,
      asignadosAtrasados: v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && v.atrasado
    };
    const filtrados = this._aplicarFiltroContador(vales, filtroContador, predicados);
    const listaOrdenada = ordenarPorGrupos(filtrados, [
      v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO,
      v => v.estado_taller === ESTADOS_TALLER.EN_PAUSA,
      v => v.estado_taller === ESTADOS_TALLER.ASIGNADO,
      v => v.estado_taller === ESTADOS_TALLER.EN_REVISION
    ]);
    return { vales: listaOrdenada, contadores };
  }

  // ---- Técnico: sidebar Trabajo realizado (aprobados por su taller, orden por fecha) ----
  // analisis_correcciones_12.md #5: cada fila trae también `propuesta_taller_url`
  // — la propuesta REAL que el propio técnico entregó — calcado de
  // _trabajoEncargadoTaller, para que "Ver propuesta" también aplique aquí.
  async obtenerTrabajoTecnico(usuario, ventana, filtroContador) {
    const activas = (await valeTallerRepository.listarActivasPorTecnico(usuario.id))
      .filter(a => a.estado === ESTADOS_TALLER.APROBADO);
    const vales = (await Promise.all(activas.map(async a => {
      const vale = await valeRepository.obtenerPorId(a.vale_id);
      if (!vale) return null;
      const propuesta = await propuestaRepository.obtenerUltimaPorValeYTecnico(a.vale_id, usuario.id);
      const propuestaTallerUrl = propuesta ? propuesta.url : null;
      // analisis_correcciones_15.md #4: estado lógico fijo — al técnico no le
      // importa qué pase con el vale después de que le aprueben su trabajo
      // (mismo criterio que _trabajoEncargadoTaller). Antes no se seteaba
      // `estado_taller` aquí, así que el frontend caía al `v.estado` general
      // y la píldora mostraba "Pendiente Confirmación"/"Recibido"/etc.
      // analisis_correcciones_16.md #6: `aprobado_en` toma la fecha de ESTA
      // fila de taller (`a.actualizado_en`), no la del vale general — mismo
      // arreglo que ya se hizo para el encargado en #15.2 y que nunca se
      // propagó acá (por eso "Aprobados hoy" del técnico podía no contar una
      // aprobación de hoy si el vale cambió de estado después). `_rowKey`/
      // `_tipoRegistro` por consistencia con _trabajoEncargadoTaller — el
      // técnico nunca fusiona, siempre una sola fila por correlativo.
      return {
        ...enriquecer(vale), propuesta_taller_url: propuestaTallerUrl, estado_taller: ESTADOS_TALLER.APROBADO,
        aprobado_en: a.actualizado_en, _rowKey: `${vale.id}-P`, _tipoRegistro: 'PROPUESTA'
      };
    })))
      .filter(Boolean)
      .filter(v => dentroDeVentana(v, ventana));

    const contadores = {
      totalAprobados: vales.length,
      aprobadosHoy: vales.filter(v => esHoy(v.aprobado_en)).length
    };
    const predicados = { aprobadosHoy: v => esHoy(v.aprobado_en), totalAprobados: () => true };
    const filtrados = this._aplicarFiltroContador(vales, filtroContador, predicados);
    return { vales: ordenarPorFecha(filtrados), contadores };
  }

  // -----------------------------------------------------------------------
  // Transiciones dentro de un taller (asignar / comenzar / entregar / revisar)
  // -----------------------------------------------------------------------

  // Resuelve la fila de vale_talleres sobre la que un encargado puede actuar para
  // un vale dado: la de SU PROPIO taller (nunca confía en un tallerId del cliente,
  // salvo para el administrador, que no tiene taller propio y puede indicarlo).
  async _resolverFilaTallerParaEncargado(usuario, valeId, tallerIdHint) {
    const filas = await valeTallerRepository.listarPorVale(valeId);
    if (esAdministrador(usuario)) {
      if (tallerIdHint) {
        const fila = filas.find(f => f.taller_id === Number(tallerIdHint));
        if (!fila) throw new Error('Este vale no fue enviado a ese taller.');
        return fila;
      }
      if (filas.length === 1) return filas[0];
      throw new Error('Este vale tiene más de un taller — indique a cuál taller corresponde la acción.');
    }
    const talleres = await tallerRepository.listarActivos();
    const idEfectivo = await this._idEncargadoEfectivo(usuario);
    const miTaller = talleres.find(t => t.encargado_id === idEfectivo);
    if (!miTaller) throw new Error('Su usuario no tiene un taller asignado.');
    const fila = filas.find(f => f.taller_id === miTaller.id);
    if (!fila) throw new Error('Este vale no fue enviado a su taller.');
    return fila;
  }

  async asignar(usuario, valeId, tecnicoId, tallerIdHint) {
    return this._conLockDeVale(valeId, async () => {
      await this._requerirVale(valeId);
      const fila = await this._resolverFilaTallerParaEncargado(usuario, valeId, tallerIdHint);
      if (fila.estado !== ESTADOS_TALLER.PENDIENTE_ASIGNACION) {
        throw new Error('Este taller ya tiene un técnico asignado para este vale.');
      }
      // analisis_correcciones_14.md #1: un encargado puede asignarse el vale a
      // SÍ MISMO — la fila ya está acotada a su propio taller por
      // _resolverFilaTallerParaEncargado, así que nunca cruza a un taller ajeno.
      const esAutoasignacion = !esAdministrador(usuario) && Number(tecnicoId) === Number(usuario.id);
      const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(await this._idEncargadoEfectivo(usuario));
      if (!esAdministrador(usuario) && !esAutoasignacion && !tecnicos.some(t => t.id === Number(tecnicoId))) {
        throw new Error('El técnico indicado no está bajo su mando.');
      }
      await valeTallerRepository.asignar(fila.id, tecnicoId, `${hoyISO()} ${horaActual()}`);
      const tecnico = await usuarioValeRepository.obtenerPorId(tecnicoId);
      const taller = await tallerRepository.obtenerPorId(fila.taller_id);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.PENDIENTE_ASIGNACION, ESTADOS_TALLER.ASIGNADO,
        `Asignado al técnico ${tecnico ? tecnico.nombre : tecnicoId} (taller ${taller ? taller.nombre : fila.taller_id})`, tecnicoId);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'asignado', actor: usuario.nombre, actorId: usuario.id, destino: tecnico ? tecnico.nombre : null,
        salas: ['tecnico:' + tecnicoId, `taller:${fila.taller_id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async comenzar(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      await this._requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.ASIGNADO) {
        throw new Error('El vale debe estar ASIGNADO en su taller para poder comenzarlo.');
      }
      const activasDelTecnico = await valeTallerRepository.listarActivasPorTecnico(usuario.id);
      for (const a of activasDelTecnico) {
        if (a.estado === ESTADOS_TALLER.EN_PROCESO) {
          const v = await valeRepository.obtenerPorId(a.vale_id);
          throw new Error(`Ya tienes un vale en proceso (${v ? v.correlativo : a.vale_id}). Debes entregarlo o cancelarlo antes de comenzar otro.`);
        }
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_PROCESO);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, `${etiquetaActorTaller(usuario)} marcó el vale como en proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // analisis_correcciones_10.md #10: el encargado del taller sí debe enterarse
      // cuando su técnico empieza a trabajar un vale (antes no sonaba para nadie).
      valeEvents.notificar({ vale: actualizado, accion: 'tomado en proceso', actor: usuario.nombre, actorId: usuario.id, salas: [`taller:${fila.taller_id}`] });
      return enriquecer(actualizado);
    });
  }

  async _filaDelTecnico(usuario, valeId) {
    const activas = await valeTallerRepository.listarActivasPorTecnico(usuario.id);
    const fila = activas.find(a => a.vale_id === Number(valeId));
    if (!esAdministrador(usuario) && !fila) {
      throw new Error('Este vale de arte no está asignado a este técnico.');
    }
    if (fila) return fila;
    // Administrador sin fila propia: toma la única fila activa del vale.
    const filas = await valeTallerRepository.listarPorVale(valeId);
    if (filas.length !== 1) throw new Error('Este vale tiene más de un taller — no se puede resolver automáticamente.');
    return filas[0];
  }

  async entregar(usuario, valeId, archivoPropuesta) {
    return this._conLockDeVale(valeId, async () => {
      await this._requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PROCESO) {
        throw new Error('El vale debe estar EN_PROCESO en su taller para poder entregar la propuesta.');
      }
      let url = null;
      if (archivoPropuesta) {
        const saved = await fileStorage.saveFile(archivoPropuesta.buffer, archivoPropuesta.originalname, archivoPropuesta.mimetype);
        url = saved.path;
      }
      await propuestaRepository.crear(valeId, usuario.id, url);
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_REVISION);
      fila.estado = ESTADOS_TALLER.EN_REVISION;
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION, `${etiquetaActorTaller(usuario)} entregó propuesta`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // analisis_correcciones_10.md #10: alerta roja si la propuesta va vacía (sin archivo).
      valeEvents.notificar({
        vale: actualizado, accion: 'entregado (propuesta)', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `tecnico:${usuario.id}`], nivel: url ? 'info' : 'alerta'
      });

      // analisis_correcciones_14.md #1: si quien entrega es el ENCARGADO de este
      // mismo taller (se autoasignó el vale), su trabajo se autoaprueba — no pasa
      // por un período de revisión de sí mismo.
      if (url) {
        const taller = await tallerRepository.obtenerPorId(fila.taller_id);
        const idEfectivo = await this._idEncargadoEfectivo(usuario);
        if (taller && taller.encargado_id === idEfectivo) {
          return this._revisarPropuestaInterno(usuario, valeId, fila, { aprobar: true, esAutoaprobacion: true });
        }
      }
      return enriquecer(actualizado);
    });
  }

  // analisis_correcciones_14.md #10: el técnico puede pausar un vale EN_PROCESO
  // (sin propuesta) para tomar otro más urgente, y reanudarlo después. Mismo
  // patrón que cancelarProcesoTecnico, pero queda en EN_PAUSA en vez de volver
  // a EN_REVISION (la pausa no es una entrega).
  async pausarProceso(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      await this._requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PROCESO) {
        throw new Error('Solo se puede pausar un vale que esté EN_PROCESO en su taller.');
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_PAUSA);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, `${etiquetaActorTaller(usuario)} pausó el proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'pausó el proceso', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `tecnico:${usuario.id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async reanudarProceso(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      await this._requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PAUSA) {
        throw new Error('Solo se puede reanudar un vale que esté EN_PAUSA en su taller.');
      }
      // Misma regla que comenzar(): un técnico solo puede tener un vale EN_PROCESO a la vez.
      const activasDelTecnico = await valeTallerRepository.listarActivasPorTecnico(usuario.id);
      for (const a of activasDelTecnico) {
        if (a.estado === ESTADOS_TALLER.EN_PROCESO) {
          const v = await valeRepository.obtenerPorId(a.vale_id);
          throw new Error(`Ya tienes un vale en proceso (${v ? v.correlativo : a.vale_id}). Debes entregarlo, cancelarlo o pausarlo antes de reanudar otro.`);
        }
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_PROCESO);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_PROCESO, `${etiquetaActorTaller(usuario)} reanudó el proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'reanudó el proceso', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `tecnico:${usuario.id}`]
      });
      return enriquecer(actualizado);
    });
  }

  async cancelarProcesoTecnico(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      await this._requerirVale(valeId);
      const fila = await this._filaDelTecnico(usuario, valeId);
      if (fila.estado !== ESTADOS_TALLER.EN_PROCESO) {
        throw new Error('Solo se puede cancelar un vale que esté EN_PROCESO en su taller.');
      }
      // analisis_correcciones_12.md #12: la cancelación ya no crea una fila
      // "en blanco" en vale_propuestas — el registro de auditoría de este
      // evento vive únicamente en vale_historial, igual que cualquier otra
      // transición de estado.
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_REVISION);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION, `${etiquetaActorTaller(usuario)} canceló el proceso`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({
        vale: actualizado, accion: 'canceló su proceso', actor: usuario.nombre, actorId: usuario.id,
        salas: [`taller:${fila.taller_id}`, `tecnico:${usuario.id}`], nivel: 'alerta'
      });
      return enriquecer(actualizado);
    });
  }

  async revisarPropuesta(usuario, valeId, { aprobar, tecnicoReasignadoId, tallerId }) {
    return this._conLockDeVale(valeId, async () => {
      const fila = await this._resolverFilaTallerParaEncargado(usuario, valeId, tallerId);
      return this._revisarPropuestaInterno(usuario, valeId, fila, { aprobar, tecnicoReasignadoId });
    });
  }

  // Extraído de revisarPropuesta (analisis_correcciones_14.md #1) para que
  // entregar() pueda encadenar la autoaprobación de un encargado sin volver a
  // pedir el lock de _conLockDeVale (no es reentrante — ya se sostiene desde
  // entregar()).
  async _revisarPropuestaInterno(usuario, valeId, fila, { aprobar, tecnicoReasignadoId, esAutoaprobacion }) {
    const vale = await this._requerirVale(valeId);
    if (fila.estado !== ESTADOS_TALLER.EN_REVISION) {
      throw new Error('Solo se pueden revisar talleres en estado EN_REVISION.');
    }
    if (aprobar) {
      const ultimaPropuesta = await propuestaRepository.obtenerUltimaPorValeYTecnico(valeId, fila.tecnico_id);
      if (!ultimaPropuesta || !ultimaPropuesta.url) {
        throw new Error('No se puede aprobar una propuesta en blanco: el técnico debe adjuntar el documento de propuesta.');
      }
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.APROBADO);
      fila.estado = ESTADOS_TALLER.APROBADO;
      const taller = await tallerRepository.obtenerPorId(fila.taller_id);
      const accionHistorial = esAutoaprobacion
        ? 'Encargado aprobó su propio trabajo (autoasignación)'
        : `Encargado de ${taller ? taller.nombre : fila.taller_id} aprobó la propuesta de su taller`;
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.APROBADO, accionHistorial, fila.tecnico_id);
      await this._recalcularEstadoVale(valeId, usuario.id);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // analisis_correcciones_10.md #10: el encargado que aprobó también se
      // entera (self-broadcast, igual que el resto de acciones del módulo),
      // además de a quien le toca seguir el flujo (asesor o quien fusiona).
      const targets = actualizado.estado === ESTADOS.PENDIENTE_CONFIRMACION
        ? [`asesor:${vale.asesor_id}`, `taller:${fila.taller_id}`]
        : actualizado.estado === ESTADOS.APROBADO_DEPARTAMENTO
          ? [await this._salaFusion(), `taller:${fila.taller_id}`]
          : [`taller:${fila.taller_id}`];
      valeEvents.notificar({ vale: actualizado, accion: 'aprobado (taller)', actor: usuario.nombre, actorId: usuario.id, salas: targets });
      return enriquecer(actualizado);
    }

    if (!tecnicoReasignadoId) {
      throw new Error('Debe indicar a qué técnico reasignar el vale desaprobado.');
    }
    // analisis_correcciones_16.md #1: igual que asignar(), el encargado puede
    // reasignarse el trabajo desaprobado a sí mismo.
    const esAutoasignacion = !esAdministrador(usuario) && Number(tecnicoReasignadoId) === Number(usuario.id);
    const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(await this._idEncargadoEfectivo(usuario));
    if (!esAdministrador(usuario) && !esAutoasignacion && !tecnicos.some(t => t.id === Number(tecnicoReasignadoId))) {
      throw new Error('El técnico indicado no está bajo su mando.');
    }
    await valeTallerRepository.asignar(fila.id, tecnicoReasignadoId, `${hoyISO()} ${horaActual()}`);
    const tecnico = await usuarioValeRepository.obtenerPorId(tecnicoReasignadoId);
    const accionReasignacion = esAutoasignacion
      ? 'Encargado desaprobó la propuesta y se reasignó el trabajo a sí mismo'
      : `Encargado desaprobó la propuesta y reasignó a ${tecnico ? tecnico.nombre : tecnicoReasignadoId}`;
    await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.ASIGNADO,
      accionReasignacion, tecnicoReasignadoId);
    const actualizado = await valeRepository.obtenerPorId(valeId);
    valeEvents.notificar({
      vale: actualizado, accion: 'desaprobado y reasignado', actor: usuario.nombre, actorId: usuario.id, destino: tecnico ? tecnico.nombre : null,
      salas: [`tecnico:${tecnicoReasignadoId}`, `taller:${fila.taller_id}`]
    });
    return enriquecer(actualizado);
  }

  // Recalcula el estado GENERAL del vale a partir del progreso de sus talleres.
  // Si algún taller no está APROBADO, el vale permanece en su estado actual
  // (CREADO/MODIFICADO/etc.) — no hay nada más que hacer todavía.
  async _recalcularEstadoVale(valeId, actorUsuarioId) {
    const filas = await valeTallerRepository.listarPorVale(valeId);
    const todosAprobados = filas.length > 0 && filas.every(f => f.estado === ESTADOS_TALLER.APROBADO);
    if (!todosAprobados) return;

    const vale = await valeRepository.obtenerPorId(valeId);
    // Un vale de modificación (MOD-...) SIEMPRE debe retornar al Encargado General
    // para que apruebe/fusione la corrección — sin importar si se envió a uno o
    // varios talleres — porque esa corrección sobrescribe la propuesta original
    // del taller que cometió el error (analisis_correcciones_6.md #2). Solo un
    // vale "normal" con un único taller puede saltarse al Encargado General.
    const requiereEncargadoGeneral = filas.length > 1 || esValeDeModificacion(vale);
    const nuevoEstado = requiereEncargadoGeneral ? ESTADOS.APROBADO_DEPARTAMENTO : ESTADOS.PENDIENTE_CONFIRMACION;
    if (vale.estado === nuevoEstado) return;

    // Con un solo taller y sin ser modificación no hay fusión que hacer (el
    // Encargado General nunca interviene en el camino feliz) — la propuesta de
    // ese único taller pasa a ser directamente el "documento oficial" del vale
    // (analisis_correcciones_4.md #1).
    if (filas.length === 1 && nuevoEstado === ESTADOS.PENDIENTE_CONFIRMACION) {
      const propuesta = await propuestaRepository.obtenerUltimaPorValeYTecnico(valeId, filas[0].tecnico_id);
      if (propuesta && propuesta.url) {
        await valeRepository.actualizarPropuestaGeneral(valeId, propuesta.url);
      }
    }

    await valeRepository.actualizarEstado(valeId, nuevoEstado);
    const accion = nuevoEstado === ESTADOS.PENDIENTE_CONFIRMACION
      ? 'Único taller aprobado — pasa directo a confirmación del asesor'
      : 'Todos los talleres aprobaron — pendiente de fusión por Encargado General';
    await registrarHistorial(valeId, actorUsuarioId, null, vale.estado, nuevoEstado, accion);
  }

  // -----------------------------------------------------------------------
  // Encargado General: fusiona y aprueba vales multi-taller (también el punto de
  // reentrada cuando el asesor rechaza un vale — analisis_correcciones_4.md #2/#11)
  // -----------------------------------------------------------------------
  async aprobarGeneral(usuario, valeId, archivoFusion) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      if (vale.estado !== ESTADOS.APROBADO_DEPARTAMENTO) {
        throw new Error('Solo se pueden fusionar y aprobar vales en estado APROBADO_DEPARTAMENTO.');
      }
      // La fusión de las propuestas de los talleres NO la hace el sistema — es trabajo
      // manual del Encargado General, que debe adjuntar su propio documento final
      // (analisis_correcciones_4.md #11), aun cuando solo hubo un taller involucrado.
      if (!archivoFusion) {
        throw new Error('Debe adjuntar el documento de fusión antes de aprobar.');
      }
      const saved = await fileStorage.saveFile(archivoFusion.buffer, archivoFusion.originalname, archivoFusion.mimetype);

      // El documento que sube aquí el Encargado General queda disponible como
      // propuesta (enlace "Ver propuesta"), pero NUNCA se fusiona (copyPages)
      // dentro del PDF oficial del vale: ese PDF es el documento ADMINISTRATIVO
      // del vale (encabezado, cliente, venta, firma), no el lugar donde vive el
      // diseño/propuesta — antes sí se fusionaba para un vale normal (no así
      // para uno de modificación), y ese era justo el bug reportado: el
      // supervisor, al revisar una solicitud de modificación y abrir "Ver vale
      // de arte", veía el vale original con la propuesta pegada al final
      // (analisis_correcciones_10.md #3).
      await this._regenerarPdf(valeId);
      await valeRepository.actualizarPropuestaGeneral(valeId, saved.path);
      // analisis_correcciones_16.md #4/#5: sella quién fusionó y cuándo — es lo
      // que le permite a _trabajoEncargadoTaller mostrarle a ESE encargado (y
      // solo a él) una fila de fusión con fecha propia, sin depender del
      // estado del vale (que sigue cambiando después).
      await valeRepository.sellarFusion(valeId, { fusionadoPor: usuario.id, fusionadoEn: `${hoyISO()} ${horaActual()}` });
      await valeRepository.actualizarEstado(valeId, ESTADOS.PENDIENTE_CONFIRMACION);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.PENDIENTE_CONFIRMACION,
        'Encargado General adjuntó la fusión final del trabajo de los talleres y aprobó el vale');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificar({ vale: actualizado, accion: 'aprobado (fusión general)', actor: usuario.nombre, actorId: usuario.id, salas: [`asesor:${vale.asesor_id}`] });
      return enriquecer(actualizado);
    });
  }

  // -----------------------------------------------------------------------
  // Asesor: confirmar recibido / rechazar (= solicitar corrección, misma acción)
  // -----------------------------------------------------------------------
  async confirmarRecibido(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      this._assertPropioDelAsesor(usuario, vale);
      if (vale.estado !== ESTADOS.PENDIENTE_CONFIRMACION) {
        throw new Error('Solo se puede confirmar de recibido un vale PENDIENTE_CONFIRMACION.');
      }
      await valeRepository.actualizarEstado(valeId, ESTADOS.RECIBIDO);
      const ahora = `${hoyISO()} ${horaActual()}`;
      // Congela el atraso de forma permanente — ya no debe seguir corriendo aunque
      // más adelante se solicite una modificación sobre este vale (analisis_correcciones_8.md #7).
      await valeRepository.congelarAtraso(valeId, ahora);
      // analisis_correcciones_10.md #7: sella cuándo se confirmó — lo usa el
      // Supervisor en su "Trabajo Realizado" (segundo grupo, orden por esta fecha).
      await valeRepository.sellarConfirmacion(valeId, ahora);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.RECIBIDO, 'Asesor confirmó de recibido el vale de arte');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // analisis_correcciones_12.md #10: notifica a TODOS los supervisores que
      // cubren la tienda de este asesor (pueden ser varios, rotativos).
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id);
      valeEvents.notificar({
        vale: actualizado, accion: 'confirmado de recibido', actor: usuario.nombre, actorId: usuario.id,
        salas: supervisores.map(s => `supervisor:${s.id}`)
      });
      return enriquecer(actualizado);
    });
  }

  // -----------------------------------------------------------------------
  // Modificación: solicitar (staging) → aprobar (crea un vale de arte NUEVO)
  // -----------------------------------------------------------------------
  // Ya no existe una acción separada de "rechazar" (analisis_correcciones_5.md
  // #5): un vale PENDIENTE_CONFIRMACION que el asesor no acepta sigue este MISMO
  // camino — solicitar modificación — en vez de caer a un estado EN_CORRECCION.
  async solicitarModificacion(usuario, valeId, payload) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      this._assertPropioDelAsesor(usuario, vale);
      if (![ESTADOS.RECIBIDO, ESTADOS.PENDIENTE_CONFIRMACION].includes(vale.estado)) {
        throw new Error('Solo se puede solicitar modificación sobre un vale RECIBIDO o PENDIENTE_CONFIRMACION.');
      }
      // Un vale ya no puede modificarse si YA utilizó su única modificación
      // (`vale.modificado`) NI si él mismo es el resultado de una modificación
      // (`vale.vale_original_id`, es decir su correlativo ya lleva el prefijo
      // MOD-) — antes solo se chequeaba `modificado`, así que un vale MOD-...
      // que llegaba a RECIBIDO podía encadenar una segunda modificación
      // (analisis_correcciones_8.md #5).
      if (esValeDeModificacion(vale)) {
        throw new Error('Este vale de arte ya utilizó su única modificación permitida.');
      }
      if (!payload.justificacion) {
        throw new Error('Debe justificar la modificación solicitada.');
      }
      const datos = await this._validarDatosVale(payload, { requiereTalleres: false });

      // analisis_correcciones_12.md #11: el destino de la modificación ya no lo
      // decide un Encargado General al reenviar — se resuelve AQUÍ, con el
      // vale_talleres del original: si fue a un solo taller (Munditrofeos o
      // Diseño Local, da igual), el destino es obvio y no hace falta preguntar;
      // si fue a 2+ talleres de Munditrofeos, el asesor debe elegir un
      // subconjunto no vacío de esos MISMOS talleres (nunca uno al que el vale
      // original nunca fue).
      const filasOriginal = await valeTallerRepository.listarPorVale(valeId);
      const talleresOriginalIds = [...new Set(filasOriginal.map(f => f.taller_id))];
      let talleresIdsModificacion;
      if (talleresOriginalIds.length <= 1) {
        talleresIdsModificacion = talleresOriginalIds;
      } else {
        let elegidos;
        try {
          elegidos = Array.isArray(payload.talleresIds) ? payload.talleresIds : JSON.parse(payload.talleresIds || '[]');
        } catch {
          throw new Error('Los talleres seleccionados no tienen un formato válido.');
        }
        elegidos = [...new Set((elegidos || []).map(Number).filter(Number.isFinite))];
        if (elegidos.length === 0) {
          throw new Error('Debe indicar a cuál(es) de los talleres originales enviar la modificación.');
        }
        if (!elegidos.every(id => talleresOriginalIds.includes(id))) {
          throw new Error('Solo puede elegir entre los talleres a los que se envió el vale original.');
        }
        talleresIdsModificacion = elegidos;
      }

      await solicitudModificacionRepository.crear({
        valeOriginalId: valeId,
        asesorId: usuario.id,
        fechaEntrega: datos.fechaEntregaNorm,
        fechaEvento: datos.fechaEventoNorm,
        urgente: datos.urgente,
        clienteEmpresa: datos.clienteEmpresa,
        clienteNombre: datos.clienteNombre,
        clienteTelefono: datos.clienteTelefono,
        clienteCorreo: datos.clienteCorreo,
        productoId: datos.productoId,
        materialId: datos.materialId,
        tecnica: datos.tecnica,
        acabado: datos.acabado,
        cantidad: datos.cantidad,
        cotizacion: datos.cotizacion,
        talleresIds: talleresIdsModificacion.join(','),
        justificacion: payload.justificacion
      });
      await valeRepository.actualizarEstado(valeId, ESTADOS.SOLICITANDO_MODIFICACION);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.SOLICITANDO_MODIFICACION, 'Asesor solicitó modificación');

      const actualizado = await valeRepository.obtenerPorId(valeId);
      // analisis_correcciones_12.md #10: notifica a todos los supervisores que
      // cubren la tienda de este asesor.
      const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(usuario.id);
      valeEvents.notificar({
        vale: actualizado, accion: 'puesto en solicitud de modificación', actor: usuario.nombre, actorId: usuario.id,
        salas: supervisores.map(s => `supervisor:${s.id}`)
      });
      return enriquecer(actualizado);
    });
  }

  async aprobarModificacion(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      const original = await this._requerirVale(valeId);
      if (original.estado !== ESTADOS.SOLICITANDO_MODIFICACION) {
        throw new Error('Solo se pueden aprobar vales en estado SOLICITANDO_MODIFICACION.');
      }
      const solicitud = await solicitudModificacionRepository.obtenerPendientePorValeOriginal(valeId);
      if (!solicitud) {
        throw new Error('No se encontró una solicitud de modificación pendiente para este vale.');
      }

      const correlativoNuevo = original.correlativo.startsWith('MOD-') ? original.correlativo : `MOD-${original.correlativo}`;
      const nuevoValeId = await valeRepository.crear({
        correlativo: correlativoNuevo,
        asesorId: solicitud.asesor_id,
        tiendaId: original.tienda_id,
        valeOriginalId: original.id,
        fechaCreacion: hoyISO(),
        horaCreacion: horaActual(),
        fechaEntrega: solicitud.fecha_entrega,
        fechaEvento: solicitud.fecha_evento,
        urgente: solicitud.urgente,
        clienteEmpresa: solicitud.cliente_empresa,
        clienteNombre: solicitud.cliente_nombre,
        clienteTelefono: solicitud.cliente_telefono,
        clienteCorreo: solicitud.cliente_correo,
        productoId: solicitud.producto_id,
        materialId: solicitud.material_id,
        tecnica: solicitud.tecnica,
        acabado: solicitud.acabado,
        cantidad: solicitud.cantidad,
        cotizacion: solicitud.cotizacion,
        // La justificación de la modificación ES el nuevo "Boceto y Descripción" del
        // vale de arte de la modificación — no se precarga la descripción original
        // (analisis_correcciones_4.md #7).
        descripcion: solicitud.justificacion,
        estado: ESTADOS.MODIFICADO,
        // analisis_correcciones_10.md #6: el vale MOD- nace YA autorizado — la
        // acción de aprobarModificacion ES la autorización (a diferencia del vale
        // normal, que necesita un paso aparte, autorizarCreacion) — así la firma
        // roja aparece en su PDF desde el primer _regenerarPdf.
        autorizadoPor: usuario.id,
        autorizadoEn: `${hoyISO()} ${horaActual()}`,
        autorizacionTipo: 'MODIFICACION'
      });

      // analisis_correcciones_12.md #11: el destino ya lo eligió el asesor (o se
      // resolvió automáticamente) al solicitar la modificación — el fan-out
      // ocurre AQUÍ, de inmediato, igual que un vale nuevo autorizado. Ya no
      // existe un paso intermedio de "reenvío" a cargo de un Encargado General.
      const talleresIdsModificacion = (solicitud.talleres_ids || '').split(',').map(Number).filter(Number.isFinite);
      await this._fanOutTalleres(nuevoValeId, talleresIdsModificacion);
      const nombresTalleresModificacion = await this._nombresDeTalleres(talleresIdsModificacion);

      // El documento adjunto al nuevo vale es la propuesta ya aprobada del vale
      // original (no se precargan imágenes ni el documento adjunto original) —
      // analisis_correcciones_4.md #7. Se fusiona automáticamente al regenerar el PDF.
      const propuestaOriginal = original.propuesta_general_url
        || (await propuestaRepository.obtenerUltimaPorVale(original.id))?.url;
      if (propuestaOriginal) {
        await documentoRepository.crear({
          valeId: nuevoValeId,
          nombreOriginal: `Propuesta original - ${original.correlativo}.pdf`,
          ruta: propuestaOriginal,
          tipo: 'documento',
          mimeType: 'application/pdf',
          tamano: 0,
          esModificacion: true,
          subidoPor: usuario.id
        });
      }

      await valeRepository.marcarModificado(original.id);
      // analisis_correcciones_15.md #1: el original pasa a CONFIRMADO (estado
      // final propio), no a RECIBIDO — antes era indistinguible de un vale sin
      // modificación y desaparecía de vistas que excluyen RECIBIDO a propósito.
      await valeRepository.actualizarEstado(original.id, ESTADOS.CONFIRMADO);
      // El original puede llegar aquí sin haber pasado nunca por confirmarRecibido()
      // (ej. se solicitó modificación directo desde PENDIENTE_CONFIRMACION, el
      // camino de "rechazo" — analisis_correcciones_5.md #5); en ese caso este es
      // el primer y único momento en que su atraso debe congelarse
      // (analisis_correcciones_8.md #7). Si ya estaba congelado (venía de RECIBIDO),
      // congelarAtraso() no hace nada (WHERE atraso_congelado_en IS NULL).
      await valeRepository.congelarAtraso(original.id, `${hoyISO()} ${horaActual()}`);
      await solicitudModificacionRepository.marcarEstado(solicitud.id, 'APROBADA');

      await registrarHistorial(original.id, usuario.id, null, ESTADOS.SOLICITANDO_MODIFICACION, ESTADOS.CONFIRMADO,
        `Supervisor aprobó la solicitud de modificación — se creó el vale ${correlativoNuevo}`);
      await registrarHistorial(nuevoValeId, usuario.id, null, null, ESTADOS.MODIFICADO,
        `Vale creado a partir de la modificación aprobada de ${original.correlativo} — enviado a taller${talleresIdsModificacion.length > 1 ? 'es' : ''}: ${nombresTalleresModificacion}`);
      await this._regenerarPdf(nuevoValeId);

      const nuevoVale = await valeRepository.obtenerPorId(nuevoValeId);
      valeEvents.notificar({
        vale: nuevoVale, accion: 'autorizado (modificación)', actor: usuario.nombre, actorId: usuario.id,
        salas: [`asesor:${solicitud.asesor_id}`, `supervisor:${usuario.id}`, ...talleresIdsModificacion.map(id => `taller:${id}`)]
      });
      return enriquecer(nuevoVale);
    });
  }

  // "Ver PDF" siempre sirve el PDF del vale que se pidió — nunca lo sustituye por
  // el de otro vale (analisis_correcciones_10.md #4: revierte a propósito
  // analisis_correcciones_5.md #4, que hacía que pedir el PDF de un vale original
  // ya modificado devolviera el del vale MOD- nuevo; desde la perspectiva del
  // usuario eso hacía ver "sobreescrito" el registro original, aunque en la base
  // de datos nunca se perdió nada — aprobarModificacion siempre hace un INSERT
  // nuevo, no un UPDATE). El original y su MOD- quedan como dos vales
  // independientes y consultables, cada uno con su propio PDF.
  async obtenerValeParaPdf(usuario, valeId) {
    return this._requerirVale(valeId);
  }

  // -----------------------------------------------------------------------
  // Helpers de autorización de negocio
  // -----------------------------------------------------------------------
  async _requerirVale(valeId) {
    const vale = await valeRepository.obtenerPorId(valeId);
    if (!vale) throw new Error('Vale de arte no encontrado.');
    return vale;
  }

  _assertPropioDelAsesor(usuario, vale) {
    if (esAdministrador(usuario)) return;
    if (vale.asesor_id !== usuario.id) {
      throw new Error('Este vale de arte no pertenece a este asesor.');
    }
  }
}

module.exports = new ValeService();
module.exports.ESTADOS = ESTADOS;
module.exports.ESTADOS_TALLER = ESTADOS_TALLER;
