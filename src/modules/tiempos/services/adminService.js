// src/modules/tiempos/services/adminService.js
// Administración de la Tabla de tiempos. Todo cambio se guarda en un BORRADOR (copia de la versión publicada); los usuarios solo ven
// lo nuevo cuando el administrador publica una versión. Cada guardado y cada publicación queda en el historial.
const db = require('../../../config/database');
const tablaRepository = require('../repositories/tablaRepository');
const borradorRepository = require('../repositories/borradorRepository');
const tablaService = require('./tablaService');
const { diferencias } = require('../calculo/diferencias');
const v = require('../calculo/validacion');
const { esFechaISO } = require('../calculo/fechas');
const { errorDeValidacion, sinTabla } = require('../errores');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');

const REVISA = 'Revisa los datos marcados.';
const hoy = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const objeto = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const texto = (x) => (typeof x === 'string' ? x.trim() : '');
const aEntero = (x) => (typeof x === 'number' ? x : (typeof x === 'string' && /^\d{1,9}$/.test(x.trim()) ? Number(x.trim()) : x));

// Los errores de validación pasan a un mapa campo → mensaje que la pantalla sabe pintar.
function aCampos(prefijo, errores) {
  const campos = {};
  for (const e of errores) campos[e.indice === undefined || e.indice === null ? `${prefijo}.${e.campo}` : `${prefijo}.${e.indice}.${e.campo}`] = e.mensaje;
  return campos;
}

class AdminService {
  async _publicada() {
    const version = await tablaRepository.versionPublicada();
    if (!version) throw sinTabla();
    return version;
  }

  // Número de la versión siguiente: 5.0 → 5.1 (y si ya existe, el que siga libre).
  async _numeroSiguiente(base) {
    const [mayor, menor = '0'] = String(base).split('.');
    let n = Number(menor) + 1;
    while (await borradorRepository.existeNumero(`${mayor}.${n}`)) n++;
    return `${mayor}.${n}`;
  }

  // El borrador de trabajo; si no existe, se crea como copia de la versión publicada.
  async _asegurarBorrador(tx, usuarioId) {
    const existente = await borradorRepository.versionBorrador();
    if (existente) return existente.id;
    const publicada = await this._publicada();
    const id = await borradorRepository.clonarVersion(tx, publicada.id, { numero: await this._numeroSiguiente(publicada.numero), fecha: hoy(), nota: null, usuarioId });
    await borradorRepository.registrarHistorial(tx, { usuarioId, versionId: id, entidad: 'version', clave: 'borrador', accion: 'crear', despues: { desde: publicada.numero } });
    return id;
  }

  async estado() {
    const [publicada, borrador] = await Promise.all([tablaRepository.versionPublicada(), borradorRepository.versionBorrador()]);
    let cambios = 0;
    if (publicada && borrador) cambios = (await this.cambios()).length;
    return { publicada, borrador, cambios };
  }

  // Lo que muestra la pantalla de administración: el borrador si existe, y si no la versión publicada.
  async tablaAdmin() {
    const borrador = await borradorRepository.versionBorrador();
    const version = borrador || await this._publicada();
    const t = await tablaRepository.cargarTabla(version);
    const [usoEtapas, usoLineas] = await Promise.all([borradorRepository.usoDeEtapas(version.id), borradorRepository.usoDeLineas(version.id)]);
    const publicada = borrador ? await tablaRepository.versionPublicada() : version;
    return {
      version: { id: version.id, numero: version.numero, fecha: version.fecha, estado: version.estado }, esBorrador: Boolean(borrador),
      publicada: publicada ? { numero: publicada.numero, fecha: publicada.fecha } : null,
      lineas: t.lineas, etapas: t.etapasLista,
      productos: Object.values(t.productos).map(p => ({ clave: p.clave, nombre: p.nombre, linea: p.linea, grupo: p.grupo, activo: p.activo, permiteMoldes: p.permiteMoldes, permiteLanyard: p.permiteLanyard, etapas: p.etapas, rangos: p.rangos, avisos: p.avisos })),
      extras: Object.values(t.extras).map(e => ({ clave: e.clave, nombre: e.nombre, aviso: e.aviso, rangos: e.rangos })),
      parametros: t.parametros, avisosGenerales: t.avisosGenerales,
      uso: { etapas: Object.fromEntries(usoEtapas.map(x => [x.clave, Number(x.productos)])), lineas: Object.fromEntries(usoLineas.map(x => [x.clave, Number(x.productos)])) }
    };
  }

