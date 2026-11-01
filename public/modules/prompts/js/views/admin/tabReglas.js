// Pestaña «Reglas»: texto específico del producto que va antes (inicio) o después (fin) de lo que generan los parámetros.
import { h, icono, montar } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { confirmarModal } from '../../components/modal.js';
import { abrirModalRegla } from './modalRegla.js';
import { reglasDe, agregarRegla, actualizarRegla, eliminarRegla, moverRegla, alternarRegla } from './reglasOps.js';

function botonIcono(nombre, titulo, onclick, { peligro = false, deshabilitado = false } = {}) {
  return h('button', { type: 'button', class: `btn-icon${peligro ? ' icon-danger' : ''}`, title: titulo, 'aria-label': titulo, disabled: deshabilitado, onclick }, icono(nombre));
}

export function renderTabReglas(cont, ed) {
  const { limites, variablesAutomaticas } = ed.config;
  const pintar = () => montar(cont, contenido());
  const aplicar = (fn) => {
    ed.cambiarEsquema(fn(ed.esquema));
    pintar();
  };
  const seguro = (fn) => {
    try { fn(); } catch (error) { window.toast.warning(t('admin.reglas.toastNoAplicado'), error.message); }
  };

  function eliminar(r) {
    confirmarModal({ title: t('admin.reglas.eliminarTitulo'), mensaje: t('admin.reglas.eliminarMensaje', { etiqueta: r.etiqueta }), aceptar: t('admin.reglas.eliminarAceptar') })
      .then((ok) => { if (ok) seguro(() => aplicar(e => eliminarRegla(e, r.clave))); });
  }

  function abrir(original) {
    abrirModalRegla(ed, {
      original,
      alGuardar: (regla) => {
        if (!original) aplicar(e => agregarRegla(e, regla, { automaticas: variablesAutomaticas, limites }));
        else aplicar(e => actualizarRegla(e, original.clave, regla, { automaticas: variablesAutomaticas }));
      }
    });
  }

  function tarjeta(r, i, total) {
    const bloqueado = !ed.editable;
    return h('section', { class: 'pr-adm-regla', 'data-regla': r.clave },
      h('div', { class: 'pr-adm-rec-cuerpo' },
        h('div', { class: 'pr-adm-rec-cab' },
          h('span', { class: 'pr-adm-grupo-etiqueta', text: r.etiqueta }),
          h('code', { class: 'pr-adm-mono', text: r.clave }),
          h('span', { class: 'pr-adm-pill', text: t(r.posicion === 'fin' ? 'admin.reglas.posicionFin' : 'admin.reglas.posicionInicio') }),
          h('span', { class: `pr-adm-pill ${r.activo ? 'pr-adm-pill--req' : ''}`, text: t(r.activo ? 'admin.reglas.estadoActiva' : 'admin.reglas.estadoInactiva') })),
        h('p', { class: 'pr-adm-regla-texto', text: r.texto || t('admin.reglas.sinTexto') })),
      h('div', { class: 'pr-adm-param-acciones' },
        botonIcono('chevron-up-outline', t('admin.parametros.subir'), () => seguro(() => aplicar(e => moverRegla(e, r.clave, -1))), { deshabilitado: bloqueado || i === 0 }),
        botonIcono('chevron-down-outline', t('admin.parametros.bajar'), () => seguro(() => aplicar(e => moverRegla(e, r.clave, 1))), { deshabilitado: bloqueado || i === total - 1 }),
        botonIcono(r.activo ? 'eye-off-outline' : 'eye-outline', t(r.activo ? 'admin.reglas.desactivar' : 'admin.reglas.activar'), () => seguro(() => aplicar(e => alternarRegla(e, r.clave))), { deshabilitado: bloqueado }),
        botonIcono('create-outline', t('admin.reglas.editar'), () => abrir(r), { deshabilitado: bloqueado }),
        botonIcono('trash-outline', t('admin.reglas.eliminar'), () => eliminar(r), { peligro: true, deshabilitado: bloqueado })));
  }

  function contenido() {
    const reglas = reglasDe(ed.esquema);
    const lleno = reglas.length >= limites.reglas_max;
    return [
      h('div', { class: 'pr-banner' }, icono('information-circle-outline'), h('span', { text: t('admin.reglas.intro', { max: limites.reglas_max }) })),
      reglas.length
        ? h('div', { class: 'pr-adm-reglas' }, reglas.map((r, i) => tarjeta(r, i, reglas.length)))
        : h('div', { class: 'buzon-vacio' }, icono('list-outline'), h('p', { text: t('admin.reglas.vacio') })),
      h('div', null, h('button', {
        type: 'button', class: 'btn btn--ghost', id: 'pr-adm-regla-agregar', disabled: !ed.editable || lleno,
        title: lleno ? t('admin.reglas.limiteAlcanzado', { max: limites.reglas_max }) : '',
        onclick: () => abrir(null)
      }, icono('add-outline'), ` ${t('admin.reglas.agregar')}`))
    ];
  }

  pintar();
}
