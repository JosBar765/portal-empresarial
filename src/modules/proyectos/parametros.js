// src/modules/proyectos/parametros.js
// Registro de parámetros del módulo: la pantalla del administrador se dibuja desde aquí y todo valor se valida
// contra él. Un parámetro nuevo es una línea más; no hay que tocar la pantalla ni crear tablas.
// Los valores viven en `parametros_sistema` con el prefijo `proyectos.`; si falta la fila, manda `defecto`.
const { errorDeValidacion } = require('./errores');

const PREFIJO = 'proyectos.';

const GRUPOS = [
  { id: 'reparto', nombre: 'Reparto' },
  { id: 'seguimiento', nombre: 'Seguimiento' },
  { id: 'semaforo', nombre: 'Semáforo' },
  { id: 'importacion', nombre: 'Importación' },
  { id: 'empresas', nombre: 'Empresas' },
  { id: 'proyecto', nombre: 'Proyecto' },
  { id: 'informe', nombre: 'Informe' },
  { id: 'reglas', nombre: 'Reglas e interruptores' },
  { id: 'automatizacion', nombre: 'Automatización' }
];

const SECCIONES_INFORME = ['embudo', 'montos', 'canal', 'muestras', 'por_asesor', 'por_tienda'];
const MARCADORES_CODIGO = ['{AAAA}', '{MM}', '{NICHO}', '{N}'];