  // Crea (clave null) o reemplaza un producto: datos, rangos con días y avisos.
  async guardarProducto(clave, cuerpo, usuario) {
    const b = objeto(cuerpo);
    const campos = {};
    const nombre = texto(b.nombre);
    const errNombre = v.validarNombre(nombre);
    if (errNombre) campos.nombre = errNombre;
    const avisos = Array.isArray(b.avisos) ? b.avisos.map(texto) : [];
    const rv = v.validarTextos(avisos, 'avisos');
    if (!rv.ok) Object.assign(campos, aCampos('avisos', rv.errores));
    return db.transaccion(async (tx) => {
      const versionId = await this._asegurarBorrador(tx, usuario.id);
      const etapasValidas = await borradorRepository.etapasDe(tx, versionId);
      const lineasValidas = await borradorRepository.lineasDe(tx, versionId);
      let previo = null;
      if (clave) { previo = await borradorRepository.productoDe(tx, versionId, clave); if (!previo) throw new ErrorDeNegocio('Ese producto ya no existe. Recarga la página.', 404); }
      const etapasClaves = Array.isArray(b.etapas) ? b.etapas.filter(e => etapasValidas.some(x => x.clave === e)) : [];
      if (!etapasClaves.length) campos.etapas = 'Elige al menos una etapa.';
      const etapas = etapasValidas.filter(e => etapasClaves.includes(e.clave));
      const linea = clave ? previo.linea : b.linea;
      if (!clave && !lineasValidas.some(l => l.clave === linea)) campos.linea = 'Elige una línea de la lista.';
      const rangos = (Array.isArray(b.rangos) ? b.rangos : []).map(r => {
        const x = objeto(r); const dias = {};
        for (const [e, d] of Object.entries(objeto(x.dias))) dias[e] = d === '' || d === null || d === undefined ? undefined : aEntero(d);
        const aConvenir = x.aConvenir === true;
        return { desde: aEntero(x.desde), hasta: aConvenir || x.hasta === null || x.hasta === undefined || x.hasta === '' ? null : aEntero(x.hasta), aConvenir, dias };
      });
      if (etapas.length) { const rr = v.validarRangos(rangos, etapas); if (!rr.ok) Object.assign(campos, aCampos('rangos', rr.errores)); }
      if (nombre && await borradorRepository.nombreRepetido(tx, versionId, nombre, clave)) campos.nombre = 'Ya existe un producto con ese nombre. Usa otro.';
      // Un producto nuevo nace oculto: se muestra cuando ya tiene rangos con días.
      const activo = clave ? b.activo !== false : false;
      if (activo && !rangos.some(r => !r.aConvenir)) campos.activo = 'Agrega al menos un rango con días antes de mostrar el producto en la calculadora.';
      if (Object.keys(campos).length) throw errorDeValidacion(REVISA, campos);
      const claveFinal = clave || await borradorRepository.claveLibre(tx, versionId, v.aClave(nombre));
      const antes = previo ? { nombre: previo.nombre } : null;
      await borradorRepository.guardarProducto(tx, versionId, {
        id: previo ? previo.id : null, clave: claveFinal, linea, grupo: previo ? previo.grupo : (texto(b.grupo) || null), nombre, activo,
        permiteMoldes: b.permiteMoldes === true, permiteLanyard: b.permiteLanyard === true, orden: previo ? previo.orden : await borradorRepository.siguienteOrden(tx, versionId),
        etapas: etapasClaves, rangos, avisos: avisos.filter(Boolean)
      });
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId, entidad: 'producto', clave: claveFinal, accion: previo ? 'editar' : 'crear', antes, despues: { nombre, rangos: rangos.length, activo } });
      return { clave: claveFinal };
    });
  }

  async guardarExtras(cuerpo, usuario) {
    const b = objeto(cuerpo);
    const extras = (Array.isArray(b.extras) ? b.extras : []).map(e => {
      const x = objeto(e);
      return { clave: texto(x.clave), nombre: texto(x.nombre), aviso: texto(x.aviso) || null, rangos: (Array.isArray(x.rangos) ? x.rangos : []).map(r => { const y = objeto(r); const aConvenir = y.aConvenir === true; return { desde: aEntero(y.desde), hasta: aConvenir || y.hasta === null || y.hasta === undefined || y.hasta === '' ? null : aEntero(y.hasta), aConvenir, dias: aConvenir ? null : aEntero(y.dias) }; }) };
    });
    const parametros = {};
    for (const [k, val] of Object.entries(objeto(b.parametros))) parametros[k] = aEntero(val);
    const campos = {};
    extras.forEach((e, i) => { const r = v.validarExtra(e); if (!r.ok) Object.assign(campos, aCampos(`extras.${i}`, r.errores)); if (!e.clave) campos[`extras.${i}.clave`] = 'Falta la clave del extra.'; });
    const rp = v.validarParametros(parametros); if (!rp.ok) Object.assign(campos, aCampos('parametros', rp.errores));
    if (Object.keys(campos).length) throw errorDeValidacion(REVISA, campos);
    return db.transaccion(async (tx) => {
      const versionId = await this._asegurarBorrador(tx, usuario.id);
      await borradorRepository.guardarExtras(tx, versionId, extras, parametros);
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId, entidad: 'extras', clave: 'extras', accion: 'editar', despues: { extras: extras.length, parametros } });
    });
  }

  async guardarAvisosGenerales(cuerpo, usuario) {
    const textos = (Array.isArray(objeto(cuerpo).avisos) ? cuerpo.avisos : []).map(texto);
    const r = v.validarTextos(textos, 'avisos');
    if (!r.ok) throw errorDeValidacion(REVISA, aCampos('avisos', r.errores));
    return db.transaccion(async (tx) => {
      const versionId = await this._asegurarBorrador(tx, usuario.id);
      await borradorRepository.guardarAvisosGenerales(tx, versionId, textos);
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId, entidad: 'avisos', clave: 'generales', accion: 'editar', despues: { total: textos.length } });
    });
  }

  // Etapas y líneas: se renombran y se agregan (no se borran: lo que está en uso no puede desaparecer).
  async guardarCatalogos(cuerpo, usuario) {
    const b = objeto(cuerpo);
    const campos = {};
    const limpiar = (lista, tipo) => (Array.isArray(lista) ? lista : []).map((x, i) => {
      const nombre = texto(objeto(x).nombre);
      if (nombre.length < 2 || nombre.length > 80) campos[`${tipo}.${i}.nombre`] = 'El nombre debe tener de 2 a 80 caracteres.';
      return { clave: texto(objeto(x).clave), nombre };
    });
    const lineas = limpiar(b.lineas, 'lineas'); const etapas = limpiar(b.etapas, 'etapas');
    for (const [tipo, lista] of [['lineas', lineas], ['etapas', etapas]]) {
      const vistos = new Set();
      lista.forEach((x, i) => { const k = x.nombre.toLowerCase(); if (vistos.has(k)) campos[`${tipo}.${i}.nombre`] = 'Ya hay otra con ese nombre.'; vistos.add(k); });
    }
    if (Object.keys(campos).length) throw errorDeValidacion(REVISA, campos);
    return db.transaccion(async (tx) => {
      const versionId = await this._asegurarBorrador(tx, usuario.id);
      for (const [tipo, lista, existentes] of [['lineas', lineas, await borradorRepository.lineasDe(tx, versionId)], ['etapas', etapas, await borradorRepository.etapasDe(tx, versionId)]]) {
        const usadas = new Set(existentes.map(x => x.clave));
        for (const x of lista) if (!x.clave || !usadas.has(x.clave)) { let k = v.aClave(x.nombre).replace(/-/g, '_'); let i = 2; while (usadas.has(k)) k = `${v.aClave(x.nombre).replace(/-/g, '_')}_${i++}`; x.clave = k; usadas.add(k); }
        // lo que no vino se conserva al final (no se borra)
        for (const e of existentes) if (!lista.some(x => x.clave === e.clave)) lista.push({ clave: e.clave, nombre: e.nombre });
        await borradorRepository.guardarCatalogo(tx, tipo, versionId, lista);
      }
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId, entidad: 'catalogos', clave: 'etapas_lineas', accion: 'editar', despues: { lineas: lineas.length, etapas: etapas.length } });
    });
  }

  async cambios() {
    const borrador = await borradorRepository.versionBorrador();
    if (!borrador) return [];
    const publicada = await this._publicada();
    return diferencias(await tablaRepository.cargarTabla(publicada), await tablaRepository.cargarTabla(borrador));
  }

  async publicar(cuerpo, usuario) {
    const b = objeto(cuerpo);
    const borrador = await borradorRepository.versionBorrador();
    if (!borrador) throw new ErrorDeNegocio('No hay cambios guardados para publicar. Edita la tabla y guarda el borrador primero.', 409);
    const numero = texto(b.numero); const fecha = texto(b.fecha); const nota = texto(b.nota);
    const campos = {};
    if (!/^\d{1,3}(\.\d{1,3})?$/.test(numero)) campos.numero = 'Escribe el número como 5.1 (solo números y un punto).';
    else if (numero !== borrador.numero && await borradorRepository.existeNumero(numero)) campos.numero = 'Ya existe una versión con ese número. Usa otro.';
    if (!esFechaISO(fecha)) campos.fecha = 'Elige la fecha de la versión.';
    if (nota.length > 255) campos.nota = 'La nota admite hasta 255 caracteres.';
    if (Object.keys(campos).length) throw errorDeValidacion(REVISA, campos);
    const lista = await this.cambios();
    if (!lista.length) throw new ErrorDeNegocio('El borrador no tiene cambios respecto a la versión publicada. No hace falta publicar.', 409);
    await db.transaccion(async (tx) => {
      await borradorRepository.publicar(tx, borrador.id, { numero, fecha, nota, usuarioId: usuario.id });
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId: borrador.id, entidad: 'version', clave: numero, accion: 'publicar', despues: { cambios: lista.length, nota } });
    });
    tablaService.invalidar();
    return { numero, cambios: lista.length };
  }

  async descartarBorrador(usuario) {
    const borrador = await borradorRepository.versionBorrador();
    if (!borrador) return { descartado: false };
    await db.transaccion(async (tx) => {
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId: null, entidad: 'version', clave: borrador.numero, accion: 'descartar', antes: { numero: borrador.numero } });
      await borradorRepository.descartar(tx, borrador.id);
    });
    return { descartado: true };
  }

  async versiones() {
    const lista = await borradorRepository.versiones();
    return { versiones: lista };
  }

  // Qué cambió en una versión respecto a la que tenía antes (el borrador, respecto a la publicada).
  async cambiosDeVersion(id) {
    const version = await borradorRepository.versionPorId(id);
    if (!version) throw new ErrorDeNegocio('Esa versión no existe.', 404);
    const todas = (await borradorRepository.versiones()).filter(x => x.estado !== 'borrador' || x.id === version.id);
    const posicion = todas.findIndex(x => x.id === version.id);
    const anterior = version.estado === 'borrador' ? await tablaRepository.versionPublicada() : todas[posicion + 1];
    if (!anterior) return { cambios: [{ objeto: 'Versión inicial', detalle: 'Carga inicial de la tabla de tiempos' }], inicial: true };
    return { cambios: diferencias(await tablaRepository.cargarTabla(await borradorRepository.versionPorId(anterior.id)), await tablaRepository.cargarTabla(version)), inicial: false };
  }

  async usarComoBorrador(id, usuario) {
    if (await borradorRepository.versionBorrador()) throw new ErrorDeNegocio('Ya hay un borrador: publícalo o descártalo antes de empezar otro.', 409);
    const origen = await borradorRepository.versionPorId(id);
    if (!origen || origen.estado === 'borrador') throw new ErrorDeNegocio('Esa versión no existe.', 404);
    const publicada = await this._publicada();
    return db.transaccion(async (tx) => {
      const nuevo = await borradorRepository.clonarVersion(tx, origen.id, { numero: await this._numeroSiguiente(publicada.numero), fecha: hoy(), nota: `Basado en la versión ${origen.numero}`, usuarioId: usuario.id });
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId: nuevo, entidad: 'version', clave: 'borrador', accion: 'crear', despues: { desde: origen.numero } });
      return { id: nuevo };
    });
  }

  async actividad() { return { actividad: await borradorRepository.cambiosRecientes(30) }; }
}

module.exports = new AdminService();
