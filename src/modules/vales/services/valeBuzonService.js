// src/modules/vales/services/valeBuzonService.js
// Buzón / listado por rol + Vista Gerencia. Se queda como UN solo archivo
// (grande a propósito) porque cada rama de rol comparte
// `_enriquecerConTaller`/`_resolverVentana`/`_aplicarFiltroContador`/
// `ordenarPorGrupos` — partirlo por rol obligaría a esos archivos hermanos a
// importarse estos mismos helpers entre sí sin ninguna ganancia real de
// cohesión.
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const modificacionBasicaRepository = require('../repositories/valeModificacionBasicaRepository');
const tallerRepository = require('../repositories/tallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const reporteRepository = require('../repositories/reporteRepository');
const valeCatalogoService = require('./valeCatalogoService');
const propuestasCompartidasService = require('./propuestasCompartidasService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const valeVistoRepository = require('../repositories/valeVistoRepository');
const { calcularPipeline, prepararPipeline } = require('./valePipeline');
const {
  ESTADOS, ESTADOS_TALLER, ESTADOS_TERMINALES, ESTADOS_CONFIRMADOS, ROL,
  esAdministrador, enriquecer, dentroDeVentana, ordenarPorGrupos,
  ordenarPorFecha, esHoy, estadoVisibleAsesor, hoyISO,
  esDeTaller, rolEncargadoDe, esValeDeModificacion
} = require('./valeHelpers');

// La propuesta del taller trae nota o enlaces (aunque no tenga archivo).
const extraDe = (propuesta) => !!(propuesta && (propuesta.nota || Number(propuesta.n_enlaces) > 0));

// Vale MOD-, o el original que tiene (o ya tuvo) una modificación.
function esModificado(v) {
  return esValeDeModificacion(v) || Number(v.modificado) === 1 || !!v.mod_en_tramite;
}

// Cada vale cuenta en un solo contador, el del paso del pipeline en que está (valePipeline.js).
function conPaso(vales) {
  return vales.map(v => ({ ...v, paso_pipeline: calcularPipeline(v).paso }));
}

function contadoresPorPaso(vales) {
  return {
    porAutorizar: vales.filter(v => v.paso_pipeline === 1).length,
    porAsignar: vales.filter(v => v.paso_pipeline === 2).length,
    enProceso: vales.filter(v => v.paso_pipeline === 3).length,
    enRevision: vales.filter(v => v.paso_pipeline === 4).length,
    porRecibir: vales.filter(v => v.paso_pipeline === 5).length,
    modificados: vales.filter(esModificado).length,
    atrasados: vales.filter(v => v.atrasado).length
  };
}

const PREDICADOS_POR_PASO = {
  porAutorizar: v => v.paso_pipeline === 1,
  porAsignar: v => v.paso_pipeline === 2,
  enProceso: v => v.paso_pipeline === 3,
  enRevision: v => v.paso_pipeline === 4,
  porRecibir: v => v.paso_pipeline === 5
};

// Ordena por el número final del correlativo; a igual número, el original antes que sus MOD-, MOD2-, MOD3-…
function numeroDeCorrelativo(correlativo) {
  const m = /-(\d+)$/.exec(String(correlativo || ''));
  return m ? Number(m[1]) : null;
}

// 0 para un vale normal; 1 para MOD-, 2 para MOD2-…
function ordenDeMod(correlativo) {
  const m = /^MOD(\d*)-/.exec(correlativo);
  return m ? (m[1] ? Number(m[1]) : 1) : 0;
}

function compararCorrelativos(a, b) {
  const ca = String(a.correlativo || ''), cb = String(b.correlativo || '');
  const na = numeroDeCorrelativo(ca), nb = numeroDeCorrelativo(cb);
  if (na !== nb) {
    if (na === null) return 1;
    if (nb === null) return -1;
    return na - nb;
  }
  const ma = ordenDeMod(ca), mb = ordenDeMod(cb);
  if (ma !== mb) return ma - mb;
  return ca < cb ? -1 : (ca > cb ? 1 : 0);
}

// Estados de taller que esperan los adjuntos: cuentan como "pendientes de asignar" del encargado.
const ESTADOS_ADJUNTOS = [ESTADOS_TALLER.VERIFICANDO_ADJUNTOS, ESTADOS_TALLER.ADJUNTOS_RECHAZADOS, ESTADOS_TALLER.ADJUNTOS_RESPONDIDOS];
const ESTADOS_ADJUNTOS_VISIBLES_ASESOR = [ESTADOS_TALLER.ADJUNTOS_RECHAZADOS, ESTADOS_TALLER.ADJUNTOS_RESPONDIDOS];
const esPendienteAsignacion = (estado) => estado === ESTADOS_TALLER.PENDIENTE_ASIGNACION || ESTADOS_ADJUNTOS.includes(estado);

class ValeBuzonService {
  // Adjuntos reclamados por taller (rechazados/respondidos) para asesor y supervisor; VERIFICANDO no se muestra.
  _adjuntosDe(vale) {
    const nombres = new Map((vale._talleresDetalle || []).map(t => [t.taller_id, t.nombre]));
    return (vale._filasTaller || [])
      .filter(f => ESTADOS_ADJUNTOS_VISIBLES_ASESOR.includes(f.estado))
      .map(f => ({
        taller_id: f.taller_id, taller: nombres.get(f.taller_id) || `#${f.taller_id}`, estado: f.estado,
        total_talleres: (vale._filasTaller || []).length,
        vence_en: f.adjuntos_vence_en, mensaje: f.adjuntos_mensaje, respondido_en: f.adjuntos_respondido_en
      }));
  }

  // Talleres activos del vale con su estado: el asesor los lista al dar de baja un taller.
  _talleresEstadoDe(vale) {
    const nombres = new Map((vale._talleresDetalle || []).map(t => [t.taller_id, t.nombre]));
    return (vale._filasTaller || []).map(f => ({ taller_id: f.taller_id, taller: nombres.get(f.taller_id) || `#${f.taller_id}`, estado: f.estado }));
  }

  // Ventana de tiempo del buzón; un valor inválido es un 400, no un error interno.
  _resolverVentana(filtros = {}) {
    const tipo = filtros.ventana || 'todo';
    if (!['todo', 'mes', 'rango'].includes(tipo)) throw new ErrorDeNegocio('El período elegido no es válido.');
    const fechaValida = (valor, etiqueta) => {
      if (valor === undefined || valor === null || valor === '') return null;
      const texto = String(valor);
      const f = new Date(`${texto}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(f.getTime()) || f.toISOString().slice(0, 10) !== texto) {
        throw new ErrorDeNegocio(`La fecha ${etiqueta} no es válida.`);
      }
      return texto;
    };
    if (tipo === 'rango') {
      const desde = fechaValida(filtros.desde, '«Desde»');
      const hasta = fechaValida(filtros.hasta, '«Hasta»');
      if (desde && hasta && desde > hasta) throw new ErrorDeNegocio('La fecha «Desde» no puede ser posterior a «Hasta».');
      return { tipo, desde, hasta };
    }
    return { tipo, fecha: fechaValida(filtros.fecha, 'del mes') || undefined };
  }

  // Adjunta a cada vale el nombre legible de sus talleres (columna "Taller"
  // del buzón) y sus filas crudas de `vale_talleres` (`_filasTaller`, usado
  // por varias vistas para saber en cuántos talleres trabajó un vale).
  // Compartido por `obtenerBuzon`. Con `valeTalleresPrecargados` (todas las filas de ESOS vales) no relee la tabla
  // y acota las consultas de extras y modificaciones a esos vales.
  async _enriquecerConTaller(vales, valeTalleresPrecargados = null) {
    // Incluye talleres inactivos: un vale terminado de un taller ya desactivado
    // debe seguir mostrando su nombre, no "#id".
    const talleresTodos = await tallerRepository.listarTodos();
    const valeTalleresTodos = valeTalleresPrecargados || await valeTallerRepository.listarTodos();
    const idsAcotados = valeTalleresPrecargados ? vales.map(v => v.id) : null;
    const mapaTalleresPorVale = new Map();
    valeTalleresTodos.forEach(vt => {
      const lista = mapaTalleresPorVale.get(vt.vale_id) || [];
      lista.push(vt);
      mapaTalleresPorVale.set(vt.vale_id, lista);
    });
    const nombresTaller = new Map(talleresTodos.map(t => [t.id, t.nombre]));
    const nombreTaller = (id) => nombresTaller.get(id) || `#${id}`;
    // Vales con nota o enlaces en su propuesta o fusión: «Ver propuesta» también aplica aunque no haya archivo.
    const conExtra = await propuestaRepository.listarValesConExtra(idsAcotados);
    // Un original con una modificación en trámite sigue en su estado: este dato permite avisarlo y bloquear "Confirmar".
    const enTramite = new Map((await valeRepository.listarModificacionesEnTramite(idsAcotados))
      .map(m => [m.vale_original_id, { id: m.id, correlativo: m.correlativo, estado: m.estado }]));
    // Conversaciones de modificación básica abiertas: el asesor no puede confirmar mientras tanto y el taller debe responder.
    const basicasAbiertas = new Map();
    for (const m of await modificacionBasicaRepository.listarAbiertasPorVales(vales.map(v => v.id))) {
      const lista = basicasAbiertas.get(m.vale_id) || [];
      lista.push({ id: m.id, taller_id: m.taller_id });
      basicasAbiertas.set(m.vale_id, lista);
    }
    // Todas las modificaciones básicas del vale (con su estado): el chat y la etiqueta «Mod. en proceso» salen de aquí.
    const basicasTodas = new Map();
    for (const m of await modificacionBasicaRepository.listarPorVales(vales.map(v => v.id))) {
      const lista = basicasTodas.get(m.vale_id) || [];
      lista.push({ id: m.id, taller_id: m.taller_id, estado: m.estado });
      basicasTodas.set(m.vale_id, lista);
    }
    // Rechazos recientes de una modificación básica: solo importan mientras el vale está en el paso 5 o ya recibido.
    const basicasRechazadas = new Map();
    for (const m of await modificacionBasicaRepository.listarRechazadasRecientesPorVales(vales.map(v => v.id))) {
      const lista = basicasRechazadas.get(m.vale_id) || [];
      lista.push({ id: m.id, taller_id: m.taller_id, taller: nombreTaller(m.taller_id) });
      basicasRechazadas.set(m.vale_id, lista);
    }
    return vales.map(v => {
      const filas = mapaTalleresPorVale.get(v.id) || [];
      // Un vale en ESPERANDO_AUTORIZACION todavía no tiene filas reales en
      // vale_talleres (el fan-out ocurre recién al autorizar) — sin este
      // respaldo, `taller` quedaba '' y el Supervisor no podía ver qué
      // talleres pidió el asesor antes de autorizar (justo cuando más lo
      // necesita).
      const idsTaller = filas.length > 0
        ? filas.map(f => f.taller_id)
        : String(v.talleres_solicitados || '').split(',').map(Number).filter(Number.isFinite);
      const talleresDetalle = filas.map(f => ({ taller_id: f.taller_id, nombre: nombreTaller(f.taller_id), estado: f.estado }));
      return {
        ...v, taller: idsTaller.map(nombreTaller).join(', '), _filasTaller: filas, _talleresDetalle: talleresDetalle, mod_en_tramite: enTramite.get(v.id) || null,
        modificaciones_basicas_abiertas: basicasAbiertas.get(v.id) || [],
        modificaciones_basicas: basicasTodas.get(v.id) || [],
        modificaciones_basicas_rechazadas: [ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO].includes(v.estado) ? (basicasRechazadas.get(v.id) || []) : [],
        // Nota o enlaces de la fusión; o los de la propuesta cuando el vale ya volvió al asesor (no antes de que se apruebe).
        propuesta_extra: conExtra.fusion.has(v.id) || !!v.propuesta_general_nota
          || (conExtra.propuestas.has(v.id) && [ESTADOS.PENDIENTE_CONFIRMACION, ESTADOS.RECIBIDO, ESTADOS.CONFIRMADO].includes(v.estado))
      };
    });
  }

  // Selección del buzón (o de Trabajo realizado) según el rol, para una ventana de tiempo dada.
  async _resolverPorRol(usuario, vista, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador) {
    let resultado;
    // El asistente se rige por el rol de su encargado (y su taller sale de idEncargadoEfectivo).
    switch (rolEncargadoDe(usuario)) {
      case ROL.ADMINISTRADOR: // ve todo
        resultado = vista === 'trabajo'
          ? this._trabajoAsesor(null, todosConTaller, ventana, filtroContador)
          : this._buzonAsesor(null, todosConTaller, ventana, filtroContador);
        break;
      case ROL.ASESOR:
        resultado = vista === 'trabajo'
          ? this._trabajoAsesor(usuario, todosConTaller, ventana, filtroContador)
          : this._buzonAsesor(usuario, todosConTaller, ventana, filtroContador);
        break;
      case ROL.SUPERVISOR: // scoped a los asesores bajo su mando
        resultado = vista === 'trabajo'
          ? await this._trabajoSupervisor(usuario, todosConTaller, ventana, filtroContador)
          : await this._buzonSupervisor(usuario, todosConTaller, ventana, filtroContador);
        break;
      case ROL.ENCARGADO_DISENO:
      case ROL.ENCARGADO_UV3D:
      case ROL.ENCARGADO_PROTEXTIL:
      case ROL.ENCARGADO_DISENO_LOCAL: // buzón individual, scoped a su propio taller
        // Quien tenga vales.aprobar_general (Encargado de Diseño y Asistente)
        // ve también, mezclada, la cola de fusión — no es un buzón de rol
        // aparte (ver _buzonEncargado).
        resultado = vista === 'trabajo'
          ? await this._trabajoEncargadoTaller(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador)
          : await this._buzonEncargado(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador);
        break;
      case ROL.DISENADOR:
        resultado = vista === 'trabajo'
          ? await this.obtenerTrabajoDisenador(usuario, ventana, filtroContador)
          : await this.obtenerBuzonDisenador(usuario, ventana, filtroContador);
        break;
      default:
        // Cualquier otro rol con vales.ver (p. ej. el Gerente) ve el buzón general en solo lectura: sus acciones
        // siguen exigiendo sus propios permisos de escritura.
        resultado = vista === 'trabajo'
          ? this._trabajoAsesor(null, todosConTaller, ventana, filtroContador)
          : this._buzonAsesor(null, todosConTaller, ventana, filtroContador);
    }
    return resultado;
  }

  // Cotas de fecha de entrega ('YYYY-MM-DD') de la ventana: inicio inclusivo y primer día posterior (exclusivo); null si no hay.
  _limitesDeVentana(ventana) {
    if (ventana.tipo === 'rango') {
      const hasta = ventana.hasta ? new Date(Date.parse(`${ventana.hasta}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : null;
      return { desdeInclusivo: ventana.desde || null, hastaExclusivo: hasta };
    }
    if (ventana.tipo === 'mes') {
      const [anio, mes] = (ventana.fecha || hoyISO()).split('-').map(Number);
      return {
        desdeInclusivo: new Date(Date.UTC(anio, mes - 1, 1)).toISOString().slice(0, 10),
        hastaExclusivo: new Date(Date.UTC(anio, mes, 1)).toISOString().slice(0, 10)
      };
    }
    return { desdeInclusivo: null, hastaExclusivo: null };
  }

  // Vales abiertos que el Buzón de este rol puede llegar a mostrar (el JS de cada rol sigue decidiendo qué se ve).
  async _cargarAbiertosDelBuzon(usuario, rol, ventana, talleresActivos) {
    const base = { estadosTerminales: ESTADOS_TERMINALES, hastaExclusivo: this._limitesDeVentana(ventana).hastaExclusivo };
    switch (rol) {
      case ROL.ASESOR:
        return valeRepository.listarParaBuzon({ ...base, asesorIds: [usuario.id] });
      case ROL.SUPERVISOR: {
        const asesores = await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id);
        return valeRepository.listarParaBuzon({ ...base, asesorIds: [...asesores.map(a => a.id), usuario.id] });
      }
      case ROL.ENCARGADO_DISENO:
      case ROL.ENCARGADO_UV3D:
      case ROL.ENCARGADO_PROTEXTIL:
      case ROL.ENCARGADO_DISENO_LOCAL: {
        if (esAdministrador(usuario)) return this._conBasicasAbiertas(await valeRepository.listarParaBuzon(base), null);
        const idEfectivo = await valeCatalogoService.idEncargadoEfectivo(usuario);
        const miTaller = talleresActivos.find(t => t.encargado_id === idEfectivo);
        const puedeFusionar = (usuario.permissions || []).includes('vales.aprobar_general');
        if (!miTaller && !puedeFusionar) return [];
        const ids = new Set(miTaller ? await valeTallerRepository.listarValeIdsDeTallerSinEstado(miTaller.id, ESTADOS_TALLER.APROBADO) : []);
        if (puedeFusionar) (await valeRepository.listarIdsPorEstado(ESTADOS.APROBADO_DEPARTAMENTO)).forEach(id => ids.add(id));
        return this._conBasicasAbiertas(await valeRepository.listarParaBuzon({ ...base, valeIds: [...ids] }), miTaller ? miTaller.id : 0);
      }
      default: // Administrador, Gerente y demás: el buzón general
        return valeRepository.listarParaBuzon(base);
    }
  }

  // Suma, sin ventana ni estado, los vales con una modificación básica abierta con el taller (0 = sin taller: ninguno; null = cualquiera).
  async _conBasicasAbiertas(vales, tallerId) {
    if (tallerId === 0) return vales;
    const yaIncluidos = new Set(vales.map(v => v.id));
    const faltantes = (await modificacionBasicaRepository.listarValeIdsAbiertosDeTaller(tallerId)).filter(id => !yaIncluidos.has(id));
    if (!faltantes.length) return vales;
    return [...vales, ...await valeRepository.listarParaBuzon({ valeIds: faltantes })].sort((a, b) => a.id - b.id);
  }

  async obtenerBuzon(usuario, filtros = {}) {
    await prepararPipeline();
    const ventana = this._resolverVentana(filtros);
    const vista = filtros.vista === 'trabajo' ? 'trabajo' : 'buzon';
    if (vista === 'buzon') ventana.incluirArrastrados = true;
    const filtroContador = filtros.filtroContador || null;
    const rol = rolEncargadoDe(usuario);
    // El diseñador resuelve su lista con sus propias consultas: no necesita las tablas completas.
    let talleresTodos = [];
    let valeTalleresTodos = [];
    let todosConTaller = [];
    if (rol !== ROL.DISENADOR) {
      talleresTodos = await tallerRepository.listarActivos();
      // Trabajo realizado solo trae los vales cuya fecha de entrega cae en la ventana.
      const cargados = (vista === 'buzon'
        ? await this._cargarAbiertosDelBuzon(usuario, rol, ventana, talleresTodos)
        : await valeRepository.listarParaBuzon(this._limitesDeVentana(ventana))).map(enriquecer);
      valeTalleresTodos = await valeTallerRepository.listarPorVales(cargados.map(v => v.id));
      todosConTaller = await this._enriquecerConTaller(cargados, valeTalleresTodos);
    }

    // Filtro por tienda: solo lo manda el frontend del Supervisor (y,
    // opcionalmente, Administrador) para acotar el listado a una sola
    // tienda; el resto de roles nunca lo envían.
    if (filtros.tiendaId) {
      const tiendaId = Number(filtros.tiendaId);
      todosConTaller = todosConTaller.filter(v => v.tienda_id === tiendaId);
    }

    let resultado = await this._resolverPorRol(usuario, vista, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador);
    // «Atrasados» se combina con las demás tarjetas: con otra activa cuenta los atrasados de esa selección. En Trabajo
    // realizado (vales entregados con atraso) siempre se calcula aquí.
    if (resultado.contadores && (vista === 'trabajo' || (filtroContador && typeof resultado.contadores.atrasados === 'number'))) {
      resultado.contadores.atrasados = resultado.vales.filter(v => v.atrasado).length;
    }

    // "Atrasados" en general: a diferencia de filtroContador (mutuamente
    // excluyente), este es el ÚNICO contador que se puede COMBINAR con
    // cualquier otro filtro activo — se aplica aparte, sobre el resultado ya
    // filtrado por rol/ventana/contador, sin tocar las contadores (mismo
    // criterio que _aplicarFiltroContador).
    // "Modificados" (vales MOD- y sus originales) es el segundo interruptor combinable, y el combobox
    // de diseñadores (solo encargados) filtra por el diseñador de la fila de su taller.
    const soloAtrasados = ['1', 'true', true].includes(filtros.soloAtrasados);
    const soloModificados = ['1', 'true', true].includes(filtros.soloModificados);
    const disenadorId = esDeTaller(usuario) ? Number(filtros.disenadorId) || null : null;
    const valesConAtraso = resultado.vales
      .filter(v => !soloAtrasados || v.atrasado)
      .filter(v => !soloModificados || esModificado(v))
      .filter(v => !disenadorId || v.disenador_id === disenadorId);

    // Búsqueda: corre sobre la lista COMPLETA ya filtrada por rol/ventana/contador, no solo sobre la página cargada en el
    // navegador. Los contadores no se ven afectados.
    const busqueda = String(filtros.busqueda || '').trim().toLowerCase();
    const valesBuscados = busqueda
      ? valesConAtraso.filter(v => `${v.correlativo} ${v.cliente_nombre} ${v.cliente_empresa || ''}`.toLowerCase().includes(busqueda))
      : valesConAtraso;

    // Orden por columna: un clic en un encabezado de la tabla pide un orden
    // explícito que REEMPLAZA por completo la jerarquía de negocio mientras
    // esté activo.
    const sortKey = filtros.sortKey || null;
    const sortDir = filtros.sortDir === 'desc' ? -1 : 1;
    const valorOrden = (v) => {
      switch (sortKey) {
        case 'fecha_ingreso': return v.creado_en || `${v.fecha_creacion} ${v.hora_creacion}`;
        case 'fecha_entrega': return v.fecha_entrega || '';
        case 'fecha_evento': return v.fecha_evento || '';
        default: return '';
      }
    };
    const comparador = sortKey === 'correlativo'
      ? compararCorrelativos
      : (a, b) => {
          const va = valorOrden(a), vb = valorOrden(b);
          return va < vb ? -1 : (va > vb ? 1 : 0);
        };
    let valesOrdenados = sortKey
      ? [...valesBuscados].sort((a, b) => comparador(a, b) * sortDir)
      : valesBuscados;

    // Buzón sin orden por columna: del más al menos atrasado (los filtros de estado ya están en los contadores); sin atraso,
    // por fecha de entrega.
    if (vista === 'buzon' && !sortKey) {
      valesOrdenados = [...valesOrdenados]
        .sort((a, b) => (b.diasAtraso || 0) - (a.diasAtraso || 0) || String(a.fecha_entrega).localeCompare(String(b.fecha_entrega)));
    }

    // Paginación por cursor: en vez de un `offset` numérico contra un
    // conjunto que puede recalcularse distinto en cada request (el atraso es
    // relativo a "ahora" y el estado de cualquier vale puede cambiar entre
    // una página y la siguiente), se pide "lo que sigue después de este
    // vale" por id. Si el cursor ya no aparece en el conjunto recalculado
    // (p. ej. cambió de estado justo entre medio) se cae a `offset` como
    // respaldo — el frontend además descarta cualquier fila duplicada al
    // unir páginas, así que este respaldo nunca produce filas repetidas en
    // pantalla.
    const limit = 50;
    const total = valesOrdenados.length;
    // En Trabajo Realizado un mismo vale puede producir 2 filas (fusión +
    // propuesta propia, ver _trabajoEncargadoTaller) que comparten `id` — el
    // cursor usa `_rowKey` cuando existe para no confundir ambas filas entre
    // páginas.
    const claveFila = v => String(v._rowKey || v.id);
    let indiceInicio;
    if (filtros.cursor) {
      const idx = valesOrdenados.findIndex(v => claveFila(v) === String(filtros.cursor));
      indiceInicio = idx === -1 ? Math.max(0, Number(filtros.offset) || 0) : idx + 1;
    } else {
      indiceInicio = Math.max(0, Number(filtros.offset) || 0);
    }
    // Quién está detrás del vale (badge bajo el correlativo): al Supervisor, el asesor que lo creó; al Encargado de taller,
    // el diseñador asignado a su taller.
    const esSupervisor = usuario.rolId === ROL.SUPERVISOR;
    const esEncargado = esDeTaller(usuario);
    const paginaCruda = valesOrdenados.slice(indiceInicio, indiceInicio + limit);
    // Fila de fusión: la etiquetada FUSION o el vale pendiente de fusionar (sin etiqueta); no tiene diseñador, solo asesor.
    const esFilaFusion = (v) => v._tipoRegistro === 'FUSION' || (!v._tipoRegistro && v.estado === ESTADOS.APROBADO_DEPARTAMENTO);
    // En «Trabajo realizado» la fila (P) guarda a su diseñador en `propuesta_disenador_id`.
    const disenadorDe = (v) => v.disenador_id || v.propuesta_disenador_id || null;
    const idsPersona = new Set();
    paginaCruda.forEach(v => {
      if (esSupervisor && v.asesor_id) idsPersona.add(v.asesor_id);
      if (esEncargado && !esFilaFusion(v) && disenadorDe(v)) idsPersona.add(disenadorDe(v));
      if (esEncargado && v.asesor_id) idsPersona.add(v.asesor_id);
    });
    const nombres = new Map((await reporteRepository.listarNombres([...idsPersona])).map(u => [u.id, u.nombre]));
    const personaDe = (v) => {
      if (esSupervisor) return v.asesor_id ? { rol: 'asesor', nombre: nombres.get(v.asesor_id) || null } : null;
      // El Encargado ve también al asesor que creó el vale (en las filas de fusión, solo al asesor).
      if (esEncargado) {
        const asesor = v.asesor_id ? (nombres.get(v.asesor_id) || null) : null;
        if (esFilaFusion(v)) return { rol: 'asesor', nombre: asesor };
        return { rol: 'disenador', nombre: disenadorDe(v) ? (nombres.get(disenadorDe(v)) || null) : null, asesor };
      }
      return null;
    };
    // Propuesta aprobada de otro taller sin ver (una sola consulta para toda la página).
    const idsBuzon = [...new Set(paginaCruda.map(v => v.id))];
    const conPropuestaNueva = await propuestasCompartidasService.valesConPropuestaNueva(usuario, idsBuzon);
    const conHermano = await propuestasCompartidasService.valesConHermano(usuario, idsBuzon);
    const pagina = paginaCruda.map(v => ({ ...v, propuestaOtroTallerNueva: conPropuestaNueva.has(v.id), propuestasOtrosAplica: conHermano.has(v.id), persona: personaDe(v), pipeline: calcularPipeline(v, { rolId: usuario.rolId, heredaDeRolId: usuario.heredaDeRolId }) }));
    const nextCursor = pagina.length ? claveFila(pagina[pagina.length - 1]) : null;
    return {
      vales: pagina,
      contadores: resultado.contadores,
      total,
      hasMore: indiceInicio + limit < total,
      nextCursor,
      ...(resultado.mensajeVacio ? { mensajeVacio: resultado.mensajeVacio } : {})
    };
  }

  // Aplica el filtro de un contador DESPUÉS de calcular las contadores (para
  // que el número de la tarjeta no cambie al activarse) y ANTES de la
  // paginación (para no romper el scroll infinito).
  _aplicarFiltroContador(vales, filtroContador, predicados) {
    if (!filtroContador || !predicados[filtroContador]) return vales;
    return vales.filter(predicados[filtroContador]);
  }

  // ---- Asesor: sidebar Buzón (pipeline activo, sin recibidos/rechazados) ----
  // `usuario` null: la vista del administrador y del gerente, con los vales de todos los asesores.
  _buzonAsesor(usuario, todos, ventana, filtroContador) {
    const propios = (usuario ? todos.filter(v => v.asesor_id === usuario.id) : todos).map(v => ({ ...v, estado_visible: estadoVisibleAsesor(v), adjuntos: this._adjuntosDe(v), talleres_estado: this._talleresEstadoDe(v) }));
    const activos = propios.filter(v => !ESTADOS_TERMINALES.includes(v.estado));
    const enVentana = conPaso(activos.filter(v => dentroDeVentana(v, ventana)));

    // Contadores por paso del pipeline; "Atrasados" y "Modificados" no son filtros excluyentes: se combinan
    // con cualquiera, ver el manejo de `soloAtrasados`/`soloModificados` en obtenerBuzon().
    const contadores = contadoresPorPaso(enVentana);
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, PREDICADOS_POR_PASO);
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado_visible === 'RECHAZADO',
      v => v.estado_visible === 'PENDIENTE_CONFIRMACION',
      v => v.estado_visible === 'SOLICITANDO_MODIFICACION',
      v => v.estado_visible === 'MODIFICADO',
      v => v.estado_visible === 'ESPERANDO_AUTORIZACION',
      v => v.estado_visible === 'CREADO'
    ]);
    return { vales, contadores };
  }

  // ---- Asesor: sidebar Trabajo realizado (confirmados, orden por fecha) ----
  // Un vale confirmado (o cuya modificación se solicitó: queda RECIBIDO al pedirla) permanece visible aquí
  // mientras su MOD- está en trámite.
  _trabajoAsesor(usuario, todos, ventana, filtroContador) {
    const propios = (usuario ? todos.filter(v => v.asesor_id === usuario.id) : todos).map(v => ({ ...v, estado_visible: estadoVisibleAsesor(v) }));
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
    const vales = ordenarPorFecha(filtrados);
    return { vales, contadores };
  }

  // ---- Supervisor: sidebar Buzón (autorización de creación, modificaciones,
  // pendientes de confirmación) — scoped a los asesores bajo su mando, ya
  // que cada tienda tiene su propio Supervisor ----
  async _buzonSupervisor(usuario, todos, ventana, filtroContador) {
    const misAsesoresIds = new Set((await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id)).map(a => a.id));
    const vistos = new Set(await valeVistoRepository.listarIdsPorUsuario(usuario.id));
    // También lista los vales que el propio supervisor creó (`es_propio`), que él mismo autoriza: cuentan en los
    // contadores como los de su equipo y se ven en todos sus estados activos, como el Buzón de un asesor.
    const propios = todos.filter(v => misAsesoresIds.has(v.asesor_id) || v.asesor_id === usuario.id)
    
    .map(v => ({ ...v, visto: vistos.has(v.id), es_propio: v.asesor_id === usuario.id, adjuntos: this._adjuntosDe(v) }));
    // Todos los vales activos de su equipo (y los propios): los contadores por paso necesitan verlos todos.
    const visibles = propios.filter(v => !ESTADOS_TERMINALES.includes(v.estado));
    const enVentana = conPaso(visibles.filter(v => dentroDeVentana(v, ventana)));
    
    const contadores = {
      ...contadoresPorPaso(enVentana)
    };
    const filtrados = this._aplicarFiltroContador(enVentana, filtroContador, PREDICADOS_POR_PASO);
    const vales = ordenarPorGrupos(filtrados, [
      v => v.estado === ESTADOS.ESPERANDO_AUTORIZACION,
      v => v.estado === ESTADOS.SOLICITANDO_MODIFICACION,
      v => v.estado === ESTADOS.MODIFICADO,
      v => v.estado === ESTADOS.PENDIENTE_CONFIRMACION
    ]);
    return { vales, contadores };
  }

  // ---- Supervisor: sidebar Trabajo realizado ----
  // Dos grupos, cada uno ordenado por su propia fecha (no por
  // actualizado_en): 1) vales que ÉL autorizó (creación o modificación), por
  // autorizado_en desc; 2) vales de SUS asesores confirmados de recibido,
  // por confirmado_en desc.
  async _trabajoSupervisor(usuario, todos, ventana, filtroContador) {
    const misAsesoresIds = new Set((await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id)).map(a => a.id));
    // Incluye los vales que él mismo creó (confirmados por él).
    const propios = todos.filter(v => misAsesoresIds.has(v.asesor_id) || v.asesor_id === usuario.id)
      .map(v => ({ ...v, estado_visible: estadoVisibleAsesor(v) }));

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

    // Un vale puede calificar para AMBOS grupos a la vez (lo autorizó él Y
    // ya lo confirmó el asesor) — los contadores de arriba son métricas
    // independientes a propósito, pero en el LISTADO cada vale aparece una
    // sola vez: el grupo de autorización (jerárquicamente primero) se queda
    // con él.
    const idsEnGrupoAutorizados = new Set(grupoAutorizados.map(v => v.id));
    const grupoConfirmadosSinDuplicar = grupoConfirmados.filter(v => !idsEnGrupoAutorizados.has(v.id));

    const vales = [
      ...[...grupoAutorizados].sort((a, b) => new Date(b.autorizado_en) - new Date(a.autorizado_en)),
      ...[...grupoConfirmadosSinDuplicar].sort((a, b) => new Date(b.confirmado_en) - new Date(a.confirmado_en))
    ];
    return { vales, contadores };
  }

  // ---- Encargado de un taller: buzón INDIVIDUAL, scoped a las filas de su
  // propio taller ---- Los vales ya APROBADOS por este taller salen del
  // buzón — ese es justo el contenido de "Trabajo Realizado"
  // (_trabajoEncargadoTaller, más abajo), verlos en ambos lados era
  // redundante. Quien tenga el permiso `vales.aprobar_general` (hoy
  // Encargado de Diseño y Asistente de Diseño) ve ADEMÁS, mezclados en el
  // mismo buzón, los vales `APROBADO_DEPARTAMENTO` pendientes de fusión — no
  // es un buzón de rol aparte. Un vale en ese estado ya tiene su fila de
  // ESTE taller en `APROBADO` (se necesitan TODOS los talleres aprobados
  // para llegar ahí), así que el filtro `!== APROBADO` de arriba ya lo
  // excluyó de "mis pendientes" — el merge es aditivo, sin duplicados.
  async _buzonEncargado(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador) {
    const puedeFusionar = (usuario.permissions || []).includes('vales.aprobar_general');
    const idEfectivo = esAdministrador(usuario) ? null : await valeCatalogoService.idEncargadoEfectivo(usuario);
    const miTaller = esAdministrador(usuario) ? null : talleresTodos.find(t => t.encargado_id === idEfectivo);
    if (!esAdministrador(usuario) && !miTaller && !puedeFusionar) {
      return { vales: [], contadores: this._contadoresVaciosEncargado(), mensajeVacio: 'No tienes un taller asignado.' };
    }
    const misFilas = miTaller
      ? valeTalleresTodos.filter(f => f.taller_id === miTaller.id).filter(f => f.estado !== ESTADOS_TALLER.APROBADO)
      : (esAdministrador(usuario) ? valeTalleresTodos.filter(f => f.estado !== ESTADOS_TALLER.APROBADO) : []);
    const valeIdsVisibles = new Set(misFilas.map(f => f.vale_id));
    const filaPorVale = new Map();
    misFilas.forEach(f => { if (!filaPorVale.has(f.vale_id)) filaPorVale.set(f.vale_id, f); });

    // Cada vale se muestra con el estado DE SU FILA en este taller, no el
    // estado general del vale (que puede diferir si hay otro taller
    // involucrado).
    const vistos = todosConTaller
      .filter(v => valeIdsVisibles.has(v.id))
      .map(v => {
        const fila = filaPorVale.get(v.id);
        return {
          ...enriquecer(v), estado_taller: fila.estado, disenador_id: fila.disenador_id, _filaTallerId: fila.id, taller_id: fila.taller_id,
          adjuntos_vence_en: fila.adjuntos_vence_en, adjuntos_mensaje: fila.adjuntos_mensaje, adjuntos_respondido_en: fila.adjuntos_respondido_en
        };
      });
    const enVentana = vistos.filter(v => dentroDeVentana(v, ventana));

    // Un vale en el paso 5 cuyo asesor pidió una modificación básica a MI taller: su fila ya está aprobada (no entra arriba), pero el
    // taller debe responder, así que se muestra siempre, sin depender de la ventana de fechas.
    const yaVisibles = new Set(vistos.map(v => v.id));
    const conBasica = [];
    for (const v of todosConTaller) {
      if (yaVisibles.has(v.id)) continue;
      const solicitud = (v.modificaciones_basicas_abiertas || []).find(m => (miTaller ? m.taller_id === miTaller.id : esAdministrador(usuario)));
      const fila = solicitud && valeTalleresTodos.find(f => f.vale_id === v.id && f.taller_id === solicitud.taller_id);
      if (!fila) continue;
      conBasica.push({
        ...enriquecer(v), estado_taller: fila.estado, disenador_id: fila.disenador_id, _filaTallerId: fila.id, taller_id: fila.taller_id,
        adjuntos_vence_en: fila.adjuntos_vence_en, adjuntos_mensaje: fila.adjuntos_mensaje, adjuntos_respondido_en: fila.adjuntos_respondido_en
      });
    }

    // "Asignado" = en manos de los diseñadores del taller (asignado, en proceso o en pausa, y no del propio encargado);
    // "Mis asignaciones" = lo que el propio encargado se asignó.
    const EN_MANOS_DE_DISENADOR = [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA];
    const esMio = v => v.disenador_id != null && v.disenador_id === usuario.id;
    const predicados = {
      porAsignar: v => esPendienteAsignacion(v.estado_taller),
      asignadosDisenadores: v => EN_MANOS_DE_DISENADOR.includes(v.estado_taller) && v.disenador_id != null && !esMio(v),
      misAsignaciones: v => esMio(v) && [...EN_MANOS_DE_DISENADOR, ESTADOS_TALLER.EN_REVISION].includes(v.estado_taller),
      porRevisar: v => v.estado_taller === ESTADOS_TALLER.EN_REVISION
    };

    // Cola de fusión: vales multi-taller (o de modificación) con TODOS sus
    // talleres ya aprobados, sin scope de taller.
    const pendientesFusion = puedeFusionar
      ? todosConTaller.filter(v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO && dentroDeVentana(v, ventana))
      : [];

    // Contadores por filtro (conteo completo) + el "Atrasados en general" combinable que maneja
    // obtenerBuzon() aparte.
    const contadores = {
      porAsignar: enVentana.filter(predicados.porAsignar).length,
      asignadosDisenadores: enVentana.filter(predicados.asignadosDisenadores).length,
      misAsignaciones: enVentana.filter(predicados.misAsignaciones).length,
      porRevisar: enVentana.filter(predicados.porRevisar).length,
      atrasados: enVentana.filter(v => v.atrasado).length
    };
    if (puedeFusionar) contadores.pendientesFusion = pendientesFusion.length;

    if (puedeFusionar) predicados.pendientesFusion = v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO;
    const filtrados = this._aplicarFiltroContador([...enVentana, ...pendientesFusion, ...conBasica], filtroContador, predicados);
    // El trabajo activo de los diseñadores (en proceso/en pausa) y lo ya
    // asignado suben por encima de lo que requiere acción del propio
    // encargado (revisar/asignar). La cola de fusión se queda al final.
    const vales = ordenarPorGrupos(filtrados, [
      v => (v.modificaciones_basicas_abiertas || []).length > 0, // una modificación básica por responder va primero
      v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO,
      v => v.estado_taller === ESTADOS_TALLER.EN_PAUSA,
      v => v.estado_taller === ESTADOS_TALLER.ASIGNADO,
      v => v.estado_taller === ESTADOS_TALLER.EN_REVISION,
      v => esPendienteAsignacion(v.estado_taller),
      v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO
    ]);
    return { vales, contadores };
  }

  _contadoresVaciosEncargado() {
    return { porAsignar: 0, asignadosDisenadores: 0, misAsignaciones: 0, porRevisar: 0, atrasados: 0 };
  }

  // ---- Encargado de un taller: sidebar Trabajo realizado — vales con una
  // fila APROBADA en SU taller, orden por fecha (mismo criterio de
  // ordenarPorFecha que usan las demás vistas de "trabajo realizado": la
  // fecha de aprobación real vive en vale_talleres.actualizado_en, pero se
  // ordena por la del vale para ser consistente con _trabajoAsesor). Cada
  // fila trae también `propuesta_taller_url` — la propuesta REAL que este
  // taller aprobó (vale_propuestas, por diseñador), no
  // `vale.propuesta_general_url` (que en un vale multi-taller es la fusión,
  // no el trabajo de este taller en particular). Quien tenga
  // `vales.aprobar_general` ve ADEMÁS, mezclados, los vales que YA fusionó
  // (multi-taller o de modificación, con `propuesta_general_url` propio y ya
  // en un estado posterior a la fusión — nunca
  // CREADO/MODIFICADO/APROBADO_DEPARTAMENTO). ----
  async _trabajoEncargadoTaller(usuario, todosConTaller, valeTalleresTodos, talleresTodos, ventana, filtroContador) {
    const puedeFusionar = (usuario.permissions || []).includes('vales.aprobar_general');
    const idEfectivo = esAdministrador(usuario) ? null : await valeCatalogoService.idEncargadoEfectivo(usuario);
    const miTaller = esAdministrador(usuario) ? null : talleresTodos.find(t => t.encargado_id === idEfectivo);
    if (!esAdministrador(usuario) && !miTaller && !puedeFusionar) {
      return { vales: [], contadores: { aprobadosHoy: 0, totalAprobados: 0 } };
    }
    const filasDeMiTaller = miTaller
      ? valeTalleresTodos.filter(f => f.taller_id === miTaller.id)
      : (esAdministrador(usuario) ? valeTalleresTodos : []);
    const filasAprobadas = filasDeMiTaller.filter(f => f.estado === ESTADOS_TALLER.APROBADO);
    const mapaFilaPorVale = new Map(filasAprobadas.map(f => [f.vale_id, f]));
    // Es un estado LÓGICO congelado — desde que el taller aprueba, Trabajo
    // Realizado lo muestra como "Aprobado" para siempre, sin importar qué le
    // pase al vale después (RECIBIDO, CONFIRMADO, fusión, modificación).
    const vistos = todosConTaller.filter(v => mapaFilaPorVale.has(v.id));
    const enVentana = vistos.filter(v => dentroDeVentana(v, ventana));

    // `estado_taller` fijo en 'APROBADO' (igual que _buzonEncargado) para
    // que la píldora de la tabla muestre el estado DE SU taller, no el
    // general del vale (que puede seguir cambiando si hay otros talleres
    // involucrados). `_rowKey`/`_tipoRegistro` identifican esta fila como la
    // PROPUESTA propia del taller — necesario porque un mismo vale puede
    // además traer una fila de FUSIÓN (ver `fusionados` abajo) con el mismo
    // `v.id`.
    const propuestas = await propuestaRepository.obtenerUltimasPorValesYDisenadores(enVentana.map(v => v.id));
    const conPropuesta = enVentana.map(v => {
      const fila = mapaFilaPorVale.get(v.id);
      const propuesta = fila.disenador_id ? (propuestas.get(`${v.id}-${fila.disenador_id}`) || null) : null;
      const propuestaTallerUrl = propuesta ? propuesta.url : null;
      // La fecha de "aprobado hoy" debe ser la de ESTA fila de taller
      // (fila.actualizado_en), no la del vale general (v.actualizado_en) —
      // esa última se pisa con cualquier transición posterior del vale
      // (fusión, confirmación, etc.), lo que antes hacía que "aprobados hoy"
      // contara aprobaciones viejas cuyo vale cambió hoy.
      return {
        ...enriquecer(v), estado_taller: ESTADOS_TALLER.APROBADO, propuesta_taller_url: propuestaTallerUrl, propuesta_taller_extra: extraDe(propuesta), propuesta_disenador_id: fila.disenador_id || null, aprobado_en: fila.actualizado_en,
        _rowKey: `${v.id}-P`, _tipoRegistro: 'PROPUESTA'
      };
    });

    // Se filtra por la identidad real que dejó `aprobarGeneral`
    // (`vales.fusionado_por`) — adivinarlo a partir del estado/forma del
    // vale producía falsos positivos (p. ej. un vale de UN solo taller que
    // luego se modificó, sin que nadie lo fusionara nunca) y no distinguía
    // QUIÉN fusionó. También lleva `estado_taller`/`aprobado_en` congelados,
    // igual que `conPropuesta`.
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

  // Asignaciones vigentes de un diseñador (las mismas que cuenta la carga de trabajo).
  async _contarAsignacionesVigentes(disenadorId) {
    const activas = await valeTallerRepository.listarActivasPorDisenador(disenadorId);
    return activas.filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_REVISION].includes(a.estado)).length;
  }

  // Diseñadores para el combobox de asignar, cada uno con sus asignaciones actuales; el encargado también se ofrece a sí mismo.
  async obtenerDisenadoresAsignables(usuario) {
    const lista = esAdministrador(usuario)
      ? await usuarioValeRepository.listarTodosLosDisenadores()
      : await usuarioValeRepository.listarDisenadoresPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
    const conCarga = await Promise.all(lista.map(async d => ({ ...d, asignaciones: await this._contarAsignacionesVigentes(d.id) })));
    if (esDeTaller(usuario) && !conCarga.some(d => d.id === usuario.id)) {
      conCarga.unshift({ id: usuario.id, nombre: `${usuario.nombre} (YO)`, asignaciones: await this._contarAsignacionesVigentes(usuario.id) });
    }
    return conCarga;
  }

  // Ordenado por fecha de ENTREGA más próxima. Un diseñador sin vales activos
  // no tiene "próxima entrega": va al final.
  async obtenerCargaTrabajo(usuario) {
    const disenadores = await usuarioValeRepository.listarDisenadoresPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
    const resultado = [];
    for (const disenador of disenadores) {
      const activas = await valeTallerRepository.listarActivasPorDisenador(disenador.id);
      const vales = (await Promise.all(activas.map(a => valeRepository.obtenerPorId(a.vale_id)))).filter(Boolean);
      const filaEnProceso = activas.find(a => a.estado === ESTADOS_TALLER.EN_PROCESO);
      const valeEnProceso = filaEnProceso ? vales.find(v => v.id === filaEnProceso.vale_id) : null;
      const vigentes = activas.filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_REVISION].includes(a.estado));
      const fechasEntrega = vigentes
        .map(a => vales.find(v => v.id === a.vale_id))
        .filter(Boolean)
        .map(v => new Date(v.fecha_entrega).getTime());
      resultado.push({
        disenadorId: disenador.id,
        nombre: disenador.nombre,
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

  async obtenerAsignacionesDeDisenador(usuario, disenadorId) {
    if (!esAdministrador(usuario)) {
      const disenadores = await usuarioValeRepository.listarDisenadoresPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
      if (!disenadores.some(t => t.id === Number(disenadorId))) {
        throw new Error('Ese diseñador no está a tu cargo.');
      }
    }
    const activas = await valeTallerRepository.listarActivasPorDisenador(disenadorId);
    const activasVigentes = activas.filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_REVISION].includes(a.estado));
    const vales = await Promise.all(activasVigentes.map(async a => {
      const vale = await valeRepository.obtenerPorId(a.vale_id);
      return vale ? { ...enriquecer(vale), estado_taller: a.estado } : null;
    }));
    // Ordenado por fecha de entrega más próxima.
    return vales.filter(Boolean).sort((a, b) => new Date(a.fecha_entrega) - new Date(b.fecha_entrega));
  }

  // ---- Diseñador: sidebar Buzón (asignaciones activas, sin aprobados/desaprobados) ----
  async obtenerBuzonDisenador(usuario, ventana, filtroContador) {
    const activas = (await valeTallerRepository.listarActivasPorDisenador(usuario.id))
      .filter(a => [ESTADOS_TALLER.ASIGNADO, ESTADOS_TALLER.EN_PROCESO, ESTADOS_TALLER.EN_PAUSA, ESTADOS_TALLER.EN_REVISION].includes(a.estado));
    // El Buzón arrastra lo anterior a la ventana: solo cuenta la cota superior.
    const valesCargados = await valeRepository.listarParaBuzon({ hastaExclusivo: this._limitesDeVentana(ventana).hastaExclusivo, valeIds: activas.map(a => a.vale_id) });
    const valePorId = new Map(valesCargados.map(v => [v.id, v]));
    const vales = activas
      .map(a => {
        const vale = valePorId.get(a.vale_id);
        return vale ? { ...enriquecer(vale), estado_taller: a.estado } : null;
      })
      .filter(Boolean)
      .filter(v => dentroDeVentana(v, ventana));

    // Se dejan únicamente 3 contadores para el diseñador ("asignados sin
    // atraso", "asignados con atraso" y el vale en proceso) — no está en la
    // lista de roles con el "Atrasados en general" combinable, así que
    // "asignadosAtrasados" sigue siendo su propio filtro normal (mutuamente
    // excluyente), no el mecanismo global de soloAtrasados.
    const contadores = {
      asignados: vales.filter(v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && !v.atrasado).length,
      asignadosAtrasados: vales.filter(v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && v.atrasado).length,
      enRevision: vales.filter(v => v.estado_taller === ESTADOS_TALLER.EN_REVISION).length,
      enProceso: vales.find(v => v.estado_taller === ESTADOS_TALLER.EN_PROCESO)?.correlativo || null
    };
    const predicados = {
      asignados: v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && !v.atrasado,
      asignadosAtrasados: v => v.estado_taller === ESTADOS_TALLER.ASIGNADO && v.atrasado,
      enRevision: v => v.estado_taller === ESTADOS_TALLER.EN_REVISION
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

  // ---- Diseñador: sidebar Trabajo realizado (aprobados por su taller, orden
  // por fecha) — cada fila trae también `propuesta_taller_url`, la propuesta
  // REAL que el propio diseñador entregó, calcado de _trabajoEncargadoTaller,
  // para que "Ver propuesta" también aplique aquí.
  async obtenerTrabajoDisenador(usuario, ventana, filtroContador) {
    const activas = (await valeTallerRepository.listarActivasPorDisenador(usuario.id))
      .filter(a => a.estado === ESTADOS_TALLER.APROBADO);
    // Solo los vales de la ventana: la lista de aprobados crece con todo el historial del diseñador.
    const valesEnVentana = await valeRepository.listarParaBuzon({ ...this._limitesDeVentana(ventana), valeIds: activas.map(a => a.vale_id) });
    const valePorId = new Map(valesEnVentana.map(v => [v.id, v]));
    const propuestas = await propuestaRepository.obtenerUltimasPorValesYDisenadores(valesEnVentana.map(v => v.id));
    const vales = activas.map(a => {
      const vale = valePorId.get(a.vale_id);
      if (!vale) return null;
      const propuesta = propuestas.get(`${vale.id}-${usuario.id}`) || null;
      const propuestaTallerUrl = propuesta ? propuesta.url : null;
      // Estado lógico fijo — al diseñador no le importa qué pase con el vale
      // después de que le aprueben su trabajo (mismo criterio que
      // _trabajoEncargadoTaller). `aprobado_en` toma la fecha de ESTA fila
      // de taller (`a.actualizado_en`), no la del vale general.
      // `_rowKey`/`_tipoRegistro` por consistencia con
      // _trabajoEncargadoTaller — el diseñador nunca fusiona, siempre una sola
      // fila por correlativo.
      return {
        ...enriquecer(vale), propuesta_taller_url: propuestaTallerUrl, propuesta_taller_extra: extraDe(propuesta), propuesta_disenador_id: usuario.id, estado_taller: ESTADOS_TALLER.APROBADO,
        aprobado_en: a.actualizado_en, _rowKey: `${vale.id}-P`, _tipoRegistro: 'PROPUESTA'
      };
    })
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
}

module.exports = new ValeBuzonService();
