// Subpestaña «Archivos»: tipos de archivo permitidos y tamaño máximo de las fotos de defectos y de los comprobantes de liquidación.
import { state } from '../../state.js';
import { h, montar } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { guardarAjuste, listarAjustes, mensajesDeError } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearAviso } from '../../components/aviso.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { limpiarErrorCampo, marcarErrorCampo } from '../../components/validacion.js';
import { estadoLista } from './lista.js';
import { CLAVES_AJUSTE, MB_MAX, MB_MIN, TIPOS_ARCHIVO, ajustesCambiados, ajustesIniciales, validarAjustes, valorDeAjuste } from './archivosModelo.js';

const ID = { TIPOS: 'vi-arch-tipos', MB: 'vi-arch-mb' };

export function renderArchivos(contenedor) {
  let iniciales = { tipos: [], maxMb: '' };
  let actuales = { tipos: [], maxMb: '' };
  let guardando = false;
  let numeroCarga = 0;
  let refs = null;
  // Los cambios de subpestaña vacían el panel: si `raiz` ya no está conectada, las respuestas tardías no pintan nada.
  const raiz = h('div', { class: 'vi-archivos-raiz' });
  contenedor.replaceChildren(raiz);

  const hayCambios = () => ajustesCambiados(iniciales, actuales).length > 0;
  const antesDeSalir = (e) => { if (hayCambios()) { e.preventDefault(); e.returnValue = ''; } };

  // La vista le dice al shell (y a la barra lateral) que pida confirmación al salir con ajustes sin guardar.
  state.salidaVista = {
    confirmar: async () => !hayCambios() || confirmarModal({
      title: t('config.cambios.titulo'), mensaje: t('config.archivos.cambios.mensaje'), aceptar: t('config.cambios.salir'), cancelar: t('config.cambios.quedarme'), peligro: true
    }),
    liberar: () => window.removeEventListener('beforeunload', antesDeSalir)
  };
  window.addEventListener('beforeunload', antesDeSalir);

  const tarjeta = (...hijos) => h('section', { class: 'vi-seccion vi-config-seccion', 'aria-label': t('config.archivos.titulo') },
    h('div', { class: 'vi-seccion-cabecera' }, h('div', { class: 'vi-config-titulos' },
      h('h2', { text: t('config.archivos.titulo') }),
      h('p', { class: 'vi-config-subtitulo', text: t('config.archivos.subtitulo') }))),
    hijos);

  function actualizarBotones() {
    if (!refs) return;
    const cambios = hayCambios();
    refs.guardar.disabled = !cambios || guardando;
    refs.descartar.disabled = !cambios || guardando;
  }

  function alCambiar() {
    refs.avisos.replaceChildren();
    actualizarBotones();
  }

  function pintar() {
    const casillas = TIPOS_ARCHIVO.map(tipo => {
      const id = `${ID.TIPOS}-${tipo.mime.replace(/[^a-z0-9]/g, '-')}`;
      const casilla = h('input', { type: 'checkbox', id, name: 'tipos', value: tipo.mime, checked: actuales.tipos.includes(tipo.mime) });
      casilla.addEventListener('change', () => {
        actuales.tipos = TIPOS_ARCHIVO.map(x => x.mime).filter(m => refs.casillas.some(c => c.value === m && c.checked));
        limpiarErrorCampo(casilla);
        alCambiar();
      });
      return { casilla, nodo: h('label', { class: 'vi-casilla', for: id }, casilla, h('span', { text: t(tipo.etiqueta) })) };
    });
    const mb = crearCampoNumerico({
      id: ID.MB, name: CLAVES_AJUSTE.MAX_MB, valor: actuales.maxMb, entero: true, placeholder: t('config.archivos.ph.mb'),
      alCambiar: (valor) => { actuales.maxMb = valor; limpiarErrorCampo(mb); alCambiar(); }
    });
    const avisos = h('div', { class: 'vi-avisos', 'aria-live': 'polite' });
    const descartar = h('button', { class: 'btn btn--ghost', id: 'vi-arch-descartar', type: 'button', text: t('config.archivos.descartar'), onclick: descartarCambios });
    const guardar = h('button', { class: 'btn btn--primary', id: 'vi-arch-guardar', type: 'button', text: t('config.archivos.guardar'), onclick: guardarCambios });
    refs = { casillas: casillas.map(c => c.casilla), mb, avisos, guardar, descartar };
    montar(raiz, tarjeta(
      h('div', { class: 'vi-config-nota' }, crearAviso({ tipo: 'info', titulo: t('config.archivos.nota.titulo'), texto: t('config.archivos.nota.texto') })),
      avisos,
      h('form', { class: 'form-grid vi-config-form', id: 'vi-arch-form', novalidate: true, onsubmit: (e) => e.preventDefault() },
        h('div', { class: 'form-field full', 'data-campo': CLAVES_AJUSTE.TIPOS },
          h('span', { class: 'vi-etiqueta-campo', id: `${ID.TIPOS}-etiqueta`, text: t('config.archivos.campo.tipos') }),
          h('div', { class: 'vi-casillas', role: 'group', 'aria-labelledby': `${ID.TIPOS}-etiqueta` }, casillas.map(c => c.nodo)),
          h('span', { class: 'form-hint', text: t('config.archivos.ayuda.tipos') })),
        h('div', { class: 'form-field' },
          h('label', { for: ID.MB, text: t('config.archivos.campo.mb') }),
          mb,
          h('span', { class: 'form-hint', text: t('config.archivos.ayuda.mb', { min: MB_MIN, max: MB_MAX }) }))),
      h('div', { class: 'vi-config-pie' }, descartar, guardar)));
    actualizarBotones();
  }

  function descartarCambios() {
    actuales = { tipos: [...iniciales.tipos], maxMb: iniciales.maxMb };
    refs.casillas.forEach(c => { c.checked = actuales.tipos.includes(c.value); limpiarErrorCampo(c); });
    refs.mb.value = actuales.maxMb;
    limpiarErrorCampo(refs.mb);
    refs.avisos.replaceChildren();
    actualizarBotones();
  }

  const controlDe = (clave) => (clave === CLAVES_AJUSTE.TIPOS ? refs.casillas[0] : refs.mb);

  // Marca el error junto al campo del ajuste; devuelve el control para enfocarlo.
  function marcarAjuste(clave, mensaje) {
    const control = controlDe(clave);
    marcarErrorCampo(control, mensaje);
    return control;
  }

  async function guardarCambios() {
    if (guardando || !hayCambios()) return;
    refs.casillas.concat(refs.mb).forEach(limpiarErrorCampo);
    refs.avisos.replaceChildren();
    const errores = Object.entries(validarAjustes(actuales));
    // Solo bloquean los errores de lo que cambió; un ajuste sin tocar se valida cuando se edita.
    const cambiados = ajustesCambiados(iniciales, actuales);
    const bloqueantes = errores.filter(([clave]) => cambiados.includes(clave));
    if (bloqueantes.length) {
      const primero = bloqueantes.map(([clave, mensaje]) => marcarAjuste(clave, mensaje))[0];
      primero.focus();
      return;
    }
    guardando = true;
    actualizarBotones();
    const fallidos = [];
    for (const clave of cambiados) {
      try {
        await guardarAjuste(clave, valorDeAjuste(clave, actuales));
        if (!raiz.isConnected) return;
        if (clave === CLAVES_AJUSTE.TIPOS) iniciales.tipos = [...actuales.tipos]; else iniciales.maxMb = String(actuales.maxMb).trim();
      } catch (error) {
        if (!raiz.isConnected) return;
        fallidos.push([clave, error]);
      }
    }
    guardando = false;
    let primero = null;
    for (const [clave, error] of fallidos) {
      const deCampo = error.status === 400 && error.campos && error.campos.valor;
      if (deCampo) { const control = marcarAjuste(clave, String(error.campos.valor)); primero = primero || control; } else {
        refs.avisos.append(crearAviso({ tipo: 'error', titulo: t('config.archivos.errorGuardar'), texto: mensajesDeError(error).join(' ') }));
      }
    }
    if (primero) primero.focus();
    if (!fallidos.length) window.toast?.success(t('tab.configuracion'), t('config.archivos.exito'));
    actualizarBotones();
  }

  async function cargar() {
    const numero = ++numeroCarga;
    montar(raiz, tarjeta(estadoLista({ icono: 'sync-outline', spinner: true, texto: t('config.archivos.cargando') })));
    try {
      const lista = await listarAjustes();
      if (numero !== numeroCarga || !raiz.isConnected) return;
      iniciales = ajustesIniciales(lista);
      actuales = { tipos: [...iniciales.tipos], maxMb: iniciales.maxMb };
      pintar();
    } catch (error) {
      if (numero !== numeroCarga || !raiz.isConnected) return;
      refs = null;
      montar(raiz, tarjeta(estadoLista({ icono: 'alert-circle-outline', titulo: t('config.archivos.error'), texto: error.message, error: true, alReintentar: () => cargar() })));
    }
  }

  return cargar();
}
