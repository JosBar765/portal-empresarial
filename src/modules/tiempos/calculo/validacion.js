// src/modules/tiempos/calculo/validacion.js
// Reglas de lo que el administrador puede guardar en la Tabla de tiempos. Funciones puras: devuelven `{ ok, errores }` con un
// texto que dice qué pasó y cómo corregirlo. Las usa el servidor al guardar y las pruebas.
const MAX_DIAS = 365;
const MAX_RANGOS = 30;
const MAX_AVISOS = 10;
const esEnteroNoNeg = (n) => Number.isInteger(n) && n >= 0;
const rangoTexto = (r) => (r.hasta === null || r.hasta === undefined ? `${r.desde} en adelante` : `${r.desde} – ${r.hasta}`);

// `rangos`: [{ desde, hasta, aConvenir, dias: {etapa: n} }]; `etapas`: [{clave, nombre}] del producto. El último rango es «en adelante» (a convenir).
function validarRangos(rangos, etapas) {
  const errores = [];
  const e = (indice, campo, mensaje) => errores.push({ indice, campo, mensaje });
  if (!Array.isArray(rangos) || rangos.length < 1) { errores.push({ indice: null, campo: 'rangos', mensaje: 'Deja al menos el último rango como «tiempo a convenir».' }); return { ok: false, errores }; }
  if (rangos.length > MAX_RANGOS) { errores.push({ indice: null, campo: 'rangos', mensaje: `Un producto admite hasta ${MAX_RANGOS} rangos.` }); return { ok: false, errores }; }
  rangos.forEach((r, i) => {
    const ultimo = i === rangos.length - 1;
    if (!Number.isInteger(r.desde) || r.desde < 1) { e(i, 'desde', `El rango ${i + 1} necesita una cantidad inicial entera, de 1 en adelante.`); return; }
    if (ultimo) {
      if (!r.aConvenir || r.hasta !== null) e(i, 'hasta', 'El último rango debe quedar «en adelante» y a convenir.');
    } else {
      if (r.aConvenir || r.hasta === null) { e(i, 'hasta', `Solo el último rango puede quedar «a convenir». Escribe hasta cuántas piezas llega el rango ${r.desde}.`); }
      else if (!Number.isInteger(r.hasta) || r.hasta < r.desde) e(i, 'hasta', `El rango empieza en ${r.desde} pero termina en ${r.hasta}. La cantidad final debe ser ${r.desde} o más.`);
      for (const et of etapas) {
        const v = r.dias ? r.dias[et.clave] : undefined;
        if (v === undefined || v === null || v === '') e(i, `dias.${et.clave}`, `Falta el día de ${et.nombre} en el rango ${rangoTexto(r)}. Escribe un número (0 si no aplica).`);
        else if (!esEnteroNoNeg(v) || v > MAX_DIAS) e(i, `dias.${et.clave}`, `Los días de ${et.nombre} en el rango ${rangoTexto(r)} deben ser un número entero de 0 a ${MAX_DIAS}.`);
      }
    }
    if (i > 0) {
      const previo = rangos[i - 1];
      if (Number.isInteger(previo.hasta) && Number.isInteger(r.desde) && r.desde !== previo.hasta + 1) {
        e(i, 'desde', r.desde <= previo.hasta
          ? `El rango empieza en ${r.desde}, pero el anterior llega hasta ${previo.hasta}. Cámbialo a ${previo.hasta + 1}.`
          : `Entre ${previo.hasta} y ${r.desde} hay cantidades sin tiempo. Cámbialo a ${previo.hasta + 1}.`);
      }
    }
  });
  return { ok: errores.length === 0, errores };
}

