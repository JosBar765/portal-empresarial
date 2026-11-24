// Sección «Vehículo»: vehículo de la empresa o propio, datos del combustible (los ingresa el usuario) y sus costos (calculados por el servidor).
import { h } from '../../utils/dom.js';
import { crearCombo, llenarCombo } from '../../components/comboAgrupado.js';
import { crearCampo, crearCampoCalculado, ponerCalculado, crearSeccionForm } from '../../components/campo.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { crearAviso } from '../../components/aviso.js';
import { formatearDinero } from '../../utils/formato.js';
import { aId, bloqueoDeVehiculo, pilotoDelEstado } from '../datos.js';
import { crearCampoConductor } from './conductor.js';
import { t } from '../../textos.js';

const conMoneda = (texto, simbolo) => (simbolo ? `${texto} (${simbolo})` : texto);

function textoVehiculo(v) {
  return `${t(v.esPropio ? 'formulario.vehiculo.propio' : 'formulario.vehiculo.empresa')} · ${v.marca} ${v.modelo} ${v.anio} · ${v.placa}`;
}

// El bloqueo depende de quién maneja: el solicitante o el piloto elegido.
function gruposDeVehiculos(ctx) {
  const { estado, catalogos } = ctx;
  const opcion = (v) => {
    const bloqueo = bloqueoDeVehiculo(v, estado, catalogos);
    return {
      valor: v.id,
      texto: bloqueo ? `${textoVehiculo(v)} · ${t('formulario.vehiculo.noDisponible')}` : textoVehiculo(v),
      deshabilitada: !!bloqueo,
      titulo: bloqueo || undefined
    };
  };
  return [
    { etiqueta: t('formulario.vehiculo.grupoEmpresa'), opciones: catalogos.vehiculos.filter(v => !v.esPropio).map(opcion) },
    { etiqueta: t('formulario.vehiculo.grupoPropios'), opciones: catalogos.vehiculos.filter(v => v.esPropio).map(opcion) }
  ].filter(g => g.opciones.length > 0);
}

