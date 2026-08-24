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
// RECHAZADO ya no es un estado persistido (analisis_correcciones_4.md #3): es una
// ACCIÓN que lleva el vale a EN_CORRECCION (buzón del Encargado General) — el rechazo
// en sí solo queda registrado en el historial, nunca como `vale.estado` vigente.
const ESTADOS = {
  CREADO: 'CREADO',
  APROBADO_DEPARTAMENTO: 'APROBADO_DEPARTAMENTO',
  PENDIENTE_CONFIRMACION: 'PENDIENTE_CONFIRMACION',
  RECIBIDO: 'RECIBIDO',
  EN_CORRECCION: 'EN_CORRECCION',
  SOLICITANDO_MODIFICACION: 'SOLICITANDO_MODIFICACION',
  MODIFICADO: 'MODIFICADO'
};
const ESTADOS_TERMINALES = [ESTADOS.RECIBIDO];
// El asesor no debe "perder" un vale de la vista de trabajo realizado solo porque
// solicitó una modificación sobre él (analisis_correcciones_4.md #13): el vale ya fue
// confirmado y ese hecho se conserva mientras la solicitud está en curso — la tabla de
// auditoría (vale_historial) nunca se toca, pero además la UI no debe "esconder" el
// registro de confirmación mientras tanto.
const ESTADOS_CONFIRMADOS = [ESTADOS.RECIBIDO, ESTADOS.SOLICITANDO_MODIFICACION];

// Estado de un vale DENTRO de un taller específico (tabla vale_talleres).
const ESTADOS_TALLER = {
  PENDIENTE_ASIGNACION: 'PENDIENTE_ASIGNACION',
  ASIGNADO: 'ASIGNADO',
  EN_PROCESO: 'EN_PROCESO',
  EN_REVISION: 'EN_REVISION',
  APROBADO: 'APROBADO'
};

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
 * Para vales cerrados (RECIBIDO) se congela al momento del cierre
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
// analisis_correcciones_3.md #11). Nunca se usa para autorización, solo para lo
// que el asesor ve/filtra/ordena. Un vale de modificación (MODIFICADO o con
// vale_original_id) usa un juego de 5 estados en vez de los 4 normales.
function esValeDeModificacion(vale) {
  return vale.estado === ESTADOS.MODIFICADO || !!vale.vale_original_id;
}

