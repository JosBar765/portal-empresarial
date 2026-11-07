// src/modules/proyectos/telefonos.js
// Normaliza los teléfonos con la configuración del país (`proy_pais_config`: prefijo y formato). Funciones puras.
// El teléfono se guarda canónico, `+50277654400`, y se muestra con el formato del país, `+502 7765 4400`.
const digitos = (texto) => String(texto == null ? '' : texto).replace(/\D/g, '');

// «#### ####» -> 8 dígitos locales.
function largoLocal(formato) {
  const n = String(formato || '').split('#').length - 1;
  return n > 0 ? n : null;
}

function error(mensaje) {
  return { ok: false, error: mensaje };
}

// `pais`: { nombre, prefijoTelefono: '+502', formatoTelefono: '#### ####' }. Sin país o sin prefijo se acepta un
// número internacional completo (+ y de 8 a 15 dígitos).
function normalizar(texto, pais = {}) {
  const crudo = String(texto == null ? '' : texto).trim();
  if (!crudo) return error('Escribe el teléfono.');
  if (/[^0-9+\s().-]/.test(crudo)) return error('El teléfono solo puede tener números, espacios y el signo +.');

  const prefijo = digitos(pais.prefijoTelefono);
  const largo = largoLocal(pais.formatoTelefono);
  let todos = digitos(crudo);
  const traePrefijo = crudo.startsWith('+') || crudo.startsWith('00');
  if (crudo.startsWith('00')) todos = todos.slice(2);

  if (!prefijo) {
    if (!crudo.startsWith('+') || todos.length < 8 || todos.length > 15) return error('Usa el número completo con su prefijo, por ejemplo +502 7765 4400.');
    return { ok: true, telefono: `+${todos}` };
  }

  let local;
  if (traePrefijo) {
    if (!todos.startsWith(prefijo)) return error(`El prefijo no es de ${pais.nombre || 'este país'}: usa +${prefijo}.`);
    local = todos.slice(prefijo.length);
  } else if (largo && todos.length === prefijo.length + largo && todos.startsWith(prefijo)) {
    local = todos.slice(prefijo.length); // «50277654400» escrito sin el +
  } else {
    local = todos;
  }

  if (largo ? local.length !== largo : (local.length < 6 || local.length > 12)) {
    return error(`Formato inválido: usa +${prefijo} y ${largo || 'entre 6 y 12'} dígitos.`);
  }
  return { ok: true, telefono: `+${prefijo}${local}` };
}

// Pinta un teléfono canónico con la máscara del país; si no coincide, lo devuelve tal cual.
function formatear(telefono, pais = {}) {
  if (!telefono) return '';
  const prefijo = digitos(pais.prefijoTelefono);
  const todos = digitos(telefono);
  if (!prefijo || !todos.startsWith(prefijo)) return String(telefono);
  const local = todos.slice(prefijo.length);
  const mascara = pais.formatoTelefono;
  if (!mascara || largoLocal(mascara) !== local.length) return `+${prefijo} ${local}`;
  let i = 0;
  return `+${prefijo} ${mascara.replace(/#/g, () => local[i++])}`;
}

module.exports = { normalizar, formatear, largoLocal, digitos };
