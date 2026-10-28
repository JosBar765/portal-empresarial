// Administración: lista de productos del Generador de Prompts y alta de productos nuevos.
import { h, icono, $ } from '../utils/dom.js';
import { escapeHtml } from '../utils/formato.js';
import { t } from '../textos.js';
import { cargarConfig } from '../config.js';
import { abrirModal, mostrarErrorModal, confirmarModal } from '../components/modal.js';
import { listarProductos, crearProducto, duplicarProducto, obtenerProducto, cambiarEstado } from '../api/promptsAdminApi.js';
import { renderEditor } from './admin/editor.js';
import { CODIGO_PRODUCTO_RE, CODIGO_PRODUCTO_LARGO_MAX } from './admin/reglasEsquema.js';
import { badgeEstado, fechaGt, mensajesDeError } from './admin/comun.js';

const COLUMNAS = ['producto', 'parametros', 'version', 'estado', 'actualizado', 'acciones'];

export async function renderAdminProductos(contenedor) {
  const [productos, { limites }] = await Promise.all([listarProductos(), cargarConfig()]);
  const abrirEditor = (id) => renderEditor(contenedor, { id, alVolver: () => renderAdminProductos(contenedor).catch(mostrarError) });
  const recargar = () => renderAdminProductos(contenedor).catch(mostrarError);
  const mostrarError = (error) => window.toast.error(t('admin.productos.toastNoCargado'), error.message);

  async function alternarEstado(p) {
    const activar = p.estado !== 'activo';
    const ok = await confirmarModal({
      title: t(activar ? 'admin.productos.activarTitulo' : 'admin.productos.desactivarTitulo'),
      mensaje: t(activar ? 'admin.productos.activarMensaje' : 'admin.productos.desactivarMensaje', { nombre: p.nombre }),
      aceptar: t(activar ? 'admin.productos.activarAceptar' : 'admin.productos.desactivarAceptar')
    });
    if (!ok) return;
    try {
      await cambiarEstado(p.id, activar ? 'activo' : 'inactivo');
      window.toast.success(t(activar ? 'admin.productos.toastActivado' : 'admin.productos.toastDesactivado'), p.nombre);
      await recargar();
    } catch (error) {
      window.toast.error(t('admin.productos.toastNoEstado'), error.message);
    }
  }

  // Mensajes explicativos del alta; el servidor vuelve a validar.
  function erroresDeAlta({ codigo, nombre, descripcion }) {
    const errores = [];
    if (!codigo) errores.push(t('admin.errores.productoCodigoVacio'));
    else if (!CODIGO_PRODUCTO_RE.test(codigo)) errores.push(t('admin.errores.productoCodigoInvalido', { codigo, max: CODIGO_PRODUCTO_LARGO_MAX }));
    if (!nombre) errores.push(t('admin.errores.productoNombreVacio', { max: limites.producto_nombre_max }));
    else if (nombre.length > limites.producto_nombre_max) errores.push(t('admin.errores.productoNombreLargo', { largo: nombre.length, max: limites.producto_nombre_max }));
    if (descripcion.length > limites.producto_descripcion_max) errores.push(t('admin.errores.productoDescripcionLarga', { largo: descripcion.length, max: limites.producto_descripcion_max }));
    return errores;
  }

  // Formulario de alta compartido por «Nuevo» y «Duplicar»; `enviar` crea el producto con los datos validados.
  function abrirFormularioProducto({ titulo, aceptar, aviso = '', descripcion = '', sugerencias = {}, enviar }) {
    const cuerpo = `${aviso ? `<p class="pr-adm-muted">${escapeHtml(aviso)}</p>` : ''}<div class="form-grid">
      <div class="form-field"><label for="pr-adm-n-codigo">${escapeHtml(t('admin.productos.codigo'))}</label><input id="pr-adm-n-codigo" class="pr-adm-mono" maxlength="${CODIGO_PRODUCTO_LARGO_MAX}" placeholder="${escapeHtml(sugerencias.codigo || '')}"><span class="form-hint">${escapeHtml(t('admin.productos.codigoAyuda'))}</span></div>
      <div class="form-field"><label for="pr-adm-n-nombre">${escapeHtml(t('admin.productos.nombre'))}</label><input id="pr-adm-n-nombre" maxlength="${limites.producto_nombre_max}" placeholder="${escapeHtml(sugerencias.nombre || '')}"></div>
      <div class="form-field full"><label for="pr-adm-n-descripcion">${escapeHtml(t('admin.productos.descripcion'))}</label><textarea id="pr-adm-n-descripcion" rows="3" maxlength="${limites.producto_descripcion_max}">${escapeHtml(descripcion)}</textarea></div>
    </div>`;
    const pie = `<button class="btn btn--ghost" type="button" id="pr-adm-n-cancelar">${escapeHtml(t('comun.cancelar'))}</button><button class="btn btn--primary" type="button" id="pr-adm-n-crear">${escapeHtml(aceptar)}</button>`;
    const { overlay, cerrar } = abrirModal({ title: titulo, bodyHtml: cuerpo, footerHtml: pie });
    $('#pr-adm-n-cancelar', overlay).addEventListener('click', cerrar);
    $('#pr-adm-n-crear', overlay).addEventListener('click', async (e) => {
      const payload = {
        codigo: $('#pr-adm-n-codigo', overlay).value.trim(),
        nombre: $('#pr-adm-n-nombre', overlay).value.trim(),
        descripcion: $('#pr-adm-n-descripcion', overlay).value.trim()
      };
      const errores = erroresDeAlta(payload);
      if (errores.length) { mostrarErrorModal(overlay, errores[0]); return; }
      e.target.disabled = true;
      try {
        const { creado, toast } = await enviar(payload);
        cerrar();
        window.toast.success(toast, payload.nombre);
        const nuevoId = creado.id ?? (creado.producto && creado.producto.id);
        if (nuevoId) await abrirEditor(nuevoId); else await recargar();
      } catch (error) {
        e.target.disabled = false;
        mostrarErrorModal(overlay, mensajesDeError(error).join(' '));
      }
    });
    $('#pr-adm-n-codigo', overlay).focus();
  }

  const abrirNuevo = () => abrirFormularioProducto({
    titulo: t('admin.productos.nuevoTitulo'),
    aceptar: t('admin.productos.crear'),
    enviar: async (payload) => ({ creado: await crearProducto(payload), toast: t('admin.productos.toastCreado') })
  });

  // La lista no trae la descripción ni el detalle de versiones: se consulta el producto antes de abrir el modal.
  async function abrirDuplicar(p) {
    let origen;
    try {
      origen = await obtenerProducto(p.id);
    } catch (error) {
      window.toast.error(t('admin.productos.toastNoDuplicar'), error.message);
      return;
    }
    abrirFormularioProducto({
      titulo: t('admin.productos.duplicarTitulo'),
      aceptar: t('admin.productos.duplicarAceptar'),
      aviso: t(origen.publicada ? 'admin.productos.duplicarAvisoPublicada' : 'admin.productos.duplicarAvisoBorrador', { nombre: p.nombre }),
      descripcion: origen.producto.descripcion || '',
      sugerencias: { codigo: t('admin.productos.duplicarCodigoSugerido', { codigo: p.codigo }), nombre: t('admin.productos.duplicarNombreSugerido', { nombre: p.nombre }) },
      enviar: async (payload) => ({ creado: await duplicarProducto(p.id, payload), toast: t('admin.productos.toastDuplicado') })
    });
  }

  function fila(p) {
    const puedeActivar = p.numeroVigente != null;
    const activo = p.estado === 'activo';
    // data-label repite el encabezado: en celular cada fila se muestra como tarjeta.
    const etiqueta = (c) => t(`admin.productos.col.${c}`);
    return h('tr', { class: p.estado === 'inactivo' ? 'fila-inactiva' : '' },
      h('td', { 'data-label': etiqueta('producto') }, h('div', { class: 'pr-adm-producto' },
        h('span', { class: 'pr-adm-producto-icono' }, icono('cube-outline')),
        h('div', null, h('strong', { text: p.nombre }), h('div', { class: 'pr-adm-muted pr-adm-mono', text: p.codigo })))),
      h('td', { 'data-label': etiqueta('parametros'), text: String(p.totalParametros ?? 0) }),
      h('td', { 'data-label': etiqueta('version'), text: puedeActivar ? t('admin.productos.versionVigente', { numero: p.numeroVigente }) : t('admin.productos.sinPublicar') }),
      h('td', { 'data-label': etiqueta('estado') }, badgeEstado(p.estado)),
      h('td', { 'data-label': etiqueta('actualizado'), text: fechaGt(p.actualizadoEn) }),
      h('td', { 'data-label': etiqueta('acciones') }, h('div', { class: 'acciones-cell' },
        h('button', { type: 'button', class: 'btn-icon', title: t('admin.productos.editar'), 'aria-label': t('admin.productos.editar'), onclick: () => abrirEditor(p.id) }, icono('create-outline')),
        h('button', { type: 'button', class: 'btn-icon', title: t('admin.productos.duplicar'), 'aria-label': t('admin.productos.duplicar'), onclick: () => abrirDuplicar(p) }, icono('copy-outline')),
        h('button', {
          type: 'button', class: 'btn-icon', disabled: !activo && !puedeActivar,
          title: activo ? t('admin.productos.desactivar') : puedeActivar ? t('admin.productos.activar') : t('admin.productos.activarSinVersion'),
          'aria-label': activo ? t('admin.productos.desactivar') : t('admin.productos.activar'),
          onclick: () => alternarEstado(p)
        }, icono(activo ? 'eye-off-outline' : 'eye-outline')))));
  }

  const tabla = productos.length
    ? h('div', { class: 'pr-adm-tabla-wrap' },
      h('table', { class: 'data-table pr-adm-tabla-productos' },
        h('thead', null, h('tr', null, COLUMNAS.map(c => h('th', { text: t(`admin.productos.col.${c}`) })))),
        h('tbody', null, productos.map(fila))))
    : h('div', { class: 'buzon-vacio' }, icono('cube-outline'), h('p', { text: t('admin.productos.vacio') }));

  contenedor.replaceChildren(
    h('div', { class: 'panel-toolbar' },
      h('div', null, h('h2', { text: t('admin.productos.titulo') }), h('p', { class: 'pr-subtitulo', text: t('admin.productos.subtitulo') })),
      h('button', { type: 'button', class: 'btn btn--primary', id: 'pr-adm-nuevo', onclick: abrirNuevo }, icono('add-outline'), ` ${t('admin.productos.nuevo')}`)),
    h('div', { class: 'resumen-grid' },
      h('div', { class: 'resumen-card' }, h('div', { class: 'valor', text: String(productos.filter(p => p.estado === 'activo').length) }), h('div', { class: 'etiqueta', text: t('admin.productos.resumenActivos') })),
      h('div', { class: 'resumen-card' }, h('div', { class: 'valor', text: String(productos.filter(p => p.tieneBorrador).length) }), h('div', { class: 'etiqueta', text: t('admin.productos.resumenBorrador') }))),
    h('section', { class: 'pr-card pr-adm-tarjeta-tabla' }, tabla),
    h('div', { class: 'pr-banner' }, icono('information-circle-outline'),
      h('span', { text: t('admin.productos.bannerVersiones') })));
}
