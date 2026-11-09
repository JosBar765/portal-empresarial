// src/modules/proyectos/services/historialService.js
// Historial de cambios de configuración (A10): lista con filtros y restaura un valor anterior.
// Restaurar es un cambio nuevo, también auditado: nunca se reescribe ni se borra una fila del historial.
const configRepository = require('../repositories/configRepository');
const configService = require('./configService');
const catalogoService = require('./catalogoService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');
const P = require('../parametros');
const { definicion: catalogo } = require('../catalogos');

const POR_PAGINA = 20;
const AREAS = ['parametros', 'reglas', 'catalogos', 'paises', 'campos', 'alcance'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const ETIQUETAS_PAIS = {
  monedaCodigo: 'Moneda', prefijoTelefono: 'Prefijo', formatoTelefono: 'Formato de teléfono',
  referenciaObligatoria: 'Referencia obligatoria', confirmacionVentas: 'Confirmar ventas'
};
const ETIQUETAS_CAMPO = {
  etiqueta: 'Etiqueta', nicho: 'Nicho', tipo: 'Tipo', opciones: 'Opciones', obligatorio: 'Obligatorio', visibleEnLista: 'Visible en la lista', activo: 'Activo'
};
const ETIQUETAS_ALCANCE = { agregados: 'Países agregados', quitados: 'Países quitados' };
const ACCIONES = {
  crear: 'Creó', editar: 'Cambió', activar: 'Activó', desactivar: 'Desactivó', cambiar: 'Cambió', restaurar: 'Volvió al valor por defecto'
};

// MySQL entrega las columnas JSON ya convertidas; MariaDB (producción) las entrega como texto.
const dato = valor => (typeof valor === 'string' ? JSON.parse(valor) : valor);

function texto(valor, unidad) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : '—';
  return unidad ? `${valor} ${unidad}` : String(valor);
}

// Los campos que cambiaron entre dos fotos de una fila: [{ campo, antes, despues }].
function diferencias(antes, despues, etiquetas) {
  return Object.keys(etiquetas)
    .filter(clave => JSON.stringify((antes || {})[clave]) !== JSON.stringify((despues || {})[clave]))
    .map(clave => ({
      campo: etiquetas[clave],
      antes: clave === 'confirmacionVentas' && (antes || {})[clave] === null ? 'Heredar' : texto((antes || {})[clave]),
      despues: clave === 'confirmacionVentas' && (despues || {})[clave] === null ? 'Heredar' : texto((despues || {})[clave])
    }));
}

function etiquetasDeCatalogo(def) {
  const etiquetas = Object.fromEntries(def.campos.map(c => [c.clave, c.etiqueta]));
  etiquetas.activo = 'Activo';
  if (def.orden) etiquetas.orden = 'Orden';
  return etiquetas;
}

function describirFila(fila, nombresPais) {
  const antes = fila.antes ? dato(fila.antes) : null;
  const despues = fila.despues ? dato(fila.despues) : null;
  const base = { id: fila.id, fecha: fila.creado_en, usuarioId: fila.usuario_id, usuario: fila.usuario, accionCodigo: fila.accion, accion: ACCIONES[fila.accion] || fila.accion };

  if (fila.entidad === 'parametro') {
    const def = P.definicion(fila.clave);
    return {
      ...base, area: fila.clave.startsWith('reglas.') ? 'Reglas' : 'Parámetros', objeto: def ? def.etiqueta : fila.clave,
      cambios: [{ campo: 'Valor', antes: texto(antes && antes.valor, def && def.unidad), despues: texto(despues && despues.valor, def && def.unidad) }],
      restaurable: Boolean(def) && ['cambiar', 'restaurar'].includes(fila.accion) && antes !== null
    };
  }
  if (fila.entidad === 'pais') {
    return {
      ...base, area: 'Países', objeto: nombresPais.get(fila.clave) || fila.clave,
      cambios: diferencias(antes, despues, ETIQUETAS_PAIS), restaurable: fila.accion === 'cambiar' && antes !== null
    };
  }
  if (fila.entidad === 'campo') {
    const fuente = despues || antes || {};
    return {
      ...base, area: 'Campos propios', objeto: fuente.etiqueta || fila.clave,
      cambios: fila.accion === 'crear' ? [] : diferencias(antes, despues, ETIQUETAS_CAMPO), restaurable: false
    };
  }
  if (fila.entidad === 'alcance') {
    return {
      ...base, area: 'Alcance de usuarios', objeto: (despues || antes || {}).persona || fila.clave,
      cambios: diferencias(antes, despues, ETIQUETAS_ALCANCE), restaurable: false
    };
  }
  const def = catalogo(fila.entidad.replace('catalogo:', ''));
  if (!def) return { ...base, area: 'Catálogos', objeto: fila.clave, cambios: [], restaurable: false };
  return {
    ...base, area: 'Catálogos', objeto: `${def.plural} · ${fila.clave}`,
    cambios: fila.accion === 'crear' ? [] : diferencias(antes, despues, etiquetasDeCatalogo(def)),
    restaurable: ['editar', 'activar', 'desactivar'].includes(fila.accion) && antes !== null && antes.id !== undefined
  };
}