// `pantalla`: dónde se edita (parametros = A3, reglas = A5). `unidad` solo orienta el texto de la pantalla.
const PARAMETROS = [
  { clave: 'reparto.reciben_supervisores', grupo: 'reparto', tipo: 'booleano', defecto: false,
    etiqueta: 'Los supervisores también reciben empresas', ayuda: 'Si se apaga, solo reparten los asesores.' },
  { clave: 'reparto.afinidad_tienda', grupo: 'reparto', tipo: 'booleano', defecto: true,
    etiqueta: 'Preferir la tienda que registró la empresa', ayuda: 'Desempata a favor de la tienda de origen.' },
  { clave: 'reparto.tope_por_asesor', grupo: 'reparto', tipo: 'entero_opcional', defecto: null, min: 1, max: 500, unidad: 'empresas',
    etiqueta: 'Tope de empresas por asesor', ayuda: 'Lo propone cada plantilla. Vacío = sin tope; lo que sobra queda en reserva.' },
  { clave: 'reparto.rondas', grupo: 'reparto', tipo: 'booleano', defecto: false,
    etiqueta: 'Repartir la reserva en una segunda ronda', ayuda: 'Permite repartir lo que sobró cuando alguien termina.' },
  { clave: 'reparto.descanso_meses', grupo: 'reparto', tipo: 'entero', defecto: 3, min: 0, max: 36, unidad: 'meses',
    etiqueta: 'Descanso de una empresa con venta', ayuda: 'Meses antes de repetir empresa en el nicho. 0 lo apaga.' },

  { clave: 'seguimiento.dias_estancado', grupo: 'seguimiento', tipo: 'entero', defecto: 7, min: 1, max: 60, unidad: 'días',
    etiqueta: 'Días sin gestión para marcar «estancada»', ayuda: 'Después de estos días sin gestión, la empresa aparece como estancada.' },
  { clave: 'vencimiento.gracia_dias_habiles', grupo: 'seguimiento', tipo: 'entero', defecto: 3, min: 0, max: 15, unidad: 'días hábiles',
    etiqueta: 'Gracia antes de marcar «vencido»', ayuda: 'Días hábiles tras la fecha de fin antes de avisar del vencimiento.' },

  { clave: 'semaforo.cobertura_verde', grupo: 'semaforo', tipo: 'porcentaje', defecto: 75, min: 0, max: 100, unidad: '%',
    etiqueta: 'Cobertura: verde desde', ayuda: 'Gestionadas ÷ asignadas, frente a lo esperado para la etapa.' },
  { clave: 'semaforo.cobertura_ambar', grupo: 'semaforo', tipo: 'porcentaje', defecto: 50, min: 0, max: 100, unidad: '%',
    etiqueta: 'Cobertura: ámbar desde', ayuda: 'Por debajo de este valor, el semáforo queda en rojo.' },
  { clave: 'semaforo.efectividad_verde', grupo: 'semaforo', tipo: 'porcentaje', defecto: 75, min: 0, max: 100, unidad: '%',
    etiqueta: 'Efectividad: verde desde', ayuda: 'Interesadas ÷ asignadas, al cierre del proyecto.' },
  { clave: 'semaforo.efectividad_ambar', grupo: 'semaforo', tipo: 'porcentaje', defecto: 50, min: 0, max: 100, unidad: '%',
    etiqueta: 'Efectividad: ámbar desde', ayuda: 'Por debajo de este valor, el semáforo queda en rojo.' },

  { clave: 'importacion.max_filas', grupo: 'importacion', tipo: 'entero', defecto: 2000, min: 100, max: 10000, unidad: 'filas',
    etiqueta: 'Filas máximas por archivo', ayuda: 'Un archivo con más filas se rechaza.' },
  { clave: 'importacion.max_mb', grupo: 'importacion', tipo: 'entero', defecto: 5, min: 1, max: 20, unidad: 'MB',
    etiqueta: 'Tamaño máximo del CSV', ayuda: 'Un archivo más pesado se rechaza.' },
  { clave: 'importacion.duplicadas_por_defecto', grupo: 'importacion', tipo: 'lista', defecto: 'omitir', opciones: ['omitir', 'actualizar'],
    etiqueta: 'Qué hacer con las duplicadas', ayuda: 'Es lo que viene marcado por defecto en cada fila duplicada.' },

  { clave: 'empresas.ciudad_obligatoria', grupo: 'empresas', tipo: 'booleano', defecto: false,
    etiqueta: 'La ciudad es obligatoria', ayuda: 'Si se enciende, no se puede guardar una empresa sin ciudad.' },
  { clave: 'empresas.contacto_obligatorio', grupo: 'empresas', tipo: 'booleano', defecto: true,
    etiqueta: 'Pedir al menos un contacto', ayuda: 'Cada empresa nueva necesita un contacto.' },
  { clave: 'empresas.telefono_o_correo_obligatorio', grupo: 'empresas', tipo: 'booleano', defecto: true,
    etiqueta: 'Pedir teléfono o correo', ayuda: 'Hace falta al menos una forma de contactar.' },
  { clave: 'empresas.sitio_web_obligatorio', grupo: 'empresas', tipo: 'booleano', defecto: false,
    etiqueta: 'El sitio web es obligatorio', ayuda: 'Si se enciende, no se puede guardar una empresa sin sitio web.' },
  { clave: 'empresas.duplicado_por_nombre_ciudad', grupo: 'empresas', tipo: 'booleano', defecto: true,
    etiqueta: 'Avisar de duplicado por país, nombre y ciudad', ayuda: 'Avisa antes de crear una empresa parecida a otra.' },
  { clave: 'empresas.duplicado_por_telefono', grupo: 'empresas', tipo: 'booleano', defecto: true,
    etiqueta: 'Avisar de duplicado por teléfono', ayuda: 'Avisa si el teléfono ya está en otra empresa.' },
  { clave: 'empresas.similitud_minima', grupo: 'empresas', tipo: 'porcentaje', defecto: 85, min: 50, max: 100, unidad: '%',
    etiqueta: 'Parecido mínimo del nombre', ayuda: 'Qué tan parecido debe ser un nombre para avisar.' },

  { clave: 'codigo.formato', grupo: 'proyecto', tipo: 'formato_codigo', defecto: 'PRY-{AAAA}-{MM}-{NICHO}', longitudMax: 50,
    etiqueta: 'Formato del código del proyecto', ayuda: 'Marcadores: {AAAA} año, {MM} mes, {NICHO} iniciales del nicho, {N} número.' },

  { clave: 'informe.filas_por_tabla', grupo: 'informe', tipo: 'entero', defecto: 20, min: 5, max: 100, unidad: 'filas',
    etiqueta: 'Filas por tabla en el PDF', ayuda: 'Después de estas filas, el PDF dice «y N más».' },
  { clave: 'informe.secciones', grupo: 'informe', tipo: 'multilista', defecto: SECCIONES_INFORME, opciones: SECCIONES_INFORME,
    etiqueta: 'Secciones del informe', ayuda: 'Qué secciones lleva el informe y el PDF.' },
  { clave: 'informe.texto_encabezado', grupo: 'informe', tipo: 'texto', defecto: '', longitudMax: 200,
    etiqueta: 'Línea bajo el título del PDF', ayuda: 'Aparece bajo el título del PDF. Puede quedar vacía.' },

  { clave: 'reglas.visto_bueno_cierre', grupo: 'reglas', pantalla: 'reglas', tipo: 'booleano', defecto: true,
    etiqueta: 'Visto bueno del gerente al cerrar', ayuda: 'El cierre queda a la espera del gerente. Apagado, el proyecto se cierra directo.' },
  { clave: 'reglas.aprobar_activacion', grupo: 'reglas', pantalla: 'reglas', tipo: 'booleano', defecto: false,
    etiqueta: 'Aprobación del gerente antes de activar', ayuda: 'El supervisor pide activar y el gerente aprueba; luego se reparte.' },
  { clave: 'reglas.confirmar_ventas', grupo: 'reglas', pantalla: 'reglas', tipo: 'booleano', defecto: false,
    etiqueta: 'Confirmación de ventas por el supervisor', ayuda: 'La venta no cuenta en informes hasta que el supervisor la confirma.' },

  { clave: 'activacion_auto.activa', grupo: 'automatizacion', tipo: 'booleano', defecto: false,
    etiqueta: 'Activar proyectos con el plan del año', ayuda: 'Activa solo el proyecto del plan, en el día y la hora elegidos.' },
  { clave: 'activacion_auto.dia', grupo: 'automatizacion', tipo: 'entero', defecto: 0, min: 0, max: 28, unidad: 'día del mes',
    etiqueta: 'Día de la activación', ayuda: '0 = primer día hábil del mes.' },
  { clave: 'activacion_auto.hora', grupo: 'automatizacion', tipo: 'hora', defecto: '07:00',
    etiqueta: 'Hora de la activación', ayuda: 'Hora de Guatemala, formato 24 horas.' }
];

