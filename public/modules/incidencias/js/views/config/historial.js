// public/modules/incidencias/js/views/config/historial.js
// Historial de cambios de la configuración: quién cambió qué y cuándo (solo lectura).
import { h } from '../../utils/dom.js';
import * as api from '../../api/configApi.js';
import { abrirHoja } from '../../components/modal.js';
import { fechaHora } from '../../utils/formato.js';
import { mensajeDe } from './comun.js';

const ENTIDADES = { pais: 'País', categorias: 'Categoría', zonas: 'Zona', 'tipos-activo': 'Tipo de activo', especialidades: 'Especialidad', 'motivos-espera': 'Motivo de espera', prioridad: 'Prioridad', reglas_prioridad: 'Reglas de prioridad', parametros: 'Parámetros', tecnico: 'Técnico', verificador: 'Verificador', rol: 'Rol' };
const ACCIONES = { crear: 'creó', cambiar: 'cambió', encender: 'encendió', apagar: 'apagó', quitar: 'quitó' };

export function abrirHistorial() {
  const lista = h('ul', { class: 'inc-historial-config' }, h('li', { class: 'inc-tenue', text: 'Cargando…' }));
  abrirHoja({ titulo: 'Historial de cambios', contenido: h('div', { class: 'inc-formulario-hoja' }, lista), acciones: [] });
  api.historial(60).then(({ cambios }) => {
    lista.replaceChildren(...(cambios.length ? cambios.map(c => h('li', null,
      h('strong', { text: c.usuario || 'Alguien' }), ` ${ACCIONES[c.accion] || c.accion} `, h('span', { text: `${ENTIDADES[c.entidad] || c.entidad}: ${c.clave}` }),
      h('div', { class: 'inc-tenue', text: fechaHora(c.creadoEn) }))) : [h('li', { class: 'inc-tenue', text: 'Todavía no hay cambios.' })]));
  }).catch(error => lista.replaceChildren(h('li', { class: 'inc-tenue', text: mensajeDe(error) })));
}
