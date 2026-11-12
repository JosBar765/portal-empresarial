// Filas de las tablas de Configuración como HTML puro (sin DOM); todo texto del servidor pasa por escapeHtml.
import { escapeHtml } from '../../utils/formato.js';
import { t } from '../../textos.js';
import { esProtegido, formatearMedida, nombreDestinoTramo, notasDeFila } from './modelo.js';

const celda = (etiqueta, contenido, clase = '') => `<td data-label="${escapeHtml(etiqueta)}"${clase ? ` class="${clase}"` : ''}>${contenido}</td>`;

export const tieneDetalle = (definicion) => Boolean(definicion.informativos || definicion.protegidos);

const htmlEstado = (activo) => `<span class="vi-estado${activo ? '' : ' vi-estado--inactivo'}">${escapeHtml(t(activo ? 'config.estado.activo' : 'config.estado.inactivo'))}</span>`;

const boton = ({ accion, id, icono, texto, clase = '' }) => `<button type="button" class="btn-icon${clase ? ` ${clase}` : ''}" data-accion="${accion}" data-id="${Number(id)}" title="${escapeHtml(texto)}" aria-label="${escapeHtml(texto)}"><ion-icon name="${icono}"></ion-icon></button>`;

// Editar y activar o desactivar; una fila sin botones deja su celda de acciones vacía (en el celular se oculta).
function celdaAcciones({ id, nombre, activo, editable = true, alternable = true }) {
  const botones = [];
  if (editable) botones.push(boton({ accion: 'editar', id, icono: 'create-outline', texto: t('config.accion.editarAria', { nombre }) }));
  if (alternable) {
    botones.push(activo
      ? boton({ accion: 'alternar', id, icono: 'ban-outline', texto: t('config.accion.desactivarAria', { nombre }), clase: 'icon-danger' })
      : boton({ accion: 'alternar', id, icono: 'power-outline', texto: t('config.accion.activarAria', { nombre }), clase: 'icon-success' }));
  }
  return `<td class="acciones-cell${botones.length ? '' : ' vi-acciones-vacia'}"><div class="acciones-wrap">${botones.join('')}</div></td>`;
}

export function htmlFilaCatalogo(definicion, fila) {
  const protegido = esProtegido(definicion, fila);
  const columnas = definicion.columnas.map(c => celda(t(c.etiqueta || `config.campo.${c.campo}`), escapeHtml(fila[c.campo] ?? '')));
  if (tieneDetalle(definicion)) {
    const notas = notasDeFila(definicion, fila).map(clave => escapeHtml(t(clave)));
    columnas.push(celda(t('config.col.detalle'), notas.length ? notas.join(' · ') : '—', 'vi-celda-secundaria'));
  }
  return `<tr data-id="${Number(fila.id)}"${fila.activo ? '' : ' class="is-inactiva"'}>
    ${columnas.join('\n    ')}
    ${celda(t('config.col.estado'), htmlEstado(fila.activo))}
    ${celdaAcciones({ id: fila.id, nombre: fila.nombre ?? fila.codigo ?? '', activo: fila.activo, editable: !protegido, alternable: !protegido })}
  </tr>`;
}

export const nombreDeTramo = (tramo) => `${tramo.ubicacionANombre} - ${tramo.ubicacionBNombre}`;

export function htmlFilaTramo(tramo) {
  return `<tr data-id="${Number(tramo.id)}"${tramo.activo ? '' : ' class="is-inactiva"'}>
    ${celda(t('config.tramos.col.origen'), escapeHtml(tramo.ubicacionANombre))}
    ${celda(t('config.tramos.col.destino'), escapeHtml(nombreDestinoTramo(tramo)))}
    ${celda(t('config.tramos.col.km'), escapeHtml(t('config.tramos.valorKm', { valor: formatearMedida(tramo.km) })))}
    ${celda(t('config.tramos.col.horas'), escapeHtml(t('config.tramos.valorHoras', { valor: formatearMedida(tramo.horas) })))}
    ${celda(t('config.col.estado'), htmlEstado(tramo.activo))}
    ${celdaAcciones({ id: tramo.id, nombre: nombreDeTramo(tramo), activo: tramo.activo })}
  </tr>`;
}
