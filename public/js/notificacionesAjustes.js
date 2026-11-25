// public/js/notificacionesAjustes.js
// Modal «Notificaciones de <módulo>»: activación de este dispositivo y casillas por categoría con guardado automático.
// Expone window.notificacionesAjustes = { hayCategorias(modulo), abrir(modulo) }.
(() => {
  const API = '/api/notificaciones/push/preferencias';
  const NOMBRES = { vales: 'Vales de Arte', viaticos: 'Viáticos', incidencias: 'Incidencias', proyectos: 'Proyectos', admin: 'Administración' };
  const CANALES = [{ id: 'escritorio', largo: 'Escritorio', corto: 'PC' }, { id: 'movil', largo: 'Celular', corto: 'Celular' }];
  const GUARDADO = '✓ Los cambios se guardan automáticamente';
  const DISPOSITIVO = {
    inactivo: { tono: 'info', titulo: 'Este dispositivo no recibe avisos', texto: 'Actívalos para que lo que marques abajo aparezca fuera del portal.', acciones: [['preguntar', 'Activar en este dispositivo', 'primary']] },
    confirmar: { tono: 'info', titulo: '¿Activar los avisos en este dispositivo?', texto: 'El navegador te pedirá permiso. Elige «Permitir»: si eliges «No permitir», no podremos volver a preguntarte.', acciones: [['cancelar', 'Ahora no', 'ghost'], ['continuar', 'Continuar', 'primary']] },
    activo: { tono: 'ok', titulo: 'Avisos activos en este dispositivo', texto: 'Vale para todos los módulos del portal.', acciones: [['desactivar', 'Desactivar', 'ghost']] },
    bloqueado: { tono: 'peligro', titulo: 'Los avisos están bloqueados en este navegador', texto: 'Para activarlos: 1) toca el candado junto a la dirección, 2) en Notificaciones elige «Permitir», 3) recarga la página. El centro de notificaciones sigue funcionando.' },
    ios: { tono: 'alerta', titulo: 'En iPhone y iPad primero instala el portal', texto: 'En Safari toca Compartir → «Agregar a pantalla de inicio», abre el portal desde ese ícono y vuelve aquí. Requiere iOS 16.4 o superior.' },
    'no-soportado': { tono: 'neutro', titulo: 'Este navegador no admite avisos', texto: 'Puedes dejar marcadas tus preferencias; se usarán en tus otros dispositivos.' }
  };

  const escapar = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let abierto = null; // estado del modal abierto (uno a la vez)

  async function pedirCategorias(modulo) {
    const res = await fetch(`${API}?modulo=${encodeURIComponent(modulo)}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('No se pudieron cargar las preferencias.');
    return (await res.json()).categorias || [];
  }

  async function hayCategorias(modulo) {
    try { return (await pedirCategorias(modulo)).length > 0; } catch { return false; }
  }

  const aviso = ({ tono, titulo, texto, acciones = [] }, extra = '') => `
    <div class="aj-aviso aj-aviso--${tono}">
      <strong>${escapar(titulo)}</strong>
      <p>${escapar(texto)}</p>
      ${extra ? `<p class="aj-aviso-error" role="alert">${escapar(extra)}</p>` : ''}
      ${acciones.length ? `<div class="aj-aviso-acciones">${acciones.map(([accion, rotulo, clase]) => `<button type="button" class="btn btn--${clase} btn--sm" data-accion="${accion}">${escapar(rotulo)}</button>`).join('')}</div>` : ''}
    </div>`;

  function pintarDispositivo() {
    const zona = abierto.overlay.querySelector('.aj-dispositivo');
    if (!zona) return;
    const clave = abierto.confirmando && abierto.dispositivo === 'inactivo' ? 'confirmar' : abierto.dispositivo;
    zona.innerHTML = DISPOSITIVO[clave] ? aviso(DISPOSITIVO[clave], abierto.errorDispositivo) : '';
  }

  const casilla = (id, canal, rotulo) => `<label class="aj-casilla"><input type="checkbox" data-id="${escapar(id)}" data-canal="${canal}" aria-label="${escapar(rotulo)}"></label>`;

  function tabla(categorias) {
    return `
      <p class="aj-intro">Todo sigue llegando a la campana. Marca lo que además quieres recibir como aviso del sistema.</p>
      <table class="aj-tabla">
        <thead><tr><th scope="col">Aviso</th>${CANALES.map(c => `<th scope="col"><span class="aj-largo">${c.largo}</span><span class="aj-corto">${c.corto}</span></th>`).join('')}</tr></thead>
        <tbody>
          <tr class="aj-todos"><th scope="row"><div class="aj-nombre"><span class="aj-sangria"></span><span>Todos</span></div></th>${CANALES.map(c => `<td>${casilla('*', c.id, `${c.largo}: todos`)}</td>`).join('')}</tr>
          ${categorias.map(cat => `
          <tr>
            <th scope="row"><div class="aj-nombre">
              <button type="button" class="aj-info" data-info="${escapar(cat.id)}" aria-expanded="false" aria-label="Qué incluye ${escapar(cat.nombre)}"><ion-icon name="information-circle-outline"></ion-icon></button>
              <span>${escapar(cat.nombre)}</span>
            </div></th>
            ${CANALES.map(c => `<td>${casilla(cat.id, c.id, `${c.largo}: ${cat.nombre}`)}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // Marca las casillas según lo guardado; las que se están guardando quedan deshabilitadas.
  function pintarCasillas() {
    abierto.overlay.querySelectorAll('.aj-tabla input').forEach((input) => {
      const { id, canal } = input.dataset;
      const lista = id === '*' ? abierto.categorias : abierto.categorias.filter(c => c.id === id);
      const marcadas = lista.filter(c => c[canal]).length;
      input.checked = marcadas === lista.length;
      input.indeterminate = marcadas > 0 && marcadas < lista.length;
      input.disabled = abierto.guardando.has(`${canal}:*`) || (id === '*'
        ? [...abierto.guardando].some(k => k.startsWith(`${canal}:`))
        : abierto.guardando.has(`${canal}:${id}`));
    });
  }

  function pie(tipo, texto) {
    const zona = abierto.overlay.querySelector('.modal-footer');
    zona.innerHTML = tipo === 'cerrar'
      ? '<button type="button" class="btn btn--ghost" data-accion="cerrar">Cerrar</button>'
      : `<span class="aj-estado aj-estado--${tipo}" role="status">${escapar(texto)}</span>`;
    zona.classList.toggle('aj-pie--boton', tipo === 'cerrar');
  }

  async function cargar() {
    const actual = abierto;
    const cuerpo = actual.overlay.querySelector('.modal-body');
    cuerpo.innerHTML = '<div class="aj-esqueleto" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>';
    pie('cargando', 'Cargando tus preferencias…');
    let categorias;
    try {
      categorias = await pedirCategorias(actual.modulo);
    } catch {
      if (abierto !== actual) return;
      cuerpo.innerHTML = aviso({ tono: 'peligro', titulo: 'No se pudieron cargar tus preferencias', texto: 'No se aplicó ningún cambio. Revisa tu conexión y vuelve a intentarlo.', acciones: [['reintentar', 'Reintentar', 'ghost']] });
      pie('cerrar');
      return;
    }
    const dispositivo = window.pushDispositivo ? await window.pushDispositivo.estado() : 'deshabilitado';
    if (abierto !== actual) return;
    if (!categorias.length) {
      cuerpo.innerHTML = aviso({ tono: 'neutro', titulo: 'No hay avisos para configurar', texto: 'Con tus permisos actuales este módulo no te envía notificaciones.' });
      pie('cerrar');
      return;
    }
    actual.categorias = categorias;
    actual.dispositivo = dispositivo;
    cuerpo.innerHTML = `<div class="aj-dispositivo" aria-live="polite"></div>${tabla(categorias)}`;
    pintarDispositivo();
    pintarCasillas();
    pie('ok', GUARDADO);
  }

  async function guardar(input) {
    const actual = abierto;
    const { id, canal } = input.dataset;
    const activo = input.checked;
    const todas = id === '*';
    const afectadas = todas ? actual.categorias : actual.categorias.filter(c => c.id === id);
    const anteriores = afectadas.map(c => c[canal]);
    const clave = `${canal}:${id}`;
    afectadas.forEach(c => { c[canal] = activo; });
    actual.guardando.add(clave);
    pintarCasillas();
    try {
      const res = await fetch(API, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ modulo: actual.modulo, ...(todas ? { todas: true } : { categoria: id }), canal, activo })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '');
      }
      actual.guardando.delete(clave);
      if (abierto !== actual) return;
      pintarCasillas();
      pie('ok', GUARDADO);
    } catch (error) {
      afectadas.forEach((c, i) => { c[canal] = anteriores[i]; });
      actual.guardando.delete(clave);
      if (abierto !== actual) return;
      pintarCasillas();
      const que = todas ? `la columna «${CANALES.find(c => c.id === canal).largo}»` : `«${afectadas[0].nombre}»`;
      const vuelta = todas ? 'las casillas volvieron a como estaban' : 'la casilla volvió a como estaba';
      // Un mensaje del servidor explica la regla; sin él, lo habitual es la conexión.
      const motivo = error.message && error.name === 'Error' ? error.message : 'Revisa tu conexión y márcala otra vez.';
      pie('error', `No se pudo guardar ${que}: ${vuelta}. ${motivo}`);
    }
  }

  async function activarDispositivo(boton) {
    const actual = abierto;
    boton.disabled = true;
    actual.errorDispositivo = '';
    try {
      // Sin esperas antes de `activar`: el navegador exige que el permiso se pida desde este clic.
      actual.dispositivo = await window.pushDispositivo.activar();
    } catch (error) {
      actual.errorDispositivo = `No se pudieron activar los avisos: ${error.message}`;
    }
    actual.confirmando = false;
    if (abierto === actual) pintarDispositivo();
  }

  async function desactivarDispositivo(boton) {
    const actual = abierto;
    boton.disabled = true;
    actual.errorDispositivo = '';
    try {
      await window.pushDispositivo.desactivar();
    } catch {
      actual.errorDispositivo = 'No se pudieron desactivar los avisos. Revisa tu conexión y vuelve a intentarlo.';
    }
    actual.dispositivo = await window.pushDispositivo.estado();
    if (abierto === actual) pintarDispositivo();
  }

  function cerrarGlobo() {
    const globo = abierto && abierto.overlay.querySelector('.aj-globo');
    if (!globo) return false;
    globo.remove();
    abierto.overlay.querySelectorAll('.aj-info[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    return true;
  }

  function alternarGlobo(boton) {
    const estaba = boton.getAttribute('aria-expanded') === 'true';
    cerrarGlobo();
    if (estaba) return;
    const categoria = abierto.categorias.find(c => c.id === boton.dataset.info);
    const globo = document.createElement('div');
    globo.className = 'aj-globo';
    globo.setAttribute('role', 'status');
    globo.innerHTML = `<strong>${escapar(categoria.nombre)}</strong><p>${escapar(categoria.descripcion)}</p>`;
    abierto.overlay.appendChild(globo);
    boton.setAttribute('aria-expanded', 'true');
    // Debajo del ícono; si no cabe, encima.
    const r = boton.getBoundingClientRect();
    const izquierda = Math.max(8, Math.min(r.left, window.innerWidth - globo.offsetWidth - 8));
    const abajo = r.bottom + 6;
    globo.style.left = `${izquierda}px`;
    globo.style.top = `${abajo + globo.offsetHeight > window.innerHeight - 8 ? r.top - globo.offsetHeight - 6 : abajo}px`;
  }

  function cerrar() {
    if (!abierto) return;
    const { overlay, foco, alTeclear } = abierto;
    document.removeEventListener('keydown', alTeclear, true);
    overlay.remove();
    abierto = null;
    if (foco && foco.isConnected) foco.focus();
  }

  function abrir(modulo) {
    cerrar();
    const titulo = `Notificaciones de ${NOMBRES[modulo] || modulo}`;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay aj-overlay';
    overlay.innerHTML = `
      <div class="modal-box aj-modal" role="dialog" aria-modal="true" aria-label="${escapar(titulo)}" tabindex="-1">
        <div class="modal-header">
          <h3>${escapar(titulo)}</h3>
          <button type="button" class="modal-close" data-accion="cerrar" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-footer"></div>
      </div>`;
    const alTeclear = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // que Escape no cierre además algo del módulo que hay detrás
      if (!cerrarGlobo()) cerrar();
    };
    abierto = { modulo, overlay, categorias: [], dispositivo: 'deshabilitado', confirmando: false, errorDispositivo: '', guardando: new Set(), foco: document.activeElement, alTeclear };

    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      const info = e.target.closest('.aj-info');
      if (info) { alternarGlobo(info); return; }
      if (!e.target.closest('.aj-globo')) cerrarGlobo();
      if (e.target === overlay) { cerrar(); return; }
      const boton = e.target.closest('[data-accion]');
      if (!boton) return;
      const accion = boton.dataset.accion;
      if (accion === 'cerrar') cerrar();
      else if (accion === 'reintentar') cargar();
      else if (accion === 'preguntar') { abierto.confirmando = true; abierto.errorDispositivo = ''; pintarDispositivo(); }
      else if (accion === 'cancelar') { abierto.confirmando = false; pintarDispositivo(); }
      else if (accion === 'continuar') activarDispositivo(boton);
      else if (accion === 'desactivar') desactivarDispositivo(boton);
    });
    overlay.addEventListener('change', (e) => {
      if (e.target.matches('.aj-tabla input')) guardar(e.target);
    });
    overlay.querySelector('.modal-body').addEventListener('scroll', cerrarGlobo);
    document.addEventListener('keydown', alTeclear, true);
    document.body.appendChild(overlay);
    overlay.querySelector('.aj-modal').focus();

    // El permiso puede cambiar desde el candado del navegador con el modal abierto.
    const actual = abierto;
    window.pushDispositivo?.alCambiarPermiso(async () => {
      if (abierto !== actual) return;
      actual.dispositivo = await window.pushDispositivo.estado();
      pintarDispositivo();
    });
    cargar();
  }

  window.notificacionesAjustes = { hayCategorias, abrir };
})();
