// public/modules/incidencias/js/views/config/catalogos.js
// Catálogos: lo que aparece al reportar y lo que decide quién atiende cada incidencia. Nada se borra: lo que ya no sirve se apaga.
import { h, montar } from '../../utils/dom.js';
import * as api from '../../api/configApi.js';
import { abrirHoja } from '../../components/modal.js';
import { campoLinea, campoNumero, campoSelect, interruptor, nota } from '../../components/campos.js';
import { aviso, avisarError, tablaConfig, botonEditar, botonPrincipal, encabezadoPestana, tiendasDeConfig } from './comun.js';

const SUB = [
  ['categorias', 'Categorías'], ['zonas', 'Zonas'], ['tipos-activo', 'Tipos de activo'], ['especialidades', 'Especialidades'], ['motivos-espera', 'Motivos de espera']
];

const TEXTOS = {
  categorias: { nueva: 'Nueva categoría', titulo: 'categoría', ayuda: 'Cada categoría la atiende una especialidad: así se avisa a los técnicos que corresponden.' },
  zonas: { nueva: 'Nueva zona', titulo: 'zona', ayuda: 'Una zona general sirve en todas las tiendas; una zona de tienda solo en esa.' },
  'tipos-activo': { nueva: 'Nuevo tipo de activo', titulo: 'tipo de activo', ayuda: 'Lo que se puede elegir en «Activo afectado», según la categoría.' },
  especialidades: { nueva: 'Nueva especialidad', titulo: 'especialidad', ayuda: 'Lo que sabe atender cada técnico.' },
  'motivos-espera': { nueva: 'Nuevo motivo', titulo: 'motivo de espera', ayuda: 'Las razones por las que un técnico puede detener una incidencia.' }
};

const recordarSub = (id) => { try { sessionStorage.setItem('incidencias:catalogo', id); } catch (e) { /* solo comodidad */ } };
const subGuardada = () => { try { return sessionStorage.getItem('incidencias:catalogo'); } catch (e) { return null; } };

