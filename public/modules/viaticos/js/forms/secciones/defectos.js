// Sección «Inspección de carrocería y defectos»: lista agregable de defectos, cada uno con su tipo, descripción («otros») y foto obligatoria.
// Un defecto existente (al modificar) muestra su foto guardada y la conserva salvo que se cambie.
import { h, icono } from '../../utils/dom.js';
import { LIMITES_SOLICITUD } from '../../config/constantes.js';
import { crearCombo, opcionesDe } from '../../components/comboAgrupado.js';
import { crearCampo, crearSeccionForm } from '../../components/campo.js';
import { crearBotonAgregar, crearBotonQuitar } from '../../components/renglones.js';
import { abrirVisorImagen } from '../../components/visorDocumento.js';
import { urlSegura } from '../../utils/documentos.js';
import { aId } from '../datos.js';
import { defectoNuevo, limitesDeFoto, validarFoto } from '../datosCorto.js';
import { t } from '../../textos.js';


export function crearSeccionDefectos(ctx) {
  const { estado, catalogos } = ctx;
  const { tipos } = limitesDeFoto(catalogos.ajustesArchivo);
  const aceptar = tipos.length ? tipos.join(',') : 'image/*';
  const urls = new Map(); // File -> URL temporal de su miniatura
  const urlDe = (archivo) => {
    if (!urls.has(archivo)) urls.set(archivo, typeof URL.createObjectURL === 'function' ? URL.createObjectURL(archivo) : '');
    return urls.get(archivo);
  };
  const soltarUrls = (conservar = []) => {
    for (const [archivo, url] of urls) {
      if (conservar.includes(archivo)) continue;
      if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
      urls.delete(archivo);
    }
  };
  ctx.alSoltar(() => soltarUrls());

  const filas = h('div', { class: 'vi-renglones', id: 'vi-sol-defectos' });
  const vacio = h('p', { class: 'vi-ayuda vi-vacio', text: t('formulario.defectos.vacio') });
  const listaCampo = h('div', { class: 'form-field vi-lista-campo', 'data-campo': 'inspeccion.defectos' }, filas);
  const contenedorAgregar = h('div', { class: 'vi-agregar' });

  function bloqueFoto(i) {
    const fila = estado.defectos[i];
    const tiene = !!fila.foto || fila.defectoId !== null;
    const src = fila.foto ? urlDe(fila.foto) : fila.url;
    const miniatura = urlSegura(src)
      ? h('button', { type: 'button', class: 'vi-foto__vista', title: t('formulario.foto.ampliar'), 'aria-label': t('formulario.foto.ampliarDe', { n: i + 1 }), onclick: (e) => abrirVisorImagen({ titulo: t('formulario.foto.de', { n: i + 1 }), url: src, origen: e.currentTarget }) },
        h('img', { src, alt: t('formulario.foto.de', { n: i + 1 }) }))
      : h('div', { class: 'vi-foto__vista vi-foto__vista--vacia', role: 'img', 'aria-label': t('formulario.foto.sinFoto') }, icono('image-outline'));
    const entrada = (id, capture) => {
      const input = h('input', { type: 'file', id, accept: capture ? 'image/*' : aceptar, capture: capture ? 'environment' : null, hidden: true, tabindex: '-1', 'aria-hidden': 'true' });
      input.addEventListener('change', () => {
        const archivo = input.files && input.files[0];
        input.value = '';
        if (archivo) recibir(i, archivo);
      });
      return input;
    };
    const camara = entrada(`vi-sol-defecto-camara-${i}`, true);
    const archivo = entrada(`vi-sol-defecto-archivo-${i}`, false);
    const boton = (id, texto, alPulsar) => h('button', { type: 'button', class: 'btn btn--ghost btn--sm vi-foto__boton', id, text: texto, onclick: alPulsar });
    return h('div', { class: 'form-field vi-foto', 'data-campo': `inspeccion.defectos[${i}]` },
      h('div', { class: 'vi-foto__cuerpo' },
        miniatura,
        h('div', { class: 'vi-foto__acciones' },
          boton(`vi-sol-defecto-tomar-${i}`, t(tiene ? 'formulario.foto.volverATomar' : 'formulario.foto.tomar'), () => camara.click()),
          boton(`vi-sol-defecto-subir-${i}`, t(tiene ? 'formulario.foto.subirOtra' : 'formulario.foto.subir'), () => archivo.click()),
          fila.foto && boton(`vi-sol-defecto-quitarfoto-${i}`, t('formulario.foto.quitar'), () => quitarFoto(i)))),
      camara, archivo);
  }

  function renglon(i) {
    const fila = estado.defectos[i];
    const tipo = catalogos.tiposDefecto.find(x => x.id === fila.tipoDefectoId);
    const combo = crearCombo({
      id: `vi-sol-defecto-tipo-${i}`, name: `inspeccion.defectos[${i}].tipoDefectoId`, etiquetaAria: t('formulario.defectos.tipoDelDefecto', { n: i + 1 }), placeholder: t('formulario.defectos.tipoPlaceholder'),
      grupos: [{ opciones: opcionesDe(catalogos.tiposDefecto, d => d.nombre) }], valor: fila.tipoDefectoId,
      alCambiar: (v) => {
        fila.tipoDefectoId = aId(v);
        const nuevo = catalogos.tiposDefecto.find(x => x.id === fila.tipoDefectoId);
        if (!nuevo || !nuevo.esOtros) fila.descripcion = '';
        pintar(`vi-sol-defecto-tipo-${i}`);
        ctx.cambio('defectos');
      }
    });
    const campos = [crearCampo({ etiqueta: t('formulario.defectos.tipo'), control: combo, idControl: `vi-sol-defecto-tipo-${i}` })];
    if (tipo && tipo.esOtros) {
      const descripcion = h('input', {
        type: 'text', id: `vi-sol-defecto-descripcion-${i}`, name: `inspeccion.defectos[${i}].descripcion`, maxlength: String(LIMITES_SOLICITUD.DESCRIPCION), autocomplete: 'off',
        value: fila.descripcion, placeholder: t('formulario.defectos.descripcionEjemplo'), 'aria-label': t('formulario.defectos.descripcionDelDefecto', { n: i + 1 })
      });
      descripcion.addEventListener('input', () => { fila.descripcion = descripcion.value; ctx.cambio('defectos'); });
      campos.push(crearCampo({ etiqueta: t('formulario.defectos.descripcionMax', { max: LIMITES_SOLICITUD.DESCRIPCION }), control: descripcion, idControl: `vi-sol-defecto-descripcion-${i}` }));
    }
    return h('div', { class: 'vi-renglon vi-defecto', 'data-fila': String(i) },
      h('span', { class: 'vi-defecto__titulo', text: t('formulario.defectos.titulo', { n: i + 1 }) }),
      h('div', { class: 'vi-defecto__campos' }, campos),
      bloqueFoto(i),
      crearBotonQuitar({ etiqueta: t('formulario.defectos.quitar', { n: i + 1 }), alPulsar: () => quitar(i) }));
  }

  function pintar(foco) {
    filas.replaceChildren(...estado.defectos.map((_, i) => renglon(i)));
    soltarUrls(estado.defectos.map(d => d.foto).filter(Boolean));
    vacio.style.display = estado.defectos.length ? 'none' : '';
    const lleno = estado.defectos.length >= LIMITES_SOLICITUD.MAX_DEFECTOS;
    contenedorAgregar.replaceChildren(crearBotonAgregar({
      texto: t('formulario.defectos.agregar'), alPulsar: agregar, deshabilitado: lleno,
      titulo: lleno ? t('formulario.defectos.maximo', { max: LIMITES_SOLICITUD.MAX_DEFECTOS }) : undefined
    }));
    if (foco) { const nodo = filas.querySelector(`#${foco}`); if (nodo) nodo.focus(); }
  }

  // El archivo se valida al elegirlo: uno que no sirve no reemplaza a la foto que ya había y explica por qué.
  function recibir(i, archivo) {
    const fila = estado.defectos[i];
    ctx.tocados.add(`inspeccion.defectos[${i}]`);
    const error = validarFoto(archivo, catalogos.ajustesArchivo);
    if (error) fila.errorFoto = error;
    else { fila.foto = archivo; fila.defectoId = null; fila.url = ''; fila.errorFoto = null; }
    ctx.erroresServidor = [];
    pintar(`vi-sol-defecto-tomar-${i}`);
    ctx.cambio('defectos');
  }

  function quitarFoto(i) {
    estado.defectos[i].foto = null;
    estado.defectos[i].errorFoto = null;
    ctx.erroresServidor = [];
    pintar(`vi-sol-defecto-tomar-${i}`);
    ctx.cambio('defectos');
  }

  function agregar() {
    estado.defectos = [...estado.defectos, defectoNuevo()];
    ctx.erroresServidor = [];
    pintar(`vi-sol-defecto-tipo-${estado.defectos.length - 1}`);
    ctx.cambio('defectos');
  }

  function quitar(i) {
    estado.defectos = estado.defectos.filter((_, j) => j !== i);
    // Las posiciones cambian: lo «tocado» de los renglones y los errores viejos ya no apuntan a lo mismo.
    [...ctx.tocados].filter(c => c.startsWith('inspeccion.defectos[')).forEach(c => ctx.tocados.delete(c));
    ctx.erroresServidor = [];
    pintar();
    ctx.cambio('defectos');
  }

  pintar();
  const el = crearSeccionForm({ id: 'vi-sol-seccion-defectos', titulo: t('formulario.seccion.defectos'), ayuda: t('formulario.defectos.ayuda') }, vacio, listaCampo, contenedorAgregar);
  return { el };
}
