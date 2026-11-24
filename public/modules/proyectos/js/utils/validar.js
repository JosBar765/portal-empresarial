// Validaciones que corren en el navegador mientras se escribe. Son una ayuda: el servidor repite todas
// (src/modules/proyectos/telefonos.js y clienteService.js) y es el que manda.

export const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const digitos = (texto) => String(texto == null ? '' : texto).replace(/\D/g, '');

// «#### ####» → 8 dígitos locales.
export function largoLocal(formato) {
  const n = String(formato || '').split('#').length - 1;
  return n > 0 ? n : null;
}

// Pinta los dígitos con la máscara del país («77654400» → «7765 4400»); lo que sobra de la máscara se corta.
export function aplicarMascara(soloDigitos, formato) {
  const largo = largoLocal(formato);
  const d = largo ? soloDigitos.slice(0, largo) : soloDigitos.slice(0, 12);
  if (!largo) return d;
  let i = 0;
  let salida = '';
  for (const c of formato) {
    if (i >= d.length) break;
    salida += c === '#' ? d[i++] : c;
  }
  return salida.trimEnd();
}

// El país cuyo prefijo abre estos dígitos; si hay varios gana el prefijo más largo (+501 antes que +50).
export function paisDelPrefijo(todosLosDigitos, prefijos) {
  return prefijos
    .map(p => ({ p, pre: digitos(p.prefijoTelefono) }))
    .filter(x => x.pre && todosLosDigitos.startsWith(x.pre))
    .sort((a, b) => b.pre.length - a.pre.length)[0]?.p || null;
}

// «+503 2222 3344» → { pais, numero: '2222 3344' }; sin prefijo conocido devuelve null.
export function separarTelefono(texto, prefijos) {
  const d = digitos(texto);
  const pais = d ? paisDelPrefijo(d, prefijos) : null;
  if (!pais) return null;
  return { pais, numero: aplicarMascara(d.slice(digitos(pais.prefijoTelefono).length), pais.formatoTelefono) };
}

// Mensaje de error de un número local según el país del prefijo, o '' si está bien (o vacío y no es obligatorio).
export function validarTelefonoLocal(numero, pais, obligatorio = false) {
  const d = digitos(numero);
  if (!d) return obligatorio ? 'Escribe el teléfono.' : '';
  const largo = largoLocal(pais && pais.formatoTelefono);
  if (largo ? d.length !== largo : (d.length < 6 || d.length > 12)) {
    return `Formato inválido: usa ${pais ? pais.prefijoTelefono : '+'} y ${largo || 'entre 6 y 12'} dígitos.`;
  }
  return '';
}

// «banco.com» o «https://banco.com» → «https://banco.com». '' si está vacío; null si no es una dirección válida.
export function normalizarSitioWeb(texto) {
  const crudo = String(texto == null ? '' : texto).trim();
  if (!crudo) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export const vacio = (valor) => String(valor == null ? '' : valor).trim() === '';

export function validarTexto(valor, { maximo, obligatorio, mensajeObligatorio }) {
  if (vacio(valor)) return obligatorio ? mensajeObligatorio : '';
  return maximo && String(valor).trim().length > maximo ? `Máximo ${maximo} caracteres.` : '';
}
