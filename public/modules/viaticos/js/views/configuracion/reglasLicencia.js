// Subpestaña «Reglas de licencia»: por país, sus tipos de placa y qué tipo de licencia puede manejar cada uno.
import { CLAVES_LOCALES } from '../../config/constantes.js';
import { h, montar } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { listarConfig, listarPaises, listarReglasLicencia } from '../../api/viaticosApi.js';
import { crearAviso } from '../../components/aviso.js';
import { llenarCombo, opcionesDe } from '../../components/comboAgrupado.js';
import { estadoLista } from './lista.js';
import { paisInicial } from './reglasModelo.js';
import { crearSeccionReglas } from './reglasSeccion.js';
import { crearSeccionTiposPlaca } from './tiposPlaca.js';

// localStorage puede fallar (modo privado, datos bloqueados): recordar el país es solo comodidad.
const leerLocal = () => { try { return localStorage.getItem(CLAVES_LOCALES.PAIS_REGLAS); } catch (e) { return null; } };
const guardarLocal = (id) => { try { localStorage.setItem(CLAVES_LOCALES.PAIS_REGLAS, String(id)); } catch (e) { /* sin persistencia */ } };

export function renderReglasLicencia(contenedor) {
  const datos = { paises: [], tiposPlaca: [], reglas: [], tiposLicencia: [], paisId: null };
  let numeroCarga = 0;
  // Los cambios de subpestaña vacían el panel: si `raiz` ya no está conectada, las respuestas tardías no pintan nada.
  const raiz = h('div', { class: 'vi-reglas-raiz' });
  contenedor.replaceChildren(raiz);

  const tarjeta = (...hijos) => h('section', { class: 'vi-seccion vi-config-seccion', 'aria-label': t('config.reglas.pantalla.titulo') },
    h('div', { class: 'vi-seccion-cabecera' }, h('div', { class: 'vi-config-titulos' },
      h('h2', { text: t('config.reglas.pantalla.titulo') }),
      h('p', { class: 'vi-config-subtitulo', text: t('config.reglas.pantalla.subtitulo') }))),
    hijos);

  const paisActual = () => datos.paises.find(p => Number(p.id) === Number(datos.paisId));
  const contexto = {
    obtener: () => ({ ...datos, paisNombre: (paisActual() || {}).nombre || '' }),
    // Tras cada cambio se vuelven a pedir solo los datos que pueden haber cambiado.
    recargar: async () => {
      try {
        [datos.tiposPlaca, datos.reglas] = await Promise.all([listarConfig('tipos-placa'), listarReglasLicencia()]);
      } catch (error) {
        window.toast?.error(t('config.reglas.errorRecarga'), error.message);
        return;
      }
      if (raiz.isConnected) { placas.pintar(); reglas.pintar(); }
    }
  };
  const placas = crearSeccionTiposPlaca(contexto);
  const reglas = crearSeccionReglas(contexto);

  function pintar() {
    const selector = h('select', { id: 'vi-regla-pais', name: 'paisId', onchange: (e) => cambiarPais(e.target.value) });
    llenarCombo(selector, { grupos: [{ opciones: opcionesDe(datos.paises, p => p.nombre) }], valor: datos.paisId });
    montar(raiz, tarjeta(
      h('div', { class: 'vi-config-nota' }, crearAviso({ tipo: 'info', titulo: t('config.reglas.nota.titulo'), texto: t('config.reglas.nota.texto') })),
      h('div', { class: 'form-field vi-selector-pais' }, h('label', { for: 'vi-regla-pais', text: t('config.reglas.campo.pais') }), selector),
      h('div', { class: 'vi-reglas-secciones' }, placas.raiz, reglas.raiz)));
    placas.pintar();
    reglas.pintar();
  }

  function cambiarPais(valor) {
    datos.paisId = Number(valor);
    guardarLocal(datos.paisId);
    placas.pintar();
    reglas.pintar();
  }

  async function cargar() {
    const numero = ++numeroCarga;
    montar(raiz, tarjeta(estadoLista({ icono: 'sync-outline', spinner: true, texto: t('config.lista.cargando', { seccion: t('config.reglas.pantalla.titulo') }) })));
    try {
      const [paises, tiposPlaca, reglasDatos, tiposLicencia] = await Promise.all([listarPaises(), listarConfig('tipos-placa'), listarReglasLicencia(), listarConfig('tipos-licencia')]);
      if (numero !== numeroCarga || !raiz.isConnected) return;
      Object.assign(datos, { paises, tiposPlaca, reglas: reglasDatos, tiposLicencia });
      datos.paisId = paisInicial(paises, leerLocal());
      if (datos.paisId === null) {
        montar(raiz, tarjeta(estadoLista({ icono: 'earth-outline', titulo: t('config.reglas.sinPaises.titulo'), texto: t('config.reglas.sinPaises.texto') })));
        return;
      }
      pintar();
    } catch (error) {
      if (numero !== numeroCarga || !raiz.isConnected) return;
      montar(raiz, tarjeta(estadoLista({ icono: 'alert-circle-outline', titulo: t('config.lista.error', { seccion: t('config.reglas.pantalla.titulo') }), texto: error.message, error: true, alReintentar: () => cargar() })));
    }
  }

  return cargar();
}
