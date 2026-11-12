// Subpestaña «Valores de comidas»: matriz moneda × tipo de comida; una celda vacía es «sin configurar».
import { state } from '../../state.js';
import { h, montar } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { guardarValoresComida, mensajesDeError, obtenerValoresComida } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearAviso } from '../../components/aviso.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { limpiarErrorCampo, marcarErrorCampo } from '../../components/validacion.js';
import { estadoLista } from './lista.js';
import { celdasAGuardar, celdasIniciales, claveCelda, claveDeCampoServidor, hayCambiosEnCeldas, validarCeldas } from './modelo.js';

const nombreMoneda = (m) => t('config.valores.monedaNombre', { nombre: m.nombre, simbolo: m.simbolo });

export function renderValoresComida(contenedor) {
  let matriz = null;
  let iniciales = {};
  let actuales = {};
  let guardando = false;
  let numeroCarga = 0;
  let refs = null;

  const hayCambios = () => hayCambiosEnCeldas(iniciales, actuales);
  const antesDeSalir = (e) => { if (hayCambios()) { e.preventDefault(); e.returnValue = ''; } };

  // La vista le dice al shell (y a la barra lateral) que pida confirmación al salir con valores sin guardar.
  state.salidaVista = {
    confirmar: async () => !hayCambios() || confirmarModal({
      title: t('config.cambios.titulo'), mensaje: t('config.cambios.mensaje'), aceptar: t('config.cambios.salir'), cancelar: t('config.cambios.quedarme'), peligro: true
    }),
    liberar: () => window.removeEventListener('beforeunload', antesDeSalir)
  };
  window.addEventListener('beforeunload', antesDeSalir);

  const tarjeta = (...hijos) => h('section', { class: 'vi-seccion vi-config-seccion', 'aria-label': t('config.valores.titulo') },
    h('div', { class: 'vi-seccion-cabecera' }, h('div', { class: 'vi-config-titulos' }, h('h2', { text: t('config.valores.titulo') }))),
    hijos);

  function actualizarBotones() {
    if (!refs) return;
    const cambios = hayCambios();
    refs.guardar.disabled = !cambios || guardando;
    refs.descartar.disabled = !cambios || guardando;
  }

  function alEscribir(clave, input, valor) {
    actuales[clave] = valor;
    limpiarErrorCampo(input);
    refs.avisos.replaceChildren();
    actualizarBotones();
  }

  function filaMoneda(moneda) {
    const tr = h('tr', { 'data-moneda': String(moneda.id), class: moneda.activo === false ? 'is-inactiva' : null });
    tr.append(h('td', { 'data-label': t('config.valores.col.moneda'), text: nombreMoneda(moneda) + (moneda.activo === false ? ` · ${t('config.valores.inactiva')}` : '') }));
    for (const tipo of matriz.tiposComida) {
      const clave = claveCelda(moneda.id, tipo.id);
      const nombre = t('config.valores.celdaAria', { comida: tipo.nombre, moneda: moneda.nombre });
      const input = crearCampoNumerico({
        id: `vi-cfg-valor-${moneda.id}-${tipo.id}`, name: `valor-${moneda.id}-${tipo.id}`, valor: actuales[clave] ?? '',
        placeholder: t('config.valores.sinConfigurar'), etiquetaAria: nombre, alCambiar: (valor) => alEscribir(clave, input, valor)
      });
      input.dataset.clave = clave;
      tr.append(h('td', { 'data-label': tipo.nombre }, h('div', { class: 'form-field vi-celda-valor' }, input)));
    }
    return tr;
  }

  function pintar() {
    if (matriz.monedas.length === 0 || matriz.tiposComida.length === 0) {
      montar(contenedor, tarjeta(estadoLista({ icono: 'restaurant-outline', titulo: t('config.valores.vacio.titulo'), texto: t('config.valores.vacio.texto') })));
      refs = null;
      return;
    }
    const tabla = h('table', { class: 'buzon-table data-table sticky-header vi-config-tabla vi-matriz' },
      h('thead', null, h('tr', null, h('th', { text: t('config.valores.col.moneda') }), matriz.tiposComida.map(tipo => h('th', { text: tipo.nombre })))),
      h('tbody', null, matriz.monedas.map(filaMoneda)));
    const avisos = h('div', { class: 'vi-avisos', 'aria-live': 'polite' });
    const descartar = h('button', { class: 'btn btn--ghost', id: 'vi-cfg-descartar', type: 'button', text: t('config.valores.descartar'), onclick: descartarCambios });
    const guardar = h('button', { class: 'btn btn--primary', id: 'vi-cfg-guardar-valores', type: 'button', text: t('config.valores.guardar'), onclick: guardarMatriz });
    refs = { guardar, descartar, avisos, tabla };
    montar(contenedor, tarjeta(
      h('div', { class: 'vi-config-nota' }, crearAviso({ tipo: 'info', titulo: t('config.valores.nota.titulo'), texto: t('config.valores.nota.texto') })),
      avisos,
      h('div', { class: 'tabla-wrapper', tabindex: '0', role: 'region', 'aria-label': t('config.valores.tablaAria') }, tabla),
      h('p', { class: 'vi-config-leyenda', text: t('config.valores.leyenda') }),
      h('div', { class: 'vi-config-pie' }, descartar, guardar)));
    actualizarBotones();
  }

  function descartarCambios() {
    actuales = { ...iniciales };
    refs.tabla.querySelectorAll('input[data-clave]').forEach(input => { input.value = actuales[input.dataset.clave] ?? ''; limpiarErrorCampo(input); });
    refs.avisos.replaceChildren();
    actualizarBotones();
  }

  const inputDeClave = (clave) => refs.tabla.querySelector(`input[data-clave="${clave}"]`);
  const nombreDeCelda = (moneda, tipo) => t('config.valores.celdaNombre', { comida: tipo.nombre, moneda: moneda.nombre });

  function marcarCeldas(errores) {
    const sueltos = [];
    let primero = null;
    for (const [clave, mensaje] of errores) {
      const input = clave ? inputDeClave(clave) : null;
      if (input) { marcarErrorCampo(input, mensaje); primero = primero || input; } else sueltos.push(mensaje);
    }
    refs.avisos.replaceChildren(...sueltos.map(texto => crearAviso({ tipo: 'error', titulo: t('config.valores.errorGuardar'), texto })));
    if (primero) primero.focus();
  }

  async function guardarMatriz() {
    if (guardando || !hayCambios()) return;
    refs.tabla.querySelectorAll('input[data-clave]').forEach(limpiarErrorCampo);
    refs.avisos.replaceChildren();
    const errores = Object.entries(validarCeldas(matriz, actuales, nombreDeCelda));
    if (errores.length) {
      marcarCeldas(errores);
      return;
    }
    const enviadas = celdasAGuardar(matriz, actuales);
    guardando = true;
    actualizarBotones();
    try {
      const respuesta = await guardarValoresComida(enviadas);
      if (!contenedor.isConnected) return;
      if (respuesta && Array.isArray(respuesta.monedas) && Array.isArray(respuesta.tiposComida)) aplicar(respuesta);
      else await cargar({ conEstado: false });
      window.toast?.success(t('tab.configuracion'), t('config.valores.exito'));
    } catch (error) {
      if (!contenedor.isConnected) return;
      if (error.campos && typeof error.campos === 'object' && Object.keys(error.campos).length) {
        // Los errores indexan la lista enviada (solo celdas con valor): se llevan a su celda.
        marcarCeldas(Object.entries(error.campos).map(([campo, mensaje]) => [claveDeCampoServidor(campo, enviadas), String(mensaje)]));
      } else {
        refs.avisos.replaceChildren(crearAviso({ tipo: 'error', titulo: t('config.valores.errorGuardar'), texto: mensajesDeError(error).join(' ') }));
      }
    } finally {
      guardando = false;
      actualizarBotones();
    }
  }

  function aplicar(datos) {
    matriz = datos;
    iniciales = celdasIniciales(datos);
    actuales = { ...iniciales };
    pintar();
  }

  async function cargar({ conEstado = true } = {}) {
    const numero = ++numeroCarga;
    if (conEstado) montar(contenedor, tarjeta(estadoLista({ icono: 'sync-outline', spinner: true, texto: t('config.valores.cargando') })));
    try {
      const datos = await obtenerValoresComida();
      if (numero !== numeroCarga || !contenedor.isConnected) return;
      aplicar(datos);
    } catch (error) {
      if (numero !== numeroCarga || !contenedor.isConnected) return;
      matriz = null;
      refs = null;
      montar(contenedor, tarjeta(estadoLista({ icono: 'alert-circle-outline', titulo: t('config.valores.error'), texto: error.message, error: true, alReintentar: () => cargar() })));
    }
  }

  return cargar();
}