export function crearSeccionVehiculo(ctx) {
  const { estado, catalogos } = ctx;
  const nota = h('p', { class: 'vi-ayuda', id: 'vi-sol-vehiculo-nota', 'aria-live': 'polite' });
  const combo = crearCombo({
    id: 'vi-sol-vehiculo', name: 'vehiculoId', etiquetaAria: t('formulario.vehiculo.etiqueta'), placeholder: t('formulario.vehiculo.placeholder'),
    grupos: gruposDeVehiculos(ctx), valor: estado.vehiculoId,
    alCambiar: (v) => { estado.vehiculoId = aId(v); ctx.cambio('vehiculo'); }
  });
  const avisoBloqueados = h('div', { class: 'vi-avisos', id: 'vi-sol-vehiculo-bloqueados' });
  const conductor = crearCampoConductor(ctx);

  function pintarBloqueados() {
    const bloqueados = catalogos.vehiculos.map(v => ({ v, bloqueo: bloqueoDeVehiculo(v, estado, catalogos) })).filter(x => x.bloqueo);
    avisoBloqueados.replaceChildren(...(bloqueados.length ? [crearAviso({
      tipo: 'info', titulo: t(pilotoDelEstado(estado, catalogos) ? 'formulario.vehiculo.bloqueadosPiloto' : 'formulario.vehiculo.bloqueadosTitulo'),
      texto: bloqueados.map(x => `${x.v.placa}: ${x.bloqueo}`).join(' ')
    })] : []));
  }
  // Al cambiar de conductor cambian los vehículos que su licencia permite.
  ctx.suscribir('piloto', () => {
    llenarCombo(combo, { placeholder: t('formulario.vehiculo.placeholder'), grupos: gruposDeVehiculos(ctx), valor: estado.vehiculoId });
    pintarBloqueados();
  });
  pintarBloqueados();

  const campoNum = (id, name, clave, propiedad) => crearCampoNumerico({
    id, name, valor: estado[propiedad], placeholder: t(`formulario.vehiculo.${clave}.ejemplo`), etiquetaAria: t(`formulario.vehiculo.${clave}.etiqueta`),
    alCambiar: (valor) => { estado[propiedad] = valor; ctx.cambio('combustible'); }
  });
  const campoConEtiqueta = (input) => crearCampo({ etiqueta: '', control: input, idControl: input.id });
  const campoRendimiento = campoConEtiqueta(campoNum('vi-sol-rendimiento', 'rendimientoKmGalon', 'rendimiento', 'rendimiento'));
  const campoPrecio = campoConEtiqueta(campoNum('vi-sol-precio', 'precioGalon', 'precio', 'precioGalon'));
  const campoDepreciacion = campoConEtiqueta(campoNum('vi-sol-depreciacion', 'depreciacionPorKm', 'depreciacion', 'depreciacion'));
  const galones = crearCampoCalculado({ etiqueta: t('formulario.vehiculo.galones'), id: 'vi-sol-galones' });
  const costoCombustible = crearCampoCalculado({ etiqueta: '', id: 'vi-sol-costo-combustible' });
  const costoDepreciacion = crearCampoCalculado({ etiqueta: '', id: 'vi-sol-costo-depreciacion' });
  const casillaTanque = h('input', { type: 'checkbox', id: 'vi-sol-tanque-lleno', name: 'tanqueLleno', checked: estado.tanqueLleno === true });
  casillaTanque.addEventListener('change', () => { estado.tanqueLleno = casillaTanque.checked; ctx.cambio('combustible'); });
  const campoTanque = h('label', { class: 'vi-ayuda', for: 'vi-sol-tanque-lleno', id: 'vi-sol-tanque-lleno-campo' }, casillaTanque, ` ${t('formulario.vehiculo.tanqueLleno')}`);
  const filaDatos = h('div', { class: 'vi-grid vi-grid--3' }, campoRendimiento, campoPrecio, campoDepreciacion);
  const filaCalculados = h('div', { class: 'vi-grid vi-grid--3' }, galones, costoCombustible, costoDepreciacion);
  const etiqueta = (campo, texto) => { campo.querySelector('label').textContent = texto; };

  // Con vehículo de la empresa no aplica la depreciación; sin elegir todavía se muestra (como el mockup vacío).
  function pintar() {
    const simbolo = ctx.simbolo();
    const veh = ctx.vehiculo();
    const sinDepreciacion = !!veh && !veh.esPropio;
    campoDepreciacion.style.display = sinDepreciacion ? 'none' : '';
    costoDepreciacion.style.display = sinDepreciacion ? 'none' : '';
    filaDatos.classList.toggle('vi-grid--2', sinDepreciacion);
    filaCalculados.classList.toggle('vi-grid--2', sinDepreciacion);
    // La casilla solo se ofrece con un vehículo que tenga capacidad de tanque; con otro se desmarca.
    const conTanque = !!veh && veh.capacidadTanqueGalones != null;
    if (ctx.catalogos && !conTanque) estado.tanqueLleno = false;
    casillaTanque.checked = estado.tanqueLleno === true;
    campoTanque.style.display = conTanque ? '' : 'none';
    etiqueta(galones, t(estado.tanqueLleno ? 'formulario.vehiculo.galonesPagar' : 'formulario.vehiculo.galones'));
    nota.textContent = t(!veh ? 'formulario.vehiculo.notaSinElegir' : veh.esPropio ? 'formulario.vehiculo.notaPropio' : 'formulario.vehiculo.notaEmpresa');
    etiqueta(campoRendimiento, t('formulario.vehiculo.rendimiento.etiqueta'));
    etiqueta(campoPrecio, conMoneda(t('formulario.vehiculo.precio.etiqueta'), simbolo));
    etiqueta(campoDepreciacion, conMoneda(t('formulario.vehiculo.depreciacion.etiqueta'), simbolo));
    etiqueta(costoCombustible, conMoneda(t('formulario.vehiculo.costoCombustible'), simbolo));
    etiqueta(costoDepreciacion, conMoneda(t('formulario.vehiculo.costoDepreciacion'), simbolo));
  }

  // Los tres valores vienen del servidor; si no hay desglose (datos incompletos) se ven como «—».
  function mostrarCalculo() {
    const d = ctx.respuesta && ctx.respuesta.desglose;
    ponerCalculado(galones.querySelector('output'), d ? Number(d.combustible.galones).toFixed(2) : null);
    ponerCalculado(costoCombustible.querySelector('output'), d ? formatearDinero('', d.combustible.importe) : null);
    ponerCalculado(costoDepreciacion.querySelector('output'), d && d.depreciacion ? formatearDinero('', d.depreciacion.importe) : null);
  }

  ctx.suscribir('moneda', pintar);
  ctx.suscribir('vehiculo', pintar);
  ctx.suscribir('combustible', pintar);
  ctx.suscribir('resultado', mostrarCalculo);
  pintar();
  mostrarCalculo();

  const el = crearSeccionForm({ id: 'vi-sol-seccion-vehiculo', titulo: t('formulario.seccion.vehiculo') },
    nota,
    crearCampo({ etiqueta: t('formulario.vehiculo.etiqueta'), control: combo, idControl: 'vi-sol-vehiculo' }),
    conductor && conductor.el,
    avisoBloqueados,
    campoTanque,
    filaDatos,
    filaCalculados);
  return { el };
}
