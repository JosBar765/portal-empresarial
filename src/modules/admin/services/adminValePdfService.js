// src/modules/admin/services/adminValePdfService.js
// Genera el PDF de un vale con datos arbitrarios (correcciones). No crea ni
// modifica vales: solo genera, sube a Storage y deja una fila de auditoría.
const bcrypt = require('bcryptjs');
const valePdfService = require('../../vales/services/valePdfService');
const subirYRegistrarArchivo = require('../../../core/files/subirYRegistrarArchivo');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idOpcional } = require('../../../core/utils/validar');
const repo = require('../repositories/valePdfGeneradoRepository');

const HASH_FICTICIO = bcrypt.hashSync('contrasena-ficticia-que-nadie-usa', 10);
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_FECHA_HORA = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?$/;
const RE_HORA = /^\d{2}:\d{2}(:\d{2})?$/;

const err = (msg, status = 400) => new ErrorDeNegocio(msg, status);

function texto(body, campo, etiqueta, { max = 200, obligatorio = false } = {}) {
  const v = body[campo] === undefined || body[campo] === null ? '' : String(body[campo]).trim();
  if (!v) {
    if (obligatorio) throw err(`${etiqueta} es obligatorio.`);
    return '';
  }
  if (v.length > max) throw err(`${etiqueta} no puede superar ${max} caracteres.`);
  return v;
}

function fechaValida(v) {
  if (!RE_FECHA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function fecha(body, campo, etiqueta, obligatorio) {
  const v = texto(body, campo, etiqueta, { max: 10, obligatorio });
  if (v && !fechaValida(v)) throw err(`${etiqueta} no tiene un formato de fecha válido (AAAA-MM-DD).`);
  return v;
}

function fechaHora(body, campo, etiqueta, obligatorio) {
  const v = texto(body, campo, etiqueta, { max: 19, obligatorio });
  if (!v) return '';
  const m = RE_FECHA_HORA.exec(v);
  if (!m || !fechaValida(m[1])) throw err(`${etiqueta} no tiene un formato válido (AAAA-MM-DD HH:MM).`);
  return `${m[1]} ${m[2]}${m[3] || ':00'}`;
}

const bandera = (v) => ['1', 'true', 'on', 'si', 'sí'].includes(String(v ?? '').trim().toLowerCase());

class AdminValePdfService {
  async opciones() {
    const [supervisores, asesores] = await Promise.all([repo.listarSupervisores(), repo.listarAsesores()]);
    return { supervisores, asesores };
  }

  listar() {
    return repo.listarRecientes(50);
  }

  // Misma contraseña de la cuenta que inició sesión; no toca el bloqueo de la cuenta.
  async verificarContrasena(usuarioId, password) {
    if (typeof password !== 'string' || !password) throw err('Ingresa tu contraseña para generar el PDF.');
    const cred = await repo.obtenerCredencial(usuarioId);
    const intento = password.slice(0, 72);
    const valida = await bcrypt.compare(intento, cred ? cred.password_hash : HASH_FICTICIO);
    if (!cred || !cred.activo || !valida) throw err('Contraseña incorrecta.', 403);
  }

  // Convierte el formulario en un objeto con la forma que consume valePdfService.
  async armarVale(body) {
    const cantidad = texto(body, 'cantidad', 'La cantidad', { max: 9, obligatorio: true });
    if (!/^\d+$/.test(cantidad)) throw err('La cantidad debe ser un número entero.');
    const cotizacionTxt = texto(body, 'cotizacion', 'La cotización', { max: 15, obligatorio: true });
    const cotizacion = Number(cotizacionTxt);
    if (!Number.isFinite(cotizacion) || cotizacion < 0) throw err('La cotización debe ser un número válido.');
    const horaIngreso = texto(body, 'horaIngreso', 'La hora de ingreso', { max: 8, obligatorio: true });
    if (!RE_HORA.test(horaIngreso)) throw err('La hora de ingreso no tiene un formato válido (HH:MM).');

    const vale = {
      correlativo: texto(body, 'correlativo', 'El correlativo', { max: 50, obligatorio: true }),
      __fechaGeneracion: fechaHora(body, 'fechaGeneracion', 'La fecha de generación', true),
      __asesorNombre: texto(body, 'asesorNombre', 'El nombre del asesor', { obligatorio: true }),
      __asesorCorreo: texto(body, 'asesorCorreo', 'El correo del asesor'),
      __asesorTelefono: texto(body, 'asesorTelefono', 'El teléfono del asesor', { max: 30 }),
      cliente_empresa: texto(body, 'clienteEmpresa', 'La empresa'),
      cliente_nombre: texto(body, 'clienteNombre', 'El nombre del cliente', { obligatorio: true }),
      cliente_telefono: texto(body, 'clienteTelefono', 'El teléfono del cliente', { max: 30 }),
      cliente_correo: texto(body, 'clienteCorreo', 'El correo del cliente'),
      fecha_creacion: fecha(body, 'fechaIngreso', 'La fecha de ingreso', true),
      hora_creacion: horaIngreso,
      fecha_entrega: fecha(body, 'fechaEntrega', 'La fecha de entrega', true),
      fecha_evento: fecha(body, 'fechaEvento', 'La fecha del evento', false),
      urgente: bandera(body.urgente),
      producto: texto(body, 'producto', 'El producto'),
      material: texto(body, 'material', 'El material'),
      tecnica: texto(body, 'tecnica', 'La técnica'),
      acabado: texto(body, 'acabado', 'El acabado'),
      cantidad,
      cotizacion,
      descripcion: texto(body, 'descripcion', 'La descripción', { max: 5000 }),
      modificado: bandera(body.modificado),
      __firmaAutorizacion: null
    };

    const supervisorId = idOpcional(body.supervisorId, 'Supervisor');
    if (supervisorId) {
      const sup = await repo.obtenerSupervisor(supervisorId);
      if (!sup) throw err('El supervisor elegido no existe.');
      const tipo = texto(body, 'tipoAutorizacion', 'El tipo de autorización', { max: 12, obligatorio: true });
      if (!['CREACION', 'MODIFICACION'].includes(tipo)) throw err('El tipo de autorización debe ser CREACION o MODIFICACION.');
      vale.__firmaAutorizacion = {
        nombre: sup.nombre,
        tipo,
        fechaHora: fechaHora(body, 'fechaAutorizacion', 'La fecha de autorización', true)
      };
    }
    return vale;
  }

  async generar(usuarioId, body, archivos) {
    await this.verificarContrasena(usuarioId, body.password);
    const vale = await this.armarVale(body);
    const documentos = [
      ...archivos.imagenes.map(f => ({ tipo: 'imagen', buffer: f.buffer, mime_type: f.mimetype, nombre_original: f.originalname })),
      ...archivos.documentos.map(f => ({ tipo: 'documento', buffer: f.buffer, mime_type: f.mimetype, nombre_original: f.originalname }))
    ];
    const pdf = await valePdfService.generarPdfVale(vale, documentos);
    // Si falla el registro, subirYRegistrarArchivo borra el archivo recién subido.
    return subirYRegistrarArchivo({
      buffer: pdf, nombreOriginal: `${vale.correlativo}.pdf`, mimeType: 'application/pdf',
      registrar: async (subida) => {
        const id = await repo.insertar({ usuarioId, correlativo: vale.correlativo, url: subida.url });
        return { id, correlativo: vale.correlativo, url: subida.url };
      }
    });
  }
}

module.exports = new AdminValePdfService();
