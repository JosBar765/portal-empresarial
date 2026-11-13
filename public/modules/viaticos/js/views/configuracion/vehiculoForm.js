// Modal de alta y edición de un vehículo (de la empresa o propio de una persona); los combos de placa y propietario dependen del país.
import { h } from '../../utils/dom.js';
import { t } from '../../textos.js';
import { parseIsoLocal } from '../../utils/fechas.js';
import { crearConfig, editarConfig } from '../../api/viaticosApi.js';
import { crearCampo } from '../../components/campo.js';
import { crearCampoFecha } from '../../components/campoFecha.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { llenarCombo, opcionesDe } from '../../components/comboAgrupado.js';
import { wireCampoFecha } from '../../components/datepicker.js';
import { abrirFormularioConfig } from './modalConfig.js';
import { numeroATexto } from '../../utils/numero.js';
import { armarPayloadVehiculo, propietariosDelPais, tiposPlacaDelPais, validarVehiculo } from './vehiculosModelo.js';

const ID = (nombre) => `vi-veh-${nombre}`;
const CAMPOS = ['paisId', 'propietarioId', 'marca', 'modelo', 'anio', 'placa', 'tipoPlacaId', 'combustibleId', 'tonelaje', 'pasajeros', 'polizaNumero', 'tarjetaVenceEl', 'polizaVenceEl'];

const texto = (nombre, valor, extra = {}) => h('input', { type: 'text', id: ID(nombre), name: nombre, autocomplete: 'off', value: valor ?? '', ...extra });
const campo = (nombre, control, clase = '') => crearCampo({ etiqueta: t(`config.vehiculos.campo.${nombre}`), control, idControl: ID(nombre), clase });

