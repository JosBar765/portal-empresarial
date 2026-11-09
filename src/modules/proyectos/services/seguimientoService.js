// src/modules/proyectos/services/seguimientoService.js
// Seguimiento del supervisor: avance por asesor y tienda, estancados, reasignaciones, anulaciones y ventas por confirmar.
// Ver no da poder de actuar: lo de otras tiendas sale enmascarado desde aquí (no basta con ocultarlo en pantalla).
const db = require('../../../config/database');
const repo = require('../repositories/seguimientoRepository');
const participacionRepository = require('../repositories/participacionRepository');
const proyectoRepository = require('../repositories/proyectoRepository');
const configService = require('./configService');
const gestionService = require('./gestionService');
const reparto = require('../repartoService');
const { derivar, FINALES } = require('../estadoParticipacion');
const { nivelesDe, enmascararFila, semaforo, porcentaje, diasDeReaccion } = require('../alcanceSeguimiento');
const notificacionService = require('../../../core/notifications/notificacionService');
const socketManager = require('../../../core/websocket/socketManager');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');

const CLAVE = /^[A-Za-z0-9_-]{8,64}$/;
const DIA_MS = 24 * 3600 * 1000;
const MAXIMO_REASIGNAR = 500;
const FILAS_ESTANCADOS = 7;

const tiene = (usuario, permiso) => (usuario.permissions || []).includes(permiso);
const exigir = (usuario, permiso, mensaje) => { if (!tiene(usuario, permiso)) throw new ErrorDeNegocio(mensaje, 403); };
const limpio = (v) => String(v == null ? '' : v).trim();
const ahoraGT = () => new Date(Date.now() - 6 * 3600 * 1000);
const aTexto = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const sinHora = (t) => String(t || '').slice(0, 10);
const diasEntre = (desde, hasta) => Math.floor((Date.parse(`${sinHora(hasta)}T00:00:00Z`) - Date.parse(`${sinHora(desde)}T00:00:00Z`)) / DIA_MS);
const objeto = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const noExiste = () => new ErrorDeNegocio('Ese proyecto o esa empresa no existe o no es de tus tiendas.', 404);

class SeguimientoService {
  // --- Alcance ---

  _exigirVer(usuario) {
    if (!tiene(usuario, 'proyectos.supervisar') && !tiene(usuario, 'proyectos.ver_gerencia') && !tiene(usuario, 'proyectos.administrar')) {
      throw new ErrorDeNegocio('No tienes permiso para ver el seguimiento.', 403);
    }
  }

  // El proyecto y los niveles del usuario sobre él. Un proyecto fuera de su lectura responde 404.
  async _acceso(usuario, proyectoId) {
    const proyecto = await participacionRepository.proyecto(aEntero(proyectoId) || 0);
    if (!proyecto || proyecto.estado === 'borrador') throw noExiste();
    const [supervisadas, delProyecto] = await Promise.all([repo.tiendasSupervisadas(usuario.id), repo.tiendasDelProyecto(proyecto.id)]);
    const niveles = nivelesDe(usuario, supervisadas, delProyecto);
    if (!niveles.lee) throw noExiste();
    return { proyecto, niveles };
  }

  async _umbrales(proyecto) {
    const foto = proyecto.config_snapshot ? objeto(proyecto.config_snapshot) : null;
    const valores = (foto && foto.parametros) || await configService.valores();
    return { verde: valores['semaforo.cobertura_verde'], ambar: valores['semaforo.cobertura_ambar'], diasEstancado: valores['seguimiento.dias_estancado'] };
  }

  // --- Lecturas ---

  async proyectos(usuario) {
    this._exigirVer(usuario);
    const niveles = nivelesDe(usuario, await repo.tiendasSupervisadas(usuario.id));
    return { proyectos: await repo.proyectosActivos(niveles.gerencia ? null : [...niveles.tiendasAccion]) };
  }