// Cada par exige que el umbral verde sea mayor que el ámbar.
const PARES_SEMAFORO = [
  ['semaforo.cobertura_verde', 'semaforo.cobertura_ambar'],
  ['semaforo.efectividad_verde', 'semaforo.efectividad_ambar']
];

const POR_CLAVE = new Map(PARAMETROS.map(p => [p.clave, p]));

const clavesRepetidas = PARAMETROS.length - POR_CLAVE.size;
if (clavesRepetidas) throw new Error('El registro de parámetros de Proyectos tiene claves repetidas.');

const definicion = clave => POR_CLAVE.get(clave) || null;
const claveCompleta = clave => `${PREFIJO}${clave}`;
const copiar = valor => (Array.isArray(valor) ? [...valor] : valor);

function valoresPorDefecto() {
  return Object.fromEntries(PARAMETROS.map(p => [p.clave, copiar(p.defecto)]));
}

// --- Lectura y escritura del texto guardado ---

function serializar(def, valor) {
  if (valor === null) return '';
  if (def.tipo === 'booleano') return valor ? '1' : '0';
  if (def.tipo === 'multilista') return valor.join(',');
  return String(valor);
}

function deserializar(def, texto) {
  switch (def.tipo) {
    case 'booleano': return texto === '1';
    case 'entero':
    case 'porcentaje': return Number(texto);
    case 'entero_opcional': return texto === '' ? null : Number(texto);
    case 'multilista': return def.opciones.filter(o => texto.split(',').includes(o));
    default: return texto;
  }
}

// --- Validación (devuelve el valor ya tipado o lanza Error con un mensaje para el administrador) ---

