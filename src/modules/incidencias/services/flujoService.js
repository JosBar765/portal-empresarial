// src/modules/incidencias/services/flujoService.js
// El ciclo de vida de una incidencia: tomar, avances, espera, verificación, corrección, reasignación, devolución, descarte y comentarios.
// Cada cambio de estado ocurre en una transacción con la fila bloqueada, deja un evento en el historial y avisa a quien corresponde.
const db = require('../../../config/database');
const incidenciaRepository = require('../repositories/incidenciaRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const personal = require('../repositories/personalRepository');
const operacionRepository = require('../repositories/operacionRepository');
const alcance = require('./alcanceService');
const incidenciaService = require('./incidenciaService');
const fotoService = require('./fotoService');
const avisos = require('./avisosService');
const parametros = require('../parametros');
const { ESTADOS, EVOLUCIONES, EVENTO, LIMITES } = require('../constantes');
const { errorDeValidacion, noEncontrada, conflicto, limpio } = require('../errores');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');

const CLAVE = /^[A-Za-z0-9_-]{8,64}$/;
const MENSAJE_SIN_CLAVE = 'Falta la clave de la operación. Recarga la página e inténtalo de nuevo.';
const { AHORA } = incidenciaRepository;

const comoBooleano = (v, defecto) => (v === undefined || v === null || v === '' ? defecto : (v === true || v === 'true' || v === '1' || v === 1));

class FlujoService {
  // --- Ayudas ---

  _llave(usuario, accion, id, clave) {
    if (!CLAVE.test(String(clave || ''))) throw new ErrorDeNegocio(MENSAJE_SIN_CLAVE, 400);
    return `inc-${accion}:${usuario.id}:${id}:${clave}`;
  }

  // La incidencia con la fila bloqueada y la relación de quien actúa; fuera de su alcance responde como si no existiera.
  // `incluirCobertura`: quien cubre la tienda no recibe un «no existe» si otro técnico se le adelantó (tomar): recibe el 409.
  async _cargar(tx, usuario, id, { incluirCobertura = false } = {}) {
    const fila = await incidenciaRepository.bloquear(tx, id);
    if (!fila) throw noEncontrada();
    const rel = await alcance.relacion(usuario, fila, tx);
    if (!alcance.puedeVer(rel, fila) && !(incluirCobertura && rel.cubre)) throw noEncontrada();
    return { fila, rel };
  }

  // Lectura previa (sin bloquear) para rechazar rápido antes de subir fotos.
  async _previa(usuario, id, accion, mensajeEstado) {
    const inc = await incidenciaRepository.obtener(id);
    if (!inc) throw noEncontrada();
    const rel = await alcance.relacion(usuario, inc);
    if (!alcance.puedeVer(rel, inc)) throw noEncontrada();
    alcance.exigir(usuario, rel, inc, accion, mensajeEstado);
    return inc;
  }

  _texto(datos, campo, { etiqueta, min = 1, max, obligatorio = true }) {
    const valor = limpio(datos[campo]);
    if (!valor) {
      if (obligatorio) throw errorDeValidacion('Revisa los datos marcados.', { [campo]: `${etiqueta}.` });
      return null;
    }
    if (valor.length < min) throw errorDeValidacion('Revisa los datos marcados.', { [campo]: `Escribe un poco más (mínimo ${min} caracteres).` });
    if (valor.length > max) throw errorDeValidacion('Revisa los datos marcados.', { [campo]: `Admite hasta ${max} caracteres.` });
    return valor;
  }

  async _salida(usuario, id, extra = {}) {
    return { ...(await incidenciaService.detalle(usuario, id)), ...extra };
  }

  // Los técnicos que podrían tomar una incidencia que vuelve al buzón.
  async _candidatos(fila) {
    const categoria = await db.query('SELECT especialidad_id FROM incidencia_categorias WHERE id = ?', [fila.categoria_id], 'incidencias_flujo:categoria');
    return incidenciaService._tecnicosParaAvisar({ tienda_id: fila.tienda_id, especialidad_id: categoria[0] && categoria[0].especialidad_id });
  }

  _aviso(fila, actor, tipo, mensaje, destinatarios, extra = {}) {
    return avisos.cambio({ incidencia: { id: fila.id }, actorId: actor.id, tipo, mensaje, destinatarios, involucrados: [fila.reportada_por, fila.tecnico_id].filter(Boolean), ...extra });
  }

  // --- Técnico ---

  // Tomar es atómico: si dos técnicos lo intentan a la vez, solo uno la toma.
  async tomar(usuario, id) {
    const MENSAJE = 'Otra persona ya la tomó. Mira el buzón para elegir otra.';
    const fila = await db.transaccion(async (tx) => {
      const { fila: f, rel } = await this._cargar(tx, usuario, id, { incluirCobertura: true });
      alcance.exigir(usuario, rel, f, 'tomar', MENSAJE);
      const cambiadas = await incidenciaRepository.actualizarSi(tx, id, [ESTADOS.EN_BUZON], { estado: ESTADOS.EN_PROCESO, tecnico_id: usuario.id, tomada_en: AHORA });
      if (cambiadas !== 1) throw conflicto(MENSAJE);
      await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.TOMA, usuarioId: usuario.id, texto: 'La tomó del buzón.' });
      return f;
    });
    await this._aviso(fila, usuario, 'incidencia_tomada', `${usuario.nombre} tomó tu incidencia ${fila.correlativo} y empezará a trabajar en ella.`, [fila.reportada_por], { involucrados: [usuario.id] });
    return this._salida(usuario, id);
  }

  async avance(usuario, id, datos, files, { idempotencyKey } = {}) {
    const llave = this._llave(usuario, 'avance', id, idempotencyKey);
    const previa = await operacionRepository.resultadoDe(llave);
    if (previa) return this._salida(usuario, id, { repetida: true });
    const texto = this._texto(datos, 'texto', { etiqueta: 'Cuenta qué hiciste y cómo evolucionó el problema', min: 3, max: LIMITES.texto });
    if (!EVOLUCIONES.includes(datos.evolucion)) throw errorDeValidacion('Revisa los datos marcados.', { evolucion: 'Indica cómo evolucionó el problema.' });
    const visible = comoBooleano(datos.visibleReportante, true);
    const config = await parametros.valores();
    fotoService.validar(files, { min: 0, max: config.fotos_por_avance });
    await this._previa(usuario, id, 'avance');
    const urls = await fotoService.subir(files);
    try {
      await db.transaccion(async (tx) => {
        const { fila, rel } = await this._cargar(tx, usuario, id);
        alcance.exigir(usuario, rel, fila, 'avance');
        const evento = await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.AVANCE, usuarioId: usuario.id, texto, evolucion: datos.evolucion, ronda: fila.ronda, visibleReportante: visible });
        await incidenciaRepository.insertarFotos(tx, id, evento, 'avance', urls, usuario.id);
        await incidenciaRepository.tocar(tx, id);
        await operacionRepository.registrar(tx, llave, 'incidencias.avance', { id });
      });
    } catch (error) {
      await fotoService.descartar(urls);
      if (error && error.code === 'ER_DUP_ENTRY') return this._salida(usuario, id, { repetida: true });
      throw error;
    }
    const fila = await incidenciaRepository.obtener(id);
    if (visible) await this._aviso(fila, usuario, 'incidencia_avance', `Hay un avance en tu incidencia ${fila.correlativo}: «${texto.slice(0, 80)}${texto.length > 80 ? '…' : ''}»`, [fila.reportada_por]);
    return this._salida(usuario, id, { repetida: false });
  }

  async ponerEnEspera(usuario, id, datos) {
    const motivoId = aEntero(datos.motivoId);
    if (!motivoId) throw errorDeValidacion('Revisa los datos marcados.', { motivoId: 'Elige el motivo de la espera.' });
    const motivo = await catalogoRepository.motivoEspera(motivoId);
    if (!motivo) throw errorDeValidacion('Revisa los datos marcados.', { motivoId: 'Ese motivo ya no está disponible.' });
    const detalle = this._texto(datos, 'detalle', { etiqueta: 'Escribe el detalle', max: LIMITES.comentario, obligatorio: false });
    const fila = await db.transaccion(async (tx) => {
      const { fila: f, rel } = await this._cargar(tx, usuario, id);
      alcance.exigir(usuario, rel, f, 'espera');
      if (await incidenciaRepository.actualizarSi(tx, id, [ESTADOS.EN_PROCESO, ESTADOS.CORRECCION_PEDIDA], { estado: ESTADOS.EN_ESPERA }) !== 1) throw conflicto('Esta incidencia cambió de estado mientras la mirabas. Recarga la página.');
      await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.ESPERA, usuarioId: usuario.id, texto: detalle, datos: { motivoId: motivo.id, motivo: motivo.nombre } });
      return f;
    });
    await this._aviso(fila, usuario, 'incidencia_espera', `Tu incidencia ${fila.correlativo} está en espera: ${motivo.nombre.toLowerCase()}.`, [fila.reportada_por]);
    return this._salida(usuario, id);
  }

  async reanudar(usuario, id) {
    await db.transaccion(async (tx) => {
      const { fila, rel } = await this._cargar(tx, usuario, id);
      alcance.exigir(usuario, rel, fila, 'reanudar');
      if (await incidenciaRepository.actualizarSi(tx, id, [ESTADOS.EN_ESPERA], { estado: ESTADOS.EN_PROCESO }) !== 1) throw conflicto('Esta incidencia cambió de estado mientras la mirabas. Recarga la página.');
      await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.REANUDACION, usuarioId: usuario.id, texto: 'Retomó el trabajo.' });
    });
    const fila = await incidenciaRepository.obtener(id);
    await this._aviso(fila, usuario, 'incidencia_reanudada', `Retomaron el trabajo en tu incidencia ${fila.correlativo}.`, [fila.reportada_por]);
    return this._salida(usuario, id);
  }

  // El técnico termina: resumen + al menos una foto del trabajo terminado. Quien verifica la tienda recibe el aviso.
  async enviarVerificacion(usuario, id, datos, files, { idempotencyKey } = {}) {
    const llave = this._llave(usuario, 'verificacion', id, idempotencyKey);
    if (await operacionRepository.resultadoDe(llave)) return this._salida(usuario, id, { repetida: true });
    const resumen = this._texto(datos, 'resumen', { etiqueta: 'Cuenta qué hiciste y en qué estado quedó', min: 10, max: LIMITES.texto });
    if (!comoBooleano(datos.confirmo, false)) throw errorDeValidacion('Revisa los datos marcados.', { confirmo: 'Confirma que el problema quedó resuelto y probado.' });
    const config = await parametros.valores();
    fotoService.validar(files, { min: 1, max: config.fotos_por_avance, minimoMensaje: 'Agrega al menos una foto del trabajo terminado.' });
    await this._previa(usuario, id, 'enviarVerificacion');
    const urls = await fotoService.subir(files);
    try {
      await db.transaccion(async (tx) => {
        const { fila, rel } = await this._cargar(tx, usuario, id);
        alcance.exigir(usuario, rel, fila, 'enviarVerificacion');
        const ronda = fila.ronda + 1;
        if (await incidenciaRepository.actualizarSi(tx, id, [ESTADOS.EN_PROCESO, ESTADOS.CORRECCION_PEDIDA], { estado: ESTADOS.EN_VERIFICACION, ronda }) !== 1) throw conflicto('Esta incidencia cambió de estado mientras la mirabas. Recarga la página.');
        const evento = await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.A_VERIFICACION, usuarioId: usuario.id, texto: resumen, ronda });
        await incidenciaRepository.insertarFotos(tx, id, evento, 'cierre', urls, usuario.id);
        await operacionRepository.registrar(tx, llave, 'incidencias.verificacion', { id });
      });
    } catch (error) {
      await fotoService.descartar(urls);
      if (error && error.code === 'ER_DUP_ENTRY') return this._salida(usuario, id, { repetida: true });
      throw error;
    }
    const fila = await incidenciaRepository.obtener(id);
    const { personas } = await personal.verificadoresDe(fila.tienda_id);
    await this._aviso(fila, usuario, 'incidencia_a_verificacion', `${usuario.nombre} envió a verificación ${fila.correlativo}: «${fila.titulo}».`, personas.map(p => p.id));
    return this._salida(usuario, id, { repetida: false });
  }

  // El técnico devuelve al buzón una incidencia suya (no puede atenderla); queda anotado el motivo.
  async devolver(usuario, id, datos) {
    const motivo = this._texto(datos, 'motivo', { etiqueta: 'Cuenta por qué la devuelves', min: 3, max: LIMITES.motivo });
    const fila = await db.transaccion(async (tx) => {
      const { fila: f, rel } = await this._cargar(tx, usuario, id);
      alcance.exigir(usuario, rel, f, 'devolver');
      if (await incidenciaRepository.actualizarSi(tx, id, [ESTADOS.EN_PROCESO, ESTADOS.EN_ESPERA, ESTADOS.CORRECCION_PEDIDA], { estado: ESTADOS.EN_BUZON, tecnico_id: null }) !== 1) throw conflicto('Esta incidencia cambió de estado mientras la mirabas. Recarga la página.');
      await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.DEVOLUCION_BUZON, usuarioId: usuario.id, texto: motivo, datos: { tecnicoId: usuario.id } });
      return f;
    });
    const candidatos = await this._candidatos(fila);
    await this._aviso({ ...fila, tecnico_id: null }, usuario, 'incidencia_devuelta', `${fila.correlativo} volvió al buzón: «${fila.titulo}».`, candidatos, { involucrados: [usuario.id, fila.reportada_por] });
    return this._salida(usuario, id);
  }

  // --- Verificador ---

  async aprobar(usuario, id, datos) {
    const comentario = this._texto(datos, 'comentario', { etiqueta: 'Escribe un comentario', max: LIMITES.comentario, obligatorio: false });
    const fila = await db.transaccion(async (tx) => {
      const { fila: f, rel } = await this._cargar(tx, usuario, id);
      alcance.exigir(usuario, rel, f, 'aprobar', 'Esta incidencia ya no está esperando tu verificación. Recarga la página.');
      if (await incidenciaRepository.actualizarSi(tx, id, [ESTADOS.EN_VERIFICACION], { estado: ESTADOS.CERRADA, cerrada_en: AHORA }) !== 1) throw conflicto('Esta incidencia ya no está esperando tu verificación. Recarga la página.');
      await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.CIERRE, usuarioId: usuario.id, texto: comentario || 'Verificó que el problema quedó resuelto.', ronda: f.ronda });
      return f;
    });
    await this._aviso(fila, usuario, 'incidencia_cerrada', `Tu incidencia ${fila.correlativo} quedó resuelta y cerrada.`, [fila.reportada_por, fila.tecnico_id].filter(Boolean));
    return this._salida(usuario, id);
  }

  async pedirCorreccion(usuario, id, datos, files) {
    const comentario = this._texto(datos, 'comentario', { etiqueta: 'Escribe qué debe corregirse', min: 3, max: LIMITES.comentario });
    const config = await parametros.valores();
    fotoService.validar(files, { min: 0, max: config.fotos_por_avance });
    await this._previa(usuario, id, 'pedirCorreccion', 'Esta incidencia ya no está esperando tu verificación. Recarga la página.');
    const urls = await fotoService.subir(files);
    let fila;
    try {
      fila = await db.transaccion(async (tx) => {
        const { fila: f, rel } = await this._cargar(tx, usuario, id);
        alcance.exigir(usuario, rel, f, 'pedirCorreccion', 'Esta incidencia ya no está esperando tu verificación. Recarga la página.');
        if (await incidenciaRepository.actualizarSi(tx, id, [ESTADOS.EN_VERIFICACION], { estado: ESTADOS.CORRECCION_PEDIDA }) !== 1) throw conflicto('Esta incidencia ya no está esperando tu verificación. Recarga la página.');
        const evento = await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.CORRECCION_PEDIDA, usuarioId: usuario.id, texto: comentario, ronda: f.ronda });
        await incidenciaRepository.insertarFotos(tx, id, evento, 'avance', urls, usuario.id);
        return f;
      });
    } catch (error) {
      await fotoService.descartar(urls);
      throw error;
    }
    await this._aviso(fila, usuario, 'incidencia_correccion', `${usuario.nombre} pidió una corrección en ${fila.correlativo}: «${comentario.slice(0, 80)}${comentario.length > 80 ? '…' : ''}»`, [fila.tecnico_id].filter(Boolean), { nivel: 'alerta' });
    return this._salida(usuario, id);
  }

  // --- Asignador ---

  // Pasa la incidencia a otro técnico o la devuelve al buzón compartido (`destino: 'buzon'`).
  async reasignar(usuario, id, datos) {
    const motivo = this._texto(datos, 'motivo', { etiqueta: 'Cuenta por qué la reasignas', min: 3, max: LIMITES.motivo });
    const haciaBuzon = datos.destino === 'buzon';
    const tecnicoId = haciaBuzon ? null : aEntero(datos.tecnicoId);
    if (!haciaBuzon && !tecnicoId) throw errorDeValidacion('Revisa los datos marcados.', { tecnicoId: 'Elige a quién la pasas.' });
    const resultado = await db.transaccion(async (tx) => {
      const { fila, rel } = await this._cargar(tx, usuario, id);
      alcance.exigir(usuario, rel, fila, 'reasignar');
      const anterior = fila.tecnico_id ? (await personal.nombresDeUsuarios([fila.tecnico_id])).get(fila.tecnico_id) : null;
      if (haciaBuzon) {
        if (fila.estado === ESTADOS.EN_BUZON) throw conflicto('Esta incidencia ya está en el buzón.');
        if (await incidenciaRepository.actualizarSi(tx, id, [fila.estado], { estado: ESTADOS.EN_BUZON, tecnico_id: null }) !== 1) throw conflicto('Esta incidencia cambió de estado mientras la mirabas. Recarga la página.');
        await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.DEVOLUCION_BUZON, usuarioId: usuario.id, texto: motivo, datos: { de: fila.tecnico_id ? { id: fila.tecnico_id, nombre: anterior } : null } });
        return { fila, nuevo: null, anterior };
      }
      if (tecnicoId === fila.tecnico_id) throw conflicto('Esa persona ya tiene esta incidencia.');
      const tecnico = await personal.tecnicoActivo(tecnicoId, tx);
      if (!tecnico || !(await personal.tecnicoCubre(tecnicoId, fila.tienda_id, tx))) throw errorDeValidacion('Revisa los datos marcados.', { tecnicoId: 'Esa persona no es técnico activo de esta tienda.' });
      const campos = fila.estado === ESTADOS.EN_BUZON ? { estado: ESTADOS.EN_PROCESO, tecnico_id: tecnicoId, tomada_en: AHORA } : { tecnico_id: tecnicoId };
      if (await incidenciaRepository.actualizarSi(tx, id, [fila.estado], campos) !== 1) throw conflicto('Esta incidencia cambió de estado mientras la mirabas. Recarga la página.');
      await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.REASIGNACION, usuarioId: usuario.id, texto: motivo,
        datos: { de: fila.tecnico_id ? { id: fila.tecnico_id, nombre: anterior } : null, a: { id: tecnico.id, nombre: tecnico.nombre } } });
      return { fila, nuevo: tecnico, anterior };
    });
    const { fila, nuevo, anterior } = resultado;
    if (nuevo) {
      await this._aviso(fila, usuario, 'incidencia_reasignada', `Te asignaron ${fila.correlativo}: «${fila.titulo}».`, [nuevo.id], { involucrados: [fila.tecnico_id].filter(Boolean) });
      if (fila.tecnico_id) await this._aviso(fila, usuario, 'incidencia_reasignada', `${fila.correlativo} pasó a ${nuevo.nombre}.`, [fila.tecnico_id]);
    } else {
      const candidatos = await this._candidatos(fila);
      await this._aviso({ ...fila, tecnico_id: null }, usuario, 'incidencia_devuelta', `${fila.correlativo} volvió al buzón${anterior ? ` (la tenía ${anterior})` : ''}: «${fila.titulo}».`, candidatos, { involucrados: [fila.tecnico_id, fila.reportada_por].filter(Boolean) });
    }
    return this._salida(usuario, id);
  }

  async descartar(usuario, id, datos) {
    const motivo = this._texto(datos, 'motivo', { etiqueta: 'Cuenta por qué se descarta', min: 3, max: LIMITES.motivo });
    const originalId = datos.originalId === undefined || datos.originalId === null || datos.originalId === '' ? null : aEntero(datos.originalId);
    if (datos.originalId && !originalId) throw errorDeValidacion('Revisa los datos marcados.', { originalId: 'Esa incidencia no existe.' });
    if (originalId && originalId === id) throw errorDeValidacion('Revisa los datos marcados.', { originalId: 'Elige otra incidencia, no la misma.' });
    if (originalId && !(await incidenciaRepository.existe(originalId))) throw errorDeValidacion('Revisa los datos marcados.', { originalId: 'Esa incidencia no existe.' });
    const fila = await db.transaccion(async (tx) => {
      const { fila: f, rel } = await this._cargar(tx, usuario, id);
      alcance.exigir(usuario, rel, f, 'descartar');
      const campos = { estado: ESTADOS.DESCARTADA, cerrada_en: AHORA };
      if (originalId) campos.duplicada_de = originalId;
      if (await incidenciaRepository.actualizarSi(tx, id, [f.estado], campos) !== 1) throw conflicto('Esta incidencia cambió de estado mientras la mirabas. Recarga la página.');
      await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.DESCARTE, usuarioId: usuario.id, texto: motivo, datos: originalId ? { originalId } : null });
      return f;
    });
    await this._aviso(fila, usuario, 'incidencia_descartada', `Tu incidencia ${fila.correlativo} se descartó: ${motivo}`, [fila.reportada_por, fila.tecnico_id].filter(Boolean));
    return this._salida(usuario, id);
  }

  async cambiarPrioridad(usuario, id, datos) {
    const prioridadId = aEntero(datos.prioridadId);
    if (!prioridadId) throw errorDeValidacion('Revisa los datos marcados.', { prioridadId: 'Elige la prioridad.' });
    const motivo = this._texto(datos, 'motivo', { etiqueta: 'Cuenta por qué la cambias', min: 3, max: LIMITES.motivo });
    const nueva = await catalogoRepository.prioridad(prioridadId);
    if (!nueva) throw errorDeValidacion('Revisa los datos marcados.', { prioridadId: 'Esa prioridad ya no está disponible.' });
    const fila = await db.transaccion(async (tx) => {
      const { fila: f, rel } = await this._cargar(tx, usuario, id);
      alcance.exigir(usuario, rel, f, 'cambiarPrioridad');
      if (f.prioridad_id === nueva.id) throw conflicto('Esa ya es la prioridad de la incidencia.');
      const actual = await catalogoRepository.prioridad(f.prioridad_id, tx);
      if (await incidenciaRepository.actualizarSi(tx, id, [f.estado], { prioridad_id: nueva.id }) !== 1) throw conflicto('Esta incidencia cambió de estado mientras la mirabas. Recarga la página.');
      await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.PRIORIDAD, usuarioId: usuario.id, texto: motivo, visibleReportante: false,
        datos: { de: actual && actual.codigo, a: nueva.codigo } });
      return f;
    });
    await this._aviso(fila, usuario, 'incidencia_prioridad', `${fila.correlativo} cambió a ${nueva.codigo} ${nueva.nombre}.`, [fila.tecnico_id].filter(Boolean));
    return this._salida(usuario, id);
  }

  // --- Comentarios ---

  async comentar(usuario, id, datos, { idempotencyKey } = {}) {
    const llave = this._llave(usuario, 'comentario', id, idempotencyKey);
    if (await operacionRepository.resultadoDe(llave)) return this._salida(usuario, id, { repetida: true });
    const texto = this._texto(datos, 'texto', { etiqueta: 'Escribe tu comentario', max: LIMITES.comentario });
    let fila;
    let visible;
    try {
      fila = await db.transaccion(async (tx) => {
        const { fila: f, rel } = await this._cargar(tx, usuario, id);
        alcance.exigir(usuario, rel, f, 'comentar', 'Esta incidencia ya está cerrada: ya no admite comentarios.');
        // Quien reporta siempre es visible para el técnico y viceversa; el técnico puede dejar una nota interna.
        visible = rel.esReportante || comoBooleano(datos.visibleReportante, true);
        await incidenciaRepository.insertarEvento(tx, { incidenciaId: id, tipo: EVENTO.COMENTARIO, usuarioId: usuario.id, texto, visibleReportante: visible });
        await incidenciaRepository.tocar(tx, id);
        await operacionRepository.registrar(tx, llave, 'incidencias.comentario', { id });
        return f;
      });
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') return this._salida(usuario, id, { repetida: true });
      throw error;
    }
    const destino = usuario.id === fila.reportada_por ? [fila.tecnico_id].filter(Boolean) : (visible ? [fila.reportada_por] : []);
    await this._aviso(fila, usuario, 'incidencia_comentario', `${usuario.nombre} comentó en ${fila.correlativo}: «${texto.slice(0, 80)}${texto.length > 80 ? '…' : ''}»`, destino);
    return this._salida(usuario, id, { repetida: false });
  }
}

module.exports = new FlujoService();