// `vehiculo` es null en el alta. Catálogos: paises, tiposPlaca (todos), combustibles y personas (con sus países).
export function abrirFormularioVehiculo({ vehiculo, paises, tiposPlaca, combustibles, personas, alGuardar }) {
  const enEdicion = Boolean(vehiculo);
  const v = vehiculo || {};

  // En la edición el país no cambia: los datos ligados a él (tipo de placa, propietario) dejarían de corresponder.
  const selectPais = enEdicion
    ? h('input', { type: 'text', id: ID('paisId'), name: 'paisNombre', 'data-campo': 'paisId', value: v.paisNombre ?? '', disabled: true })
    : h('select', { id: ID('paisId'), name: 'paisId' });
  if (!enEdicion) llenarCombo(selectPais, { placeholder: t('config.form.seleccionaPais'), grupos: [{ opciones: opcionesDe(paises, p => p.nombre) }], valor: '' });
  const selectPropietario = h('select', { id: ID('propietarioId'), name: 'propietarioId' });
  const selectTipoPlaca = h('select', { id: ID('tipoPlacaId'), name: 'tipoPlacaId' });
  const selectCombustible = h('select', { id: ID('combustibleId'), name: 'combustibleId' });
  llenarCombo(selectCombustible, { placeholder: t('config.vehiculos.seleccionaCombustible'), grupos: [{ opciones: opcionesDe(combustibles, c => c.nombre) }], valor: v.combustibleId ?? '' });

  const paisElegido = () => (enEdicion ? v.paisId : selectPais.value);

  // Cambiar el país reinicia lo que depende de él, salvo en la carga inicial (conserva el valor del vehículo).
  function llenarDependientes({ conservar }) {
    const pais = paisElegido();
    const propietarioActual = conservar ? (v.propietarioId ?? '') : '';
    const tipoActual = conservar ? (v.tipoPlacaId ?? '') : '';
    const propietarios = pais === '' ? [] : propietariosDelPais(personas, pais, { incluirId: propietarioActual === '' ? null : propietarioActual });
    llenarCombo(selectPropietario, {
      grupos: [{ opciones: [{ valor: '', texto: t('config.vehiculos.empresa') }, ...opcionesDe(propietarios, p => p.nombre)] }],
      valor: propietarioActual
    });
    const tipos = pais === '' ? [] : tiposPlacaDelPais(tiposPlaca, pais, { incluirId: tipoActual === '' ? null : tipoActual });
    llenarCombo(selectTipoPlaca, {
      placeholder: t(pais === '' ? 'config.vehiculos.eligePrimeroPais' : 'config.vehiculos.seleccionaTipoPlaca'),
      grupos: [{ opciones: opcionesDe(tipos, tp => `${tp.codigo} · ${tp.nombre}${tp.activo ? '' : ` (${t('config.estado.inactivo').toLowerCase()})`}`) }],
      valor: tipoActual
    });
    selectTipoPlaca.disabled = pais === '';
  }
  llenarDependientes({ conservar: true });
  if (!enEdicion) selectPais.addEventListener('change', () => llenarDependientes({ conservar: false }));

  const anio = crearCampoNumerico({ id: ID('anio'), name: 'anio', valor: v.anio ?? '', entero: true, placeholder: t('config.vehiculos.ph.anio') });
  const tonelaje = crearCampoNumerico({ id: ID('tonelaje'), name: 'tonelaje', valor: numeroATexto(v.tonelaje), placeholder: t('config.vehiculos.ph.tonelaje') });
  const pasajeros = crearCampoNumerico({ id: ID('pasajeros'), name: 'pasajeros', valor: v.pasajeros ?? '', entero: true, placeholder: t('config.vehiculos.ph.pasajeros') });

  const leer = (form) => Object.fromEntries(CAMPOS.map(nombre => {
    const control = form.querySelector(`[name="${nombre}"]`);
    return [nombre, nombre === 'paisId' && enEdicion ? v.paisId : (control ? control.value : '')];
  }));
  const fecha = (nombre, etiqueta) => crearCampoFecha({ id: ID(nombre), name: nombre, etiqueta: t(`config.vehiculos.campo.${etiqueta || nombre}`) });

  const hijos = [
    campo('paisId', selectPais),
    campo('propietarioId', selectPropietario),
    campo('marca', texto('marca', v.marca, { placeholder: t('config.vehiculos.ph.marca') })),
    campo('modelo', texto('modelo', v.modelo, { placeholder: t('config.vehiculos.ph.modelo') })),
    campo('anio', anio),
    campo('placa', texto('placa', v.placa, { placeholder: t('config.vehiculos.ph.placa') })),
    campo('tipoPlacaId', selectTipoPlaca),
    campo('combustibleId', selectCombustible),
    campo('tonelaje', tonelaje),
    campo('pasajeros', pasajeros),
    h('p', { class: 'form-hint full', text: t(enEdicion ? 'config.vehiculos.ayudaEdicion' : 'config.vehiculos.ayudaAlta') }),
    h('h4', { class: 'vi-form-subtitulo full', text: t('config.vehiculos.poliza.titulo') }),
    campo('polizaNumero', texto('polizaNumero', v.polizaNumero, { placeholder: t('config.vehiculos.ph.poliza') })),
    fecha('polizaVenceEl'),
    h('p', { class: 'form-hint full', text: t('config.vehiculos.poliza.ayuda') }),
    h('h4', { class: 'vi-form-subtitulo full', text: t('config.vehiculos.tarjeta.titulo') }),
    fecha('tarjetaVenceEl'),
    h('p', { class: 'form-hint', text: t('config.vehiculos.tarjeta.ayuda') })
  ];

  const ref = abrirFormularioConfig({
    titulo: t(enEdicion ? 'config.vehiculos.edicion' : 'config.vehiculos.alta'),
    hijos,
    validar: () => validarVehiculo(leer(ref.form), { tiposPlaca }),
    enviar: () => {
      const payload = armarPayloadVehiculo(leer(ref.form));
      return enEdicion ? editarConfig('vehiculos', v.id, payload) : crearConfig('vehiculos', payload);
    },
    // La placa repetida se explica junto a su campo; el servidor dice en qué país.
    erroresDeServidor: (error) => (error.status === 409 ? { placa: error.message } : null),
    alGuardar: (guardado) => {
      window.toast?.success(t('tab.configuracion'), t(enEdicion ? 'config.toast.editado' : 'config.toast.creado', { nombre: (guardado && guardado.placa) || v.placa }));
      alGuardar();
    }
  });

  // Los vencimientos no tienen mínimo: una tarjeta o póliza ya vencida también se registra.
  const poliza = wireCampoFecha(ref.overlay, 'polizaVenceEl');
  const tarjeta = wireCampoFecha(ref.overlay, 'tarjetaVenceEl');
  if (v.polizaVenceEl) poliza.setDate(parseIsoLocal(v.polizaVenceEl), { silent: true });
  if (v.tarjetaVenceEl) tarjeta.setDate(parseIsoLocal(v.tarjetaVenceEl), { silent: true });
  return ref;
}