  async resumen(usuario, proyectoId) {
    this._exigirVer(usuario);
    const { proyecto, niveles } = await this._acceso(usuario, proyectoId);
    const umbrales = await this._umbrales(proyecto);
    const [cifras, etapas, asesores, tiendas, estancados] = await Promise.all([
      repo.cifras(proyecto.id), participacionRepository.etapas(proyecto.id), repo.porAsesor(proyecto.id), repo.porTienda(proyecto.id), repo.estancados(proyecto.id, this._limiteEstancado(umbrales.diasEstancado), 1)
    ]);
    const hoy = ahoraGT().toISOString().slice(0, 10);
    const vigente = etapas.find(e => e.fecha_inicio && e.fecha_fin && sinHora(e.fecha_inicio) <= hoy && hoy <= sinHora(e.fecha_fin)) || null;
    const cobertura = porcentaje(cifras.gestionadas, cifras.asignadas);
    return {
      proyecto: { id: proyecto.id, nombre: proyecto.nombre, nicho: proyecto.nicho, anio: proyecto.anio, mes: proyecto.mes, estado: proyecto.estado, fechaFin: proyecto.fecha_fin },
      etapa: vigente && { nombre: vigente.nombre, fechaInicio: vigente.fecha_inicio, fechaFin: vigente.fecha_fin },
      cifras: { ...cifras, efectividad: porcentaje(cifras.interesadas, cifras.asignadas) },
      cobertura: { porcentaje: cobertura, semaforo: semaforo(cobertura, umbrales.verde, umbrales.ambar) },
      conteos: { asesores: asesores.length, tiendas: tiendas.length, estancados: estancados.total },
      diasEstancado: umbrales.diasEstancado,
      permisos: {
        reasignar: tiene(usuario, 'proyectos.reasignar') && proyecto.estado === 'activo',
        corregir: tiene(usuario, 'proyectos.corregir') && proyecto.estado === 'activo',
        confirmarVentas: tiene(usuario, 'proyectos.confirmar_ventas'), gerencia: niveles.gerencia
      }
    };
  }

  _limiteEstancado(dias) {
    return aTexto(new Date(ahoraGT().getTime() - dias * DIA_MS));
  }

  async porAsesor(usuario, proyectoId) {
    this._exigirVer(usuario);
    const { proyecto, niveles } = await this._acceso(usuario, proyectoId);
    const umbrales = await this._umbrales(proyecto);
    const filas = await repo.porAsesor(proyecto.id);
    return {
      asesores: filas.map((f) => {
        const base = { asesorId: f.asesorId, nombre: f.nombre, tienda: f.tienda, empresa: f.empresa, asignadas: f.asignadas, gestionadas: f.gestionadas };
        // Otra tienda: solo cuántas tiene y cuántas gestionó; lo demás va vacío y no admite acciones.
        if (!niveles.veDetalleEn(f.tiendaId)) return { ...base, interesadas: null, cotizadas: null, vendidas: null, reaccionDias: null, semaforo: null, otraTienda: true };
        return { ...base, interesadas: f.interesadas, cotizadas: f.cotizadas, vendidas: f.vendidas, reaccionDias: diasDeReaccion(f.minutosReaccion), yaGestiono: f.yaGestiono,
          semaforo: semaforo(porcentaje(f.gestionadas, f.asignadas), umbrales.verde, umbrales.ambar), otraTienda: false };
      })
    };
  }

  async porTienda(usuario, proyectoId) {
    this._exigirVer(usuario);
    const { proyecto } = await this._acceso(usuario, proyectoId);
    const umbrales = await this._umbrales(proyecto);
    return { tiendas: (await repo.porTienda(proyecto.id)).map(t => ({ ...t, coberturaPorcentaje: porcentaje(t.gestionadas, t.asignadas), semaforo: semaforo(porcentaje(t.gestionadas, t.asignadas), umbrales.verde, umbrales.ambar) })) };
  }

  async estancados(usuario, proyectoId, { todos } = {}) {
    this._exigirVer(usuario);
    const { proyecto, niveles } = await this._acceso(usuario, proyectoId);
    const umbrales = await this._umbrales(proyecto);
    const hoy = ahoraGT().toISOString().slice(0, 10);
    const { total, filas } = await repo.estancados(proyecto.id, this._limiteEstancado(umbrales.diasEstancado), todos ? 500 : FILAS_ESTANCADOS);
    return {
      total, mostrando: filas.length, diasEstancado: umbrales.diasEstancado,
      empresas: filas.map(f => enmascararFila({
        id: f.id, empresa: f.empresa, ciudad: f.ciudad, estado: f.estado, asesor: f.asesor, tienda: f.tienda, ultimaGestion: f.ultima_gestion_en || null,
        diasSinGestion: diasEntre(f.ultima_gestion_en || f.asignada_en, hoy)
      }, niveles.veDetalleEn(f.tienda_id)))
    };
  }

