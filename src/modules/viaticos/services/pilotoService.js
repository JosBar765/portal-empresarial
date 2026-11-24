// src/modules/viaticos/services/pilotoService.js
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const repo = require('../repositories/pilotoRepository');
const referencias = require('../repositories/referenciaRepository');
const { Validador, cuerpoObjeto, validarActivo } = require('../validacion');
const { errorDeValidacion } = require('../errores');
const { msg } = require('../mensajes');
const { erroresDeTextos } = require('./pdf/solicitudPdfService');

function validar(cuerpo) {
  const datos = cuerpoObjeto(cuerpo);
  const v = new Validador();
  const valores = {
    nombre: v.texto(datos, 'nombre', 'Nombre', { max: 100 }),
    tipo_licencia_id: v.id(datos, 'tipoLicenciaId', 'Tipo de licencia'),
    numero: v.texto(datos, 'numero', 'Número de licencia', { max: 50 }),
    vence_el: v.fecha(datos, 'venceEl', 'Vencimiento de la licencia')
  };
  v.lanzar();
  return valores;
}

async function verificarReferencias(valores) {
  const campos = {};
  if (!(await referencias.tipoLicenciaPorId(valores.tipo_licencia_id))) campos.tipoLicenciaId = msg('persona.tipoLicenciaNoExiste');
  // Nombre y número salen en el PDF de la solicitud: sus caracteres deben poder dibujarse.
  const textos = await erroresDeTextos([
    { campo: 'nombre', etiqueta: 'Nombre', valor: valores.nombre },
    { campo: 'numero', etiqueta: 'Número de licencia', valor: valores.numero }
  ]);
  textos.forEach(e => { campos[e.campo] = e.mensaje; });
  if (Object.keys(campos).length > 0) throw errorDeValidacion(msg('validacion.revisar'), campos);
}

async function leer(id) {
  const fila = await repo.obtenerPorId(id);
  if (!fila) throw new ErrorDeNegocio(msg('piloto.noExiste', { id }), 404);
  return fila;
}

class PilotoService {
  listar() {
    return repo.listar();
  }

  async crear(cuerpo) {
    const valores = validar(cuerpo);
    await verificarReferencias(valores);
    return leer(await repo.insertar(valores));
  }

  async editar(id, cuerpo) {
    await leer(id);
    const valores = validar(cuerpo);
    await verificarReferencias(valores);
    await repo.actualizar(id, valores);
    return leer(id);
  }

  async cambiarActivo(id, cuerpo) {
    const activo = validarActivo(cuerpo);
    await leer(id);
    await repo.cambiarActivo(id, activo);
    return leer(id);
  }
}

module.exports = new PilotoService();
