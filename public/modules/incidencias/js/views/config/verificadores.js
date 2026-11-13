// public/modules/incidencias/js/views/config/verificadores.js
// Verificadores: quién aprueba que una incidencia quedó resuelta, por tienda o por país entero.
import { h, montar } from '../../utils/dom.js';
import * as api from '../../api/configApi.js';
import { abrirHoja, confirmar } from '../../components/modal.js';
import { campoSelect, nota } from '../../components/campos.js';
import { aviso, avisarError, tablaConfig, botonPrincipal, encabezadoPestana, selectorPersonas } from './comun.js';

export async function mostrarVerificadores(cont, { alCambiar } = {}) {
  let datos = await api.verificadores();

  function formulario(tienda = null) {
    const persona = selectorPersonas({ buscar: api.candidatosVerificador, etiqueta: 'Persona' });
    const opciones = [...datos.tiendas.map(t => ({ valor: `t${t.id}`, texto: `${t.codigo} · ${t.empresa}` })), ...datos.paises.map(p => ({ valor: `p${p.id}`, texto: `Todo ${p.nombre}` }))];
    const donde = campoSelect({ etiqueta: 'Qué verifica', nombre: 'tiendaId', opciones, vacio: 'Elige una tienda o un país', valor: tienda ? `t${tienda.id}` : '' });
    abrirHoja({
      titulo: 'Agregar verificador', contenido: h('div', { class: 'inc-formulario-hoja' }, persona.el, donde.el, nota('Quien trabajó una incidencia nunca la verifica. Si una tienda no tiene verificador, vale el del país.')),
      acciones: [{ texto: 'Agregar verificador', textoOcupado: 'Guardando…', alHacerClic: async () => {
        const p = persona.elegida();
        const v = donde.valor();
        const cuerpo = { usuarioId: p ? p.id : undefined };
        if (v.startsWith('t')) cuerpo.tiendaId = Number(v.slice(1)); else if (v.startsWith('p')) cuerpo.paisId = Number(v.slice(1));
        datos = await api.agregarVerificador(cuerpo);
        aviso('success', 'Verificador agregado', p ? p.nombre : '');
        if (alCambiar) alCambiar();
        dibujar();
      } }]
    });
  }

  async function quitar(v, donde) {
    if (!(await confirmar({ titulo: 'Quitar verificador', mensaje: `${v.nombre} dejará de verificar ${donde}. Las incidencias que ya revisó no cambian.`, aceptar: 'Quitar', peligro: true }))) return;
    try { datos = await api.quitarVerificador(v.id); aviso('success', 'Verificador quitado', v.nombre); if (alCambiar) alCambiar(); dibujar(); } catch (error) { avisarError(error, 'No se pudo quitar'); }
  }

  const personas = (arr, donde) => (arr.length
    ? h('div', { class: 'inc-fichas' }, arr.map(v => h('span', { class: 'inc-ficha' }, v.nombre, v.sinPermiso ? h('span', { class: 'inc-chip inc-chip--alerta', title: 'Su rol no puede verificar', text: 'Sin permiso' }) : null,
      h('button', { class: 'inc-ficha-quitar', type: 'button', 'aria-label': `Quitar a ${v.nombre}`, onclick: () => quitar(v, donde) }, '×'))))
    : h('span', { class: 'inc-tenue', text: '—' }));

  function dibujar() {
    montar(cont,
      encabezadoPestana('Verificadores', 'Quién aprueba que una incidencia quedó resuelta.', botonPrincipal('Agregar verificador', () => formulario())),
      datos.sinVerificador > 0 ? h('div', { class: 'inc-banner inc-banner--atencion' }, h('span', { text: `${datos.sinVerificador} tienda${datos.sinVerificador === 1 ? '' : 's'} sin verificador: sus cierres los verá cualquiera con el permiso de verificar.` })) : null,
      h('h3', { class: 'inc-subtitulo', text: 'Por país' }),
      tablaConfig({ columnas: ['País', 'Verificadores'], filas: datos.paises.map(p => ({ celdas: [h('strong', { text: p.nombre }), personas(p.verificadores, `todo ${p.nombre}`)] })), vacio: 'No hay países encendidos.' }),
      h('h3', { class: 'inc-subtitulo', text: 'Por tienda' }),
      tablaConfig({ columnas: ['Tienda', 'Verificadores propios', 'Quién verifica'], filas: datos.tiendas.map(t => ({ clase: t.efectivo ? '' : 'inc-fila-alerta', celdas: [
        h('strong', { text: `${t.codigo} · ${t.empresa}` }), personas(t.verificadores, t.codigo),
        t.efectivo === 'tienda' ? 'La tienda' : (t.efectivo === 'pais' ? 'El país' : h('span', { class: 'inc-chip inc-chip--alerta', text: 'Nadie' }))] })) }));
  }
  dibujar();
  return {};
}