function entero(def, crudo) {
  const n = typeof crudo === 'number' ? crudo : (/^-?\d+$/.test(String(crudo).trim()) ? Number(crudo) : NaN);
  if (!Number.isInteger(n)) throw new Error('Escribe un número entero.');
  if (n < def.min || n > def.max) throw new Error(`Debe estar entre ${def.min} y ${def.max}.`);
  return n;
}

function booleano(crudo) {
  if (crudo === true || crudo === 1 || crudo === '1' || crudo === 'true') return true;
  if (crudo === false || crudo === 0 || crudo === '0' || crudo === 'false') return false;
  throw new Error('Elige sí o no.');
}

function formatoCodigo(def, crudo) {
  const texto = String(crudo ?? '').trim();
  if (!texto) throw new Error('El formato no puede quedar vacío.');
  if (texto.length > def.longitudMax) throw new Error(`Máximo ${def.longitudMax} caracteres.`);
  const marcadores = texto.match(/\{[^}]*\}/g) || [];
  const invalido = marcadores.find(m => !MARCADORES_CODIGO.includes(m));
  if (invalido) throw new Error(`El marcador ${invalido} no existe. Usa ${MARCADORES_CODIGO.join(', ')}.`);
  if (!marcadores.length) throw new Error('Incluye al menos un marcador para que cada código sea distinto.');
  if (/[{}]/.test(texto.replace(/\{[^}]*\}/g, ''))) throw new Error('Hay una llave sin cerrar.');
  return texto;
}

function normalizarValor(def, crudo) {
  switch (def.tipo) {
    case 'booleano': return booleano(crudo);
    case 'entero':
    case 'porcentaje': return entero(def, crudo);
    case 'entero_opcional':
      return crudo === null || crudo === undefined || String(crudo).trim() === '' ? null : entero(def, crudo);
    case 'lista':
      if (!def.opciones.includes(crudo)) throw new Error('Elige una de las opciones.');
      return crudo;
    case 'multilista': {
      if (!Array.isArray(crudo)) throw new Error('Elige las casillas que quieras.');
      if (crudo.some(o => !def.opciones.includes(o))) throw new Error('Una de las casillas no existe.');
      const elegidas = def.opciones.filter(o => crudo.includes(o));
      if (!elegidas.length) throw new Error('Deja al menos una casilla marcada.');
      return elegidas;
    }
    case 'texto': {
      const texto = String(crudo ?? '').trim();
      if (texto.length > def.longitudMax) throw new Error(`Máximo ${def.longitudMax} caracteres.`);
      return texto;
    }
    case 'formato_codigo': return formatoCodigo(def, crudo);
    case 'hora':
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(crudo))) throw new Error('Escribe la hora como HH:MM, por ejemplo 07:00.');
      return String(crudo);
    default: throw new Error('Tipo de parámetro desconocido.');
  }
}

// `cambios`: { clave: valorCrudo }. `actuales`: valores vigentes ya tipados (para las reglas entre parámetros).
// Devuelve { clave: valorTipado }; si algo falla lanza un error 400 con `campos` { clave: mensaje }.
function validarCambios(cambios, actuales) {
  const campos = {};
  const valores = {};
  for (const [clave, crudo] of Object.entries(cambios || {})) {
    const def = definicion(clave);
    if (!def) { campos[clave] = 'Este ajuste no existe.'; continue; }
    try { valores[clave] = normalizarValor(def, crudo); } catch (e) { campos[clave] = e.message; }
  }
  const vigente = clave => (clave in valores ? valores[clave] : actuales[clave]);
  for (const [verde, ambar] of PARES_SEMAFORO) {
    if ((verde in valores || ambar in valores) && !campos[verde] && !campos[ambar] && vigente(verde) <= vigente(ambar)) {
      campos[verde] = 'El verde debe ser mayor que el ámbar.';
    }
  }
  if (Object.keys(campos).length) throw errorDeValidacion('Revisa los ajustes marcados.', campos);
  return valores;
}

module.exports = {
  PREFIJO, GRUPOS, PARAMETROS, SECCIONES_INFORME, MARCADORES_CODIGO,
  definicion, claveCompleta, valoresPorDefecto, serializar, deserializar, normalizarValor, validarCambios
};
