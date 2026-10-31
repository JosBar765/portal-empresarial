// Administración: ajustes del módulo (textos y límites editables); cada tarjeta guarda un ajuste por separado.
import { h, icono } from '../utils/dom.js';
import { t } from '../textos.js';
import { cargarConfig } from '../config.js';
import { listarAjustes, guardarAjuste } from '../api/promptsAdminApi.js';
import { fechaGt } from './admin/comun.js';
import { esTextoPlano, textoDeValor, leerAjuste, mensajesDeAjuste } from './admin/ajustesOps.js';

function tarjeta(inicial) {
  let actual = inicial;
  const { clave } = inicial;
  const plano = esTextoPlano(inicial.valor);
  const area = h('textarea', {
    id: `pr-adm-aj-${clave}`, class: `pr-adm-aj-area${plano ? '' : ' pr-adm-mono'}`, rows: plano ? 5 : 14, spellcheck: 'false'
  });
  const errores = h('div', { class: 'form-error pr-adm-aj-error', id: `pr-adm-aj-error-${clave}`, hidden: true });
  const fecha = h('span', { class: 'form-hint' });
  const botonGuardar = h('button', { type: 'button', class: 'btn btn--primary btn--sm', id: `pr-adm-aj-guardar-${clave}`, text: t('admin.ajustes.guardar') });
  const botonDescartar = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', id: `pr-adm-aj-descartar-${clave}`, text: t('admin.ajustes.descartar') });

  const mostrarErrores = (mensajes) => {
    errores.hidden = !mensajes.length;
    errores.replaceChildren(...mensajes.map(m => h('p', { text: m })));
  };
  const pintar = () => {
    area.value = textoDeValor(actual.valor);
    fecha.textContent = t('admin.ajustes.actualizado', { fecha: fechaGt(actual.actualizadoEn) });
    mostrarErrores([]);
  };

  botonDescartar.addEventListener('click', pintar);
  botonGuardar.addEventListener('click', async () => {
    const r = leerAjuste(clave, area.value, actual.valor);
    if (r.error) { mostrarErrores([r.error]); return; }
    botonGuardar.disabled = true;
    try {
      actual = await guardarAjuste(clave, r.valor);
      pintar();
      window.toast.success(t('admin.ajustes.toastGuardado'), t('admin.ajustes.toastGuardadoTexto', { clave }));
      // Descarta la configuración cacheada para que el siguiente uso lea los valores nuevos.
      cargarConfig(true).catch(() => {});
    } catch (error) {
      mostrarErrores(mensajesDeAjuste(error));
    } finally {
      botonGuardar.disabled = false;
    }
  });

  pintar();
  return h('section', { class: 'pr-card pr-adm-aj', 'data-ajuste': clave },
    h('h3', { class: 'pr-adm-aj-titulo', text: clave }),
    h('p', { class: 'pr-card-sub', text: inicial.descripcion }),
    area,
    errores,
    h('div', { class: 'pr-adm-aj-pie' }, fecha, h('div', { class: 'pr-adm-acciones' }, botonDescartar, botonGuardar)));
}

export async function renderAdminAjustes(contenedor) {
  const ajustes = await listarAjustes();
  contenedor.replaceChildren(
    h('div', { class: 'panel-toolbar' },
      h('div', null, h('h2', { text: t('admin.ajustes.titulo') }), h('p', { class: 'pr-subtitulo', text: t('admin.ajustes.subtitulo') }))),
    h('div', { class: 'pr-banner pr-banner--aviso' }, icono('alert-circle-outline'), h('span', { text: t('admin.ajustes.aviso') })),
    ...ajustes.map(tarjeta));
}