function fechaValida(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (!FECHA.test(valor) || Number.isNaN(Date.parse(valor))) throw errorDeValidacion('Revisa los filtros.', { [campo]: 'Escribe la fecha como AAAA-MM-DD.' });
  return valor;
}

function filtrosDe(consulta) {
  const area = consulta.area || '';
  if (area && !AREAS.includes(area)) throw errorDeValidacion('Revisa los filtros.', { area: 'Elige un área de la lista.' });
  const usuarioId = consulta.usuario ? aEntero(consulta.usuario) : null;
  if (consulta.usuario && usuarioId === null) throw errorDeValidacion('Revisa los filtros.', { usuario: 'Elige una persona de la lista.' });
  return { area, usuarioId, desde: fechaValida(consulta.desde, 'desde'), hasta: fechaValida(consulta.hasta, 'hasta') };
}

async function nombresDePaises() {
  return new Map((await configService.paises()).map(p => [p.codigo, p.nombre]));
}

class HistorialService {
  async listar(consulta = {}, porPagina = POR_PAGINA) {
    const filtros = filtrosDe(consulta);
    const pagina = Math.max(aEntero(consulta.pagina) || 1, 1);
    const [filas, total, nombresPais, personas] = await Promise.all([
      configRepository.listarHistorial(filtros, porPagina, (pagina - 1) * porPagina),
      configRepository.contarHistorial(filtros),
      nombresDePaises(),
      configRepository.listarPersonasConCambios()
    ]);
    return {
      items: filas.map(f => describirFila(f, nombresPais)), total, pagina, porPagina,
      hayMas: pagina * porPagina < total, personas: personas.map(p => ({ id: p.id, nombre: p.nombre }))
    };
  }

  async restaurar(id, usuarioId) {
    const fila = await configRepository.obtenerHistorial(id);
    if (!fila) throw new ErrorDeNegocio('Ese cambio no existe.', 404);
    const descrito = describirFila(fila, await nombresDePaises());
    if (!descrito.restaurable) throw new ErrorDeNegocio('Este cambio no se puede restaurar.', 409);
    const antes = dato(fila.antes);

    if (fila.entidad === 'parametro') {
      const modificados = await configService.guardar({ [fila.clave]: antes.valor }, usuarioId);
      if (!modificados.length) throw new ErrorDeNegocio('Ese ajuste ya tiene ese valor.', 409);
    } else if (fila.entidad === 'pais') {
      const pais = (await configService.paises()).find(p => p.codigo === fila.clave);
      if (!pais) throw new ErrorDeNegocio('El país ya no existe.', 404);
      if (!(await configService.guardarPais(pais.paisId, antes, usuarioId))) throw new ErrorDeNegocio('Ese país ya tiene esos valores.', 409);
    } else {
      const idCatalogo = fila.entidad.replace('catalogo:', '');
      const def = catalogo(idCatalogo);
      if (fila.accion === 'editar') {
        const datos = Object.fromEntries(def.campos.map(c => [c.clave, antes[c.clave]]));
        if (def.orden) datos.orden = antes.orden;
        await catalogoService.editar(idCatalogo, antes.id, datos, usuarioId);
      } else {
        await catalogoService.cambiarActivo(idCatalogo, antes.id, antes.activo, usuarioId);
      }
    }
    return { restaurado: true };
  }
}

module.exports = new HistorialService();
