// public/js/notificaciones.js
// Centro de notificaciones por módulo (Vales, Administración…): campana con contador, lista con fecha y hora,
// marcar como leída (una o todas). Cada módulo lo inicia con su socket y su id:
// window.centroNotificaciones.iniciar({ socket, modulo: 'vales' }).
(() => {
  // El push abre `?aviso=<id>`: de la dirección solo se acepta un número.
  const idDeAvisoEnUrl = (busqueda) => {
    const valor = new URLSearchParams(busqueda).get('aviso') || '';
    return /^\d{1,10}$/.test(valor) ? Number(valor) : null;
  };
  const urlSinAviso = ({ pathname, search, hash }) => {
    const parametros = new URLSearchParams(search);
    parametros.delete('aviso');
    const resto = parametros.toString();
    return `${pathname}${resto ? `?${resto}` : ''}${hash}`;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { idDeAvisoEnUrl, urlSinAviso };
  if (typeof window === 'undefined') return;

  const POR_PAGINA = 20;
  const estado = { modulo: null, items: [], noLeidas: 0, hayMas: false, abierto: false, cargando: false, enlaces: {}, alAbrir: null, configurable: false, alcance: null, filtrada: false, fuera: [], fueraAbierto: false };
  let root = null;
  let tituloBase = '';

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

  let recargaPendiente = false;

  async function cargar(reiniciar) {
    if (estado.cargando) {
      recargaPendiente = recargaPendiente || reiniciar;
      return;
    }
    estado.cargando = true;
    try {
      const desplazamiento = reiniciar ? 0 : estado.items.length;
      const data = await pedir(`/api/notificaciones?modulo=${encodeURIComponent(estado.modulo)}&limite=${POR_PAGINA}&desplazamiento=${desplazamiento}`);
      estado.items = reiniciar ? data.notificaciones : estado.items.concat(data.notificaciones);
      estado.hayMas = data.hayMas;
      estado.noLeidas = data.noLeidas;
      estado.filtrada = Boolean(data.filtrada);
      estado.fuera = data.fuera || [];
    } catch { /* la campana queda con lo último que tenía */ }
    estado.cargando = false;
    render();
    if (recargaPendiente) {
      recargaPendiente = false;
      cargar(true);
    }
  }

  // Cambió lo que se está viendo (p. ej. las tiendas marcadas): se vuelve a pedir la lista.
  function recargar() {
    if (estado.modulo) cargar(true);
  }

  // Muestra el total de no leídas en la pestaña del navegador: "(3) Vales de Arte | Portal Empresarial".
  function actualizarTituloPestana() {
    if (!tituloBase) return;
    const total = estado.noLeidas > 99 ? '99+' : estado.noLeidas;
    document.title = estado.noLeidas ? `(${total}) ${tituloBase}` : tituloBase;
  }

  // Avisos de Proyectos: un ícono por tipo para reconocerlos de un vistazo.
  const ICONOS_PROYECTOS = {
    reparto_recibido: 'people-outline', reasignada_recibe: 'swap-horizontal-outline', reasignada_pierde: 'swap-horizontal-outline', seguimiento_vence: 'time-outline',
    seguimiento_vencido: 'alert-circle-outline', proyecto_por_cerrar: 'flag-outline', proyecto_vencido: 'warning-outline', activacion_pedida: 'rocket-outline',
    activacion_resuelta: 'checkmark-circle-outline', cierre_pendiente: 'flag-outline', visto_bueno_resuelto: 'checkmark-circle-outline', venta_por_confirmar: 'cash-outline',
    venta_revisada: 'cash-outline', registro_anulado: 'close-circle-outline', existencia_baja: 'gift-outline'
  };
  const iconoDeAviso = (n) => (n.modulo === 'proyectos' && ICONOS_PROYECTOS[n.tipo] ? `<ion-icon class="notif-icono" name="${ICONOS_PROYECTOS[n.tipo]}"></ion-icon>` : '');

  // Lo no leído que la selección deja fuera: una línea plegada y, al tocarla, una fila por tienda.
  function bloqueFuera() {
    const grupos = estado.alcance ? estado.alcance.grupos(estado.fuera) : [];
    if (!grupos.length) return '';
    const filas = grupos.map(g => `
          <li class="notif-fuera-fila">
            <span class="notif-fuera-nombre">${escapar(g.nombre)}</span>
            <span class="notif-fuera-cantidad">${g.noLeidas}</span>
            ${g.puedeVer ? `<button type="button" class="notif-fuera-ver" data-clave="${escapar(g.clave)}" aria-label="Ver ${escapar(g.nombre)}">Ver ›</button>` : ''}
          </li>`).join('');
    return `
        <div class="notif-fuera">
          <button type="button" class="notif-fuera-resumen" aria-expanded="${estado.fueraAbierto}">
            <span><strong>${escapar(estado.alcance.resumen(grupos))}</strong>${estado.fueraAbierto ? '' : '<small>Toca para ver cuáles</small>'}</span>
            <ion-icon name="${estado.fueraAbierto ? 'chevron-down-outline' : 'chevron-forward-outline'}" aria-hidden="true"></ion-icon>
          </button>
          ${estado.fueraAbierto ? `<ul class="notif-fuera-lista">${filas}</ul>
          <button type="button" class="notif-fuera-todas">Ver todas mis tiendas</button>` : ''}
        </div>`;
  }

  function render() {
    if (!root) return;
    actualizarTituloPestana();
    // Conserva el desplazamiento de la lista al redibujar (marcar leída, cargar más).
    const scrollPrevio = root.querySelector('.notif-lista')?.scrollTop || 0;
    const lista = estado.items.map(n => `
      <li class="notif-item${n.leida_en ? '' : ' is-no-leida'}${n.nivel === 'alerta' ? ' is-alerta' : ''}${accionDe(n) ? ' is-enlace' : ''}" data-id="${n.id}">
        <span class="notif-contenido">${iconoDeAviso(n)}${escapar(n.mensaje)}</span>
        <span class="notif-fecha">${formatearFecha(n.creado_en)}</span>
      </li>`).join('');
    const rotulo = estado.alcance ? estado.alcance.rotulo() : null;
    const vacio = estado.filtrada && rotulo ? `No hay notificaciones de ${escapar(rotulo)}.` : 'No hay notificaciones.';
    root.innerHTML = `
      <button type="button" class="notif-bell" aria-haspopup="true" aria-expanded="${estado.abierto}" title="Notificaciones">
        <ion-icon name="notifications-outline"></ion-icon>
        ${estado.noLeidas ? `<span class="notif-badge">${estado.noLeidas > 99 ? '99+' : estado.noLeidas}</span>` : ''}
      </button>
      <div class="notif-panel${estado.abierto ? ' visible' : ''}${estado.fueraAbierto && estado.fuera.length ? ' is-fuera-abierto' : ''}">
        <div class="notif-panel-header">
          <strong>Notificaciones</strong>
          <button type="button" class="notif-leer-todas"${estado.noLeidas ? '' : ' disabled'}>Marcar todas como leídas</button>
          ${estado.configurable ? '<button type="button" class="notif-config" title="Configurar notificaciones" aria-label="Configurar notificaciones"><ion-icon name="settings-outline"></ion-icon></button>' : ''}
        </div>
        ${rotulo ? `<p class="notif-alcance">Mostrando: ${escapar(rotulo)}</p>` : ''}
        <ul class="notif-lista">${lista || `<li class="notif-vacio">${vacio}</li>`}</ul>
        ${estado.hayMas ? '<button type="button" class="notif-mas">Cargar más</button>' : ''}
        ${bloqueFuera()}
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
    try {
      await fetch('/api/notificaciones/leer-todas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modulo: estado.modulo })
      });
    } catch { /* se reintenta al recargar */ }
  }

  // Lo que hace tocar un aviso (en la campana o en la notificación del sistema); null si no lleva a ninguna parte.
  function accionDe(aviso) {
    if (estado.enlaces[aviso.tipo]) return estado.enlaces[aviso.tipo];
    return estado.alAbrir && (aviso.referencia_tipo || aviso.vale_id) ? () => estado.alAbrir(aviso) : null;
  }

  const sinDestino = () => window.toast && window.toast.info('Notificaciones', 'Ese aviso ya no tiene una pantalla a la que llevarte.');

  // El módulo avisa cuando ya cargó (`abrirPendiente`); hasta entonces el aviso espera.
  let moduloListo = false;
  let avisoPendiente = null;

  async function abrirAviso(id) {
    let aviso;
    try {
      aviso = await pedir(`/api/notificaciones/${id}`);
    } catch {
      sinDestino();
      return;
    }
    if (aviso.modulo !== estado.modulo) return;
    if (!aviso.leida_en) {
      try {
        await fetch(`/api/notificaciones/${id}/leer`, { method: 'POST' });
        cargar(true);
      } catch { /* queda sin leer: se ve en la campana */ }
    }
    const accion = accionDe(aviso);
    if (accion) accion(); else sinDestino();
  }

  function pedirApertura(id) {
    if (!id) return;
    if (moduloListo) abrirAviso(id); else avisoPendiente = id;
  }

  function abrirPendiente() {
    moduloListo = true;
    const id = avisoPendiente;
    avisoPendiente = null;
    if (id) abrirAviso(id);
  }

  // Cada módulo inicia su propio centro: `modulo` es su id del catálogo ('vales', 'admin'…).
  // `enlaces` ({ TIPO: () => acción }) convierte en enlace las notificaciones de ese tipo: al hacer clic se ejecuta la acción.
  // `alAbrir(notificación)` es la otra vía: sirve a quien enlaza por lo que el aviso nombra (referencia_tipo/referencia_id), no por su tipo.
  // `alcance` (opcional) filtra lo que se ve: { rotulo, grupos, resumen, ver, verTodas }.
  function iniciar({ socket, modulo, enlaces = {}, alAbrir = null, alcance = null }) {
    root = document.getElementById('notificaciones-root');
    if (!root || !modulo) return;
    estado.modulo = modulo;
    estado.enlaces = enlaces;
    estado.alAbrir = alAbrir;
    estado.alcance = alcance;
    tituloBase = document.title.replace(/^\(\d+\+?\)\s*/, '');
    root.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.closest('.notif-bell')) {
        estado.abierto = !estado.abierto;
        render();
      } else if (e.target.closest('.notif-config')) {
        estado.abierto = false;
        render();
        window.notificacionesAjustes.abrir(estado.modulo);
      } else if (e.target.closest('.notif-fuera-resumen')) {
        estado.fueraAbierto = !estado.fueraAbierto;
        render();
      } else if (e.target.closest('.notif-fuera-ver')) {
        estado.alcance.ver(e.target.closest('.notif-fuera-ver').dataset.clave);
      } else if (e.target.closest('.notif-fuera-todas')) {
        estado.alcance.verTodas();
      } else if (e.target.closest('.notif-leer-todas')) {
        marcarTodas();
      } else if (e.target.closest('.notif-mas')) {
        cargar(false);
      } else {
        const item = e.target.closest('.notif-item');
        if (!item) return;
        const id = Number(item.dataset.id);
        marcarLeida(id);
        const aviso = estado.items.find(n => n.id === id) || {};
        const accion = accionDe(aviso);
        if (accion) {
          estado.abierto = false;
          render();
          accion();
        }
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
        if (n.modulo !== estado.modulo) return; // la de otro módulo no es de este centro
        if (estado.filtrada) { cargar(true); return; } // el servidor decide si entra en lo que se está viendo
        estado.items.unshift(n);
        estado.noLeidas += 1;
        render();
      });
    }
    render();
    cargar(true);
    const pedido = idDeAvisoEnUrl(window.location.search);
    if (pedido) {
      window.history.replaceState(window.history.state, '', urlSinAviso(window.location));
      pedirApertura(pedido);
    }
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.tipo === 'abrir-aviso') pedirApertura(Number(e.data.id));
      });
      navigator.serviceWorker.startMessages?.();
    }
    // El engranaje solo aparece si este usuario tiene categorías que configurar en este módulo.
    window.notificacionesAjustes?.hayCategorias(modulo).then((hay) => {
      estado.configurable = hay;
      if (hay) render();
    });
  }

  window.centroNotificaciones = { iniciar, abrirPendiente, sinDestino, recargar };
})();
