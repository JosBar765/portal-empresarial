// src/modules/proyectos/services/clienteService.js
// Empresas de la base global y sus contactos: registrar, buscar, editar, avisar de duplicados y marcar «No contactar».
// Las reglas salen de los ajustes del administrador (`empresas.*`); el alcance por país lo da `alcanceService`.
const db = require('../../../config/database');
const clienteRepository = require('../repositories/clienteRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const alcanceService = require('./alcanceService');
const configService = require('./configService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion, errorDePosibleDuplicado } = require('../errores');
const { definicion } = require('../catalogos');
const duplicados = require('../duplicados');
const telefonos = require('../telefonos');

const POR_PAGINA = 50;
const ESTADOS = ['activa', 'inactiva', 'no_contactar'];
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const exigir = (usuario, permiso, mensaje) => { if (!tiene(usuario, permiso)) throw new ErrorDeNegocio(mensaje, 403); };
const noExiste = () => new ErrorDeNegocio('Esa empresa no existe o no es de tus países.', 404);
const limpio = (valor) => String(valor == null ? '' : valor).trim();

// Dirección web: acepta «banco.com» o «https://banco.com»; guarda siempre con el esquema. Devuelve null si no es válida.
function normalizarSitioWeb(texto) {
  const crudo = limpio(texto);
  if (!crudo) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

async function catalogoActivo(id, valor) {
  const idNumerico = aEntero(valor);
  if (idNumerico === null) return null;
  const fila = await catalogoRepository.obtener(definicion(id), idNumerico);
  return fila && fila.activo ? fila : null;
}

class ClienteService {
  // --- Lectura ---

  async opciones(usuario) {
    const alcance = await alcanceService.paisesDe(usuario);
    const [nichos, estructuras, areas, motivos, paises, ajustes] = await Promise.all([
      catalogoRepository.listar(definicion('nichos')),
      catalogoRepository.listar(definicion('estructuras')),
      catalogoRepository.listar(definicion('areas')),
      catalogoRepository.listar(definicion('no_contactar')),
      configService.paises(),
      configService.valores()
    ]);
    const activas = (filas) => filas.filter(f => f.activo).map(f => ({ id: f.id, nombre: f.nombre }));
    return {
      nichos: activas(nichos), estructuras: activas(estructuras), areas: activas(areas), motivosNoContactar: activas(motivos),
      paises: paises.filter(p => alcance.ids.includes(p.paisId)).map(p => ({
        id: p.paisId, codigo: p.codigo, nombre: p.nombre, prefijoTelefono: p.prefijoTelefono, formatoTelefono: p.formatoTelefono
      })),
      ajustes: {
        ciudadObligatoria: ajustes['empresas.ciudad_obligatoria'], contactoObligatorio: ajustes['empresas.contacto_obligatorio'],
        telefonoOCorreoObligatorio: ajustes['empresas.telefono_o_correo_obligatorio'], sitioWebObligatorio: ajustes['empresas.sitio_web_obligatorio']
      },
      permisos: this._permisos(usuario)
    };
  }

  _permisos(usuario) {
    return {
      registrar: tiene(usuario, 'proyectos.clientes.registrar'),
      importar: tiene(usuario, 'proyectos.clientes.importar'),
      reactivar: tiene(usuario, 'proyectos.corregir')
    };
  }

  async _configuracionDePaises() {
    return new Map((await configService.paises()).map(p => [p.paisId, p]));
  }

  _aEmpresa(fila, paises) {
    const pais = paises.get(fila.pais_id);
    return {
      id: fila.id, nombre: fila.nombre, nichoId: fila.nicho_id, nicho: fila.nicho, paisId: fila.pais_id, pais: fila.pais,
      ciudad: fila.ciudad, telefono: fila.telefono, telefonoTexto: telefonos.formatear(fila.telefono, pais),
      estructuraId: fila.estructura_id, estructura: fila.estructura, estado: fila.estado,
      enProyecto: Boolean(Number(fila.en_proyecto)), contactos: Number(fila.contactos)
    };
  }

  async listar(usuario, consulta = {}) {
    const alcance = await alcanceService.paisesDe(usuario);
    const pagina = Math.max(aEntero(consulta.pagina) || 1, 1);
    const estado = ESTADOS.includes(consulta.estado) ? consulta.estado : (consulta.estado === 'todas' ? null : 'activa');
    const filtrosConsulta = {
      paisIds: alcance.ids, busqueda: limpio(consulta.busqueda).slice(0, 100),
      nichoId: aEntero(consulta.nicho), paisId: aEntero(consulta.pais), estado
    };
    const { filas, total } = await clienteRepository.listar(filtrosConsulta, POR_PAGINA, (pagina - 1) * POR_PAGINA);
    const paises = await this._configuracionDePaises();
    return {
      items: filas.map(f => this._aEmpresa(f, paises)), total, pagina, porPagina: POR_PAGINA,
      hayMas: pagina * POR_PAGINA < total, paisesVisibles: alcance.ids.length
    };
  }

  async obtener(usuario, id) {
    const alcance = await alcanceService.paisesDe(usuario);
    const empresaId = aEntero(id);
    const fila = empresaId === null ? null : await clienteRepository.obtener(empresaId, alcance.ids);
    if (!fila) throw noExiste();
    const paises = await this._configuracionDePaises();
    const pais = paises.get(fila.pais_id);
    const [contactos, eventos] = await Promise.all([clienteRepository.listarContactos(fila.id), clienteRepository.listarEventos(fila.id)]);
    return {
      ...this._aEmpresa(fila, paises),
      direccion: fila.direccion, sitioWeb: fila.sitio_web, origen: fila.origen, tiendaOrigen: fila.tienda_origen,
      creadoPor: fila.creado_por_nombre, creadoEn: fila.creado_en,
      contactos: contactos.map(c => ({
        id: c.id, areaId: c.area_id, area: c.area, nombre: c.nombre, cargo: c.cargo, telefono: c.telefono,
        telefonoTexto: telefonos.formatear(c.telefono, pais), correo: c.correo, principal: Boolean(c.principal), activo: Boolean(c.activo)
      })),
      eventos: eventos.map(e => ({
        accion: e.accion, estadoAnterior: e.estado_anterior, estadoNuevo: e.estado_nuevo, motivo: e.motivo, nota: e.nota,
        usuario: e.usuario, creadoEn: e.creado_en
      })),
      proyectos: [],
      permisos: this._permisos(usuario)
    };
  }

  // --- Validación ---

  // Valida y normaliza una empresa (y su contacto al crear). Devuelve los valores listos para guardar o lanza un 400
  // con el error de cada campo.
  async _validar(usuario, datos, { crear }) {
    const campos = {};
    const ajustes = await configService.valores();
    const alcance = await alcanceService.paisesDe(usuario);

    const nombre = limpio(datos.nombre);
    if (!nombre) campos.nombre = 'Escribe el nombre de la empresa.';
    else if (nombre.length > 150) campos.nombre = 'Máximo 150 caracteres.';

    const paisId = aEntero(datos.paisId);
    if (paisId === null) campos.paisId = 'Elige un país.';
    else if (!alcance.ids.includes(paisId)) campos.paisId = 'Solo registras empresas de tus países.';

    if (!await catalogoActivo('nichos', datos.nichoId)) campos.nichoId = 'Elige un nicho de la lista.';

    let estructuraId = aEntero(datos.estructuraId);
    if (datos.estructuraId === undefined || datos.estructuraId === null || datos.estructuraId === '') {
      const primera = (await catalogoRepository.listar(definicion('estructuras'))).find(e => e.activo);
      estructuraId = primera ? primera.id : null;
    } else if (!await catalogoActivo('estructuras', datos.estructuraId)) campos.estructuraId = 'Elige una estructura de la lista.';

    const ciudad = limpio(datos.ciudad);
    if (ciudad.length > 100) campos.ciudad = 'Máximo 100 caracteres.';
    else if (!ciudad && ajustes['empresas.ciudad_obligatoria']) campos.ciudad = 'Escribe la ciudad.';

    const direccion = limpio(datos.direccion);
    if (direccion.length > 255) campos.direccion = 'Máximo 255 caracteres.';

    let sitioWeb = normalizarSitioWeb(datos.sitioWeb);
    if (sitioWeb === null) { campos.sitioWeb = 'Escribe una dirección web válida, por ejemplo banco.com.'; sitioWeb = ''; }
    else if (sitioWeb.length > 255) campos.sitioWeb = 'Máximo 255 caracteres.';
    else if (!sitioWeb && ajustes['empresas.sitio_web_obligatorio']) campos.sitioWeb = 'Escribe el sitio web.';

    const pais = paisId !== null && !campos.paisId ? (await this._configuracionDePaises()).get(paisId) : null;
    let telefono = null;
    if (limpio(datos.telefono)) {
      const r = telefonos.normalizar(datos.telefono, pais || {});
      if (r.ok) telefono = r.telefono; else campos.telefono = r.error;
    }

    let contacto = null;
    const c = datos.contacto || {};
    if (crear && [c.nombre, c.cargo, c.telefono, c.correo].some(v => limpio(v))) {
      const valido = await this._validarContacto(c, pais, campos, 'contacto.');
      contacto = valido;
    }
    if (crear && !contacto && ajustes['empresas.contacto_obligatorio'] && !campos['contacto.nombre']) {
      campos['contacto.nombre'] = 'Agrega al menos un contacto de la empresa.';
    }

    // Hace falta una forma de contactar: el teléfono de la empresa o el de un contacto (o su correo).
    if (!campos.telefono && !telefono && ajustes['empresas.telefono_o_correo_obligatorio']) {
      const contactoSirve = crear && contacto && (contacto.telefono || contacto.correo);
      if (!contactoSirve) campos.telefono = 'Escribe un teléfono (o un contacto con teléfono o correo).';
    }

    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
    return {
      valores: {
        nombre, nombreNormalizado: duplicados.normalizarNombre(nombre), nichoId: aEntero(datos.nichoId), paisId, ciudad: ciudad || null,
        direccion: direccion || null, sitioWeb: sitioWeb || null, telefono, estructuraId
      },
      contacto
    };
  }

  // Valida un contacto; deja los errores en `campos` con el prefijo dado y devuelve el contacto normalizado (o null).
  async _validarContacto(c, pais, campos, prefijo = '') {
    const marca = (clave, mensaje) => { campos[`${prefijo}${clave}`] = mensaje; };
    const nombre = limpio(c.nombre);
    if (!nombre) marca('nombre', 'Escribe el nombre del contacto.');
    else if (nombre.length > 150) marca('nombre', 'Máximo 150 caracteres.');
    const area = await catalogoActivo('areas', c.areaId);
    if (!area) marca('areaId', 'Elige el área del contacto.');
    const cargo = limpio(c.cargo);
    if (cargo.length > 100) marca('cargo', 'Máximo 100 caracteres.');
    let telefono = null;
    if (limpio(c.telefono)) {
      const r = telefonos.normalizar(c.telefono, pais || {});
      if (r.ok) telefono = r.telefono; else marca('telefono', r.error);
    }
    const correo = limpio(c.correo);
    if (correo && (!CORREO.test(correo) || correo.length > 150)) marca('correo', 'Escribe un correo válido.');
    if (!nombre || !area) return null;
    return { areaId: area.id, nombre, cargo: cargo || null, telefono, correo: correo || null, principal: Boolean(c.principal) };
  }

  // --- Duplicados ---

  async _coincidencias(usuario, { nombre, ciudad, telefono, paisId }, excluirId = null) {
    const alcance = await alcanceService.paisesDe(usuario);
    const ajustes = await configService.valores();
    const normalizado = duplicados.normalizarNombre(nombre);
    const palabra = normalizado.split(' ').filter(t => t.length >= 3).sort((a, b) => b.length - a.length)[0] || null;
    const candidatos = await clienteRepository.candidatosDeDuplicado({ paisIds: alcance.ids, paisId, palabra, telefono, excluirId });
    const paises = await this._configuracionDePaises();
    return duplicados.coincidencias({ nombre, ciudad, telefono, paisId }, candidatos, {
      similitudMinima: ajustes['empresas.similitud_minima'],
      porNombreCiudad: ajustes['empresas.duplicado_por_nombre_ciudad'],
      porTelefono: ajustes['empresas.duplicado_por_telefono']
    }).map(({ cliente, razones, similitud }) => ({
      id: cliente.id, nombre: cliente.nombre, ciudad: cliente.ciudad, pais: cliente.pais, nicho: cliente.nicho, estado: cliente.estado,
      telefonoTexto: telefonos.formatear(cliente.telefono, paises.get(cliente.pais_id)), razones, similitud
    }));
  }

  // Revisa mientras se escribe: no guarda nada. Con datos incompletos o inválidos responde «sin coincidencias».
  async revisarDuplicados(usuario, datos) {
    exigir(usuario, 'proyectos.clientes.registrar', 'No tienes permiso para registrar empresas.');
    const paisId = aEntero(datos.paisId);
    const alcance = await alcanceService.paisesDe(usuario);
    if (paisId === null || !alcance.ids.includes(paisId) || !limpio(datos.nombre)) return { duplicados: [] };
    const pais = (await this._configuracionDePaises()).get(paisId);
    const r = limpio(datos.telefono) ? telefonos.normalizar(datos.telefono, pais || {}) : { ok: false };
    return { duplicados: await this._coincidencias(usuario, { nombre: datos.nombre, ciudad: datos.ciudad, telefono: r.ok ? r.telefono : null, paisId }, aEntero(datos.excluirId)) };
  }

  // --- Escritura ---

  async crear(usuario, datos, { confirmarDuplicado = false } = {}) {
    exigir(usuario, 'proyectos.clientes.registrar', 'No tienes permiso para registrar empresas.');
    const { valores, contacto } = await this._validar(usuario, datos, { crear: true });
    if (!confirmarDuplicado) {
      const parecidas = await this._coincidencias(usuario, valores);
      if (parecidas.length) throw errorDePosibleDuplicado(parecidas);
    }
    const tiendaOrigenId = await alcanceService.tiendaDe(usuario.id);
    const id = await db.transaccion(async (tx) => {
      const clienteId = await clienteRepository.insertar(tx, { ...valores, creadoPor: usuario.id, tiendaOrigenId, origen: 'asesor' });
      if (contacto) await clienteRepository.insertarContacto(tx, { ...contacto, clienteId, principal: true, creadoPor: usuario.id });
      return clienteId;
    });
    return this.obtener(usuario, id);
  }

  async actualizar(usuario, id, datos, { confirmarDuplicado = false } = {}) {
    exigir(usuario, 'proyectos.clientes.registrar', 'No tienes permiso para editar empresas.');
    const actual = await this.obtener(usuario, id);
    const mezcla = {
      nombre: actual.nombre, nichoId: actual.nichoId, paisId: actual.paisId, ciudad: actual.ciudad, direccion: actual.direccion,
      sitioWeb: actual.sitioWeb, telefono: actual.telefono, estructuraId: actual.estructuraId, ...datos
    };
    const { valores } = await this._validar(usuario, mezcla, { crear: false });
    const cambioDeIdentidad = valores.nombreNormalizado !== duplicados.normalizarNombre(actual.nombre) || valores.paisId !== actual.paisId
      || (valores.ciudad || '') !== (actual.ciudad || '') || valores.telefono !== actual.telefono;
    if (cambioDeIdentidad && !confirmarDuplicado) {
      const parecidas = await this._coincidencias(usuario, valores, actual.id);
      if (parecidas.length) throw errorDePosibleDuplicado(parecidas);
    }
    await db.transaccion(tx => clienteRepository.actualizar(tx, actual.id, {
      nombre: valores.nombre, nombre_normalizado: valores.nombreNormalizado, nicho_id: valores.nichoId, pais_id: valores.paisId,
      ciudad: valores.ciudad, direccion: valores.direccion, sitio_web: valores.sitioWeb, telefono: valores.telefono, estructura_id: valores.estructuraId
    }));
    return this.obtener(usuario, actual.id);
  }

  // `accion`: no_contactar | inactivar (con motivo del catálogo) o reactivar (con una nota obligatoria; solo `proyectos.corregir`).
  async cambiarEstado(usuario, id, { accion, motivoId, nota }) {
    const actual = await this.obtener(usuario, id);
    const texto = limpio(nota);
    if (texto.length > 500) throw errorDeValidacion('Revisa los datos marcados.', { nota: 'Máximo 500 caracteres.' });
    let nuevo;
    let motivo = null;
    if (accion === 'reactivar') {
      exigir(usuario, 'proyectos.corregir', 'Solo un supervisor o el administrador puede reactivar una empresa.');
      if (actual.estado === 'activa') throw new ErrorDeNegocio('Esa empresa ya está activa.', 409);
      if (!texto) throw errorDeValidacion('Revisa los datos marcados.', { nota: 'Escribe el motivo de la reactivación.' });
      nuevo = 'activa';
    } else if (accion === 'no_contactar' || accion === 'inactivar') {
      exigir(usuario, 'proyectos.clientes.registrar', 'No tienes permiso para cambiar el estado de una empresa.');
      nuevo = accion === 'no_contactar' ? 'no_contactar' : 'inactiva';
      if (actual.estado === nuevo) throw new ErrorDeNegocio(`Esa empresa ya está en «${nuevo === 'no_contactar' ? 'No contactar' : 'inactiva'}».`, 409);
      if (nuevo === 'inactiva' && actual.estado !== 'activa') throw new ErrorDeNegocio('Solo una empresa activa puede pasar a inactiva.', 409);
      const fila = await catalogoActivo('no_contactar', motivoId);
      if (!fila) throw errorDeValidacion('Revisa los datos marcados.', { motivoId: 'Elige un motivo de la lista.' });
      motivo = fila.nombre;
    } else {
      throw errorDeValidacion('Revisa los datos marcados.', { accion: 'Elige una acción válida.' });
    }
    await db.transaccion(async (tx) => {
      await clienteRepository.cambiarEstado(tx, actual.id, nuevo);
      await clienteRepository.registrarEvento(tx, {
        clienteId: actual.id, usuarioId: usuario.id, accion, estadoAnterior: actual.estado, estadoNuevo: nuevo, motivo, nota: texto || null
      });
    });
    return this.obtener(usuario, actual.id);
  }

  // --- Contactos ---

  async _paisDeEmpresa(empresa) {
    return (await this._configuracionDePaises()).get(empresa.paisId);
  }

  async agregarContacto(usuario, clienteId, datos) {
    exigir(usuario, 'proyectos.clientes.registrar', 'No tienes permiso para editar empresas.');
    const empresa = await this.obtener(usuario, clienteId);
    const campos = {};
    const contacto = await this._validarContacto(datos, await this._paisDeEmpresa(empresa), campos);
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
    await db.transaccion(async (tx) => {
      const sinActivos = (await clienteRepository.contarContactosActivos(empresa.id, tx)) === 0;
      const principal = contacto.principal || sinActivos;
      if (principal) await clienteRepository.quitarPrincipales(tx, empresa.id);
      await clienteRepository.insertarContacto(tx, { ...contacto, clienteId: empresa.id, principal, creadoPor: usuario.id });
    });
    return this.obtener(usuario, empresa.id);
  }

  async _contactoVisible(usuario, contactoId) {
    const idNumerico = aEntero(contactoId);
    const contacto = idNumerico === null ? null : await clienteRepository.obtenerContacto(idNumerico);
    if (!contacto) throw new ErrorDeNegocio('Ese contacto no existe.', 404);
    return { contacto, empresa: await this.obtener(usuario, contacto.cliente_id) };
  }

  async actualizarContacto(usuario, contactoId, datos) {
    exigir(usuario, 'proyectos.clientes.registrar', 'No tienes permiso para editar empresas.');
    const { contacto: actual, empresa } = await this._contactoVisible(usuario, contactoId);
    const campos = {};
    const contacto = await this._validarContacto({ ...actual, areaId: actual.area_id, ...datos }, await this._paisDeEmpresa(empresa), campos);
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
    await db.transaccion(async (tx) => {
      if (contacto.principal) await clienteRepository.quitarPrincipales(tx, empresa.id, actual.id);
      await clienteRepository.actualizarContacto(tx, actual.id, contacto);
    });
    return this.obtener(usuario, empresa.id);
  }

  async cambiarActivoContacto(usuario, contactoId, activo) {
    exigir(usuario, 'proyectos.clientes.registrar', 'No tienes permiso para editar empresas.');
    if (typeof activo !== 'boolean') throw errorDeValidacion('Revisa los datos marcados.', { activo: 'Elige activar o desactivar.' });
    const { contacto, empresa } = await this._contactoVisible(usuario, contactoId);
    const ajustes = await configService.valores();
    await db.transaccion(async (tx) => {
      if (!activo && ajustes['empresas.contacto_obligatorio'] && (await clienteRepository.contarContactosActivos(empresa.id, tx)) <= 1 && contacto.activo) {
        throw new ErrorDeNegocio('Cada empresa necesita al menos un contacto activo.', 409);
      }
      await clienteRepository.cambiarActivoContacto(tx, contacto.id, activo);
      // Si el principal se desactivó, el primer contacto activo pasa a serlo.
      const restantes = (await clienteRepository.listarContactos(empresa.id, tx)).filter(c => c.activo);
      if (restantes.length && !restantes.some(c => c.principal)) {
        await clienteRepository.actualizarContacto(tx, restantes[0].id, { ...restantes[0], areaId: restantes[0].area_id, principal: true });
      }
    });
    return this.obtener(usuario, empresa.id);
  }
}

module.exports = new ClienteService();