  // Los asesores a quienes puede reasignar: participantes activos del proyecto en las tiendas donde actúa la persona.
  async destinos(usuario, proyectoId) {
    exigir(usuario, 'proyectos.reasignar', 'No tienes permiso para reasignar empresas.');
    const { proyecto, niveles } = await this._acceso(usuario, proyectoId);
    const participantes = await repo.participantes(proyecto.id);
    return { destinos: participantes.filter(p => niveles.tiendasAccion === null || niveles.tiendasAccion.has(p.tienda_id)).map(p => ({ asesorId: p.usuario_id, nombre: p.nombre, tienda: p.tienda })) };
  }

  // La ficha de una empresa vista por un supervisor: completa si es de sus tiendas; si no, «Otra tienda» sin datos sensibles.
  async supervision(usuario, participacionId) {
    this._exigirVer(usuario);
    const p = await repo.participacion(aEntero(participacionId) || 0);
    if (!p) throw noExiste();
    const { proyecto, niveles } = await this._acceso(usuario, p.proyecto_id);
    const hoy = ahoraGT().toISOString().slice(0, 10);
    if (!niveles.veDetalleEn(p.tienda_id)) {
      return { ...enmascararFila({ id: p.id, empresa: p.nombre, ciudad: p.ciudad, estado: p.estado, asesor: p.asesor, tienda: p.tienda, ultimaGestion: p.ultima_gestion_en || null, diasSinGestion: diasEntre(p.ultima_gestion_en || p.asignada_en, hoy) }, false), otraTienda: true, abierta: false, historial: [], contactos: [], permisos: { reasignar: false, anular: false } };
    }
    const [contactos, historial] = await Promise.all([participacionRepository.contactos(p.cliente_id), participacionRepository.historial(p.id)]);
    const activa = proyecto.estado === 'activo' && Boolean(p.abierta);
    return {
      id: p.id, otraTienda: false, estado: p.estado, abierta: activa, asesor: p.asesor, asesorId: p.asesor_id, tienda: p.tienda,
      proyecto: { id: proyecto.id, nombre: proyecto.nombre, estado: proyecto.estado },
      empresa: { id: p.cliente_id, nombre: p.nombre, nicho: p.nicho, pais: p.pais, ciudad: p.ciudad, direccion: p.direccion, sitioWeb: p.sitio_web, telefono: p.telefono, estructura: p.estructura },
      contactos: contactos.map(c => ({ id: c.id, nombre: c.nombre, cargo: c.cargo, area: c.area, telefono: c.telefono, correo: c.correo, principal: Boolean(c.principal) })),
      ultimaGestion: p.ultima_gestion_en || null, proximaGestion: p.proxima_gestion_en || null,
      historial: gestionService._lineaDeTiempo(historial),
      permisos: { reasignar: activa && niveles.puedeActuarEn(p.tienda_id) && tiene(usuario, 'proyectos.reasignar') && !FINALES.includes(p.estado), anular: activa && niveles.puedeActuarEn(p.tienda_id) && tiene(usuario, 'proyectos.corregir') }
    };
  }

  // --- Operaciones: una sola vez por clave, dentro de una transacción ---

  async _unaVez(usuario, prefijo, ambito, idempotencyKey, fn) {
    if (!CLAVE.test(String(idempotencyKey || ''))) throw new ErrorDeNegocio('Falta la clave de la operación. Recarga la página e inténtalo de nuevo.', 400);
    const llave = `proy-${prefijo}:${usuario.id}:${ambito}:${idempotencyKey}`;
    const previa = async () => (await db.query('SELECT resultado FROM idempotency_keys WHERE idempotency_key = ?', [llave], 'proyectos_seguimiento:clave'))[0];
    const yaHecha = await previa();
    if (yaHecha) return { ...objeto(yaHecha.resultado), repetida: true };
    let resultado;
    try {
      await db.transaccion(async (tx) => {
        resultado = await fn(tx);
        await tx.query('INSERT INTO idempotency_keys (idempotency_key, endpoint, resultado) VALUES (?, ?, ?)', [llave, `proyectos.${prefijo}`, JSON.stringify(resultado)], 'proyectos_seguimiento:clave_nueva');
      });
    } catch (error) {
      const ganadora = await previa();
      if (ganadora) return { ...objeto(ganadora.resultado), repetida: true };
      throw error;
    }
    return { ...resultado, repetida: false };
  }

