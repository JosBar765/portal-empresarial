// Sección «Ruta y tramos»: tramos encadenados (el origen de cada uno es el destino del anterior) con destinos restringidos a los tramos registrados.
import { h } from '../../utils/dom.js';
import { LIMITES_SOLICITUD } from '../../config/constantes.js';
import { crearCombo } from '../../components/comboAgrupado.js';
import { crearCampo, crearSeccionForm } from '../../components/campo.js';
import { crearBotonAgregar, crearBotonQuitar, crearTotales, ponerTotal } from '../../components/renglones.js';
import { formatearCantidad } from '../../utils/numero.js';
import { aId, destinosPermitidos, distanciaDelTramo, normalizarRuta, origenDelTramo, rutaLocal, ubicacionesConTramo } from '../datos.js';
import { t } from '../../textos.js';

export function crearSeccionRuta(ctx) {
  const { estado, catalogos } = ctx;
  // Con varios países las ubicaciones se distinguen por su país.
  const variosPaises = new Set(catalogos.ubicaciones.map(u => u.paisId)).size > 1;
  const textoUbicacion = (u) => (variosPaises ? `${u.nombre} · ${u.paisNombre}` : u.nombre);
  const ubicacionesDe = (ids) => catalogos.ubicaciones.filter(u => ids.includes(u.id));

  const filas = h('div', { class: 'vi-renglones', id: 'vi-sol-tramos' });
  // El envoltorio recibe los errores de la lista completa («tramos») sin teñir los campos de cada renglón.
  const listaCampo = h('div', { class: 'form-field vi-lista-campo', 'data-campo': 'tramos' },
    h('div', { class: 'vi-renglon vi-renglon--tramo vi-renglon--cabecera', 'aria-hidden': 'true' },
      h('span', { text: '#' }), h('span', { text: t('formulario.ruta.origen') }), h('span'), h('span', { text: t('formulario.ruta.destino') }),
      h('span', { text: t('formulario.ruta.km') }), h('span', { text: t('formulario.ruta.horas') }), h('span')),
    filas);
  const totales = crearTotales([
    { id: 'vi-sol-km-total', etiqueta: t('formulario.ruta.kmTotales'), valor: '0 km', fuerte: true },
    { id: 'vi-sol-horas-total', etiqueta: t('formulario.ruta.horasTotales'), valor: '0 h', fuerte: true }
  ], { id: 'vi-sol-totales-ruta' });
  const contenedorAgregar = h('div', { class: 'vi-agregar' });

  function celdaOrigen(i) {
    const origenId = origenDelTramo(estado, i);
    if (i === 0) {
      const combo = crearCombo({
        id: 'vi-sol-origen-0', name: 'origenInicialId', etiquetaAria: t('formulario.ruta.origenDelTramo', { n: 1 }), placeholder: t('formulario.ruta.origenPlaceholder'),
        grupos: [{ opciones: ubicacionesDe(ubicacionesConTramo(catalogos.tramos)).map(u => ({ valor: u.id, texto: textoUbicacion(u) })) }],
        valor: origenId,
        alCambiar: (v) => cambiarOrigen(aId(v))
      });
      return crearCampo({ etiqueta: t('formulario.ruta.origenDelTramo', { n: 1 }), control: combo, idControl: 'vi-sol-origen-0', soloMovil: true });
    }
    const id = `vi-sol-origen-${i}`;
    return h('div', { class: 'form-field' },
      h('label', { for: id, class: 'vi-solo-movil', text: t('formulario.ruta.origenDelTramo', { n: i + 1 }) }),
      h('div', { class: 'vi-calculado' },
        h('output', { id, class: 'vi-calculado__valor', text: ctx.nombreUbicacion(origenId) }),
        h('span', { class: 'vi-calculado__marca', text: t('formulario.calculado') })));
  }

  function celdaDestino(i) {
    const origenId = origenDelTramo(estado, i);
    const id = `vi-sol-destino-${i}`;
    const combo = crearCombo({
      id, name: `tramos[${i}].destinoId`, etiquetaAria: t('formulario.ruta.destinoDelTramo', { n: i + 1 }), placeholder: t('formulario.ruta.destinoPlaceholder'),
      grupos: [{ opciones: ubicacionesDe(destinosPermitidos(origenId, catalogos.tramos)).map(u => ({ valor: u.id, texto: textoUbicacion(u) })) }],
      valor: estado.tramos[i].destinoId, deshabilitado: origenId === '',
      alCambiar: (v) => cambiarDestino(i, aId(v))
    });
    return crearCampo({ etiqueta: t('formulario.ruta.destinoDelTramo', { n: i + 1 }), control: combo, idControl: id, soloMovil: true });
  }

  function renglon(i) {
    const d = distanciaDelTramo(estado, i, catalogos.tramos);
    const km = d ? `${formatearCantidad(d.km)} km` : '—';
    const horas = d ? `${formatearCantidad(d.horas)} h` : '—';
    const esUltimo = i === estado.tramos.length - 1;
    const puedeQuitar = esUltimo && estado.tramos.length > 1;
    return h('div', { class: 'vi-renglon vi-renglon--tramo', 'data-fila': String(i) },
      h('span', { class: 'vi-renglon__num', text: String(i + 1) }),
      h('span', { class: 'vi-renglon__titulo', text: t('formulario.ruta.tramo', { n: i + 1 }) }),
      celdaOrigen(i),
      h('span', { class: 'vi-renglon__flecha', 'aria-hidden': 'true', text: '›' }),
      celdaDestino(i),
      h('span', { class: 'vi-celda-dato', text: km }),
      h('span', { class: 'vi-celda-dato', text: horas }),
      h('span', { class: 'vi-renglon__distancia', text: d ? t('formulario.ruta.distancia', { km: formatearCantidad(d.km), horas: formatearCantidad(d.horas) }) : '' }),
      crearBotonQuitar({
        etiqueta: t('formulario.ruta.quitar', { n: i + 1 }), alPulsar: quitarUltimo, deshabilitado: !puedeQuitar,
        titulo: puedeQuitar ? t('formulario.ruta.quitar', { n: i + 1 }) : t('formulario.ruta.soloElUltimo')
      }));
  }

  // `foco`: id del control que recupera el foco tras repintar (el teclado no debe perder su lugar).
  function pintar(foco) {
    filas.replaceChildren(...estado.tramos.map((_, i) => renglon(i)));
    const ultimo = estado.tramos[estado.tramos.length - 1];
    const completo = ultimo.destinoId !== '';
    contenedorAgregar.replaceChildren(crearBotonAgregar({
      texto: t('formulario.ruta.agregar'), alPulsar: agregar, deshabilitado: !completo || estado.tramos.length >= LIMITES_SOLICITUD.MAX_TRAMOS,
      titulo: completo ? undefined : t('formulario.ruta.agregarDeshabilitado')
    }));
    if (foco) { const nodo = filas.querySelector(`#${foco}`); if (nodo) nodo.focus(); }
    mostrarTotales();
  }

  // Km y horas totales: del servidor cuando hay un cálculo vigente; mientras llega, el respaldo local con los tramos del catálogo.
  function mostrarTotales() {
    const desglose = ctx.respuesta && ctx.respuesta.desglose;
    const local = rutaLocal(estado, catalogos.tramos);
    const usaServidor = desglose && !ctx.calculando;
    ponerTotal(totales, 'vi-sol-km-total', `${formatearCantidad(usaServidor ? desglose.ruta.kmTotal : local.km)} km`);
    ponerTotal(totales, 'vi-sol-horas-total', `${formatearCantidad(usaServidor ? desglose.ruta.horasTotal : local.horas)} h`);
  }

  function aplicarRuta(cambios, foco) {
    Object.assign(estado, normalizarRuta({ ...estado, ...cambios }, catalogos.tramos));
    ctx.erroresServidor = []; // los renglones cambiaron de lugar: los errores viejos ya no apuntan a lo mismo
    pintar(foco);
    ctx.cambio('ruta');
  }
  const cambiarOrigen = (id) => aplicarRuta({ origenInicialId: id, tramos: [{ destinoId: '' }] }, 'vi-sol-origen-0');
  const cambiarDestino = (i, id) => {
    const tramos = estado.tramos.map((f, j) => (j === i ? { destinoId: id } : f));
    aplicarRuta({ tramos }, `vi-sol-destino-${i}`);
  };
  function agregar() {
    estado.tramos = [...estado.tramos, { destinoId: '' }];
    ctx.erroresServidor = [];
    pintar(`vi-sol-destino-${estado.tramos.length - 1}`);
    ctx.cambio('ruta');
  }
  function quitarUltimo() {
    if (estado.tramos.length < 2) return;
    estado.tramos = estado.tramos.slice(0, -1);
    ctx.erroresServidor = [];
    pintar();
    ctx.cambio('ruta');
  }

  ctx.suscribir('resultado', mostrarTotales);
  ctx.suscribir('calculando', mostrarTotales);
  pintar();

  const el = crearSeccionForm({ id: 'vi-sol-seccion-ruta', titulo: t('formulario.seccion.ruta'), ayuda: t('formulario.ruta.ayuda') },
    listaCampo, contenedorAgregar, totales);
  return { el };
}
