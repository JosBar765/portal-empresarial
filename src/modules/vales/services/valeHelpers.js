// src/modules/vales/services/valeHelpers.js
const valeRepository = require('../repositories/valeRepository');
const historialRepository = require('../repositories/historialRepository');
const { ahoraUTC6 } = require('../../../core/calendario/calendarioLaboral');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');

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

// Días hábiles mínimos (contados desde hoy) de la fecha de entrega según el tipo de modificación; con «urgente» basta el siguiente día que reciba vales.
const DIAS_HABILES_MODIFICACION = { BASICA: 1, MEDIA: 2, AVANZADA: 3 };
const DIAS_HABILES_MODIFICACION_URGENTE = 1;
const TIPOS_MODIFICACION_CON_VALE = Object.keys(DIAS_HABILES_MODIFICACION);
const diasHabilesDeModificacion = (tipo, urgente) => (urgente ? DIAS_HABILES_MODIFICACION_URGENTE : DIAS_HABILES_MODIFICACION[tipo]);

// Código de un vale MOD: MOD-X, MOD2-X, MOD3-X… con X el correlativo del vale raíz, que nunca cambia.
const PREFIJO_MOD = /^MOD\d*-/;
const esCorrelativoMod = (correlativo) => PREFIJO_MOD.test(String(correlativo || ''));
const correlativoBase = (correlativo) => String(correlativo || '').replace(PREFIJO_MOD, '');
const armarCorrelativoMod = (base, numero) => `MOD${numero > 1 ? numero : ''}-${base}`;

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

// Mensaje de un chat entre asesor y taller: texto no vacío de hasta 200 caracteres (se cuentan caracteres, no palabras).
const MAX_CARACTERES_MENSAJE = 200;
function validarMensajeChat(mensaje) {
  const texto = String(mensaje == null ? '' : mensaje).trim();
  if (!texto) throw new Error('Escribe un mensaje.');
  if (Array.from(texto).length > MAX_CARACTERES_MENSAJE) throw new Error(`El mensaje no puede tener más de ${MAX_CARACTERES_MENSAJE} caracteres.`);
  return texto;
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
  if (!vale) throw new ErrorDeNegocio('Este vale ya no existe: fue dado de baja o rechazado.', 404);
  return vale;
}

// Quien puede crear y gestionar vales propios depende del permiso `vales.crear`, no del rol (debe tener además una fila en
// `asesores` para saber de qué tienda es); cada uso lo combina con el chequeo de dueño. Autorizar su propio vale es una regla aparte.
function puedeActuarComoAsesor(usuario) {
  return (usuario.permissions || []).includes('vales.crear');
}

function assertPropioDelAsesor(usuario, vale) {
  if (esAdministrador(usuario)) return;
  if (vale.asesor_id !== usuario.id) {
    throw new ErrorDeNegocio('Este vale fue creado por otro asesor.', 403);
  }
}

// Salas de todos los involucrados: asesor dueño, sus supervisores y los talleres y diseñadores de las filas dadas (calcular antes de borrar el vale).
async function salasDeInvolucrados(vale, talleres) {
  const supervisores = await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id);
  const salasTalleres = talleres.flatMap(t => [`taller:${t.taller_id}`, ...(t.disenador_id ? [`disenador:${t.disenador_id}`] : [])]);
  return [...new Set([`asesor:${vale.asesor_id}`, ...supervisores.map(s => `supervisor:${s.id}`), ...salasTalleres])];
}

// Supervisor (rol 3) que cubre la tienda del asesor dueño del vale: lee sus chats, nunca escribe.
async function esSupervisorDelAsesor(usuario, vale) {
  if (usuario.rolId !== ROL.SUPERVISOR) return false;
  return (await usuarioValeRepository.obtenerSupervisoresDeAsesor(vale.asesor_id)).some(s => s.id === usuario.id);
}

// Un taller que ya respondió, aceptó o trabaja protege el vale del borrado por plazo de adjuntos vencido.
const ESTADOS_SIN_PROTEGER = [ESTADOS_TALLER.VERIFICANDO_ADJUNTOS, ESTADOS_TALLER.ADJUNTOS_RECHAZADOS];
const algunTallerProtege = (filas) => filas.some(f => !ESTADOS_SIN_PROTEGER.includes(f.estado));

// Topes técnicos de las columnas INT (cantidad) y DECIMAL(10,2) (cotización) de `vales`; el borrador los comparte.
const MAX_ENTERO = 2147483647;
const MAX_COTIZACION = 99999999.99;
const conMiles = (texto) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const TEXTO_MAX_ENTERO = conMiles(String(MAX_ENTERO));
const TEXTO_MAX_COTIZACION = (([entero, decimales]) => `${conMiles(entero)},${decimales}`)(MAX_COTIZACION.toFixed(2).split('.'));

