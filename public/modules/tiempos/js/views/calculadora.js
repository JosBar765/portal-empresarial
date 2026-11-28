// public/modules/tiempos/js/views/calculadora.js
// La calculadora: elegir producto y cantidad, ver los días y la fecha de entrega, y armar un pedido con varias piezas.
// El cálculo lo hace el servidor (con los festivos del portal); aquí solo se arma lo que se manda y se dibuja lo que vuelve.
import { h, icono, montar, sinRebote } from '../utils/dom.js';
import { campo, pie, interruptor, confirmar, cargando } from '../components/ui.js';
import { selectorProducto } from '../components/selectorProducto.js';
import { selectorFecha } from '../components/selectorFecha.js';
import { obtenerTabla, calcular } from '../api/tiemposApi.js';
import { hoyISO, fechaLarga, fechaCorta, pluralDias, rangoDe, textoRango } from '../utils/formato.js';

export async function mostrarCalculadora(cont) {
  montar(cont, cargando('Cargando la calculadora…'));
  const catalogo = await obtenerTabla();
  const params = catalogo.parametros;
  const maxPiezas = Number.isInteger(params.max_piezas) ? params.max_piezas : 20;

  let contador = 0;
  // `extras`: lo elegido de cada extra (true, clave de opción, '' = falta elegir la opción, o un número).
  const nueva = () => ({ id: ++contador, productoClave: '', cantidad: '', extras: {}, urgente: false });
  let piezas = [nueva()];
  desdeEnlace();
  let activa = 0;
  let fechaOrden = hoyISO();
  let resultado = null; // respuesta del servidor
  let indices = []; // a qué pieza de `piezas` corresponde cada pieza del resultado
  let errores = {}; // por pieza: { cantidad: 'texto' }
  let errorGeneral = '';
  let textoCopiado = '';
  let solicitud = 0;
  let respaldo = null; // la pieza tal como estaba antes de «Restablecer», para «Deshacer»
  let temporizadorDeshacer = 0;

  // Viene de «Calcular este producto» en la tabla de referencia: #/calculadora?producto=clave&cantidad=300
  function desdeEnlace() {
    const q = new URLSearchParams((window.location.hash.split('?')[1]) || '');
    const prod = catalogo.productos.find(x => x.clave === q.get('producto'));
    if (!prod) return;
    piezas[0].productoClave = prod.clave;
    if (/^\d{1,9}$/.test(q.get('cantidad') || '')) piezas[0].cantidad = q.get('cantidad');
  }
  const producto = (p) => catalogo.productos.find(x => x.clave === p.productoClave) || null;
  const cantidadNumero = (p) => (/^\d{1,9}$/.test(String(p.cantidad).trim()) ? Number(p.cantidad) : null);
  // Los extras que el administrador ofrece en este producto, en su orden.
  const extrasDe = (prod) => (prod ? prod.extras.map(k => catalogo.extras.find(e => e.clave === k)).filter(Boolean) : []);
  const faltaOpcion = (p) => Object.values(p.extras).some(v => v === '');
  const lista = (p) => Boolean(producto(p)) && cantidadNumero(p) >= 1 && !faltaOpcion(p);
  const elegidosDe = (p) => Object.fromEntries(Object.entries(p.extras).filter(([, v]) => v !== '' && v !== false && v !== undefined));

  const refs = { piezas: h('div', { class: 'tm-piezas' }), formulario: h('div'), resultado: h('section', { class: 'tm-card tm-resultado', 'aria-live': 'polite', 'aria-label': 'Resultado' }), barra: h('div', { class: 'tm-barra-resumen', hidden: '' }) };

  // ------------------------------------------------------------------ cálculo
  function cuerpoDe(p) {
    return { productoClave: p.productoClave, cantidad: cantidadNumero(p), extras: elegidosDe(p), urgente: p.urgente };
  }

  async function recalcular() {
    const ids = []; const envio = [];
    piezas.forEach((p, i) => { if (lista(p)) { ids.push(i); envio.push(cuerpoDe(p)); } });
    const mia = ++solicitud;
    if (!envio.length) { resultado = null; indices = []; errores = {}; errorGeneral = ''; textoCopiado = ''; pintarTodoMenosForm(); return; }
    try {
      const r = await calcular({ fechaOrden, piezas: envio });
      if (mia !== solicitud) return;
      resultado = r; indices = ids; errores = {}; errorGeneral = '';
    } catch (error) {
      if (mia !== solicitud) return;
      resultado = null; indices = []; errores = {}; errorGeneral = '';
      if (error.campos) {
        for (const [k, v] of Object.entries(error.campos)) { const m = /^piezas\.(\d+)\.(.+)$/.exec(k); if (m) { const pi = ids[Number(m[1])]; (errores[pi] = errores[pi] || {})[m[2]] = v; } else errorGeneral = v; }
      } else errorGeneral = error.message;
    }
    textoCopiado = '';
    pintarTodoMenosForm();
  }
  const programar = sinRebote(recalcular, 250);
  const cambio = () => { descartarRespaldo(); textoCopiado = ''; if (refs.actualizarAgregar) refs.actualizarAgregar(); programar(); };

  // ------------------------------------------------------------------ restablecer la pieza (con «Deshacer»)
  const intacta = (p) => !p.productoClave && !p.cantidad && !Object.keys(p.extras).length && !p.urgente;
  function descartarRespaldo() {
    respaldo = null; clearTimeout(temporizadorDeshacer);
    if (refs.aviso) refs.aviso.hidden = true;
  }
  function restablecer() {
    const p = piezas[activa];
    if (intacta(p)) return;
    respaldo = { indice: activa, datos: { ...p } };
    const limpia = nueva(); limpia.id = p.id; contador--; // misma pieza, sin gastar un número
    piezas[activa] = limpia;
    textoCopiado = '';
    clearTimeout(temporizadorDeshacer); temporizadorDeshacer = setTimeout(descartarRespaldo, 8000);
    pintarForm(); recalcular();
  }
  function deshacer() {
    if (!respaldo) return;
    const { indice, datos } = respaldo;
    if (piezas[indice]) { piezas[indice] = { ...datos }; activa = indice; }
    descartarRespaldo();
    pintarForm(); recalcular();
  }

  const resultadoDe = (i) => { const k = indices.indexOf(i); return k >= 0 && resultado ? resultado.piezas[k] : null; };

  // ------------------------------------------------------------------ formulario de la pieza activa
  function pintarForm() {
    const p = piezas[activa];
    const prod = producto(p);
    const ayudaCantidad = pie();
    const entrada = h('input', { type: 'text', inputmode: 'numeric', id: `cant-${p.id}`, placeholder: 'Escribe la cantidad', autocomplete: 'off', maxlength: 9, value: p.cantidad });
    const actualizarAyuda = () => {
      const n = cantidadNumero(p); const r = resultadoDe(activa);
      ayudaCantidad.classList.remove('tm-pie--aviso', 'tm-pie--error');
      if (errores[activa] && errores[activa].cantidad) { ayudaCantidad.textContent = errores[activa].cantidad; ayudaCantidad.classList.add('tm-pie--error'); return; }
      if (!prod) { ayudaCantidad.textContent = 'Elige un producto para ver el rango'; return; }
      if (p.cantidad !== '' && n === null) { ayudaCantidad.textContent = 'Escribe la cantidad como un número entero, de 1 en adelante.'; ayudaCantidad.classList.add('tm-pie--error'); return; }
      if (n !== null && n < prod.minimo) { ayudaCantidad.textContent = `Este producto se trabaja desde ${prod.minimo} piezas.`; ayudaCantidad.classList.add('tm-pie--aviso'); return; }
      const rg = rangoDe(prod, n);
      if (rg && rg.aConvenir) { ayudaCantidad.textContent = `Rango de ${rg.desde} piezas en adelante: tiempo a convenir`; ayudaCantidad.classList.add('tm-pie--aviso'); return; }
      ayudaCantidad.textContent = rg ? `Cae en el rango de ${textoRango(rg)} piezas` : `Se trabaja desde ${prod.minimo} piezas`;
      if (r && r.estado === 'a_convenir' && r.mensaje && !(rg && rg.aConvenir)) { ayudaCantidad.textContent = r.mensaje; ayudaCantidad.classList.add('tm-pie--aviso'); }
    };
    // Atajos: el inicio de cada rango del producto, para ver cómo cambian los días sin escribir.
    const atajos = h('div', { class: 'tm-atajos' });
    const pintarAtajos = () => {
      const n = cantidadNumero(p);
      const inicios = prod ? prod.rangos.filter(r => !r.aConvenir).map(r => r.desde) : [];
      atajos.hidden = !inicios.length;
      atajos.replaceChildren(...(inicios.length ? [h('span', { class: 'tm-tenue', text: 'Atajos: empieza cada rango en' }), h('div', { class: 'tm-pills' }, inicios.slice(0, 6).map(d => {
        const rg = rangoDe(prod, n); const activo = Boolean(rg) && rg.desde === d && n === d;
        return h('button', { class: `tm-pill tm-pill--chica${activo ? ' tm-pill--activa' : ''}`, type: 'button', text: String(d), onclick: () => { p.cantidad = String(d); entrada.value = p.cantidad; actualizarAyuda(); pintarAtajos(); cambio(); } });
      }))] : []));
    };
    entrada.addEventListener('input', () => { p.cantidad = entrada.value.trim(); actualizarAyuda(); pintarAtajos(); cambio(); });
    actualizarAyuda(); pintarAtajos();
    refs.actualizarAyuda = actualizarAyuda;

    const sp = selectorProducto({
      catalogo, valor: p.productoClave, id: `prod-${p.id}`,
      alElegir: (clave) => {
        const nuevoProd = catalogo.productos.find(x => x.clave === clave);
        p.productoClave = clave;
        // Lo elegido de un extra que el producto nuevo no ofrece se descarta.
        for (const k of Object.keys(p.extras)) if (!nuevoProd.extras.includes(k)) delete p.extras[k];
        pintarForm(); cambio();
      }
    });
    const fecha = selectorFecha({ valor: fechaOrden, id: 'fecha-orden', alElegir: (iso) => { fechaOrden = iso; pintarForm(); cambio(); } });

    const extras = [];
    const errorDe = (clave) => (errores[activa] && errores[activa][`extras.${clave}`]) || '';
    for (const e of extrasDe(prod)) {
      const v = p.extras[e.clave];
      if (e.tipo === 'por_unidades') {
        const u = e.unidades;
        const sel = h('select', { id: `ex-${p.id}-${e.clave}` }, Array.from({ length: u.max - (u.incluidas === 0 ? -1 : 0) }, (_, i) => i + (u.incluidas === 0 ? 0 : 1))
          .map(n => h('option', { value: String(n), text: n === u.incluidas ? `${n} (incluidos)` : String(n) })));
        sel.value = String(v === undefined ? u.incluidas : v);
        sel.addEventListener('change', () => { const n = Number(sel.value); if (n === u.incluidas) delete p.extras[e.clave]; else p.extras[e.clave] = n; cambio(); });
        extras.push(campo(e.etiqueta, sel, pie(errorDe(e.clave) || e.resumen), 'tm-campo--extra', `ex-${p.id}-${e.clave}`));
        continue;
      }
      const encendido = v !== undefined && v !== false;
      extras.push(interruptor({ marcado: encendido, etiqueta: e.etiqueta, ayuda: e.ayuda || e.resumen, alCambiar: (on) => {
        if (!on) delete p.extras[e.clave];
        else p.extras[e.clave] = e.tipo === 'por_cantidad' ? (e.opciones.length === 1 ? e.opciones[0].clave : '') : true;
        pintarForm(); cambio();
      } }));
      if (e.tipo === 'por_cantidad' && encendido && e.opciones.length > 1) {
        const tipo = h('select', { id: `ex-${p.id}-${e.clave}`, 'aria-label': `Tipo de ${e.nombre}` }, [h('option', { value: '', text: `Elige el tipo de ${e.nombre.toLowerCase()}` }), ...e.opciones.map(o => h('option', { value: o.clave, text: o.nombre }))]);
        tipo.value = v;
        tipo.addEventListener('change', () => { p.extras[e.clave] = tipo.value; cambio(); });
        extras.push(h('div', { class: 'tm-uv-tipo' }, tipo, errorDe(e.clave) ? h('p', { class: 'tm-pie tm-pie--error', text: errorDe(e.clave) }) : (v ? null : h('p', { class: 'tm-pie tm-pie--aviso', text: `Elige el tipo para calcular: cada uno suma días distintos.` }))));
      } else if (errorDe(e.clave)) extras.push(h('p', { class: 'tm-pie tm-pie--error', text: errorDe(e.clave) }));
    }
    if (!prod) extras.push(h('p', { class: 'tm-tenue', text: 'Elige un producto para ver sus extras.' }));
    else if (!extrasDe(prod).length) extras.push(h('p', { class: 'tm-tenue', text: 'Este producto no tiene extras.' }));
    extras.push(interruptor({ marcado: p.urgente, etiqueta: 'Pedido urgente', ayuda: 'Lo autoriza el gerente; aquí verás los tiempos normales', alCambiar: (v) => { p.urgente = v; cambio(); } }));

    const agregar = h('button', { class: 'btn btn--ghost tm-ancho', type: 'button', onclick: () => { descartarRespaldo(); piezas.push(nueva()); activa = piezas.length - 1; textoCopiado = ''; pintarForm(); pintarPiezas(); } }, icono('add-outline'), 'Agregar otra pieza al pedido');
    // Se vuelve a evaluar cada vez que cambia algo, no solo al dibujar el formulario.
    const botonRestablecer = h('button', { class: 'btn btn--ghost btn--chico tm-restablecer', type: 'button', onclick: restablecer }, icono('refresh-outline'), 'Restablecer');
    const aviso = h('div', { class: 'tm-aviso-deshacer', role: 'status', hidden: respaldo ? null : '' },
      h('span', { text: 'Se restableció la pieza.' }), h('button', { class: 'tm-enlace', type: 'button', onclick: deshacer }, 'Deshacer'));
    refs.aviso = aviso;
    refs.actualizarAgregar = () => {
      const lleno = piezas.length >= maxPiezas;
      const ok = lista(p) && !lleno; agregar.disabled = !ok; agregar.title = lleno ? `Un pedido admite hasta ${maxPiezas} piezas` : (ok ? '' : 'Completa esta pieza para agregar otra');
      const nada = intacta(p); botonRestablecer.disabled = nada; botonRestablecer.title = nada ? 'No hay nada que restablecer' : 'Vuelve esta pieza a cero (la fecha se conserva)';
    };
    refs.actualizarAgregar();

    montar(refs.formulario, h('section', { class: 'tm-card tm-formulario', 'aria-label': `Pieza ${activa + 1}` },
      h('div', { class: 'tm-form-cab' }, h('h2', { class: 'tm-card-titulo', text: `Pieza ${activa + 1}` }), botonRestablecer), aviso,
      campo('Producto', sp.nodo, null, '', `prod-${p.id}`),
      campo('Cantidad', entrada, h('div', null, ayudaCantidad, atajos)),
      campo('Fecha de la orden', fecha.nodo, pie('Se cuenta desde el siguiente día hábil: el día de la orden no cuenta'), '', 'fecha-orden'),
      h('div', { class: 'tm-separador' }),
      h('h3', { class: 'tm-subtitulo', text: 'Extras que cambian el tiempo' }), h('div', { class: 'tm-extras' }, extras),
      agregar));
  }

  // ------------------------------------------------------------------ otras piezas del pedido
  // Lo elegido en palabras: «4 colores», «Moldes», «Cama plana / DTF».
  function textoExtras(p) {
    return Object.entries(elegidosDe(p)).map(([k, v]) => {
      const e = catalogo.extras.find(x => x.clave === k); if (!e) return '';
      if (e.tipo === 'por_unidades') return `${v} ${e.nombre.toLowerCase()}`;
      if (e.tipo === 'por_cantidad' && e.opciones.length > 1) return (e.opciones.find(o => o.clave === v) || {}).nombre || e.nombre;
      return e.nombre;
    }).filter(Boolean);
  }

  function pintarPiezas() {
    const otras = piezas.map((p, i) => ({ p, i })).filter(({ i }) => i !== activa);
    const pedidoVarias = resultado && resultado.piezas.length > 1;
    montar(refs.piezas, otras.map(({ p, i }) => {
      const prod = producto(p); const r = resultadoDe(i);
      let dias = null; let detalle = '';
      if (r && r.estado === 'ok') { dias = h('strong', { text: pluralDias(r.total) }); detalle = [...r.etapas.map(e => `${e.nombre} ${e.dias}`), ...r.extras.map(e => `${e.nombre} ${e.dias}`), `Margen ${r.margen}`].join(' · '); }
      else if (r && r.estado === 'a_convenir') dias = h('strong', { class: 'tm-ambar', text: 'A convenir' });
      else if (!lista(p)) detalle = 'Falta completar esta pieza.';
      const masLarga = pedidoVarias && resultado.piezaMasLarga === indices.indexOf(i);
      return h('article', { class: `tm-pieza${masLarga ? ' tm-pieza--larga' : ''}`, 'aria-label': `Pieza ${i + 1}` },
        h('div', { class: 'tm-pieza-cabecera' },
          h('span', { class: 'tm-pieza-n', text: String(i + 1) }),
          h('div', { class: 'tm-pieza-texto' }, h('strong', { text: prod ? prod.nombre : 'Sin producto' }), h('span', { class: 'tm-tenue', text: [p.cantidad ? `${p.cantidad} piezas` : 'Sin cantidad', ...textoExtras(p)].join(' · ') })),
          h('div', { class: 'tm-pieza-dias' }, dias, masLarga ? h('span', { class: 'tm-etiqueta-larga', text: 'Define la entrega' }) : null)),
        detalle ? h('p', { class: 'tm-tenue tm-pieza-detalle', text: detalle }) : null,
        h('div', { class: 'tm-pieza-acciones' },
          h('button', { class: 'tm-enlace', type: 'button', onclick: () => { descartarRespaldo(); activa = i; pintarForm(); pintarPiezas(); } }, 'Editar'),
          h('button', { class: 'tm-enlace tm-enlace--peligro', type: 'button', onclick: () => quitar(i) }, 'Quitar')));
    }));
  }

  async function quitar(i) {
    const p = piezas[i]; const prod = producto(p);
    const ok = await confirmar({ titulo: `¿Quitar la pieza ${i + 1}?`, texto: `Se quitará «${prod ? prod.nombre : 'esta pieza'}${p.cantidad ? ` · ${p.cantidad} piezas` : ''}» del pedido. Los demás tiempos no cambian.`, aceptar: 'Quitar pieza', peligro: true });
    if (!ok) return;
    piezas.splice(i, 1);
    if (!piezas.length) piezas = [nueva()];
    activa = Math.min(activa > i ? activa - 1 : activa, piezas.length - 1);
    textoCopiado = '';
    pintarForm(); recalcular();
  }

  async function empezarDeNuevo() {
    if (piezas.length > 1 || piezas[0].productoClave || piezas[0].cantidad) {
      const ok = await confirmar({ titulo: '¿Empezar un pedido nuevo?', texto: 'Se borran las piezas y los datos de este pedido.', aceptar: 'Empezar de nuevo', peligro: true });
      if (!ok) return;
    }
    piezas = [nueva()]; activa = 0; fechaOrden = hoyISO(); resultado = null; indices = []; errores = {}; errorGeneral = ''; textoCopiado = ''; solicitud++;
    pintarForm(); pintarTodoMenosForm();
  }

  async function copiar() {
    if (!resultado) return;
    let copiado = false;
    try { await navigator.clipboard.writeText(resultado.resumen); copiado = true; } catch (e) {
      const t = h('textarea', { class: 'tm-oculto', 'aria-hidden': 'true' }); t.value = resultado.resumen; document.body.append(t); t.select();
      try { copiado = document.execCommand('copy'); } catch (e2) { copiado = false; } t.remove();
    }
    textoCopiado = resultado.resumen;
    if (window.toast) { if (copiado) window.toast.success('Resumen copiado', 'Pégalo en la cotización o en el chat.'); else window.toast.warning('No se pudo copiar', 'Selecciona el texto de abajo y cópialo a mano.'); }
    pintarResultado();
  }

  // ------------------------------------------------------------------ resultado
  const dot = (clase) => h('span', { class: `tm-punto ${clase}` });
  function desglose(r) {
    const filas = [...r.etapas.map(e => ({ nombre: e.nombre, dias: e.dias, clase: 'tm-punto--etapa' })), ...r.extras.map(e => ({ nombre: e.nombre, dias: e.dias, clase: 'tm-punto--extra' })), { nombre: 'Margen por imprevistos', dias: r.margen, clase: 'tm-punto--margen' }];
    const barra = h('div', { class: 'tm-barra', role: 'img', 'aria-label': 'Reparto de los días' }, filas.map(f => h('span', { class: f.clase, style: `flex: ${f.dias} 1 0` })));
    return h('div', { class: 'tm-desglose' }, h('h3', { class: 'tm-subtitulo', text: 'Qué incluye este tiempo' }), barra,
      h('ul', { class: 'tm-desglose-lista' }, filas.map(f => h('li', null, dot(f.clase), h('span', { text: f.nombre }), h('strong', { text: pluralDias(f.dias) })))));
  }

  const hero = ({ etiqueta, numero, unidad, linea1, linea2, ambar = false }) => h('div', { class: `tm-hero${ambar ? ' tm-hero--ambar' : ''}` },
    h('span', { class: 'tm-hero-etiqueta', text: etiqueta }),
    h('div', { class: 'tm-hero-numero' }, h('strong', { class: numero.length > 3 ? 'tm-hero-texto' : '', text: numero }), unidad ? h('span', { text: unidad }) : null),
    h('p', { class: 'tm-hero-linea1', text: linea1 }), linea2 ? h('p', { class: 'tm-hero-linea2', text: linea2 }) : null);

  function pintarResultado() {
    const partes = [];
    if (errorGeneral) partes.push(h('div', { class: 'tm-aviso tm-aviso--error', role: 'alert' }, icono('alert-circle-outline'), h('span', { text: errorGeneral })));
    if (!resultado) {
      if (!errorGeneral) {
        partes.push(h('div', { class: 'tm-vacio' },
          h('h2', { text: 'Elige un producto para empezar' }),
          h('ol', null, ['Elige el producto', 'Escribe la cantidad de piezas', 'Copia el resumen para el cliente'].map(t => h('li', { text: t })))));
      }
    } else {
      const pedidoVarias = resultado.piezas.length > 1;
      const nombresPieza = (k) => { const p = piezas[indices[k]]; const prod = p && producto(p); return prod ? prod.nombre : `Pieza ${indices[k] + 1}`; };
      if (resultado.estado === 'ok') {
        const desde = fechaLarga(resultado.desde).replace(/ de \d{4}$/, '');
        partes.push(hero({
          etiqueta: pedidoVarias ? 'Tiempo para prometer al cliente (pedido)' : 'Tiempo para prometer al cliente', numero: String(resultado.dias), unidad: 'días hábiles',
          linea1: `Entrega: ${resultado.fechaEntregaTexto}`,
          linea2: pedidoVarias ? `La define la pieza ${indices[resultado.piezaMasLarga] + 1} (la que más tarda) · desde el ${desde}` : `Se cuenta desde el ${desde}, de lunes a viernes y sin festivos`
        }));
        if (pedidoVarias) {
          partes.push(h('div', { class: 'tm-por-pieza' }, h('h3', { class: 'tm-subtitulo', text: 'Días por pieza' }),
            resultado.piezas.map((r, k) => h('div', { class: 'tm-por-pieza-fila' }, h('div', { class: 'tm-por-pieza-texto' }, h('span', { text: `${indices[k] + 1} · ${nombresPieza(k)}` }), h('strong', { text: pluralDias(r.total) })),
              h('span', { class: `tm-por-pieza-barra${k === resultado.piezaMasLarga ? ' tm-por-pieza-barra--larga' : ''}`, style: `width: ${Math.round((r.total / resultado.dias) * 100)}%` })))));
          partes.push(h('div', { class: 'tm-nota' }, h('strong', { text: 'Cómo se calcula el pedido' }), h('p', { text: 'Las piezas se hacen al mismo tiempo, por eso la entrega es la de la pieza que más tarda. No se suman los días de una pieza con otra.' })));
        } else partes.push(desglose(resultado.piezas[0]));
        const pr = producto(piezas[activa]);
        if (pr && !pedidoVarias) partes.splice(1, 0, h('a', { class: 'tm-enlace-tabla', href: `#/referencia?producto=${encodeURIComponent(pr.clave)}` }, 'Ver la tabla de este producto', icono('chevron-forward-outline')));
      } else if (resultado.estado === 'a_convenir') {
        const r = resultado.piezas.find(x => x.estado === 'a_convenir');
        partes.push(hero({ etiqueta: 'Tiempo para prometer al cliente', numero: 'Tiempo a convenir', linea1: r.mensaje, linea2: 'Pregunta a producción cuántos días necesita y acuerden la fecha antes de prometerla al cliente.', ambar: true }));
        if (pedidoVarias) partes.push(h('div', { class: 'tm-nota' }, h('p', { text: 'Si una pieza no tiene tiempo en la tabla, todo el pedido queda a convenir.' })));
      } else if (resultado.estado === 'bajo_minimo') {
        const r = resultado.piezas.find(x => x.estado === 'bajo_minimo');
        partes.push(hero({ etiqueta: 'Tiempo para prometer al cliente', numero: 'Cantidad muy baja', linea1: r.mensaje, linea2: 'Sube la cantidad o consulta con producción si se puede hacer.', ambar: true }));
      }
      if (resultado.urgente) partes.push(h('div', { class: 'tm-aviso tm-aviso--error' }, icono('alert-circle-outline'), h('div', null, h('strong', { text: resultado.avisoUrgente }), h('p', { text: 'La calculadora no acorta tiempos. Pide la autorización antes de prometer una fecha al cliente.' }))));
      const avisos = [...new Set([...resultado.piezas.flatMap(p => p.avisos || []).filter(a => a !== resultado.avisoUrgente), ...resultado.avisosGenerales])];
      if (avisos.length) partes.push(h('div', { class: 'tm-nota' }, h('strong', { text: 'Antes de prometer, revisa' }), h('ul', null, avisos.map(a => h('li', { text: a })))));
      partes.push(h('div', { class: 'tm-acciones' },
        h('button', { class: 'btn btn--primary', type: 'button', onclick: copiar }, icono('copy-outline'), 'Copiar resumen'),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: empezarDeNuevo }, 'Empezar de nuevo')));
      if (textoCopiado) partes.push(h('div', { class: 'tm-copiado' }, h('strong', { text: 'Texto que se copió' }), h('pre', { text: textoCopiado })));
    }
    if (!resultado && !errorGeneral) { /* solo la guía */ }
    montar(refs.resultado, partes);

    // Barra fija del celular con el resumen
    if (resultado && resultado.estado === 'ok') {
      refs.barra.hidden = false;
      montar(refs.barra, h('div', null, h('strong', { text: `${pluralDias(resultado.dias)} hábiles` }), h('span', { text: `Entrega ${fechaCorta(resultado.fechaEntrega)}` })),
        h('button', { class: 'tm-barra-boton', type: 'button', onclick: () => refs.resultado.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 'Ver detalle', icono('chevron-forward-outline')));
    } else refs.barra.hidden = true;
  }

  function pintarTodoMenosForm() { pintarResultado(); pintarPiezas(); if (refs.actualizarAyuda) refs.actualizarAyuda(); }

  pintarForm();
  pintarTodoMenosForm();
  if (lista(piezas[0])) recalcular(); // llega desde la tabla de referencia con producto y cantidad
  montar(cont,
    h('div', { class: 'tm-titulo' }, h('div', null, h('h1', { text: 'Calculadora de tiempos' }), h('p', { text: 'Elige el producto y la cantidad. Te decimos cuántos días hábiles tarda y qué día se entrega.' })),
      h('span', { class: 'tm-version', text: `Tabla de tiempos v${catalogo.version.numero} · ${catalogo.version.fecha.split('-').reverse().join('/')}` })),
    h('div', { class: 'tm-calculadora' }, h('div', { class: 'tm-col-form' }, refs.piezas, refs.formulario), refs.resultado),
    refs.barra);
  return {};
}
