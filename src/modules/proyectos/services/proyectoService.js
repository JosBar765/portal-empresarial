// src/modules/proyectos/services/proyectoService.js
// Proyectos del mes: crear y editar el borrador, vista previa del reparto, activar (reparte en una transacción) y cancelar.
// El reparto lo calcula `repartoService.js`; aquí solo se arman sus datos, se valida el alcance y se guarda el resultado.
const db = require('../../../config/database');
const proyectoRepository = require('../repositories/proyectoRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const configService = require('./configService');
const avisosService = require('./avisosService');
const avisosRepository = require('../repositories/avisosRepository');
const plantillaService = require('./plantillaService');
const planService = require('./planService');
const plantillaRepository = require('../repositories/plantillaRepository');
const reparto = require('../repartoService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');
const { esFechaReal } = require('../fechas');
const { definicion } = require('../catalogos');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MAX_ETAPAS = 12;

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const exigir = (usuario, permiso, mensaje) => { if (!tiene(usuario, permiso)) throw new ErrorDeNegocio(mensaje, 403); };
const noExiste = () => new ErrorDeNegocio('Ese proyecto no existe o no es de tus tiendas.', 404);
const limpio = (v) => String(v == null ? '' : v).trim();
const quitarAcentos = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
const alcanceDe = (usuario) => ({
  todos: tiene(usuario, 'proyectos.administrar') || tiene(usuario, 'proyectos.ver_gerencia') || tiene(usuario, 'proyectos.aprobar_activacion'), usuarioId: usuario.id
});

// «2026-11-27» → «27 nov» (las fechas llegan como texto AAAA-MM-DD, en la hora de Guatemala).
function fechaCorta(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha || ''));
  return m ? `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]}` : '';
}

const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

// Suma días hábiles (lunes a viernes) a una fecha AAAA-MM-DD.
function sumarDiasHabiles(fecha, dias) {
  const d = new Date(`${String(fecha).slice(0, 10)}T00:00:00Z`);
  let faltan = dias;
  while (faltan > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) faltan -= 1;
  }
  return d.toISOString().slice(0, 10);
}

const proximoHabil = (fecha) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Las fechas de cada etapa de una plantilla a partir de la fecha de inicio: una tras otra, en días hábiles.
function calendarioDeEtapas(inicio, etapas) {
  let desde = proximoHabil(inicio);
  return etapas.map((e) => {
    const fin = sumarDiasHabiles(desde, e.duracionDiasHabiles - 1);
    const fila = { inicio: desde, fin };
    desde = proximoHabil(sumarDiasHabiles(fin, 1));
    return fila;
  });
}

const mismoValor = (a, b) => (Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && String(a) !== '' && String(b) !== '' ? Number(a) === Number(b) : String(a == null ? '' : a) === String(b == null ? '' : b));

const esDuplicado = (error, indice) => Boolean(error) && error.code === 'ER_DUP_ENTRY' && String(error.sqlMessage || error.message).includes(indice);

function fechaOpcional(valor, campo, campos) {
  const f = limpio(valor);
  if (!f) return null;
  if (!esFechaReal(f)) { campos[campo] = 'Escribe la fecha como AAAA-MM-DD.'; return null; }
  return f;
}

class ProyectoService {
  // --- Lectura ---

  async opciones(usuario) {
    exigir(usuario, 'proyectos.activar', 'No tienes permiso para crear proyectos.');
    const todas = tiene(usuario, 'proyectos.administrar');
    const [nichos, articulos, monedas, tiendas, ajustes, plantillas, plan] = await Promise.all([
      catalogoRepository.listar(definicion('nichos')), catalogoRepository.listar(definicion('articulos')), catalogoRepository.listar(definicion('monedas')),
      proyectoRepository.tiendasPosibles({ todas, usuarioId: usuario.id }), configService.valores(), plantillaService.activas(), planService.sugerencias()
    ]);
    const activas = (filas) => filas.filter(f => f.activo || f.activa).map(f => ({ id: f.id, nombre: f.nombre, codigo: f.codigo, simbolo: f.simbolo }));
    const elegibles = await proyectoRepository.contarElegiblesPorNicho({ paisIds: [...new Set(tiendas.map(t => t.pais_id))], descansoMeses: ajustes['reparto.descanso_meses'] });
    return {
      nichos: activas(nichos).map(n => ({ ...n, empresas: elegibles.get(n.id) || 0 })), articulos: activas(articulos), monedas: activas(monedas),
      tiendas: tiendas.map(t => ({
        id: t.id, codigo: t.codigo, empresa: t.empresa, paisId: t.pais_id, pais: t.pais,
        ocupada: t.ocupada_por_id ? { proyectoId: t.ocupada_por_id, proyecto: t.ocupada_por, fin: t.ocupada_fin } : null
      })),
      plantillas, plan, todasLasTiendas: todas,
      ajustes: { codigoFormato: ajustes['codigo.formato'], topePorAsesor: ajustes['reparto.tope_por_asesor'], recibenSupervisores: ajustes['reparto.reciben_supervisores'], aprobarActivacion: ajustes['reglas.aprobar_activacion'] },
      permisos: { activar: true, aprobar: tiene(usuario, 'proyectos.aprobar_activacion') }
    };
  }

