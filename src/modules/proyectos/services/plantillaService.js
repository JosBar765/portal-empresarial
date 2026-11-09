// src/modules/proyectos/services/plantillaService.js
// Plantillas de proyecto (A4 y A4b): duración, etapas, valores sugeridos y qué puede cambiar el supervisor al crear un
// proyecto con ellas. Nunca se borra una plantilla: se desactiva. Cada cambio queda en el historial de configuración.
const db = require('../../../config/database');
const plantillaRepository = require('../repositories/plantillaRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const configRepository = require('../repositories/configRepository');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');
const { definicion } = require('../catalogos');

const MAX_ETAPAS = 12;
const MODOS = ['editable', 'bloqueado', 'obligatorio'];
// Lo que el supervisor puede editar, bloquear o tener que completar al crear un proyecto con la plantilla.
const CONTROLES = ['articulo', 'existencia', 'meta', 'tope', 'fechas_etapas'];
const ETIQUETA_CONTROL = { articulo: 'Artículo de muestra', existencia: 'Existencia de muestras', meta: 'Meta de venta', tope: 'Tope de empresas por asesor', fechas_etapas: 'Fechas de las etapas' };

const noExiste = () => new ErrorDeNegocio('Esa plantilla no existe.', 404);
const esBooleano = (v) => v === true || v === false;
const limpio = (v) => String(v == null ? '' : v).trim();

// Lo que queda en el historial: lo que una persona puede ver y cambiar.
const resumen = (p) => (p ? {
  id: p.id, nombre: p.nombre, descripcion: p.descripcion || null, activa: p.activa, predeterminada: p.predeterminada, duracionSemanas: p.duracionSemanas,
  articulo: p.articulo || null, existenciaSugerida: p.existenciaSugerida, topePorAsesor: p.topePorAsesor,
  meta: p.metaMonto === null ? null : `${p.metaMonto} ${p.metaMoneda || ''}`.trim(),
  etapas: p.etapas.map(e => `${e.nombre} (${e.duracionDiasHabiles} días)`),
  controles: Object.fromEntries(CONTROLES.map(c => [ETIQUETA_CONTROL[c], p.controles[c] || 'editable']))
} : null);

