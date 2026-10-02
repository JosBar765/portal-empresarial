// public/js/sessionGuard.js
// Detecta cualquier 401 de /api/... (sesión expirada/inválida) sin importar
// desde qué módulo llegue, y muestra un aviso bloqueante antes de mandar al
// login — no hay un wrapper de fetch compartido entre páginas en este
// proyecto (cada módulo tiene su propio api/*.js), así que se intercepta a
// nivel de window.fetch, una sola vez, en vez de tocar cada uno.
(() => {
  const fetchOriginal = window.fetch;
  let avisoMostrado = false;

  function mostrarAvisoSesionExpirada() {
    if (avisoMostrado) return;
    avisoMostrado = true;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999; background: rgba(15, 23, 42, 0.5);
      display: flex; align-items: center; justify-content: center; padding: 16px;
    `;
    overlay.innerHTML = `
      <div style="
        background: var(--color-surface, #FFFFFF); border-radius: 12px; max-width: 380px; width: 100%;
        padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.25); font-family: var(--font-body, 'Inter', sans-serif);
        text-align: center;
      ">
        <h3 style="margin: 0 0 8px; font-family: var(--font-title, 'Outfit', sans-serif); color: var(--color-text, #0F172A); font-size: 18px;">
          Tu sesión ha expirado
        </h3>
        <p style="margin: 0 0 20px; color: var(--color-text-secondary, #475569); font-size: 14px;">
          Por tu seguridad, debes iniciar sesión de nuevo para continuar.
        </p>
        <button id="sesion-expirada-ok" style="
          background: var(--color-primary-dark, #1B2130); color: #FFFFFF; border: none; border-radius: 8px;
          padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit;
        ">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#sesion-expirada-ok').addEventListener('click', () => {
      window.location.href = '/login/?expired=true';
    });
  }

  window.fetch = async function (...args) {
    let respuesta;
    try {
      respuesta = await fetchOriginal.apply(this, args);
    } catch (error) {
      // Un fallo de red llega como TypeError con texto técnico ("Failed to fetch").
      if (error instanceof TypeError) {
        throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
      }
      throw error;
    }
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    if (respuesta.status === 401 && url.includes('/api/')) {
      mostrarAvisoSesionExpirada();
    }
    return respuesta;
  };
})();
