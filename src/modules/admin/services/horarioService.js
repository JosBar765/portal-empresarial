// src/modules/admin/services/horarioService.js
// Horario laboral semanal (global) y feriados por país. Solo CRUD: ninguna otra regla los consulta todavía.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio, idOpcional } = require('../../../core/utils/validar');
const repo = require('../repositories/horarioRepository');
const tiendaAdminRepository = require('../repositories/tiendaAdminRepository');

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_CONTROL = /[\u0000-\u001F\u007F]/;
const ANIO_MIN = 2000;
const ANIO_MAX = 2100;
const MAX_NOMBRE = 100;
const CLAVE_HORAS_VENCIMIENTO = 'horas_vencimiento_vale';
const HORAS_VENCIMIENTO_MIN = 1;
const HORAS_VENCIMIENTO_MAX = 48;

const err = (msg, status = 400) => new ErrorDeNegocio(msg, status);
const vacio = (v) => v === undefined || v === null || v === '';

function validarHora(valor, etiqueta) {
  if (typeof valor !== 'string' || !RE_HORA.test(valor)) throw err(`${etiqueta} no es una hora válida (HH:MM, de 00:00 a 23:59).`);
  return valor;
}

function validarDia(d) {
  if (!d || typeof d !== 'object') throw err('Cada día debe indicar sus datos.');
  const diaSemana = d.diaSemana;
  if (!Number.isInteger(diaSemana) || diaSemana < 1 || diaSemana > 7) throw err('El día de la semana debe ser un número del 1 (lunes) al 7 (domingo).');
  const nombre = DIAS[diaSemana - 1];
  if (typeof d.laboral !== 'boolean') throw err(`Indica si el ${nombre} es laboral o no.`);
  if (d.recibeVales !== undefined && typeof d.recibeVales !== 'boolean') throw err(`Indica si el ${nombre} recibe vales de arte o no.`);
  const recibeVales = d.recibeVales === true;
  if (!d.laboral) {
    if (recibeVales) throw err(`El ${nombre} no es laboral, por lo que no puede recibir vales de arte.`);
    if (!vacio(d.horaInicio) || !vacio(d.horaFin)) throw err(`El ${nombre} no es laboral, por lo que no puede tener horario.`);
    return { diaSemana, laboral: false, recibeVales: false, horaInicio: null, horaFin: null };
  }
  if (vacio(d.horaInicio) || vacio(d.horaFin)) throw err(`El ${nombre} es laboral: indica la hora de inicio y la hora de fin.`);
  const horaInicio = validarHora(d.horaInicio, `La hora de inicio del ${nombre}`);
  const horaFin = validarHora(d.horaFin, `La hora de fin del ${nombre}`);
  if (horaInicio >= horaFin) throw err(`En el ${nombre}, la hora de inicio debe ser anterior a la hora de fin.`);
  return { diaSemana, laboral: true, recibeVales, horaInicio, horaFin };
}

function aHorario(fila) {
  return { diaSemana: fila.dia_semana, laboral: !!fila.laboral, recibeVales: !!fila.recibe_vales, horaInicio: fila.hora_inicio, horaFin: fila.hora_fin };
}

function validarFecha(valor) {
  const m = typeof valor === 'string' ? RE_FECHA.exec(valor) : null;
  if (!m) throw err('La fecha no es válida (AAAA-MM-DD).');
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) throw err('La fecha no existe en el calendario.');
  if (anio < ANIO_MIN || anio > ANIO_MAX) throw err(`El año de la fecha debe estar entre ${ANIO_MIN} y ${ANIO_MAX}.`);
  return valor;
}

function validarNombre(valor) {
  if (typeof valor !== 'string' || !valor.trim()) throw err('El nombre del feriado es obligatorio.');
  const nombre = valor.trim();
  if (nombre.length > MAX_NOMBRE) throw err(`El nombre del feriado no puede superar ${MAX_NOMBRE} caracteres.`);
  if (RE_CONTROL.test(nombre)) throw err('El nombre del feriado contiene caracteres no permitidos.');
  return nombre;
}

function validarFeriado(body) {
  if (!body || typeof body !== 'object') throw err('Datos del feriado inválidos.');
  const seRepite = body.seRepiteCadaAnio === undefined ? false : body.seRepiteCadaAnio;
  if (typeof seRepite !== 'boolean') throw err('«Se repite todos los años» debe ser verdadero o falso.');
  return { fecha: validarFecha(body.fecha), nombre: validarNombre(body.nombre), seRepite };
}

