// public/js/heartbeat.js
// analisis_correcciones_17.md #3: "última actividad" solo se refrescaba con
// peticiones incidentales del usuario — una pestaña quieta se quedaba
// "Inactivo" hasta que el usuario volviera a hacer algo. Este latido cubre
// el vacío: cada minuto, y de inmediato al recuperar el foco/visibilidad,
// para que volver a la pestaña restaure "En línea" sin esperar.
(function () {
  function latir() {
    fetch('/api/auth/heartbeat').catch(() => {});
  }
  setInterval(latir, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) latir();
  });
  window.addEventListener('focus', latir);
})();
