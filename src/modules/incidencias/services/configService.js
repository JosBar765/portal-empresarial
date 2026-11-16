// src/modules/incidencias/services/configService.js
// La configuración del módulo editable desde Configuración: países, catálogos, prioridades y reglas, parámetros e historial.
// Nada se borra: lo que ya no sirve se apaga (activo = 0) para no perder el historial de las incidencias que lo usaron.
const configRepository = require('../repositories/configRepository');
const parametroRepository = require('../repositories/parametroRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const parametros = require('../parametros');
const { IMPACTOS, IMPACTO_TEXTOS } = require('../constantes');
const { errorDeValidacion, limpio } = require('../errores');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');

const AVISO_POR_DEFECTO = 'Todavía no está disponible en tu país';
const COLORES = ['rojo', 'naranja', 'amarillo', 'verde', 'azul', 'gris'];
const REVISAR = 'Revisa los datos marcados.';

const comoBooleano = (v) => (v === true || v === 'true' || v === 1 || v === '1' ? true : (v === false || v === 'false' || v === 0 || v === '0' ? false : null));

class ConfigService {
  async _historial(usuario, entidad, clave, accion, antes, despues) {
    try { await configRepository.registrarHistorial({ usuarioId: usuario.id, entidad, clave, accion, antes, despues }); } catch (error) { console.error('[Incidencias] No se pudo anotar el cambio de configuración:', error.message); }
  }

  // --- Estado general ---

  // Lo que conviene mirar antes de abrir el módulo a más gente.
  async estado() {
    const [paises, tecnicos, tiendas, verificadores, rolesConfiguran, rolesVerifican] = await Promise.all([
      configRepository.paises(), configRepository.tecnicosActivos(), configRepository.tiendasHabilitadas(), configRepository.verificadores(),
      configRepository.rolesConPermiso('incidencias.configurar', 0), configRepository.rolesConPermiso('incidencias.verificar', 0)
    ]);
    const conVerificador = (t) => verificadores.some(v => v.tienda_id === t.id) || verificadores.some(v => v.pais_id === t.pais_id);
    return {
      paisesHabilitados: paises.filter(p => p.habilitado).length,
      tecnicosActivos: tecnicos,
      tiendasSinVerificador: tiendas.filter(t => !conVerificador(t)).length,
      rolesQueConfiguran: rolesConfiguran,
      rolesQueVerifican: rolesVerifican
    };
  }

  // --- Países ---

  async paises() {
    const filas = await configRepository.paises();
    return { paises: filas.map(p => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, habilitado: Boolean(p.habilitado), aviso: p.aviso || AVISO_POR_DEFECTO, tiendas: Number(p.tiendas), incidencias30: Number(p.incidencias30) })) };
  }

  async actualizarPais(usuario, paisId, datos) {
    const antes = await configRepository.pais(paisId);
    if (!antes) throw new ErrorDeNegocio('Ese país no existe.', 404);
    const habilitado = comoBooleano(datos.habilitado);
    if (habilitado === null) throw errorDeValidacion(REVISAR, { habilitado: 'Indica si el país está encendido o apagado.' });
    const aviso = datos.aviso === undefined ? (antes.aviso || AVISO_POR_DEFECTO) : limpio(datos.aviso);
    if (!aviso) throw errorDeValidacion(REVISAR, { aviso: 'Escribe el aviso que verá quien reporte desde ese país.' });
    if (aviso.length > 160) throw errorDeValidacion(REVISAR, { aviso: 'El aviso admite hasta 160 caracteres.' });
    await configRepository.guardarPais(paisId, habilitado, aviso);
    await this._historial(usuario, 'pais', antes.nombre, 'cambiar', { habilitado: Boolean(antes.habilitado), aviso: antes.aviso }, { habilitado, aviso });
    return this.paises();
  }

  // --- Catálogos ---

  _catalogo(nombre) {
    const def = configRepository.definicion(nombre);
    if (!def) throw new ErrorDeNegocio('Ese catálogo no existe.', 404);
    return def;
  }

  async listarCatalogo(catalogo) {
    this._catalogo(catalogo);
    const filas = await configRepository.listarCatalogo(catalogo);
    return { catalogo, items: filas.map(f => ({ ...f, activo: Boolean(f.activo) })) };
  }

  // Valida y arma los campos de un catálogo; `actual` es el registro que se edita (null al crear).
  async _camposDeCatalogo(catalogo, datos, actual) {
    const campos = {};
    const errores = {};
    const valores = {};
    if (!actual || datos.nombre !== undefined) {
      const nombre = limpio(datos.nombre);
      if (!nombre) errores.nombre = 'Escribe el nombre.';
      else if (nombre.length < 2 || nombre.length > 80) errores.nombre = 'El nombre debe tener entre 2 y 80 caracteres.';
      else valores.nombre = nombre;
    }
    if (datos.orden !== undefined && datos.orden !== '') {
      const orden = Number(datos.orden);
      if (!Number.isInteger(orden) || orden < 0 || orden > 999) errores.orden = 'El orden es un número entre 0 y 999.';
      else valores.orden = orden;
    }
    if (datos.activo !== undefined) {
      const activo = comoBooleano(datos.activo);
      if (activo === null) errores.activo = 'Indica si está activo.';
      else valores.activo = activo ? 1 : 0;
    }
    if (catalogo === 'categorias' && datos.especialidadId !== undefined) {
      const id = datos.especialidadId === null || datos.especialidadId === '' ? null : aEntero(datos.especialidadId);
      if (id !== null && !(await configRepository.existe('incidencia_especialidades', id))) errores.especialidadId = 'Esa especialidad no existe.';
      else valores.especialidad_id = id;
    }
    if (catalogo === 'zonas' && datos.tiendaId !== undefined) {
      const id = datos.tiendaId === null || datos.tiendaId === '' ? null : aEntero(datos.tiendaId);
      if (id !== null && !(await configRepository.existe('tiendas', id))) errores.tiendaId = 'Esa tienda no existe.';
      else valores.tienda_id = id;
    }
    if (catalogo === 'tipos-activo') {
      if (!actual || datos.categoriaId !== undefined) {
        const id = aEntero(datos.categoriaId);
        if (!id) errores.categoriaId = 'Elige la categoría.';
        else if (!(await configRepository.existe('incidencia_categorias', id))) errores.categoriaId = 'Esa categoría no existe.';
        else valores.categoria_id = id;
      }
    }
    if (Object.keys(errores).length) throw errorDeValidacion(REVISAR, errores);
    // El nombre no se repite dentro de su ámbito (la categoría de un activo, la tienda de una zona).
    const nombre = valores.nombre !== undefined ? valores.nombre : (actual && actual.nombre);
    const ambito = {
      excluirId: actual ? actual.id : null,
      categoriaId: valores.categoria_id !== undefined ? valores.categoria_id : (actual && actual.categoria_id),
      tiendaId: valores.tienda_id !== undefined ? valores.tienda_id : (actual && actual.tienda_id)
    };
    if ((valores.nombre !== undefined || valores.categoria_id !== undefined || valores.tienda_id !== undefined) && await configRepository.nombreEnUso(catalogo, nombre, ambito)) {
      throw errorDeValidacion(REVISAR, { nombre: 'Ya existe uno con ese nombre.' });
    }
    Object.assign(campos, valores);
    return campos;
  }

  async crearEnCatalogo(usuario, catalogo, datos) {
    this._catalogo(catalogo);
    const campos = await this._camposDeCatalogo(catalogo, datos, null);
    if (campos.orden === undefined) campos.orden = await configRepository.siguienteOrden(catalogo);
    if (campos.activo === undefined) campos.activo = 1;
    const id = await configRepository.insertarEnCatalogo(catalogo, campos);
    await this._historial(usuario, catalogo, campos.nombre, 'crear', null, campos);
    return this.listarCatalogo(catalogo).then(r => ({ ...r, creadoId: id }));
  }

  async actualizarEnCatalogo(usuario, catalogo, id, datos) {
    this._catalogo(catalogo);
    const actual = await configRepository.obtenerDeCatalogo(catalogo, id);
    if (!actual) throw new ErrorDeNegocio('Ese registro no existe.', 404);
    const campos = await this._camposDeCatalogo(catalogo, datos, actual);
    await configRepository.actualizarEnCatalogo(catalogo, id, campos);
    await this._historial(usuario, catalogo, actual.nombre, campos.activo === 0 ? 'apagar' : (campos.activo === 1 && !actual.activo ? 'encender' : 'cambiar'), actual, { ...actual, ...campos });
    return this.listarCatalogo(catalogo);
  }

  // --- Prioridades y reglas ---

  async listarPrioridades() {
    const [prioridades, reglas] = await Promise.all([configRepository.prioridades(), configRepository.reglas()]);
    return {
      prioridades: prioridades.map(p => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, color: p.color, orden: p.orden, activo: Boolean(p.activo), abiertas: Number(p.abiertas) })),
      reglas: IMPACTOS.map(impacto => ({ impacto, ...IMPACTO_TEXTOS[impacto], prioridadId: (reglas.find(r => r.impacto === impacto) || {}).prioridad_id || null })),
      colores: COLORES
    };
  }

  async crearPrioridad(usuario, datos) {
    const errores = {};
    const codigo = limpio(datos.codigo).toUpperCase();
    const nombre = limpio(datos.nombre);
    const orden = aEntero(datos.orden);
    if (!/^[A-Z]\d{1,2}$/.test(codigo)) errores.codigo = 'El código lleva una letra y uno o dos números, por ejemplo P5.';
    else if (await configRepository.codigoDePrioridadEnUso(codigo)) errores.codigo = 'Ya existe una prioridad con ese código.';
    if (!nombre || nombre.length < 2 || nombre.length > 40) errores.nombre = 'El nombre debe tener entre 2 y 40 caracteres.';
    if (!COLORES.includes(datos.color)) errores.color = 'Elige un color de la lista.';
    if (!orden || orden > 99) errores.orden = 'El orden es un número entre 1 y 99 (1 es la más urgente).';
    if (Object.keys(errores).length) throw errorDeValidacion(REVISAR, errores);
    const id = await configRepository.insertarPrioridad({ codigo, nombre, color: datos.color, orden });
    await this._historial(usuario, 'prioridad', codigo, 'crear', null, { nombre, color: datos.color, orden });
    return { ...(await this.listarPrioridades()), creadoId: id };
  }

  async actualizarPrioridad(usuario, id, datos) {
    const actual = await configRepository.prioridad(id);
    if (!actual) throw new ErrorDeNegocio('Esa prioridad no existe.', 404);
    const errores = {};
    const campos = {};
    if (datos.nombre !== undefined) { const n = limpio(datos.nombre); if (!n || n.length < 2 || n.length > 40) errores.nombre = 'El nombre debe tener entre 2 y 40 caracteres.'; else campos.nombre = n; }
    if (datos.color !== undefined) { if (!COLORES.includes(datos.color)) errores.color = 'Elige un color de la lista.'; else campos.color = datos.color; }
    if (datos.orden !== undefined) { const o = aEntero(datos.orden); if (!o || o > 99) errores.orden = 'El orden es un número entre 1 y 99 (1 es la más urgente).'; else campos.orden = o; }
    if (datos.activo !== undefined) {
      const activo = comoBooleano(datos.activo);
      if (activo === null) errores.activo = 'Indica si está activa.';
      else {
        campos.activo = activo ? 1 : 0;
        if (!activo) {
          const usada = await configRepository.impactosQueUsan(id);
          if (usada.length) errores.activo = `La usa la regla de «${usada.map(i => IMPACTO_TEXTOS[i].nombre).join('», «')}». Cámbiala primero en «Impacto y prioridad».`;
        }
      }
    }
    if (Object.keys(errores).length) throw errorDeValidacion(REVISAR, errores);
    await configRepository.actualizarPrioridad(id, campos);
    await this._historial(usuario, 'prioridad', actual.codigo, campos.activo === 0 ? 'apagar' : 'cambiar', actual, { ...actual, ...campos });
    return this.listarPrioridades();
  }

  // `reglas`: [{ impacto, prioridadId }] con los cuatro impactos.
  async guardarReglas(usuario, datos) {
    const lista = Array.isArray(datos.reglas) ? datos.reglas : [];
    const errores = {};
    const prioridades = await catalogoRepository.prioridades();
    const reglas = [];
    for (const impacto of IMPACTOS) {
      const dada = lista.find(r => r && r.impacto === impacto);
      const id = dada ? aEntero(dada.prioridadId) : null;
      if (!id || !prioridades.some(p => p.id === id)) errores[impacto] = 'Elige una prioridad activa.';
      else reglas.push({ impacto, prioridadId: id });
    }
    if (Object.keys(errores).length) throw errorDeValidacion(REVISAR, errores);
    const antes = await configRepository.reglas();
    await configRepository.guardarReglas(reglas);
    await this._historial(usuario, 'reglas_prioridad', 'impacto', 'cambiar', antes, reglas);
    return this.listarPrioridades();
  }

  // --- Parámetros ---

  async listarParametros() {
    const valores = await parametros.valores();
    return { parametros: parametros.PARAMETROS.map(def => ({ clave: def.clave, etiqueta: def.etiqueta, ayuda: def.ayuda, tipo: def.tipo, unidad: def.unidad || null, min: def.min ?? null, max: def.max ?? null, defecto: def.defecto, valor: valores[def.clave] })) };
  }

  async guardarParametros(usuario, datos) {
    const entrada = datos.valores && typeof datos.valores === 'object' && !Array.isArray(datos.valores) ? datos.valores : {};
    const errores = {};
    const nuevos = {};
    for (const [clave, dado] of Object.entries(entrada)) {
      const def = parametros.PARAMETROS.find(p => p.clave === clave);
      if (!def) { errores[clave] = 'Ese parámetro no existe.'; continue; }
      if (def.tipo === 'booleano') {
        const b = comoBooleano(dado);
        if (b === null) errores[clave] = 'Indica sí o no.'; else nuevos[clave] = b;
      } else {
        const n = Number(dado);
        if (dado === '' || dado === null || !Number.isInteger(n) || n < def.min || n > def.max) errores[clave] = `Escribe un número entero entre ${def.min} y ${def.max}.`;
        else nuevos[clave] = n;
      }
    }
    if (Object.keys(errores).length) throw errorDeValidacion(REVISAR, errores);
    const antes = await parametros.valores();
    for (const [clave, valor] of Object.entries(nuevos)) await configRepository.guardarParametro(`${parametros.PREFIJO}${clave}`, typeof valor === 'boolean' ? (valor ? '1' : '0') : valor);
    if (Object.keys(nuevos).length) await this._historial(usuario, 'parametros', Object.keys(nuevos).join(', '), 'cambiar', Object.fromEntries(Object.keys(nuevos).map(c => [c, antes[c]])), nuevos);
    return this.listarParametros();
  }

  // --- Historial ---

  async historial(query = {}) {
    const limite = Math.min(Math.max(aEntero(query.limite) || 50, 1), 200);
    const filas = await configRepository.historial(limite);
    const objeto = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
    return { cambios: filas.map(f => ({ id: f.id, entidad: f.entidad, clave: f.clave, accion: f.accion, usuario: f.usuario, antes: objeto(f.antes), despues: objeto(f.despues), creadoEn: f.creado_en })) };
  }
}

module.exports = new ConfigService();
