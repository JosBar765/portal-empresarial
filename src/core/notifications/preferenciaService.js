// Qué categorías quiere recibir cada usuario como notificación del sistema. Sin fila guardada = desactivado.
const { repositorio, CANALES } = require('./preferenciaRepository');
const { categoriasVisibles } = require('./categorias');
const { MODULOS } = require('../permissions/modulesCatalog');
const { ErrorDeNegocio } = require('../utils/erroresHttp');

function validarModulo(modulo) {
  if (!MODULOS.some(m => m.id === modulo)) throw new ErrorDeNegocio('El módulo de las notificaciones no es válido.');
  return modulo;
}

class PreferenciaService {
  async listar(usuario, modulo) {
    const visibles = categoriasVisibles(validarModulo(modulo), usuario);
    if (!visibles.length) return { categorias: [] };
    const guardadas = new Map((await repositorio.listar(usuario.id, modulo)).map(f => [f.categoria, f]));
    return {
      categorias: visibles.map(({ id, nombre, descripcion }) => {
        const fila = guardadas.get(id);
        return { id, nombre, descripcion, escritorio: Boolean(fila && fila.escritorio), movil: Boolean(fila && fila.movil) };
      })
    };
  }

  // Una casilla (`categoria`) o la columna completa (`todas`).
  async guardar(usuario, { modulo, categoria, todas, canal, activo } = {}) {
    const visibles = categoriasVisibles(validarModulo(modulo), usuario).map(c => c.id);
    if (!CANALES.includes(canal)) throw new ErrorDeNegocio('El canal debe ser «escritorio» o «movil».');
    if (typeof activo !== 'boolean') throw new ErrorDeNegocio('Indica si el aviso queda activado (verdadero) o desactivado (falso).');
    const destino = todas === true ? visibles : visibles.filter(id => id === categoria);
    if (!destino.length) throw new ErrorDeNegocio('Esa categoría de avisos no existe o no está disponible para tu usuario en este módulo.', 403);
    await repositorio.guardar(usuario.id, modulo, destino, canal, activo);
  }
}

module.exports = new PreferenciaService();