  // Avisa sin hacer fallar la operación si la notificación no sale.
  async _avisar(usuarioIds, datos, evento = null) {
    try {
      await notificacionService.registrar(usuarioIds, { modulo: 'proyectos', referenciaTipo: 'participacion', nivel: 'info', ...datos });
      if (evento) socketManager.sendToUsers(usuarioIds, evento.nombre, evento.datos);
    } catch (error) {
      console.error('[Proyectos] No se pudo enviar la notificación:', error.message);
    }
  }

  // --- Reasignación ---

  // Calcula a quién pasa cada empresa. Con `bloquear` (dentro de la transacción) deja las empresas bloqueadas en orden de id.
  async _planReasignacion(ejecutor, proyecto, niveles, ids, destino, bloquear) {
    const filas = await repo.paraReasignar(ejecutor, proyecto.id, ids, bloquear);
    if (filas.length !== ids.length) throw new ErrorDeNegocio('Alguna de las empresas ya no pertenece a este proyecto.', 404);
    for (const f of filas) {
      if (!f.abierta || FINALES.includes(f.estado)) throw new ErrorDeNegocio(`«${f.nombre}» ya no se puede reasignar (${f.estado}).`, 409);
      if (!f.asesor_id || !niveles.puedeActuarEn(f.tienda_id)) throw new ErrorDeNegocio('Solo puedes reasignar empresas de asesores de tus tiendas.', 403);
    }
    const participantes = (await repo.participantes(proyecto.id, ejecutor)).filter(p => niveles.tiendasAccion === null || niveles.tiendasAccion.has(p.tienda_id));
    const origenes = new Set(filas.map(f => f.asesor_id));
    let asignaciones;
    if (destino === 'equitativo') {
      const candidatos = participantes.filter(p => !origenes.has(p.usuario_id));
      const calculo = reparto.calcular({
        empresas: filas.map(f => ({ id: f.id, paisId: f.pais_id, tiendaOrigenId: null })),
        asesores: candidatos.map(p => ({ id: p.usuario_id, paisId: p.pais_id, tiendaId: p.tienda_id })),
        tope: null, afinidad: false, cargaInicial: await repo.cargaPorAsesor(proyecto.id, ejecutor)
      });
      if (calculo.sinAsesor.length) throw new ErrorDeNegocio(`No hay otro asesor participante en el país de ${calculo.sinAsesor.length} ${calculo.sinAsesor.length === 1 ? 'empresa' : 'empresas'}: elige un asesor de destino.`, 409);
      asignaciones = calculo.asignaciones.map(a => ({ participacionId: a.clienteId, aAsesorId: a.asesorId, aTiendaId: a.tiendaId }));
    } else {
      const elegido = participantes.find(p => p.usuario_id === destino);
      if (!elegido) throw errorDeValidacion('Revisa el destino.', { aAsesorId: 'Elige un asesor participante de tus tiendas.' });
      if (origenes.has(elegido.usuario_id)) throw errorDeValidacion('Revisa el destino.', { aAsesorId: 'Ese asesor ya tiene esas empresas: elige otro.' });
      asignaciones = filas.map(f => ({ participacionId: f.id, aAsesorId: elegido.usuario_id, aTiendaId: elegido.tienda_id }));
    }
    const dueno = new Map(filas.map(f => [f.id, f.asesor_id]));
    const plan = asignaciones.map(a => ({ ...a, deAsesorId: dueno.get(a.participacionId) }));
    const nombres = new Map(participantes.map(p => [p.usuario_id, p.nombre]));
    const recibe = new Map();
    plan.forEach(a => recibe.set(a.aAsesorId, (recibe.get(a.aAsesorId) || 0) + 1));
    return { plan, porAsesor: [...recibe].map(([asesorId, n]) => ({ asesorId, nombre: nombres.get(asesorId), recibe: n })) };
  }

