// src/modules/viaticos/services/contextoService.js
// Lo que la interfaz necesita saber del usuario al abrir el módulo.
const personaRepository = require('../repositories/personaRepository');
const ajusteRepository = require('../repositories/ajusteRepository');
const { PREFIJO_PERMISOS } = require('../constantes');
const { parsearJson } = require('../utilidades');

class ContextoService {
  async obtener(usuario) {
    const [paises, licencia, ajustes] = await Promise.all([
      personaRepository.listarPaisesDe(usuario.id),
      personaRepository.obtenerLicencia(usuario.id),
      ajusteRepository.listar()
    ]);
    const valorDe = clave => {
      const fila = ajustes.find(a => a.clave === clave);
      return fila ? parsearJson(fila.valor) : null;
    };
    const { usuarioId, ...datosLicencia } = licencia || {};
    return {
      usuario: { id: usuario.id, nombre: usuario.nombre },
      permisos: (usuario.permissions || []).filter(p => p.startsWith(PREFIJO_PERMISOS)),
      paises: paises.map(({ id, codigo, nombre }) => ({ id, codigo, nombre })),
      licencia: licencia ? datosLicencia : null,
      ajustes: {
        tiposArchivoPermitidos: valorDe('tipos_archivo_permitidos'),
        maxArchivoMb: valorDe('max_archivo_mb')
      }
    };
  }
}

module.exports = new ContextoService();
