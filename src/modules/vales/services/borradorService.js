// src/modules/vales/services/borradorService.js
// Borradores de vale: el formulario guardado a medias, sin correlativo y sin las validaciones de un vale.
// Son privados de su dueño y viven DIAS_VIGENCIA días desde su creación. Al enviarse pasan por crearVale.
const borradorRepository = require('../repositories/borradorRepository');
const supabaseStorage = require('../../../core/files/supabaseStorage');
const subirYRegistrarArchivo = require('../../../core/files/subirYRegistrarArchivo');
const nombreArchivo = require('../../../core/files/nombreArchivo');
const idempotencyRepository = require('../../../core/idempotency/idempotencyRepository');
const { validarArchivos } = require('../../../core/files/fileSignature');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio } = require('../../../core/utils/validar');
const valeMutex = require('./valeMutex');
const { esUrgente } = require('./valeHelpers');

const DIAS_VIGENCIA = 30;
const MAX_IMAGENES = 10;
const MAX_DOCUMENTOS = 5;
const MAX_ENTERO = 2147483647;
const MAX_COTIZACION = 99999999.99;

// [campo del formulario, columna, máximo de caracteres, etiqueta]; los máximos son los de las columnas (descripción: el del formulario).
const CAMPOS_TEXTO = [
  ['clienteEmpresa', 'cliente_empresa', 150, 'La empresa'],
  ['clienteNombre', 'cliente_nombre', 150, 'El nombre del cliente'],
  ['clienteTelefono', 'cliente_telefono', 30, 'El teléfono'],
  ['clienteCorreo', 'cliente_correo', 150, 'El correo'],
  ['producto', 'producto', 150, 'El código de producto'],
  ['material', 'material', 150, 'El material'],
  ['tecnica', 'tecnica', 150, 'La técnica'],
  ['acabado', 'acabado', 150, 'El acabado'],
  ['descripcion', 'descripcion', 600, 'La descripción']
];

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';
const totalNuevos = (archivos) => ((archivos && archivos.imagenes) || []).length + ((archivos && archivos.documentos) || []).length;

function leerFecha(valor, etiqueta) {
  if (vacio(valor)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor).trim());
  const d = m && new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== m[0]) throw new Error(`${etiqueta} no es válida.`);
  return `${m[0]} 00:00:00`;
}

function leerTalleres(crudo) {
  if (vacio(crudo) || (Array.isArray(crudo) && crudo.length === 0)) return null;
  let ids;
  try {
    ids = Array.isArray(crudo) ? crudo : JSON.parse(crudo);
  } catch {
    throw new Error('No se pudieron leer los talleres seleccionados. Vuelve a elegirlos.');
  }
  const numeros = (Array.isArray(ids) ? ids : []).map(Number);
  if (numeros.some(n => !Number.isInteger(n) || n <= 0)) throw new Error('Alguno de los talleres elegidos no es válido. Vuelve a elegirlos.');
  const csv = [...new Set(numeros)].join(',');
  if (csv.length > 100) throw new Error('Elegiste demasiados talleres.');
  return csv || null;
}

function idsAQuitar(crudo, documentos) {
  let ids;
  try {
    ids = Array.isArray(crudo) ? crudo : JSON.parse(crudo || '[]');
  } catch {
    throw new Error('No se pudo leer la lista de archivos a quitar. Actualiza la página e inténtalo de nuevo.');
  }
  ids = [...new Set((ids || []).map(Number))];
  if (!ids.every(id => documentos.some(d => d.id === id))) {
    throw new Error('Alguno de los archivos que quieres quitar ya no existe en este borrador. Actualiza la página e inténtalo de nuevo.');
  }
  return ids;
}

// Convierte lo que manda el formulario a columnas; `contenido` dice si hay algo escrito.
function leerDatos(payload) {
  const datos = {};
  for (const [campo, columna, maximo, etiqueta] of CAMPOS_TEXTO) {
    const texto = String(payload[campo] ?? '').trim();
    if (texto.length > maximo) throw new Error(`${etiqueta} es demasiad${etiqueta.startsWith('La ') ? 'a larga' : 'o largo'} (máximo ${maximo} caracteres).`);
    datos[columna] = texto || null;
  }
  datos.talleres_ids = leerTalleres(payload.talleresIds);
  datos.fecha_entrega = leerFecha(payload.fechaEntrega, 'La fecha de entrega');
  datos.fecha_evento = leerFecha(payload.fechaEvento, 'La fecha del evento');
  datos.cantidad = null;
  if (!vacio(payload.cantidad)) {
    const cantidad = Number(payload.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_ENTERO) throw new Error('La cantidad debe ser un entero de 1 o más.');
    datos.cantidad = cantidad;
  }
  datos.cotizacion = null;
  if (!vacio(payload.cotizacion)) {
    const cotizacion = Number(payload.cotizacion);
    if (!Number.isFinite(cotizacion) || cotizacion <= 0 || cotizacion > MAX_COTIZACION) throw new Error('La cotización debe ser un valor numérico mayor a 0.');
    datos.cotizacion = Math.round(cotizacion * 100) / 100;
  }
  const urgente = esUrgente(payload.urgente);
  datos.urgente = urgente ? 1 : 0;
  datos.contenido = urgente || Object.entries(datos).some(([columna, valor]) => columna !== 'urgente' && valor !== null);
  return datos;
}

