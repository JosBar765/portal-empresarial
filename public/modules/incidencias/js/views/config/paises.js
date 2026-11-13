// public/modules/incidencias/js/views/config/paises.js
// Países: un interruptor por país. Apagado, quien reporta desde sus tiendas ve el aviso; lo que ya existe se conserva.
import { h, montar } from '../../utils/dom.js';
import * as api from '../../api/configApi.js';
import { abrirHoja, confirmar } from '../../components/modal.js';
import { campoLinea, interruptor, nota } from '../../components/campos.js';
import { resumir } from '../../utils/formato.js';
import { aviso, avisarError, tablaConfig, botonEditar, encabezadoPestana } from './comun.js';

export async function mostrarPaises(cont, { alCambiar } = {}) {
  let paises = (await api.paises()).paises;

  async function cambiar(p, habilitado) {
    if (!habilitado && !(await confirmar({ titulo: `Apagar ${p.nombre}`, mensaje: `Quien reporte desde las tiendas de ${p.nombre} verá el aviso «${p.aviso}» y no podrá reportar. Las incidencias que ya existen se conservan.`, aceptar: 'Apagar país', peligro: true }))) throw new Error('cancelado');
    try {
      paises = (await api.actualizarPais(p.id, { habilitado })).paises;
      aviso('success', habilitado ? 'País encendido' : 'País apagado', p.nombre);
      if (alCambiar) alCambiar();
    } catch (error) { avisarError(error); throw error; }
  }

  function editarAviso(p) {
    const texto = campoLinea({ etiqueta: 'Aviso para quien reporte desde este país', nombre: 'aviso', max: 160, valor: p.aviso, obligatorio: true, ayuda: 'Se muestra cuando el país está apagado.' });
    abrirHoja({
      titulo: `Aviso de ${p.nombre}`, contenido: h('div', { class: 'inc-formulario-hoja' }, texto.el, nota('Cada país se enciende cuando su proceso esté listo.')),
      acciones: [{ texto: 'Guardar aviso', textoOcupado: 'Guardando…', alHacerClic: async () => {
        paises = (await api.actualizarPais(p.id, { habilitado: p.habilitado, aviso: texto.valor() })).paises;
        aviso('success', 'Aviso guardado', p.nombre);
        dibujar();
      } }]
    });
  }

  function dibujar() {
    montar(cont,
      encabezadoPestana('Países', 'Dónde se pueden reportar incidencias. Cada país se enciende cuando su proceso esté listo.'),
      tablaConfig({
        columnas: ['País', 'Tiendas activas', 'Aviso si está apagado', 'Últimos 30 días', 'Habilitado', ''],
        filas: paises.map(p => ({ celdas: [
          h('strong', { text: p.nombre }), `${p.tiendas} tienda${p.tiendas === 1 ? '' : 's'}`, h('span', { class: 'inc-tenue', text: resumir(p.aviso, 60) }), String(p.incidencias30),
          interruptor({ activo: p.habilitado, etiqueta: `${p.nombre}: ${p.habilitado ? 'encendido' : 'apagado'}`, alCambiar: (nuevo) => cambiar(p, nuevo).then(dibujar) }),
          botonEditar(() => editarAviso(p), 'Aviso')
        ] }))
      }),
      h('p', { class: 'inc-nota', text: 'Con el país apagado, las incidencias que ya existen se conservan y se pueden seguir trabajando.' }));
  }
  dibujar();
  return {};
}
