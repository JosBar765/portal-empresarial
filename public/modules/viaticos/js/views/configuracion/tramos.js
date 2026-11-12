// Subpestaña «Tramos»: distancia y horas entre dos ubicaciones; un tramo vale en ambos sentidos.
import { h } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { cambiarActivoConfig, crearConfig, editarConfig, listarConfig } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearCampo } from '../../components/campo.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { htmlFilaTramo, nombreDeTramo } from './filas.js';
import { crearPanelLista, estadoLista } from './lista.js';
import { abrirFormularioConfig } from './modalConfig.js';
import { armarPayloadTramo, filtrarFilas, formatearMedida, validarTramo } from './modelo.js';

export function renderTramos(contenedor) {
  const seccion = t('config.tramos.titulo');
  let filas = [];
  let busqueda = '';
  let numeroCarga = 0;
  let accionEnCurso = false;

  const panel = crearPanelLista({
    seccion,
    titulo: seccion,
    subtitulo: t('config.tramos.subtitulo'),
    nota: { titulo: t('config.tramos.nota.titulo'), texto: t('config.tramos.nota.texto') },
    encabezados: [t('config.tramos.col.origen'), t('config.tramos.col.destino'), t('config.tramos.col.km'), t('config.tramos.col.horas'), t('config.col.estado'), t('config.col.acciones')],
    alAgregar: () => abrirAlta(),
    alBuscar: (texto) => { busqueda = texto.trim(); pintar(); },
    alPulsarFila: (evento) => alPulsarFila(evento)
  });
  contenedor.replaceChildren(panel.raiz);

  function pintar() {
    const visibles = filtrarFilas(filas, busqueda, (f) => [f.ubicacionANombre, f.ubicacionBNombre]);
    if (filas.length === 0) {
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'git-compare-outline', titulo: t('config.tramos.vacio.titulo'), texto: t('config.tramos.vacio.texto') }));
      return;
    }
    panel.ponerResumen(visibles.length);
    if (visibles.length === 0) panel.ponerEstado(estadoLista({ icono: 'search-outline', titulo: t('config.lista.sinResultados.titulo'), texto: t('config.lista.sinResultados.texto', { busqueda }) }));
    else panel.ponerFilas(visibles.map(htmlFilaTramo).join(''));
  }

  async function cargar({ conEstado = true } = {}) {
    const numero = ++numeroCarga;
    if (conEstado) {
      panel.ponerEstado(estadoLista({ icono: 'sync-outline', spinner: true, texto: t('config.lista.cargando', { seccion }) }));
      panel.ponerResumen(null);
    }
    try {
      const datos = await listarConfig('tramos');
      if (numero !== numeroCarga || !panel.tbody.isConnected) return;
      filas = Array.isArray(datos) ? datos : [];
      pintar();
    } catch (error) {
      if (numero !== numeroCarga || !panel.tbody.isConnected) return;
      filas = [];
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'alert-circle-outline', titulo: t('config.lista.error', { seccion }), texto: error.message, error: true, alReintentar: () => cargar() }));
    }
  }

  // ---------- Formulario ----------

  const campoMedida = (nombre, valor) => crearCampo({
    etiqueta: t(`config.tramos.campo.${nombre}`),
    idControl: `vi-cfg-tramo-${nombre}`,
    control: crearCampoNumerico({ id: `vi-cfg-tramo-${nombre}`, name: nombre, valor, placeholder: t(`config.tramos.ph.${nombre}`) })
  });

  const comboUbicaciones = (nombre, ubicaciones, textoVacio) => h('select', { id: `vi-cfg-tramo-${nombre}`, name: nombre },
    h('option', { value: '', text: textoVacio }),
    ubicaciones.map(u => h('option', { value: String(u.id), text: `${u.nombre} (${u.paisNombre})` })));

  const campoLectura = (nombre, valor) => crearCampo({
    etiqueta: t(`config.tramos.campo.${nombre}`),
    idControl: `vi-cfg-tramo-${nombre}`,
    control: h('input', { type: 'text', id: `vi-cfg-tramo-${nombre}`, name: nombre, value: valor, disabled: true })
  });

  async function abrirAlta() {
    let ubicaciones;
    try {
      ubicaciones = (await listarConfig('ubicaciones')).filter(u => u.activo);
    } catch (error) {
      window.toast?.error(t('config.toast.errorUbicaciones'), error.message);
      return;
    }
    if (ubicaciones.length < 2) {
      window.toast?.error(t('config.tramos.alta'), t('config.tramos.sinUbicaciones'));
      return;
    }
    const nombreDe = (id) => (ubicaciones.find(u => u.id === id) || {}).nombre || '';
    const leer = (form) => ({ origenId: form.elements.origenId.value, destinoId: form.elements.destinoId.value, km: form.elements.km.value, horas: form.elements.horas.value });
    const ref = abrirFormularioConfig({
      titulo: t('config.tramos.alta'),
      hijos: [
        crearCampo({ etiqueta: t('config.tramos.campo.origenId'), idControl: 'vi-cfg-tramo-origenId', control: comboUbicaciones('origenId', ubicaciones, t('config.tramos.seleccionaOrigen')) }),
        crearCampo({ etiqueta: t('config.tramos.campo.destinoId'), idControl: 'vi-cfg-tramo-destinoId', control: comboUbicaciones('destinoId', ubicaciones, t('config.tramos.seleccionaDestino')) }),
        campoMedida('km', ''),
        campoMedida('horas', ''),
        h('p', { class: 'form-hint full', text: t('config.tramos.ayudaAmbos') })
      ],
      validar: () => validarTramo(leer(ref.form), { nombreDe }),
      enviar: () => crearConfig('tramos', armarPayloadTramo(leer(ref.form))),
      // El duplicado se explica junto al destino, como en el diseño; el servidor dice entre qué ubicaciones.
      erroresDeServidor: (error) => (error.status === 409 ? { destinoId: error.message } : null),
      alGuardar: (tramo) => {
        window.toast?.success(t('tab.configuracion'), t('config.toast.creado', { nombre: nombreDeTramo(tramo) }));
        cargar();
      }
    });
  }

  function abrirEdicion(tramo) {
    const leer = (form) => ({ km: form.elements.km.value, horas: form.elements.horas.value });
    const ref = abrirFormularioConfig({
      titulo: t('config.tramos.edicion'),
      hijos: [
        campoLectura('origenId', tramo.ubicacionANombre),
        campoLectura('destinoId', tramo.ubicacionBNombre),
        campoMedida('km', formatearMedida(tramo.km)),
        campoMedida('horas', formatearMedida(tramo.horas)),
        h('p', { class: 'form-hint full', text: t('config.tramos.soloLectura') })
      ],
      validar: () => validarTramo(leer(ref.form), { enEdicion: true }),
      enviar: () => editarConfig('tramos', tramo.id, armarPayloadTramo(leer(ref.form), { enEdicion: true })),
      alGuardar: () => {
        window.toast?.success(t('tab.configuracion'), t('config.toast.editado', { nombre: nombreDeTramo(tramo) }));
        cargar();
      }
    });
  }

  // ---------- Activar o desactivar ----------

  async function alternar(tramo) {
    const activar = !tramo.activo;
    const nombre = nombreDeTramo(tramo);
    const confirmado = await confirmarModal({
      title: t(activar ? 'config.confirmar.activar.titulo' : 'config.confirmar.desactivar.titulo'),
      mensaje: t(activar ? 'config.confirmar.activar.mensaje' : 'config.confirmar.desactivar.mensaje', { nombre }),
      aceptar: t(activar ? 'config.accion.activar' : 'config.accion.desactivar'),
      peligro: !activar
    });
    if (!confirmado) return;
    try {
      await cambiarActivoConfig('tramos', tramo.id, activar);
    } catch (error) {
      window.toast?.error(t('config.toast.errorEstado'), error.message);
      return;
    }
    window.toast?.success(t('tab.configuracion'), t(activar ? 'config.toast.activado' : 'config.toast.desactivado', { nombre }));
    await cargar({ conEstado: false });
  }

  async function alPulsarFila(evento) {
    const boton = evento.target.closest('[data-accion]');
    if (!boton || accionEnCurso) return;
    const tramo = filas.find(f => Number(f.id) === Number(boton.dataset.id));
    if (!tramo) return;
    accionEnCurso = true;
    try {
      if (boton.dataset.accion === 'editar') abrirEdicion(tramo);
      else if (boton.dataset.accion === 'alternar') await alternar(tramo);
    } finally {
      accionEnCurso = false;
    }
  }

  return cargar();
}
