// src/modules/viaticos/services/catalogoService.js
// Servicio genérico de los catálogos simples: todo se deduce de la definición (catalogos.js).
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { CATALOGOS } = require('../catalogos');
const repo = require('../repositories/catalogoRepository');
const referencias = require('../repositories/referenciaRepository');
const { Validador, cuerpoObjeto, validarActivo } = require('../validacion');
const { errorDeValidacion, esDuplicado } = require('../errores');
const { aCamel } = require('../utilidades');
const { msg } = require('../mensajes');

function crearServicio(def) {
  // En edición se omiten las columnas que solo se fijan al crear.
  function validar(cuerpo, enEdicion) {
    const v = new Validador();
    const datos = cuerpoObjeto(cuerpo);
    const valores = {};
    for (const col of def.columnas) {
      if (enEdicion && col.soloAlta) continue;
      const campo = aCamel(col.columna);
      if (col.tipo === 'texto') valores[col.columna] = v.texto(datos, campo, col.etiqueta, col);
      else if (col.tipo === 'pais') valores[col.columna] = v.id(datos, campo, col.etiqueta);
      else {
        const valor = v.booleano(datos, campo, col.etiqueta);
        if (valor !== undefined) valores[col.columna] = valor;
      }
    }
    v.lanzar();
    return valores;
  }

  async function verificarPais(valores) {
    if (valores.pais_id !== undefined && !(await referencias.paisExiste(valores.pais_id))) {
      throw errorDeValidacion(msg('validacion.revisar'), { paisId: msg('pais.noExiste') });
    }
  }

  // Un duplicado se detecta con la clave única de la base (sin carrera entre dos altas simultáneas).
  async function conDuplicados(valores, accion) {
    try {
      return await accion();
    } catch (error) {
      if (!esDuplicado(error)) throw error;
      const detalle = def.unica
        .map(col => def.columnas.find(c => c.columna === col))
        .filter(col => col.tipo !== 'pais' && valores[col.columna] !== undefined)
        .map(col => `${col.etiqueta.toLowerCase()} «${valores[col.columna]}»`)
        .join(' y ');
      const enPais = def.unica.includes('pais_id') ? ' en ese país' : '';
      throw new ErrorDeNegocio(msg('catalogo.duplicado', { articulo: def.articulo, detalle: `${detalle}${enPais}` }), 409);
    }
  }

  async function leer(id) {
    const fila = await repo.obtenerPorId(def, id);
    if (!fila) throw new ErrorDeNegocio(msg('catalogo.noExiste', { articulo: def.articulo, id }), 404);
    return fila;
  }

  const esProtegido = fila => Boolean(def.protegidos) && def.protegidos.includes(fila.nombre);

  return {
    listar: () => repo.listar(def),

    async crear(cuerpo) {
      const valores = validar(cuerpo, false);
      await verificarPais(valores);
      const id = await conDuplicados(valores, () => repo.insertar(def, valores));
      return leer(id);
    },

    async editar(id, cuerpo) {
      const actual = await leer(id);
      const valores = validar(cuerpo, true);
      if (esProtegido(actual) && valores.nombre !== undefined && valores.nombre !== actual.nombre) {
        throw new ErrorDeNegocio(msg('catalogo.protegidoRenombrar', { nombre: actual.nombre, nuevo: valores.nombre }), 409);
      }
      await conDuplicados(valores, () => repo.actualizar(def, id, valores));
      return leer(id);
    },

    async cambiarActivo(id, cuerpo) {
      const activo = validarActivo(cuerpo);
      const actual = await leer(id);
      if (!activo && esProtegido(actual)) throw new ErrorDeNegocio(msg('catalogo.protegidoDesactivar', { nombre: actual.nombre }), 409);
      await repo.cambiarActivo(def, id, activo);
      return leer(id);
    }
  };
}

// Un servicio por recurso definido en catalogos.js.
const servicios = Object.fromEntries(Object.entries(CATALOGOS).map(([recurso, def]) => [recurso, crearServicio(def)]));

module.exports = { servicios, crearServicio };
