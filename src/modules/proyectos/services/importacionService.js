// src/modules/proyectos/services/importacionService.js
// Importación de empresas desde un CSV. Sin estado en el servidor: la vista previa y la confirmación reciben el
// archivo completo y lo revalidan todo, así que la confirmación nunca confía en lo que mostró la vista previa.
const db = require('../../../config/database');
const clienteRepository = require('../repositories/clienteRepository');
const operacionRepository = require('../repositories/operacionRepository');
const clienteService = require('./clienteService');
const configService = require('./configService');
const campoService = require('./campoService');
const alcanceService = require('./alcanceService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { definicion } = require('../catalogos');
const duplicados = require('../duplicados');
const csv = require('../csv');

const exigirImportar = (usuario) => {
  if (!(usuario.permissions || []).includes('proyectos.clientes.importar')) throw new ErrorDeNegocio('No tienes permiso para importar empresas.', 403);
};

// Columnas de la plantilla y los nombres alternativos que también se reconocen en el encabezado.
const COLUMNAS = [
  ['empresa', ['empresa', 'nombre', 'nombre_empresa', 'nombre_de_la_empresa']],
  ['nicho', ['nicho']],
  ['pais', ['pais']],
  ['ciudad', ['ciudad']],
  ['telefono', ['telefono', 'telefono_empresa']],
  ['direccion', ['direccion']],
  ['sitio_web', ['sitio_web', 'web', 'sitio']],
  ['contacto_nombre', ['contacto_nombre', 'contacto', 'nombre_contacto']],
  ['contacto_area', ['contacto_area', 'area']],
  ['contacto_cargo', ['contacto_cargo', 'cargo']],
  ['contacto_telefono', ['contacto_telefono', 'telefono_contacto']],
  ['contacto_correo', ['contacto_correo', 'correo', 'email']]
];
const OBLIGATORIAS = ['empresa', 'nicho', 'pais'];
const ENCABEZADO_PLANTILLA = ['empresa', 'nicho', 'pais', 'ciudad', 'telefono', 'direccion', 'sitio_web', 'contacto_nombre', 'contacto_area', 'contacto_cargo', 'contacto_telefono', 'contacto_correo'];
const FILA_EJEMPLO = ['Cooperativa Ejemplo R.L.', 'Bancos y cooperativas', 'Guatemala', 'Quetzaltenango', '7765 4400', '3a avenida 4-56 zona 1', 'ejemplo.com', 'Carolina Méndez', 'Compras', 'Jefa de compras', '2234 5678', 'carolina@example.com'];
const MAX_ERRORES_VISIBLES = 50;

const normal = (texto) => csv.clave(texto);
const celda = (fila, indice) => (indice === undefined ? '' : String(fila[indice] == null ? '' : fila[indice]).trim().replace(/^'/, ''));

class ImportacionService {
  // Las columnas de la plantilla son las fijas más una por cada campo propio activo (con su clave como encabezado).
  async plantilla() {
    const campos = await campoService.activos();
    const ejemplo = { texto: 'Dato de ejemplo', numero: '12', si_no: 'Sí', fecha: '2026-01-31' };
    const encabezado = [...ENCABEZADO_PLANTILLA, ...campos.map(c => c.clave)];
    const fila = [...FILA_EJEMPLO, ...campos.map(c => (c.tipo === 'lista' ? c.opciones[0] : ejemplo[c.tipo]))];
    return `﻿${[encabezado, fila].map(f => f.map(csv.escapar).join(',')).join('\r\n')}\r\n`;
  }

  // Lee el archivo y devuelve { filas } (arreglos de celdas, sin encabezado) con el índice de cada columna, o lanza un 400.
  async _leerArchivo(archivo) {
    const ajustes = await configService.valores();
    if (!archivo || !archivo.buffer || !archivo.buffer.length) throw new ErrorDeNegocio('El archivo está vacío. Descarga la plantilla y llénala.', 400);
    const maxMb = ajustes['importacion.max_mb'];
    if (archivo.buffer.length > maxMb * 1024 * 1024) throw new ErrorDeNegocio(`El archivo pesa más de ${maxMb} MB. Divídelo en partes más pequeñas.`, 400);
    const leido = csv.leer(csv.decodificar(archivo.buffer));
    if (leido.error) throw new ErrorDeNegocio(leido.error, 400);
    if (leido.filas.length < 2) throw new ErrorDeNegocio('El archivo no tiene empresas, solo el encabezado o nada. Descarga la plantilla y llénala.', 400);

    const encabezado = leido.filas[0].map(normal);
    const indice = {};
    for (const [nombre, alias] of COLUMNAS) {
      const posicion = encabezado.findIndex(c => alias.includes(c));
      if (posicion >= 0) indice[nombre] = posicion;
    }
    // Columnas de campos propios: se reconocen por su clave o por su etiqueta (sin acentos ni mayúsculas).
    const campos = await campoService.activos();
    const indiceCampos = {};
    for (const c of campos) {
      const posicion = encabezado.findIndex(e => e === c.clave || e === normal(c.etiqueta));
      if (posicion >= 0) indiceCampos[c.clave] = posicion;
    }
    const faltan = OBLIGATORIAS.filter(c => indice[c] === undefined);
    if (faltan.length) throw new ErrorDeNegocio(`Al archivo le faltan las columnas: ${faltan.join(', ')}. Usa la plantilla.`, 400);

    const filas = leido.filas.slice(1);
    const maxFilas = ajustes['importacion.max_filas'];
    if (filas.length > maxFilas) throw new ErrorDeNegocio(`El archivo tiene ${filas.length} filas y el máximo es ${maxFilas}. Divídelo en partes.`, 400);
    return { filas, indice, indiceCampos, ajustes };
  }

  // Revisa cada fila: nueva, duplicada (con la empresa existente) o con error (con el motivo por columna).
  async _analizar(usuario, archivo) {
    const { filas, indice, indiceCampos, ajustes } = await this._leerArchivo(archivo);
    const ctx = await clienteService.contextoDeImportacion(usuario);
    const nichos = new Map([...ctx.catalogos.nichos.values()].map(n => [normal(n.nombre), n]));
    const areas = new Map([...ctx.catalogos.areas.values()].map(a => [normal(a.nombre), a]));
    const paises = new Map();
    for (const p of ctx.paises.values()) { paises.set(normal(p.nombre), p); paises.set(normal(p.codigo), p); }
    const nombresNichos = [...ctx.catalogos.nichos.values()].map(n => n.nombre);

    const vistosNombre = new Map();
    const vistosTelefono = new Map();
    const resultado = [];

    for (let i = 0; i < filas.length; i += 1) {
      const fila = filas[i];
      const linea = i + 2; // la 1 es el encabezado
      const crudo = Object.fromEntries(Object.keys(indice).map(c => [c, celda(fila, indice[c])]));
      const errores = {};
      const salida = { linea, estado: 'nueva', empresa: crudo.empresa, pais: crudo.pais, ciudad: crudo.ciudad, telefono: crudo.telefono, errores, duplicadaDe: null };

      const nicho = nichos.get(normal(crudo.nicho));
      if (!crudo.nicho) errores.nicho = 'Falta el nicho.';
      else if (!nicho) errores.nicho = `El nicho «${crudo.nicho}» no existe. Nichos: ${nombresNichos.slice(0, 6).join(', ')}…`;
      const pais = paises.get(normal(crudo.pais));
      if (!crudo.pais) errores.pais = 'Falta el país.';
      else if (!pais) errores.pais = `El país «${crudo.pais}» no existe.`;
      else if (!ctx.alcance.ids.includes(pais.paisId)) errores.pais = 'País no asignado a tu usuario.';

      const extraCrudo = Object.fromEntries(Object.keys(indiceCampos).map(c => [c, celda(fila, indiceCampos[c])]));
      const datos = {
        datosExtra: extraCrudo,
        nombre: crudo.empresa, nichoId: nicho ? nicho.id : '', paisId: pais ? pais.paisId : '', ciudad: crudo.ciudad,
        telefono: crudo.telefono, direccion: crudo.direccion, sitioWeb: crudo.sitio_web
      };
      const hayContacto = ['contacto_nombre', 'contacto_area', 'contacto_cargo', 'contacto_telefono', 'contacto_correo'].some(c => crudo[c]);
      if (hayContacto) {
        const area = areas.get(normal(crudo.contacto_area));
        if (crudo.contacto_area && !area) errores.contacto_area = `El área «${crudo.contacto_area}» no existe.`;
        datos.contacto = { nombre: crudo.contacto_nombre, areaId: area ? area.id : '', cargo: crudo.contacto_cargo, telefono: crudo.contacto_telefono, correo: crudo.contacto_correo };
      }

      let valido = null;
      try {
        valido = await clienteService.validarEmpresa(usuario, datos, ctx);
      } catch (error) {
        if (!error.campos) throw error;
        const traduccion = { nombre: 'empresa', paisId: 'pais', nichoId: 'nicho', sitioWeb: 'sitio_web', 'contacto.nombre': 'contacto_nombre', 'contacto.areaId': 'contacto_area', 'contacto.cargo': 'contacto_cargo', 'contacto.telefono': 'contacto_telefono', 'contacto.correo': 'contacto_correo' };
        for (const [campo, mensaje] of Object.entries(error.campos)) {
          const columna = traduccion[campo] || campo.replace(/^datosExtra\./, '');
          if (!errores[columna]) errores[columna] = mensaje;
        }
      }

      // Sin un país válido no se puede juzgar el teléfono: se deja solo el error del país.
      if (errores.pais) delete errores.telefono;

      if (valido && !Object.keys(errores).length) {
        const v = valido.valores;
        // Repetida dentro del mismo archivo: la segunda se marca, la primera sigue su camino.
        const claveNombre = `${v.paisId}|${v.nombreNormalizado}|${duplicados.normalizarCiudad(v.ciudad || '')}`;
        const previaNombre = vistosNombre.get(claveNombre);
        const previaTelefono = v.telefono ? vistosTelefono.get(`${v.paisId}|${v.telefono}`) : null;
        if (previaNombre || previaTelefono) {
          errores.empresa = `Repetida en el archivo (línea ${previaNombre || previaTelefono}).`;
        } else {
          vistosNombre.set(claveNombre, linea);
          if (v.telefono) vistosTelefono.set(`${v.paisId}|${v.telefono}`, linea);
          const parecidas = await clienteService.coincidenciasDe(usuario, v, ctx);
          if (parecidas.length) {
            salida.estado = 'duplicada';
            salida.duplicadaDe = { id: parecidas[0].id, nombre: parecidas[0].nombre, ciudad: parecidas[0].ciudad, razones: parecidas[0].razones };
          }
          salida.valido = valido;
        }
      }
      if (Object.keys(errores).length) salida.estado = 'error';
      resultado.push(salida);
    }

    const cuenta = (estado) => resultado.filter(f => f.estado === estado).length;
    return {
      filas: resultado,
      resumen: { total: resultado.length, nuevas: cuenta('nueva'), duplicadas: cuenta('duplicada'), conError: cuenta('error') },
      duplicadasPorDefecto: ajustes['importacion.duplicadas_por_defecto']
    };
  }

  // Lo que ve la persona: sin los objetos internos de validación.
  _publica(analisis) {
    return {
      resumen: analisis.resumen, duplicadasPorDefecto: analisis.duplicadasPorDefecto,
      filas: analisis.filas.map(({ valido, ...fila }) => fila)
    };
  }

  async previsualizar(usuario, archivo) {
    exigirImportar(usuario);
    return this._publica(await this._analizar(usuario, archivo));
  }

  // `duplicadas`: 'omitir' (las deja como están) o 'actualizar' (completa lo que está vacío, sin pisar datos).
  async confirmar(usuario, archivo, { duplicadas, idempotencyKey }) {
    exigirImportar(usuario);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(idempotencyKey || ''))) throw new ErrorDeNegocio('Falta la clave de la operación. Recarga la página e inténtalo de nuevo.', 400);
    if (!['omitir', 'actualizar'].includes(duplicadas)) throw new ErrorDeNegocio('Elige qué hacer con las empresas duplicadas.', 400);
    const llave = `proy-import:${usuario.id}:${idempotencyKey}`;

    const previo = await operacionRepository.resultadoDe(llave);
    if (previo) return { ...previo, repetida: true };

    const analisis = await this._analizar(usuario, archivo);
    const tiendaOrigenId = await alcanceService.tiendaDe(usuario.id);
    let creadas = 0;
    let actualizadas = 0;

    try {
      return await db.transaccion(async (tx) => {
        for (const fila of analisis.filas) {
          if (fila.estado === 'nueva') {
            const { valores, contacto } = fila.valido;
            const clienteId = await clienteRepository.insertar(tx, { ...valores, creadoPor: usuario.id, tiendaOrigenId, origen: 'importacion' });
            if (contacto) await clienteRepository.insertarContacto(tx, { ...contacto, clienteId, principal: true, creadoPor: usuario.id });
            creadas += 1;
          } else if (fila.estado === 'duplicada' && duplicadas === 'actualizar') {
            if (await this._completar(tx, usuario, fila)) actualizadas += 1;
          }
        }
        const resumen = analisis.resumen;
        const resultado = {
          filas: resumen.total, creadas, actualizadas, duplicadas: resumen.duplicadas, conError: resumen.conError, repetida: false,
          errores: analisis.filas.filter(f => f.estado === 'error').slice(0, MAX_ERRORES_VISIBLES).map(({ valido, ...f }) => f)
        };
        const archivoNombre = String(archivo.originalname || 'importacion.csv').replace(/[<>"'&]/g, '').slice(0, 255);
        await clienteRepository.registrarImportacion(tx, { usuarioId: usuario.id, archivo: archivoNombre, filas: resumen.total, creadas, actualizadas, duplicadas: resumen.duplicadas, conError: resumen.conError });
        // La clave se guarda dentro de la misma transacción: dos confirmaciones a la vez (incluso en procesos distintos)
        // no pueden crear dos veces, porque la segunda choca con la clave primaria y se deshace.
        await operacionRepository.registrar(tx, llave, 'proyectos.importar', resultado);
        return resultado;
      });
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        const ganadora = await operacionRepository.resultadoDe(llave);
        if (ganadora) return { ...ganadora, repetida: true };
      }
      throw error;
    }
  }

  // Completa una empresa que ya existía con lo que el archivo trae, sin pisar nada y sin guardar vacíos.
  async _completar(tx, usuario, fila) {
    const existente = await clienteRepository.bloquearParaCompletar(tx, fila.duplicadaDe.id);
    if (!existente) return false;
    const { valores, contacto } = fila.valido;
    const cambios = {};
    if (!existente.ciudad && valores.ciudad) cambios.ciudad = valores.ciudad;
    if (!existente.direccion && valores.direccion) cambios.direccion = valores.direccion;
    if (!existente.sitio_web && valores.sitioWeb) cambios.sitio_web = valores.sitioWeb;
    if (!existente.telefono && valores.telefono) cambios.telefono = valores.telefono;
    // Campos propios: solo los que la empresa todavía no tenía.
    const previo = existente.datos_extra ? (typeof existente.datos_extra === 'string' ? JSON.parse(existente.datos_extra) : existente.datos_extra) : {};
    const faltantes = Object.fromEntries(Object.entries(valores.datosExtra || {}).filter(([k]) => previo[k] === undefined));
    if (Object.keys(faltantes).length) cambios.datos_extra = JSON.stringify({ ...previo, ...faltantes });
    let contactoNuevo = false;
    if (contacto) {
      const contactos = await clienteRepository.listarContactos(existente.id, tx);
      if (!contactos.some(c => normal(c.nombre) === normal(contacto.nombre))) {
        await clienteRepository.insertarContacto(tx, { ...contacto, clienteId: existente.id, principal: contactos.filter(c => c.activo).length === 0, creadoPor: usuario.id });
        contactoNuevo = true;
      }
    }
    await clienteRepository.actualizar(tx, existente.id, cambios);
    return Object.keys(cambios).length > 0 || contactoNuevo;
  }
}

module.exports = new ImportacionService();
module.exports.COLUMNAS_PLANTILLA = ENCABEZADO_PLANTILLA;
