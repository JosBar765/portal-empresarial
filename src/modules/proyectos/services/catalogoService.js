// src/modules/proyectos/services/catalogoService.js
// Altas, ediciones y activación de los catálogos del módulo. Nunca se borra una fila: se desactiva.
// Cada cambio queda en proy_config_historial dentro de la misma transacción.
const db = require('../../../config/database');
const catalogoRepository = require('../repositories/catalogoRepository');
const configRepository = require('../repositories/configRepository');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');
const { definicion } = require('../catalogos');

const CODIGO_MONEDA = /^[A-Z]{3}$/;

function catalogo(id) {
  const def = definicion(id);
  if (!def) throw new ErrorDeNegocio('Ese catálogo no existe.', 404);
  return def;
}

function esBooleano(valor) {
  return valor === true || valor === false || valor === 0 || valor === 1 || valor === '0' || valor === '1';
}

// Valida un campo del catálogo y devuelve su valor para guardar (los sí/no como 0/1, el texto sin espacios sobrantes).
function validarCampo(campo, crudo) {
  switch (campo.tipo) {
    case 'texto': {
      const texto = String(crudo ?? '').trim();
      if (campo.obligatorio && !texto) throw new Error('Escribe un nombre.');
      if (texto.length > campo.max) throw new Error(`Máximo ${campo.max} caracteres.`);
      return texto === '' ? null : texto;
    }
    case 'codigo': {
      const codigo = String(crudo ?? '').trim().toUpperCase();
      if (!CODIGO_MONEDA.test(codigo)) throw new Error('Usa tres letras, por ejemplo GTQ.');
      return codigo;
    }
    case 'booleano':
      if (!esBooleano(crudo)) throw new Error('Elige sí o no.');
      return crudo === true || crudo === 1 || crudo === '1' ? 1 : 0;
    case 'lista':
      if (!campo.opciones.includes(crudo)) throw new Error('Elige una de las opciones.');
      return crudo;
    default: throw new Error('Tipo de campo desconocido.');
  }
}

// `datos`: { claveDelCampo: valor }. Con `completo` exige los obligatorios (alta); sin él acepta cambios parciales
// sobre la fila `actual`.
function validar(def, datos, { completo, actual = null }) {
  const campos = {};
  const valores = {};
  for (const campo of def.campos) {
    const vino = datos && Object.prototype.hasOwnProperty.call(datos, campo.clave);
    if (!vino) {
      if (completo && campo.obligatorio) campos[campo.clave] = campo.tipo === 'texto' ? 'Escribe un nombre.' : 'Este dato es obligatorio.';
      else if (completo && campo.tipo === 'booleano') valores[campo.columna] = 0;
      continue;
    }
    if (campo.soloAlCrear && !completo) {
      if (String(datos[campo.clave]).trim().toUpperCase() !== String(actual[campo.clave])) campos[campo.clave] = 'No se puede cambiar una vez creado.';
      continue;
    }
    try { valores[campo.columna] = validarCampo(campo, datos[campo.clave]); } catch (e) { campos[campo.clave] = e.message; }
  }
  if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
  return valores;
}

// Lo que se guarda en el historial: los campos visibles de la fila.
function resumen(def, fila) {
  if (!fila) return null;
  const datos = Object.fromEntries(def.campos.map(c => [c.clave, fila[c.clave]]));
  return { ...datos, activo: !!fila.activo, ...(def.orden ? { orden: fila.orden } : {}) };
}

const claveHistorial = (def, fila) => String(fila[def.campos.find(c => c.clave === 'nombre') ? 'nombre' : def.campos[0].clave]);

function paraApi(def, fila) {
  const item = { id: fila.id, activo: !!fila.activo, usos: Number(fila.usos), orden: fila.orden };
  for (const campo of def.campos) item[campo.clave] = campo.tipo === 'booleano' ? !!fila[campo.clave] : fila[campo.clave];
  return item;
}

