// Motor genérico de los catálogos simples de Configuración: lista, búsqueda local, alta, edición y activar o desactivar.
// Todo lo propio de cada catálogo sale de su definición (definiciones.js).
import { h } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { cambiarActivoConfig, crearConfig, editarConfig, listarConfig, listarPaises } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearCampo } from '../../components/campo.js';
import { htmlFilaCatalogo, tieneDetalle } from './filas.js';
import { crearPanelLista, estadoLista } from './lista.js';
import { abrirFormularioConfig } from './modalConfig.js';
import { armarPayloadCatalogo, camposDe, esProtegido, etiquetaCampo, filtrarFilas, validarCamposCatalogo } from './modelo.js';

const nombreDe = (fila) => fila.nombre ?? fila.codigo ?? '';

export function renderCatalogo(contenedor, definicion) {
  const seccion = t(`${definicion.texto}.titulo`);
  let filas = [];
  let busqueda = '';
  let paises = null;
  let numeroCarga = 0;
  let accionEnCurso = false;

  const encabezados = [
    ...definicion.columnas.map(c => t(c.etiqueta || `config.campo.${c.campo}`)),
    ...(tieneDetalle(definicion) ? [t('config.col.detalle')] : []),
    t('config.col.estado'), t('config.col.acciones')
  ];
  const panel = crearPanelLista({
    seccion,
    titulo: seccion,
    subtitulo: t(`${definicion.texto}.subtitulo`),
    encabezados,
    alAgregar: () => abrirFormulario(null),
    alBuscar: (texto) => { busqueda = texto.trim(); pintar(); },
    alPulsarFila: (evento) => alPulsarFila(evento)
  });
  contenedor.replaceChildren(panel.raiz);

  function pintar() {
    const visibles = filtrarFilas(filas, busqueda, (fila) => definicion.busca.map(c => fila[c]));
    panel.ponerResumen(visibles.length);
    if (filas.length === 0) {
      panel.ponerEstado(estadoLista({ icono: 'document-outline', titulo: t(`${definicion.texto}.vacio.titulo`), texto: t(`${definicion.texto}.vacio.texto`) }));
      panel.ponerResumen(null);
    } else if (visibles.length === 0) {
      panel.ponerEstado(estadoLista({ icono: 'search-outline', titulo: t('config.lista.sinResultados.titulo'), texto: t('config.lista.sinResultados.texto', { busqueda }) }));
    } else {
      panel.ponerFilas(visibles.map(fila => htmlFilaCatalogo(definicion, fila)).join(''));
    }
  }

  async function cargar({ conEstado = true } = {}) {
    const numero = ++numeroCarga;
    if (conEstado) {
      panel.ponerEstado(estadoLista({ icono: 'sync-outline', spinner: true, texto: t('config.lista.cargando', { seccion }) }));
      panel.ponerResumen(null);
    }
    try {
      const datos = await listarConfig(definicion.recurso);
      // Una respuesta tardía no pisa a otra más reciente ni a una sección ya cerrada.
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

  // ---------- Formulario de alta y edición ----------

  const idCampo = (campo) => `vi-cfg-${definicion.recurso}-${campo.nombre}`;

  function controlDeCampo(campo, fila) {
    const enEdicion = Boolean(fila);
    if (campo.tipo === 'pais') {
      const select = h('select', { id: idCampo(campo), name: campo.nombre },
        h('option', { value: '', text: t('config.form.seleccionaPais') }),
        paises.map(p => h('option', { value: String(p.id), text: p.nombre })));
      return select;
    }
    return h('input', {
      type: 'text', id: idCampo(campo), name: campo.nombre, autocomplete: 'off', value: enEdicion ? (fila[campo.nombre] ?? '') : '',
      placeholder: campo.placeholder ? t(campo.placeholder) : null
    });
  }

  function camposDelFormulario(fila) {
    const enEdicion = Boolean(fila);
    const nodos = [];
    // En la edición, los campos que no cambian (el país) se ven de solo lectura con su nota.
    for (const campo of definicion.campos) {
      const bloqueado = enEdicion && (campo.soloAlta || (campo.nombre === 'nombre' && esProtegido(definicion, fila)));
      let control;
      if (bloqueado) {
        const valor = campo.tipo === 'pais' ? fila.paisNombre : fila[campo.nombre];
        control = h('input', { type: 'text', id: idCampo(campo), name: campo.nombre, value: valor ?? '', disabled: true });
      } else {
        control = controlDeCampo(campo, fila);
      }
      const nota = bloqueado ? t(campo.soloAlta ? 'config.form.noEditable' : 'config.protegido.campo') : null;
      const campoNodo = crearCampo({ etiqueta: etiquetaCampo(campo), control, idControl: idCampo(campo), clase: 'full' });
      if (nota) campoNodo.append(h('span', { class: 'form-hint', text: nota }));
      nodos.push(campoNodo);
    }
    return nodos;
  }

  async function abrirFormulario(fila) {
    const enEdicion = Boolean(fila);
    if (!enEdicion && definicion.campos.some(c => c.tipo === 'pais') && !paises) {
      try {
        paises = await listarPaises();
      } catch (error) {
        window.toast?.error(t('config.toast.errorPaises'), error.message);
        return;
      }
    }
    const hijos = camposDelFormulario(fila);
    const leer = (form) => Object.fromEntries(camposDe(definicion, enEdicion).map(c => [c.nombre, form.elements[c.nombre] ? form.elements[c.nombre].value : '']));
    const ref = abrirFormularioConfig({
      titulo: t(`${definicion.texto}.${enEdicion ? 'edicion' : 'alta'}`),
      hijos,
      validar: () => validarCamposCatalogo(definicion, leer(ref.form), { enEdicion, fila }),
      enviar: () => {
        const payload = armarPayloadCatalogo(definicion, leer(ref.form), { enEdicion });
        return enEdicion ? editarConfig(definicion.recurso, fila.id, payload) : crearConfig(definicion.recurso, payload);
      },
      alGuardar: (guardada) => {
        window.toast?.success(t('tab.configuracion'), t(enEdicion ? 'config.toast.editado' : 'config.toast.creado', { nombre: nombreDe(guardada || fila || {}) }));
        cargar();
      }
    });
  }

  // ---------- Activar o desactivar ----------

  async function alternar(fila) {
    const activar = !fila.activo;
    const nombre = nombreDe(fila);
    const confirmado = await confirmarModal({
      title: t(activar ? 'config.confirmar.activar.titulo' : 'config.confirmar.desactivar.titulo'),
      mensaje: t(activar ? 'config.confirmar.activar.mensaje' : 'config.confirmar.desactivar.mensaje', { nombre }),
      aceptar: t(activar ? 'config.accion.activar' : 'config.accion.desactivar'),
      peligro: !activar
    });
    if (!confirmado) return;
    try {
      await cambiarActivoConfig(definicion.recurso, fila.id, activar);
    } catch (error) {
      window.toast?.error(t('config.toast.errorEstado'), error.message);
      return;
    }
    window.toast?.success(t('tab.configuracion'), t(activar ? 'config.toast.activado' : 'config.toast.desactivado', { nombre }));
    await cargar({ conEstado: false });
  }

  // Delegación en el tbody: las filas se repintan en cada carga y sus botones no llevan listeners propios.
  async function alPulsarFila(evento) {
    const boton = evento.target.closest('[data-accion]');
    if (!boton || accionEnCurso) return;
    const fila = filas.find(f => Number(f.id) === Number(boton.dataset.id));
    if (!fila) return;
    accionEnCurso = true;
    try {
      if (boton.dataset.accion === 'editar') await abrirFormulario(fila);
      else if (boton.dataset.accion === 'alternar') await alternar(fila);
    } finally {
      accionEnCurso = false;
    }
  }

  return cargar();
}
