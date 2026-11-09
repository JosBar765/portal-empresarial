// src/modules/proyectos/services/cierreService.js
// Cierre de un proyecto y visto bueno del gerente. Cerrar congela el informe, libera las tiendas y las empresas y deja el proyecto
// de solo lectura; con `reglas.visto_bueno_cierre` encendida queda esperando el visto bueno, que se da o se devuelve con comentarios.
const informeService = require('./informeService');
const seguimientoService = require('./seguimientoService');
const configService = require('./configService');
const proyectoRepository = require('../repositories/proyectoRepository');
const informeRepository = require('../repositories/informeRepository');
const avisosService = require('./avisosService');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { errorDeValidacion } = require('../errores');

const MAXIMO_CONCLUSIONES = 4000;
const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const exigir = (usuario, permiso, mensaje) => { if (!tiene(usuario, permiso)) throw new ErrorDeNegocio(mensaje, 403); };
const limpio = (v) => String(v == null ? '' : v).trim();

class CierreService {
  // Avisa sin hacer fallar la operación si la notificación no sale.
  async _avisar(clave, datos) {
    try { await avisosService.notificar(clave, { referenciaTipo: 'proyecto', ...datos }); } catch (error) { console.error('[Proyectos] No se pudo enviar el aviso:', error.message); }
  }

  _conclusiones(valor, campos) {
    const texto = limpio(valor);
    if (!texto) campos.conclusiones = 'Escribe las conclusiones: qué funcionó, qué no y qué recomiendas.';
    else if (texto.length > MAXIMO_CONCLUSIONES) campos.conclusiones = `Las conclusiones admiten hasta ${MAXIMO_CONCLUSIONES} caracteres.`;
    return texto;
  }