function idDe(def, valor) {
  if (def.pk === 'codigo') {
    const codigo = String(valor ?? '').trim().toUpperCase();
    if (!CODIGO_MONEDA.test(codigo)) throw new ErrorDeNegocio('Código inválido.', 400);
    return codigo;
  }
  const id = aEntero(valor);
  if (id === null) throw new ErrorDeNegocio('Identificador inválido.', 400);
  return id;
}

async function existente(def, id, ejecutor) {
  const fila = await catalogoRepository.obtener(def, id, ejecutor);
  if (!fila) throw new ErrorDeNegocio('Ese registro no existe.', 404);
  return fila;
}

// El nombre ya existe: la base lo impide con una clave única y aquí se explica.
function traducirDuplicado(def, error) {
  if (error && error.code === 'ER_DUP_ENTRY') return new ErrorDeNegocio(`Ya existe ${def.singular} con ese nombre.`, 409);
  return error;
}

class CatalogoService {
  async listar(id) {
    const def = catalogo(id);
    return (await catalogoRepository.listar(def)).map(f => paraApi(def, f));
  }

  async crear(id, datos, usuarioId) {
    const def = catalogo(id);
    const valores = validar(def, datos, { completo: true });
    valores[def.activo] = 1;
    try {
      return await db.transaccion(async tx => {
        if (def.orden) valores[def.orden] = await catalogoRepository.siguienteOrden(tx, def);
        const nuevoId = await catalogoRepository.insertar(tx, def, valores);
        const fila = await catalogoRepository.obtener(def, nuevoId, tx);
        await configRepository.registrarHistorial(tx, {
          usuarioId, entidad: `catalogo:${id}`, clave: claveHistorial(def, fila), accion: 'crear', antes: null, despues: resumen(def, fila)
        });
        return paraApi(def, fila);
      });
    } catch (error) {
      throw traducirDuplicado(def, error);
    }
  }

  async editar(id, valorId, datos, usuarioId) {
    const def = catalogo(id);
    const clave = idDe(def, valorId);
    try {
      return await db.transaccion(async tx => {
        const antes = await existente(def, clave, tx);
        const valores = validar(def, datos, { completo: false, actual: antes });
        if (datos && Object.prototype.hasOwnProperty.call(datos, 'orden') && def.orden) {
          const orden = aEntero(datos.orden);
          if (orden === null) throw errorDeValidacion('Revisa los datos marcados.', { orden: 'Escribe un número entero.' });
          valores[def.orden] = orden;
        }
        // La clave de las monedas se escribe una sola vez: no se actualiza.
        for (const campo of def.campos) if (campo.soloAlCrear) delete valores[campo.columna];
        await catalogoRepository.actualizar(tx, def, clave, valores);
        const despues = await catalogoRepository.obtener(def, clave, tx);
        if (JSON.stringify(resumen(def, antes)) !== JSON.stringify(resumen(def, despues))) {
          await configRepository.registrarHistorial(tx, {
            usuarioId, entidad: `catalogo:${id}`, clave: claveHistorial(def, despues), accion: 'editar', antes: resumen(def, antes), despues: resumen(def, despues)
          });
        }
        return paraApi(def, despues);
      });
    } catch (error) {
      throw traducirDuplicado(def, error);
    }
  }

  async cambiarActivo(id, valorId, activo, usuarioId) {
    const def = catalogo(id);
    const clave = idDe(def, valorId);
    if (!esBooleano(activo)) throw errorDeValidacion('Elige activar o desactivar.', { activo: 'Elige sí o no.' });
    const nuevo = activo === true || activo === 1 || activo === '1' ? 1 : 0;
    return db.transaccion(async tx => {
      const antes = await existente(def, clave, tx);
      if (!!antes.activo !== !!nuevo) {
        await catalogoRepository.actualizar(tx, def, clave, { [def.activo]: nuevo });
        await configRepository.registrarHistorial(tx, {
          usuarioId, entidad: `catalogo:${id}`, clave: claveHistorial(def, antes), accion: nuevo ? 'activar' : 'desactivar',
          antes: resumen(def, antes), despues: { ...resumen(def, antes), activo: !!nuevo }
        });
      }
      return paraApi(def, await catalogoRepository.obtener(def, clave, tx));
    });
  }
}

module.exports = new CatalogoService();
