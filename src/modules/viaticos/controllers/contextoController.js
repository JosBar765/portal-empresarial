// src/modules/viaticos/controllers/contextoController.js
const service = require('../services/contextoService');
const { manejar } = require('./manejar');

module.exports = {
  obtener: manejar(req => service.obtener(req.user))
};
