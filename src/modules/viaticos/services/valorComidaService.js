// src/modules/viaticos/services/valorComidaService.js
// Matriz moneda × tipo de comida.
const db = require('../../../config/database');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const repo = require('../repositories/valorComidaRepository');
const { Validador, cuerpoObjeto, vacio } = require('../validacion');
const { errorDeValidacion } = require('../errores');
const { LIMITES } = require('../constantes');
const { msg } = require('../mensajes');

class ValorComidaService {
  async obtener() {
    const [monedas, tiposComida, valores] = await Promise.all([repo.listarMonedas(), repo.listarTiposComida(), repo.listarValores()]);
    const porMoneda = new Map();
    for (const fila of valores) {
      if (!porMoneda.has(fila.monedaId)) porMoneda.set(fila.monedaId, {});
      porMoneda.get(fila.monedaId)[fila.tipoComidaId] = fila.valor;
    }
    return {
      tiposComida,
      monedas: monedas.map(m => ({
        ...m,
        valores: Object.fromEntries(tiposComida.map(t => [t.id, (porMoneda.get(m.id) || {})[t.id] ?? null]))
      }))
    };
  }

  // Recibe la matriz completa: una celda sin valor (null o vacío) queda sin configurar.
  async guardar(cuerpo) {
    const { valores } = cuerpoObjeto(cuerpo);
    if (!Array.isArray(valores)) throw new ErrorDeNegocio(msg('comida.lista'), 400);

    const v = new Validador();
    const celdas = [];
    valores.forEach((item, i) => {
      const celda = item && typeof item === 'object' ? item : {};
      const vc = new Validador();
      const monedaId = vc.id(celda, 'monedaId', 'Moneda');
      const tipoComidaId = vc.id(celda, 'tipoComidaId', 'Tipo de comida');
      // La base exige valor > 0 (CHECK): para no tener valor se deja la celda vacía.
      const valor = vacio(celda.valor) ? null : vc.decimal(celda, 'valor', 'Valor', { min: 0, minExclusivo: true, max: LIMITES.VALOR_MAX });
      for (const [campo, mensaje] of Object.entries(vc.campos)) v.falla(`valores[${i}].${campo}`, mensaje);
      if (valor !== null && monedaId !== null && tipoComidaId !== null) celdas.push({ monedaId, tipoComidaId, valor });
    });
    v.lanzar();

    const vistas = new Set();
    for (const celda of celdas) {
      const clave = `${celda.monedaId}-${celda.tipoComidaId}`;
      if (vistas.has(clave)) throw new ErrorDeNegocio(msg('comida.repetido', celda), 400);
      vistas.add(clave);
    }

    await db.transaccion(async tx => {
      const monedas = new Set((await repo.listarMonedas(tx)).map(m => m.id));
      const tipos = new Set((await repo.listarTiposComida(tx)).map(t => t.id));
      for (const celda of celdas) {
        if (!monedas.has(celda.monedaId)) throw errorDeValidacion(msg('comida.monedaNoExiste', { id: celda.monedaId }), {});
        if (!tipos.has(celda.tipoComidaId)) throw errorDeValidacion(msg('comida.tipoNoExiste', { id: celda.tipoComidaId }), {});
      }
      await repo.reemplazar(celdas, tx);
    });
    return this.obtener();
  }
}

module.exports = new ValorComidaService();
