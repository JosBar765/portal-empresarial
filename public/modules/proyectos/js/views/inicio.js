// A0 · Centro de configuración: una tarjeta por área, lo que falta resolver y los últimos cambios.
import { h, icono, montar } from '../utils/dom.js';
import { hace, nombreCorto, pluralizar } from '../utils/formato.js';
import { cabecera, aviso, cargando } from '../components/ui.js';
import { obtenerResumen } from '../api/api.js';
import { textoDeCambio } from './cambios.js';

// Las áreas que llegan en fases posteriores se muestran apagadas, con su fase, para que se vea el camino completo.
const AREAS_PRONTO = [
  { titulo: 'Plan del año', icono: 'calendar-outline', texto: 'Nicho y plantilla por mes · activación automática', fase: 9 },
  { titulo: 'Notificaciones', icono: 'notifications-outline', texto: 'Qué avisos recibe cada rol', fase: 6 },
  { titulo: 'Kit del nicho', icono: 'chatbox-outline', texto: 'Guiones y mensajes por nicho', fase: 9 }
];

const NOMBRES_CORTOS_REGLA = {
  'reglas.visto_bueno_cierre': 'Visto bueno',
  'reglas.aprobar_activacion': 'Aprobar activación',
  'reglas.confirmar_ventas': 'Confirmar ventas'
};

const masReciente = (...cambios) => cambios.filter(Boolean).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] || null;
const pieDe = (cambio, sinCambios) => (cambio ? `${nombreCorto(cambio.usuario)} · ${hace(cambio.fecha)}` : sinCambios);

function tarjeta({ titulo, texto, pie, nombreIcono, ruta, fase }) {
  const contenido = [
    h('div', { class: 'tarjeta-cabecera' },
      h('span', { class: 'tarjeta-icono' }, icono(nombreIcono)),
      fase ? h('span', { class: 'etiqueta-fase', text: `Fase ${fase}` }) : null),
    h('div', { class: 'tarjeta-titulo', text: titulo }),
    h('div', { class: 'tarjeta-texto', text: texto }),
    h('div', { class: 'tarjeta-pie', text: pie })
  ];
  return ruta
    ? h('a', { class: 'tarjeta-config', href: `#/${ruta}` }, contenido)
    : h('div', { class: 'tarjeta-config tarjeta-config--pronto' }, contenido);
}

function avisoDePendientes(pendientes) {
  const sinMoneda = pendientes.find(p => p.tipo === 'pais_sin_moneda');
  if (!sinMoneda) return null;
  const nombres = sinMoneda.paises;
  const sujeto = nombres.length === 1 ? `${nombres[0]} no tiene` : `${nombres.join(', ')} no tienen`;
  return aviso({
    tipo: 'advertencia',
    titulo: `Falta configurar ${pluralizar(nombres.length, 'país', 'países')}`,
    texto: `${sujeto} moneda local asignada: sus cotizaciones saldrán en dólares hasta que la elijas (Catálogos › Países).`
  });
}

function tarjetas(resumen) {
  const reglas = resumen.reglas.map(r => `${NOMBRES_CORTOS_REGLA[r.clave] || r.etiqueta}: ${r.valor ? 'sí' : 'no'}`).join(' · ');
  return [
    tarjeta({
      titulo: 'Catálogos', nombreIcono: 'grid-outline', ruta: 'catalogos',
      texto: `${resumen.catalogos.tipos} listas: nichos, artículos, canales, resultados…`,
      pie: pieDe(masReciente(resumen.ultimos.catalogos, resumen.ultimos.paises), `${resumen.catalogos.activas} opciones activas`)
    }),
    tarjeta({ titulo: AREAS_PRONTO[0].titulo, nombreIcono: AREAS_PRONTO[0].icono, texto: AREAS_PRONTO[0].texto, fase: AREAS_PRONTO[0].fase, pie: `Disponible en la fase ${AREAS_PRONTO[0].fase}` }),
    tarjeta({
      titulo: 'Parámetros', nombreIcono: 'list-outline', ruta: 'parametros',
      texto: 'Reparto, seguimiento, semáforo, importación…',
      pie: pieDe(resumen.ultimos.parametros, `${pluralizar(resumen.parametros.total, 'ajuste', 'ajustes')} en su valor por defecto`)
    }),
    tarjeta({
      titulo: 'Plantillas de proyecto', nombreIcono: 'document-text-outline', ruta: 'plantillas', texto: 'Duración, etapas y qué puede cambiar el supervisor',
      pie: pieDe(resumen.ultimos.plantillas, pluralizar(resumen.plantillas.activas, 'plantilla activa', 'plantillas activas'))
    }),
    tarjeta({
      titulo: 'Reglas y aprobaciones', nombreIcono: 'checkmark-circle-outline', ruta: 'reglas',
      texto: reglas, pie: pieDe(resumen.ultimos.reglas, 'Todo en su valor por defecto')
    }),
    tarjeta({
      titulo: 'Campos propios', nombreIcono: 'create-outline', ruta: 'campos', texto: 'Datos extra de la empresa según el nicho',
      pie: pieDe(resumen.ultimos.campos, `${pluralizar(resumen.campos.activos, 'campo activo', 'campos activos')}`)
    }),
    tarjeta({
      titulo: 'Alcance de usuarios', nombreIcono: 'globe-outline', ruta: 'alcance', texto: 'Los países que ve cada persona',
      pie: pieDe(resumen.ultimos.alcance, resumen.alcance.personasConExcepciones ? `${pluralizar(resumen.alcance.personasConExcepciones, 'persona con ajustes', 'personas con ajustes')}` : 'Cada persona ve el país de su tienda')
    }),
    ...AREAS_PRONTO.slice(1).map(a => tarjeta({ titulo: a.titulo, nombreIcono: a.icono, texto: a.texto, fase: a.fase, pie: `Disponible en la fase ${a.fase}` })),
    tarjeta({
      titulo: 'Historial de cambios', nombreIcono: 'time-outline', ruta: 'historial',
      texto: 'Quién cambió qué, antes y después', pie: pluralizar(resumen.historial.total, 'cambio', 'cambios')
    })
  ];
}

function ultimosCambios(historial) {
  const cuerpo = historial.recientes.length
    ? h('div', { class: 'lista-cambios' }, historial.recientes.map(c => h('div', { class: 'cambio-reciente' },
      icono('time-outline'),
      h('span', { class: 'cambio-area', text: c.area }),
      h('span', { class: 'cambio-detalle', text: textoDeCambio(c) }),
      h('span', { class: 'cambio-cuando', text: `${nombreCorto(c.usuario)} · ${hace(c.fecha)}` }))))
    : h('p', { class: 'panel-descripcion', text: 'Todavía no hay cambios. Los que hagas quedarán aquí, con quién los hizo y cómo estaba antes.' });
  return h('section', { class: 'panel' }, h('h2', { class: 'panel-titulo', text: 'Últimos cambios' }), cuerpo);
}

export async function renderInicio(cont) {
  montar(cont, cargando());
  const resumen = await obtenerResumen();
  montar(cont,
    cabecera({
      titulo: 'Centro de configuración',
      subtitulo: 'Todo lo ajustable sin programar. Aplica a proyectos nuevos.',
      acciones: h('a', { class: 'btn btn--ghost', href: '#/historial' }, icono('time-outline'), 'Ver historial de cambios')
    }),
    avisoDePendientes(resumen.pendientes),
    h('div', { class: 'tarjetas-config' }, tarjetas(resumen)),
    ultimosCambios(resumen.historial));
}
