// Administración: lista de productos del Generador de Prompts y alta de productos nuevos.
import { h, icono, $ } from '../utils/dom.js';
import { abrirModal, mostrarErrorModal, confirmarModal } from '../components/modal.js';
import { listarProductos, crearProducto, cambiarEstado } from '../api/promptsAdminApi.js';
import { renderEditor } from './admin/editor.js';
import { badgeEstado, fechaGt, mensajesDeError } from './admin/comun.js';

export async function renderAdminProductos(contenedor) {
  const productos = await listarProductos();
  const abrirEditor = (id) => renderEditor(contenedor, { id, alVolver: () => renderAdminProductos(contenedor).catch(mostrarError) });
  const recargar = () => renderAdminProductos(contenedor).catch(mostrarError);
  const mostrarError = (error) => window.toast.error('No se pudo cargar', error.message);

  async function alternarEstado(p) {
    const activar = p.estado !== 'activo';
    const ok = await confirmarModal({
      title: activar ? 'Activar producto' : 'Desactivar producto',
      mensaje: activar ? `«${p.nombre}» volverá a estar disponible para los asesores.` : `«${p.nombre}» dejará de aparecer para los asesores.`,
      aceptar: activar ? 'Activar' : 'Desactivar'
    });
    if (!ok) return;
    try {
      await cambiarEstado(p.id, activar ? 'activo' : 'inactivo');
      window.toast.success(activar ? 'Producto activado' : 'Producto desactivado', p.nombre);
      await recargar();
    } catch (error) {
      window.toast.error('No se pudo cambiar el estado', error.message);
    }
  }

  function abrirNuevo() {
    const cuerpo = `<div class="form-grid">
      <div class="form-field"><label for="pr-adm-n-codigo">Código</label><input id="pr-adm-n-codigo" class="pr-adm-mono" maxlength="40"><span class="form-hint">Identificador corto, por ejemplo «medalla».</span></div>
      <div class="form-field"><label for="pr-adm-n-nombre">Nombre</label><input id="pr-adm-n-nombre" maxlength="80"></div>
      <div class="form-field full"><label for="pr-adm-n-descripcion">Descripción</label><textarea id="pr-adm-n-descripcion" rows="3" maxlength="300"></textarea></div>
    </div>`;
    const pie = '<button class="btn btn--ghost" type="button" id="pr-adm-n-cancelar">Cancelar</button><button class="btn btn--primary" type="button" id="pr-adm-n-crear">Crear producto</button>';
    const { overlay, cerrar } = abrirModal({ title: 'Nuevo producto', bodyHtml: cuerpo, footerHtml: pie });
    $('#pr-adm-n-cancelar', overlay).addEventListener('click', cerrar);
    $('#pr-adm-n-crear', overlay).addEventListener('click', async (e) => {
      const payload = {
        codigo: $('#pr-adm-n-codigo', overlay).value.trim(),
        nombre: $('#pr-adm-n-nombre', overlay).value.trim(),
        descripcion: $('#pr-adm-n-descripcion', overlay).value.trim()
      };
      if (!payload.codigo || !payload.nombre) { mostrarErrorModal(overlay, 'El código y el nombre son obligatorios.'); return; }
      e.target.disabled = true;
      try {
        const creado = await crearProducto(payload);
        cerrar();
        window.toast.success('Producto creado', payload.nombre);
        const nuevoId = creado.id ?? (creado.producto && creado.producto.id);
        if (nuevoId) await abrirEditor(nuevoId); else await recargar();
      } catch (error) {
        e.target.disabled = false;
        mostrarErrorModal(overlay, mensajesDeError(error).join(' '));
      }
    });
    $('#pr-adm-n-codigo', overlay).focus();
  }

  function fila(p) {
    const puedeActivar = p.numeroVigente != null;
    const activo = p.estado === 'activo';
    return h('tr', { class: p.estado === 'inactivo' ? 'fila-inactiva' : '' },
      h('td', null, h('div', { class: 'pr-adm-producto' },
        h('span', { class: 'pr-adm-producto-icono' }, icono('cube-outline')),
        h('div', null, h('strong', { text: p.nombre }), h('div', { class: 'pr-adm-muted pr-adm-mono', text: p.codigo })))),
      h('td', { text: String(p.totalParametros ?? 0) }),
      h('td', { text: puedeActivar ? `v${p.numeroVigente}` : 'Sin publicar' }),
      h('td', null, badgeEstado(p.estado)),
      h('td', { text: fechaGt(p.actualizadoEn) }),
      h('td', null, h('div', { class: 'acciones-cell' },
        h('button', { type: 'button', class: 'btn-icon', title: 'Editar producto', 'aria-label': 'Editar producto', onclick: () => abrirEditor(p.id) }, icono('create-outline')),
        h('button', {
          type: 'button', class: 'btn-icon', disabled: !activo && !puedeActivar,
          title: activo ? 'Desactivar producto' : puedeActivar ? 'Activar producto' : 'Publica una versión para activarlo',
          'aria-label': activo ? 'Desactivar producto' : 'Activar producto',
          onclick: () => alternarEstado(p)
        }, icono(activo ? 'eye-off-outline' : 'eye-outline')))));
  }

  const tabla = productos.length
    ? h('div', { class: 'pr-adm-tabla-wrap' },
      h('table', { class: 'data-table' },
        h('thead', null, h('tr', null, ['Producto', 'Parámetros', 'Versión vigente', 'Estado', 'Actualizado', 'Acciones'].map(t => h('th', { text: t })))),
        h('tbody', null, productos.map(fila))))
    : h('div', { class: 'buzon-vacio' }, icono('cube-outline'), h('p', { text: 'Todavía no hay productos. Crea el primero con «Nuevo producto».' }));

  contenedor.replaceChildren(
    h('div', { class: 'panel-toolbar' },
      h('div', null, h('h2', { text: 'Productos' }), h('p', { class: 'pr-subtitulo', text: 'Define qué se puede generar y qué datos pide cada producto.' })),
      h('button', { type: 'button', class: 'btn btn--primary', id: 'pr-adm-nuevo', onclick: abrirNuevo }, icono('add-outline'), ' Nuevo producto')),
    h('div', { class: 'resumen-grid' },
      h('div', { class: 'resumen-card' }, h('div', { class: 'valor', text: String(productos.filter(p => p.estado === 'activo').length) }), h('div', { class: 'etiqueta', text: 'Productos activos' })),
      h('div', { class: 'resumen-card' }, h('div', { class: 'valor', text: String(productos.filter(p => p.tieneBorrador).length) }), h('div', { class: 'etiqueta', text: 'Productos con borrador' }))),
    h('section', { class: 'pr-card pr-adm-tarjeta-tabla' }, tabla),
    h('div', { class: 'pr-banner' }, icono('information-circle-outline'),
      h('span', { text: 'Cada vez que publicas un producto se crea una versión nueva. Las versiones anteriores quedan archivadas.' })));
}
