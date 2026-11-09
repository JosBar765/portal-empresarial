// src/modules/proyectos/services/resumenService.js
// Datos del inicio del Centro de configuración (A0): cuánto hay en cada área, qué falta y los últimos cambios.
const catalogoRepository = require('../repositories/catalogoRepository');
const alcanceRepository = require('../repositories/alcanceRepository');
const campoRepository = require('../repositories/campoRepository');
const configService = require('./configService');
const historialService = require('./historialService');
const { CATALOGOS } = require('../catalogos');

const CAMBIOS_RECIENTES = 5;

class ResumenService {
  // Quién tocó por última vez cada área y cuándo, para la tarjeta de cada una.
  async ultimoCambioPorArea() {
    const areas = ['parametros', 'reglas', 'catalogos', 'paises', 'campos', 'alcance'];
    const filas = await Promise.all(areas.map(area => historialService.listar({ area }, 1)));
    return Object.fromEntries(areas.map((area, i) => {
      const ultimo = filas[i].items[0];
      return [area, ultimo ? { usuario: ultimo.usuario, fecha: ultimo.fecha } : null];
    }));
  }

  async obtener() {
    const [conteos, paises, parametros, reglas, historial, ultimos, campos, excepciones] = await Promise.all([
      Promise.all(Object.values(CATALOGOS).map(def => catalogoRepository.contar(def))),
      configService.paises(),
      configService.describir('parametros'),
      configService.describir('reglas'),
      historialService.listar({}, CAMBIOS_RECIENTES),
      this.ultimoCambioPorArea(),
      campoRepository.listar(),
      alcanceRepository.todasLasExcepciones()
    ]);
    const ajustes = parametros.flatMap(g => g.parametros);
    const sinMoneda = paises.filter(p => !p.monedaCodigo);

    return {
      catalogos: {
        // Los nueve catálogos de A1: los ocho del registro más los países.
        tipos: conteos.length + 1,
        filas: conteos.reduce((suma, c) => suma + c.total, 0) + paises.length,
        activas: conteos.reduce((suma, c) => suma + c.activas, 0) + paises.length
      },
      parametros: { total: ajustes.length, cambiados: ajustes.filter(a => !a.esDefecto).length },
      reglas: reglas.flatMap(g => g.parametros).map(r => ({ clave: r.clave, etiqueta: r.etiqueta, valor: r.valor })),
      campos: { total: campos.length, activos: campos.filter(c => c.activo).length },
      alcance: { personasConExcepciones: new Set(excepciones.map(e => e.usuario_id)).size },
      paises: { total: paises.length, sinMoneda: sinMoneda.map(p => p.nombre) },
      historial: { total: historial.total, recientes: historial.items },
      ultimos,
      // Cosas que el administrador debe resolver; hoy solo los países sin moneda local.
      pendientes: sinMoneda.length ? [{ tipo: 'pais_sin_moneda', paises: sinMoneda.map(p => p.nombre) }] : []
    };
  }
}

module.exports = new ResumenService();
