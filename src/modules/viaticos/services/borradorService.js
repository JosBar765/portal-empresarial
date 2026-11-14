// src/modules/viaticos/services/borradorService.js
// Borradores de solicitud: el formulario guardado a medias, sin correlativo y sin la validación estricta de una solicitud.
// Son privados de su dueño y viven los días del ajuste de vigencia desde su creación (editarlos no los renueva).
// Aquí solo se valida la forma; los ids dentro de `datos` son opacos y el cliente los reconcilia al abrir el borrador.
const db = require('../../../config/database');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { idObligatorio, aEntero } = require('../../../core/utils/validar');
const repo = require('../repositories/borradorRepository');
const ajusteRepo = require('../repositories/ajusteRepository');
const { MODALIDADES, BORRADORES } = require('../constantes');
const { cuerpoObjeto, mostrar } = require('../validacion');
const { errorDeValidacion } = require('../errores');
const { parsearJson } = require('../utilidades');
const { msg } = require('../mensajes');

const MODALIDADES_VALIDAS = Object.values(MODALIDADES);
const PROFUNDIDAD_MAXIMA = 20;

const esObjetoPlano = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

// Vacío = sin nada que recordar: '', null, false, listas u objetos sin contenido. El 0 sí cuenta como dato escrito.
// Más allá de la profundidad máxima se asume contenido para no recorrer un anidado malicioso.
function esVacio(valor, profundidad = 0) {
  if (valor === undefined || valor === null || valor === false) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  if (profundidad >= PROFUNDIDAD_MAXIMA) return false;
  if (Array.isArray(valor)) return valor.every(v => esVacio(v, profundidad + 1));
  if (esObjetoPlano(valor)) return Object.values(valor).every(v => esVacio(v, profundidad + 1));
  return false;
}

// Las claves de control del formulario (modalidad y marcas de comidas) no son contenido del usuario.
function tieneContenido(datos) {
  return Object.entries(datos).some(([clave, valor]) => !BORRADORES.CLAVES_NO_CONTENIDO.includes(clave) && !esVacio(valor));
}

// Devuelve { modalidad, datosJson } o lanza el 400 con el detalle por campo.
function validarForma(cuerpo) {
  const { modalidad, datos } = cuerpoObjeto(cuerpo);
  const campos = {};
  if (!MODALIDADES_VALIDAS.includes(modalidad)) campos.modalidad = msg('borrador.modalidad', { valor: mostrar(modalidad) });
  let datosJson = null;
  if (!esObjetoPlano(datos)) {
    campos.datos = msg('borrador.datosObjeto');
  } else {
    datosJson = JSON.stringify(datos);
    const bytes = Buffer.byteLength(datosJson, 'utf8');
    if (bytes > BORRADORES.MAX_BYTES_DATOS) {
      campos.datos = msg('borrador.datosGrandes', { tamano: Math.ceil(bytes / 1024), max: BORRADORES.MAX_BYTES_DATOS / 1024 });
    } else if (!tieneContenido(datos)) {
      campos.datos = msg('borrador.vacio');
    }
  }
  if (Object.keys(campos).length > 0) throw errorDeValidacion(msg('validacion.revisar'), campos);
  return { modalidad, datosJson };
}

// Un ajuste ausente o dañado es un error del despliegue (falta la migración), no del usuario.
async function leerAjusteEntero(clave) {
  const fila = await ajusteRepo.obtener(clave);
  const valor = fila ? aEntero(parsearJson(fila.valor)) : null;
  if (valor === null) throw new ErrorDeNegocio(msg('borrador.ajusteFaltante', { clave }), 500);
  return valor;
}

// País y fechas son lo único que la lista necesita del JSON; si no vienen con la forma esperada, null.
const comoTexto = valor => (typeof valor === 'string' && valor.trim() !== '' ? valor : null);

class BorradorService {
  async listar(usuario) {
    const filas = await repo.listarVigentes(usuario.id);
    return {
      borradores: filas.map(f => ({
        id: f.id,
        modalidad: f.modalidad,
        paisId: aEntero(parsearJson(f.pais_id)),
        fechaSalida: comoTexto(parsearJson(f.fecha_salida)),
        fechaRegreso: comoTexto(parsearJson(f.fecha_regreso)),
        creadoEn: f.creado_en,
        venceEn: f.vence_en,
        diasRestantes: Number(f.dias_restantes)
      }))
    };
  }

  async obtener(usuario, idCrudo) {
    const id = idObligatorio(idCrudo, 'Borrador');
    const fila = await repo.obtenerVigente(id, usuario.id);
    if (!fila) throw new ErrorDeNegocio(msg('borrador.noExiste', { id }), 404);
    return {
      id: fila.id,
      modalidad: fila.modalidad,
      datos: parsearJson(fila.datos),
      creadoEn: fila.creado_en,
      venceEn: fila.vence_en,
      diasRestantes: Number(fila.dias_restantes)
    };
  }

  async crear(usuario, cuerpo) {
    const { modalidad, datosJson } = validarForma(cuerpo);
    const [vigencia, tope] = await Promise.all([leerAjusteEntero(BORRADORES.AJUSTE_VIGENCIA_DIAS), leerAjusteEntero(BORRADORES.AJUSTE_MAX_POR_USUARIO)]);
    // Bloquear al usuario antes de contar evita que dos guardados simultáneos superen el tope.
    const id = await db.transaccion(async tx => {
      await repo.bloquearUsuario(usuario.id, tx);
      if (await repo.contarVigentes(usuario.id, tx) >= tope) throw new ErrorDeNegocio(msg('borrador.tope', { tope }), 409);
      return repo.insertar(usuario.id, modalidad, datosJson, vigencia, tx);
    });
    return this.obtener(usuario, id);
  }

  // Editar no cuenta contra el tope ni cambia `vence_en` ni `creado_en`.
  async actualizar(usuario, idCrudo, cuerpo) {
    const id = idObligatorio(idCrudo, 'Borrador');
    const { modalidad, datosJson } = validarForma(cuerpo);
    if (!(await repo.obtenerVigente(id, usuario.id))) throw new ErrorDeNegocio(msg('borrador.noExiste', { id }), 404);
    await repo.actualizar(id, usuario.id, modalidad, datosJson);
    return this.obtener(usuario, id);
  }

  async eliminar(usuario, idCrudo) {
    const id = idObligatorio(idCrudo, 'Borrador');
    if (await repo.eliminar(id, usuario.id) === 0) throw new ErrorDeNegocio(msg('borrador.noExiste', { id }), 404);
    return { ok: true };
  }

  // Al enviar la solicitud: borra el borrador de origen dentro de su transacción; uno ajeno o ya borrado se ignora.
  async descartarAlEnviar(usuarioId, borradorId, tx) {
    await repo.eliminar(borradorId, usuarioId, tx);
  }

  // Cada hora: borra los vencidos (solo filas de MySQL, no es una acción crítica de entorno).
  async purgarVencidos() {
    return repo.eliminarVencidos();
  }
}

module.exports = new BorradorService();