const errorVacio = () => new Error('El borrador está vacío: escribe algún dato o adjunta un archivo.');

class BorradorService {
  async _obtenerPropio(usuarioId, id) {
    const borrador = await borradorRepository.obtenerDeUsuario(id, usuarioId);
    if (!borrador) throw new ErrorDeNegocio('El borrador no existe.', 404);
    return borrador;
  }

  async listar(usuario) {
    const [filas, maximo] = await Promise.all([borradorRepository.listarPorUsuario(usuario.id), borradorRepository.obtenerTope()]);
    const borradores = filas.map(f => ({
      id: f.id, titulo: f.titulo, creadoEn: f.creado_en, venceEn: f.vence_en, diasRestantes: Number(f.dias_restantes)
    }));
    return { borradores, total: borradores.length, maximo };
  }

  async obtener(usuario, idCrudo) {
    const id = idObligatorio(idCrudo, 'Borrador');
    const borrador = await this._obtenerPropio(usuario.id, id);
    const documentos = await borradorRepository.listarDocumentos(id);
    return {
      ...borrador,
      dias_restantes: Number(borrador.dias_restantes),
      talleres_ids: borrador.talleres_ids ? borrador.talleres_ids.split(',').map(Number) : [],
      documentos
    };
  }

  async crear(usuario, payload, archivos) {
    const datos = leerDatos(payload);
    if (!datos.contenido && totalNuevos(archivos) === 0) throw errorVacio();
    // Contar e insertar van en la misma cola para que dos guardados seguidos no superen el tope.
    const id = await valeMutex.conColaDeLlave(`borradores-usuario:${usuario.id}`, async () => {
      const tope = await borradorRepository.obtenerTope();
      if (await borradorRepository.contarPorUsuario(usuario.id) >= tope) {
        throw new Error(`Ya tienes ${tope} borradores, el máximo permitido. Elimina uno para guardar otro.`);
      }
      const nuevoId = await borradorRepository.insertar(usuario.id, datos, DIAS_VIGENCIA);
      const subidos = [];
      try {
        await this._subirAdjuntos(nuevoId, archivos, [], subidos);
      } catch (error) {
        await this._descartarSubidos(subidos);
        await borradorRepository.eliminar(nuevoId);
        throw error;
      }
      return nuevoId;
    });
    return this.obtener(usuario, id);
  }

  // Editar un borrador existente no cuenta contra el tope ni renueva su vencimiento.
  async actualizar(usuario, idCrudo, payload, archivos) {
    const id = idObligatorio(idCrudo, 'Borrador');
    await valeMutex.conColaDeLlave(`borrador:${id}`, async () => {
      await this._obtenerPropio(usuario.id, id);
      const datos = leerDatos(payload);
      const documentos = await borradorRepository.listarDocumentos(id);
      const quitarIds = idsAQuitar(payload.documentosQuitar, documentos);
      if (!datos.contenido && documentos.length - quitarIds.length + totalNuevos(archivos) === 0) throw errorVacio();
      const subidos = [];
      try {
        await this._subirAdjuntos(id, archivos, documentos.map(d => d.ruta), subidos);
        await borradorRepository.actualizar(id, datos);
      } catch (error) {
        await this._descartarSubidos(subidos);
        throw error;
      }
      for (const doc of documentos.filter(d => quitarIds.includes(d.id))) {
        try { await supabaseStorage.borradores.eliminar(doc.ruta); } catch (e) { console.error(`[Borradores] Archivo sin borrar de Storage: ${doc.ruta} (${e.message})`); }
        await borradorRepository.eliminarDocumento(doc.id);
      }
    });
    return this.obtener(usuario, id);
  }

  async eliminar(usuario, idCrudo) {
    const id = idObligatorio(idCrudo, 'Borrador');
    await valeMutex.conColaDeLlave(`borrador:${id}`, async () => {
      await this._obtenerPropio(usuario.id, id);
      await this._purgar(id);
    });
    return { ok: true };
  }

  // Storage primero: si falla, la fila queda y se reintenta (el usuario o el vigilante).
  async _purgar(id) {
    for (const doc of await borradorRepository.listarDocumentos(id)) {
      await supabaseStorage.borradores.eliminar(doc.ruta);
    }
    await borradorRepository.eliminar(id);
  }

