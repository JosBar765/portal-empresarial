// src/modules/incidencias/services/incidenciaService.js
// Reportar una incidencia y consultarlas (formulario, listados, resumen y detalle). Los cambios de estado viven en flujoService.
const db = require('../../../config/database');
const incidenciaRepository = require('../repositories/incidenciaRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const personal = require('../repositories/personalRepository');
const operacionRepository = require('../repositories/operacionRepository');
const alcance = require('./alcanceService');
const fotoService = require('./fotoService');
const avisos = require('./avisosService');
const parametros = require('../parametros');
const { ESTADOS, ETIQUETA_ESTADO, ABIERTOS, EN_TRABAJO, IMPACTOS, EVENTO, PERMISO, LIMITES } = require('../constantes');
const { errorDeValidacion, noEncontrada, sinPermiso, limpio } = require('../errores');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');

const CLAVE = /^[A-Za-z0-9_-]{8,64}$/;
const MENSAJE_SIN_CLAVE = 'Falta la clave de la operación. Recarga la página e inténtalo de nuevo.';

// Los cuatro impactos tal como se muestran al reportar.
const IMPACTO_TEXTOS = {
  riesgo_personas: { nombre: 'Riesgo para las personas', ayuda: 'Chispas, cable expuesto, fuga' },
  detiene_operacion: { nombre: 'Detiene la operación', ayuda: 'No se puede trabajar' },
  trabajo_con_limitaciones: { nombre: 'Trabajo con limitaciones', ayuda: 'Hay alternativa pero es lenta' },
  molestia_menor: { nombre: 'Molestia menor', ayuda: 'No afecta el trabajo' }
};

const VISTAS = ['reportadas', 'buzon', 'tecnico', 'verificar', 'tiendas', 'todas'];

const aPrioridad = (f) => ({ id: f.prioridad_id, codigo: f.prioridad_codigo, nombre: f.prioridad_nombre, color: f.prioridad_color, orden: f.prioridad_orden });

function aResumen(f) {
  return {
    id: f.id,
    correlativo: f.correlativo,
    titulo: f.titulo,
    estado: f.estado,
    estadoEtiqueta: ETIQUETA_ESTADO[f.estado],
    impacto: f.impacto,
    prioridad: aPrioridad(f),
    tienda: { id: f.tienda_id, codigo: f.tienda_codigo, empresa: f.empresa, pais: f.pais },
    zona: f.zona,
    categoria: f.categoria,
    tipoActivo: f.tipo_activo,
    activoTexto: f.activo_texto,
    reportante: { id: f.reportada_por, nombre: f.reportante },
    tecnico: f.tecnico_id ? { id: f.tecnico_id, nombre: f.tecnico } : null,
    ronda: f.ronda,
    reincidente: Boolean(f.reincidente),
    creadaEn: f.creado_en,
    actualizadaEn: f.actualizado_en,
    tomadaEn: f.tomada_en,
    cerradaEn: f.cerrada_en
  };
}

class IncidenciaService {
  // --- Formulario ---

  // Todo lo que necesita el formulario de reportar: tiendas, zonas, categorías, impactos, límites y la tienda propia.
  async formulario(usuario) {
    const [tiendas, zonas, categorias, tipos, reglas, prioridades, config, propiaId, recientes] = await Promise.all([
      catalogoRepository.tiendasDisponibles(), catalogoRepository.zonas(), catalogoRepository.categorias(), catalogoRepository.tiposDeActivo(),
      catalogoRepository.reglas(), catalogoRepository.prioridades(), parametros.valores(), catalogoRepository.tiendaPropia(usuario.id),
      incidenciaRepository.reportesRecientes(usuario.id)
    ]);
    const porId = new Map(prioridades.map(p => [p.id, p]));
    let avisoPais = null;
    let tiendaPropia = null;
    if (propiaId) {
      const propia = await catalogoRepository.tienda(propiaId);
      if (propia && propia.pais_habilitado) tiendaPropia = propia.id;
      else if (propia) avisoPais = propia.pais_aviso || 'Todavía no está disponible en tu país.';
    }
    return {
      tiendas: tiendas.map(t => ({ id: t.id, codigo: t.codigo, empresa: t.empresa, departamento: t.departamento, subdivision: t.subdivision, pais: t.pais })),
      tiendaPropiaId: tiendaPropia,
      avisoPais,
      zonas: zonas.map(z => ({ id: z.id, nombre: z.nombre, tiendaId: z.tienda_id })),
      categorias: categorias.map(c => ({ id: c.id, nombre: c.nombre, especialidad: c.especialidad })),
      tiposActivo: tipos.map(t => ({ id: t.id, categoriaId: t.categoria_id, nombre: t.nombre })),
      impactos: IMPACTOS.map(clave => {
        const regla = reglas.find(r => r.impacto === clave);
        const prioridad = regla ? porId.get(regla.prioridad_id) : null;
        return { clave, ...IMPACTO_TEXTOS[clave], prioridad: prioridad ? { codigo: prioridad.codigo, nombre: prioridad.nombre, color: prioridad.color } : null };
      }),
      limites: { fotos: config.fotos_por_reporte, titulo: LIMITES.titulo, descripcion: LIMITES.descripcion, activoTexto: LIMITES.activoTexto },
      reportesRestantes: Math.max(0, config.reportes_por_usuario - recientes)
    };
  }

  // ¿Ya hay un reporte parecido? Se consulta mientras se escribe; nunca bloquea.
  async similares(query) {
    const config = await parametros.valores();
    const tiendaId = aEntero(query.tiendaId);
    const categoriaId = aEntero(query.categoriaId);
    if (!tiendaId || !categoriaId) return { similares: [] };
    const filas = await incidenciaRepository.similares({
      tiendaId, categoriaId, zonaId: aEntero(query.zonaId), tipoActivoId: aEntero(query.tipoActivoId), dias: config.ventana_duplicados_dias
    });
    return { similares: filas.map(f => ({ id: f.id, correlativo: f.correlativo, titulo: f.titulo, creadaEn: f.creado_en })) };
  }

  // --- Reportar ---

  _campos(datos) {
    const campos = {};
    const tiendaId = aEntero(datos.tiendaId);
    const zonaId = aEntero(datos.zonaId);
    const categoriaId = aEntero(datos.categoriaId);
    const tipoActivoId = datos.tipoActivoId === undefined || datos.tipoActivoId === null || datos.tipoActivoId === '' ? null : aEntero(datos.tipoActivoId);
    const titulo = limpio(datos.titulo);
    const descripcion = limpio(datos.descripcion);
    const activoTexto = limpio(datos.activoTexto) || null;
    if (!tiendaId) campos.tiendaId = 'Elige dónde está el problema.';
    if (!zonaId) campos.zonaId = 'Elige la zona.';
    if (!categoriaId) campos.categoriaId = 'Elige la categoría.';
    if (tipoActivoId === undefined || (datos.tipoActivoId && tipoActivoId === null)) campos.tipoActivoId = 'Elige un activo de la lista o déjalo vacío.';
    if (!titulo) campos.titulo = 'Escribe un título corto.';
    else if (titulo.length > LIMITES.titulo) campos.titulo = `El título admite hasta ${LIMITES.titulo} caracteres.`;
    if (!descripcion) campos.descripcion = 'Cuenta qué pasó.';
    else if (descripcion.length > LIMITES.descripcion) campos.descripcion = `La descripción admite hasta ${LIMITES.descripcion} caracteres.`;
    if (activoTexto && activoTexto.length > LIMITES.activoTexto) campos.activoTexto = `Admite hasta ${LIMITES.activoTexto} caracteres.`;
    if (!IMPACTOS.includes(datos.impacto)) campos.impacto = 'Elige cómo afecta el trabajo.';
    return { campos, valores: { tiendaId, zonaId, categoriaId, tipoActivoId, titulo, descripcion, activoTexto, impacto: datos.impacto } };
  }

  // La prioridad sale del impacto (regla editable) y sube un nivel si el problema se repite en la misma tienda y zona.
  async _prioridad(v, config) {
    const [reglas, prioridades] = await Promise.all([catalogoRepository.reglas(), catalogoRepository.prioridades()]);
    const regla = reglas.find(r => r.impacto === v.impacto);
    let actual = regla ? prioridades.find(p => p.id === regla.prioridad_id) : null;
    if (!actual) throw new ErrorDeNegocio('Falta configurar la prioridad de este impacto. Avisa al administrador.', 409);
    let reincidente = false;
    if (config.subir_nivel_reincidencia && await incidenciaRepository.hayReincidencia({ tiendaId: v.tiendaId, zonaId: v.zonaId, categoriaId: v.categoriaId, dias: config.ventana_duplicados_dias })) {
      reincidente = true;
      const masUrgente = prioridades.filter(p => p.orden < actual.orden).sort((a, b) => b.orden - a.orden)[0];
      if (masUrgente) actual = masUrgente;
    }
    return { prioridad: actual, reincidente, masUrgenteOrden: prioridades.length ? prioridades[0].orden : actual.orden };
  }

  async crear(usuario, datos, files, { idempotencyKey } = {}) {
    if (!alcance.tiene(usuario, PERMISO.REPORTAR)) throw sinPermiso('No tienes permiso para reportar incidencias.');
    if (!CLAVE.test(String(idempotencyKey || ''))) throw new ErrorDeNegocio(MENSAJE_SIN_CLAVE, 400);
    const llave = `inc-crear:${usuario.id}:${idempotencyKey}`;
    const previa = await operacionRepository.resultadoDe(llave);
    if (previa && previa.incidenciaId) return { ...(await this.detalle(usuario, previa.incidenciaId)), repetida: true };

    const { campos, valores } = this._campos(datos);
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
    const config = await parametros.valores();
    const tienda = await catalogoRepository.tienda(valores.tiendaId);
    if (!tienda || !tienda.activo) throw errorDeValidacion('Revisa los datos marcados.', { tiendaId: 'Esa tienda ya no está disponible.' });
    if (!tienda.pais_habilitado) throw new ErrorDeNegocio(tienda.pais_aviso || 'Todavía no está disponible en tu país.', 409);
    if (!(await catalogoRepository.zonaValida(valores.zonaId, tienda.id))) throw errorDeValidacion('Revisa los datos marcados.', { zonaId: 'Esa zona no corresponde a la tienda.' });
    const categoria = await catalogoRepository.categoria(valores.categoriaId);
    if (!categoria) throw errorDeValidacion('Revisa los datos marcados.', { categoriaId: 'Esa categoría ya no está disponible.' });
    if (valores.tipoActivoId && !(await catalogoRepository.tipoValido(valores.tipoActivoId, categoria.id))) throw errorDeValidacion('Revisa los datos marcados.', { tipoActivoId: 'Ese activo no corresponde a la categoría.' });
    fotoService.validar(files, { min: 1, max: config.fotos_por_reporte, minimoMensaje: 'Agrega al menos una foto del problema.' });
    if (await incidenciaRepository.reportesRecientes(usuario.id) >= config.reportes_por_usuario) {
      throw new ErrorDeNegocio('Llegaste al máximo de reportes de las últimas 24 horas. Inténtalo más tarde o avisa a tu supervisor.', 429);
    }
    const { prioridad, reincidente, masUrgenteOrden } = await this._prioridad(valores, config);

    const urls = await fotoService.subir(files);
    let id;
    let correlativo;
    try {
      await db.transaccion(async (tx) => {
        id = await incidenciaRepository.insertar(tx, { ...valores, prioridadId: prioridad.id, reincidente, reportadaPor: usuario.id });
        correlativo = await incidenciaRepository.fijarCorrelativo(tx, id);
        const apertura = await incidenciaRepository.insertarEvento(tx, {
          incidenciaId: id, tipo: EVENTO.APERTURA, usuarioId: usuario.id,
          texto: `Reportó la incidencia con ${urls.length} foto${urls.length === 1 ? '' : 's'} desde ${tienda.codigo}.`,
          datos: { prioridad: prioridad.codigo, impacto: valores.impacto, reincidente }
        });
        await incidenciaRepository.insertarFotos(tx, id, apertura, 'reporte', urls, usuario.id);
        await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.BUZON, usuarioId: null, texto: 'Cayó al buzón: los técnicos que cubren la tienda ya pueden tomarla.' });
        await operacionRepository.registrar(tx, llave, 'incidencias.crear', { incidenciaId: id });
      });
    } catch (error) {
      await fotoService.descartar(urls);
      if (error && error.code === 'ER_DUP_ENTRY') {
        const ganadora = await operacionRepository.resultadoDe(llave);
        if (ganadora && ganadora.incidenciaId) return { ...(await this.detalle(usuario, ganadora.incidenciaId)), repetida: true };
      }
      throw error;
    }

    const tecnicos = await this._tecnicosParaAvisar({ tienda_id: tienda.id, especialidad_id: categoria.especialidad_id });
    await avisos.cambio({
      incidencia: { id }, actorId: usuario.id, tipo: 'incidencia_nueva', destinatarios: tecnicos, involucrados: [usuario.id],
      nivel: prioridad.orden <= masUrgenteOrden ? 'alerta' : 'info',
      mensaje: `Nueva incidencia ${correlativo} · ${prioridad.codigo} ${prioridad.nombre}: «${valores.titulo}» en ${tienda.codigo}.`
    });
    return { ...(await this.detalle(usuario, id)), repetida: false };
  }

  // Los técnicos con la especialidad de la categoría; si ninguno la tiene, todos los que cubren la tienda.
  async _tecnicosParaAvisar(inc) {
    const conEspecialidad = inc.especialidad_id ? await personal.tecnicosDeLaTienda(inc.tienda_id, inc.especialidad_id) : [];
    return conEspecialidad.length ? conEspecialidad : personal.tecnicosDeLaTienda(inc.tienda_id);
  }

  // --- Listados ---

  _permisoDeVista(usuario, vista) {
    const t = (p) => alcance.tiene(usuario, p);
    switch (vista) {
      case 'reportadas': return t(PERMISO.VER);
      case 'buzon': case 'tecnico': return t(PERMISO.RESOLVER);
      case 'verificar': return t(PERMISO.VERIFICAR);
      case 'tiendas': return t(PERMISO.VERIFICAR) || t(PERMISO.ASIGNAR);
      case 'todas': return t(PERMISO.VER_TODAS);
      default: return false;
    }
  }

  async listar(usuario, query = {}) {
    const vista = String(query.vista || 'reportadas');
    if (!VISTAS.includes(vista)) throw errorDeValidacion('Revisa los datos.', { vista: 'Esa lista no existe.' });
    if (!this._permisoDeVista(usuario, vista)) throw sinPermiso('No tienes permiso para ver esta lista.');
    const filtros = {};
    if (query.estado) {
      const pedidos = String(query.estado).split(',').map(s => s.trim()).filter(Boolean);
      const validos = Object.values(ESTADOS);
      if (pedidos.some(e => !(e === 'abiertas' || validos.includes(e)))) throw errorDeValidacion('Revisa los datos.', { estado: 'Ese estado no existe.' });
      filtros.estados = [...new Set(pedidos.flatMap(e => (e === 'abiertas' ? ABIERTOS : [e])))];
    }
    if (query.prioridadId) { filtros.prioridadId = aEntero(query.prioridadId); if (!filtros.prioridadId) throw errorDeValidacion('Revisa los datos.', { prioridadId: 'Prioridad inválida.' }); }
    if (query.tiendaId) { filtros.tiendaId = aEntero(query.tiendaId); if (!filtros.tiendaId) throw errorDeValidacion('Revisa los datos.', { tiendaId: 'Tienda inválida.' }); }
    if (query.q) filtros.q = limpio(query.q).slice(0, 60);
    const limite = Math.min(Math.max(aEntero(query.limite) || 20, 1), 50);
    const pagina = Math.max(aEntero(query.pagina) || 1, 1);
    const [filas, total, config, especialidades] = await Promise.all([
      incidenciaRepository.listar(vista, usuario.id, filtros, { limite, desplazamiento: (pagina - 1) * limite }),
      incidenciaRepository.contar(vista, usuario.id, filtros),
      parametros.valores(),
      vista === 'buzon' ? personal.especialidadesDe(usuario.id) : Promise.resolve([])
    ]);
    const ahora = Date.now();
    const items = filas.map(f => {
      const base = aResumen(f);
      base.miniatura = f.miniatura || null;
      base.ultimoMovimientoEn = f.ultimo_movimiento_en;
      const ultimo = f.ultimo_movimiento_en ? new Date(f.ultimo_movimiento_en).getTime() : new Date(f.creado_en).getTime();
      base.sinAvance = EN_TRABAJO.includes(f.estado) && (ahora - ultimo) > config.dias_sin_avance * 86400000;
      if (vista === 'buzon') base.especialidad = !f.especialidad_id || especialidades.includes(f.especialidad_id) ? 'tuya' : 'otra';
      return base;
    });
    return { vista, items, total, pagina, limite, hayMas: pagina * limite < total };
  }

  // Los números de las pestañas y de las tarjetas de arriba, según lo que puede ver cada persona.
  async resumen(usuario) {
    const config = await parametros.valores();
    const salida = {};
    const cuenta = (vista, filtros) => incidenciaRepository.contar(vista, usuario.id, filtros);
    salida.reportadas = { abiertas: await cuenta('reportadas', { estados: ABIERTOS }), enProceso: await cuenta('reportadas', { estados: [ESTADOS.EN_PROCESO, ESTADOS.CORRECCION_PEDIDA, ESTADOS.EN_ESPERA] }),
      enVerificacion: await cuenta('reportadas', { estados: [ESTADOS.EN_VERIFICACION] }), cerradas: await cuenta('reportadas', { estados: [ESTADOS.CERRADA] }) };
    if (this._permisoDeVista(usuario, 'buzon')) {
      const b = await incidenciaRepository.resumenBuzon(usuario.id);
      salida.buzon = { total: b.total, criticas: b.criticas, critica: b.critica && { id: b.critica.id, correlativo: b.critica.correlativo, titulo: b.critica.titulo, creadaEn: b.critica.creado_en },
        masAntigua: b.masAntigua && { id: b.masAntigua.id, correlativo: b.masAntigua.correlativo, titulo: b.masAntigua.titulo, creadaEn: b.masAntigua.creado_en } };
      salida.tecnico = {
        mias: await cuenta('tecnico', { estados: [ESTADOS.EN_PROCESO, ESTADOS.CORRECCION_PEDIDA] }),
        enEspera: await cuenta('tecnico', { estados: [ESTADOS.EN_ESPERA] }),
        enVerificacion: await cuenta('tecnico', { estados: [ESTADOS.EN_VERIFICACION] }),
        cerradas: await cuenta('tecnico', { estados: [ESTADOS.CERRADA] }),
        sinAvance: await incidenciaRepository.contarSinAvance(usuario.id, config.dias_sin_avance)
      };
    }
    if (this._permisoDeVista(usuario, 'tiendas')) {
      salida.tiendas = { abiertas: await cuenta('tiendas', { estados: ABIERTOS }), enBuzon: await cuenta('tiendas', { estados: [ESTADOS.EN_BUZON] }),
        enProceso: await cuenta('tiendas', { estados: [ESTADOS.EN_PROCESO, ESTADOS.CORRECCION_PEDIDA] }), enEspera: await cuenta('tiendas', { estados: [ESTADOS.EN_ESPERA] }) };
    }
    if (this._permisoDeVista(usuario, 'verificar')) salida.verificar = { pendientes: await cuenta('verificar') };
    if (this._permisoDeVista(usuario, 'todas')) salida.todas = { abiertas: await cuenta('todas', { estados: ABIERTOS }), total: await cuenta('todas') };
    return salida;
  }

  // --- Detalle ---

  async detalle(usuario, id) {
    const inc = await incidenciaRepository.obtener(id);
    if (!inc) throw noEncontrada();
    const rel = await alcance.relacion(usuario, inc);
    if (!alcance.puedeVer(rel, inc)) throw noEncontrada();
    const acciones = alcance.acciones(usuario, rel, inc);
    const [eventos, fotos, verificadores] = await Promise.all([incidenciaRepository.eventos(id), incidenciaRepository.fotos(id), personal.verificadoresDe(inc.tienda_id)]);
    // Quien solo reportó no ve los comentarios internos ni lo que se anotó como interno.
    const soloReportante = rel.esReportante && !rel.esResponsable && !rel.verificaConPermiso && !rel.lectura && !rel.cubre;
    const visibles = soloReportante ? eventos.filter(e => e.visible_reportante) : eventos;
    const fotosPorEvento = new Map();
    for (const f of fotos) { if (!fotosPorEvento.has(f.evento_id)) fotosPorEvento.set(f.evento_id, []); fotosPorEvento.get(f.evento_id).push({ id: f.id, url: f.url, etapa: f.etapa }); }
    const opciones = {};
    if (acciones.espera) opciones.motivosEspera = await catalogoRepository.motivosEspera();
    if (acciones.reasignar) opciones.tecnicos = await personal.tecnicosParaReasignar(inc.tienda_id);
    if (acciones.cambiarPrioridad) opciones.prioridades = await catalogoRepository.prioridades();
    return {
      incidencia: {
        ...aResumen(inc),
        descripcion: inc.descripcion,
        departamento: inc.departamento,
        duplicadaDe: inc.duplicada_de,
        fotos: fotos.filter(f => f.etapa === 'reporte').map(f => ({ id: f.id, url: f.url })),
        verifica: soloReportante ? verificadores.personas.map(p => ({ nombre: p.nombre })) : verificadores.personas.map(p => ({ id: p.id, nombre: p.nombre })),
        origenVerificador: verificadores.origen
      },
      eventos: visibles.map(e => ({
        id: e.id, tipo: e.tipo, usuario: e.usuario_id ? { id: e.usuario_id, nombre: e.usuario } : null, texto: e.texto, evolucion: e.evolucion,
        ronda: e.ronda, datos: typeof e.datos === 'string' ? JSON.parse(e.datos) : e.datos, creadoEn: e.creado_en, fotos: fotosPorEvento.get(e.id) || []
      })),
      acciones,
      opciones,
      relacion: { reportante: rel.esReportante, responsable: rel.esResponsable, soloConsulta: rel.lectura && !rel.esResponsable && !rel.verificaConPermiso && !rel.esReportante }
    };
  }
}

module.exports = new IncidenciaService();
module.exports.aResumen = aResumen;
