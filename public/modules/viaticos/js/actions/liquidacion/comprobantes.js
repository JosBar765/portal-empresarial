// Sección «Comprobantes liquidados»: los ya guardados (una fila con su información y su miniatura) y los borradores por guardar.
// Toda cifra y todo cupo salen de la última respuesta del servidor; el cliente solo descuenta los borradores abiertos.
import { h, icono } from '../../utils/dom.js';
import { LIMITES_SOLICITUD } from '../../config/constantes.js';
import { aId } from '../../utils/ids.js';
import { formatearDinero, formatearTamano } from '../../utils/formato.js';
import { tipoDeDocumento, tituloVisorComprobante, urlSegura } from '../../utils/documentos.js';
import { agregarComprobante, crearLlaveIdempotencia, mensajesDeError, quitarComprobante } from '../../api/viaticosApi.js';
import { confirmarModal } from '../../components/modal.js';
import { abrirVisorArchivo } from '../../components/visorDocumento.js';
import { crearCampo } from '../../components/campo.js';
import { crearCampoNumerico } from '../../components/campoNumerico.js';
import { crearCombo } from '../../components/comboAgrupado.js';
import { crearAviso } from '../../components/aviso.js';
import { crearBotonAgregar, crearBotonQuitar } from '../../components/renglones.js';
import { enfocarPrimerCampoInvalido, limpiarErrorCampo, marcarErroresDeCampos } from '../../components/validacion.js';
import { aceptarArchivos, borradorNuevo, llaveDeIntento, montoDeBorrador, rubrosConCupo, validarArchivoComprobante, validarBorrador } from './datos.js';
import { t } from '../../textos.js';

const textoDeError = (e) => (typeof e === 'string' ? e : t(e.clave, e.params));

// Miniatura que abre el archivo; también la usa la liquidación de solo lectura de Gestiones.
export function miniatura({ url, tipo, etiquetaAria, alPulsar }) {
  const imagen = tipo === 'imagen' && urlSegura(url);
  return h('button', { type: 'button', class: 'vi-comp__miniatura', 'aria-label': etiquetaAria, onclick: (e) => alPulsar(e.currentTarget) },
    imagen ? h('img', { src: url, alt: '', loading: 'lazy' }) : icono('document-outline'));
}