  // `datos`: { empresaIds[] | deAsesorId + todasLasPendientes, aAsesorId | 'equitativo', motivo, soloVistaPrevia, idempotencyKey }
  async reasignar(usuario, proyectoId, datos = {}) {
    exigir(usuario, 'proyectos.reasignar', 'No tienes permiso para reasignar empresas.');
    const { proyecto, niveles } = await this._acceso(usuario, proyectoId);
    if (proyecto.estado !== 'activo') throw new ErrorDeNegocio('Este proyecto ya no está activo: no se pueden reasignar empresas.', 409);
    const campos = {};
    let ids;
    if (Array.isArray(datos.empresaIds)) {
      ids = [...new Set(datos.empresaIds.map(aEntero).filter(Boolean))];
      if (!ids.length) campos.empresaIds = 'Elige al menos una empresa.';
      if (ids.length > MAXIMO_REASIGNAR) campos.empresaIds = `Se pueden reasignar hasta ${MAXIMO_REASIGNAR} empresas a la vez.`;
    } else if (aEntero(datos.deAsesorId) && datos.todasLasPendientes === true) {
      ids = await repo.pendientesDe(proyecto.id, aEntero(datos.deAsesorId));
      if (!ids.length) throw new ErrorDeNegocio('Ese asesor no tiene empresas pendientes.', 409);
      if (ids.length > MAXIMO_REASIGNAR) campos.empresaIds = `Se pueden reasignar hasta ${MAXIMO_REASIGNAR} empresas a la vez.`;
    } else {
      campos.empresaIds = 'Elige qué empresas reasignar.';
    }
    const destino = datos.aAsesorId === 'equitativo' ? 'equitativo' : aEntero(datos.aAsesorId);
    if (!destino) campos.aAsesorId = 'Elige a quién se reasignan.';
    const motivo = limpio(datos.motivo);
    if (datos.soloVistaPrevia !== true) {
      if (!motivo) campos.motivo = 'Cuenta el motivo: queda en el historial.';
      else if (motivo.length > 255) campos.motivo = 'El motivo admite hasta 255 caracteres.';
    }
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos de la reasignación.', campos);

    if (datos.soloVistaPrevia === true) {
      const { plan, porAsesor } = await this._planReasignacion(db, proyecto, niveles, ids, destino, false);
      return { vistaPrevia: true, total: plan.length, porAsesor };
    }

    const resultado = await this._unaVez(usuario, 'reasignar', proyecto.id, datos.idempotencyKey, async (tx) => {
      await tx.query('SELECT id FROM proy_proyectos WHERE id = ? FOR UPDATE', [proyecto.id], 'proyectos_seguimiento:bloquear_proyecto');
      const { plan, porAsesor } = await this._planReasignacion(tx, proyecto, niveles, ids, destino, true);
      for (const a of plan) await repo.moverEmpresa(tx, a.participacionId, a.aAsesorId, a.aTiendaId);
      await repo.insertarReasignaciones(tx, plan.map(a => ({ participacionId: a.participacionId, deAsesorId: a.deAsesorId, aAsesorId: a.aAsesorId, motivo, porUsuarioId: usuario.id })));
      const cedidas = new Map();
      plan.forEach(a => cedidas.set(a.deAsesorId, (cedidas.get(a.deAsesorId) || 0) + 1));
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'reasignar', detalle: { cantidad: plan.length, motivo, recibe: porAsesor, cede: [...cedidas].map(([asesorId, n]) => ({ asesorId, cede: n })) } });
      return { reasignadas: plan.length, porAsesor, cede: [...cedidas].map(([asesorId, n]) => ({ asesorId, cede: n })) };
    });

    if (!resultado.repetida) {
      const plural = (n) => `${n} ${n === 1 ? 'empresa' : 'empresas'}`;
      const afectados = new Set();
      for (const r of resultado.porAsesor) if (r.asesorId !== usuario.id) { afectados.add(r.asesorId); await this._avisar([r.asesorId], { tipo: 'reasignacion_recibida', mensaje: `Te asignaron ${plural(r.recibe)} en «${proyecto.nombre}».` }); }
      for (const c of resultado.cede) if (c.asesorId !== usuario.id) { afectados.add(c.asesorId); await this._avisar([c.asesorId], { tipo: 'reasignacion_cedida', mensaje: `${plural(c.cede)} de «${proyecto.nombre}» pasaron a otro asesor. Motivo: ${motivo}` }); }
      socketManager.sendToUsers([...afectados], 'proyectos_reasignacion', { proyectoId: proyecto.id });
    }
    return resultado;
  }

  // --- Anulación (proyectos.corregir) ---

  async _recalcular(tx, participacionId, estadoActual) {
    const hechos = await participacionRepository.hechos(tx, participacionId);
    const marca = estadoActual === 'perdida' || estadoActual === 'descartada' ? estadoActual : null;
    const estado = derivar(hechos, marca);
    await participacionRepository.actualizar(tx, participacionId, { estado });
    return estado;
  }

  async _anular(usuario, tipo, participacionId, itemId, datos) {
    exigir(usuario, 'proyectos.corregir', 'No tienes permiso para anular registros.');
    const motivo = limpio(datos.motivo);
    if (!motivo) throw errorDeValidacion('Revisa los datos.', { motivo: 'Cuenta el motivo de la anulación: queda en el historial.' });
    if (motivo.length > 255) throw errorDeValidacion('Revisa los datos.', { motivo: 'El motivo admite hasta 255 caracteres.' });
    const p = await repo.participacion(aEntero(participacionId) || 0);
    if (!p) throw noExiste();
    const { proyecto, niveles } = await this._acceso(usuario, p.proyecto_id);
    if (!niveles.puedeActuarEn(p.tienda_id)) throw new ErrorDeNegocio('Solo puedes anular registros de asesores de tus tiendas.', 403);
    if (proyecto.estado !== 'activo' || !p.abierta) throw new ErrorDeNegocio('Este proyecto ya no está activo: no se pueden anular registros.', 409);
    const id = aEntero(itemId) || 0;
    const resultado = await this._unaVez(usuario, `anular-${tipo}`, `${p.id}-${id}`, datos.idempotencyKey, async (tx) => {
      const bloqueada = await repo.bloquearParticipacion(tx, p.id);
      if (!bloqueada || !bloqueada.abierta) throw new ErrorDeNegocio('Esta empresa ya no admite cambios.', 409);
      const datosAnulacion = { usuarioId: usuario.id, ahora: aTexto(ahoraGT()), motivo };
      const hecho = tipo === 'cotizacion' ? await repo.anularCotizacion(tx, id, p.id, datosAnulacion) : await repo.anularVenta(tx, id, p.id, datosAnulacion);
      if (!hecho) throw new ErrorDeNegocio(`Esa ${tipo === 'cotizacion' ? 'cotización' : 'venta'} no existe o ya estaba anulada.`, 409);
      const estado = await this._recalcular(tx, p.id, bloqueada.estado);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: `anular_${tipo}`, detalle: { participacionId: p.id, id, motivo } });
      return { estado };
    });
    if (!resultado.repetida && p.asesor_id && p.asesor_id !== usuario.id) {
      await this._avisar([p.asesor_id], { tipo: `anulacion_${tipo}`, referenciaId: p.id, mensaje: `Anularon ${tipo === 'cotizacion' ? 'una cotización' : 'una venta'} de «${p.nombre}». Motivo: ${motivo}` }, { nombre: 'proyectos_reasignacion', datos: { proyectoId: proyecto.id } });
    }
    return { ...(await this.supervision(usuario, p.id)), repetida: resultado.repetida };
  }

  anularCotizacion(usuario, participacionId, cotizacionId, datos = {}) { return this._anular(usuario, 'cotizacion', participacionId, cotizacionId, datos); }
  anularVenta(usuario, participacionId, ventaId, datos = {}) { return this._anular(usuario, 'venta', participacionId, ventaId, datos); }

  // --- Ventas por confirmar (proyectos.confirmar_ventas) ---

  async _tiendasDeVentas(usuario) {
    exigir(usuario, 'proyectos.confirmar_ventas', 'No tienes permiso para confirmar ventas.');
    const niveles = nivelesDe(usuario, await repo.tiendasSupervisadas(usuario.id));
    return niveles.tiendasAccion === null ? null : [...niveles.tiendasAccion];
  }

  async ventas(usuario, { estado } = {}) {
    const tiendaIds = await this._tiendasDeVentas(usuario);
    const filtro = ['por_confirmar', 'confirmada', 'rechazada'].includes(estado) ? estado : 'por_confirmar';
    if (tiendaIds && !tiendaIds.length) return { activa: false, conteos: {}, ventas: [] };
    const [filas, conteos, global, paises] = await Promise.all([repo.ventas({ estado: filtro, tiendaIds }), repo.conteoVentas(tiendaIds), configService.obtener('reglas.confirmar_ventas'), configService.paises()]);
    return {
      activa: Boolean(global) || paises.some(p => p.confirmacionVentas === true) || (conteos.por_confirmar || 0) > 0,
      conteos: { por_confirmar: conteos.por_confirmar || 0, confirmada: conteos.confirmada || 0, rechazada: conteos.rechazada || 0 },
      ventas: filas.map(v => ({ id: v.id, empresa: v.empresa, asesor: v.asesor, proyecto: v.proyecto, participacionId: v.participacion_id, monto: Number(v.monto), moneda: v.moneda, referencia: v.referencia, estado: v.estado, registradaEn: v.creado_en, motivo: v.revision_motivo }))
    };
  }

  async _revisar(usuario, ventaId, accion, datos) {
    const tiendaIds = await this._tiendasDeVentas(usuario);
    const v = await repo.venta(aEntero(ventaId) || 0);
    if (!v) throw new ErrorDeNegocio('Esa venta no existe.', 404);
    if (tiendaIds && !tiendaIds.includes(v.tienda_id)) throw new ErrorDeNegocio('Solo puedes revisar ventas de asesores de tus tiendas.', 403);
    const motivo = limpio(datos.motivo);
    if (accion === 'rechazar' && !motivo) throw errorDeValidacion('Revisa los datos.', { motivo: 'Cuenta el motivo del rechazo: se lo avisamos al asesor.' });
    if (motivo.length > 255) throw errorDeValidacion('Revisa los datos.', { motivo: 'El motivo admite hasta 255 caracteres.' });
    const proyecto = await participacionRepository.proyecto(v.proyecto_id);
    if (proyecto.estado !== 'activo') throw new ErrorDeNegocio('Este proyecto ya no está activo: la venta no se puede revisar.', 409);
    const resultado = await this._unaVez(usuario, `venta-${accion}`, v.id, datos.idempotencyKey, async (tx) => {
      const bloqueada = await repo.bloquearParticipacion(tx, v.participacion_id);
      const hecho = await repo.revisarVenta(tx, v.id, { estado: accion === 'confirmar' ? 'confirmada' : 'rechazada', usuarioId: usuario.id, ahora: aTexto(ahoraGT()), motivo: motivo || null });
      if (!hecho) throw new ErrorDeNegocio('Esta venta ya fue revisada o anulada.', 409);
      const estado = await this._recalcular(tx, v.participacion_id, bloqueada.estado);
      await proyectoRepository.registrarHistorial(tx, { proyectoId: v.proyecto_id, usuarioId: usuario.id, accion: `${accion}_venta`, detalle: { participacionId: v.participacion_id, ventaId: v.id, motivo: motivo || null } });
      return { ventaId: v.id, estado };
    });
    if (!resultado.repetida && v.asesor_id && v.asesor_id !== usuario.id) {
      await this._avisar([v.asesor_id], { tipo: `venta_${accion === 'confirmar' ? 'confirmada' : 'rechazada'}`, referenciaId: v.participacion_id,
        mensaje: accion === 'confirmar' ? `Confirmaron tu venta ${v.referencia || ''} de «${v.empresa}».`.replace('  ', ' ') : `Rechazaron tu venta de «${v.empresa}». Motivo: ${motivo}`, nivel: accion === 'confirmar' ? 'info' : 'alerta' });
    }
    return resultado;
  }

  confirmarVenta(usuario, ventaId, datos = {}) { return this._revisar(usuario, ventaId, 'confirmar', datos); }
  rechazarVenta(usuario, ventaId, datos = {}) { return this._revisar(usuario, ventaId, 'rechazar', datos); }
}

module.exports = new SeguimientoService();
