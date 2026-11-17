// Reglas puras de la pestaña Configuración (sin DOM): validación del cliente, armado de payloads, búsqueda local y matriz de valores de comida.
// El servidor vuelve a validar todo; aquí solo se evita un viaje de ida y vuelta con un mensaje explicativo.
import { t } from '../../textos.js';
import { aNumero, normalizarDecimal } from '../../utils/numero.js';

// Mismos topes que src/modules/viaticos/constantes.js (LIMITES).
export const LIMITES = Object.freeze({ KM: 99999999.99, HORAS: 999.99, VALOR: 99999999.99 });

const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

// ---------- Búsqueda local ----------

export const sinAcentos = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// `extraer(fila)` devuelve los textos donde se busca; sin texto de búsqueda no se filtra.
export function filtrarFilas(filas, busqueda, extraer) {
  const q = sinAcentos(busqueda).trim();
  if (!q) return filas;
  return filas.filter(fila => sinAcentos(extraer(fila).filter(x => x != null).join(' ')).includes(q));
}

// ---------- Números ----------

// Decimal mayor que 0 con hasta 2 decimales (como las columnas DECIMAL(n,2)); devuelve { valor } o { error }.
export function validarDecimalPositivo(texto, { campo, max, ejemplo }) {
  if (vacio(texto)) return { error: t('config.error.numeroFalta', { campo, ejemplo }) };
  const crudo = String(texto).trim();
  // Un negativo es un número válido fuera de rango: se explica la regla, no el formato.
  const negativo = crudo.startsWith('-');
  const canonico = normalizarDecimal(negativo ? crudo.slice(1) : crudo);
  if (canonico === null || canonico === '') return { error: t('config.error.numeroInvalido', { campo, ejemplo }) };
  if (negativo) return { error: t('config.error.numeroRango', { campo, max }) };
  if (/\.\d{3,}$/.test(canonico)) return { error: t('config.error.numeroDecimales', { campo }) };
  const valor = Number(canonico);
  if (!(valor > 0) || valor > max) return { error: t('config.error.numeroRango', { campo, max }) };
  return { valor };
}

// ---------- Catálogos simples ----------

export const esProtegido = (definicion, fila) => Boolean(definicion.protegidos) && definicion.protegidos.includes(fila.nombre);

// Claves de texto con lo que la fila tiene de informativo (no editable): rubro del sistema, «otros», no seleccionable.
export function notasDeFila(definicion, fila) {
  const notas = [];
  if (esProtegido(definicion, fila)) notas.push('config.protegido.nota');
  if (definicion.informativos && definicion.informativos.includes('esOtros') && fila.esOtros) notas.push('config.info.esOtros');
  if (definicion.informativos && definicion.informativos.includes('seleccionableEnGastos') && fila.seleccionableEnGastos === false) notas.push('config.info.noSeleccionable');
  return notas;
}

export const etiquetaCampo = (campo) => t(campo.etiqueta || `config.campo.${campo.nombre}`);

// Campos que viajan en el alta o en la edición (lo que no se puede cambiar después queda fuera de la edición).
export const camposDe = (definicion, enEdicion) => definicion.campos.filter(c => !(enEdicion && c.soloAlta));

// Errores del cliente como { campo: mensaje }; `valores` trae el texto crudo de cada campo.
export function validarCamposCatalogo(definicion, valores, { enEdicion = false, fila = null } = {}) {
  const errores = {};
  for (const campo of camposDe(definicion, enEdicion)) {
    const etiqueta = etiquetaCampo(campo);
    const crudo = valores[campo.nombre];
    // El nombre de un rubro del sistema no se edita: se reenvía tal cual y no se vuelve a validar.
    if (enEdicion && fila && campo.nombre === 'nombre' && esProtegido(definicion, fila)) continue;
    if (campo.tipo === 'pais') {
      if (vacio(crudo)) errores[campo.nombre] = t('config.error.obligatorioLista', { campo: etiqueta });
      continue;
    }
    let texto = vacio(crudo) ? '' : String(crudo).trim();
    if (texto === '') {
      if (campo.obligatorio !== false) errores[campo.nombre] = t('config.error.obligatorio', { campo: etiqueta });
      continue;
    }
    if (campo.mayusculas) texto = texto.toUpperCase();
    if (texto.length > campo.max) errores[campo.nombre] = t('config.error.largo', { campo: etiqueta, largo: texto.length, max: campo.max });
    else if (campo.formato && !campo.formato.test(texto)) errores[campo.nombre] = t('config.error.formato', { campo: etiqueta, regla: t(campo.regla) });
  }
  return errores;
}

export function armarPayloadCatalogo(definicion, valores, { enEdicion = false } = {}) {
  const payload = {};
  for (const campo of camposDe(definicion, enEdicion)) {
    const crudo = valores[campo.nombre];
    if (campo.tipo === 'pais') payload[campo.nombre] = Number(crudo);
    else {
      const texto = vacio(crudo) ? '' : String(crudo).trim();
      payload[campo.nombre] = campo.mayusculas ? texto.toUpperCase() : texto;
    }
  }
  return payload;
}

// ---------- Tramos ----------