  // Los asesores (y supervisores, si el ajuste lo permite) de las tiendas elegidas, para el paso 2 del asistente.
  async candidatos(usuario, tiendaIds) {
    exigir(usuario, 'proyectos.activar', 'No tienes permiso para crear proyectos.');
    const campos = {};
    const ids = await this._tiendasPermitidas(usuario, tiendaIds, 0, campos);
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
    const ajustes = await configService.valores();
    const filas = await proyectoRepository.candidatos(ids, { conSupervisores: ajustes['reparto.reciben_supervisores'] });
    return filas.map(f => ({ usuarioId: f.usuario_id, nombre: f.nombre, tiendaId: f.tienda_id, tienda: f.tienda, paisId: f.pais_id, pais: f.pais, tipo: f.tipo }));
  }

  async _marcarVencidos(filas) {
    const vivo = (await configService.valores())['vencimiento.gracia_dias_habiles'];
    const dia = hoy();
    // Un proyecto ya activo usa los días de gracia que tenía al activarse (su foto de configuración), no los de hoy.
    return filas.map((f) => {
      const gracia = f.config_snapshot && f.config_snapshot.parametros && f.config_snapshot.parametros['vencimiento.gracia_dias_habiles'] !== undefined
        ? f.config_snapshot.parametros['vencimiento.gracia_dias_habiles'] : vivo;
      return { ...f, vencido: f.estado === 'activo' && Boolean(f.fecha_fin) && sumarDiasHabiles(f.fecha_fin, gracia) < dia };
    });
  }

  _aItem(f) {
    return {
      id: f.id, codigo: f.codigo, nombre: f.nombre, nichoId: f.nicho_id, nicho: f.nicho, anio: f.anio, mes: f.mes, mesTexto: `${MESES[f.mes - 1]} ${f.anio}`,
      estado: f.estado, vencido: Boolean(f.vencido), fechaInicio: f.fecha_inicio, fechaFin: f.fecha_fin, tiendas: Number(f.tiendas || 0),
      asesores: Number(f.asesores || 0), empresas: Number(f.empresas || 0), creadoPor: f.creado_por_nombre, creadoEn: f.creado_en
    };
  }

