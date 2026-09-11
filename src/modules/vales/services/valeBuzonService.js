// src/modules/vales/services/valeBuzonService.js
// Buzón / listado por rol + Vista Gerencia. Se queda como UN solo archivo
// (grande a propósito) porque cada rama de rol comparte
// `_enriquecerConTaller`/`_resolverVentana`/`_aplicarFiltroContador`/
// `ordenarPorGrupos` — partirlo por rol obligaría a esos archivos hermanos a
// importarse estos mismos helpers entre sí sin ninguna ganancia real de
// cohesión.
const valeRepository = require('../repositories/valeRepository');
const valeTallerRepository = require('../repositories/valeTallerRepository');
const tallerRepository = require('../repositories/tallerRepository');
const propuestaRepository = require('../repositories/propuestaRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const valeCatalogoService = require('./valeCatalogoService');
const {
  ESTADOS, ESTADOS_TALLER, ESTADOS_TERMINALES, ESTADOS_CONFIRMADOS, ROL,
  esAdministrador, enriquecer, dentroDeVentana, ordenarPorGrupos,
  ordenarPorFecha, esHoy, estadoVisibleAsesor,
  ROLES_TALLER_Y_TECNICO
} = require('./valeHelpers');

class ValeBuzonService {
  _resolverVentana(filtros = {}) {
    if (filtros.ventana === 'rango') {
      return { tipo: 'rango', desde: filtros.desde || null, hasta: filtros.hasta || null };
    }
    return { tipo: filtros.ventana || 'todo', fecha: filtros.fecha };
  }

  // Adjunta a cada vale el nombre legible de sus talleres (columna "Taller"
  // del buzón) y sus filas crudas de `vale_talleres` (`_filasTaller`, usado
  // por varias vistas para saber en cuántos talleres trabajó un vale).
  // Compartido por `obtenerBuzon` y `obtenerDashboardGerencia`.
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
      // Un vale en ESPERANDO_AUTORIZACION todavía no tiene filas reales en
      // vale_talleres (el fan-out ocurre recién al autorizar) — sin este
      // respaldo, `taller` quedaba '' y el Supervisor no podía ver qué
      // talleres pidió el asesor antes de autorizar (justo cuando más lo
      // necesita).
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

    // Filtro por tienda (Vista Gerencia): solo lo manda el frontend de
    // Gerencia (y, opcionalmente, Administrador) para acotar el
    // listado/dashboard a una sola tienda; el resto de roles nunca lo envían.
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
      case ROL.SUPERVISOR: // scoped a los asesores bajo su mando
        resultado = vista === 'trabajo'
          ? await this._trabajoSupervisor(usuario, todosConTaller, ventana, filtroContador)
          : await this._buzonSupervisor(usuario, todosConTaller, ventana, filtroContador);
        break;
      case ROL.ENCARGADO_DISENO:
      case ROL.ENCARGADO_UV3D:
      case ROL.ASISTENTE_DISENO: // clon operativo del taller "Diseño"
      case ROL.ENCARGADO_PROTEXTIL:
      case ROL.ENCARGADO_DISENO_LOCAL: // buzón individual, scoped a su propio taller
        // Quien tenga vales.aprobar_general (Encargado de Diseño y Asistente)
        // ve también, mezclada, la cola de fusión — no es un buzón de rol
        // aparte (ver _buzonEncargado).
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

    // "Atrasados" en general: a diferencia de filtroContador (mutuamente
    // excluyente), este es el ÚNICO contador que se puede COMBINAR con
    // cualquier otro filtro activo — se aplica aparte, sobre el resultado ya
    // filtrado por rol/ventana/contador, sin tocar las contadores (mismo
    // criterio que _aplicarFiltroContador).
    const soloAtrasados = ['1', 'true', true].includes(filtros.soloAtrasados);
    const valesConAtraso = soloAtrasados ? resultado.vales.filter(v => v.atrasado) : resultado.vales;

    // Filtro de estado: corre aquí, sobre el conjunto completo, con el MISMO
    // criterio de "estado activo por rol" que ya usa el frontend para pintar
    // la píldora — nunca dos fuentes de verdad divergentes: estado_visible
    // para el asesor (y el supervisor en su vista de trabajo), estado_taller
    // para encargados/técnico, estado general para el resto.
    const usaEstadosVisiblesParaFiltro = usuario.rolId === ROL.ASESOR || (usuario.rolId === ROL.SUPERVISOR && vista === 'trabajo');
    const estadoActivoDe = (v) => {
      if (usaEstadosVisiblesParaFiltro) return v.estado_visible;
      if (ROLES_TALLER_Y_TECNICO.includes(usuario.rolId)) return v.estado_taller || v.estado;
      return v.estado;
    };
    const estadoFiltro = filtros.estado || null;
    const valesPorEstado = estadoFiltro ? valesConAtraso.filter(v => estadoActivoDe(v) === estadoFiltro) : valesConAtraso;

    // Búsqueda: corre sobre la lista COMPLETA ya filtrada por
    // rol/ventana/contador (no solo sobre la página ya cargada en el
    // navegador — `resultado.vales` en este punto no tiene límite todavía).
    // Las contadores no se ven afectadas, mismo criterio que
    // _aplicarFiltroContador.
    const busqueda = String(filtros.busqueda || '').trim().toLowerCase();
    const valesBuscados = busqueda
      ? valesPorEstado.filter(v => `${v.correlativo} ${v.cliente_nombre} ${v.cliente_empresa || ''}`.toLowerCase().includes(busqueda))
      : valesPorEstado;

    // Orden por columna: un clic en un encabezado de la tabla pide un orden
    // explícito que REEMPLAZA por completo la jerarquía de negocio mientras
    // esté activo.
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
  // Vista Gerencia: panel de solo lectura con métricas agregadas — total de
  // vales, % entregados a tiempo/atrasados, y desgloses por estado y por
  // tienda, respetando la misma ventana de tiempo y el mismo filtro de
  // tienda que la lista de vales del gerente (obtenerBuzon con
  // filtros.tiendaId). Lo más importante para gerencia son los vales
  // atrasados (spec explícita), por eso van primero en la respuesta.
  // -----------------------------------------------------------------------
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

    // Recibidos/En Progreso: partición por estado REAL, sin excluir a los
    // vales que hayan pasado por una modificación — "Modificados" ya no es
    // una tercera categoría mutuamente excluyente (correcciones_26 #1), es
    // un indicador combinable igual que "Atrasado": un vale puede estar
    // Recibido/En Progreso Y además ser modificado a la vez.
    const clasificar = (v) => v.estado === ESTADOS.RECIBIDO ? 'recibidos' : 'enProgreso';
    // Un vale "de modificación": el original que ya generó su reemplazo
    // (`vale.modificado`) o el propio reemplazo (`vale.vale_original_id`) —
    // esto persiste sin importar en qué estado real esté hoy (a diferencia
    // de esValeDeModificacion, que solo detecta el estado transitorio
    // MODIFICADO y no sirve para esta clasificación combinable).
    const esModificado = (v) => !!v.modificado || !!v.vale_original_id;

    const total = enVentana.length;
    const recibidos = enVentana.filter(v => clasificar(v) === 'recibidos').length;
    const enProgreso = enVentana.filter(v => clasificar(v) === 'enProgreso').length;
    const pct = (n, deTotal) => deTotal ? Math.round((n / deTotal) * 100) : 0;

    // Drill-down: la lista solo se arma si hay algo activo (contador, atraso
    // o modificados combinables, o búsqueda) — nunca por defecto. Sí se
    // actualiza en tiempo real (ver actualizarDashboardGerenciaEnVivo en el
    // frontend), de forma selectiva para no hacer parpadear tarjetas que el
    // usuario no está mirando.
    const filtroContador = ['recibidos', 'enProgreso'].includes(filtros.filtroContador) ? filtros.filtroContador : null;
    const soloAtrasados = ['1', 'true', true].includes(filtros.soloAtrasados);
    const soloModificados = ['1', 'true', true].includes(filtros.soloModificados);
    const busqueda = String(filtros.busqueda || '').trim().toLowerCase();

    // "Modificados" y "Atrasados" son las tarjetas reactivas al contador
    // combinado — si hay un filtroContador activo (Recibidos/En Progreso),
    // pasan a mostrar su número DENTRO de ese subconjunto (y su % es sobre
    // ese subconjunto, no sobre el gran total: "de mis vales recibidos, qué
    // % fue modificado / está atrasado"). Sin selección, vuelven al total
    // global. Total/Recibidos/En Progreso nunca cambian con la selección.
    const baseReactiva = filtroContador ? enVentana.filter(v => clasificar(v) === filtroContador) : enVentana;
    const modificados = baseReactiva.filter(esModificado).length;
    const atrasados = baseReactiva.filter(v => v.atrasado).length;
    const porcentajeModificados = pct(modificados, baseReactiva.length);
    const porcentajeAtrasados = pct(atrasados, baseReactiva.length);

    let vales = [];
    if (filtroContador || soloAtrasados || soloModificados || busqueda) {
      let lista = enVentana;
      if (filtroContador) lista = lista.filter(v => clasificar(v) === filtroContador);
      if (soloModificados) lista = lista.filter(esModificado);
      if (soloAtrasados) lista = lista.filter(v => v.atrasado);
      if (busqueda) lista = lista.filter(v => `${v.correlativo} ${v.cliente_nombre} ${v.cliente_empresa || ''}`.toLowerCase().includes(busqueda));
      vales = ordenarPorGrupos(lista, [v => v.atrasado]);
    }

    return {
      total, recibidos, enProgreso, modificados, atrasados,
      porcentajeRecibidos: pct(recibidos, total),
      porcentajeEnProgreso: pct(enProgreso, total),
      porcentajeModificados,
      porcentajeAtrasados,
      vales
    };
  }

  // Aplica el filtro de un contador DESPUÉS de calcular las contadores (para
  // que el número de la tarjeta no cambie al activarse) y ANTES de la
  // paginación (para no romper el scroll infinito).
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
      // El contador de límite diario es colectivo por equipo del Supervisor
      // — ver valeCreacionService.obtenerLimiteColectivoSupervisor().
      esperandoAutorizacion: enVentana.filter(v => v.estado_visible === 'ESPERANDO_AUTORIZACION').length,
      valesPorRevisar: enVentana.filter(v => v.estado_visible === 'PENDIENTE_CONFIRMACION').length,
      valesPendientesModificacion: enVentana.filter(v => v.estado_visible === 'SOLICITANDO_MODIFICACION').length,
      // "Atrasados en general": ya no es un filtro más de
      // _aplicarFiltroContador — se combina con cualquier otro filtro
      // activo, ver el manejo de `soloAtrasados` en obtenerBuzon().
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
  // Un vale confirmado permanece visible aquí incluso mientras tiene una
  // modificación en curso (ESTADOS_CONFIRMADOS incluye
  // SOLICITANDO_MODIFICACION) — solicitar una modificación no debe "borrar"
  // el registro de que ya fue confirmado (el historial completo vive en
  // vale_historial).
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
    const vales = ordenarPorFecha(filtrados);
    return { vales, contadores };
  }

  // ---- Supervisor: sidebar Buzón (autorización de creación, modificaciones,
  // pendientes de confirmación) — scoped a los asesores bajo su mando, ya
  // que cada tienda tiene su propio Supervisor ----
  async _buzonSupervisor(usuario, todos, ventana, filtroContador) {
    const misAsesoresIds = new Set((await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id)).map(a => a.id));
    const propios = todos.filter(v => misAsesoresIds.has(v.asesor_id));
    const visibles = propios.filter(v => [
      ESTADOS.ESPERANDO_AUTORIZACION, ESTADOS.SOLICITANDO_MODIFICACION, ESTADOS.MODIFICADO, ESTADOS.PENDIENTE_CONFIRMACION
    ].includes(v.estado));
    const enVentana = visibles.filter(v => dentroDeVentana(v, ventana));
    const contadores = {
      // Se calcula por separado en
      // valeCreacionService.obtenerLimiteColectivoSupervisor() — la tarjeta
      // arma el texto "N/M" igual que ya hacía el asesor.
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

  // ---- Supervisor: sidebar Trabajo realizado ----
  // Dos grupos, cada uno ordenado por su propia fecha (no por
  // actualizado_en): 1) vales que ÉL autorizó (creación o modificación), por
  // autorizado_en desc; 2) vales de SUS asesores confirmados de recibido,
  // por confirmado_en desc.
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
      return { vales: [], contadores: this._contadoresVaciosEncargado() };
    }
    const misFilas = miTaller
      ? valeTalleresTodos.filter(f => f.taller_id === miTaller.id).filter(f => f.estado !== ESTADOS_TALLER.APROBADO)
      : (esAdministrador(usuario) ? valeTalleresTodos.filter(f => f.estado !== ESTADOS_TALLER.APROBADO) : []);
    const valeIdsVisibles = new Set(misFilas.map(f => f.vale_id));

    // Cada vale se muestra con el estado DE SU FILA en este taller, no el
    // estado general del vale (que puede diferir si hay otro taller
    // involucrado).
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
    const enPausa = enVentana.filter(v => v.estado_taller === ESTADOS_TALLER.EN_PAUSA);
    const enRevision = enVentana.filter(v => v.estado_taller === ESTADOS_TALLER.EN_REVISION);

    // Cola de fusión: vales multi-taller (o de modificación) con TODOS sus
    // talleres ya aprobados, sin scope de taller.
    const pendientesFusion = puedeFusionar
      ? todosConTaller.filter(v => v.estado === ESTADOS.APROBADO_DEPARTAMENTO && dentroDeVentana(v, ventana))
      : [];

    // Contadores por estado (conteo completo, sin desglosar
    // atrasado/no atrasado) + el "Atrasados en general" combinable que
    // maneja obtenerBuzon() aparte.
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
    // El trabajo activo de los técnicos (en proceso/en pausa) y lo ya
    // asignado suben por encima de lo que requiere acción del propio
    // encargado (revisar/asignar). La cola de fusión se queda al final.
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

  // ---- Encargado de un taller: sidebar Trabajo realizado — vales con una
  // fila APROBADA en SU taller, orden por fecha (mismo criterio de
  // ordenarPorFecha que usan las demás vistas de "trabajo realizado": la
  // fecha de aprobación real vive en vale_talleres.actualizado_en, pero se
  // ordena por la del vale para ser consistente con _trabajoAsesor). Cada
  // fila trae también `propuesta_taller_url` — la propuesta REAL que este
  // taller aprobó (vale_propuestas, por técnico), no
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
    const conPropuesta = await Promise.all(enVentana.map(async v => {
      const fila = mapaFilaPorVale.get(v.id);
      const propuesta = fila.tecnico_id ? await propuestaRepository.obtenerUltimaPorValeYTecnico(v.id, fila.tecnico_id) : null;
      const propuestaTallerUrl = propuesta ? propuesta.url : null;
      // La fecha de "aprobado hoy" debe ser la de ESTA fila de taller
      // (fila.actualizado_en), no la del vale general (v.actualizado_en) —
      // esa última se pisa con cualquier transición posterior del vale
      // (fusión, confirmación, etc.), lo que antes hacía que "aprobados hoy"
      // contara aprobaciones viejas cuyo vale cambió hoy.
      return {
        ...v, estado_taller: ESTADOS_TALLER.APROBADO, propuesta_taller_url: propuestaTallerUrl, aprobado_en: fila.actualizado_en,
        _rowKey: `${v.id}-P`, _tipoRegistro: 'PROPUESTA'
      };
    }));

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

  async obtenerTecnicosAsignables(usuario) {
    if (esAdministrador(usuario)) {
      return usuarioValeRepository.listarTodosLosTecnicos();
    }
    return usuarioValeRepository.listarTecnicosPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
  }

  // Ordenado por fecha de ENTREGA más próxima. Un técnico sin vales activos
  // no tiene "próxima entrega": va al final.
  async obtenerCargaTrabajo(usuario) {
    const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
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
      const tecnicos = await usuarioValeRepository.listarTecnicosPorEncargado(await valeCatalogoService.idEncargadoEfectivo(usuario));
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
    // Ordenado por fecha de entrega más próxima.
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

    // Se dejan únicamente 3 contadores para el técnico ("asignados sin
    // atraso", "asignados con atraso" y el vale en proceso) — no está en la
    // lista de roles con el "Atrasados en general" combinable, así que
    // "asignadosAtrasados" sigue siendo su propio filtro normal (mutuamente
    // excluyente), no el mecanismo global de soloAtrasados.
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

  // ---- Técnico: sidebar Trabajo realizado (aprobados por su taller, orden
  // por fecha) — cada fila trae también `propuesta_taller_url`, la propuesta
  // REAL que el propio técnico entregó, calcado de _trabajoEncargadoTaller,
  // para que "Ver propuesta" también aplique aquí.
  async obtenerTrabajoTecnico(usuario, ventana, filtroContador) {
    const activas = (await valeTallerRepository.listarActivasPorTecnico(usuario.id))
      .filter(a => a.estado === ESTADOS_TALLER.APROBADO);
    const vales = (await Promise.all(activas.map(async a => {
      const vale = await valeRepository.obtenerPorId(a.vale_id);
      if (!vale) return null;
      const propuesta = await propuestaRepository.obtenerUltimaPorValeYTecnico(a.vale_id, usuario.id);
      const propuestaTallerUrl = propuesta ? propuesta.url : null;
      // Estado lógico fijo — al técnico no le importa qué pase con el vale
      // después de que le aprueben su trabajo (mismo criterio que
      // _trabajoEncargadoTaller). `aprobado_en` toma la fecha de ESTA fila
      // de taller (`a.actualizado_en`), no la del vale general.
      // `_rowKey`/`_tipoRegistro` por consistencia con
      // _trabajoEncargadoTaller — el técnico nunca fusiona, siempre una sola
      // fila por correlativo.
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
}

module.exports = new ValeBuzonService();
