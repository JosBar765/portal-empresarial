// Modal «Editar persona»: países (chips) y licencia de conducir, que se guardan juntos.
import { h } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { parseIsoLocal } from '../../utils/fechas.js';
import { guardarPersona } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { crearCampo } from '../../components/campo.js';
import { crearCampoFecha } from '../../components/campoFecha.js';
import { crearChipsSeleccion } from '../../components/chipsSeleccion.js';
import { llenarCombo } from '../../components/comboAgrupado.js';
import { wireCampoFecha } from '../../components/datepicker.js';
import { limpiarErrorCampo } from '../../components/validacion.js';
import { abrirFormularioConfig } from './modalConfig.js';
import { armarPayloadPersona, armarPayloadQuitarLicencia, validarPersona } from './personasModelo.js';

const ID = (nombre) => `vi-per-${nombre}`;

// `tiposLicencia` son los activos; el de la persona se agrega aunque se haya desactivado para no perderlo al guardar.
function opcionesDeTipos(tiposLicencia, licencia) {
  const lista = tiposLicencia.map(tp => ({ valor: tp.id, texto: `${tp.codigo} · ${tp.nombre}` }));
  if (licencia && !tiposLicencia.some(tp => tp.id === licencia.tipoLicenciaId)) {
    lista.push({ valor: licencia.tipoLicenciaId, texto: `${licencia.tipoLicenciaCodigo} · ${licencia.tipoLicenciaNombre}` });
  }
  return lista;
}

export function abrirEdicionPersona({ persona, paises, tiposLicencia, alGuardar }) {
  const licencia = persona.licencia;
  const aviso = h('p', { class: 'form-hint', id: ID('paises-aviso'), 'aria-live': 'polite' });
  const chips = crearChipsSeleccion({
    id: ID('paises'), nombreCampo: 'paisIds', etiquetaId: ID('paises-etiqueta'), opciones: paises,
    seleccion: (persona.paises || []).map(p => p.id),
    alCambiar: () => { limpiarErrorCampo(chips.nodo); pintarAviso(); }
  });
  const pintarAviso = () => { aviso.textContent = t(chips.valores().length ? 'config.personas.paises.ayuda' : 'config.personas.paises.aviso'); };
  pintarAviso();

  const select = h('select', { id: ID('tipo'), name: 'licencia.tipoLicenciaId', 'data-campo': 'licencia' });
  llenarCombo(select, { placeholder: t('config.personas.seleccionaTipo'), grupos: [{ opciones: opcionesDeTipos(tiposLicencia, licencia) }], valor: licencia ? licencia.tipoLicenciaId : '' });
  const numero = h('input', {
    type: 'text', id: ID('numero'), name: 'licencia.numero', autocomplete: 'off',
    placeholder: t('config.personas.ph.numero'), value: licencia ? licencia.numero : ''
  });

  const botonQuitar = licencia
    ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm vi-quitar-licencia', id: ID('quitar'), text: t('config.personas.quitar'), onclick: () => quitarLicencia() })
    : null;

  const leer = (form) => ({
    tipoLicenciaId: form.querySelector('[name="licencia.tipoLicenciaId"]').value,
    numero: form.querySelector('[name="licencia.numero"]').value,
    venceEl: form.querySelector('[name="licencia.venceEl"]').value,
    paisIds: chips.valores()
  });

  const ref = abrirFormularioConfig({
    titulo: t('config.personas.edicion', { nombre: persona.nombre }),
    hijos: [
      h('div', { class: 'form-field full' },
        h('span', { class: 'vi-etiqueta-campo', id: ID('paises-etiqueta'), text: t('config.personas.campo.paises') }),
        paises.length ? chips.nodo : h('p', { class: 'form-hint', text: t('config.personas.sinPaisesCatalogo') }),
        aviso),
      h('h4', { class: 'vi-form-subtitulo full', text: t('config.personas.licencia.titulo') }),
      crearCampo({ etiqueta: t('config.personas.campo.tipoLicenciaId'), control: select, idControl: ID('tipo') }),
      crearCampo({ etiqueta: t('config.personas.campo.numero'), control: numero, idControl: ID('numero') }),
      crearCampoFecha({ id: ID('vence'), name: 'licencia.venceEl', etiqueta: t('config.personas.campo.venceEl') }),
      h('p', { class: 'form-hint full', text: t('config.personas.licencia.ayuda') }),
      botonQuitar && h('div', { class: 'full' }, botonQuitar)
    ],
    validar: () => validarPersona(leer(ref.form)),
    enviar: () => guardarPersona(persona.id, armarPayloadPersona(leer(ref.form))),
    alGuardar: () => {
      window.toast?.success(t('tab.configuracion'), t('config.toast.editado', { nombre: persona.nombre }));
      alGuardar();
    }
  });

  // Sin mínimo: una licencia ya vencida también se registra.
  const fecha = wireCampoFecha(ref.overlay, 'licencia.venceEl');
  if (licencia && licencia.venceEl) fecha.setDate(parseIsoLocal(licencia.venceEl), { silent: true });

  async function quitarLicencia() {
    const confirmado = await confirmarModal({
      title: t('config.personas.quitar.titulo'), mensaje: t('config.personas.quitar.mensaje', { nombre: persona.nombre }),
      aceptar: t('config.personas.quitar'), peligro: true
    });
    if (!confirmado) return;
    botonQuitar.disabled = true;
    try {
      await guardarPersona(persona.id, armarPayloadQuitarLicencia(persona));
    } catch (error) {
      botonQuitar.disabled = false;
      window.toast?.error(t('config.personas.quitar.error'), error.message);
      return;
    }
    ref.cerrar();
    window.toast?.success(t('tab.configuracion'), t('config.personas.quitar.exito', { nombre: persona.nombre }));
    alGuardar();
  }

  return ref;
}