async function validar(datos, exceptoId) {
  const campos = {};
  const nombre = limpio(datos.nombre);
  if (!nombre) campos.nombre = 'Escribe el nombre de la plantilla.';
  else if (nombre.length > 100) campos.nombre = 'Máximo 100 caracteres.';
  else if (await plantillaRepository.nombreEnUso(nombre, exceptoId)) campos.nombre = 'Ya existe una plantilla con ese nombre.';
  const descripcion = limpio(datos.descripcion);
  if (descripcion.length > 255) campos.descripcion = 'Máximo 255 caracteres.';

  let articuloId = null;
  if (datos.articuloId !== undefined && datos.articuloId !== null && datos.articuloId !== '') {
    const n = aEntero(datos.articuloId);
    const fila = n === null ? null : await catalogoRepository.obtener(definicion('articulos'), n);
    if (!fila || !fila.activo) campos.articuloId = 'Elige un artículo de la lista.'; else articuloId = fila.id;
  }
  let existencia = null;
  if (datos.existenciaSugerida !== undefined && datos.existenciaSugerida !== null && datos.existenciaSugerida !== '') {
    existencia = aEntero(datos.existenciaSugerida);
    if (existencia === null || existencia < 0 || existencia > 1000000) { campos.existenciaSugerida = 'Escribe un número entero desde 0.'; existencia = null; }
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

  const etapas = [];
  const crudas = Array.isArray(datos.etapas) ? datos.etapas : [];
  if (!crudas.length) campos.etapas = 'Agrega al menos una etapa.';
  else if (crudas.length > MAX_ETAPAS) campos.etapas = `Máximo ${MAX_ETAPAS} etapas.`;
  crudas.slice(0, MAX_ETAPAS).forEach((e, i) => {
    const nombreEtapa = limpio(e && e.nombre);
    if (!nombreEtapa || nombreEtapa.length > 100) campos[`etapas.${i}.nombre`] = 'Escribe el nombre de la etapa (máximo 100 caracteres).';
    const detalle = limpio(e && e.descripcion);
    if (detalle.length > 255) campos[`etapas.${i}.descripcion`] = 'Máximo 255 caracteres.';
    const dias = aEntero(e && e.duracionDiasHabiles);
    if (dias === null || dias < 1 || dias > 60) campos[`etapas.${i}.duracionDiasHabiles`] = 'Escribe de 1 a 60 días hábiles.';
    etapas.push({ nombre: nombreEtapa, descripcion: detalle, duracionDiasHabiles: dias });
  });

  const entrada = datos.controles && typeof datos.controles === 'object' && !Array.isArray(datos.controles) ? datos.controles : {};
  const controles = {};
  for (const c of CONTROLES) {
    const modo = entrada[c] === undefined ? 'editable' : entrada[c];
    if (!MODOS.includes(modo)) campos[`controles.${c}`] = 'Elige editable, bloqueado u obligatorio.'; else controles[c] = modo;
  }
  // Un dato bloqueado tiene que traer su valor: si no, el supervisor no podría completarlo nunca.
  const valorDe = { articulo: articuloId, existencia: existencia, meta: metaMonto, tope };
  for (const c of ['articulo', 'existencia', 'meta', 'tope']) {
    if (controles[c] === 'bloqueado' && (valorDe[c] === null || valorDe[c] === undefined)) campos[`controles.${c}`] = 'Para bloquearlo, la plantilla debe tener un valor.';
  }
  for (const k of ['activa', 'predeterminada']) if (datos[k] !== undefined && !esBooleano(datos[k])) campos[k] = 'Elige sí o no.';
  const activa = datos.activa !== false;
  const predeterminada = datos.predeterminada === true;
  if (predeterminada && !activa) campos.predeterminada = 'La plantilla predeterminada debe estar activa.';

  if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos marcados.', campos);
  const totalDias = etapas.reduce((s, e) => s + e.duracionDiasHabiles, 0);
  return { nombre, descripcion: descripcion || null, activa, predeterminada, duracionSemanas: Math.max(1, Math.ceil(totalDias / 5)), articuloId, existenciaSugerida: existencia, topePorAsesor: tope, metaMonto, metaMoneda, controles, etapas };
}

class PlantillaService {
  listar() {
    return plantillaRepository.listar();
  }

  // Las plantillas que se pueden elegir al crear un proyecto.
  async activas() {
    return (await plantillaRepository.listar()).filter(p => p.activa);
  }

  async paraAplicar(id) {
    const n = aEntero(id);
    const plantilla = n === null ? null : await plantillaRepository.obtener(n);
    return plantilla && plantilla.activa ? plantilla : null;
  }

  async crear(datos, usuarioId) {
    const valores = await validar(datos, 0);
    const id = await db.transaccion(async (tx) => {
      const nuevo = await plantillaRepository.insertar(tx, valores);
      await plantillaRepository.reemplazarEtapas(tx, nuevo, valores.etapas);
      if (valores.predeterminada) await plantillaRepository.quitarPredeterminadas(tx, nuevo);
      await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'plantilla', clave: String(nuevo), accion: 'crear', antes: null, despues: resumen(await plantillaRepository.obtener(nuevo, tx)) });
      return nuevo;
    });
    return plantillaRepository.obtener(id);
  }

  async editar(id, datos, usuarioId) {
    const n = aEntero(id);
    const actual = n === null ? null : await plantillaRepository.obtener(n);
    if (!actual) throw noExiste();
    const valores = await validar({ ...actual, ...datos }, actual.id);
    if (actual.predeterminada && !valores.predeterminada) throw errorDeValidacion('Revisa los datos marcados.', { predeterminada: 'Elige otra plantilla como predeterminada primero.' });
    await db.transaccion(async (tx) => {
      await plantillaRepository.actualizar(tx, actual.id, valores);
      await plantillaRepository.reemplazarEtapas(tx, actual.id, valores.etapas);
      if (valores.predeterminada) await plantillaRepository.quitarPredeterminadas(tx, actual.id);
      const despues = await plantillaRepository.obtener(actual.id, tx);
      if (JSON.stringify(resumen(actual)) !== JSON.stringify(resumen(despues))) {
        await configRepository.registrarHistorial(tx, { usuarioId, entidad: 'plantilla', clave: String(actual.id), accion: 'editar', antes: resumen(actual), despues: resumen(despues) });
      }
    });
    return plantillaRepository.obtener(actual.id);
  }

  async cambiarActivo(id, activa, usuarioId) {
    if (!esBooleano(activa)) throw errorDeValidacion('Revisa los datos marcados.', { activa: 'Elige activar o desactivar.' });
    const n = aEntero(id);
    const actual = n === null ? null : await plantillaRepository.obtener(n);
    if (!actual) throw noExiste();
    if (!activa && actual.predeterminada) throw new ErrorDeNegocio('Elige otra plantilla como predeterminada antes de desactivar esta.', 409);
    if (actual.activa !== activa) {
      await db.transaccion(async (tx) => {
        await plantillaRepository.actualizar(tx, actual.id, { ...actual, activa, controles: actual.controles });
        await configRepository.registrarHistorial(tx, {
          usuarioId, entidad: 'plantilla', clave: String(actual.id), accion: activa ? 'activar' : 'desactivar', antes: resumen(actual), despues: resumen({ ...actual, activa })
        });
      });
    }
    return plantillaRepository.obtener(actual.id);
  }
}

module.exports = new PlantillaService();
module.exports.CONTROLES = CONTROLES;
module.exports.MODOS = MODOS;
