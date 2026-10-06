// public/js/notificaciones.js
// Centro de notificaciones compartido (dashboard, Vales y Administración): campana con contador,
// lista con fecha y hora, marcar como leída (una o todas). Cada página lo inicia con su socket:
// window.centroNotificaciones.iniciar({ socket }).
(() => {
  const POR_PAGINA = 20;
  const estado = { items: [], noLeidas: 0, hayMas: false, abierto: false, cargando: false };
  let root = null;

  const escapar = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function formatearFecha(valor) {
    const [fecha, hora] = String(valor).split(/[ T]/);
    const [a, m, d] = fecha.split('-');
    return `${d}/${m}/${a} ${(hora || '').slice(0, 5)}`;
  }

  async function pedir(url, opciones) {
    const res = await fetch(url, opciones);
    if (!res.ok) throw new Error('No se pudieron cargar las notificaciones.');
    return res.json();
  }

  async function cargar(reiniciar) {
    if (estado.cargando) return;
    estado.cargando = true;
    try {
      const desplazamiento = reiniciar ? 0 : estado.items.length;
      const data = await pedir(`/api/notificaciones?limite=${POR_PAGINA}&desplazamiento=${desplazamiento}`);
      estado.items = reiniciar ? data.notificaciones : estado.items.concat(data.notificaciones);
      estado.hayMas = data.hayMas;
      estado.noLeidas = data.noLeidas;
    } catch { /* la campana queda con lo último que tenía */ }
    estado.cargando = false;
    render();
  }

  function render() {
    if (!root) return;
    // Conserva el desplazamiento de la lista al redibujar (marcar leída, cargar más).
    const scrollPrevio = root.querySelector('.notif-lista')?.scrollTop || 0;
    const lista = estado.items.map(n => `
      <li class="notif-item${n.leida_en ? '' : ' is-no-leida'}${n.nivel === 'alerta' ? ' is-alerta' : ''}" data-id="${n.id}">
        <span class="notif-contenido">${escapar(n.mensaje)}</span>
        <span class="notif-fecha">${formatearFecha(n.creado_en)}</span>
      </li>`).join('');
    root.innerHTML = `
      <button type="button" class="notif-bell" aria-haspopup="true" aria-expanded="${estado.abierto}" title="Notificaciones">
        <ion-icon name="notifications-outline"></ion-icon>
        ${estado.noLeidas ? `<span class="notif-badge">${estado.noLeidas > 99 ? '99+' : estado.noLeidas}</span>` : ''}
      </button>
      <div class="notif-panel${estado.abierto ? ' visible' : ''}">
        <div class="notif-panel-header">
          <strong>Notificaciones</strong>
          <button type="button" class="notif-leer-todas"${estado.noLeidas ? '' : ' disabled'}>Marcar todas como leídas</button>
        </div>
        <ul class="notif-lista">${lista || '<li class="notif-vacio">Aún no tienes notificaciones.</li>'}</ul>
        ${estado.hayMas ? '<button type="button" class="notif-mas">Cargar más</button>' : ''}
      </div>`;
    const listaEl = root.querySelector('.notif-lista');
    if (listaEl) listaEl.scrollTop = scrollPrevio;
  }

  async function marcarLeida(id) {
    const item = estado.items.find(n => n.id === id);
    if (!item || item.leida_en) return;
    item.leida_en = new Date().toISOString();
    estado.noLeidas = Math.max(0, estado.noLeidas - 1);
    render();
    try { await fetch(`/api/notificaciones/${id}/leer`, { method: 'POST' }); } catch { /* se reintenta al recargar */ }
  }

  async function marcarTodas() {
    estado.items.forEach(n => { if (!n.leida_en) n.leida_en = new Date().toISOString(); });
    estado.noLeidas = 0;
    render();
    try { await fetch('/api/notificaciones/leer-todas', { method: 'POST' }); } catch { /* se reintenta al recargar */ }
  }

  function iniciar({ socket }) {
    root = document.getElementById('notificaciones-root');
    if (!root) return;
    root.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.closest('.notif-bell')) {
        estado.abierto = !estado.abierto;
        render();
      } else if (e.target.closest('.notif-leer-todas')) {
        marcarTodas();
      } else if (e.target.closest('.notif-mas')) {
        cargar(false);
      } else {
        const item = e.target.closest('.notif-item');
        if (item) marcarLeida(Number(item.dataset.id));
      }
    });
    document.addEventListener('click', () => {
      if (!estado.abierto) return;
      estado.abierto = false;
      render();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && estado.abierto) { estado.abierto = false; render(); }
    });
    if (socket) {
      socket.on('notificacion_nueva', (n) => {
        estado.items.unshift(n);
        estado.noLeidas += 1;
        render();
      });
    }
    render();
    cargar(true);
  }

  window.centroNotificaciones = { iniciar };
})();
