// Modal de alta y edición de un piloto (repartidor de la empresa, no es usuario del portal).
import { h } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { parseIsoLocal } from '../../utils/fechas.js';
import { crearConfig, editarConfig } from '../../api/viaticosApi.js';
import { crearCampo } from '../../components/campo.js';
import { crearCampoFecha } from '../../components/campoFecha.js';
import { llenarCombo } from '../../components/comboAgrupado.js';
import { wireCampoFecha } from '../../components/datepicker.js';
import { abrirFormularioConfig } from './modalConfig.js';
import { LIMITES_PILOTO, armarPayloadPiloto, validarPiloto } from './pilotosModelo.js';

const ID = (nombre) => `vi-pil-${nombre}`;
const CAMPOS = ['nombre', 'tipoLicenciaId', 'numero', 'venceEl'];

const campo = (nombre, control, clase = '') => crearCampo({ etiqueta: t(`config.pilotos.campo.${nombre}`), control, idControl: ID(nombre), clase });

// `tiposLicencia` son los activos; el del piloto se agrega aunque se haya desactivado para no perderlo al guardar.
function opcionesDeTipos(tiposLicencia, piloto) {
  const lista = tiposLicencia.map(tp => ({ valor: tp.id, texto: `${tp.codigo} · ${tp.nombre}` }));
  if (piloto && !tiposLicencia.some(tp => tp.id === piloto.tipoLicenciaId)) {
    lista.push({ valor: piloto.tipoLicenciaId, texto: `${piloto.tipoLicenciaCodigo} · ${piloto.tipoLicenciaNombre}` });
  }
  return lista;
}

// `piloto` es null en el alta.
export function abrirFormularioPiloto({ piloto, tiposLicencia, alGuardar }) {
  const enEdicion = Boolean(piloto);
  const p = piloto || {};

  const nombre = h('input', { type: 'text', id: ID('nombre'), name: 'nombre', autocomplete: 'off', maxlength: LIMITES_PILOTO.NOMBRE, value: p.nombre ?? '', placeholder: t('config.pilotos.ph.nombre') });
  const select = h('select', { id: ID('tipoLicenciaId'), name: 'tipoLicenciaId' });
  llenarCombo(select, { placeholder: t('config.pilotos.seleccionaTipo'), grupos: [{ opciones: opcionesDeTipos(tiposLicencia, piloto) }], valor: p.tipoLicenciaId ?? '' });
  const numero = h('input', { type: 'text', id: ID('numero'), name: 'numero', autocomplete: 'off', maxlength: LIMITES_PILOTO.NUMERO, value: p.numero ?? '', placeholder: t('config.pilotos.ph.numero') });

  const leer = (form) => Object.fromEntries(CAMPOS.map(nombreCampo => {
    const control = form.querySelector(`[name="${nombreCampo}"]`);
    return [nombreCampo, control ? control.value : ''];
  }));

  const ref = abrirFormularioConfig({
    titulo: t(enEdicion ? 'config.pilotos.edicion' : 'config.pilotos.alta'),
    hijos: [
      campo('nombre', nombre, 'full'),
      // Filas completas: el texto largo del tipo de licencia ensanchaba el formulario y cortaba la columna derecha; el nombre también necesita espacio.
      campo('tipoLicenciaId', select, 'full'),
      campo('numero', numero),
      crearCampoFecha({ id: ID('venceEl'), name: 'venceEl', etiqueta: t('config.pilotos.campo.venceEl') }),
      h('p', { class: 'form-hint full', text: t('config.pilotos.ayudaForm') })
    ],
    validar: () => validarPiloto(leer(ref.form)),
    enviar: () => {
      const payload = armarPayloadPiloto(leer(ref.form));
      return enEdicion ? editarConfig('pilotos', p.id, payload) : crearConfig('pilotos', payload);
    },
    alGuardar: (guardado) => {
      window.toast?.success(t('tab.configuracion'), t(enEdicion ? 'config.toast.editado' : 'config.toast.creado', { nombre: (guardado && guardado.nombre) || p.nombre }));
      alGuardar();
    }
  });

  // Sin mínimo: una licencia ya vencida también se registra (la solicitud la rechazará con su explicación).
  const fecha = wireCampoFecha(ref.overlay, 'venceEl');
  if (p.venceEl) fecha.setDate(parseIsoLocal(p.venceEl), { silent: true });
  return ref;
}