  // Borra los vencidos y los enviados pendientes de limpieza, cada uno por separado. Devuelve cuántos se borraron.
  async purgarVencidos() {
    let borrados = 0;
    for (const { id } of await borradorRepository.listarVencidos()) {
      try {
        await valeMutex.conColaDeLlave(`borrador:${id}`, () => this._purgar(id));
        borrados++;
      } catch (error) {
        console.error(`[Borradores] No se pudo borrar el borrador vencido o enviado ${id}:`, error.message);
      }
    }
    return borrados;
  }

  // Marca primero (oculta el borrador) y borra Storage antes que la fila: si algo falla, el vigilante lo reintenta sin huérfanos.
  async _limpiarEnviado(id, documentos) {
    try {
      await borradorRepository.marcarEnviado(id);
      let pendientes = 0;
      for (const doc of documentos) {
        try {
          await supabaseStorage.borradores.eliminar(doc.ruta);
          await borradorRepository.eliminarDocumento(doc.id);
        } catch (e) {
          pendientes++;
          console.error(`[Borradores] Archivo sin borrar de Storage: ${doc.ruta} (${e.message})`);
        }
      }
      if (pendientes === 0) await borradorRepository.eliminar(id);
    } catch (e) {
      console.error(`[Borradores] Borrador enviado sin limpiar: ${id} (${e.message})`);
    }
  }

  // `urlsExistentes` continúa la numeración y `subidos` permite deshacer si algo falla después.
  async _subirAdjuntos(borradorId, archivos, urlsExistentes, subidos) {
    const grupos = [[(archivos && archivos.imagenes) || [], 'imagen', 'IMAGEN'], [(archivos && archivos.documentos) || [], 'documento', 'PDF']];
    for (const [lista, tipo, tipoNombre] of grupos) {
      let contador = nombreArchivo.siguienteContador(urlsExistentes, nombreArchivo.prefijoBorrador(borradorId, tipoNombre));
      for (const file of lista) {
        await subirYRegistrarArchivo({
          buffer: file.buffer, nombreOriginal: file.originalname, mimeType: file.mimetype,
          nombreObjeto: nombreArchivo.borrador(borradorId, tipoNombre, contador++),
          storage: supabaseStorage.borradores,
          registrar: async (subida) => {
            const id = await borradorRepository.insertarDocumento({
              borradorId, nombreOriginal: file.originalname, ruta: subida.url, tipo, mimeType: file.mimetype, tamano: subida.size
            });
            subidos.push({ id, ruta: subida.url });
          }
        });
      }
    }
  }

  async _descartarSubidos(subidos) {
    for (const { id, ruta } of subidos) {
      try { await supabaseStorage.borradores.eliminar(ruta); } catch (e) { console.error(`[Borradores] Archivo sin borrar de Storage: ${ruta} (${e.message})`); }
      try { await borradorRepository.eliminarDocumento(id); } catch (e) { console.error(`[Borradores] Documento sin borrar de la base: ${id} (${e.message})`); }
    }
  }

  // `crear(archivosCombinados)` es el crearVale normal, con todas sus validaciones. Los adjuntos del borrador
  // que el usuario no quitó viajan junto a los nuevos; si crearVale falla, el borrador y sus archivos quedan intactos.
  async enviar(usuario, payload, archivos, crear) {
    const id = idObligatorio(payload.borradorId, 'Borrador');
    return valeMutex.conColaDeLlave(`borrador:${id}`, async () => {
      // Un reintento con la misma llave devuelve el vale ya creado (el borrador ya no existe).
      if (payload.idempotencyKey) {
        const previo = await idempotencyRepository.buscar(payload.idempotencyKey);
        if (previo) return previo.resultado;
      }
      await this._obtenerPropio(usuario.id, id);
      const documentos = await borradorRepository.listarDocumentos(id);
      const quitarIds = idsAQuitar(payload.documentosQuitar, documentos);

      const combinados = { imagenes: [], documentos: [] };
      for (const doc of documentos.filter(d => !quitarIds.includes(d.id))) {
        const buffer = await supabaseStorage.borradores.descargar(doc.ruta);
        combinados[doc.tipo === 'imagen' ? 'imagenes' : 'documentos'].push({
          buffer, originalname: doc.nombre_original, mimetype: doc.mime_type, size: buffer.length
        });
      }
      combinados.imagenes.push(...((archivos && archivos.imagenes) || []));
      combinados.documentos.push(...((archivos && archivos.documentos) || []));
      if (combinados.imagenes.length > MAX_IMAGENES || combinados.documentos.length > MAX_DOCUMENTOS) {
        throw new Error(`Un vale admite hasta ${MAX_IMAGENES} imágenes y ${MAX_DOCUMENTOS} documentos.`);
      }
      validarArchivos(combinados);

      const vale = await crear(combinados);

      // El vale ya existe: limpiar es de mejor esfuerzo y nunca debe hacer fallar la respuesta.
      await this._limpiarEnviado(id, documentos);
      return vale;
    });
  }
}

module.exports = new BorradorService();