  async listar(usuario, consulta = {}) {
    const alcance = alcanceDe(usuario);
    const anio = aEntero(consulta.anio);
    const todos = await this._marcarVencidos(await proyectoRepository.listar({ anio, alcance }));
    const grupos = {
      todos: todos, activos: todos.filter(p => p.estado === 'activo' && !p.vencido), vencidos: todos.filter(p => p.vencido),
      aprobacion: todos.filter(p => p.estado === 'pendiente_aprobacion'), cerrados: todos.filter(p => p.estado === 'cerrado'), borradores: todos.filter(p => p.estado === 'borrador'), cancelados: todos.filter(p => p.estado === 'cancelado')
    };
    const filtro = Object.prototype.hasOwnProperty.call(grupos, consulta.estado) ? consulta.estado : 'todos';
    const visibles = grupos[filtro].filter(p => filtro !== 'todos' || p.estado !== 'cancelado');
    return {
      items: visibles.map(f => this._aItem(f)),
      conteos: Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, k === 'todos' ? v.filter(p => p.estado !== 'cancelado').length : v.length])),
      anios: [...new Set(todos.map(p => p.anio))].sort((a, b) => b - a),
      vencidos: grupos.vencidos.map(p => ({ id: p.id, nombre: p.nombre, fechaFin: p.fecha_fin }))
    };
  }

  async obtener(usuario, id) {
    const proyectoId = aEntero(id);
    const fila = proyectoId === null ? null : await proyectoRepository.obtener(proyectoId, alcanceDe(usuario));
    if (!fila) throw noExiste();
    const [tiendas, participantes, etapas] = await Promise.all([
      proyectoRepository.tiendasDe(fila.id), proyectoRepository.participantesDe(fila.id), proyectoRepository.etapasDe(fila.id)
    ]);
    const [marcado] = await this._marcarVencidos([fila]);
    const resumen = fila.estado === 'borrador' || fila.estado === 'pendiente_aprobacion' ? [] : await proyectoRepository.resumenReparto(fila.id);
    return {
      ...this._aItem({ ...marcado, tiendas: tiendas.length, asesores: participantes.filter(p => p.estado === 'activo').length, empresas: resumen.reduce((s, r) => s + Number(r.empresas), 0) }),
      articuloId: fila.articulo_id, articulo: fila.articulo, existenciaMuestras: fila.existencia_muestras, plantillaId: fila.plantilla_id,
      metaMonto: fila.meta_monto === null ? null : Number(fila.meta_monto), metaMoneda: fila.meta_moneda, topePorAsesor: fila.tope_por_asesor,
      activadoEn: fila.activado_en, aprobacionPedidaEn: fila.aprobacion_pedida_en, aprobacionPedidaPor: fila.aprobacion_pedida_por_nombre, aprobadaEn: fila.aprobada_en, aprobacionComentario: fila.aprobacion_comentario,
      fotoConfiguracion: fila.config_snapshot ? { plantilla: fila.config_snapshot.plantilla ? fila.config_snapshot.plantilla.nombre : null, creadaEn: fila.config_snapshot.creadaEn } : null,
      tiendas: tiendas.map(t => ({ id: t.id, codigo: t.codigo, empresa: t.empresa, paisId: t.pais_id, pais: t.pais })),
      participantes: participantes.map(p => ({ usuarioId: p.usuario_id, nombre: p.nombre, tiendaId: p.tienda_id, tienda: p.tienda, paisId: p.pais_id, pais: p.pais, estado: p.estado, motivo: p.motivo })),
      etapas: etapas.map(e => ({ orden: e.orden, nombre: e.nombre, descripcion: e.descripcion, fechaInicio: e.fecha_inicio, fechaFin: e.fecha_fin })),
      reparto: resumen.map(r => ({ asesorId: r.asesor_id, asesor: r.asesor, tiendaId: r.tienda_id, tienda: r.tienda, empresas: Number(r.empresas) }))
    };
  }

  // --- Validación ---

  // Las tiendas pedidas deben ser del alcance de quien las pide y no estar ocupadas por otro proyecto activo.
  async _tiendasPermitidas(usuario, pedidas, proyectoId, campos) {
    const crudas = Array.isArray(pedidas) ? pedidas : [];
    const ids = [...new Set(crudas.map(aEntero))];
    if (ids.some(i => i === null)) { campos.tiendaIds = 'Elige tiendas de la lista.'; return []; }
    if (!ids.length) return [];
    const posibles = await proyectoRepository.tiendasPosibles({ todas: tiene(usuario, 'proyectos.administrar'), usuarioId: usuario.id });
    const visibles = new Set(posibles.map(t => t.id));
    if (ids.some(i => !visibles.has(i))) { campos.tiendaIds = 'Solo puedes incluir tiendas que supervisas.'; return []; }
    const ocupadas = await proyectoRepository.tiendasOcupadas(ids, proyectoId);
    if (ocupadas.length) {
      const o = ocupadas[0];
      campos.tiendaIds = `${o.codigo} no se puede incluir: ya está en «${o.proyecto}»${o.fecha_fin ? ` (termina el ${fechaCorta(o.fecha_fin)})` : ''}. Una tienda, un proyecto activo a la vez.`;
      return [];
    }
    return ids;
  }

  async _validar(usuario, datosCrudos, proyectoId, { completo = false } = {}) {
    const campos = {};
    const { datos, plantilla } = await this._conPlantilla(datosCrudos, campos);
    const nicho = await this._catalogoActivo('nichos', datos.nichoId);
    if (!nicho) campos.nichoId = 'Elige un nicho de la lista.';
    const anio = aEntero(datos.anio);
    const mes = aEntero(datos.mes);
    if (anio === null || anio < 2020 || anio > 2100) campos.anio = 'Escribe un año entre 2020 y 2100.';
    if (mes === null || mes < 1 || mes > 12) campos.mes = 'Elige el mes.';

    const nombreLibre = limpio(datos.nombre);
    if (nombreLibre.length > 150) campos.nombre = 'Máximo 150 caracteres.';
    const nombre = nombreLibre || (nicho && mes && anio ? `${nicho.nombre} · ${MESES[mes - 1]} ${anio}` : '');

    const tiendaIds = await this._tiendasPermitidas(usuario, datos.tiendaIds, proyectoId, campos);
    if (completo && !tiendaIds.length && !campos.tiendaIds) campos.tiendaIds = 'Elige al menos una tienda.';

    let articuloId = null;
    if (datos.articuloId !== undefined && datos.articuloId !== null && datos.articuloId !== '') {
      const articulo = await this._catalogoActivo('articulos', datos.articuloId);
      if (!articulo) campos.articuloId = 'Elige un artículo de la lista.'; else articuloId = articulo.id;
    }
    let existencia = null;
    if (datos.existenciaMuestras !== undefined && datos.existenciaMuestras !== null && datos.existenciaMuestras !== '') {
      existencia = aEntero(datos.existenciaMuestras);
      if (existencia === null || existencia < 0 || existencia > 1000000) { campos.existenciaMuestras = 'Escribe un número entero desde 0.'; existencia = null; }
    }
    let tope = null;
    if (datos.topePorAsesor !== undefined && datos.topePorAsesor !== null && datos.topePorAsesor !== '') {
      tope = aEntero(datos.topePorAsesor);
      if (tope === null || tope < 1 || tope > 500) { campos.topePorAsesor = 'Escribe un número entre 1 y 500.'; tope = null; }
    }
    let metaMonto = null;
    let metaMoneda = null;
    if (datos.metaMonto !== undefined && datos.metaMonto !== null && datos.metaMonto !== '') {
      metaMonto = Number(String(datos.metaMonto).replace(',', '.'));
      if (!Number.isFinite(metaMonto) || metaMonto < 0 || metaMonto > 1e10) { campos.metaMonto = 'Escribe un monto válido.'; metaMonto = null; }
      const moneda = (await catalogoRepository.listar(definicion('monedas'))).find(m => m.activo && m.codigo === datos.metaMoneda);
      if (!moneda) campos.metaMoneda = 'Elige la moneda de la meta.'; else metaMoneda = moneda.codigo;
    }
    const fechaInicio = fechaOpcional(datos.fechaInicio, 'fechaInicio', campos);
    const fechaFin = fechaOpcional(datos.fechaFin, 'fechaFin', campos);
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) campos.fechaFin = 'La fecha de fin no puede ser anterior a la de inicio.';
    if (completo) {
      if (!fechaInicio && !campos.fechaInicio) campos.fechaInicio = 'Elige la fecha de inicio.';
      if (!fechaFin && !campos.fechaFin) campos.fechaFin = 'Elige la fecha de fin.';
    }

    const etapas = [];
    const crudas = Array.isArray(datos.etapas) ? datos.etapas : [];
    if (crudas.length > MAX_ETAPAS) campos.etapas = `Máximo ${MAX_ETAPAS} etapas.`;
    crudas.slice(0, MAX_ETAPAS).forEach((e, i) => {
      const nombreEtapa = limpio(e && e.nombre);
      if (!nombreEtapa || nombreEtapa.length > 100) campos[`etapas.${i}.nombre`] = 'Escribe el nombre de la etapa (máximo 100 caracteres).';
      const descripcion = limpio(e && e.descripcion);
      if (descripcion.length > 255) campos[`etapas.${i}.descripcion`] = 'Máximo 255 caracteres.';
      etapas.push({ nombre: nombreEtapa, descripcion, fechaInicio: fechaOpcional(e && e.fechaInicio, `etapas.${i}.fechaInicio`, campos), fechaFin: fechaOpcional(e && e.fechaFin, `etapas.${i}.fechaFin`, campos) });
    });

    const excluidos = new Map();
    for (const x of Array.isArray(datos.excluidos) ? datos.excluidos : []) {
      const usuarioId = aEntero(x && x.usuarioId);
      if (usuarioId === null) { campos.excluidos = 'Revisa los asesores excluidos.'; continue; }
      const motivo = limpio(x.motivo);
      if (motivo.length > 255) campos.excluidos = 'El motivo admite hasta 255 caracteres.';
      excluidos.set(usuarioId, motivo);
    }

    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
    return {
      valores: { nombre, nichoId: nicho.id, nichoNombre: nicho.nombre, anio, mes, articuloId, existenciaMuestras: existencia, plantillaId: plantilla ? plantilla.id : null, metaMonto, metaMoneda, fechaInicio, fechaFin, topePorAsesor: tope },
      tiendaIds, etapas, excluidos
    };
  }

  // Aplica la plantilla elegida: completa lo que no se mandó con sus valores y respeta lo que el administrador bloqueó.
  async _conPlantilla(datos, campos) {
    if (datos.plantillaId === undefined || datos.plantillaId === null || datos.plantillaId === '') return { datos, plantilla: null };
    const plantilla = await plantillaService.paraAplicar(datos.plantillaId);
    if (!plantilla) { campos.plantillaId = 'Elige una plantilla activa de la lista.'; return { datos, plantilla: null }; }
    const salida = { ...datos };
    const ausente = (k) => !Object.prototype.hasOwnProperty.call(datos, k) || datos[k] === undefined;
    const fijar = (control, pares) => {
      const bloqueado = plantilla.controles[control] === 'bloqueado';
      for (const [k, valor] of pares) {
        if (bloqueado) {
          const dado = datos[k];
          if (dado !== undefined && dado !== null && dado !== '' && !mismoValor(dado, valor)) campos[k] = 'Este dato lo fija la plantilla y no se puede cambiar.';
          salida[k] = valor;
        } else if (ausente(k)) salida[k] = valor;
      }
    };
    fijar('articulo', [['articuloId', plantilla.articuloId]]);
    fijar('existencia', [['existenciaMuestras', plantilla.existenciaSugerida]]);
    fijar('meta', [['metaMonto', plantilla.metaMonto], ['metaMoneda', plantilla.metaMoneda]]);
    fijar('tope', [['topePorAsesor', plantilla.topePorAsesor]]);
    if (!Array.isArray(datos.etapas) || !datos.etapas.length) salida.etapas = plantilla.etapas.map(e => ({ nombre: e.nombre, descripcion: e.descripcion }));
    const inicio = limpio(salida.fechaInicio);
    if (esFechaReal(inicio)) {
      const calendario = calendarioDeEtapas(inicio, plantilla.etapas);
      const bloqueadas = plantilla.controles.fechas_etapas === 'bloqueado' || datos.recalcularEtapas === true;
      salida.etapas = salida.etapas.map((e, i) => ({
        ...e, fechaInicio: bloqueadas || !e.fechaInicio ? (calendario[i] || {}).inicio : e.fechaInicio, fechaFin: bloqueadas || !e.fechaFin ? (calendario[i] || {}).fin : e.fechaFin
      }));
      if ((!limpio(salida.fechaFin) || datos.recalcularEtapas === true) && calendario.length) salida.fechaFin = calendario[calendario.length - 1].fin;
    }
    return { datos: salida, plantilla };
  }

  async _catalogoActivo(id, valor) {
    const n = aEntero(valor);
    if (n === null) return null;
    const fila = await catalogoRepository.obtener(definicion(id), n);
    return fila && fila.activo ? fila : null;
  }

  // Código del proyecto con `codigo.formato`: {AAAA} año, {MM} mes, {NICHO} iniciales del nicho y {N} número. Nunca se repite.
  async _codigo({ anio, mes, nichoNombre }, ejecutor) {
    const formato = (await configService.valores())['codigo.formato'];
    const iniciales = quitarAcentos(nichoNombre).split(/\s+/)[0].slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GEN';
    const base = formato.replace('{AAAA}', anio).replace('{MM}', String(mes).padStart(2, '0')).replace('{NICHO}', iniciales);
    const corte = base.indexOf('{N}');
    const existentes = await proyectoRepository.codigosCon(corte >= 0 ? base.slice(0, corte) : base, ejecutor);
    if (corte >= 0) {
      for (let n = 1; n < 1000; n += 1) { const c = base.replace('{N}', String(n).padStart(2, '0')); if (!existentes.has(c)) return c; }
    }
    if (!existentes.has(base)) return base;
    for (let n = 2; n < 1000; n += 1) { if (!existentes.has(`${base}-${n}`)) return `${base}-${n}`; }
    throw new ErrorDeNegocio('No se pudo generar un código libre para el proyecto.', 409);
  }

  // Los participantes del borrador: los candidatos de las tiendas elegidas, con los excluidos marcados.
  async _filasDeParticipantes(tiendaIds, excluidos, ejecutor) {
    const ajustes = await configService.valores();
    const candidatos = await proyectoRepository.candidatos(tiendaIds, { conSupervisores: ajustes['reparto.reciben_supervisores'] }, ejecutor);
    return candidatos.map(c => ({
      usuarioId: c.usuario_id, tiendaId: c.tienda_id, estado: excluidos.has(c.usuario_id) ? 'excluido' : 'activo', motivo: excluidos.get(c.usuario_id) || null
    }));
  }

  // --- Borrador ---

  async crear(usuario, datos) {
    exigir(usuario, 'proyectos.activar', 'No tienes permiso para crear proyectos.');
    const { valores, tiendaIds, etapas, excluidos } = await this._validar(usuario, datos, 0);
    for (let intento = 0; ; intento += 1) {
      try {
        const id = await db.transaccion(async (tx) => {
          const codigo = await this._codigo(valores, tx);
          const nuevo = await proyectoRepository.insertar(tx, { ...valores, codigo, creadoPor: usuario.id });
          await proyectoRepository.reemplazarTiendas(tx, nuevo, tiendaIds);
          await proyectoRepository.reemplazarParticipantes(tx, nuevo, await this._filasDeParticipantes(tiendaIds, excluidos, tx));
          await proyectoRepository.reemplazarEtapas(tx, nuevo, etapas);
          await proyectoRepository.registrarHistorial(tx, { proyectoId: nuevo, usuarioId: usuario.id, accion: 'crear', detalle: { codigo } });
          return nuevo;
        });
        return this.obtener(usuario, id);
      } catch (error) {
        if (intento === 0 && esDuplicado(error, 'codigo')) continue; // otro proyecto tomó el mismo código a la vez: se genera de nuevo
        throw error;
      }
    }
  }

  async editar(usuario, id, datos) {
    exigir(usuario, 'proyectos.activar', 'No tienes permiso para editar proyectos.');
    const actual = await this.obtener(usuario, id);
    if (actual.estado !== 'borrador') throw new ErrorDeNegocio('Solo se puede editar un proyecto en borrador.', 409);
    const mezcla = {
      nombre: actual.nombre, nichoId: actual.nichoId, anio: actual.anio, mes: actual.mes, tiendaIds: actual.tiendas.map(t => t.id), articuloId: actual.articuloId,
      existenciaMuestras: actual.existenciaMuestras, plantillaId: actual.plantillaId, metaMonto: actual.metaMonto, metaMoneda: actual.metaMoneda,
      fechaInicio: actual.fechaInicio, fechaFin: actual.fechaFin, topePorAsesor: actual.topePorAsesor, etapas: actual.etapas,
      excluidos: actual.participantes.filter(p => p.estado === 'excluido').map(p => ({ usuarioId: p.usuarioId, motivo: p.motivo })), ...datos
    };
    const { valores, tiendaIds, etapas, excluidos } = await this._validar(usuario, mezcla, actual.id);
    await db.transaccion(async (tx) => {
      const cambioDeCodigo = valores.nichoId !== actual.nichoId || valores.anio !== actual.anio || valores.mes !== actual.mes;
      const filas = await proyectoRepository.actualizar(tx, actual.id, valores);
      if (filas.affectedRows !== 1) throw new ErrorDeNegocio('Este proyecto ya no está en borrador.', 409);
      if (cambioDeCodigo) await tx.query('UPDATE proy_proyectos SET codigo = ? WHERE id = ?', [await this._codigo(valores, tx), actual.id], 'proyectos_proyecto:codigo');
      await proyectoRepository.reemplazarTiendas(tx, actual.id, tiendaIds);
      await proyectoRepository.reemplazarParticipantes(tx, actual.id, await this._filasDeParticipantes(tiendaIds, excluidos, tx));
      await proyectoRepository.reemplazarEtapas(tx, actual.id, etapas);
    });
    return this.obtener(usuario, actual.id);
  }

  // --- Reparto ---

  // Arma los datos del reparto de un borrador y lo calcula. La vista previa y la activación usan esta misma función.
  async _calcular(proyecto, { bloquear = false, ejecutor = db } = {}) {
    const ajustes = await configService.valores();
    const tiendas = await proyectoRepository.tiendasDe(proyecto.id, ejecutor);
    const participantes = await proyectoRepository.participantesDe(proyecto.id, ejecutor);
    const paisIds = [...new Set(tiendas.map(t => t.pais_id))];
    const asesores = participantes.filter(p => p.estado === 'activo').map(p => ({ id: p.usuario_id, paisId: p.pais_id, tiendaId: p.tienda_id }));
    const elegibles = await proyectoRepository.elegibles({ nichoId: proyecto.nicho_id, paisIds, descansoMeses: ajustes['reparto.descanso_meses'], bloquear }, ejecutor);
    const tope = proyecto.tope_por_asesor === null || proyecto.tope_por_asesor === undefined ? ajustes['reparto.tope_por_asesor'] : proyecto.tope_por_asesor;
    const resultado = reparto.calcular({
      empresas: elegibles.map(e => ({ id: e.id, paisId: e.pais_id, tiendaOrigenId: e.tienda_origen_id })), asesores, tope, afinidad: ajustes['reparto.afinidad_tienda']
    });
    return { resultado, asesores, participantes, tiendas, elegibles, tope };
  }

  async vistaPrevia(usuario, id) {
    if (!tiene(usuario, 'proyectos.activar') && !tiene(usuario, 'proyectos.aprobar_activacion')) throw new ErrorDeNegocio('No tienes permiso para ver la vista previa.', 403);
    const proyecto = await this.obtener(usuario, id);
    if (!['borrador', 'pendiente_aprobacion'].includes(proyecto.estado)) throw new ErrorDeNegocio('El reparto de este proyecto ya se hizo.', 409);
    const fila = await proyectoRepository.obtener(proyecto.id, null);
    const { resultado, participantes, tiendas, elegibles, tope, asesores } = await this._calcular(fila);
    const nombre = new Map(participantes.map(p => [p.usuario_id, p]));
    const porAsesor = participantes.filter(p => p.estado === 'activo').map(p => ({
      usuarioId: p.usuario_id, nombre: p.nombre, tiendaId: p.tienda_id, tienda: p.tienda, paisId: p.pais_id, pais: p.pais, empresas: resultado.porAsesor.get(p.usuario_id) || 0
    }));
    const porTienda = tiendas.map(t => ({ tiendaId: t.id, tienda: t.codigo, empresas: porAsesor.filter(a => a.tiendaId === t.id).reduce((s, a) => s + a.empresas, 0) }));
    const paisPorEmpresa = new Map(elegibles.map(e => [e.id, e.pais_id]));
    const nombrePais = new Map(tiendas.map(t => [t.pais_id, t.pais]));
    const sinAsesorPorPais = new Map();
    resultado.sinAsesor.forEach(cid => sinAsesorPorPais.set(paisPorEmpresa.get(cid), (sinAsesorPorPais.get(paisPorEmpresa.get(cid)) || 0) + 1));
    return {
      totalEmpresas: elegibles.length, asignadas: resultado.asignaciones.length, reserva: resultado.reserva.length, sinAsesor: resultado.sinAsesor.length,
      sinAsesorPorPais: [...sinAsesorPorPais.entries()].map(([paisId, cantidad]) => ({ paisId, pais: nombrePais.get(paisId), cantidad })),
      porAsesor, porTienda, topeAplicado: tope, diferenciaMaxima: reparto.diferenciaMaxima(asesores, resultado.porAsesor),
      excluidos: participantes.filter(p => p.estado === 'excluido').map(p => ({ usuarioId: p.usuario_id, nombre: nombre.get(p.usuario_id).nombre, motivo: p.motivo }))
    };
  }

  // --- Activar ---

  // La foto de la configuración al activar: así lo que el administrador cambie después solo aplica a proyectos nuevos.
  async _foto(proyecto, plantilla) {
    const [parametros, paises] = await Promise.all([configService.valores(), configService.paises()]);
    const idsPais = new Set(proyecto.tiendas.map(t => t.paisId));
    return {
      version: 1, creadaEn: new Date().toISOString(), parametros, paises: paises.filter(p => idsPais.has(p.paisId)),
      plantilla: plantilla ? { id: plantilla.id, nombre: plantilla.nombre, duracionSemanas: plantilla.duracionSemanas, controles: plantilla.controles, etapas: plantilla.etapas } : null
    };
  }

  // Activar es idempotente (`idempotencyKey`) y atómico: el UPDATE compara el estado de partida, las tiendas y las empresas
  // las protegen los índices únicos de la base y, ante un conflicto, se dice qué tienda o empresa lo causó.
  async activar(usuario, id, { idempotencyKey } = {}) {
    exigir(usuario, 'proyectos.activar', 'No tienes permiso para activar proyectos.');
    const ajustes = await configService.valores();
    if (ajustes['reglas.aprobar_activacion']) throw new ErrorDeNegocio('Este proyecto necesita la aprobación del gerente antes de activarse: pídela primero.', 409);
    return this._activacion(usuario, id, { idempotencyKey, desde: 'borrador', prefijo: 'proy-activar', extra: {}, accion: 'activar' });
  }

  async _activacion(usuario, id, { idempotencyKey, desde, prefijo, extra, accion }) {
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(idempotencyKey || ''))) throw new ErrorDeNegocio('Falta la clave de la operación. Recarga la página e inténtalo de nuevo.', 400);
    const llave = `${prefijo}:${usuario.id}:${idempotencyKey}`;
    const previo = await db.query('SELECT resultado FROM idempotency_keys WHERE idempotency_key = ?', [llave], 'proyectos_proyecto:clave_previa');
    if (previo[0]) return { ...(await this.obtener(usuario, id)), repetida: true };

    const proyecto = await this.obtener(usuario, id);
    if (proyecto.estado !== desde) throw new ErrorDeNegocio(desde === 'borrador' ? 'Este proyecto ya no está en borrador.' : 'Este proyecto ya no espera aprobación.', 409);
    const plantilla = proyecto.plantillaId ? await plantillaRepository.obtener(proyecto.plantillaId) : null;
    this._exigirCompleto(proyecto, plantilla);
    const foto = await this._foto(proyecto, plantilla);

    try {
      await db.transaccion(async (tx) => {
        // Orden fijo de bloqueo: proyecto → tiendas → empresas → participaciones.
        const bloqueado = await proyectoRepository.obtener(proyecto.id, null, tx);
        await tx.query('SELECT id FROM proy_proyectos WHERE id = ? FOR UPDATE', [proyecto.id], 'proyectos_proyecto:bloquear');
        const cambiado = await proyectoRepository.cambiarEstado(tx, proyecto.id, [desde], 'activo', { ...extra, activado_por: usuario.id, activado_en: new Date(), config_snapshot: JSON.stringify(foto) });
        if (cambiado !== 1) throw new ErrorDeNegocio(desde === 'borrador' ? 'Este proyecto ya no está en borrador.' : 'Este proyecto ya no espera aprobación.', 409);
        await proyectoRepository.abrirTiendas(tx, proyecto.id);
        const { resultado } = await this._calcular(bloqueado, { bloquear: true, ejecutor: tx });
        await proyectoRepository.insertarParticipaciones(tx, proyecto.id, resultado.asignaciones, resultado.reserva);
        await proyectoRepository.registrarHistorial(tx, {
          proyectoId: proyecto.id, usuarioId: usuario.id, accion,
          detalle: { asignadas: resultado.asignaciones.length, reserva: resultado.reserva.length, sinAsesor: resultado.sinAsesor.length }
        });
        // La clave se guarda en la misma transacción: dos activaciones a la vez con la misma clave dejan un solo ganador.
        await tx.query('INSERT INTO idempotency_keys (idempotency_key, endpoint, resultado) VALUES (?, ?, ?)', [llave, `proyectos.${accion}`, JSON.stringify({ proyectoId: proyecto.id })], 'proyectos_proyecto:clave');
      });
    } catch (error) {
      // Otra petición con esta misma clave ya activó el proyecto mientras esta esperaba: se devuelve su resultado.
      const ganada = await db.query('SELECT 1 AS ya FROM idempotency_keys WHERE idempotency_key = ?', [llave], 'proyectos_proyecto:clave_ganadora');
      if (ganada[0]) return { ...(await this.obtener(usuario, id)), repetida: true };
      if (esDuplicado(error, 'uq_proy_tienda_abierta')) {
        const { tiendas } = await proyectoRepository.conflictosDeActivacion(proyecto.id);
        const t = tiendas[0];
        throw new ErrorDeNegocio(t
          ? `${t.tienda} ya está en «${t.proyecto}». Una tienda, un proyecto activo a la vez: quita esa tienda o espera a que ese proyecto cierre.`
          : 'Una de las tiendas ya está en otro proyecto activo.', 409);
      }
      if (esDuplicado(error, 'uq_proy_cliente_abierto')) throw new ErrorDeNegocio('Otro proyecto acaba de tomar algunas de estas empresas. Vuelve a ver la vista previa e inténtalo de nuevo.', 409);
      if (esDuplicado(error, 'idempotency_keys')) return { ...(await this.obtener(usuario, id)), repetida: true };
      throw error;
    }
    const resultado = { ...(await this.obtener(usuario, id)), repetida: false };
    await this._avisarReparto(usuario, resultado);
    return resultado;
  }

  // Cada asesor se entera de cuántas empresas recibió. Un fallo al avisar no deshace la activación.
  async _avisarReparto(usuario, proyecto) {
    try {
      for (const f of await avisosRepository.repartoPorAsesor(proyecto.id)) {
        await avisosService.notificar('reparto_recibido', { proyectoId: proyecto.id, autorId: usuario.id, explicitos: { asesor: [f.asesor_id] }, referenciaTipo: 'proyecto', referenciaId: proyecto.id, mensaje: `Te asignaron ${f.n} ${Number(f.n) === 1 ? 'empresa' : 'empresas'} en «${proyecto.nombre}».` });
      }
    } catch (error) { console.error('[Proyectos] No se pudo avisar del reparto:', error.message); }
  }

  _exigirCompleto(proyecto, plantilla = null) {
    const campos = {};
    if (!proyecto.tiendas.length) campos.tiendaIds = 'Elige al menos una tienda.';
    if (!proyecto.participantes.some(p => p.estado === 'activo')) campos.excluidos = 'Debe participar al menos un asesor.';
    if (!proyecto.fechaInicio) campos.fechaInicio = 'Elige la fecha de inicio.';
    if (!proyecto.fechaFin) campos.fechaFin = 'Elige la fecha de fin.';
    // Lo que la plantilla marcó como obligatorio hay que completarlo antes de activar.
    const controles = (plantilla && plantilla.controles) || {};
    const valores = { articulo: proyecto.articuloId, existencia: proyecto.existenciaMuestras, meta: proyecto.metaMonto, tope: proyecto.topePorAsesor };
    const campoDe = { articulo: 'articuloId', existencia: 'existenciaMuestras', meta: 'metaMonto', tope: 'topePorAsesor' };
    for (const c of Object.keys(valores)) {
      if (controles[c] === 'obligatorio' && (valores[c] === null || valores[c] === undefined)) campos[campoDe[c]] = 'La plantilla pide completar este dato antes de activar.';
    }
    if (Object.keys(campos).length) throw errorDeValidacion('Faltan datos para activar el proyecto.', campos);
  }

  // --- Aprobación del gerente (opcional: reglas.aprobar_activacion) ---

  async pedirAprobacion(usuario, id) {
    exigir(usuario, 'proyectos.activar', 'No tienes permiso para pedir la activación.');
    const ajustes = await configService.valores();
    if (!ajustes['reglas.aprobar_activacion']) throw new ErrorDeNegocio('Este proyecto no necesita aprobación: se activa directamente.', 409);
    const proyecto = await this.obtener(usuario, id);
    if (proyecto.estado !== 'borrador') throw new ErrorDeNegocio('Solo un proyecto en borrador puede pedir aprobación.', 409);
    this._exigirCompleto(proyecto, proyecto.plantillaId ? await plantillaRepository.obtener(proyecto.plantillaId) : null);
    await db.transaccion(async (tx) => {
      const cambiado = await proyectoRepository.cambiarEstado(tx, proyecto.id, ['borrador'], 'pendiente_aprobacion', {
        aprobacion_pedida_por: usuario.id, aprobacion_pedida_en: new Date(), aprobada_por: null, aprobada_en: null, aprobacion_comentario: null
      });
      if (cambiado !== 1) throw new ErrorDeNegocio('Este proyecto ya no está en borrador.', 409);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'pedir_aprobacion', detalle: null });
    });
    try {
      await avisosService.notificar('activacion_pedida', { proyectoId: proyecto.id, autorId: usuario.id, referenciaTipo: 'proyecto', referenciaId: proyecto.id, mensaje: `Piden aprobar la activación de «${proyecto.nombre}».` });
    } catch (error) { console.error('[Proyectos] No se pudo avisar de la activación pedida:', error.message); }
    return this.obtener(usuario, proyecto.id);
  }

  // Aprobar es activar: se reparte en ese mismo momento, con las mismas garantías (idempotencia, una tienda, una empresa).
  async aprobar(usuario, id, { idempotencyKey } = {}) {
    exigir(usuario, 'proyectos.aprobar_activacion', 'No tienes permiso para aprobar la activación.');
    const resultado = await this._activacion(usuario, id, {
      idempotencyKey, desde: 'pendiente_aprobacion', prefijo: 'proy-aprobar', accion: 'aprobar',
      extra: { aprobada_por: usuario.id, aprobada_en: new Date(), aprobacion_comentario: null }
    });
    if (!resultado.repetida) await this._avisarResolucion(usuario, resultado, `Aprobaron la activación de «${resultado.nombre}».`);
    return resultado;
  }

  async rechazar(usuario, id, { comentario } = {}) {
    exigir(usuario, 'proyectos.aprobar_activacion', 'No tienes permiso para rechazar la activación.');
    const texto = limpio(comentario);
    if (texto.length < 3 || texto.length > 500) throw errorDeValidacion('Revisa los datos marcados.', { comentario: 'Escribe un comentario de 3 a 500 caracteres.' });
    const proyecto = await this.obtener(usuario, id);
    await db.transaccion(async (tx) => {
      const cambiado = await proyectoRepository.cambiarEstado(tx, proyecto.id, ['pendiente_aprobacion'], 'borrador', { aprobada_por: usuario.id, aprobada_en: new Date(), aprobacion_comentario: texto });
      if (cambiado !== 1) throw new ErrorDeNegocio('Este proyecto ya no espera aprobación.', 409);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'rechazar', detalle: { comentario: texto } });
    });
    await this._avisarResolucion(usuario, proyecto, `Rechazaron la activación de «${proyecto.nombre}»: ${texto}`);
    return this.obtener(usuario, proyecto.id);
  }

  // La activación aprobada o rechazada se le avisa a quien la pidió.
  async _avisarResolucion(usuario, proyecto, mensaje) {
    try {
      const fila = await proyectoRepository.obtener(proyecto.id, null);
      await avisosService.notificar('activacion_resuelta', { proyectoId: proyecto.id, autorId: usuario.id, explicitos: { supervisor: [fila.creado_por] }, referenciaTipo: 'proyecto', referenciaId: proyecto.id, mensaje });
    } catch (error) { console.error('[Proyectos] No se pudo avisar de la resolución:', error.message); }
  }

  // --- Cancelar ---

  async cancelar(usuario, id, { motivo } = {}) {
    exigir(usuario, 'proyectos.activar', 'No tienes permiso para cancelar proyectos.');
    const proyecto = await this.obtener(usuario, id);
    const texto = limpio(motivo);
    if (texto.length > 255) throw errorDeValidacion('Revisa los datos marcados.', { motivo: 'Máximo 255 caracteres.' });
    if (proyecto.estado === 'activo' && texto.length < 3) throw errorDeValidacion('Revisa los datos marcados.', { motivo: 'Escribe el motivo de la cancelación.' });
    await db.transaccion(async (tx) => {
      const cambiado = await proyectoRepository.cambiarEstado(tx, proyecto.id, ['borrador', 'pendiente_aprobacion', 'activo'], 'cancelado');
      if (cambiado !== 1) throw new ErrorDeNegocio('Este proyecto ya no se puede cancelar.', 409);
      if (proyecto.estado === 'activo') {
        await proyectoRepository.cerrarTiendas(tx, proyecto.id);
        await proyectoRepository.liberarEmpresas(tx, proyecto.id);
      }
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'cancelar', detalle: { estadoAnterior: proyecto.estado, motivo: texto || null } });
    });
    return this.obtener(usuario, proyecto.id);
  }
}

module.exports = new ProyectoService();
module.exports.sumarDiasHabiles = sumarDiasHabiles;
