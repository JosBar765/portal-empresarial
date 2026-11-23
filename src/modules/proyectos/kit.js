// src/modules/proyectos/kit.js
// Reglas puras del kit del nicho (sin base de datos): las variables permitidas, cómo se reemplazan en un texto y cómo se arma el
// enlace que abre WhatsApp o el correo con el mensaje prellenado. El portal no envía nada: lo envía el asesor.
const VARIABLES = ['empresa', 'contacto', 'asesor', 'articulo', 'nicho'];
const CANALES = ['whatsapp', 'correo'];
const MAX_GUION = 4000;
const MAX_TITULO = 100;
const MAX_TEXTO = 1500;
const MAX_MENSAJES = 20;

const PATRON = /\{([^{}]*)\}/g;

// Las variables que aparecen en un texto y no están permitidas (por ejemplo {cliente} o {empresa }).
function variablesDesconocidas(texto) {
  const malas = [];
  for (const [, nombre] of String(texto || '').matchAll(PATRON)) if (!VARIABLES.includes(nombre)) malas.push(`{${nombre}}`);
  return [...new Set(malas)];
}

// Reemplaza cada variable por su valor. Una variable sin dato nunca queda como «{contacto}» en el texto: se devuelve en `faltan`.
function resolver(texto, datos) {
  const faltan = new Set();
  const resuelto = String(texto || '').replace(PATRON, (entero, nombre) => {
    const valor = VARIABLES.includes(nombre) ? String(datos[nombre] == null ? '' : datos[nombre]).trim() : '';
    if (!valor) { faltan.add(nombre); return ''; }
    return valor;
  });
  return { texto: resuelto, faltan: [...faltan] };
}

const digitos = (telefono) => String(telefono || '').replace(/\D/g, '');

// WhatsApp: wa.me abre el chat con el texto escrito, sin enviarlo.
const enlaceWhatsApp = (telefono, texto) => (digitos(telefono) ? `https://wa.me/${digitos(telefono)}?text=${encodeURIComponent(texto)}` : null);

// Correo: mailto abre el programa de correo del asesor con asunto y cuerpo; solo si el contacto tiene un correo válido.
const CORREO = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const enlaceCorreo = (correo, asunto, texto) => (CORREO.test(String(correo || '').trim())
  ? `mailto:${encodeURIComponent(String(correo).trim()).replace(/%40/g, '@')}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}` : null);

module.exports = { VARIABLES, CANALES, MAX_GUION, MAX_TITULO, MAX_TEXTO, MAX_MENSAJES, variablesDesconocidas, resolver, enlaceWhatsApp, enlaceCorreo };
