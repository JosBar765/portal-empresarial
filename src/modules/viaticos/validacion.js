// src/modules/viaticos/validacion.js
// Acumula los errores por campo para devolverlos todos juntos. Validar no es sanear: solo se acepta o se rechaza.
const { ErrorDeNegocio } = require('../../core/utils/erroresHttp');
const { aEntero } = require('../../core/utils/validar');
const { errorDeValidacion } = require('./errores');
const { msg } = require('./mensajes');

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DECIMAL_RE = /^-?\d{1,10}(\.\d{1,2})?$/;
const ENTERO_RE = /^-?\d{1,10}$/;
const FECHA_HORA_RE = /^(\d{4}-\d{2}-\d{2}) ([01]\d|2[0-3]):([0-5]\d)$/;

function vacio(valor) {
  return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}

// Para citar en un mensaje lo que envió el cliente, acotado.
function mostrar(valor) {
  if (valor === undefined) return 'vacío';
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  return texto.length > 40 ? `${texto.slice(0, 40)}…` : texto;
}

function fechaValida(texto) {
  const partes = FECHA_RE.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

function cuerpoObjeto(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new ErrorDeNegocio(msg('validacion.cuerpo'), 400);
  return cuerpo;
}

class Validador {
  constructor() {
    this.campos = {};
  }

  falla(campo, mensaje) {
    if (!Object.prototype.hasOwnProperty.call(this.campos, campo)) this.campos[campo] = mensaje;
  }

  faltante(campo, etiqueta, requerido) {
    if (requerido) this.falla(campo, msg('campo.obligatorio', { etiqueta }));
    return null;
  }

  texto(cuerpo, campo, etiqueta, { max, requerido = true, formato, reglaFormato, mayusculas = false } = {}) {
    let valor = cuerpo[campo];
    if (vacio(valor)) return this.faltante(campo, etiqueta, requerido);
    if (typeof valor !== 'string') {
      this.falla(campo, msg('campo.texto', { etiqueta }));
      return null;
    }
    valor = valor.trim();
    if (mayusculas) valor = valor.toUpperCase();
    if (valor.length > max) {
      this.falla(campo, msg('campo.textoLargo', { etiqueta, max, largo: valor.length }));
      return null;
    }
    if (formato && !formato.test(valor)) {
      this.falla(campo, msg('campo.formato', { etiqueta, regla: reglaFormato, valor: mostrar(valor) }));
      return null;
    }
    return valor;
  }

  id(cuerpo, campo, etiqueta, { requerido = true } = {}) {
    const valor = cuerpo[campo];
    if (vacio(valor)) return this.faltante(campo, etiqueta, requerido);
    const id = aEntero(valor);
    if (id === null) this.falla(campo, msg('campo.id', { etiqueta, valor: mostrar(valor) }));
    return id;
  }

  entero(cuerpo, campo, etiqueta, { min, max, requerido = true }) {
    const valor = cuerpo[campo];
    if (vacio(valor)) return this.faltante(campo, etiqueta, requerido);
    const esEntero = (typeof valor === 'number' && Number.isInteger(valor)) || (typeof valor === 'string' && ENTERO_RE.test(valor.trim()));
    const numero = esEntero ? Number(valor) : NaN;
    if (!(numero >= min && numero <= max)) {
      this.falla(campo, msg('campo.entero', { etiqueta, min, max, valor: mostrar(valor) }));
      return null;
    }
    return numero;
  }

  // Hasta 2 decimales, como las columnas DECIMAL(n,2) de la base; un negativo cae en el error de rango, no en el de formato.
  decimal(cuerpo, campo, etiqueta, { min = 0, minExclusivo = false, max, requerido = true }) {
    const valor = cuerpo[campo];
    if (vacio(valor)) return this.faltante(campo, etiqueta, requerido);
    const texto = typeof valor === 'number' ? String(valor) : typeof valor === 'string' ? valor.trim() : '';
    if (!DECIMAL_RE.test(texto)) {
      this.falla(campo, msg('campo.decimalFormato', { etiqueta, valor: mostrar(valor) }));
      return null;
    }
    const numero = Number(texto);
    if ((minExclusivo ? numero <= min : numero < min) || numero > max) {
      const condicion = `${minExclusivo ? 'mayor que' : 'mayor o igual que'} ${min} y menor o igual que ${max}`;
      this.falla(campo, msg('campo.decimalRango', { etiqueta, condicion, valor: mostrar(valor) }));
      return null;
    }
    return numero;
  }

  fecha(cuerpo, campo, etiqueta, { requerido = true } = {}) {
    const valor = cuerpo[campo];
    if (vacio(valor)) return this.faltante(campo, etiqueta, requerido);
    if (typeof valor !== 'string' || !fechaValida(valor.trim())) {
      this.falla(campo, msg('campo.fecha', { etiqueta, valor: mostrar(valor) }));
      return null;
    }
    return valor.trim();
  }

  // «AAAA-MM-DD HH:mm» (hora de Guatemala); devuelve el texto sin cambios.
  fechaHora(cuerpo, campo, etiqueta, { requerido = true } = {}) {
    const valor = cuerpo[campo];
    if (vacio(valor)) return this.faltante(campo, etiqueta, requerido);
    const partes = typeof valor === 'string' ? FECHA_HORA_RE.exec(valor.trim()) : null;
    if (!partes || !fechaValida(partes[1])) {
      this.falla(campo, msg('campo.fechaHora', { etiqueta, valor: mostrar(valor) }));
      return null;
    }
    return valor.trim();
  }

  // Devuelve 1 o 0; undefined si no vino y no es obligatorio.
  booleano(cuerpo, campo, etiqueta, { requerido = false } = {}) {
    const valor = cuerpo[campo];
    if (valor === undefined || valor === null) {
      if (requerido) this.falla(campo, msg('campo.obligatorio', { etiqueta }));
      return undefined;
    }
    if (valor === true || valor === 1 || valor === '1') return 1;
    if (valor === false || valor === 0 || valor === '0') return 0;
    this.falla(campo, msg('campo.booleano', { etiqueta }));
    return undefined;
  }

  lanzar() {
    if (Object.keys(this.campos).length > 0) throw errorDeValidacion(msg('validacion.revisar'), this.campos);
  }
}

// Cuerpo de PATCH /:id/activo.
function validarActivo(cuerpo) {
  const v = new Validador();
  const activo = v.booleano(cuerpoObjeto(cuerpo), 'activo', 'Activo', { requerido: true });
  v.lanzar();
  return activo;
}

module.exports = { Validador, cuerpoObjeto, validarActivo, vacio, mostrar, fechaValida };