// Errores del cliente de un tramo; en la edición solo cuentan km y horas (el par no cambia).
export function validarTramo({ origenId, destinoId, km, horas }, { enEdicion = false, nombreDe = () => '' } = {}) {
  const errores = {};
  if (!enEdicion) {
    if (vacio(origenId)) errores.origenId = t('config.error.obligatorioLista', { campo: t('config.tramos.campo.origenId') });
    if (vacio(destinoId)) errores.destinoId = t('config.error.obligatorioLista', { campo: t('config.tramos.campo.destinoId') });
    else if (!vacio(origenId) && Number(origenId) === Number(destinoId)) errores.destinoId = t('config.tramos.error.mismo', { nombre: nombreDe(Number(destinoId)) });
  }
  const medidaKm = validarDecimalPositivo(km, { campo: t('config.tramos.campo.km'), max: LIMITES.KM, ejemplo: '205' });
  if (medidaKm.error) errores.km = medidaKm.error;
  const medidaHoras = validarDecimalPositivo(horas, { campo: t('config.tramos.campo.horas'), max: LIMITES.HORAS, ejemplo: '8' });
  if (medidaHoras.error) errores.horas = medidaHoras.error;
  return errores;
}

// El servidor guarda el par ordenado; el alta manda origen y destino tal como se eligieron y la edición solo las medidas.
export function armarPayloadTramo({ origenId, destinoId, km, horas }, { enEdicion = false } = {}) {
  const medidas = { km: Number(normalizarDecimal(km)), horas: Number(normalizarDecimal(horas)) };
  return enEdicion ? medidas : { origenId: Number(origenId), destinoId: Number(destinoId), ...medidas };
}

// Origen siempre solo; el destino lleva su país entre paréntesis cuando es de otro país que el origen.
export function nombreDestinoTramo(tramo) {
  return tramo.paisAId !== tramo.paisBId
    ? t('config.tramos.paisEntre', { nombre: tramo.ubicacionBNombre, pais: tramo.paisBNombre })
    : tramo.ubicacionBNombre;
}

// «205» o «20.5»: entero si lo es, hasta 2 decimales si no.
export function formatearMedida(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return String(valor ?? '');
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

// ---------- Valores de comidas ----------

export const claveCelda = (monedaId, tipoComidaId) => `${monedaId}-${tipoComidaId}`;

// Valor del servidor -> texto de la celda: «35.00»; sin valor, vacío («sin configurar»).
export const textoDeCelda = (valor) => (valor === null || valor === undefined || valor === '' ? '' : Number(valor).toFixed(2));

// Respuesta de GET /config/valores-comida -> texto inicial de cada celda por clave.
export function celdasIniciales(matriz) {
  const celdas = {};
  for (const moneda of matriz.monedas || []) {
    for (const tipo of matriz.tiposComida || []) celdas[claveCelda(moneda.id, tipo.id)] = textoDeCelda((moneda.valores || {})[tipo.id]);
  }
  return celdas;
}

// Dos textos valen lo mismo si son el mismo número (35 = 35.00) o ambos están vacíos.
const mismoValor = (a, b) => {
  const na = aNumero(a);
  const nb = aNumero(b);
  if (na === null && nb === null) return String(a ?? '').trim() === String(b ?? '').trim();
  return na === nb;
};

export function hayCambiosEnCeldas(iniciales, actuales) {
  return Object.keys({ ...iniciales, ...actuales }).some(clave => !mismoValor(iniciales[clave] ?? '', actuales[clave] ?? ''));
}

// Arreglo { monedaId, tipoComidaId, valor } solo de las celdas con valor, en el orden de la matriz (el servidor indexa los errores sobre él).
export function celdasAGuardar(matriz, actuales) {
  const celdas = [];
  for (const moneda of matriz.monedas || []) {
    for (const tipo of matriz.tiposComida || []) {
      const texto = actuales[claveCelda(moneda.id, tipo.id)];
      if (vacio(texto)) continue;
      celdas.push({ monedaId: moneda.id, tipoComidaId: tipo.id, valor: Number(normalizarDecimal(texto)) });
    }
  }
  return celdas;
}

// Errores del cliente como { claveCelda: mensaje }; `nombreDe(monedaId, tipoId)` da el texto «Desayuno (Quetzal)».
export function validarCeldas(matriz, actuales, nombreDe) {
  const errores = {};
  for (const moneda of matriz.monedas || []) {
    for (const tipo of matriz.tiposComida || []) {
      const clave = claveCelda(moneda.id, tipo.id);
      if (vacio(actuales[clave])) continue;
      const { error } = validarDecimalPositivo(actuales[clave], { campo: nombreDe(moneda, tipo), max: LIMITES.VALOR, ejemplo: '35.50' });
      if (error) errores[clave] = error;
    }
  }
  return errores;
}

// `valores[2].valor` (posición dentro de lo enviado) -> clave de la celda enviada en esa posición; null si no es de una celda.
export function claveDeCampoServidor(campo, enviadas) {
  const m = /^valores\[(\d+)\]/.exec(String(campo));
  const celda = m ? enviadas[Number(m[1])] : null;
  return celda ? claveCelda(celda.monedaId, celda.tipoComidaId) : null;
}
