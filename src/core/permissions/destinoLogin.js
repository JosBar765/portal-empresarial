// A qué página volver después de pasar por el login. Solo páginas propias del portal: nunca una URL que venga de fuera.
const PAGINA = /^\/(?:dashboard\/?|modules\/([a-z]+)(?:\/(?:index\.html)?)?)(?:\?.*)?$/;

function destinoSeguro(ruta) {
  const hallada = typeof ruta === 'string' ? PAGINA.exec(ruta) : null;
  if (!hallada) return null;
  return hallada[1] ? `/modules/${hallada[1]}/` : '/dashboard/';
}

// El dashboard es el destino por defecto: no hace falta nombrarlo.
function rutaDeLogin(rutaPedida) {
  const destino = destinoSeguro(rutaPedida);
  return destino && destino !== '/dashboard/' ? `/login/?expired=true&destino=${encodeURIComponent(destino)}` : '/login/?expired=true';
}

module.exports = { destinoSeguro, rutaDeLogin };
