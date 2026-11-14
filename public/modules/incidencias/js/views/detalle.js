// public/modules/incidencias/js/views/detalle.js
// El detalle de una incidencia: lo que se reportó, cómo va, quién la atiende y quién la revisa, y todo lo que ha pasado con ella
// en un solo historial. Los botones salen de `acciones` (lo que el servidor permite a esta persona en este momento).
import { h, icono, montar } from '../utils/dom.js';
import { detalle as pedirDetalle, comentar } from '../api/incidenciasApi.js';
import { miniaturaAbrible } from '../components/visorFotos.js';
import { chipPrioridad, chipEstado, chipTexto, chipEvolucion } from '../components/chips.js';
import { fechaHora, hace, ordinal, claveDeOperacion } from '../utils/formato.js';
import { crearAcciones } from './acciones.js';
import { cargando, mostrarError } from './estados.js';

const IMPACTO = {
  riesgo_personas: 'Riesgo para las personas', detiene_operacion: 'Detiene la operación',
  trabajo_con_limitaciones: 'Trabajo con limitaciones', molestia_menor: 'Molestia menor'
};

const PASOS = [['en_buzon', 'En buzón'], ['en_proceso', 'En proceso'], ['en_verificacion', 'En verificación'], ['cerrada', 'Cerrada']];
const PASO_DE = { en_buzon: 0, en_proceso: 1, en_espera: 1, correccion_pedida: 1, en_verificacion: 2, cerrada: 3 };

// Cómo se cuenta cada cosa que pasó en el historial.
function presentar(e) {
  const quien = e.usuario ? e.usuario.nombre : 'Sistema';
  const ronda = e.ronda ? `${ordinal(e.ronda)} revisión` : '';
  const d = e.datos || {};
  switch (e.tipo) {
    case 'apertura': return { icono: 'flash-outline', tono: 'azul', titulo: 'Incidencia abierta' };
    case 'buzon': return { icono: 'people-outline', tono: 'gris', titulo: 'En el buzón compartido' };
    case 'toma': return { icono: 'play-outline', tono: 'azul', titulo: 'Tomó la incidencia' };
    case 'avance': return { icono: 'trending-up-outline', tono: 'amarillo', titulo: 'Avance', chip: chipEvolucion(e.evolucion) };
    case 'espera': return { icono: 'pause-outline', tono: 'amarillo', titulo: `En espera${d.motivo ? ` · ${d.motivo}` : ''}` };
    case 'reanudacion': return { icono: 'play-forward-outline', tono: 'azul', titulo: 'Retomó el trabajo' };
    case 'a_verificacion': return { icono: 'paper-plane-outline', tono: 'violeta', titulo: `Enviada a verificación${ronda ? ` · ${ronda}` : ''}` };
    case 'correccion_pedida': return { icono: 'chatbubble-ellipses-outline', tono: 'rojo', titulo: `Corrección pedida${ronda ? ` · ${ronda}` : ''}` };
    case 'cierre': return { icono: 'checkmark-circle-outline', tono: 'verde', titulo: 'Cerrada' };
    case 'reasignacion': return { icono: 'swap-horizontal-outline', tono: 'amarillo', titulo: 'Reasignada', detalle: d.a ? `${d.de ? `De ${d.de.nombre} a ${d.a.nombre}` : `Asignada a ${d.a.nombre}`}.` : null };
    case 'devolucion_buzon': return { icono: 'return-up-back-outline', tono: 'amarillo', titulo: 'Devuelta al buzón', detalle: d.de && d.de.nombre ? `La tenía ${d.de.nombre}.` : null };
    case 'descarte': return { icono: 'close-circle-outline', tono: 'gris', titulo: 'Descartada' };
    case 'comentario': return { icono: 'chatbubble-outline', tono: 'gris', titulo: 'Comentario', chip: e.visibleReportante ? null : chipTexto('Solo el equipo', 'inc-chip--neutro') };
    case 'prioridad': return { icono: 'flag-outline', tono: 'gris', titulo: `Cambió la prioridad${d.de && d.a ? ` (${d.de} → ${d.a})` : ''}` };
    default: return { icono: 'ellipse-outline', tono: 'gris', titulo: quien };
  }
}

