// src/modules/incidencias/repositories/parametroRepository.js
// Los parámetros del módulo viven en `parametros_sistema` con el prefijo `incidencias.`.
const db = require('../../../config/database');

class ParametroRepository {
  async leerTodos() {
    return db.query("SELECT `clave`, `valor` FROM `parametros_sistema` WHERE `clave` LIKE 'incidencias.%'", [], 'incidencias_parametros:leer');
  }
}

module.exports = new ParametroRepository();