// Sin tope, un valor enorme llegaba a MySQL y respondía un 500 genérico.
function validarCantidadYCotizacion(cantidad, cotizacion) {
  const cantidadNum = Number(cantidad);
  if (!Number.isInteger(cantidadNum) || cantidadNum < 1 || cantidadNum > MAX_ENTERO) {
    throw new Error(`La cantidad debe ser un número entero de 1 en adelante (máximo ${TEXTO_MAX_ENTERO}). Revisa el valor ingresado.`);
  }
  const cotizacionNum = Number(cotizacion);
  if (!Number.isFinite(cotizacionNum) || cotizacionNum <= 0 || cotizacionNum > MAX_COTIZACION) {
    throw new Error(`La cotización debe ser un número mayor a 0 y de hasta ${TEXTO_MAX_COTIZACION}. Revisa el valor ingresado.`);
  }
  return { cantidad: cantidadNum, cotizacion: cotizacionNum };
}

// Máximos de texto del vale: los que caben en su celda del PDF aun con letras anchas (la descripción se autoajusta); el borrador los comparte.
const LIMITES_TEXTO_VALE = {
  clienteNombre: 100, clienteEmpresa: 100, clienteTelefono: 20, clienteCorreo: 100,
  producto: 40, material: 40, tecnica: 40, acabado: 40, descripcion: 600
};
const ETIQUETAS_TEXTO_VALE = {
  clienteNombre: 'El nombre del cliente', clienteEmpresa: 'La empresa', clienteTelefono: 'El teléfono',
  clienteCorreo: 'El correo', producto: 'El código de producto', material: 'El material',
  tecnica: 'La técnica', acabado: 'El acabado', descripcion: 'La descripción'
};

// Sin esto, un texto demasiado largo llegaba a MySQL y su error nombraba la columna.
function validarLongitudCampo(campo, valor) {
  const maximo = LIMITES_TEXTO_VALE[campo];
  if (!valor || String(valor).length <= maximo) return;
  const etiqueta = ETIQUETAS_TEXTO_VALE[campo];
  throw new Error(`${etiqueta} es demasiad${etiqueta.startsWith('La ') ? 'a larga' : 'o largo'} (máximo ${maximo} caracteres).`);
}

// Talleres a los que un asesor puede enviar: los generales y el Diseño Local de su propia tienda.
const talleresElegiblesDeTienda = (talleres, tiendaId) => talleres.filter(t => t.tienda_id == null || t.tienda_id === tiendaId);

// Elegibilidad de los talleres de un vale (ids ya numéricos): los mismos mensajes al crear, al guardar un borrador y al consultar fechas.
// `tiendaIdAsesor` activa las reglas de Diseño Local: nunca se mezcla con los generales ni se elige el de otra tienda.
function validarEleccionTalleres(talleresIds, talleresActivos, tiendaIdAsesor = null) {
  const idsValidos = new Set(talleresActivos.map(t => t.id));
  if (!talleresIds.every(id => idsValidos.has(id))) {
    throw new Error('Alguno de los talleres elegidos ya no está disponible. Vuelve a elegirlos.');
  }
  if (tiendaIdAsesor === null) return;
  const seleccionados = talleresIds.map(id => talleresActivos.find(t => t.id === id));
  const locales = seleccionados.filter(t => t.tienda_id !== null);
  const generales = seleccionados.filter(t => t.tienda_id === null);
  if (locales.length > 0 && generales.length > 0) {
    throw new Error('El Diseño Local no se puede combinar con los talleres generales (Diseño, Diseño UV/3D y Protextil). Elige solo uno de los dos tipos.');
  }
  if (locales.some(t => t.tienda_id !== tiendaIdAsesor)) {
    throw new Error('Solo se puede enviar a Diseño Local de su propia tienda.');
  }
}

module.exports = {
  LIMITES_TEXTO_VALE, ETIQUETAS_TEXTO_VALE, validarLongitudCampo, validarEleccionTalleres, talleresElegiblesDeTienda,
  algunTallerProtege, ESTADOS, ESTADOS_EDITABLES_ASESOR, ESTADOS_TERMINALES, ESTADOS_CONFIRMADOS, ESTADOS_TALLER,
  ROL, ROLES_ENCARGADO_TALLER, ROLES_TALLER_Y_DISENADOR, PERMISO_FUSION, SALA_FUSION,
  esAdministrador, esAsistente, rolEncargadoDe, esDeTaller, esTallerODisenador,
  hoyISO, horaActual, calcularAtraso, enriquecer,
  esValeDeModificacion, DIAS_HABILES_MODIFICACION, diasHabilesDeModificacion, TIPOS_MODIFICACION_CON_VALE,
  PREFIJO_MOD, esCorrelativoMod, correlativoBase, armarCorrelativoMod, estadoEnAutorizacion, etiquetaActorTaller, estadoVisibleAsesor,
  dentroDeVentana, ordenarPorGrupos, ordenarPorFecha, esHoy,
  normalizarDatetime, esUrgente, DIAS_MINIMOS_SIN_URGENTE, registrarHistorial, MAX_ENTERO, MAX_COTIZACION, validarCantidadYCotizacion,
  requerirVale, assertPropioDelAsesor, puedeActuarComoAsesor, validarMotivoRechazo, validarMensajeChat, salasDeInvolucrados, esSupervisorDelAsesor
};