const GRUPOS = { todo: null, avances: ['avance', 'comentario'], correcciones: ['correccion_pedida', 'a_verificacion', 'cierre'], reasignaciones: ['reasignacion', 'devolucion_buzon', 'toma', 'prioridad'] };

// Las miniaturas abren el visor con todas las fotos del grupo; cada una lleva su etiqueta (de qué es, quién la subió y cuándo).
function galeria(fotos, { titulo = 'Foto', detalle = '' } = {}) {
  if (!fotos || !fotos.length) return null;
  const secuencia = fotos.map(f => ({ url: f.url, titulo, detalle }));
  return h('ul', { class: 'inc-fotos-lista inc-fotos-lista--solo-ver' }, fotos.map((f, i) => h('li', { class: 'inc-foto' }, miniaturaAbrible(secuencia, i))));
}

export async function mostrarDetalle(cont, id, { pestana = 'resumen' } = {}) {
  const ctx = { id, pestana, grupo: 'todo', d: null, vivo: true, claveComentario: claveDeOperacion() };

  async function cargar({ silencioso = false } = {}) {
    if (!silencioso) montar(cont, cargando('Cargando la incidencia…'));
    try {
      ctx.d = await pedirDetalle(id);
      if (ctx.vivo) dibujar();
    } catch (error) {
      if (ctx.vivo) mostrarError(cont, error, () => cargar());
    }
  }

  function alCambiar(respuesta) {
    if (respuesta && respuesta.incidencia) { ctx.d = respuesta; ctx.claveComentario = claveDeOperacion(); dibujar(); window.scrollTo({ top: 0, behavior: 'smooth' }); } else cargar({ silencioso: true });
  }

  function botones() {
    const a = ctx.d.acciones;
    const acc = crearAcciones(ctx.d, alCambiar);
    const btn = (texto, nombreIcono, alClic, primario = false, peligro = false) => {
      const b = h('button', { class: `btn ${peligro ? 'btn--danger' : (primario ? 'btn--primary' : 'btn--ghost')} inc-accion`, type: 'button' }, icono(nombreIcono), texto);
      b.addEventListener('click', () => alClic(b));
      return b;
    };
    const lista = [];
    if (a.tomar) lista.push(btn('Tomar', 'play-outline', acc.tomar, true));
    if (a.avance) lista.push(btn('Publicar avance', 'create-outline', acc.avance, true));
    if (a.enviarVerificacion) lista.push(btn('Enviar a verificación', 'paper-plane-outline', acc.enviarVerificacion, true));
    if (a.aprobar || a.pedirCorreccion) lista.push(btn('Revisar cierre', 'shield-checkmark-outline', acc.revisarCierre, true));
    if (a.reanudar) lista.push(btn('Retomar trabajo', 'play-forward-outline', acc.reanudar, true));
    if (a.espera) lista.push(btn('Poner en espera', 'pause-outline', acc.espera));
    if (a.devolver) lista.push(btn('Devolver al buzón', 'return-up-back-outline', acc.devolver));
    if (a.reasignar) lista.push(btn('Reasignar', 'swap-horizontal-outline', acc.reasignar));
    if (a.descartar) lista.push(btn('Descartar', 'close-circle-outline', acc.descartar, false, true));
    return { lista, acc };
  }

  function stepper(i) {
    if (i.estado === 'descartada') return h('p', { class: 'inc-tenue', text: 'Esta incidencia se descartó.' });
    const actual = PASO_DE[i.estado];
    return h('ol', { class: 'inc-pasos' }, PASOS.map(([clave, etiqueta], n) => h('li', { class: `inc-paso${n < actual || (i.estado === 'cerrada') ? ' inc-paso--hecho' : ''}${n === actual && i.estado !== 'cerrada' ? ' inc-paso--actual' : ''}` },
      h('span', { class: 'inc-paso-punto', 'aria-hidden': 'true' }), h('span', { text: etiqueta }))));
  }

  function avisoDeEstado() {
    const { incidencia: i, eventos, relacion } = ctx.d;
    if (i.estado === 'correccion_pedida' && relacion.responsable) {
      const ultima = eventos.find(e => e.tipo === 'correccion_pedida');
      return h('div', { class: 'inc-banner inc-banner--atencion' }, icono('alert-circle-outline'), h('span', { text: `${ultima && ultima.usuario ? ultima.usuario.nombre : 'Quien verifica'} pidió una corrección${ultima && ultima.texto ? `: «${ultima.texto}»` : ''}. Publica tu nueva solución y envíala otra vez a verificación.` }));
    }
    if (i.estado === 'descartada') {
      const d = eventos.find(e => e.tipo === 'descarte');
      return h('div', { class: 'inc-banner inc-banner--info' }, icono('information-circle-outline'), h('span', { text: `Se descartó${d && d.usuario ? ` (${d.usuario.nombre})` : ''}${d && d.texto ? `: ${d.texto}` : '.'}` }));
    }
    if (i.estado === 'en_espera') {
      const e = eventos.find(x => x.tipo === 'espera');
      return h('div', { class: 'inc-banner inc-banner--info' }, icono('pause-circle-outline'), h('span', { text: `En espera${e && e.datos && e.datos.motivo ? `: ${e.datos.motivo.toLowerCase()}` : ''}${e && e.texto ? `. ${e.texto}` : '.'}` }));
    }
    return null;
  }

  function tarjetaDetalles() {
    const i = ctx.d.incidencia;
    const dato = (etiqueta, valor) => (valor ? [h('dt', { text: etiqueta }), h('dd', { text: valor })] : null);
    const revisa = i.verifica && i.verifica.length ? i.verifica.map(p => p.nombre).join(', ') : (i.origenVerificador === 'permiso' ? 'Quien tenga el permiso de verificar' : 'Aún sin definir');
    return h('section', { class: 'inc-card inc-datos' }, h('h2', { text: 'Detalles' }), h('dl', null,
      dato('Reportó', `${i.reportante.nombre} · ${hace(i.creadaEn)}`), dato('Ubicación', `${i.tienda.codigo} · ${i.tienda.empresa}`), dato('País', i.tienda.pais), dato('Zona', i.zona),
      dato('Categoría', i.categoria), dato('Activo', [i.tipoActivo, i.activoTexto].filter(Boolean).join(' · ')),
      dato('Asignada a', i.tecnico ? i.tecnico.nombre : 'Nadie todavía (está en el buzón)'), dato('La revisa', revisa)));
  }

  function tarjetaPrioridad(acc) {
    const i = ctx.d.incidencia;
    return h('section', { class: 'inc-card inc-prioridad' }, h('h2', { text: 'Prioridad' }),
      h('div', { class: 'inc-prioridad-fila' }, chipPrioridad(i.prioridad), ctx.d.acciones.cambiarPrioridad ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: acc.cambiarPrioridad }, 'Cambiar') : null),
      h('p', { class: 'inc-tenue', text: `Según el impacto indicado: «${IMPACTO[i.impacto] || ''}».${i.reincidente ? ' Subió un nivel porque el problema se repite en esta tienda y zona.' : ''}` }));
  }

  function tarjetaCursos() {
    const { incidencia: i, eventos } = ctx.d;
    const reasignaciones = eventos.filter(e => e.tipo === 'reasignacion').length;
    return h('section', { class: 'inc-card inc-curso' }, h('h2', { text: 'Cómo va' }), stepper(i),
      h('dl', null, h('dt', { text: 'Responsable actual' }), h('dd', { text: i.tecnico ? i.tecnico.nombre : 'Nadie todavía' }),
        i.ronda ? [h('dt', { text: 'Veces que se envió a verificación' }), h('dd', { text: String(i.ronda) })] : null,
        reasignaciones ? [h('dt', { text: 'Reasignaciones' }), h('dd', { text: String(reasignaciones) })] : null));
  }

  function composerComentario() {
    if (!ctx.d.acciones.comentar) return null;
    const area = h('textarea', { rows: 2, maxlength: 500, placeholder: 'Escribe un comentario rápido para el historial…', 'aria-label': 'Escribe un comentario', id: 'comentario-texto' });
    const interno = ctx.d.relacion.reportante && !ctx.d.relacion.responsable ? null : h('input', { type: 'checkbox', id: 'comentario-visible', checked: true });
    const boton = h('button', { class: 'btn btn--primary btn--sm', type: 'button' }, icono('send-outline'), 'Publicar comentario');
    const error = h('p', { class: 'inc-campo-error', role: 'alert', hidden: true });
    boton.addEventListener('click', async () => {
      const texto = area.value.trim();
      if (!texto) { error.hidden = false; error.textContent = 'Escribe tu comentario.'; return; }
      error.hidden = true;
      boton.disabled = true;
      boton.replaceChildren(icono('sync-outline', 'spin-animation'), 'Publicando…');
      try {
        const r = await comentar(id, { texto, visibleReportante: interno ? interno.checked : true, idempotencyKey: ctx.claveComentario });
        ctx.claveComentario = claveDeOperacion();
        ctx.d = r; dibujar();
      } catch (e) {
        boton.disabled = false; boton.replaceChildren(icono('send-outline'), 'Publicar comentario');
        error.hidden = false; error.textContent = e.message;
      }
    });
    return h('div', { class: 'inc-comentar' }, area, error, h('div', { class: 'inc-comentar-pie' },
      interno ? h('label', { class: 'inc-casilla', for: 'comentario-visible' }, interno, h('span', { text: 'Visible para quien reportó' })) : h('span'), boton));
  }

  function tarjetaComentarios() {
    const comentarios = ctx.d.eventos.filter(e => e.tipo === 'comentario').slice().reverse();
    return h('section', { class: 'inc-card inc-comentarios' }, h('h2', { text: 'Comentarios' }),
      comentarios.length ? h('ul', { class: 'inc-hilo' }, comentarios.map(e => h('li', { class: 'inc-comentario' },
        h('div', { class: 'inc-comentario-cabeza' }, h('strong', { text: e.usuario ? e.usuario.nombre : 'Sistema' }), h('span', { class: 'inc-tenue', text: hace(e.creadoEn) }), e.visibleReportante ? null : chipTexto('Solo el equipo', 'inc-chip--neutro')),
        h('p', { text: e.texto })))) : h('p', { class: 'inc-tenue', text: 'Todavía no hay comentarios.' }),
      composerComentario());
  }

  function pestanaResumen(acc) {
    const i = ctx.d.incidencia;
    return h('div', { class: 'inc-detalle-cuerpo' },
      h('div', { class: 'inc-detalle-principal' },
        h('section', { class: 'inc-card' }, h('h2', { text: 'Fotos del reporte' }), galeria(i.fotos, { titulo: 'Foto del reporte', detalle: `${i.reportante.nombre} · ${fechaHora(i.creadaEn)}` }) || h('p', { class: 'inc-tenue', text: 'Sin fotos.' })),
        h('section', { class: 'inc-card' }, h('h2', { text: 'Descripción' }), h('p', { class: 'inc-descripcion', text: i.descripcion }),
          h('div', { class: 'inc-fila-chips' }, chipTexto(IMPACTO[i.impacto] || i.impacto, i.impacto === 'riesgo_personas' ? 'inc-chip--prio-rojo' : 'inc-chip--neutro'), i.reincidente ? chipTexto('Se repite', 'inc-chip--alerta') : null)),
        tarjetaComentarios()),
      h('aside', { class: 'inc-detalle-lateral' }, tarjetaCursos(), tarjetaDetalles(), tarjetaPrioridad(acc)));
  }

  function pestanaHistorial() {
    const filtro = GRUPOS[ctx.grupo];
    const eventos = ctx.d.eventos.filter(e => !filtro || filtro.includes(e.tipo));
    const chips = [['todo', 'Todo'], ['avances', 'Avances'], ['correcciones', 'Correcciones'], ['reasignaciones', 'Reasignaciones']];
    return h('div', { class: 'inc-detalle-cuerpo' },
      h('div', { class: 'inc-detalle-principal' },
        h('section', { class: 'inc-card' }, h('h2', { text: 'Historial de la incidencia' }), h('p', { class: 'inc-tenue', text: 'Todo lo que pasó con la incidencia, con fecha y hora.' }),
          h('div', { class: 'inc-chips-filtro', role: 'group', 'aria-label': 'Filtrar el historial' }, chips.map(([clave, texto]) => h('button', { class: `inc-filtro${ctx.grupo === clave ? ' inc-filtro--activo' : ''}`, type: 'button', 'aria-pressed': String(ctx.grupo === clave), onclick: () => { ctx.grupo = clave; dibujar(); } }, texto))),
          eventos.length ? h('ol', { class: 'inc-linea' }, eventos.map((e) => {
            const p = presentar(e);
            return h('li', { class: 'inc-evento' },
              h('span', { class: `inc-evento-icono inc-evento-icono--${p.tono}`, 'aria-hidden': 'true' }, icono(p.icono)),
              h('div', { class: 'inc-evento-cuerpo' },
                h('div', { class: 'inc-evento-cabeza' }, h('strong', { text: p.titulo }), p.chip || null, h('time', { class: 'inc-tenue', datetime: e.creadoEn, text: fechaHora(e.creadoEn) })),
                h('span', { class: 'inc-tenue', text: e.usuario ? e.usuario.nombre : 'Sistema' }),
                p.detalle ? h('p', { text: p.detalle }) : null,
                e.texto ? h('p', { class: 'inc-evento-texto', text: e.texto }) : null,
                galeria(e.fotos, { titulo: p.titulo, detalle: `${e.usuario ? e.usuario.nombre : 'Sistema'} · ${fechaHora(e.creadoEn)}` })));
          })) : h('p', { class: 'inc-tenue', text: 'No hay nada con ese filtro.' }))),
      h('aside', { class: 'inc-detalle-lateral' }, tarjetaCursos(), tarjetaDetalles()));
  }

  function dibujar() {
    const { incidencia: i } = ctx.d;
    const { lista, acc } = botones();
    const tabs = [['resumen', 'Resumen'], ['historial', `Historial (${ctx.d.eventos.length})`]];
    montar(cont,
      h('a', { class: 'inc-volver', href: '#/mis' }, icono('arrow-back-outline'), 'Mis incidencias'),
      h('div', { class: 'inc-detalle-cabeza' },
        h('div', { class: 'inc-fila-chips' }, chipPrioridad(i.prioridad), chipEstado(i.estado, i.estadoEtiqueta), h('span', { class: 'inc-correlativo', text: i.correlativo }), i.ronda ? h('span', { class: 'inc-chip inc-chip--neutro', text: `${ordinal(i.ronda)} revisión` }) : null),
        h('h1', { class: 'inc-detalle-titulo', text: i.titulo }),
        lista.length ? h('div', { class: 'inc-acciones', role: 'group', 'aria-label': 'Acciones de la incidencia' }, lista) : null),
      avisoDeEstado(),
      h('div', { class: 'inc-tabs inc-tabs--detalle', role: 'tablist' }, tabs.map(([clave, texto]) => h('button', { class: `inc-tab${ctx.pestana === clave ? ' inc-tab--activa' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(ctx.pestana === clave), onclick: () => { ctx.pestana = clave; dibujar(); } }, texto))),
      ctx.pestana === 'historial' ? pestanaHistorial() : pestanaResumen(acc));
  }

  await cargar();
  return {
    id,
    liberar: () => { ctx.vivo = false; },
    refrescar: () => cargar({ silencioso: true })
  };
}
