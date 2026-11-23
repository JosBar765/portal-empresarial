// src/modules/proyectos/services/campoService.js
// Campos propios de la empresa (A6): altas, ediciones y activación. La clave sale de la etiqueta, es única y no cambia ni
// se reutiliza; el tipo tampoco cambia. Desactivar no borra datos. Cada cambio queda en el historial de configuración.
const db = require('../../../config/database');
const campoRepository = require('../repositories/campoRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const configRepository = require('../repositories/configRepository');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');
const { definicion } = require('../catalogos');
const { TIPOS, claveLibre } = require('../camposPropios');

const MAX_OPCIONES = 30;
const MAX_LARGO_OPCION = 60;

const noExiste = () => new ErrorDeNegocio('Ese campo no existe.', 404);
const esBooleano = (v) => v === true || v === false;

// Lo que queda en el historial: lo que una persona puede ver y cambiar.
const resumen = (d) => (d ? {
  id: d.id, etiqueta: d.etiqueta, nicho: d.nicho || 'Todos los nichos', tipo: d.tipo, opciones: d.opciones,
  obligatorio: d.obligatorio, visibleEnLista: d.visibleEnLista, activo: d.activo
} : null);

async function nichoDe(valor, campos) {
  if (valor === null || valor === undefined || valor === '') return { id: null, nombre: null };
  const id = aEntero(valor);
  const fila = id === null ? null : await catalogoRepository.obtener(definicion('nichos'), id);
  if (!fila || !fila.activo) { campos.nichoId = 'Elige un nicho de la lista, o todos.'; return { id: null, nombre: null }; }
  return { id: fila.id, nombre: fila.nombre };
}

// Valida lo editable de un campo (etiqueta, nicho, opciones, banderas) y devuelve los valores para guardar.
async function validar(datos, { tipo }) {
  const campos = {};
  const etiqueta = String(datos.etiqueta == null ? '' : datos.etiqueta).trim();
  if (!etiqueta) campos.etiqueta = 'Escribe la etiqueta del campo.';
  else if (etiqueta.length > 100) campos.etiqueta = 'Máximo 100 caracteres.';
  const nicho = await nichoDe(datos.nichoId, campos);
  let opciones = [];
  if (tipo === 'lista') {
    const crudas = Array.isArray(datos.opciones) ? datos.opciones : [];
    opciones = [...new Set(crudas.map(o => String(o == null ? '' : o).trim()).filter(Boolean))];
    if (opciones.length < 2) campos.opciones = 'Escribe al menos dos opciones.';
    else if (opciones.length > MAX_OPCIONES) campos.opciones = `Máximo ${MAX_OPCIONES} opciones.`;
    else if (opciones.some(o => o.length > MAX_LARGO_OPCION)) campos.opciones = `Cada opción admite hasta ${MAX_LARGO_OPCION} caracteres.`;
  }
  for (const k of ['obligatorio', 'visibleEnLista']) {
    if (datos[k] !== undefined && !esBooleano(datos[k])) campos[k] = 'Elige sí o no.';
  }
  if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
  return { etiqueta, nichoId: nicho.id, opciones, obligatorio: datos.obligatorio === true, visibleEnLista: datos.visibleEnLista === true };
}

class CampoService {
  listar() {
    return campoRepository.listar({ conUsos: true });
  }

  // Los que aplican hoy (activos), para formularios, fichas, filtros y la plantilla CSV.
  async activos() {
    return (await campoRepository.listar()).filter(d => d.activo);
  }

  async crear(datos, usuarioId) {
    const tipo = datos.tipo;
    if (!TIPOS.includes(tipo)) throw errorDeValidacion('Revisa los datos marcados.', { tipo: 'Elige un tipo de dato.' });
    const valores = await validar(datos, { tipo });
    const id = await db.transaccion(async (tx) => {
      const clave = claveLibre(valores.etiqueta, await campoRepository.clavesUsadas(tx));
      const nuevoId = await campoRepository.insertar(tx, { ...valores, clave, tipo, orden: await campoRepository.siguienteOrden(tx), activo: datos.activo !== false });
      await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'campo', clave, accion: 'crear', antes: null, despues: resumen(await campoRepository.obtener(nuevoId, tx)) });
      return nuevoId;
    });
    return campoRepository.obtener(id);
  }

  async editar(id, datos, usuarioId) {
    const idNumerico = aEntero(id);
    const actual = idNumerico === null ? null : await campoRepository.obtener(idNumerico);
    if (!actual) throw noExiste();
    if (datos.tipo !== undefined && datos.tipo !== actual.tipo) throw errorDeValidacion('Revisa los datos marcados.', { tipo: 'El tipo no se puede cambiar: crea otro campo.' });
    const valores = await validar({ ...actual, ...datos }, { tipo: actual.tipo });
    const orden = datos.orden === undefined ? actual.orden : aEntero(datos.orden);
    if (orden === null || orden < 1) throw errorDeValidacion('Revisa los datos marcados.', { orden: 'Escribe un número entero desde 1.' });
    await db.transaccion(async (tx) => {
      await campoRepository.actualizar(tx, actual.id, { ...valores, orden });
      const despues = await campoRepository.obtener(actual.id, tx);
      if (JSON.stringify(resumen(actual)) !== JSON.stringify(resumen(despues)) || actual.orden !== despues.orden) {
        await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'campo', clave: actual.clave, accion: 'editar', antes: resumen(actual), despues: resumen(despues) });
      }
    });
    return campoRepository.obtener(actual.id);
  }

  async cambiarActivo(id, activo, usuarioId) {
    if (!esBooleano(activo)) throw errorDeValidacion('Revisa los datos marcados.', { activo: 'Elige activar o desactivar.' });
    const idNumerico = aEntero(id);
    const actual = idNumerico === null ? null : await campoRepository.obtener(idNumerico);
    if (!actual) throw noExiste();
    if (actual.activo !== activo) {
      await db.transaccion(async (tx) => {
        await campoRepository.cambiarActivo(tx, actual.id, activo);
        await configRepository.registrarHistorial(tx, {
          usuarioId, entidad: 'campo', clave: actual.clave, accion: activo ? 'activar' : 'desactivar', antes: resumen(actual), despues: resumen({ ...actual, activo })
        });
      });
    }
    return campoRepository.obtener(actual.id);
  }
}

module.exports = new CampoService();
