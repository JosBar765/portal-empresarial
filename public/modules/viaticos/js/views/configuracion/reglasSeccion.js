// Sección «Reglas» de un país dentro de «Reglas de licencia»: qué tipos de placa maneja cada tipo de licencia, con límites opcionales.
import { t } from '../../textos.js';
import { numeroATexto } from '../../utils/numero.js';
import { crearReglaLicencia, editarReglaLicencia, eliminarReglaLicencia } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearCampo } from '../../components/campo.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { llenarCombo, opcionesDe } from '../../components/comboAgrupado.js';
import { h } from '../../utils/dom.js';
import { crearPanelLista, estadoLista } from './lista.js';
import { abrirFormularioConfig } from './modalConfig.js';
import { filtrarFilas } from './modelo.js';
import { htmlFilaRegla } from './reglasFilas.js';
import { armarPayloadRegla, claveRegla, nombreRegla, reglasDe, textoTipoLicencia, textoTipoPlaca, tiposPlacaElegibles, validarRegla } from './reglasModelo.js';

const ID = (nombre) => `vi-regla-${nombre}`;

// `contexto`: { obtener() -> { paisId, paisNombre, reglas, tiposPlaca, tiposLicencia }, recargar() } (el padre es dueño de los datos).
export function crearSeccionReglas(contexto) {
  let busqueda = '';
  let accionEnCurso = false;
  const seccion = t('config.reglas.titulo');
  const panel = crearPanelLista({
    seccion,
    titulo: seccion,
    subtitulo: t('config.reglas.subtitulo'),
    idBase: 'vi-regla',
    encabezados: ['licencia', 'placa', 'tonelaje', 'pasajeros'].map(c => t(`config.reglas.col.${c}`)).concat(t('config.col.acciones')),
    alAgregar: () => abrirAlta(),
    alBuscar: (texto) => { busqueda = texto.trim(); pintar(); },
    alPulsarFila: (evento) => alPulsarFila(evento)
  });

  const reglasDelPais = () => reglasDe(contexto.obtener().reglas, contexto.obtener().paisId);

  function pintar() {
    const reglas = reglasDelPais();
    const { paisNombre } = contexto.obtener();
    if (reglas.length === 0) {
      panel.ponerResumen(null);
      panel.ponerEstado(estadoLista({ icono: 'shield-checkmark-outline', titulo: t('config.reglas.vacio.titulo', { pais: paisNombre }), texto: t('config.reglas.vacio.texto') }));
      return;
    }
    const visibles = filtrarFilas(reglas, busqueda, (r) => [r.tipoLicenciaCodigo, r.tipoLicenciaNombre, r.tipoPlacaCodigo, r.tipoPlacaNombre]);
    panel.ponerResumen(visibles.length);
    if (visibles.length === 0) panel.ponerEstado(estadoLista({ icono: 'search-outline', titulo: t('config.lista.sinResultados.titulo'), texto: t('config.lista.sinResultados.texto', { busqueda }) }));
    else panel.ponerFilas(visibles.map(htmlFilaRegla).join(''));
  }

  const campoLimite = (nombre, valor, entero) => crearCampo({
    etiqueta: t(`config.reglas.campo.${nombre}`), idControl: ID(nombre),
    control: crearCampoNumerico({ id: ID(nombre), name: nombre, valor, entero, placeholder: t(`config.reglas.ph.${nombre}`) })
  });
  const campoLectura = (nombre, valor) => crearCampo({
    etiqueta: t(`config.reglas.campo.${nombre}`), idControl: ID(nombre),
    control: h('input', { type: 'text', id: ID(nombre), name: nombre, value: valor, disabled: true })
  });
  const leer = (form) => ({
    tipoLicenciaId: form.elements.tipoLicenciaId ? form.elements.tipoLicenciaId.value : '',
    tipoPlacaId: form.elements.tipoPlacaId ? form.elements.tipoPlacaId.value : '',
    tonelajeMax: form.elements.tonelajeMax.value,
    pasajerosMax: form.elements.pasajerosMax.value
  });

  function abrirAlta() {
    const { paisId, paisNombre, tiposLicencia, tiposPlaca } = contexto.obtener();
    const licencias = tiposLicencia.filter(tp => tp.activo);
    const placas = tiposPlacaElegibles(tiposPlaca, paisId);
    if (!licencias.length || !placas.length) {
      window.toast?.error(t('config.reglas.alta', { pais: paisNombre }), t(licencias.length ? 'config.reglas.sinPlacas' : 'config.reglas.sinLicencias', { pais: paisNombre }));
      return;
    }
    const selectLicencia = h('select', { id: ID('tipoLicenciaId'), name: 'tipoLicenciaId' });
    llenarCombo(selectLicencia, { placeholder: t('config.reglas.seleccionaLicencia'), grupos: [{ opciones: opcionesDe(licencias, tp => `${tp.codigo} · ${tp.nombre}`) }], valor: '' });
    const selectPlaca = h('select', { id: ID('tipoPlacaId'), name: 'tipoPlacaId' });
    llenarCombo(selectPlaca, { placeholder: t('config.reglas.seleccionaPlaca'), grupos: [{ opciones: opcionesDe(placas, tp => `${tp.codigo} · ${tp.nombre}`) }], valor: '' });
    const ref = abrirFormularioConfig({
      titulo: t('config.reglas.alta', { pais: paisNombre }),
      hijos: [
        crearCampo({ etiqueta: t('config.reglas.campo.tipoLicenciaId'), idControl: ID('tipoLicenciaId'), control: selectLicencia }),
        crearCampo({ etiqueta: t('config.reglas.campo.tipoPlacaId'), idControl: ID('tipoPlacaId'), control: selectPlaca }),
        campoLimite('tonelajeMax', '', false),
        campoLimite('pasajerosMax', '', true),
        h('p', { class: 'form-hint full', text: t('config.reglas.ayudaLimites') })
      ],
      validar: () => validarRegla(leer(ref.form)),
      enviar: () => crearReglaLicencia(armarPayloadRegla({ paisId, ...leer(ref.form) })),
      // La combinación repetida se explica junto al tipo de placa, como en el diseño.
      erroresDeServidor: (error) => (error.status === 409 ? { tipoPlacaId: error.message } : null),
      alGuardar: (regla) => {
        window.toast?.success(t('tab.configuracion'), t('config.reglas.toast.creada', { nombre: nombreRegla(regla) }));
        contexto.recargar();
      }
    });
  }

  function abrirEdicion(regla) {
    const nombre = nombreRegla(regla);
    const ref = abrirFormularioConfig({
      titulo: t('config.reglas.edicion'),
      hijos: [
        campoLectura('tipoLicenciaId', textoTipoLicencia(regla)),
        campoLectura('tipoPlacaId', textoTipoPlaca(regla)),
        campoLimite('tonelajeMax', numeroATexto(regla.tonelajeMax), false),
        campoLimite('pasajerosMax', regla.pasajerosMax ?? '', true),
        h('p', { class: 'form-hint full', text: t('config.reglas.soloLimites') })
      ],
      validar: () => validarRegla(leer(ref.form), { enEdicion: true }),
      enviar: () => editarReglaLicencia(claveRegla(regla), armarPayloadRegla(leer(ref.form), { enEdicion: true })),
      alGuardar: () => {
        window.toast?.success(t('tab.configuracion'), t('config.toast.editado', { nombre }));
        contexto.recargar();
      }
    });
  }

  async function eliminar(regla) {
    const nombre = nombreRegla(regla);
    const confirmado = await confirmarModal({
      title: t('config.reglas.eliminar.titulo'), mensaje: t('config.reglas.eliminar.mensaje', { licencia: textoTipoLicencia(regla), placa: textoTipoPlaca(regla) }),
      aceptar: t('config.reglas.eliminar.aceptar'), peligro: true
    });
    if (!confirmado) return;
    try {
      await eliminarReglaLicencia(claveRegla(regla));
    } catch (error) {
      window.toast?.error(t('config.reglas.eliminar.error'), error.message);
      return;
    }
    window.toast?.success(t('tab.configuracion'), t('config.reglas.toast.eliminada', { nombre }));
    await contexto.recargar();
  }

  async function alPulsarFila(evento) {
    const boton = evento.target.closest('[data-accion]');
    if (!boton || accionEnCurso) return;
    const regla = reglasDelPais().find(r => r.tipoLicenciaId === Number(boton.dataset.licencia) && r.tipoPlacaId === Number(boton.dataset.placa));
    if (!regla) return;
    accionEnCurso = true;
    try {
      if (boton.dataset.accion === 'editar') abrirEdicion(regla);
      else if (boton.dataset.accion === 'eliminar') await eliminar(regla);
    } finally {
      accionEnCurso = false;
    }
  }

  return { raiz: panel.raiz, pintar };
}