export async function mostrarCatalogos(cont) {
  let sub = SUB.some(s => s[0] === subGuardada()) ? subGuardada() : 'categorias';
  const zona = h('div', { class: 'inc-config-subpanel' });
  const subtabs = h('div', { class: 'inc-tabs inc-tabs--sub', role: 'tablist', 'aria-label': 'Catálogos' });

  async function opcionesDe(catalogo, formateo) {
    const { items } = await api.catalogo(catalogo);
    return items.filter(i => i.activo).map(formateo);
  }

  // Un formulario para crear o editar un registro (`actual` es null al crear).
  async function formulario(actual) {
    const t = TEXTOS[sub];
    const campos = [];
    const nombre = campoLinea({ etiqueta: 'Nombre', nombre: 'nombre', max: 80, valor: actual ? actual.nombre : '', obligatorio: true });
    let extra = null;
    if (sub === 'categorias') extra = campoSelect({ etiqueta: 'Especialidad que la atiende', nombre: 'especialidadId', opciones: await opcionesDe('especialidades', e => ({ valor: e.id, texto: e.nombre })), vacio: 'Cualquier técnico', obligatorio: false, valor: actual ? actual.especialidad_id : '' });
    if (sub === 'zonas') extra = campoSelect({ etiqueta: 'Dónde se usa', nombre: 'tiendaId', opciones: (await tiendasDeConfig()).map(x => ({ valor: x.id, texto: `${x.codigo} · ${x.empresa}` })), vacio: 'General: en todas las tiendas', obligatorio: false, valor: actual ? actual.tienda_id : '' });
    if (sub === 'tipos-activo') extra = campoSelect({ etiqueta: 'Categoría', nombre: 'categoriaId', opciones: await opcionesDe('categorias', c => ({ valor: c.id, texto: c.nombre })), vacio: 'Elige la categoría', valor: actual ? actual.categoria_id : '' });
    const orden = campoNumero({ etiqueta: 'Lugar en la lista (opcional)', nombre: 'orden', min: 0, max: 999, valor: actual ? actual.orden : '', ayuda: 'Los números más bajos salen primero.' });
    campos.push(nombre.el);
    if (extra) campos.push(extra.el);
    campos.push(orden.el, nota(t.ayuda));
    abrirHoja({
      titulo: actual ? `Editar ${t.titulo}` : t.nueva, contenido: h('div', { class: 'inc-formulario-hoja' }, campos),
      acciones: [{ texto: actual ? 'Guardar cambios' : `Crear ${t.titulo}`, textoOcupado: 'Guardando…', alHacerClic: async () => {
        const cuerpo = { nombre: nombre.valor() };
        if (orden.valor() !== '') cuerpo.orden = Number(orden.valor());
        if (sub === 'categorias') cuerpo.especialidadId = extra.valor() === '' ? null : Number(extra.valor());
        if (sub === 'zonas') cuerpo.tiendaId = extra.valor() === '' ? null : Number(extra.valor());
        if (sub === 'tipos-activo') cuerpo.categoriaId = extra.valor() === '' ? undefined : Number(extra.valor());
        if (actual) await api.actualizarEnCatalogo(sub, actual.id, cuerpo); else await api.crearEnCatalogo(sub, cuerpo);
        aviso('success', actual ? 'Cambios guardados' : 'Creado', nombre.valor());
        await cargarSub();
      } }]
    });
  }

  const interruptorActivo = (i) => interruptor({ activo: i.activo, etiqueta: `${i.nombre}: ${i.activo ? 'activo' : 'apagado'}`, alCambiar: async (nuevo) => {
    try { await api.actualizarEnCatalogo(sub, i.id, { activo: nuevo }); aviso('success', nuevo ? 'Encendido' : 'Apagado', i.nombre); } catch (error) { avisarError(error); throw error; }
  } });
  const nombreCelda = (i) => h('strong', { class: i.activo ? '' : 'inc-apagado', text: i.nombre });

  function tabla(items) {
    const editar = (i) => botonEditar(() => formulario(i));
    const pliegues = {
      categorias: { columnas: ['Categoría', 'Tipos de activo', 'Especialidad que atiende', 'Últimos 30 días', 'Activa', ''], celdas: i => [nombreCelda(i), h('span', { class: 'inc-tenue', text: i.tipos || '—' }), i.especialidad || 'Cualquier técnico', String(i.incidencias30), interruptorActivo(i), editar(i)] },
      zonas: { columnas: ['Zona', 'Dónde se usa', 'Veces usada', 'Activa', ''], celdas: i => [nombreCelda(i), i.tienda || 'Todas las tiendas', String(i.usos), interruptorActivo(i), editar(i)] },
      'tipos-activo': { columnas: ['Tipo de activo', 'Categoría', 'Veces usado', 'Activo', ''], celdas: i => [nombreCelda(i), i.categoria, String(i.usos), interruptorActivo(i), editar(i)] },
      especialidades: { columnas: ['Especialidad', 'Categorías', 'Técnicos', 'Activa', ''], celdas: i => [nombreCelda(i), String(i.categorias), String(i.tecnicos), interruptorActivo(i), editar(i)] },
      'motivos-espera': { columnas: ['Motivo', 'Activo', ''], celdas: i => [nombreCelda(i), interruptorActivo(i), editar(i)] }
    }[sub];
    return tablaConfig({ columnas: pliegues.columnas, filas: items.map(i => ({ celdas: pliegues.celdas(i) })), vacio: 'Todavía no hay nada aquí. Crea el primero con el botón de arriba.' });
  }

  async function cargarSub() {
    const { items } = await api.catalogo(sub);
    montar(zona, encabezadoPestana(SUB.find(s => s[0] === sub)[1], TEXTOS[sub].ayuda, botonPrincipal(TEXTOS[sub].nueva, () => formulario(null))), tabla(items));
  }

  function dibujarSubtabs() {
    montar(subtabs, SUB.map(([id, texto]) => h('button', { class: `inc-tab${id === sub ? ' inc-tab--activa' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(id === sub),
      onclick: async () => { sub = id; recordarSub(id); dibujarSubtabs(); montar(zona); await cargarSub().catch(avisarError); } }, texto)));
  }
  montar(cont, subtabs, zona);
  dibujarSubtabs();
  await cargarSub();
  return {};
}