function validarTextos(lista, etiqueta) {
  const errores = [];
  if (!Array.isArray(lista)) return { ok: false, errores: [{ campo: etiqueta, mensaje: 'La lista de avisos no es válida.' }] };
  if (lista.length > MAX_AVISOS) errores.push({ campo: etiqueta, mensaje: `Se admiten hasta ${MAX_AVISOS} avisos.` });
  lista.forEach((t, i) => {
    if (typeof t !== 'string' || !t.trim()) errores.push({ indice: i, campo: etiqueta, mensaje: 'Hay un aviso vacío: escríbelo o quítalo.' });
    else if (t.trim().length > 255) errores.push({ indice: i, campo: etiqueta, mensaje: 'Un aviso admite hasta 255 caracteres.' });
  });
  return { ok: errores.length === 0, errores };
}

// Un tipo de UV: nombre y rangos con los días que suma (el último en adelante, a convenir).
function validarExtra(e) {
  const errores = [];
  if (typeof e.nombre !== 'string' || e.nombre.trim().length < 2 || e.nombre.trim().length > 80) errores.push({ campo: 'nombre', mensaje: 'El nombre del extra debe tener de 2 a 80 caracteres.' });
  if (!Array.isArray(e.rangos) || e.rangos.length < 2) { errores.push({ campo: 'rangos', mensaje: `«${e.nombre}»: agrega al menos un rango y deja el último «a convenir».` }); return { ok: false, errores }; }
  e.rangos.forEach((r, i) => {
    const ultimo = i === e.rangos.length - 1;
    if (!Number.isInteger(r.desde) || r.desde < 1) errores.push({ indice: i, campo: 'desde', mensaje: `«${e.nombre}»: el rango ${i + 1} necesita una cantidad inicial entera, de 1 en adelante.` });
    if (ultimo) { if (!r.aConvenir || r.hasta !== null) errores.push({ indice: i, campo: 'hasta', mensaje: `«${e.nombre}»: el último rango debe quedar «en adelante» y a convenir.` }); }
    else {
      if (r.aConvenir || !Number.isInteger(r.hasta) || r.hasta < r.desde) errores.push({ indice: i, campo: 'hasta', mensaje: `«${e.nombre}»: revisa hasta cuántas piezas llega el rango que empieza en ${r.desde}.` });
      if (!esEnteroNoNeg(r.dias) || r.dias > MAX_DIAS) errores.push({ indice: i, campo: 'dias', mensaje: `«${e.nombre}»: los días del rango ${rangoTexto(r)} deben ser un número entero de 0 a ${MAX_DIAS}.` });
    }
    if (i > 0 && Number.isInteger(e.rangos[i - 1].hasta) && r.desde !== e.rangos[i - 1].hasta + 1) errores.push({ indice: i, campo: 'desde', mensaje: `«${e.nombre}»: el rango debe empezar en ${e.rangos[i - 1].hasta + 1}, justo después del anterior.` });
  });
  return { ok: errores.length === 0, errores };
}

const LIMITES_PARAMETROS = { margen_dias: [0, 30], colores_incluidos: [1, 12], colores_cada: [1, 12], colores_dias: [0, 30], moldes_dias: [0, 60] };
function validarParametros(p) {
  const errores = [];
  for (const [clave, valor] of Object.entries(p)) {
    const lim = LIMITES_PARAMETROS[clave];
    if (!lim) errores.push({ campo: clave, mensaje: `«${clave}» no es una regla de la tabla.` });
    else if (!Number.isInteger(valor) || valor < lim[0] || valor > lim[1]) errores.push({ campo: clave, mensaje: `Esta regla debe ser un número entero de ${lim[0]} a ${lim[1]}.` });
  }
  return { ok: errores.length === 0, errores };
}

const validarNombre = (nombre, etiqueta = 'producto') => (typeof nombre === 'string' && nombre.trim().length >= 2 && nombre.trim().length <= 150
  ? null : `El nombre del ${etiqueta} debe tener de 2 a 150 caracteres.`);

const aClave = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'producto';

module.exports = { validarRangos, validarTextos, validarExtra, validarParametros, validarNombre, aClave, MAX_DIAS, MAX_RANGOS, MAX_AVISOS };
