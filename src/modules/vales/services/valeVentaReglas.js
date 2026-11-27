// Reglas puras de la venta por orden de venta (OV): sin acceso a datos.
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { quitarInvisibles } = require('../../../core/utils/texto');
const { ROL } = require('./valeHelpers');

const ESTADOS_VENTA = Object.freeze({ POR_CONFIRMAR: 'POR_CONFIRMAR', CONFIRMADA: 'CONFIRMADA', RECHAZADA: 'RECHAZADA', BORRADA: 'BORRADA' });
const MAX_DIGITOS_OV = 12;

// La OV se copia de otra plataforma: se limpian espacios e invisibles antes de validar. Viaja como texto.
function normalizarNumeroOv(valor) {
  const numero = typeof valor === 'string' ? quitarInvisibles(valor).replace(/\s+/g, '') : '';
  if (!numero) throw new ErrorDeNegocio('Escribe el número de orden de venta (OV).', 400);
  if (!/^\d+$/.test(numero)) {
    throw new ErrorDeNegocio('La OV solo puede tener números. Quita letras, guiones, puntos o comas y vuelve a pegarla.', 400);
  }
  if (numero.startsWith('0')) {
    throw new ErrorDeNegocio(`La OV no puede empezar con cero y tiene hasta ${MAX_DIGITOS_OV} dígitos. Revisa el número copiado.`, 400);
  }
  if (numero.length > MAX_DIGITOS_OV) {
    throw new ErrorDeNegocio(`La OV tiene hasta ${MAX_DIGITOS_OV} dígitos y escribiste ${numero.length}. Revisa el número copiado.`, 400);
  }
  return numero;
}

// Las filas de trabajo de un taller (propuesta o fusión) no llevan la venta; las propias de quien también crea, sí.
const admiteVenta = (fila) => !fila._tipoRegistro || !!fila._propio;

// La ven el dueño, el supervisor del asesor, el administrador y el gerente. `supervisados`: asesores que supervisa quien mira.
function veVenta(usuario, asesorId, supervisados) {
  return usuario.rolId === ROL.ADMINISTRADOR || usuario.rolId === ROL.GERENTE || asesorId === usuario.id || supervisados.has(asesorId);
}

const porConfirmar = (fila) => fila.venta?.estado === ESTADOS_VENTA.POR_CONFIRMAR;

// Las pendientes van primero (la más antigua arriba); las demás conservan su orden.
function ordenarConVentas(filas) {
  const pendientes = filas.filter(porConfirmar)
    .sort((a, b) => String(a.venta.registrada_en).localeCompare(String(b.venta.registrada_en)) || a.venta.id - b.venta.id);
  return [...pendientes, ...filas.filter(f => !porConfirmar(f))];
}

module.exports = { ESTADOS_VENTA, MAX_DIGITOS_OV, normalizarNumeroOv, admiteVenta, veVenta, porConfirmar, ordenarConVentas };