function estadoVisibleAsesor(vale) {
  if (esValeDeModificacion(vale)) {
    switch (vale.estado) {
      case ESTADOS.MODIFICADO: return 'MODIFICADO';
      case ESTADOS.PENDIENTE_CONFIRMACION: return 'PENDIENTE_CONFIRMACION';
      case ESTADOS.RECIBIDO: return 'CONFIRMADO';
      case ESTADOS.EN_CORRECCION: return 'EN_CORRECCION';
      default: return 'MODIFICADO'; // CREADO / APROBADO_DEPARTAMENTO de un vale MOD-
    }
  }
  switch (vale.estado) {
    case ESTADOS.SOLICITANDO_MODIFICACION: return 'SOLICITANDO_MODIFICACION';
    case ESTADOS.PENDIENTE_CONFIRMACION: return 'PENDIENTE_CONFIRMACION';
    case ESTADOS.RECIBIDO: return 'CONFIRMADO';
    case ESTADOS.EN_CORRECCION: return 'EN_CORRECCION';
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
async function registrarHistorial(valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion) {
  await historialRepository.registrar(valeId, usuarioId, tallerId, estadoAnterior, estadoNuevo, accion);
}

function esAdministrador(usuario) {
  return usuario.rolId === 1;
}

// Roles 8 (Encargado General) y 9 (Asistente Encargado General): fusionan y
// aprueban vales enviados a más de un taller. No son dueños de un taller propio.
function esEncargadoGeneral(usuario) {
  return usuario.rolId === 8 || usuario.rolId === 9;
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
    const [localidades, productos, materiales, paises, talleres] = await Promise.all([
      catalogoRepository.listarLocalidades(),
      catalogoRepository.listarProductos(),
      catalogoRepository.listarMateriales(),
      catalogoRepository.listarPaises(),
      tallerRepository.listarActivos()
    ]);
    // tecnicas/acabados ya no son catálogo (corrección #1: ahora son textbox libre).
    return { localidades, productos, materiales, paises, talleres };
  }

  async obtenerTalleres() {
    return tallerRepository.listarActivos();
  }

  // -----------------------------------------------------------------------
  // Creación
  // -----------------------------------------------------------------------
  async crearVale(usuario, payload, archivos) {
    const datos = await this._validarDatosVale(payload);
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

    const fechaCreacionDate = new Date(`${fechaCreacion}T00:00:00`);
    if (!(datos.fechaEventoDate > datos.fechaEntregaDate && datos.fechaEntregaDate >= fechaCreacionDate)) {
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
      estado: ESTADOS.CREADO
    });

    await this._fanOutTalleres(valeId, datos.talleresIds);
    await this._guardarAdjuntos(valeId, archivos, usuario.id, false);
    if (archivos && archivos.documentos && archivos.documentos.length > 0) {
      await valeRepository.actualizarTieneAdjuntos(valeId, true);
    }
    const nombresTalleres = await this._nombresDeTalleres(datos.talleresIds);
    await registrarHistorial(valeId, usuario.id, null, null, ESTADOS.CREADO, `Vale de arte creado por el asesor (taller${datos.talleresIds.length > 1 ? 'es' : ''}: ${nombresTalleres})`);
    await this._regenerarPdf(valeId);

    const vale = await valeRepository.obtenerPorId(valeId);
    valeEvents.notificarNuevoVale(vale, datos.talleresIds.map(id => `taller:${id}`));
    return enriquecer(vale);
  }

  // Validaciones compartidas entre crearVale() y solicitarModificacion() (el
  // formulario de modificación es literalmente el mismo formulario de creación).
  async _validarDatosVale(payload) {
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
    if (!tecnica || !tecnica.trim()) {
      throw new Error('La técnica es obligatoria.');
    }
    if (!acabado || !acabado.trim()) {
      throw new Error('El acabado es obligatorio.');
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

    let talleresIds;
    try {
      talleresIds = Array.isArray(payload.talleresIds) ? payload.talleresIds : JSON.parse(payload.talleresIds || '[]');
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

    return {
      clienteEmpresa, clienteNombre, clienteTelefono, clienteCorreo,
      fechaEntregaNorm, fechaEventoNorm,
      fechaEntregaDate: new Date(fechaEntregaNorm.replace(' ', 'T')),
      fechaEventoDate: new Date(fechaEventoNorm.replace(' ', 'T')),
      urgente: calcularUrgente(fechaEntregaNorm, urgente),
      productoId: productoId ? Number(productoId) : null,
      materialId: materialId ? Number(materialId) : null,
      tecnica: tecnica.trim(), acabado: acabado.trim(),
      cantidad: cantidadNum, cotizacion: cotizacionNum, descripcion,
      talleresIds
    };
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

  async _regenerarPdf(valeId, propuestasParaFusionar) {
    const vale = await valeRepository.obtenerPorId(valeId);
    const asesor = await usuarioValeRepository.obtenerPorId(vale.asesor_id);
    const valeConAsesor = {
      ...vale,
      __asesorNombre: asesor ? asesor.nombre : null,
      __asesorCorreo: asesor ? asesor.email : null,
      __asesorTelefono: asesor ? asesor.telefono : null
    };
    // Las imágenes se conservan (no se eliminan tras generar el PDF): una modificación
    // posterior necesita poder regenerar el documento completo desde cero.
    const documentos = await documentoRepository.listarPorVale(valeId);
    const pdfBuffer = await valePdfService.generarPdfVale(valeConAsesor, documentos, propuestasParaFusionar || []);
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
    const [talleres, propuestas, documentos, historial] = await Promise.all([
      valeTallerRepository.listarPorVale(valeId),
      propuestaRepository.listarPorVale(valeId),
      documentoRepository.listarPorVale(valeId),
      historialRepository.listarPorVale(valeId)
    ]);
    const talleresConNombre = await this._enriquecerTalleresConNombre(talleres);
    const historialConActor = await this._enriquecerHistorialConActor(historial);
    const historialVisible = await this._filtrarHistorialPorRol(usuario, historialConActor);
    return { ...enriquecer(vale), talleres: talleresConNombre, propuestas, documentos, historial: historialVisible };
  }

  // El asesor solo ve sus 4/5 estados lógicos, nunca el detalle interno de cada taller
  // (analisis_correcciones_4.md #4); un encargado o técnico solo ve lo que pasó DENTRO
  // de su propio taller, no lo que hicieron otros talleres del mismo vale (#12).
  // Administrador, Supervisor y Encargado General siguen viendo todo.
  async _filtrarHistorialPorRol(usuario, historial) {
    if (!usuario) return historial;
    if (usuario.rolId === 3) {
      return historial.filter(h => !ESTADOS_TALLER[h.estado_nuevo]);
    }
    if ([5, 6, 7].includes(usuario.rolId)) {
      const tallerVisible = await this._tallerIdVisiblePara(usuario);
      if (!tallerVisible) return [];
      return historial.filter(h => h.taller_id === null || h.taller_id === tallerVisible);
    }
    return historial;
  }

  async _tallerIdVisiblePara(usuario) {
    const talleres = await tallerRepository.listarActivos();
    if (usuario.rolId === 5 || usuario.rolId === 6) {
      const propio = talleres.find(t => t.encargado_id === usuario.id);
      return propio ? propio.id : null;
    }
    if (usuario.rolId === 7) {
      const tecnico = await usuarioValeRepository.obtenerPorId(usuario.id);
      const propio = tecnico && tecnico.encargado_id ? talleres.find(t => t.encargado_id === tecnico.encargado_id) : null;
      return propio ? propio.id : null;
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

  // El historial solo guarda usuario_id; aquí se resuelve a un nombre corto (nombre +
  // primer apellido) para mostrar quién hizo la acción, no solo su rol/qué pasó.
  async _enriquecerHistorialConActor(historial) {
    const idsUnicos = [...new Set(historial.map(h => h.usuario_id))];
    const usuarios = await Promise.all(idsUnicos.map(id => usuarioValeRepository.obtenerPorId(id)));
    const mapaNombres = new Map(idsUnicos.map((id, idx) => {
      const nombreCompleto = usuarios[idx] ? usuarios[idx].nombre : null;
      const nombreCorto = nombreCompleto ? nombreCompleto.split(' ').slice(0, 2).join(' ') : null;
      return [id, nombreCorto];
    }));
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

  async obtenerBuzon(usuario, filtros = {}) {
    const ventana = this._resolverVentana(filtros);
    const vista = filtros.vista === 'trabajo' ? 'trabajo' : 'buzon';
    const filtroContador = filtros.filtroContador || null;
    const todos = (await valeRepository.listarTodos()).map(enriquecer);
    const talleresTodos = await tallerRepository.listarActivos();
    const valeTalleresTodos = await valeTallerRepository.listarTodos();

    // Todos los roles con vista de taller necesitan el nombre de los talleres de
    // cada vale (columna "Taller" del asesor, corrección #7); se adjunta una vez.
    const mapaTalleresPorVale = new Map();
    valeTalleresTodos.forEach(vt => {
      const lista = mapaTalleresPorVale.get(vt.vale_id) || [];
      lista.push(vt);
      mapaTalleresPorVale.set(vt.vale_id, lista);
    });
    const nombreTaller = (id) => (talleresTodos.find(t => t.id === id) || {}).nombre || `#${id}`;
    const todosConTaller = todos.map(v => {
      const filas = mapaTalleresPorVale.get(v.id) || [];
      return { ...v, taller: filas.map(f => nombreTaller(f.taller_id)).join(', '), _filasTaller: filas };
    });

    let resultado;
    switch (usuario.rolId) {
      case 1: // Administrador: ve todo
        resultado = this._buzonAdministrador(todosConTaller, ventana, filtroContador);
        break;
      case 3: // Asesor de Ventas
        resultado = vista === 'trabajo'
          ? this._trabajoAsesor(usuario, todosConTaller, ventana, filtroContador)
          : this._buzonAsesor(usuario, todosConTaller, ventana, filtroContador);
        break;
      case 4: // Supervisor de Ventas
        resultado = vista === 'trabajo'
          ? this._trabajoSupervisor(todosConTaller, ventana, filtroContador)
          : this._buzonSupervisor(todosConTaller, ventana, filtroContador);
        break;
      case 5:
      case 6: // Encargado de un taller — buzón individual, scoped a su propio taller
        resultado = this._buzonEncargado(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador);
        break;
      case 8:
      case 9: // Encargado General / Asistente — vales multi-taller listos para fusión
        resultado = this._buzonEncargadoGeneral(todosConTaller, ventana, filtroContador);
        break;
      case 7: // Técnico
        resultado = vista === 'trabajo'
          ? await this.obtenerTrabajoTecnico(usuario, ventana, filtroContador)
          : await this.obtenerBuzonTecnico(usuario, ventana, filtroContador);
        break;
      default:
        resultado = { vales: [], contadores: {} };
    }

    // Paginación: la jerarquía general/individual ya se aplicó por completo antes de
    // este punto (cada método de buzón ordena la lista entera); aquí solo se recorta
    // una página de 50 sin alterar ese orden (ver analisis_correcciones_2.md #9).
    const limit = 50;
    const offset = Math.max(0, Number(filtros.offset) || 0);
    const total = resultado.vales.length;
    const pagina = resultado.vales.slice(offset, offset + limit);
    return { vales: pagina, contadores: resultado.contadores, total, hasMore: offset + limit < total };
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
      v => v.estado === ESTADOS.CREADO || v.estado === ESTADOS.EN_CORRECCION || v.estado === ESTADOS.MODIFICADO
    ]);
    return { vales, contadores: this._contadoresGenerales(enVentana) };
  }

  _contadoresGenerales(vales) {
    return {
      total: vales.length,
      atrasados: vales.filter(v => v.atrasado).length,
      recibidosHoy: vales.filter(v => v.estado === ESTADOS.RECIBIDO && esHoy(v.actualizado_en)).length,
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
      valesRestantesHoy: null, // se calcula por separado en obtenerLimiteRestanteAsesor()
      valesPorRevisar: enVentana.filter(v => v.estado_visible === 'PENDIENTE_CONFIRMACION').length,
      valesPendientesModificacion: enVentana.filter(v => v.estado_visible === 'SOLICITANDO_MODIFICACION').length,
      valesAtrasados: enVentana.filter(v => v.atrasado).length
    };
    const predicados = {
      valesPorRevisar: v => v.estado_visible === 'PENDIENTE_CONFIRMACION',
      valesPendientesModificacion: v => v.estado_visible === 'SOLICITANDO_MODIFICACION',
      valesAtrasados: v => v.atrasado
    };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, predicados);
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado_visible === 'PENDIENTE_CONFIRMACION',
      v => v.estado_visible === 'SOLICITANDO_MODIFICACION',
      v => v.estado_visible === 'MODIFICADO',
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

  async obtenerLimiteRestanteAsesor(asesorId) {
    const limite = await valeRepository.obtenerLimiteDiario(asesorId);
    const usadosHoy = await valeRepository.contarValesPorAsesorYFecha(asesorId, hoyISO());
    return Math.max(0, limite - usadosHoy);
  }

  // ---- Supervisor: sidebar Buzón (modificaciones, correcciones, pendientes de confirmación) ----
  _buzonSupervisor(todos, ventana, filtroContador) {
    const visibles = todos.filter(v => [
      ESTADOS.SOLICITANDO_MODIFICACION, ESTADOS.MODIFICADO, ESTADOS.EN_CORRECCION, ESTADOS.PENDIENTE_CONFIRMACION
    ].includes(v.estado));
    const enVentana = visibles.filter(v => dentroDeVentana(v, ventana));
    const contadores = {
      pendientesConfirmarModificacion: enVentana.filter(v => v.estado === ESTADOS.SOLICITANDO_MODIFICACION).length,
      modificados: enVentana.filter(v => v.estado === ESTADOS.MODIFICADO).length,
      enCorreccion: enVentana.filter(v => v.estado === ESTADOS.EN_CORRECCION).length,
      pendientesConfirmacion: enVentana.filter(v => v.estado === ESTADOS.PENDIENTE_CONFIRMACION).length
    };
    const predicados = {
      pendientesConfirmarModificacion: v => v.estado === ESTADOS.SOLICITANDO_MODIFICACION,
      modificados: v => v.estado === ESTADOS.MODIFICADO,
      enCorreccion: v => v.estado === ESTADOS.EN_CORRECCION,
      pendientesConfirmacion: v => v.estado === ESTADOS.PENDIENTE_CONFIRMACION
    };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, predicados);
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado === ESTADOS.SOLICITANDO_MODIFICACION,
      v => v.estado === ESTADOS.EN_CORRECCION,
      v => v.estado === ESTADOS.MODIFICADO,
      v => v.estado === ESTADOS.PENDIENTE_CONFIRMACION
    ]);
    return { vales, contadores };
  }

  // ---- Supervisor: sidebar Trabajo realizado (recibidos, orden por fecha) ----
  // Mismo criterio que _trabajoAsesor: una modificación en curso no saca al vale de
  // esta vista (analisis_correcciones_4.md #13).
  _trabajoSupervisor(todos, ventana, filtroContador) {
    const cerrados = todos.filter(v => ESTADOS_CONFIRMADOS.includes(v.estado));
    const enVentana = cerrados.filter(v => dentroDeVentana(v, ventana));
    const contadores = {
      valesRecibidosHoy: enVentana.filter(v => esHoy(v.actualizado_en)).length,
      totalRecibidos: enVentana.length
    };
    const predicados = {
      valesRecibidosHoy: v => esHoy(v.actualizado_en),
      totalRecibidos: () => true
    };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, predicados);
    return { vales: ordenarPorFecha(filtrados), contadores };
  }

  // ---- Encargado General / Asistente: vales multi-taller listos para fusión, más
  // los que el asesor rechazó (EN_CORRECCION cae aquí, no de vuelta a los talleres) ----
  _buzonEncargadoGeneral(todos, ventana, filtroContador) {
    const visibles = todos.filter(v => [ESTADOS.APROBADO_DEPARTAMENTO, ESTADOS.EN_CORRECCION].includes(v.estado));
    const enVentana = visibles.filter(v => dentroDeVentana(v, ventana));
    const contadores = { pendientesFusion: enVentana.length, atrasados: enVentana.filter(v => v.atrasado).length };
    const predicados = { atrasados: v => v.atrasado };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, predicados);
    return { vales: ordenarPorGrupos(filtrados, [v => v.atrasado]), contadores };
  }

  // ---- Encargado de un taller: buzón INDIVIDUAL, scoped a las filas de su propio taller ----
  _buzonEncargado(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador) {
    const miTaller = esAdministrador(usuario) ? null : talleresTodos.find(t => t.encargado_id === usuario.id);
    if (!esAdministrador(usuario) && !miTaller) {
      return { vales: [], contadores: this._contadoresVaciosEncargado() };
    }
    const misFilas = esAdministrador(usuario) ? valeTalleresTodos : valeTalleresTodos.filter(f => f.taller_id === miTaller.id);
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
    const enRevision = enVentana.filter(v => v.estado_taller === ESTADOS_TALLER.EN_REVISION);
    const aprobadosHoy = enVentana.filter(v => v.estado_taller === ESTADOS_TALLER.APROBADO && esHoy(v.actualizado_en));

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
    const predicados = {
      pendientesAsignacion: v => v.estado_taller === ESTADOS_TALLER.PENDIENTE_ASIGNACION && !v.atrasado,
      pendientesAsignacionAtrasados: v => v.estado_taller === ESTADOS_TALLER.PENDIENTE_ASIGNACION && v.atrasado,
      asignados: v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && !v.atrasado,
      asignadosAtrasados: v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && v.atrasado,
      enProceso: v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO && !v.atrasado,
      enProcesoAtrasados: v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO && v.atrasado,
      enRevision: v => v.estado_taller === ESTADOS_TALLER.EN_REVISION && !v.atrasado,
      enRevisionAtrasados: v => v.estado_taller === ESTADOS_TALLER.EN_REVISION && v.atrasado,
      aprobados: v => v.estado_taller === ESTADOS_TALLER.APROBADO && esHoy(v.actualizado_en) && !v.atrasado,
      aprobadosAtrasados: v => v.estado_taller === ESTADOS_TALLER.APROBADO && esHoy(v.actualizado_en) && v.atrasado
    };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, predicados);
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado_taller === ESTADOS_TALLER.EN_REVISION,
      v => v.estado_taller === ESTADOS_TALLER.PENDIENTE_ASIGNACION,
      v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO,
      v => v.estado_taller === ESTADOS_TALLER.ASIGNADO,
      v => v.estado_taller === ESTADOS_TALLER.APROBADO
    ]);
    return { vales, contadores };
  }

  _contadoresVaciosEncargado() {
    return {
      pendientesAsignacion: 0, pendientesAsignacionAtrasados: 0, asignados: 0, asignadosAtrasados: 0,
      enProceso: 0, enProcesoAtrasados: 0, enRevision: 0, enRevisionAtrasados: 0, aprobados: 0, aprobadosAtrasados: 0
    };
  }

  _tallerDelUsuario(usuario, talleresTodos) {
    return talleresTodos.find(t => t.encargado_id === usuario.id) || null;
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
      const activas = await valeTallerRepository.listarActivasPorTecnico(tecnico.id);
      const vales = (await Promise.all(activas.map(a => valeRepository.obtenerPorId(a.vale_id)))).filter(Boolean);
      const filaEnProceso = activas.find(a => a.estado === ESTADOS_TALLER.EN_PROCESO);
      const valeEnProceso = filaEnProceso ? vales.find(v => v.id === filaEnProceso.vale_id) : null;
      resultado.push({
        tecnicoId: tecnico.id,
        nombre: tecnico.nombre,
        asignaciones: activas.filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION].includes(a.estado)).length,
        enProceso: valeEnProceso ? valeEnProceso.correlativo : null
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
    const activas = await valeTallerRepository.listarActivasPorTecnico(tecnicoId);
    const activasVigentes = activas.filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION].includes(a.estado));
    const vales = await Promise.all(activasVigentes.map(async a => {
      const vale = await valeRepository.obtenerPorId(a.vale_id);
      return vale ? { ...enriquecer(vale), estado_taller: a.estado } : null;
    }));
    return vales.filter(Boolean);
  }

  // ---- Técnico: sidebar Buzón (asignaciones activas, sin aprobados/desaprobados) ----
  async obtenerBuzonTecnico(usuario, ventana, filtroContador) {
    const activas = (await valeTallerRepository.listarActivasPorTecnico(usuario.id))
      .filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION].includes(a.estado));
    const vales = (await Promise.all(activas.map(async a => {
      const vale = await valeRepository.obtenerPorId(a.vale_id);
      return vale ? { ...enriquecer(vale), estado_taller: a.estado } : null;
    })))
      .filter(Boolean)
      .filter(v => dentroDeVentana(v, ventana));

    const contadores = {
      asignados: vales.filter(v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && !v.atrasado).length,
      asignadosAtrasados: vales.filter(v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && v.atrasado).length,
      modificacionPendiente: vales.filter(v => v.correlativo.startsWith('MOD-') && !v.atrasado).length,
      modificacionPendienteAtrasados: vales.filter(v => v.correlativo.startsWith('MOD-') && v.atrasado).length,
      enProceso: vales.find(v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO)?.correlativo || null
    };
    const predicados = {
      asignados: v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && !v.atrasado,
      asignadosAtrasados: v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && v.atrasado,
      modificacionPendiente: v => v.correlativo.startsWith('MOD-') && !v.atrasado,
      modificacionPendienteAtrasados: v => v.correlativo.startsWith('MOD-') && v.atrasado
    };
    const filtrados = this._aplicarFiltroContador(vales, filtroContador, predicados);
    const listaOrdenada = ordenarPorGrupos(filtrados, [
      v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO,
      v => v.estado_taller === ESTADOS_TALLER.ASIGNADO,
      v => v.estado_taller === ESTADOS_TALLER.EN_REVISION
    ]);
    return { vales: listaOrdenada, contadores };
  }

  // ---- Técnico: sidebar Trabajo realizado (aprobados por su taller, orden por fecha) ----
  async obtenerTrabajoTecnico(usuario, ventana, filtroContador) {
    const activas = (await valeTallerRepository.listarActivasPorTecnico(usuario.id))
      .filter(a => a.estado === ESTADOS_TALLER.APROBADO);
    const vales = (await Promise.all(activas.map(a => valeRepository.obtenerPorId(a.vale_id))))
      .filter(Boolean)
      .map(enriquecer)
      .filter(v => dentroDeVentana(v, ventana));

    const contadores = {
      totalAprobados: vales.length,
      aprobadosHoy: vales.filter(v => esHoy(v.actualizado_en)).length
    };
    const predicados = { aprobadosHoy: v => esHoy(v.actualizado_en) };
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
    const miTaller = talleres.find(t => t.encargado_id === usuario.id);
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
      const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(usuario.id);
      if (!esAdministrador(usuario) && !tecnicos.some(t => t.id === Number(tecnicoId))) {
        throw new Error('El técnico indicado no está bajo su mando.');
      }
      await valeTallerRepository.asignar(fila.id, tecnicoId, `${hoyISO()} ${horaActual()}`);
      const tecnico = await usuarioValeRepository.obtenerPorId(tecnicoId);
      const taller = await tallerRepository.obtenerPorId(fila.taller_id);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.PENDIENTE_ASIGNACION, ESTADOS_TALLER.ASIGNADO,
        `Asignado al técnico ${tecnico ? tecnico.nombre : tecnicoId} (taller ${taller ? taller.nombre : fila.taller_id})`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['tecnico:' + tecnicoId]);
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
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, 'Técnico marcó el vale como en proceso');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      // Sin notificación: marcar "en proceso" no debe sonar ni del lado del técnico ni del encargado.
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
      await propuestaRepository.crear(valeId, usuario.id, url, false, `${hoyISO()} ${horaActual()}`);
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_REVISION);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION, 'Técnico entregó propuesta');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, [`taller:${fila.taller_id}`]);
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
      await propuestaRepository.crear(valeId, usuario.id, null, true, `${hoyISO()} ${horaActual()}`);
      await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.EN_REVISION);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_REVISION, 'Técnico canceló el proceso (propuesta en blanco)');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, [`taller:${fila.taller_id}`]);
      return enriquecer(actualizado);
    });
  }

  async revisarPropuesta(usuario, valeId, { aprobar, tecnicoReasignadoId, tallerId }) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      const fila = await this._resolverFilaTallerParaEncargado(usuario, valeId, tallerId);
      if (fila.estado !== ESTADOS_TALLER.EN_REVISION) {
        throw new Error('Solo se pueden revisar talleres en estado EN_REVISION.');
      }
      if (aprobar) {
        const ultimaPropuesta = await propuestaRepository.obtenerUltimaPorValeYTecnico(valeId, fila.tecnico_id);
        if (!ultimaPropuesta || ultimaPropuesta.es_cancelacion || !ultimaPropuesta.url) {
          throw new Error('No se puede aprobar una propuesta en blanco: el técnico debe adjuntar el documento de propuesta.');
        }
        await valeTallerRepository.actualizarEstado(fila.id, ESTADOS_TALLER.APROBADO);
        const taller = await tallerRepository.obtenerPorId(fila.taller_id);
        await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.APROBADO,
          `Encargado de ${taller ? taller.nombre : fila.taller_id} aprobó la propuesta de su taller`);
        await this._recalcularEstadoVale(valeId, usuario.id);
        const actualizado = await valeRepository.obtenerPorId(valeId);
        const targets = actualizado.estado === ESTADOS.PENDIENTE_CONFIRMACION
          ? [`asesor:${vale.asesor_id}`]
          : actualizado.estado === ESTADOS.APROBADO_DEPARTAMENTO
            ? ['vales:encargado_general']
            : [];
        valeEvents.notificarCambioEstado(actualizado, targets);
        return enriquecer(actualizado);
      }

      if (!tecnicoReasignadoId) {
        throw new Error('Debe indicar a qué técnico reasignar el vale desaprobado.');
      }
      const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(usuario.id);
      if (!esAdministrador(usuario) && !tecnicos.some(t => t.id === Number(tecnicoReasignadoId))) {
        throw new Error('El técnico indicado no está bajo su mando.');
      }
      await valeTallerRepository.asignar(fila.id, tecnicoReasignadoId, `${hoyISO()} ${horaActual()}`);
      const tecnico = await usuarioValeRepository.obtenerPorId(tecnicoReasignadoId);
      await registrarHistorial(valeId, usuario.id, fila.taller_id, ESTADOS_TALLER.EN_REVISION, ESTADOS_TALLER.ASIGNADO,
        `Encargado desaprobó la propuesta y reasignó a ${tecnico ? tecnico.nombre : tecnicoReasignadoId}`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, [`tecnico:${tecnicoReasignadoId}`]);
      return enriquecer(actualizado);
    });
  }

  // Recalcula el estado GENERAL del vale a partir del progreso de sus talleres.
  // Si algún taller no está APROBADO, el vale permanece en su estado actual
  // (CREADO/EN_CORRECCION/etc.) — no hay nada más que hacer todavía.
  async _recalcularEstadoVale(valeId, actorUsuarioId) {
    const filas = await valeTallerRepository.listarPorVale(valeId);
    const todosAprobados = filas.length > 0 && filas.every(f => f.estado === ESTADOS_TALLER.APROBADO);
    if (!todosAprobados) return;

    const vale = await valeRepository.obtenerPorId(valeId);
    const nuevoEstado = filas.length > 1 ? ESTADOS.APROBADO_DEPARTAMENTO : ESTADOS.PENDIENTE_CONFIRMACION;
    if (vale.estado === nuevoEstado) return;

    // Con un solo taller no hay fusión que hacer (el Encargado General nunca
    // interviene en el camino feliz) — la propuesta de ese único taller pasa a ser
    // directamente el "documento oficial" del vale (analisis_correcciones_4.md #1).
    if (filas.length === 1) {
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
      if (![ESTADOS.APROBADO_DEPARTAMENTO, ESTADOS.EN_CORRECCION].includes(vale.estado)) {
        throw new Error('Solo se pueden fusionar y aprobar vales en estado APROBADO_DEPARTAMENTO o EN_CORRECCION.');
      }
      // La fusión de las propuestas de los talleres NO la hace el sistema — es trabajo
      // manual del Encargado General, que debe adjuntar su propio documento final
      // (analisis_correcciones_4.md #11), aun cuando solo hubo un taller involucrado.
      if (!archivoFusion) {
        throw new Error('Debe adjuntar el documento de fusión antes de aprobar.');
      }
      const saved = await fileStorage.saveFile(archivoFusion.buffer, archivoFusion.originalname, archivoFusion.mimetype);

      await this._regenerarPdf(valeId, [saved.path]);
      await valeRepository.actualizarPropuestaGeneral(valeId, saved.path);
      await valeRepository.actualizarEstado(valeId, ESTADOS.PENDIENTE_CONFIRMACION);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.PENDIENTE_CONFIRMACION,
        'Encargado General adjuntó la fusión final del trabajo de los talleres y aprobó el vale');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, [`asesor:${vale.asesor_id}`]);
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
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.RECIBIDO, 'Asesor confirmó de recibido el vale de arte');
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['vales:supervisores']);
      return enriquecer(actualizado);
    });
  }

  // Rechazar YA NO es una acción separada de "solicitar corrección" — es la misma
  // (analisis_correcciones_4.md #2): rechazar manda el vale a EN_CORRECCION y lo pone
  // en el buzón del Encargado General (nunca reabre los talleres directamente — es el
  // Encargado General quien decide cómo resolver la corrección). RECHAZADO nunca se
  // persiste como estado (#3): el rechazo queda solo en el historial.
  async solicitarCorreccion(usuario, valeId, motivo) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      this._assertPropioDelAsesor(usuario, vale);
      if (vale.estado !== ESTADOS.PENDIENTE_CONFIRMACION) {
        throw new Error('Solo se puede rechazar un vale PENDIENTE_CONFIRMACION.');
      }
      if (!motivo) {
        throw new Error('Debe indicar el motivo del rechazo.');
      }
      await valeRepository.actualizarEstado(valeId, ESTADOS.EN_CORRECCION);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.EN_CORRECCION, `Asesor rechazó el vale de arte: ${motivo}`);
      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['vales:encargado_general']);
      return enriquecer(actualizado);
    });
  }

  // -----------------------------------------------------------------------
  // Modificación: solicitar (staging) → aprobar (crea un vale de arte NUEVO)
  // -----------------------------------------------------------------------
  async solicitarModificacion(usuario, valeId, payload) {
    return this._conLockDeVale(valeId, async () => {
      const vale = await this._requerirVale(valeId);
      this._assertPropioDelAsesor(usuario, vale);
      if (vale.estado !== ESTADOS.RECIBIDO) {
        throw new Error('Solo se puede solicitar modificación sobre un vale ya RECIBIDO.');
      }
      if (vale.modificado) {
        throw new Error('Este vale de arte ya utilizó su única modificación permitida.');
      }
      if (!payload.justificacion) {
        throw new Error('Debe justificar la modificación solicitada.');
      }
      const datos = await this._validarDatosVale(payload);

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
        talleresIds: datos.talleresIds.join(','),
        justificacion: payload.justificacion
      });
      await valeRepository.actualizarEstado(valeId, ESTADOS.SOLICITANDO_MODIFICACION);
      await registrarHistorial(valeId, usuario.id, null, vale.estado, ESTADOS.SOLICITANDO_MODIFICACION, 'Asesor solicitó modificación');

      const actualizado = await valeRepository.obtenerPorId(valeId);
      valeEvents.notificarCambioEstado(actualizado, ['vales:supervisores']);
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
        localidadId: original.localidad_id,
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
        estado: ESTADOS.MODIFICADO
      });

      const talleresIds = solicitud.talleres_ids.split(',').map(Number).filter(Number.isFinite);
      await this._fanOutTalleres(nuevoValeId, talleresIds);

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
      await valeRepository.actualizarEstado(original.id, ESTADOS.RECIBIDO);
      await solicitudModificacionRepository.marcarEstado(solicitud.id, 'APROBADA');

      await registrarHistorial(original.id, usuario.id, null, ESTADOS.SOLICITANDO_MODIFICACION, ESTADOS.RECIBIDO,
        `Supervisor aprobó la solicitud de modificación — se creó el vale ${correlativoNuevo}`);
      await registrarHistorial(nuevoValeId, usuario.id, null, null, ESTADOS.MODIFICADO,
        `Vale creado a partir de la modificación aprobada de ${original.correlativo}`);
      await this._regenerarPdf(nuevoValeId);

      const nuevoVale = await valeRepository.obtenerPorId(nuevoValeId);
      valeEvents.notificarNuevoVale(nuevoVale, [`asesor:${solicitud.asesor_id}`, ...talleresIds.map(id => `taller:${id}`)]);
      return enriquecer(nuevoVale);
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
}

module.exports = new ValeService();
module.exports.ESTADOS = ESTADOS;
module.exports.ESTADOS_TALLER = ESTADOS_TALLER;
module.exports.esEncargadoGeneral = esEncargadoGeneral;
