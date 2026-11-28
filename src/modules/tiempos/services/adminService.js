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
const { textoExtra } = require('../calculo/extras');
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
    const [usoEtapas, usoLineas, usoCategorias, visible, publicados] = await Promise.all([
      borradorRepository.usoDeEtapas(version.id), borradorRepository.usoDeLineas(version.id), borradorRepository.usoDeCategorias(version.id),
      borradorRepository.usoVisible(db, version.id), borradorRepository.extrasClavesPublicadas()
    ]);
    const publicada = borrador ? await tablaRepository.versionPublicada() : version;
    const mapa = (filas) => Object.fromEntries(filas.map(x => [x.clave, Number(x.productos)]));
    const yaPublicados = new Set(publicados.map(x => x.clave));
    return {
      version: { id: version.id, numero: version.numero, fecha: version.fecha, estado: version.estado }, esBorrador: Boolean(borrador),
      publicada: publicada ? { numero: publicada.numero, fecha: publicada.fecha } : null,
      lineas: t.lineas, categorias: t.categoriasLista, etapas: t.etapasLista,
      productos: Object.values(t.productos).map(p => ({ clave: p.clave, nombre: p.nombre, linea: p.linea, categoria: p.categoria, grupo: p.grupo, activo: p.activo, etapas: p.etapas, rangos: p.rangos, avisos: p.avisos })),
      extras: t.extras.map(e => ({ ...e, resumen: textoExtra(e), publicado: yaPublicados.has(e.clave) })),
      parametros: t.parametros, avisosGenerales: t.avisosGenerales,
      uso: { etapas: mapa(usoEtapas), lineas: mapa(usoLineas), categorias: mapa(usoCategorias) },
      usoVisible: visible
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
      // Categoría: la que se elige (de la misma línea) o ninguna; si no se manda, se conserva la que tenía.
      let categoria = b.categoria === undefined ? (previo ? previo.categoria : null) : (texto(b.categoria) || null);
      if (categoria) {
        const cat = (await borradorRepository.categoriasDe(tx, versionId)).find(c => c.clave === categoria);
        if (!cat || cat.linea !== linea) { campos.categoria = 'Elige una categoría de la línea del producto.'; categoria = null; }
      }
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
        id: previo ? previo.id : null, clave: claveFinal, linea, categoria, nombre, activo,
        orden: previo ? previo.orden : await borradorRepository.siguienteOrden(tx, versionId),
        etapas: etapasClaves, rangos, avisos: avisos.filter(Boolean)
      });
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId, entidad: 'producto', clave: claveFinal, accion: previo ? 'editar' : 'crear', antes, despues: { nombre, rangos: rangos.length, activo } });
      return { clave: claveFinal };
    });
  }

  // Todos los extras del borrador, en el orden en que se verán (lo envía la pestaña Extras y el asistente «Extra nuevo»).
  // Un extra que ya estuvo en una versión publicada no se quita: se oculta.
  async guardarExtras(cuerpo, usuario) {
    const b = objeto(cuerpo);
    const lista = Array.isArray(b.extras) ? b.extras : [];
    const campos = {};
    if (lista.length > v.MAX_EXTRAS) throw errorDeValidacion(`Se admiten hasta ${v.MAX_EXTRAS} extras.`, { extras: `Se admiten hasta ${v.MAX_EXTRAS} extras.` });
    const rangosDe = (rangos) => (Array.isArray(rangos) ? rangos : []).map(r => { const y = objeto(r); const aConvenir = y.aConvenir === true; return { desde: aEntero(y.desde), hasta: aConvenir || y.hasta === null || y.hasta === undefined || y.hasta === '' ? null : aEntero(y.hasta), aConvenir, dias: aConvenir ? null : aEntero(y.dias) }; });
    const claves = (x) => (Array.isArray(x) ? x.filter(c => typeof c === 'string' && c.length <= 80) : []);
    const extras = lista.map(e => {
      const x = objeto(e); const u = objeto(x.unidades); const a = objeto(x.alcance);
      return {
        clave: texto(x.clave), tipo: texto(x.tipo), nombre: texto(x.nombre), etiqueta: texto(x.etiqueta), ayuda: texto(x.ayuda) || null, aviso: texto(x.aviso) || null,
        activo: x.activo !== false, diasFijos: aEntero(x.diasFijos),
        unidades: { incluidas: aEntero(u.incluidas), cada: aEntero(u.cada), dias: aEntero(u.dias), max: aEntero(u.max) },
        opciones: (Array.isArray(x.opciones) ? x.opciones : []).map(o => { const y = objeto(o); return { clave: texto(y.clave), nombre: texto(y.nombre), aviso: texto(y.aviso) || null, rangos: rangosDe(y.rangos) }; }),
        alcance: { todos: a.todos !== false, lineas: claves(a.lineas), categorias: claves(a.categorias), productos: claves(a.productos) }
      };
    });
    return db.transaccion(async (tx) => {
      const versionId = await this._asegurarBorrador(tx, usuario.id);
      const actual = await tablaRepository.cargarTabla({ id: versionId }, tx);
      const catalogo = { lineas: actual.lineas.map(l => l.clave), categorias: actual.categoriasLista.map(c => c.clave), productos: Object.keys(actual.productos) };
      const usadas = new Set();
      const nombres = new Set();
      extras.forEach((e, i) => {
        const r = v.validarExtraCatalogo(e, catalogo);
        if (!r.ok) Object.assign(campos, aCampos(`extras.${i}`, r.errores));
        const n = e.nombre.toLowerCase();
        if (nombres.has(n)) campos[`extras.${i}.nombre`] = 'Ya hay otro extra con ese nombre.';
        nombres.add(n);
        // Clave estable: la que traía; si es nuevo, sale del nombre.
        if (!e.clave || usadas.has(e.clave)) { const base = v.aClave(e.nombre); let k = base; let j = 2; while (usadas.has(k) || (!e.clave && actual.extras.some(x => x.clave === k))) k = `${base}-${j++}`; e.clave = k; }
        usadas.add(e.clave);
        const opcionesUsadas = new Set();
        for (const o of e.opciones) { if (!o.clave || opcionesUsadas.has(o.clave)) { const base = v.aClave(o.nombre); let k = base; let j = 2; while (opcionesUsadas.has(k)) k = `${base}-${j++}`; o.clave = k; } opcionesUsadas.add(o.clave); }
      });
      const publicados = new Set((await borradorRepository.extrasClavesPublicadas()).map(x => x.clave));
      for (const previo of actual.extras) {
        if (!usadas.has(previo.clave) && publicados.has(previo.clave)) campos.extras = `«${previo.nombre}» ya se usó en una versión publicada: no se puede quitar, ocúltalo.`;
      }
      if (Object.keys(campos).length) throw errorDeValidacion(REVISA, campos);
      await borradorRepository.guardarExtras(tx, versionId, extras);
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId, entidad: 'extras', clave: 'extras', accion: 'editar', despues: { extras: extras.map(e => e.clave) } });
      return { claves: extras.map(e => e.clave) };
    });
  }

  // Reglas generales: margen, máximo de piezas y el aviso de urgente.
  async guardarReglas(cuerpo, usuario) {
    const b = objeto(cuerpo);
    const reglas = {};
    for (const clave of Object.keys(v.REGLAS)) if (b[clave] !== undefined) reglas[clave] = v.REGLAS[clave].texto ? texto(b[clave]) : aEntero(b[clave]);
    const r = v.validarParametros(reglas);
    if (!r.ok) throw errorDeValidacion(REVISA, aCampos('reglas', r.errores));
    if (!Object.keys(reglas).length) throw errorDeValidacion('No hay reglas para guardar.', {});
    return db.transaccion(async (tx) => {
      const versionId = await this._asegurarBorrador(tx, usuario.id);
      await borradorRepository.guardarReglas(tx, versionId, reglas);
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId, entidad: 'reglas', clave: 'reglas', accion: 'editar', despues: reglas });
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

  // Líneas, categorías y etapas: se renombran, se agregan, se ordenan y se ocultan (no se borran). Lo que usa un producto
  // visible no se puede ocultar.
  async guardarCatalogos(cuerpo, usuario) {
    const b = objeto(cuerpo);
    const campos = {};
    const limpiar = (lista, tipo) => (Array.isArray(lista) ? lista : []).map((x, i) => {
      const y = objeto(x); const nombre = texto(y.nombre);
      if (nombre.length < 2 || nombre.length > 80) campos[`${tipo}.${i}.nombre`] = 'El nombre debe tener de 2 a 80 caracteres.';
      return { clave: texto(y.clave), nombre, activo: y.activo !== false, linea: texto(y.linea) };
    });
    const lineas = limpiar(b.lineas, 'lineas'); const etapas = limpiar(b.etapas, 'etapas'); const categorias = limpiar(b.categorias, 'categorias');
    for (const [tipo, lista, grupo] of [['lineas', lineas, () => ''], ['etapas', etapas, () => ''], ['categorias', categorias, (x) => x.linea]]) {
      const vistos = new Set();
      lista.forEach((x, i) => { const k = `${grupo(x)}|${x.nombre.toLowerCase()}`; if (vistos.has(k)) campos[`${tipo}.${i}.nombre`] = 'Ya hay otra con ese nombre.'; vistos.add(k); });
    }
    if (Object.keys(campos).length) throw errorDeValidacion(REVISA, campos);
    return db.transaccion(async (tx) => {
      const versionId = await this._asegurarBorrador(tx, usuario.id);
      const uso = await borradorRepository.usoVisible(tx, versionId);
      const existentes = { lineas: await borradorRepository.lineasDe(tx, versionId), etapas: await borradorRepository.etapasDe(tx, versionId), categorias: await borradorRepository.categoriasDe(tx, versionId) };
      const lineasValidas = new Set([...existentes.lineas.map(l => l.clave)]);
      for (const [tipo, lista] of [['lineas', lineas], ['etapas', etapas], ['categorias', categorias]]) {
        const usadas = new Set(existentes[tipo].map(x => x.clave));
        lista.forEach((x, i) => {
          if (tipo === 'categorias') {
            const previa = existentes.categorias.find(c => c.clave === x.clave);
            if (previa) x.linea = previa.linea; // una categoría no cambia de línea
            else if (!lineasValidas.has(x.linea) && !lineas.some(l => l.clave === x.linea)) campos[`categorias.${i}.linea`] = 'Elige la línea de la categoría.';
          }
          if (!x.clave || !usadas.has(x.clave)) {
            const base = tipo === 'categorias' ? `${x.linea}-${v.aClave(x.nombre)}` : v.aClave(x.nombre).replace(/-/g, '_');
            let k = base; let j = 2; while (usadas.has(k)) k = `${base}${tipo === 'categorias' ? '-' : '_'}${j++}`; x.clave = k; usadas.add(k);
          }
          const enUso = uso[tipo][x.clave] || 0;
          if (!x.activo && enUso) campos[`${tipo}.${i}.activo`] = `No se puede ocultar «${x.nombre}»: la usan ${enUso} ${enUso === 1 ? 'producto visible' : 'productos visibles'}.`;
        });
        // Lo que no vino se conserva al final (no se borra).
        for (const e of existentes[tipo]) if (!lista.some(x => x.clave === e.clave)) lista.push({ clave: e.clave, nombre: e.nombre, activo: Boolean(e.activo), linea: e.linea });
      }
      if (Object.keys(campos).length) throw errorDeValidacion(REVISA, campos);
      for (const [tipo, lista] of [['lineas', lineas], ['etapas', etapas], ['categorias', categorias]]) await borradorRepository.guardarCatalogo(tx, tipo, versionId, lista);
      await borradorRepository.registrarHistorial(tx, { usuarioId: usuario.id, versionId, entidad: 'catalogos', clave: 'catalogos', accion: 'editar', despues: { lineas: lineas.length, categorias: categorias.length, etapas: etapas.length } });
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
