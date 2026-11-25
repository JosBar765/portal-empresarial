// A qué página volver después de pasar por el login. Solo páginas propias del portal: nunca una URL que venga de fuera.
const PAGINA = /^\/(?:dashboard\/?|modules\/([a-z]+)(?:\/(?:index\.html)?)?)(?:\?(.*))?$/;
// De los parámetros solo sobrevive el número de aviso: es lo que permite abrir lo que nombra.
const AVISO = /(?:^|&)aviso=(\d{1,10})(?:&|$)/;

function destinoSeguro(ruta) {
  const hallada = typeof ruta === 'string' ? PAGINA.exec(ruta) : null;
  if (!hallada) return null;
  if (!hallada[1]) return '/dashboard/';
  const aviso = AVISO.exec(hallada[2] || '');
  return `/modules/${hallada[1]}/${aviso ? `?aviso=${aviso[1]}` : ''}`;
}

// El dashboard es el destino por defecto: no hace falta nombrarlo.
function rutaDeLogin(rutaPedida) {
  const destino = destinoSeguro(rutaPedida);
  return destino && destino !== '/dashboard/' ? `/login/?expired=true&destino=${encodeURIComponent(destino)}` : '/login/?expired=true';
}

module.exports = { destinoSeguro, rutaDeLogin };