  // `datos`: { conclusiones, confirmado: true, idempotencyKey }
  async cerrar(usuario, proyectoId, datos = {}) {
    exigir(usuario, 'proyectos.activar', 'No tienes permiso para cerrar proyectos.');
    const { proyecto } = await seguimientoService._acceso(usuario, proyectoId);
    const campos = {};
    const conclusiones = this._conclusiones(datos.conclusiones, campos);
    if (datos.confirmado !== true) campos.confirmado = 'Confirma que revisaste las conclusiones y el informe.';
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos del cierre.', campos);
    const conVistoBueno = Boolean(await configService.obtener('reglas.visto_bueno_cierre'));

    const resultado = await seguimientoService._unaVez(usuario, 'cerrar', proyecto.id, datos.idempotencyKey, async (tx) => {
      // Orden fijo de bloqueo: proyecto → participaciones. Con todo bloqueado no queda ningún registro a medias al congelar el informe.
      await tx.query('SELECT id FROM proy_proyectos WHERE id = ? FOR UPDATE', [proyecto.id], 'proyectos_cierre:bloquear_proyecto');
      await tx.query('SELECT id FROM proy_participaciones WHERE proyecto_id = ? ORDER BY id FOR UPDATE', [proyecto.id], 'proyectos_cierre:bloquear_participaciones');
      const informe = await informeService.calcular(proyecto.id);
      const cambiado = await proyectoRepository.cambiarEstado(tx, proyecto.id, ['activo'], 'cerrado', {
        cerrado_por: usuario.id, cerrado_en: new Date(), conclusiones, resumen_cierre: JSON.stringify(informe), visto_bueno_estado: conVistoBueno ? 'pendiente' : null
      });
      if (cambiado !== 1) throw new ErrorDeNegocio('Este proyecto ya no está activo.', 409);
      await proyectoRepository.cerrarTiendas(tx, proyecto.id);
      await proyectoRepository.liberarEmpresas(tx, proyecto.id);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'cerrar', detalle: { sinGestionar: informe.cifras.sinGestionar, vendidas: informe.cifras.vendidas, vistoBueno: conVistoBueno } });
      return { proyectoId: proyecto.id, estado: 'cerrado', vistoBueno: conVistoBueno ? 'pendiente' : null, sinGestionar: informe.cifras.sinGestionar };
    });
    if (!resultado.repetida && conVistoBueno) await this._avisar('cierre_pendiente', { proyectoId: proyecto.id, autorId: usuario.id, referenciaId: proyecto.id, mensaje: `Cierre pendiente de tu visto bueno: «${proyecto.nombre}».` });
    return { ...resultado, ...(await informeService.obtener(usuario, proyecto.id)) };
  }

  async _cerradoConVistoBueno(usuario, proyectoId, permiso, mensaje) {
    exigir(usuario, permiso, mensaje);
    const { proyecto } = await seguimientoService._acceso(usuario, proyectoId);
    if (proyecto.estado !== 'cerrado') throw new ErrorDeNegocio('Este proyecto todavía no está cerrado.', 409);
    const completo = await informeRepository.proyecto(proyecto.id);
    return completo;
  }

  // El gerente da el visto bueno (comentario opcional).
  async darVistoBueno(usuario, proyectoId, datos = {}) {
    const proyecto = await this._cerradoConVistoBueno(usuario, proyectoId, 'proyectos.dar_visto_bueno', 'No tienes permiso para dar el visto bueno.');
    const comentario = limpio(datos.comentario);
    if (comentario.length > 500) throw errorDeValidacion('Revisa los datos.', { comentario: 'El comentario admite hasta 500 caracteres.' });
    const resultado = await seguimientoService._unaVez(usuario, 'visto-bueno', proyecto.id, datos.idempotencyKey, async (tx) => {
      const cambiado = await tx.query(
        "UPDATE proy_proyectos SET visto_bueno_estado = 'dado', visto_bueno_por = ?, visto_bueno_en = ?, visto_bueno_comentario = ? WHERE id = ? AND estado = 'cerrado' AND visto_bueno_estado = 'pendiente'",
        [usuario.id, new Date(), comentario || null, proyecto.id], 'proyectos_cierre:visto_bueno');
      if (cambiado.affectedRows !== 1) throw new ErrorDeNegocio('Este cierre ya no está esperando el visto bueno.', 409);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'visto_bueno', detalle: { comentario: comentario || null } });
      return { proyectoId: proyecto.id, vistoBueno: 'dado' };
    });
    if (!resultado.repetida) await this._avisar('visto_bueno_resuelto', { proyectoId: proyecto.id, autorId: usuario.id, explicitos: { supervisor: [proyecto.cerrado_por_id] }, referenciaId: proyecto.id, mensaje: `Dieron el visto bueno a «${proyecto.nombre}».` });
    return { ...resultado, ...(await informeService.obtener(usuario, proyecto.id)) };
  }

  // El gerente devuelve el cierre con comentarios (obligatorios).
  async devolver(usuario, proyectoId, datos = {}) {
    const proyecto = await this._cerradoConVistoBueno(usuario, proyectoId, 'proyectos.dar_visto_bueno', 'No tienes permiso para devolver el cierre.');
    const comentario = limpio(datos.comentario);
    if (!comentario) throw errorDeValidacion('Revisa los datos.', { comentario: 'Escribe qué debe corregir el supervisor.' });
    if (comentario.length > 500) throw errorDeValidacion('Revisa los datos.', { comentario: 'El comentario admite hasta 500 caracteres.' });
    const resultado = await seguimientoService._unaVez(usuario, 'devolver', proyecto.id, datos.idempotencyKey, async (tx) => {
      const cambiado = await tx.query(
        "UPDATE proy_proyectos SET visto_bueno_estado = 'devuelto', visto_bueno_por = ?, visto_bueno_en = ?, visto_bueno_comentario = ? WHERE id = ? AND estado = 'cerrado' AND visto_bueno_estado = 'pendiente'",
        [usuario.id, new Date(), comentario, proyecto.id], 'proyectos_cierre:devolver');
      if (cambiado.affectedRows !== 1) throw new ErrorDeNegocio('Este cierre ya no está esperando el visto bueno.', 409);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'devolver', detalle: { comentario } });
      return { proyectoId: proyecto.id, vistoBueno: 'devuelto' };
    });
    if (!resultado.repetida) await this._avisar('visto_bueno_resuelto', { proyectoId: proyecto.id, autorId: usuario.id, explicitos: { supervisor: [proyecto.cerrado_por_id] }, referenciaId: proyecto.id, nivel: 'alerta', mensaje: `Devolvieron el cierre de «${proyecto.nombre}» con comentarios: ${comentario}` });
    return { ...resultado, ...(await informeService.obtener(usuario, proyecto.id)) };
  }

  // El supervisor corrige las conclusiones de un cierre devuelto y lo reenvía. El informe sigue congelado.
  async reenviar(usuario, proyectoId, datos = {}) {
    const proyecto = await this._cerradoConVistoBueno(usuario, proyectoId, 'proyectos.activar', 'No tienes permiso para reenviar el cierre.');
    const campos = {};
    const conclusiones = datos.conclusiones === undefined ? proyecto.conclusiones : this._conclusiones(datos.conclusiones, campos);
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos.', campos);
    const resultado = await seguimientoService._unaVez(usuario, 'reenviar', proyecto.id, datos.idempotencyKey, async (tx) => {
      const cambiado = await tx.query(
        "UPDATE proy_proyectos SET visto_bueno_estado = 'pendiente', visto_bueno_por = NULL, visto_bueno_en = NULL, visto_bueno_comentario = NULL, conclusiones = ? WHERE id = ? AND estado = 'cerrado' AND visto_bueno_estado = 'devuelto'",
        [conclusiones, proyecto.id], 'proyectos_cierre:reenviar');
      if (cambiado.affectedRows !== 1) throw new ErrorDeNegocio('Este cierre ya no está devuelto.', 409);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'reenviar', detalle: null });
      return { proyectoId: proyecto.id, vistoBueno: 'pendiente' };
    });
    if (!resultado.repetida) await this._avisar('cierre_pendiente', { proyectoId: proyecto.id, autorId: usuario.id, referenciaId: proyecto.id, mensaje: `Cierre reenviado para tu visto bueno: «${proyecto.nombre}».` });
    return { ...resultado, ...(await informeService.obtener(usuario, proyecto.id)) };
  }
}

module.exports = new CierreService();
