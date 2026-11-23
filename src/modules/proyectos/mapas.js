// src/modules/proyectos/mapas.js
// Enlaces de Google Maps (puros, sin llamadas a Google): «Cómo llegar» a una empresa y la ruta con varias paradas.
// Solo viaja la dirección de la empresa, y solo cuando la persona hace clic en el enlace.
const BASE = 'https://www.google.com/maps';
// Maps acepta un destino y hasta 9 paradas intermedias: 10 lugares en total.
const MAX_PARADAS = 10;

// La dirección completa para buscar: solo si la empresa tiene dirección registrada.
function textoDeLugar({ direccion, ciudad, pais }) {
  const calle = String(direccion || '').trim();
  return calle ? [calle, ciudad, pais].map(p => String(p || '').trim()).filter(Boolean).join(', ') : null;
}

function enlaceDeLugar(lugar) {
  const texto = textoDeLugar(lugar);
  return texto ? `${BASE}/search/?api=1&query=${encodeURIComponent(texto)}` : null;
}

// Una parada abre el lugar; varias abren la ruta en el orden dado (desde donde esté la persona, si Maps tiene su ubicación).
function enlaceDeRuta(lugares) {
  const textos = lugares.map(textoDeLugar).filter(Boolean).slice(0, MAX_PARADAS);
  if (textos.length === 0) return null;
  if (textos.length === 1) return `${BASE}/search/?api=1&query=${encodeURIComponent(textos[0])}`;
  const destino = textos[textos.length - 1];
  const paradas = textos.slice(0, -1).join('|');
  return `${BASE}/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destino)}&waypoints=${encodeURIComponent(paradas)}`;
}

module.exports = { textoDeLugar, enlaceDeLugar, enlaceDeRuta, MAX_PARADAS };