// `obtenerLiq()` devuelve la última liquidación del servidor; `alActualizar(liq)` la reemplaza (resumen, pendientes y esta sección).
export function crearComprobantes({ solicitudId, ajustes, obtenerLiq, alActualizar }) {
  const borradores = [];
  let guardando = false;
  const urls = new Map(); // File -> URL temporal de su vista previa

  const urlDe = (archivo) => {
    if (!urls.has(archivo)) urls.set(archivo, typeof URL.createObjectURL === 'function' ? URL.createObjectURL(archivo) : '');
    return urls.get(archivo);
  };
  const soltarUrl = (archivo) => {
    if (!archivo || !urls.has(archivo)) return;
    const url = urls.get(archivo);
    if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    urls.delete(archivo);
  };

  const guardados = h('div', { class: 'vi-renglones', id: 'vi-liq-guardados' });
  const vacio = h('p', { class: 'vi-ayuda vi-vacio', id: 'vi-liq-vacio', text: t('liquidacion.comprobantes.vacio') });
  const bloqueBorradores = h('div', { class: 'vi-renglones', id: 'vi-liq-borradores' });
  const contenedorAgregar = h('div', { class: 'vi-agregar', id: 'vi-liq-agregar' });
  const el = h('section', { class: 'vi-liq-seccion', 'aria-labelledby': 'vi-liq-comprobantes-titulo' },
    h('h4', { class: 'vi-form-seccion__titulo', id: 'vi-liq-comprobantes-titulo', text: t('liquidacion.comprobantes.titulo') }),
    vacio, guardados, bloqueBorradores, contenedorAgregar);

  const campoDato = (etiqueta, valor, clase = '') => h('div', { class: `vi-comp__dato ${clase}`.trim() },
    h('span', { class: 'vi-comp__etiqueta', text: etiqueta }),
    h('span', { class: 'vi-comp__valor', text: valor }));

  // ---------- Comprobantes guardados ----------
  function filaGuardada(c, liq, indice) {
    const simbolo = liq.moneda ? liq.moneda.simbolo : '';
    const tipo = tipoDeDocumento({ tipo: c.tipoArchivo, url: c.url });
    const quitar = liq.editable && crearBotonQuitar({ etiqueta: t('liquidacion.quitar.aria', { rubro: c.rubro }), alPulsar: (e) => quitarGuardado(c, simbolo, e.currentTarget) });
    return h('div', { class: 'vi-comp', 'data-comprobante': String(c.id) },
      h('span', { class: 'vi-comp__titulo', text: t('liquidacion.comprobante.n', { n: indice + 1 }) }),
      h('div', { class: 'vi-comp__info' },
        campoDato(t('liquidacion.col.rubro'), c.rubro),
        campoDato(t('liquidacion.col.monto', { simbolo }), formatearDinero(simbolo, c.monto)),
        c.descripcion && campoDato(t('liquidacion.col.descripcion'), c.descripcion, 'vi-comp__dato--ancho')),
      h('div', { class: 'vi-comp__archivo' },
        miniatura({
          url: c.url, tipo, etiquetaAria: t('liquidacion.archivo.ver', { rubro: c.rubro, archivo: c.nombreArchivo }),
          alPulsar: (origen) => abrirVisorArchivo({ titulo: tituloVisorComprobante(c.rubro), url: c.url, tipo, origen })
        }),
        h('div', { class: 'vi-comp__meta' },
          h('strong', { text: c.nombreArchivo }),
          h('small', { text: t('liquidacion.archivo.meta', { tamano: formatearTamano(c.tamano) }) }))),
      quitar || null);
  }

  const quitando = new Set();
  async function quitarGuardado(c, simbolo, boton) {
    if (quitando.has(c.id) || guardando) return;
    const confirmada = await confirmarModal({
      title: t('liquidacion.quitar.titulo'),
      mensaje: t('liquidacion.quitar.mensaje', { rubro: c.rubro, monto: formatearDinero(simbolo, c.monto) }),
      aceptar: t('liquidacion.quitar.confirmar'),
      peligro: true
    });
    if (!confirmada) return;
    quitando.add(c.id);
    boton.disabled = true;
    try {
      const liq = await quitarComprobante(solicitudId, c.id);
      alActualizar(liq);
      window.toast?.success(t('tab.solicitudes'), t('liquidacion.quitar.exito'));
    } catch (error) {
      boton.disabled = false;
      window.toast?.error(t('liquidacion.quitar.error'), mensajesDeError(error).join(' '));
    } finally {
      quitando.delete(c.id);
    }
  }

  // ---------- Borradores ----------
  const esOtros = (liq, b) => {
    const p = liq.pendientes.find(x => Number(x.tipoGastoId) === Number(b.tipoGastoId));
    return !!(p && p.esOtros);
  };

  function mensajesDe(b) {
    return Object.fromEntries(Object.entries(b.errores).map(([campo, e]) => [campo, textoDeError(e)]));
  }

  function seleccionarArchivo(b, archivo) {
    const error = validarArchivoComprobante(archivo, ajustes);
    if (error) { b.errores.archivo = error; }
    else { soltarUrl(b.archivo); b.archivo = archivo; delete b.errores.archivo; }
    pintarBorradores(`vi-liq-b${b.n}-tomar`);
  }

  function bloqueArchivo(b) {
    const id = (x) => `vi-liq-b${b.n}-${x}`;
    const aceptar = aceptarArchivos(ajustes);
    const entrada = (idInput, capture) => {
      const input = h('input', { type: 'file', id: idInput, accept: capture ? 'image/*' : aceptar, capture: capture ? 'environment' : null, hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
      input.addEventListener('change', () => {
        const archivo = input.files && input.files[0];
        input.value = '';
        if (archivo) seleccionarArchivo(b, archivo);
      });
      return input;
    };
    const camara = entrada(id('camara'), true);
    const subir = entrada(id('archivo'), false);
    const boton = (idBoton, texto, alPulsar) => h('button', { type: 'button', class: 'btn btn--ghost btn--sm vi-foto__boton', id: idBoton, text: texto, disabled: b.enviando, onclick: alPulsar });
    const a = b.archivo;
    const vista = a
      ? miniatura({
        url: urlDe(a), tipo: tipoDeDocumento({ tipo: a.type, url: a.name }), etiquetaAria: t('liquidacion.archivo.vistaPrevia', { archivo: a.name }),
        alPulsar: (origen) => abrirVisorArchivo({ titulo: a.name, url: urlDe(a), tipo: tipoDeDocumento({ tipo: a.type, url: a.name }), origen })
      })
      : h('div', { class: 'vi-comp__miniatura vi-comp__miniatura--vacia', role: 'img', 'aria-label': t('liquidacion.archivo.sinArchivo') }, icono('image-outline'));
    return h('div', { class: 'form-field vi-comp__archivo', 'data-campo': 'archivo', role: 'group', 'aria-labelledby': id('archivo-etiqueta') },
      h('span', { class: 'vi-etiqueta', id: id('archivo-etiqueta'), text: t('liquidacion.col.archivo') }),
      h('div', { class: 'vi-comp__archivo-cuerpo' },
        vista,
        h('div', { class: 'vi-comp__meta' },
          a ? h('strong', { text: a.name }) : h('small', { text: t('liquidacion.archivo.ayuda') }),
          a && h('small', { text: formatearTamano(a.size) }),
          h('div', { class: 'vi-comp__botones' },
            boton(id('tomar'), t('liquidacion.archivo.tomar'), () => camara.click()),
            boton(id('subir'), t(a ? 'liquidacion.archivo.cambiar' : 'liquidacion.archivo.subir'), () => subir.click())))),
      camara, subir);
  }

  function filaBorrador(b, liq) {
    const id = (x) => `vi-liq-b${b.n}-${x}`;
    const simbolo = liq.moneda ? liq.moneda.simbolo : '';
    const otros = esOtros(liq, b);
    const limpiar = (campo, nodo) => { delete b.errores[campo]; b.aviso = null; limpiarErrorCampo(nodo); };

    const combo = crearCombo({
      id: id('tipo'), name: 'tipoGastoId', placeholder: t('liquidacion.borrador.rubroPlaceholder'), valor: b.tipoGastoId, deshabilitado: b.enviando,
      grupos: [{ opciones: rubrosConCupo(liq.pendientes, borradores, b).map(r => ({ valor: r.tipoGastoId, texto: t('liquidacion.borrador.rubroOpcion', { nombre: r.nombre, n: r.restantes }) })) }],
      alCambiar: (valor) => {
        b.tipoGastoId = aId(valor);
        delete b.errores.tipoGastoId;
        if (!esOtros(obtenerLiq(), b)) { b.descripcion = ''; delete b.errores.descripcion; }
        pintarBorradores(id('tipo'));
      }
    });
    const monto = crearCampoNumerico({ id: id('monto'), name: 'monto', valor: b.monto, placeholder: t('liquidacion.borrador.montoEjemplo'), alCambiar: (v) => { b.monto = v; limpiar('monto', monto); } });
    monto.disabled = b.enviando;
    const campos = [
      crearCampo({ etiqueta: t('liquidacion.col.rubro'), control: combo, idControl: id('tipo'), clase: 'vi-comp__rubro' }),
      crearCampo({ etiqueta: t('liquidacion.col.monto', { simbolo }), control: monto, idControl: id('monto'), clase: 'vi-comp__monto' })
    ];
    if (otros) {
      const descripcion = h('input', {
        type: 'text', id: id('descripcion'), name: 'descripcion', maxlength: String(LIMITES_SOLICITUD.DESCRIPCION), autocomplete: 'off', value: b.descripcion,
        placeholder: t('liquidacion.borrador.descripcionEjemplo'), disabled: b.enviando
      });
      descripcion.addEventListener('input', () => { b.descripcion = descripcion.value; limpiar('descripcion', descripcion); });
      campos.push(crearCampo({ etiqueta: t('liquidacion.borrador.descripcion', { max: LIMITES_SOLICITUD.DESCRIPCION }), control: descripcion, idControl: id('descripcion'), clase: 'vi-comp__descripcion' }));
    }
    const guardar = h('button', {
      type: 'button', class: `btn btn--primary btn--sm vi-comp__guardar${b.enviando ? ' btn--loading' : ''}`, id: id('guardar'), text: t('liquidacion.borrador.guardar'),
      disabled: guardando, onclick: () => guardarBorrador(b)
    });
    const fila = h('div', { class: 'vi-comp vi-comp--borrador', 'data-borrador': String(b.n) },
      h('div', { class: 'vi-comp__campos' }, campos),
      bloqueArchivo(b),
      h('div', { class: 'vi-comp__pie' }, guardar,
        crearBotonQuitar({ etiqueta: t('liquidacion.borrador.descartar'), alPulsar: () => descartar(b), deshabilitado: b.enviando })));
    marcarErroresDeCampos(fila, mensajesDe(b));
    if (b.aviso) fila.append(h('div', { class: 'vi-comp__aviso', 'aria-live': 'assertive' }, crearAviso({ tipo: 'error', titulo: t('liquidacion.borrador.errorGuardar'), texto: b.aviso })));
    return fila;
  }

  async function guardarBorrador(b) {
    if (guardando) return;
    const liq = obtenerLiq();
    const otros = esOtros(liq, b);
    b.aviso = null;
    const errores = validarBorrador(b, { esOtros: otros });
    if (Object.keys(errores).length) {
      b.errores = errores;
      pintarBorradores();
      const fila = bloqueBorradores.querySelector(`[data-borrador="${b.n}"]`);
      if (fila) enfocarPrimerCampoInvalido(fila);
      return;
    }
    b.errores = {};
    b.enviando = true;
    guardando = true;
    pintarBorradores();
    try {
      const respuesta = await agregarComprobante(solicitudId, {
        archivo: b.archivo, tipoGastoId: b.tipoGastoId, monto: montoDeBorrador(b.monto).valor,
        descripcion: otros ? String(b.descripcion).trim() : undefined,
        idempotencyKey: llaveDeIntento(b, crearLlaveIdempotencia)
      });
      guardando = false;
      borradores.splice(borradores.indexOf(b), 1);
      soltarUrl(b.archivo);
      const { comprobante, ...nueva } = respuesta;
      alActualizar(nueva);
      window.toast?.success(t('tab.solicitudes'), t('liquidacion.borrador.guardado', { rubro: comprobante.rubro }));
      const nodo = guardados.querySelector(`[data-comprobante="${comprobante.id}"] .vi-comp__miniatura`);
      if (nodo) nodo.focus();
    } catch (error) {
      guardando = false;
      b.enviando = false;
      if (error.status === 400 && error.campos && Object.keys(error.campos).length) b.errores = error.campos;
      else b.aviso = mensajesDeError(error).join(' ');
      pintarBorradores();
      const fila = bloqueBorradores.querySelector(`[data-borrador="${b.n}"]`);
      if (fila && fila.querySelector('.is-invalid')) enfocarPrimerCampoInvalido(fila);
    }
  }

  function descartar(b) {
    if (b.enviando) return;
    borradores.splice(borradores.indexOf(b), 1);
    soltarUrl(b.archivo);
    pintarBorradores();
    pintarAgregar();
    const agregar = contenedorAgregar.querySelector('button');
    if (agregar) agregar.focus();
  }

  function agregarBorrador() {
    const b = borradorNuevo();
    borradores.push(b);
    pintarBorradores(`vi-liq-b${b.n}-tipo`);
    pintarAgregar();
  }

  // Repinta los borradores sin perder lo escrito (todo vive en el objeto del borrador); `foco` es el id que recupera el foco.
  function pintarBorradores(foco) {
    const activo = foco || (document.activeElement && document.activeElement.id);
    const liq = obtenerLiq();
    vacio.hidden = liq.comprobantes.length > 0 || borradores.length > 0;
    bloqueBorradores.replaceChildren(...borradores.map(b => filaBorrador(b, liq)));
    pintarAgregar();
    if (activo) { const nodo = bloqueBorradores.querySelector(`#${CSS.escape(activo)}`); if (nodo && !nodo.disabled) nodo.focus(); }
  }

  function pintarAgregar() {
    const liq = obtenerLiq();
    const puede = liq.editable && rubrosConCupo(liq.pendientes, borradores).length > 0;
    contenedorAgregar.replaceChildren(...(puede ? [crearBotonAgregar({ texto: t('liquidacion.borrador.agregar'), alPulsar: agregarBorrador })] : []));
  }

  function pintar() {
    const liq = obtenerLiq();
    guardados.replaceChildren(...liq.comprobantes.map((c, i) => filaGuardada(c, liq, i)));
    // Si ya no se puede editar (p. ej. quedó liquidada) los borradores no tienen dónde guardarse.
    if (!liq.editable) borradores.splice(0).forEach(b => soltarUrl(b.archivo));
    pintarBorradores();
  }

  return {
    el,
    pintar,
    hayBorradores: () => borradores.length > 0,
    enCurso: () => guardando || quitando.size > 0,
    descartarBorradores: () => { borradores.splice(0).forEach(b => soltarUrl(b.archivo)); pintarBorradores(); },
    soltar: () => { [...urls.keys()].forEach(soltarUrl); }
  };
}
