// src/modules/vales/services/valeService.js
const valeRepository = require('../repositories/valeRepository');
const asignacionRepository = require('../repositories/asignacionRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const documentoRepository = require('../repositories/documentoRepository');
const historialRepository = require('../repositories/historialRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const fileStorage = require('../../../core/files/fileStorage');
const valePdfService = require('./valePdfService');
const valeEvents = require('../events');

const ESTADOS = {
  CREADO: 'CREADO',
  ASIGNADO: 'ASIGNADO',
  EN_PROCESO: 'EN_PROCESO',
  EN_REVISION: 'EN_REVISION',
  APROBADO: 'APROBADO',
  CONFIRMACION_MODIFICACION: 'CONFIRMACION_MODIFICACION',
  MODIFICADO: 'MODIFICADO',
  VENDIDO: 'VENDIDO',
  CANCELADO: 'CANCELADO'
};
const ESTADOS_TERMINALES = [ESTADOS.VENDIDO, ESTADOS.CANCELADO];

function pad4(n) {
  return String(n).padStart(4, '0');
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function horaActual() {
  return new Date().toTimeString().slice(0, 8);
}

function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * El atraso es una CONDICIÓN calculada, nunca un estado persistido.
 * Para vales cerrados (VENDIDO/CANCELADO) se congela al momento del cierre
 * (`actualizado_en`) para que el histórico siga mostrando cuánto se atrasó;
 * para el resto se calcula contra la hora actual porque el atraso sigue corriendo.
 */
function calcularAtraso(vale) {
  const referencia = ESTADOS_TERMINALES.includes(vale.estado) ? new Date(vale.actualizado_en.replace(' ', 'T')) : new Date();
  const entrega = new Date(vale.fecha_entrega.replace(' ', 'T'));
  const diffMs = referencia - entrega;
  const atrasado = diffMs > 0;
  const dias = atrasado ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
  return { atrasado, diasAtraso: dias };
}

function enriquecer(vale) {
  const { atrasado, diasAtraso } = calcularAtraso(vale);
  return { ...vale, atrasado, diasAtraso };
}

// El estado LÓGICO que ve el asesor no es el estado real de la máquina de estados:
// colapsa varios estados internos en un puñado de "cubetas" de negocio (ver
// .agents/correciones_mod_vales_de_arte_1.md, VISTA ASESOR #5). Nunca se usa
// para autorización, solo para lo que el asesor ve/filtra/ordena.
function estadoVisibleAsesor(vale) {
  switch (vale.estado) {
    case ESTADOS.VENDIDO: return 'VENDIDO';
    case ESTADOS.CANCELADO: return 'CANCELADO';
    case ESTADOS.APROBADO: return 'APROBADO';
    case ESTADOS.CONFIRMACION_MODIFICACION: return 'SOLICITANDO_MODIFICACION';
    default: return vale.modificado ? 'MODIFICADO' : 'CREADO';
  }
}

function dentroDeVentana(vale, ventana) {
  if (!ventana || !ventana.tipo || ventana.tipo === 'todo') return true;
  const fechaVale = vale.fecha_creacion;
  const fv = new Date(`${fechaVale}T00:00:00`);

  if (ventana.tipo === 'rango') {
    if (!ventana.desde && !ventana.hasta) return true;
    if (ventana.desde && fv < new Date(`${ventana.desde}T00:00:00`)) return false;
    if (ventana.hasta && fv > new Date(`${ventana.hasta}T00:00:00`)) return false;
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

// Normaliza el valor de un <input type="datetime-local"> ("2026-08-25T17:00")
// a 'YYYY-MM-DD HH:MM:SS', el formato que usan tanto MySQL DATETIME como el mock.
function normalizarDatetime(valor) {
  if (!valor) return valor;
  const limpio = String(valor).replace('T', ' ');
  return limpio.length === 16 ? `${limpio}:00` : limpio;
}

async function registrarHistorial(valeId, usuarioId, estadoAnterior, estadoNuevo, accion) {
  await historialRepository.registrar(valeId, usuarioId, estadoAnterior, estadoNuevo, accion);
}

function esAdministrador(usuario) {
  return usuario.rolId === 1;
}

class ValeService {
  constructor() {
    // Mutex en memoria por vale: garantiza idempotencia de las transiciones de estado
    // a nivel de core (no solo de frontend). Válido porque el sistema corre como un
    // único proceso Node (monolito modular, sin infraestructura distribuida).
    this._locksEnVale = new Set();
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

  // -----------------------------------------------------------------------
  // Catálogos para el formulario
  // -----------------------------------------------------------------------
  async obtenerCatalogos() {
    const [localidades, productos, materiales, tecnicas, acabados, paises] = await Promise.all([
      catalogoRepository.listarLocalidades(),
      catalogoRepository.listarProductos(),
      catalogoRepository.listarMateriales(),
      catalogoRepository.listarTecnicas(),
      catalogoRepository.listarAcabados(),
      catalogoRepository.listarPaises()
    ]);
    return { localidades, productos, materiales, tecnicas, acabados, paises };
  }

  // -----------------------------------------------------------------------
  // Creación
  // -----------------------------------------------------------------------
  async crearVale(usuario, payload, archivos) {
    const {
      clienteEmpresa, clienteNombre, clienteTelefono, clienteCorreo,
      fechaEntrega, fechaEvento, urgente, productoId, materialId, tecnicaId, acabadoId,
      cantidad, cotizacion, descripcion
    } = payload;

    if (!clienteNombre || !clienteTelefono || !clienteCorreo) {
      throw new Error('Los datos del cliente (nombre, teléfono, correo) son obligatorios.');
    }
    if (!fechaEntrega || !fechaEvento) {
      throw new Error('Las fechas de entrega y de evento son obligatorias.');
    }
    const fechaEntregaNorm = normalizarDatetime(fechaEntrega);
    const fechaEventoNorm = normalizarDatetime(fechaEvento);
    const cantidadNum = Number(cantidad);
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 1) {
      throw new Error('La cantidad debe ser mayor a 1.');
    }
    const cotizacionNum = Number(cotizacion);
    if (!Number.isFinite(cotizacionNum) || cotizacionNum <= 0) {
      throw new Error('La cotización debe ser un valor numérico mayor a 0.');
    }

    const solicitante = await usuarioValeRepository.obtenerPorId(usuario.id);
    if (!solicitante || !solicitante.localidad_id) {
      throw new Error('El asesor no tiene una localidad asignada, no se puede generar el correlativo.');
    }
    const localidad = await catalogoRepository.obtenerLocalidadPorId(solicitante.localidad_id);
    if (!localidad) {
      throw new Error('Localidad del asesor no encontrada.');
    }

    // Límite diario: si ya se alcanzó, el vale se registra con fecha de creación del día siguiente
    const limite = await valeRepository.obtenerLimiteDiario(usuario.id);
    const hoy = hoyISO();
    const usadosHoy = await valeRepository.contarValesPorAsesorYFecha(usuario.id, hoy);
    const fechaCreacion = usadosHoy >= limite ? sumarDias(hoy, 1) : hoy;

    const fechaEntregaDate = new Date(fechaEntregaNorm.replace(' ', 'T'));
    const fechaEventoDate = new Date(fechaEventoNorm.replace(' ', 'T'));
    const fechaCreacionDate = new Date(`${fechaCreacion}T00:00:00`);
    if (!(fechaEventoDate > fechaEntregaDate && fechaEntregaDate >= fechaCreacionDate)) {
      throw new Error('Las fechas no son válidas: el evento debe ser posterior a la entrega, y la entrega igual o posterior a la creación.');
    }

    const secuencia = (await valeRepository.contarValesPorAsesor(usuario.id)) + 1;
    const correlativo = `${localidad.codigo}-${usuario.id}-${pad4(secuencia)}`;

    const valeId = await valeRepository.crear({
      correlativo,
      asesorId: usuario.id,
      localidadId: localidad.id,
      fechaCreacion,
      horaCreacion: horaActual(),
      fechaEntrega: fechaEntregaNorm,
      fechaEvento: fechaEventoNorm,
      urgente: esVerdadero(urgente),
      clienteEmpresa,
      clienteNombre,
      clienteTelefono,
      clienteCorreo,
      productoId,
      materialId,
      tecnicaId,
      acabadoId,
      cantidad: cantidadNum,
      cotizacion: cotizacionNum,
      descripcion
    });

    await this._guardarAdjuntos(valeId, archivos, usuario.id, false);
    await registrarHistorial(valeId, usuario.id, null, ESTADOS.CREADO, 'Vale de arte creado por el asesor');
    await this._regenerarPdf(valeId);

    const vale = await valeRepository.obtenerPorId(valeId);
    valeEvents.notificarNuevoVale(vale, ['vales:encargados']);
    return enriquecer(vale);
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

  // Las imágenes solo existen como archivo mientras se incrustan en el PDF: una vez
  // generado/anexado, se eliminan del disco y de vale_documentos (solo queda la
  // descripción en texto). Los documentos PDF adjuntos de creación sí se conservan.
  async _eliminarImagenesTemporales(documentos) {
    for (const doc of documentos) {
      if (doc.tipo !== 'imagen') continue;
      await fileStorage.deleteFile(doc.ruta);
      await documentoRepository.eliminar(doc.id);
    }
  }

  async _regenerarPdf(valeId) {
    const vale = await valeRepository.obtenerPorId(valeId);
    const asesor = await usuarioValeRepository.obtenerPorId(vale.asesor_id);
    const valeConAsesor = {
      ...vale,
      __asesorNombre: asesor ? asesor.nombre : null,
      __asesorCorreo: asesor ? asesor.email : null,
      __asesorTelefono: asesor ? asesor.telefono : null
    };
    const documentos = await documentoRepository.listarPorVale(valeId);
    const pdfBuffer = await valePdfService.generarPdfVale(valeConAsesor, documentos);
    const saved = await fileStorage.saveFile(pdfBuffer, `${vale.correlativo}.pdf`, 'application/pdf');
    await valeRepository.actualizarPdfUrl(valeId, saved.path);
    await this._eliminarImagenesTemporales(documentos);
  }

  // -----------------------------------------------------------------------
  // Detalle
  // -----------------------------------------------------------------------
  async obtenerDetalle(valeId) {
    const vale = await valeRepository.obtenerPorId(valeId);
    if (!vale) throw new Error('Vale de arte no encontrado.');
    const [asignaciones, propuestas, documentos, historial] = await Promise.all([
      asignacionRepository.listarPorVale(valeId),
      propuestaRepository.listarPorVale(valeId),
      documentoRepository.listarPorVale(valeId),
      historialRepository.listarPorVale(valeId)
    ]);
    return { ...enriquecer(vale), asignaciones, propuestas, documentos, historial };
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

  async obtenerBuzon(usuario, filtros = {}) {
    const ventana = this._resolverVentana(filtros);
    const vista = filtros.vista === 'trabajo' ? 'trabajo' : 'buzon';
    const todos = (await valeRepository.listarTodos()).map(enriquecer);

    switch (usuario.rolId) {
      case 1: // Administrador: ve todo
        return this._buzonAdministrador(todos, ventana);
      case 3: // Asesor de Ventas
        return vista === 'trabajo' ? this._trabajoAsesor(usuario, todos, ventana) : this._buzonAsesor(usuario, todos, ventana);
      case 4: // Supervisor de Ventas
        return vista === 'trabajo' ? this._trabajoSupervisor(todos, ventana) : this._buzonSupervisor(todos, ventana);
      case 5:
      case 6: // Encargado de Diseño / UV-3D (buzón compartido)
        return this._buzonEncargado(usuario, todos, ventana);
      case 7: // Técnico
        return vista === 'trabajo' ? this.obtenerTrabajoTecnico(usuario, ventana) : this.obtenerBuzonTecnico(usuario, ventana);
      default:
        return { vales: [], contadores: {} };
    }
  }

  _buzonAdministrador(todos, ventana) {
    const filtrados = todos.filter(v => dentroDeVentana(v, ventana));
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado === ESTADOS.EN_REVISION,
      v => v.estado === ESTADOS.CREADO || v.estado === ESTADOS.MODIFICADO
    ]);
    return { vales, contadores: this._contadoresGenerales(todos) };
  }

  _contadoresGenerales(todos) {
    return {
      total: todos.length,
      atrasados: todos.filter(v => v.atrasado).length,
      vendidosHoy: todos.filter(v => v.estado === ESTADOS.VENDIDO && esHoy(v.actualizado_en)).length,
      canceladosHoy: todos.filter(v => v.estado === ESTADOS.CANCELADO && esHoy(v.actualizado_en)).length
    };
  }

  // ---- Asesor: sidebar Buzón (pipeline activo, sin vendidos/cancelados) ----
  _buzonAsesor(usuario, todos, ventana) {
    const propios = todos.filter(v => v.asesor_id === usuario.id).map(v => ({ ...v, estado_visible: estadoVisibleAsesor(v) }));
    const activos = propios.filter(v => !ESTADOS_TERMINALES.includes(v.estado));
    const enVentana = activos.filter(v => dentroDeVentana(v, ventana));

    const vales = ordenarPorGrupos(enVentana, [
      v => v.estado_visible === 'APROBADO',
      v => v.estado_visible === 'SOLICITANDO_MODIFICACION',
      v => v.estado_visible === 'MODIFICADO',
      v => v.estado_visible === 'CREADO'
    ]);

    const contadores = {
      valesRestantesHoy: null, // se calcula por separado en obtenerLimiteRestante()
      valesPorRevisar: activos.filter(v => v.estado_visible === 'APROBADO').length,
      valesPendientesModificacion: activos.filter(v => v.estado_visible === 'SOLICITANDO_MODIFICACION').length,
      valesAtrasados: activos.filter(v => v.atrasado).length
    };
    return { vales, contadores };
  }

  // ---- Asesor: sidebar Trabajo realizado (vendidos/cancelados, orden por fecha) ----
  _trabajoAsesor(usuario, todos, ventana) {
    const propios = todos.filter(v => v.asesor_id === usuario.id).map(v => ({ ...v, estado_visible: estadoVisibleAsesor(v) }));
    const cerrados = propios.filter(v => ESTADOS_TERMINALES.includes(v.estado));
    const enVentana = cerrados.filter(v => dentroDeVentana(v, ventana));

    const contadores = {
      totalVendidos: cerrados.filter(v => v.estado === ESTADOS.VENDIDO).length,
      totalCancelados: cerrados.filter(v => v.estado === ESTADOS.CANCELADO).length,
      vendidosHoy: cerrados.filter(v => v.estado === ESTADOS.VENDIDO && esHoy(v.actualizado_en)).length,
      canceladosHoy: cerrados.filter(v => v.estado === ESTADOS.CANCELADO && esHoy(v.actualizado_en)).length
    };
    return { vales: ordenarPorFecha(enVentana), contadores };
  }

  async obtenerLimiteRestanteAsesor(asesorId) {
    const limite = await valeRepository.obtenerLimiteDiario(asesorId);
    const usadosHoy = await valeRepository.contarValesPorAsesorYFecha(asesorId, hoyISO());
    return Math.max(0, limite - usadosHoy);
  }

  // ---- Supervisor: sidebar Buzón (solicitudes de modificación, modificados, aprobados) ----
  _buzonSupervisor(todos, ventana) {
    const visibles = todos.filter(v => [ESTADOS.CONFIRMACION_MODIFICACION, ESTADOS.MODIFICADO, ESTADOS.APROBADO].includes(v.estado));
    const enVentana = visibles.filter(v => dentroDeVentana(v, ventana));
    const vales = ordenarPorGrupos(enVentana, [
      v => v.estado === ESTADOS.CONFIRMACION_MODIFICACION,
      v => v.estado === ESTADOS.MODIFICADO,
      v => v.estado === ESTADOS.APROBADO
    ]);
    const contadores = {
      pendientesConfirmarModificacion: visibles.filter(v => v.estado === ESTADOS.CONFIRMACION_MODIFICACION).length,
      modificados: visibles.filter(v => v.estado === ESTADOS.MODIFICADO).length,
      aprobados: visibles.filter(v => v.estado === ESTADOS.APROBADO).length
    };
    return { vales, contadores };
  }

  // ---- Supervisor: sidebar Trabajo realizado (vendidos/cancelados, orden por fecha) ----
  _trabajoSupervisor(todos, ventana) {
    const cerrados = todos.filter(v => ESTADOS_TERMINALES.includes(v.estado));
    const enVentana = cerrados.filter(v => dentroDeVentana(v, ventana));
    const contadores = {
      valesConfirmadosHoy: cerrados.filter(v => v.estado === ESTADOS.VENDIDO && esHoy(v.actualizado_en)).length,
      valesCanceladosHoy: cerrados.filter(v => v.estado === ESTADOS.CANCELADO && esHoy(v.actualizado_en)).length,
      totalVendidos: cerrados.filter(v => v.estado === ESTADOS.VENDIDO).length,
      totalCancelados: cerrados.filter(v => v.estado === ESTADOS.CANCELADO).length
    };
    return { vales: ordenarPorFecha(enVentana), contadores };
  }

  _buzonEncargado(usuario, todos, ventana) {
    const visibles = todos.filter(v => [
      ESTADOS.EN_REVISION, ESTADOS.CREADO, ESTADOS.MODIFICADO, ESTADOS.EN_PROCESO, ESTADOS.ASIGNADO, ESTADOS.APROBADO
    ].includes(v.estado));
    const enVentana = visibles.filter(v => dentroDeVentana(v, ventana));

    const vales = ordenarPorGrupos(enVentana, [
      v => v.estado === ESTADOS.EN_REVISION,
      v => v.estado === ESTADOS.CREADO || v.estado === ESTADOS.MODIFICADO,
      v => v.estado === ESTADOS.EN_PROCESO,
      v => v.estado === ESTADOS.ASIGNADO,
      v => v.estado === ESTADOS.APROBADO
    ]);

    const pendientesAsignacion = todos.filter(v => v.estado === ESTADOS.CREADO || v.estado === ESTADOS.MODIFICADO);
    const asignados = todos.filter(v => v.estado === ESTADOS.ASIGNADO);
    const enProceso = todos.filter(v => v.estado === ESTADOS.EN_PROCESO);
    const enRevision = todos.filter(v => v.estado === ESTADOS.EN_REVISION);
    const aprobadosHoy = todos.filter(v => v.estado === ESTADOS.APROBADO && esHoy(v.actualizado_en));

    const contadores = {
      pendientesAsignacion: pendientesAsignacion.filter(v => !v.atrasado).length,
      pendientesAsignacionAtrasados: pendientesAsignacion.filter(v => v.atrasado).length,
      asignados: asignados.filter(v => !v.atrasado).length,
      asignadosAtrasados: asignados.filter(v => v.atrasado).length,
      enProceso: enProceso.filter(v => !v.atrasado).length,
      enProcesoAtrasados: enProceso.filter(v => v.atrasado).length,
      enRevision: enRevision.filter(v => !v.atrasado).length,
      enRevisionAtrasados: enRevision.filter(v => v.atrasado).length,
      aprobados: aprobadosHoy.filter(v => !v.atrasado).length,
      aprobadosAtrasados: aprobadosHoy.filter(v => v.atrasado).length
    };
    return { vales, contadores };
  }

  async obtenerTecnicosAsignables(usuario) {
    if (esAdministrador(usuario)) {
      return usuarioValeRepository.listarTodosLosTecnicos();
    }
    return usuarioValeRepository.listarTecnicosPorEncargado(usuario.id);
  }

  async obtenerCargaTrabajo(encargadoId) {
    const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(encargadoId);
    const resultado = [];
    for (const tecnico of tecnicos) {
      const activas = await asignacionRepository.listarActivasPorTecnico(tecnico.id);
      const valeIds = activas.map(a => a.vale_id);
      const vales = (await Promise.all(valeIds.map(id => valeRepository.obtenerPorId(id)))).filter(Boolean);
      const enProceso = vales.find(v => v.estado === ESTADOS.EN_PROCESO);
      resultado.push({
        tecnicoId: tecnico.id,
        nombre: tecnico.nombre,
        asignaciones: vales.filter(v => [ESTADOS.ASIGNADO, ESTADOS.EN_PROCESO, ESTADOS.EN_REVISION].includes(v.estado)).length,
        enProceso: enProceso ? enProceso.correlativo : null
      });
    }
    return resultado;
  }

  async obtenerAsignacionesDeTecnico(usuario, tecnicoId) {
    if (!esAdministrador(usuario)) {
      const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(usuario.id);
      if (!tecnicos.some(t => t.id === Number(tecnicoId))) {
        throw new Error('El técnico indicado no está bajo su mando.');
      }
    }
    const activas = await asignacionRepository.listarActivasPorTecnico(tecnicoId);
    const vales = await Promise.all(activas.map(a => valeRepository.obtenerPorId(a.vale_id)));
    // Refleja únicamente el trabajo vigente (mismo criterio que el resumen de carga de trabajo);
    // una asignación permanece "activa" en BD aunque el vale ya haya cerrado como VENDIDO.
    return vales
      .filter(Boolean)
      .filter(v => [ESTADOS.ASIGNADO, ESTADOS.EN_PROCESO, ESTADOS.EN_REVISION].includes(v.estado))
      .map(enriquecer);
  }

  // ---- Técnico: sidebar Buzón (asignaciones activas, sin aprobados/desaprobados) ----
  async obtenerBuzonTecnico(usuario, ventana) {
    const activas = await asignacionRepository.listarActivasPorTecnico(usuario.id);
    const valeIds = [...new Set(activas.map(a => a.vale_id))];
    const vales = (await Promise.all(valeIds.map(id => valeRepository.obtenerPorId(id))))
      .filter(Boolean)
      .filter(v => [ESTADOS.ASIGNADO, ESTADOS.EN_PROCESO, ESTADOS.EN_REVISION].includes(v.estado))
      .map(enriquecer)
      .filter(v => dentroDeVentana(v, ventana));

    const listaOrdenada = ordenarPorGrupos(vales, [
      v => v.estado === ESTADOS.EN_PROCESO,
      v => v.estado === ESTADOS.ASIGNADO,
      v => v.estado === ESTADOS.EN_REVISION
    ]);

    const contadores = {
      asignados: vales.filter(v => v.estado === ESTADOS.ASIGNADO && !v.atrasado).length,
      asignadosAtrasados: vales.filter(v => v.estado === ESTADOS.ASIGNADO && v.atrasado).length,
      modificacionPendiente: vales.filter(v => v.correlativo.startsWith('MOD-') && !v.atrasado).length,
      modificacionPendienteAtrasados: vales.filter(v => v.correlativo.startsWith('MOD-') && v.atrasado).length,
      enProceso: vales.find(v => v.estado === ESTADOS.EN_PROCESO)?.correlativo || null
    };

    return { vales: listaOrdenada, contadores };
  }

  // ---- Técnico: sidebar Trabajo realizado (aprobados, orden por fecha) ----
  async obtenerTrabajoTecnico(usuario, ventana) {
    const activas = await asignacionRepository.listarActivasPorTecnico(usuario.id);
    const valeIds = [...new Set(activas.map(a => a.vale_id))];
    const vales = (await Promise.all(valeIds.map(id => valeRepository.obtenerPorId(id))))
      .filter(Boolean)
      .filter(v => v.estado === ESTADOS.APROBADO)
      .map(enriquecer)
      .filter(v => dentroDeVentana(v, ventana));

    const contadores = {
      totalAprobados: vales.length,
      aprobadosHoy: vales.filter(v => esHoy(v.actualizado_en)).length
    };
    return { vales: ordenarPorFecha(vales), contadores };
  }

  // -----------------------------------------------------------------------
  // Transiciones de estado (cada una protegida por un lock por-vale para idempotencia)
  // -----------------------------------------------------------------------
  async asignar(usuario, valeId, tecnicoId) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      if (![ESTADOS.CREADO, ESTADOS.MODIFICADO].includes(vale.estado)) {
        throw new Error('Solo se pueden asignar vales en estado CREADO o MODIFICADO.');
      }
      const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(usuario.id);
      if (!esAdministrador(usuario) && !tecnicos.some(t => t.id === Number(tecnicoId))) {
        throw new Error('El técnico indicado no está bajo su mando.');
      }
      await asignacionRepository.crear(valeId, tecnicoId, usuario.id, `${hoyISO()} ${horaActual()}`);
      await valeRepository.actualizarEstado(valeId, ESTADOS.ASIGNADO);
      const tecnico = await usuarioValeRepository.obtenerPorId(tecnicoId);
      await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.ASIGNADO, `Asignado al técnico ${tecnico ? tecnico.nombre : tecnicoId}`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['tecnico:' + tecnicoId]);
      return enriquecer(actualizado);
    });
  }

  async comenzar(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      await this._assertTecnicoAsignado(usuario, vale);
      if (vale.estado !== ESTADOS.ASIGNADO) {
        throw new Error('El vale debe estar ASIGNADO para poder comenzarlo.');
      }
      const activasEnProceso = (await asignacionRepository.listarActivasPorTecnico(usuario.id));
      for (const a of activasEnProceso) {
        const v = await valeRepository.obtenerPorId(a.vale_id);
        if (v && v.estado === ESTADOS.EN_PROCESO) {
          throw new Error(`Ya tienes un vale en proceso (${v.correlativo}). Debes entregarlo o cancelarlo antes de comenzar otro.`);
        }
      }
      await valeRepository.actualizarEstado(valeId, ESTADOS.EN_PROCESO);
      await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.EN_PROCESO, 'Técnico marcó el vale como en proceso');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      const asignacionActiva = await asignacionRepository.obtenerActivaPorVale(valeId);
      valeEvents.notificarCambioEstado(actualizado, asignacionActiva ? [`encargado:${asignacionActiva.encargado_id}`] : []);
      return enriquecer(actualizado);
    });
  }

  async entregar(usuario, valeId, archivoPropuesta) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      await this._assertTecnicoAsignado(usuario, vale);
      if (vale.estado !== ESTADOS.EN_PROCESO) {
        throw new Error('El vale debe estar EN_PROCESO para poder entregar la propuesta.');
      }
      let url = null;
      if (archivoPropuesta) {
        const saved = await fileStorage.saveFile(archivoPropuesta.buffer, archivoPropuesta.originalname, archivoPropuesta.mimetype);
        url = saved.path;
      }
      await propuestaRepository.crear(valeId, usuario.id, url, false, `${hoyISO()} ${horaActual()}`);
      await valeRepository.actualizarEstado(valeId, ESTADOS.EN_REVISION);
      await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.EN_REVISION, 'Técnico entregó propuesta');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['vales:encargados']);
      return enriquecer(actualizado);
    });
  }

  async cancelarProcesoTecnico(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      await this._assertTecnicoAsignado(usuario, vale);
      if (vale.estado !== ESTADOS.EN_PROCESO) {
        throw new Error('Solo se puede cancelar un vale que esté EN_PROCESO.');
      }
      await propuestaRepository.crear(valeId, usuario.id, null, true, `${hoyISO()} ${horaActual()}`);
      await valeRepository.actualizarEstado(valeId, ESTADOS.EN_REVISION);
      await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.EN_REVISION, 'Técnico canceló el proceso (propuesta en blanco)');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['vales:encargados']);
      return enriquecer(actualizado);
    });
  }

  async revisarPropuesta(usuario, valeId, { aprobar, tecnicoReasignadoId }) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      if (vale.estado !== ESTADOS.EN_REVISION) {
        throw new Error('Solo se pueden revisar vales en estado EN_REVISION.');
      }
      if (aprobar) {
        const ultimaPropuesta = await propuestaRepository.obtenerUltimaPorVale(valeId);
        if (!ultimaPropuesta || ultimaPropuesta.es_cancelacion || !ultimaPropuesta.url) {
          throw new Error('No se puede aprobar una propuesta en blanco: el técnico debe adjuntar el documento de propuesta.');
        }
        await valeRepository.actualizarEstado(valeId, ESTADOS.APROBADO);
        await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.APROBADO, 'Encargado aprobó la propuesta');
        const actualizado = await valeRepository.obtenerPorId(valeId);
        valeEvents.notificarCambioEstado(actualizado, [`asesor:${vale.asesor_id}`]);
        return enriquecer(actualizado);
      }

      if (!tecnicoReasignadoId) {
        throw new Error('Debe indicar a qué técnico reasignar el vale desaprobado.');
      }
      const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(usuario.id);
      if (!esAdministrador(usuario) && !tecnicos.some(t => t.id === Number(tecnicoReasignadoId))) {
        throw new Error('El técnico indicado no está bajo su mando.');
      }
      await asignacionRepository.desactivarPorVale(valeId);
      await asignacionRepository.crear(valeId, tecnicoReasignadoId, usuario.id, `${hoyISO()} ${horaActual()}`);
      await valeRepository.actualizarEstado(valeId, ESTADOS.ASIGNADO);
      const tecnico = await usuarioValeRepository.obtenerPorId(tecnicoReasignadoId);
      await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.ASIGNADO, `Encargado desaprobó la propuesta y reasignó a ${tecnico ? tecnico.nombre : tecnicoReasignadoId}`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, [`tecnico:${tecnicoReasignadoId}`]);
      return enriquecer(actualizado);
    });
  }

  async confirmarVenta(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      this._assertPropioDelAsesor(usuario, vale);
      if (vale.estado !== ESTADOS.APROBADO) {
        throw new Error('Solo se puede confirmar la venta de un vale APROBADO.');
      }
      await valeRepository.actualizarEstado(valeId, ESTADOS.VENDIDO);
      await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.VENDIDO, 'Asesor confirmó la venta');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['vales:supervisores']);
      return enriquecer(actualizado);
    });
  }

  async cancelarVale(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      this._assertPropioDelAsesor(usuario, vale);
      if (ESTADOS_TERMINALES.includes(vale.estado)) {
        throw new Error('El vale ya se encuentra cerrado.');
      }
      await valeRepository.actualizarEstado(valeId, ESTADOS.CANCELADO);
      await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.CANCELADO, 'Asesor canceló el vale de arte');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['vales:supervisores']);
      return enriquecer(actualizado);
    });
  }

  async solicitarModificacion(usuario, valeId, { justificacion, descripcion }, archivos) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      this._assertPropioDelAsesor(usuario, vale);
      if (vale.estado !== ESTADOS.APROBADO) {
        throw new Error('Solo se puede solicitar modificación sobre un vale APROBADO.');
      }
      if (vale.modificado) {
        throw new Error('Este vale de arte ya utilizó su única modificación permitida.');
      }
      if (!justificacion) {
        throw new Error('Debe justificar la modificación solicitada.');
      }
      if (archivos && archivos.documentos && archivos.documentos.length > 0) {
        throw new Error('El formulario de modificación no admite documentos adjuntos, solo imágenes.');
      }

      const correlativoNuevo = vale.correlativo.startsWith('MOD-') ? vale.correlativo : `MOD-${vale.correlativo}`;
      await valeRepository.registrarSolicitudModificacion(valeId, {
        descripcionOriginal: vale.descripcion,
        descripcionNueva: descripcion || vale.descripcion,
        correlativoNuevo,
        justificacion
      });
      await this._guardarAdjuntos(valeId, { imagenes: archivos ? archivos.imagenes : [] }, usuario.id, true);
      await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.CONFIRMACION_MODIFICACION, 'Asesor solicitó modificación');

      const valeActualizado = await valeRepository.obtenerPorId(valeId);
      const imagenesNuevas = (await documentoRepository.listarPorVale(valeId)).filter(d => d.tipo === 'imagen' && d.es_modificacion);
      await this._anexarModificacionAlPdf(valeActualizado, imagenesNuevas);

      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['vales:supervisores']);
      return enriquecer(actualizado);
    });
  }

  async _anexarModificacionAlPdf(vale, imagenesNuevas) {
    if (!vale.pdf_url) {
      // No debería ocurrir (todo vale creado genera su PDF), pero si falta, se genera desde cero.
      await this._regenerarPdf(vale.id);
      return;
    }
    const pdfBuffer = await valePdfService.anexarModificacion(vale, imagenesNuevas);
    const oldPdfUrl = vale.pdf_url;
    const saved = await fileStorage.saveFile(pdfBuffer, `${vale.correlativo}.pdf`, 'application/pdf');
    await valeRepository.actualizarPdfUrl(vale.id, saved.path);
    await fileStorage.deleteFile(oldPdfUrl);
    await this._eliminarImagenesTemporales(imagenesNuevas);
  }

  async aprobarModificacion(usuario, valeId) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      if (vale.estado !== ESTADOS.CONFIRMACION_MODIFICACION) {
        throw new Error('Solo se pueden aprobar vales en estado CONFIRMACION_MODIFICACION.');
      }
      await valeRepository.actualizarEstado(valeId, ESTADOS.MODIFICADO);
      await registrarHistorial(valeId, usuario.id, vale.estado, ESTADOS.MODIFICADO, 'Supervisor autorizó la modificación');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['vales:encargados']);
      return enriquecer(actualizado);
    });
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

  async _assertTecnicoAsignado(usuario, vale) {
    if (esAdministrador(usuario)) return;
    const activas = await asignacionRepository.listarActivasPorTecnico(usuario.id);
    if (!activas.some(a => a.vale_id === vale.id)) {
      throw new Error('Este vale de arte no está asignado a este técnico.');
    }
  }
}

module.exports = new ValeService();
module.exports.ESTADOS = ESTADOS;