function aFeriado(fila) {
  return { id: fila.id, paisId: fila.pais_id, fecha: fila.fecha, nombre: fila.nombre, seRepiteCadaAnio: !!fila.se_repite_cada_anio };
}

const ddmmaaaa = (f) => f.split('-').reverse().join('/');

class HorarioService {
  async listarHorarios() {
    return (await repo.listarHorarios()).map(aHorario);
  }

  // Valida los 7 días antes de escribir; la escritura es una sola transacción.
  async guardarHorarios(body) {
    const dias = body && body.dias;
    if (!Array.isArray(dias) || dias.length !== 7) throw err('Envía el horario de los 7 días de la semana.');
    const validados = dias.map(validarDia);
    if (new Set(validados.map(d => d.diaSemana)).size !== 7) throw err('Cada día de la semana debe aparecer una sola vez.');
    await repo.guardarHorarios(validados);
    return this.listarHorarios();
  }

  async obtenerParametros() {
    return { horasVencimientoVale: Number(await repo.obtenerParametro(CLAVE_HORAS_VENCIMIENTO)) };
  }

  async guardarParametros(body) {
    const crudo = body && body.horasVencimientoVale;
    if (vacio(crudo)) throw err('Indica las horas de vencimiento de un vale de arte.');
    const horas = typeof crudo === 'string' && /^\d+$/.test(crudo.trim()) ? Number(crudo) : crudo;
    if (typeof horas !== 'number' || !Number.isInteger(horas)) throw err('Las horas de vencimiento deben ser un número entero.');
    if (horas < HORAS_VENCIMIENTO_MIN || horas > HORAS_VENCIMIENTO_MAX) {
      throw err(`Las horas de vencimiento deben estar entre ${HORAS_VENCIMIENTO_MIN} y ${HORAS_VENCIMIENTO_MAX}.`);
    }
    await repo.guardarParametro(CLAVE_HORAS_VENCIMIENTO, horas);
    return this.obtenerParametros();
  }

  listarPaises() {
    return tiendaAdminRepository.listarPaises();
  }

  async listarFeriados(paisIdCrudo) {
    const paisId = idOpcional(paisIdCrudo, 'País');
    return (await repo.listarFeriados(paisId)).map(aFeriado);
  }

  async exigirPais(paisIdCrudo) {
    const paisId = idObligatorio(paisIdCrudo, 'País');
    if (!(await repo.existePais(paisId))) throw err('El país elegido no existe.');
    return paisId;
  }

  async exigirSinChoque(paisId, datos, excluirId) {
    const choques = await repo.buscarChoques(paisId, datos.fecha, datos.seRepite, excluirId);
    if (!choques.length) return;
    const c = choques[0];
    const detalle = c.se_repite_cada_anio || datos.seRepite ? 'ese día y mes (se repite cada año)' : 'esa fecha';
    throw err(`Ya existe un feriado para ${detalle} en este país: «${c.nombre}» (${ddmmaaaa(c.fecha)}).`, 409);
  }

  async crearFeriado(body) {
    const paisId = await this.exigirPais(body && body.paisId);
    const datos = validarFeriado(body);
    await this.exigirSinChoque(paisId, datos);
    const id = await repo.insertarFeriado({ paisId, ...datos });
    return aFeriado(await repo.obtenerFeriado(id));
  }

  // El país de un feriado no cambia: para moverlo de país se elimina y se crea de nuevo.
  async actualizarFeriado(idCrudo, body) {
    const id = idObligatorio(idCrudo, 'Feriado');
    const actual = await repo.obtenerFeriado(id);
    if (!actual) throw err('El feriado no existe.', 404);
    const datos = validarFeriado(body);
    await this.exigirSinChoque(actual.pais_id, datos, id);
    await repo.actualizarFeriado(id, datos);
    return aFeriado(await repo.obtenerFeriado(id));
  }

  async eliminarFeriado(idCrudo) {
    const id = idObligatorio(idCrudo, 'Feriado');
    if (!(await repo.eliminarFeriado(id))) throw err('El feriado no existe.', 404);
    return { ok: true };
  }
}

module.exports = new HorarioService();
