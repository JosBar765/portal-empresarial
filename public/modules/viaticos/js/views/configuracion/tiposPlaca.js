// Sección «Tipos de placa» de un país dentro de «Reglas de licencia»: alta con el país fijo, edición y activar o desactivar.
import { h } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { cambiarActivoConfig, crearConfig, editarConfig } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearCampo } from '../../components/campo.js';
import { DEFINICIONES } from './definiciones.js';
import { htmlFilaCatalogo } from './filas.js';
import { crearPanelLista, estadoLista } from './lista.js';
import { abrirFormularioConfig } from './modalConfig.js';
import { armarPayloadCatalogo, camposDe, etiquetaCampo, filtrarFilas, validarCamposCatalogo } from './modelo.js';
import { tiposPlacaDe } from './reglasModelo.js';

const DEFINICION = DEFINICIONES['tipos-placa'];
const idCampo = (campo) => `vi-placa-${campo.nombre}`;

// `contexto`: { obtener() -> { paisId, paisNombre, tiposPlaca }, recargar() } (el padre es dueño de los datos).
export function crearSeccionTiposPlaca(contexto) {
  let busqueda = '';
  let accionEnCurso = false;
  const seccion = t('config.tipos-placa.titulo');
  const panel = crearPanelLista({
    seccion,
    titulo: seccion,
    subtitulo: t('config.tipos-placa.subtitulo'),
    idBase: 'vi-placa',
    encabezados: [t('config.campo.codigo'), t('config.campo.nombre'), t('config.col.estado'), t('config.col.acciones')],
    alAgregar: () => abrirFormulario(null),
    alBuscar: (texto) => { busqueda = texto.trim(); pintar(); },
    alPulsarFila: (evento) => alPulsarFila(evento)
  });

  const filasDelPais = () => tiposPlacaDe(contexto.obtener().tiposPlaca, contexto.obtener().paisId);

  function pintar() {
    const filas = filasDelPais();
    const { paisNombre } = contexto.obtener();
    if (filas.length === 0) {
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'document-outline', titulo: t('config.tipos-placa.vacio.titulo', { pais: paisNombre }), texto: t('config.tipos-placa.vacio.texto') }));
      return;
    }
    const visibles = filtrarFilas(filas, busqueda, (f) => DEFINICION.busca.map(c => f[c]));
    panel.ponerResumen(visibles.length);
    if (visibles.length === 0) panel.ponerEstado(estadoLista({ icono: 'search-outline', titulo: t('config.lista.sinResultados.titulo'), texto: t('config.lista.sinResultados.texto', { busqueda }) }));
    else panel.ponerFilas(visibles.map(f => htmlFilaCatalogo(DEFINICION, f)).join(''));
  }

  function abrirFormulario(fila) {
    const enEdicion = Boolean(fila);
    const { paisId, paisNombre } = contexto.obtener();
    const campos = camposDe(DEFINICION, enEdicion).map(campo => crearCampo({
      etiqueta: etiquetaCampo(campo), idControl: idCampo(campo), clase: 'full',
      control: h('input', { type: 'text', id: idCampo(campo), name: campo.nombre, autocomplete: 'off', value: enEdicion ? (fila[campo.nombre] ?? '') : '', placeholder: campo.placeholder ? t(campo.placeholder) : null })
    }));
    // El país no cambia: se muestra de solo lectura para que quede claro a cuál país pertenece el tipo.
    const pais = crearCampo({
      etiqueta: t('config.campo.paisId'), idControl: 'vi-placa-pais', clase: 'full',
      control: h('input', { type: 'text', id: 'vi-placa-pais', name: 'paisNombre', 'data-campo': 'paisId', value: paisNombre, disabled: true })
    });
    const leer = (form) => Object.fromEntries(camposDe(DEFINICION, enEdicion).map(c => [c.nombre, form.elements[c.nombre].value]));
    const ref = abrirFormularioConfig({
      titulo: t(`config.tipos-placa.${enEdicion ? 'edicion' : 'alta'}`, { pais: paisNombre }),
      hijos: [pais, ...campos, h('p', { class: 'form-hint full', text: t('config.tipos-placa.ayudaPais') })],
      validar: () => validarCamposCatalogo(DEFINICION, leer(ref.form), { enEdicion }),
      enviar: () => {
        const payload = armarPayloadCatalogo(DEFINICION, leer(ref.form), { enEdicion });
        return enEdicion ? editarConfig('tipos-placa', fila.id, payload) : crearConfig('tipos-placa', { paisId, ...payload });
      },
      // El código repetido en el país se explica junto a su campo.
      erroresDeServidor: (error) => (error.status === 409 ? { codigo: error.message } : null),
      alGuardar: (guardada) => {
        window.toast?.success(t('tab.configuracion'), t(enEdicion ? 'config.toast.editado' : 'config.toast.creado', { nombre: (guardada || fila || {}).nombre || '' }));
        contexto.recargar();
      }
    });
  }

  async function alternar(fila) {
    const activar = !fila.activo;
    const confirmado = await confirmarModal({
      title: t(activar ? 'config.confirmar.activar.titulo' : 'config.confirmar.desactivar.titulo'),
      mensaje: t(activar ? 'config.confirmar.activar.mensaje' : 'config.confirmar.desactivar.mensaje', { nombre: fila.nombre }),
      aceptar: t(activar ? 'config.accion.activar' : 'config.accion.desactivar'),
      peligro: !activar
    });
    if (!confirmado) return;
    try {
      await cambiarActivoConfig('tipos-placa', fila.id, activar);
    } catch (error) {
      window.toast?.error(t('config.toast.errorEstado'), error.message);
      return;
    }
    window.toast?.success(t('tab.configuracion'), t(activar ? 'config.toast.activado' : 'config.toast.desactivado', { nombre: fila.nombre }));
    await contexto.recargar();
  }

  async function alPulsarFila(evento) {
    const boton = evento.target.closest('[data-accion]');
    if (!boton || accionEnCurso) return;
    const fila = filasDelPais().find(f => Number(f.id) === Number(boton.dataset.id));
    if (!fila) return;
    accionEnCurso = true;
    try {
      if (boton.dataset.accion === 'editar') abrirFormulario(fila);
      else if (boton.dataset.accion === 'alternar') await alternar(fila);
    } finally {
      accionEnCurso = false;
    }
  }

  return { raiz: panel.raiz, pintar };
}
