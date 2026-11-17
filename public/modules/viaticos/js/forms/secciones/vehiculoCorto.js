// Sección «Vehículo» del viaje de 1 día o menos: solo vehículos de la empresa; los que no se pueden usar quedan deshabilitados con su motivo.
import { h } from '../../utils/dom.js';
import { crearCombo } from '../../components/comboAgrupado.js';
import { crearCampo, crearSeccionForm } from '../../components/campo.js';
import { crearAviso } from '../../components/aviso.js';
import { aId } from '../datos.js';
import { t } from '../../textos.js';

const textoVehiculo = (v) => `${v.marca} ${v.modelo} ${v.anio} · ${v.placa}`;
const motivoDeBloqueo = (v) => v.bloqueo || v.bloqueoViajeCorto || null;

export function crearSeccionVehiculoCorto(ctx) {
  const { estado, catalogos } = ctx;
  const empresa = catalogos.vehiculos.filter(v => !v.esPropio);
  const opciones = empresa.map(v => {
    const motivo = motivoDeBloqueo(v);
    return { valor: v.id, texto: motivo ? `${textoVehiculo(v)} · ${t('formulario.vehiculo.noDisponible')}` : textoVehiculo(v), deshabilitada: !!motivo, titulo: motivo || undefined };
  });
  const combo = crearCombo({
    id: 'vi-sol-vehiculo', name: 'vehiculoId', etiquetaAria: t('formulario.vehiculo.etiqueta'), placeholder: t('formulario.vehiculo.placeholder'),
    grupos: [{ opciones }], valor: estado.vehiculoId, deshabilitado: empresa.length === 0,
    alCambiar: (v) => { estado.vehiculoId = aId(v); ctx.cambio('vehiculo'); }
  });
  const bloqueados = empresa.filter(motivoDeBloqueo);
  const avisoBloqueados = bloqueados.length ? crearAviso({
    tipo: 'info', titulo: t('formulario.vehiculo.bloqueadosTitulo'), texto: bloqueados.map(v => `${v.placa}: ${motivoDeBloqueo(v)}`).join(' ')
  }) : null;
  const ayuda = h('p', { class: 'vi-ayuda', id: 'vi-sol-vehiculo-nota', text: t(empresa.length ? 'formulario.vehiculo.notaCorto' : 'formulario.vehiculo.sinEmpresa') });

  const el = crearSeccionForm({ id: 'vi-sol-seccion-vehiculo', titulo: t('formulario.seccion.vehiculo') },
    ayuda, crearCampo({ etiqueta: t('formulario.vehiculo.etiqueta'), control: combo, idControl: 'vi-sol-vehiculo' }), avisoBloqueados);
  return { el };
}
