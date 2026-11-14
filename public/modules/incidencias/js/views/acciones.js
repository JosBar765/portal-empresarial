// public/modules/incidencias/js/views/acciones.js
// Lo que se puede hacer con una incidencia, cada acción en una hoja modal. `d` es el detalle que devolvió el servidor
// (`acciones` dice qué cabe y `opciones` trae las listas de cada formulario); `alCambiar(respuesta)` redibuja la pantalla.
import { h, icono } from '../utils/dom.js';
import * as api from '../api/incidenciasApi.js';
import { abrirHoja } from '../components/modal.js';
import { selectorFotos } from '../components/fotos.js';
import { campoTexto, campoSelect, nota, errorDeCampos } from '../components/campos.js';
import { claveDeOperacion, fechaHora, ordinal } from '../utils/formato.js';
import { miniaturaAbrible } from '../components/visorFotos.js';

const aviso = (tipo, titulo, texto) => { if (window.toast) window.toast[tipo](titulo, texto); };
export function crearAcciones(d, alCambiar) {
  const id = d.incidencia.id;
  const correlativo = d.incidencia.correlativo;
  const fotosMax = (d.opciones && d.opciones.fotosPorAvance) || 3;
  const terminado = (respuesta, titulo, texto) => { aviso('success', titulo, texto); alCambiar(respuesta); };

  return {
    async tomar(boton) {
      if (boton) boton.disabled = true;
      try { terminado(await api.tomar(id), 'Incidencia tomada', `${correlativo} ahora es tuya.`); } catch (error) { aviso('error', 'No se pudo tomar', error.message); if (boton) boton.disabled = false; alCambiar(null); }
    },

    async reanudar(boton) {
      if (boton) boton.disabled = true;
      try { terminado(await api.reanudar(id), 'Trabajo retomado', `${correlativo} vuelve a estar en proceso.`); } catch (error) { aviso('error', 'No se pudo retomar', error.message); if (boton) boton.disabled = false; }
    },

    avance() {
      const clave = claveDeOperacion();
      const texto = campoTexto({ etiqueta: 'Qué hiciste y cómo evolucionó el problema', nombre: 'texto', filas: 4, max: 1000, placeholder: 'Cuenta qué hiciste. Quedará en el historial con fecha y hora.', obligatorio: true });
      let evolucion = '';
      const opciones = [['mejoro', 'Mejoró'], ['sin_cambios', 'Sin cambios'], ['empeoro', 'Empeoró']];
      const grupo = h('div', { class: 'inc-campo inc-campo--ancho', 'data-campo': 'evolucion' }, h('span', { class: 'inc-etiqueta', text: '¿Cómo evolucionó el problema? *' }),
        h('div', { class: 'inc-segmentos', role: 'radiogroup', 'aria-label': 'Evolución del problema' },
          opciones.map(([valor, etiqueta]) => h('label', { class: 'inc-segmento' }, h('input', { type: 'radio', name: 'evolucion', value: valor, onchange: () => { evolucion = valor; } }), h('span', { text: etiqueta })))));
      const fotos = selectorFotos({ max: fotosMax, etiqueta: 'Fotos del avance (opcional)' });
      const visible = h('input', { type: 'checkbox', id: 'acc-visible', checked: true });
      const contenido = h('div', { class: 'inc-formulario-hoja' }, texto.el, grupo, fotos.el,
        h('label', { class: 'inc-casilla', for: 'acc-visible' }, visible, h('span', { text: 'Visible para quien reportó' })));
      abrirHoja({
        titulo: `Nuevo avance · ${correlativo}`, subtitulo: d.incidencia.titulo, contenido,
        acciones: [{ texto: 'Publicar avance', textoOcupado: 'Publicando…', alHacerClic: async () => {
          const campos = {};
          if (!texto.valor()) campos.texto = 'Cuenta qué hiciste.';
          if (!evolucion) campos.evolucion = 'Indica cómo evolucionó el problema.';
          if (fotos.ocupado()) campos.fotos = 'Espera a que termine de prepararse la foto.';
          if (Object.keys(campos).length) throw errorDeCampos(campos);
          const datos = new FormData();
          datos.set('idempotencyKey', clave); datos.set('texto', texto.valor()); datos.set('evolucion', evolucion); datos.set('visibleReportante', visible.checked ? 'true' : 'false');
          fotos.archivos().forEach(a => datos.append('fotos', a, a.name));
          const r = await api.avance(id, datos);
          fotos.liberar();
          terminado(r, 'Avance publicado', 'Quedó en el historial.');
        } }]
      });
    },

    espera() {
      const motivo = campoSelect({ etiqueta: 'Motivo de la espera', nombre: 'motivoId', opciones: (d.opciones.motivosEspera || []).map(m => ({ valor: m.id, texto: m.nombre })), vacio: 'Elige el motivo' });
      const detalle = campoTexto({ etiqueta: 'Detalle para quien reportó', nombre: 'detalle', max: 500, placeholder: 'Por ejemplo: se pidió el repuesto, llega en 2 días.' });
      abrirHoja({
        titulo: `Poner en espera · ${correlativo}`, subtitulo: d.incidencia.titulo,
        contenido: h('div', { class: 'inc-formulario-hoja' }, motivo.el, detalle.el, nota('Quien reportó verá el motivo. Al retomar el trabajo, la incidencia vuelve a «En proceso».')),
        acciones: [{ texto: 'Poner en espera', textoOcupado: 'Guardando…', alHacerClic: async () => {
          if (!motivo.valor()) throw errorDeCampos({ motivoId: 'Elige el motivo de la espera.' });
          terminado(await api.ponerEnEspera(id, { motivoId: Number(motivo.valor()), detalle: detalle.valor() }), 'Puesta en espera', `${correlativo} quedó en espera.`);
        } }]
      });
    },

    enviarVerificacion() {
      const clave = claveDeOperacion();
      const resumen = campoTexto({ etiqueta: 'Resumen de lo realizado y estado final', nombre: 'resumen', filas: 4, max: 1000, placeholder: 'Qué hiciste y en qué estado quedó.', obligatorio: true });
      const fotos = selectorFotos({ max: fotosMax, obligatorio: true, etiqueta: 'Fotos del trabajo terminado' });
      const confirmo = h('input', { type: 'checkbox', id: 'acc-confirmo' });
      const casilla = h('label', { class: 'inc-casilla', for: 'acc-confirmo', 'data-campo': 'confirmo' }, confirmo, h('span', { text: 'Confirmo que el problema quedó resuelto y probado.' }));
      const revisa = (d.incidencia.verifica || []).map(p => p.nombre);
      abrirHoja({
        titulo: `Enviar a verificación · ${correlativo}`, subtitulo: d.incidencia.titulo,
        contenido: h('div', { class: 'inc-formulario-hoja' }, fotos.el, resumen.el, casilla,
          nota(revisa.length ? `La revisará ${revisa.join(', ')}. No puedes aprobar tu propio trabajo.` : 'La revisará quien verifica tu tienda. No puedes aprobar tu propio trabajo.')),
        acciones: [{ texto: 'Enviar a verificación', textoOcupado: 'Enviando…', alHacerClic: async () => {
          const campos = {};
          if (resumen.valor().length < 10) campos.resumen = 'Cuenta qué hiciste (al menos 10 caracteres).';
          if (!fotos.cantidad()) campos.fotos = 'Agrega al menos una foto del trabajo terminado.';
          if (fotos.ocupado()) campos.fotos = 'Espera a que termine de prepararse la foto.';
          if (!confirmo.checked) campos.confirmo = 'Confirma que quedó resuelto.';
          if (Object.keys(campos).length) { fotos.marcarError(campos.fotos); throw errorDeCampos(campos); }
          const datos = new FormData();
          datos.set('idempotencyKey', clave); datos.set('resumen', resumen.valor()); datos.set('confirmo', 'true');
          fotos.archivos().forEach(a => datos.append('fotos', a, a.name));
          const r = await api.enviarVerificacion(id, datos);
          fotos.liberar();
          terminado(r, 'Enviada a verificación', 'Te avisamos cuando la revisen.');
        } }]
      });
    },

    devolver() {
      const motivo = campoTexto({ etiqueta: 'Por qué la devuelves', nombre: 'motivo', max: 255, placeholder: 'Por ejemplo: necesita otra especialidad.', obligatorio: true });
      abrirHoja({
        titulo: `Devolver al buzón · ${correlativo}`, subtitulo: d.incidencia.titulo,
        contenido: h('div', { class: 'inc-formulario-hoja' }, motivo.el, nota('La incidencia vuelve al buzón compartido y queda en el historial con tu motivo.')),
        acciones: [{ texto: 'Devolver al buzón', textoOcupado: 'Devolviendo…', alHacerClic: async () => {
          if (motivo.valor().length < 3) throw errorDeCampos({ motivo: 'Cuenta por qué la devuelves.' });
          terminado(await api.devolver(id, { motivo: motivo.valor() }), 'Devuelta al buzón', `${correlativo} volvió al buzón.`);
        } }]
      });
    },

    // Quien verifica: ve el trabajo, aprueba o pide una corrección.
    revisarCierre() {
      const envio = d.eventos.find(e => e.tipo === 'a_verificacion');
      const fotosReporte = d.incidencia.fotos || [];
      // Antes y después forman una sola secuencia en el visor: se pasa de la foto del problema a la del cierre sin cerrarlo.
      const antes = fotosReporte.map(f => ({ url: f.url, titulo: 'Antes · lo que se reportó', detalle: `${d.incidencia.reportante.nombre} · ${fechaHora(d.incidencia.creadaEn)}` }));
      const despues = ((envio && envio.fotos) || []).map(f => ({ url: f.url, titulo: 'Después · foto de cierre', detalle: `${envio.usuario ? envio.usuario.nombre : 'El técnico'} · ${fechaHora(envio.creadoEn)}` }));
      const secuencia = [...antes, ...despues];
      const galeria = (titulo, lista, desde) => (lista && lista.length ? h('div', { class: 'inc-revision-fotos' }, h('span', { class: 'inc-etiqueta', text: titulo }),
        h('ul', { class: 'inc-fotos-lista inc-fotos-lista--solo-ver' }, lista.map((f, i) => h('li', { class: 'inc-foto' }, miniaturaAbrible(secuencia, desde + i, { alt: `${titulo} ${i + 1}` }))))) : null);
      const comentario = campoTexto({ etiqueta: 'Comentario o qué debe corregirse', nombre: 'comentario', max: 500, placeholder: 'Obligatorio si pides una corrección.', ayuda: 'Si apruebas, el comentario es opcional.' });
      const fotos = selectorFotos({ max: fotosMax, etiqueta: 'Fotos de apoyo para la corrección (opcional)' });
      const ronda = d.incidencia.ronda ? ` · ${ordinal(d.incidencia.ronda)} revisión` : '';
      const botones = [];
      if (d.acciones.pedirCorreccion) botones.push({ texto: 'Pedir corrección', tipo: 'peligro', textoOcupado: 'Enviando…', alHacerClic: async () => {
        if (comentario.valor().length < 3) throw errorDeCampos({ comentario: 'Escribe qué debe corregirse.' });
        const datos = new FormData();
        datos.set('comentario', comentario.valor());
        fotos.archivos().forEach(a => datos.append('fotos', a, a.name));
        const r = await api.pedirCorreccion(id, datos);
        fotos.liberar();
        terminado(r, 'Corrección pedida', 'El técnico recibió el aviso.');
      } });
      if (d.acciones.aprobar) botones.push({ texto: 'Aprobar y cerrar', tipo: 'primario', textoOcupado: 'Cerrando…', alHacerClic: async () => {
        terminado(await api.aprobar(id, { comentario: comentario.valor() }), 'Incidencia cerrada', `${correlativo} quedó resuelta.`);
      } });
      abrirHoja({
        titulo: `Revisar cierre · ${correlativo}${ronda}`, subtitulo: d.incidencia.titulo, ancho: 'lg',
        contenido: h('div', { class: 'inc-formulario-hoja' },
          nota(`La resolvió ${d.incidencia.tecnico ? d.incidencia.tecnico.nombre : 'el técnico'}. Revisa que el problema haya quedado resuelto.`, 'info'),
          h('div', { class: 'inc-revision' }, galeria('Antes · lo que se reportó', fotosReporte, 0), galeria('Después · foto de cierre', envio && envio.fotos, antes.length)),
          envio && envio.texto ? h('div', { class: 'inc-revision-resumen' }, h('span', { class: 'inc-etiqueta', text: 'Resumen del trabajo' }), h('p', { text: envio.texto })) : null,
          comentario.el, d.acciones.pedirCorreccion ? fotos.el : null),
        acciones: botones, cancelar: 'Cancelar'
      });
    },

    reasignar() {
      const actual = d.incidencia.tecnico ? d.incidencia.tecnico.id : null;
      const tecnicos = (d.opciones.tecnicos || []).filter(t => t.id !== actual).map(t => ({ valor: t.id, texto: `${t.nombre} · ${t.abiertas} abierta${Number(t.abiertas) === 1 ? '' : 's'}${t.especialidades ? ` · ${t.especialidades}` : ''}` }));
      const opciones = [...tecnicos, ...(d.incidencia.estado !== 'en_buzon' ? [{ valor: 'buzon', texto: 'Devolver al buzón compartido (cualquier técnico podrá tomarla)' }] : [])];
      const destino = campoSelect({ etiqueta: 'Nuevo responsable', nombre: 'tecnicoId', opciones, vacio: 'Elige a quién la pasas' });
      const motivo = campoTexto({ etiqueta: 'Motivo', nombre: 'motivo', max: 255, placeholder: 'Por ejemplo: el técnico ya no está disponible.', obligatorio: true });
      abrirHoja({
        titulo: `Reasignar · ${correlativo}`, subtitulo: d.incidencia.titulo,
        contenido: h('div', { class: 'inc-formulario-hoja' },
          d.incidencia.tecnico ? nota(`Responsable actual: ${d.incidencia.tecnico.nombre}.`) : nota('Esta incidencia está en el buzón: al elegir a alguien, pasa a ser suya.'),
          destino.el, motivo.el, nota('Queda en el historial con fecha, hora, motivo y quién la hizo. El nuevo responsable recibe un aviso.')),
        acciones: [{ texto: 'Reasignar', textoOcupado: 'Guardando…', alHacerClic: async () => {
          const campos = {};
          if (!destino.valor()) campos.tecnicoId = 'Elige a quién la pasas.';
          if (motivo.valor().length < 3) campos.motivo = 'Cuenta el motivo.';
          if (Object.keys(campos).length) throw errorDeCampos(campos);
          const cuerpo = destino.valor() === 'buzon' ? { destino: 'buzon', motivo: motivo.valor() } : { tecnicoId: Number(destino.valor()), motivo: motivo.valor() };
          terminado(await api.reasignar(id, cuerpo), 'Reasignada', destino.valor() === 'buzon' ? `${correlativo} volvió al buzón.` : `${correlativo} cambió de responsable.`);
        } }]
      });
    },

    descartar() {
      const motivo = campoTexto({ etiqueta: 'Motivo', nombre: 'motivo', max: 255, placeholder: 'Por ejemplo: es el mismo problema de otra incidencia.', obligatorio: true });
      const original = h('input', { id: 'acc-original', name: 'originalId', type: 'text', inputmode: 'numeric', placeholder: 'Por ejemplo: INC-000214', autocomplete: 'off' });
      const campoOriginal = h('div', { class: 'inc-campo inc-campo--ancho', 'data-campo': 'originalId' }, h('label', { for: 'acc-original', text: 'Es repetida de (opcional)' }), original);
      abrirHoja({
        titulo: `Descartar · ${correlativo}`, subtitulo: d.incidencia.titulo,
        contenido: h('div', { class: 'inc-formulario-hoja' }, motivo.el, campoOriginal,
          nota('Quien reportó será notificado y verá el motivo. La incidencia queda en el historial como descartada.', 'peligro')),
        acciones: [{ texto: 'Descartar incidencia', tipo: 'peligro', textoOcupado: 'Descartando…', alHacerClic: async () => {
          if (motivo.valor().length < 3) throw errorDeCampos({ motivo: 'Cuenta por qué se descarta.' });
          const cuerpo = { motivo: motivo.valor() };
          const numero = original.value.replace(/\D/g, '');
          if (original.value.trim() && !numero) throw errorDeCampos({ originalId: 'Escribe el número de la otra incidencia.' });
          if (numero) cuerpo.originalId = Number(numero);
          terminado(await api.descartar(id, cuerpo), 'Incidencia descartada', `${correlativo} quedó descartada.`);
        } }]
      });
    },

    cambiarPrioridad() {
      const actual = d.incidencia.prioridad.id;
      const prioridad = campoSelect({ etiqueta: 'Nueva prioridad', nombre: 'prioridadId', opciones: (d.opciones.prioridades || []).filter(p => p.id !== actual).map(p => ({ valor: p.id, texto: `${p.codigo} · ${p.nombre}` })), vacio: 'Elige la prioridad' });
      const motivo = campoTexto({ etiqueta: 'Por qué la cambias', nombre: 'motivo', max: 255, placeholder: 'Por ejemplo: no hay riesgo real, solo una molestia.', obligatorio: true });
      abrirHoja({
        titulo: `Cambiar la prioridad · ${correlativo}`, subtitulo: d.incidencia.titulo,
        contenido: h('div', { class: 'inc-formulario-hoja' }, prioridad.el, motivo.el, nota('El cambio queda en el historial; quien reportó no ve este detalle.')),
        acciones: [{ texto: 'Cambiar prioridad', textoOcupado: 'Guardando…', alHacerClic: async () => {
          const campos = {};
          if (!prioridad.valor()) campos.prioridadId = 'Elige la prioridad.';
          if (motivo.valor().length < 3) campos.motivo = 'Cuenta por qué la cambias.';
          if (Object.keys(campos).length) throw errorDeCampos(campos);
          terminado(await api.cambiarPrioridad(id, { prioridadId: Number(prioridad.valor()), motivo: motivo.valor() }), 'Prioridad cambiada', 'Quedó en el historial.');
        } }]
      });
    }
  };
}
