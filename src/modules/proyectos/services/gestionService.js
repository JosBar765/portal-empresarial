// src/modules/proyectos/services/gestionService.js
// Trabajo del asesor: Mi proyecto, Para hoy, ficha de la empresa y registros (gestión, muestra, cotización, venta, pérdida, descarte).
// Solo se agregan filas: una equivocación se anula después (fase 5). El estado de la empresa se recalcula con `estadoParticipacion.derivar`.
// Una participación ajena responde 404, igual que una que no existe: nadie puede saber qué empresas tienen los demás.
const db = require('../../../config/database');
const repo = require('../repositories/participacionRepository');
const proyectoRepository = require('../repositories/proyectoRepository');
const configService = require('./configService');
const avisosService = require('./avisosService');
const { derivar, FINALES } = require('../estadoParticipacion');
const { ErrorDeNegocio } = require('../../../core/utils/erroresHttp');
const { aEntero } = require('../../../core/utils/validar');
const { errorDeValidacion } = require('../errores');

const MONTO_MAXIMO = 9999999999.99;
const CLAVE = /^[A-Za-z0-9_-]{8,64}$/;
const FECHA_HORA = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?$/;
const DIA_MS = 24 * 3600 * 1000;

const noExiste = () => new ErrorDeNegocio('Esa empresa no existe o no es tuya.', 404);
const limpio = (v) => String(v == null ? '' : v).trim();
// Toda la región usa UTC-6: «ahora» y «hoy» salen de ese reloj, no del de la base.
const ahoraGT = () => new Date(Date.now() - 6 * 3600 * 1000);
const aTexto = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const hoyGT = () => ahoraGT().toISOString().slice(0, 10);
const sinHora = (t) => String(t || '').slice(0, 10);
const diasEntre = (desde, hasta) => Math.floor((Date.parse(`${sinHora(hasta)}T00:00:00Z`) - Date.parse(`${sinHora(desde)}T00:00:00Z`)) / DIA_MS);

function monto(valor, campos, clave = 'monto') {
  const n = Number(String(valor == null ? '' : valor).replace(',', '.'));
  if (!String(valor == null ? '' : valor).trim() || !Number.isFinite(n) || n <= 0) campos[clave] = 'Escribe un monto mayor que cero.';
  else if (n > MONTO_MAXIMO) campos[clave] = 'El monto es demasiado grande.';
  else if (Math.round(n * 100) / 100 !== n) campos[clave] = 'El monto admite hasta dos decimales.';
  return n;
}

function texto(valor, max, campos, clave, etiqueta) {
  const t = limpio(valor);
  if (t.length > max) campos[clave] = `${etiqueta} admite hasta ${max} caracteres.`;
  return t || null;
}

class GestionService {
  // --- Lecturas ---

  async _proyectoDe(usuario) {
    return repo.proyectoActivoDe(usuario.id);
  }

  // Mi proyecto: el proyecto activo con su etapa vigente, la muestra restante, las cifras y los filtros. Sin proyecto activo: { proyecto: null }.
  async miProyecto(usuario) {
    const id = await this._proyectoDe(usuario);
    if (!id) return { proyecto: null };
    const [proyecto, etapas, entregadas, cifras, conteos, hoyFilas] = await Promise.all([
      repo.proyecto(id), repo.etapas(id), repo.muestrasEntregadas(id), repo.cifras(id, usuario.id), repo.conteosPorEstado(id, usuario.id), this._paraHoyDe(id, usuario.id)
    ]);
    const hoy = hoyGT();
    const vigente = etapas.find(e => e.fecha_inicio && e.fecha_fin && sinHora(e.fecha_inicio) <= hoy && hoy <= sinHora(e.fecha_fin)) || null;
    return {
      proyecto: {
        id: proyecto.id, codigo: proyecto.codigo, nombre: proyecto.nombre, nicho: proyecto.nicho, anio: proyecto.anio, mes: proyecto.mes,
        fechaInicio: proyecto.fecha_inicio, fechaFin: proyecto.fecha_fin, vencido: Boolean(proyecto.fecha_fin) && sinHora(proyecto.fecha_fin) < hoy
      },
      etapa: vigente && { orden: vigente.orden, nombre: vigente.nombre, descripcion: vigente.descripcion, fechaInicio: vigente.fecha_inicio, fechaFin: vigente.fecha_fin },
      etapas: etapas.map(e => ({ orden: e.orden, nombre: e.nombre, fechaInicio: e.fecha_inicio, fechaFin: e.fecha_fin, estado: !e.fecha_fin ? 'proxima' : sinHora(e.fecha_fin) < hoy ? 'hecha' : sinHora(e.fecha_inicio) > hoy ? 'proxima' : 'actual' })),
      muestra: proyecto.articulo_id ? { articulo: proyecto.articulo, quedan: proyecto.existencia_muestras, total: proyecto.existencia_muestras === null ? null : proyecto.existencia_muestras + entregadas } : null,
      cifras: { ...cifras, efectividad: cifras.asignadas ? Math.round((cifras.interesadas / cifras.asignadas) * 100) : 0 },
      conteos: { todas: Object.values(conteos).reduce((a, b) => a + b, 0), ...conteos },
      paraHoy: { total: hoyFilas.total, primeras: [...hoyFilas.vencidos, ...hoyFilas.hoy, ...hoyFilas.sinTocar].slice(0, 4) }
    };
  }

  async listar(usuario, { estado, q, pagina } = {}) {
    const id = await this._proyectoDe(usuario);
    const n = Math.max(1, aEntero(pagina) || 1);
    if (!id) return { total: 0, pagina: n, porPagina: repo.PAGINA, empresas: [] };
    const filtro = ['pendiente', 'en_gestion', 'interesada', 'cotizada', 'vendida', 'perdida', 'descartada'].includes(estado) ? estado : null;
    const buscar = limpio(q).slice(0, 80);
    const hoy = hoyGT();
    const { total, filas } = await repo.listar({ proyectoId: id, asesorId: usuario.id, estado: filtro, q: buscar || null, pagina: n, hoy });
    return { total, pagina: n, porPagina: repo.PAGINA, empresas: filas.map(f => this._fila(f, hoy)) };
  }

  _fila(f, hoy) {
    const proxima = f.proxima_gestion_en || null;
    return {
      id: f.id, nombre: f.nombre, ciudad: f.ciudad, estado: f.estado, contacto: f.contacto || null, telefono: f.contacto_telefono || f.telefono || null,
      ultimaGestion: f.ultima_gestion_en || null, proximaGestion: proxima,
      seguimientoVencido: Boolean(proxima) && sinHora(proxima) < hoy && !FINALES.includes(f.estado),
      diasSinGestion: diasEntre(f.ultima_gestion_en || f.asignada_en, hoy)
    };
  }

  // Vencidas, de hoy y «sin tocar» (sin gestión desde hace los días del parámetro), sin repetir ninguna empresa.
  async _paraHoyDe(proyectoId, asesorId) {
    const [filas, ajustes] = await Promise.all([repo.paraHoy(proyectoId, asesorId), configService.valores()]);
    const hoy = hoyGT();
    const limite = ajustes['seguimiento.dias_estancado'];
    const vencidos = []; const deHoy = []; const sinTocar = [];
    for (const f of filas) {
      const fila = this._fila(f, hoy);
      if (fila.proximaGestion && sinHora(fila.proximaGestion) < hoy) vencidos.push(fila);
      else if (fila.proximaGestion && sinHora(fila.proximaGestion) === hoy) deHoy.push(fila);
      else if (fila.diasSinGestion >= limite) sinTocar.push(fila);
    }
    const porFecha = (a, b) => String(a.proximaGestion).localeCompare(String(b.proximaGestion)) || a.id - b.id;
    vencidos.sort(porFecha); deHoy.sort(porFecha); sinTocar.sort((a, b) => b.diasSinGestion - a.diasSinGestion || a.id - b.id);
    return { vencidos, hoy: deHoy, sinTocar, limiteDias: limite, total: vencidos.length + deHoy.length + sinTocar.length };
  }

  async paraHoy(usuario) {
    const id = await this._proyectoDe(usuario);
    if (!id) return { total: 0, vencidos: [], hoy: [], sinTocar: [], limiteDias: null };
    return this._paraHoyDe(id, usuario.id);
  }

  async proyectosAnteriores(usuario) {
    const [filas, vendido] = await Promise.all([repo.proyectosAnteriores(usuario.id), repo.vendidoPorMoneda(usuario.id)]);
    return {
      proyectos: filas.map(f => ({
        id: f.id, nombre: f.nombre, nicho: f.nicho, anio: f.anio, mes: f.mes, estado: f.estado, cerradoEn: f.cerrado_en,
        asignadas: Number(f.asignadas), gestionadas: Number(f.gestionadas || 0), interesadas: Number(f.interesadas || 0), vendidas: Number(f.vendidas || 0),
        efectividad: Number(f.asignadas) ? Math.round((Number(f.interesadas || 0) / Number(f.asignadas)) * 100) : 0,
        vendido: vendido.filter(v => v.proyecto_id === f.id).map(v => ({ moneda: v.moneda, monto: Number(v.total) }))
      }))
    };
  }

  async opciones() {
    return repo.catalogos();
  }

  // La ficha: datos de la empresa, contactos por área, línea de tiempo y lo que necesitan las hojas de registro de ESTA empresa.
  async ficha(usuario, id) {
    const p = await repo.participacion(aEntero(id) || 0, usuario.id);
    if (!p) throw noExiste();
    const [proyecto, contactos, historial, pais, ajustes, entregadas] = await Promise.all([
      repo.proyecto(p.proyecto_id), repo.contactos(p.cliente_id), repo.historial(p.id), configService.pais(p.pais_id), configService.valores(), repo.muestrasEntregadas(p.proyecto_id)
    ]);
    const porConfirmar = await configService.confirmacionVentas(p.pais_id);
    const hoy = hoyGT();
    const abierta = proyecto.estado === 'activo' && Boolean(p.abierta) && p.estado !== 'descartada';
    return {
      id: p.id, estado: p.estado, abierta,
      proyecto: { id: proyecto.id, nombre: proyecto.nombre, estado: proyecto.estado },
      empresa: { id: p.cliente_id, nombre: p.nombre, nicho: p.nicho, pais: p.pais, ciudad: p.ciudad, direccion: p.direccion, sitioWeb: p.sitio_web, telefono: p.telefono, estructura: p.estructura },
      contactos: contactos.map(c => ({ id: c.id, nombre: c.nombre, cargo: c.cargo, area: c.area, telefono: c.telefono, correo: c.correo, principal: Boolean(c.principal) })),
      ultimaGestion: p.ultima_gestion_en || null, proximaGestion: p.proxima_gestion_en || null,
      seguimientoVencido: Boolean(p.proxima_gestion_en) && sinHora(p.proxima_gestion_en) < hoy && !FINALES.includes(p.estado),
      historial: this._lineaDeTiempo(historial),
      registro: {
        monedaLocal: pais ? pais.monedaCodigo : null, monedaPorDefecto: (pais && pais.monedaCodigo) || 'USD',
        referenciaObligatoria: pais ? pais.referenciaObligatoria : true, ventaPorConfirmar: Boolean(porConfirmar),
        muestra: proyecto.articulo_id ? { articulo: proyecto.articulo, quedan: proyecto.existencia_muestras, total: proyecto.existencia_muestras === null ? null : proyecto.existencia_muestras + entregadas } : null,
        diasEstancado: ajustes['seguimiento.dias_estancado'],
        // El botón «Crear vale» solo sale a quien puede crear vales de arte y mientras la empresa siga abierta.
        puedeCrearVale: abierta && (usuario.permissions || []).includes('vales.crear')
      }
    };
  }

  _lineaDeTiempo({ gestiones, muestras, cotizaciones, ventas, vales = [] }) {
    const filas = [
      ...gestiones.map(g => ({ tipo: 'gestion', id: g.id, fecha: g.creado_en, usuario: g.usuario, canal: g.canal, resultado: g.resultado, contacto: g.contacto, nota: g.nota, proximaEn: g.proxima_en })),
      ...muestras.map(m => ({ tipo: 'muestra', id: m.id, fecha: m.creado_en, usuario: m.usuario, cantidad: m.cantidad, area: m.area })),
      ...cotizaciones.map(c => ({ tipo: 'cotizacion', id: c.id, fecha: c.creado_en, usuario: c.usuario, monto: Number(c.monto), moneda: c.moneda, referencia: c.referencia, nota: c.nota, anulada: Boolean(c.anulada_en) })),
      ...vales.map(v => ({ tipo: 'vale', id: v.id, fecha: v.vinculado_en, usuario: v.usuario, valeId: v.vale_id, correlativo: v.correlativo })),
      ...ventas.map(v => ({ tipo: 'venta', id: v.id, fecha: v.creado_en, usuario: v.usuario, monto: Number(v.monto), moneda: v.moneda, referencia: v.referencia, estadoVenta: v.estado, anulada: Boolean(v.anulada_en) }))
    ];
    // Lo más nuevo primero; en el mismo segundo, lo que ocurre más tarde en el trabajo (venta, cotización, muestra, gestión).
    const peso = { vale: 4, venta: 3, cotizacion: 2, muestra: 1, gestion: 0 };
    return filas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || peso[b.tipo] - peso[a.tipo] || b.id - a.id);
  }

  // --- Registros ---

  // Todo registro corre en una transacción que bloquea la empresa, comprueba que sea del asesor y siga en un proyecto activo,
  // guarda lo nuevo, recalcula el estado y asienta la clave de la operación (dos clics seguidos dejan un solo registro).
  // `bloquearProyecto`: el registro cambia la existencia de muestras; se bloquea el proyecto ANTES de cualquier otra lectura para que
  // dos entregas a la vez se pongan en fila (MariaDB rechaza descontar sobre una lectura ya vieja).
  async _registrar(usuario, id, idempotencyKey, prefijo, fn, { bloquearProyecto = false } = {}) {
    if (!CLAVE.test(String(idempotencyKey || ''))) throw new ErrorDeNegocio('Falta la clave de la operación. Recarga la página e inténtalo de nuevo.', 400);
    const participacionId = aEntero(id) || 0;
    const llave = `proy-${prefijo}:${usuario.id}:${participacionId}:${idempotencyKey}`;
    const ya = async () => (await db.query('SELECT 1 AS ya FROM idempotency_keys WHERE idempotency_key = ?', [llave], 'proyectos_gestion:clave'))[0];
    if (await ya()) return { ...(await this.ficha(usuario, participacionId)), repetida: true };
    try {
      await db.transaccion(async (tx) => {
        const bloqueada = await repo.bloquear(tx, participacionId, usuario.id);
        if (!bloqueada) throw noExiste();
        const proyecto = await repo.proyecto(bloqueada.proyecto_id, tx, bloquearProyecto);
        if (proyecto.estado !== 'activo' || !bloqueada.abierta) throw new ErrorDeNegocio('Este proyecto ya no está activo: la empresa quedó solo para consulta.', 409);
        if (bloqueada.estado === 'descartada') throw new ErrorDeNegocio('Esta empresa fue descartada del proyecto.', 409);
        const participacion = await repo.participacion(participacionId, usuario.id, tx);
        await fn({ tx, participacion, proyecto, bloqueada });
        await tx.query('INSERT INTO idempotency_keys (idempotency_key, endpoint, resultado) VALUES (?, ?, ?)', [llave, `proyectos.${prefijo}`, JSON.stringify({ participacionId })], 'proyectos_gestion:clave_nueva');
      });
    } catch (error) {
      if (await ya()) return { ...(await this.ficha(usuario, participacionId)), repetida: true };
      throw error;
    }
    return { ...(await this.ficha(usuario, participacionId)), repetida: false };
  }

  // Recalcula el estado con lo registrado. Una empresa «perdida» que recibe trabajo nuevo se reabre.
  async _recalcular(tx, participacionId, cambios = {}) {
    const hechos = await repo.hechos(tx, participacionId);
    const estado = derivar(hechos);
    await repo.actualizar(tx, participacionId, { estado, ...cambios });
    return estado;
  }

  async registrarGestion(usuario, id, datos = {}) {
    const campos = {};
    const canalId = aEntero(datos.canalId); const resultadoId = aEntero(datos.resultadoId);
    if (!canalId) campos.canalId = 'Elige el canal.';
    if (!resultadoId) campos.resultadoId = 'Elige el resultado.';
    const nota = texto(datos.nota, 1000, campos, 'nota', 'La nota');
    const contactoId = datos.contactoId === null || datos.contactoId === undefined || datos.contactoId === '' ? null : aEntero(datos.contactoId);
    if (datos.contactoId !== null && datos.contactoId !== undefined && datos.contactoId !== '' && !contactoId) campos.contactoId = 'Elige un contacto de la lista.';
    let muestra = null;
    if (datos.muestra && datos.muestra.entregada !== false && datos.muestra !== false) {
      const cantidad = aEntero(datos.muestra.cantidad === undefined ? 1 : datos.muestra.cantidad);
      if (!cantidad || cantidad < 1 || cantidad > 100000) campos['muestra.cantidad'] = 'Escribe cuántas muestras entregaste.';
      const areaId = datos.muestra.areaId === null || datos.muestra.areaId === undefined || datos.muestra.areaId === '' ? null : aEntero(datos.muestra.areaId);
      if (datos.muestra.areaId && !areaId) campos['muestra.areaId'] = 'Elige el área.';
      muestra = { cantidad, areaId };
    }
    let proximaEn = null;
    if (datos.proximaEn !== null && datos.proximaEn !== undefined && datos.proximaEn !== '') {
      const m = FECHA_HORA.exec(limpio(datos.proximaEn));
      if (!m || Number.isNaN(Date.parse(`${m[1]}T${m[2] || '00:00'}:00Z`))) campos.proximaEn = 'Escribe una fecha válida para el seguimiento.';
      else if (m[1] < hoyGT()) campos.proximaEn = 'El seguimiento no puede ser en una fecha pasada.';
      else proximaEn = `${m[1]} ${m[2] || '09:00'}:00`;
    }
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos de la gestión.', campos);

    return this._registrar(usuario, id, datos.idempotencyKey, 'gestion', async ({ tx, participacion, proyecto }) => {
      const resultado = await repo.resultado(resultadoId, tx);
      if (!resultado) throw errorDeValidacion('Revisa los datos de la gestión.', { resultadoId: 'Ese resultado ya no está disponible.' });
      if (!(await repo.canalActivo(canalId, tx))) throw errorDeValidacion('Revisa los datos de la gestión.', { canalId: 'Ese canal ya no está disponible.' });
      if (resultado.requiere_proxima && !proximaEn) throw errorDeValidacion('Revisa los datos de la gestión.', { proximaEn: 'Con este resultado hay que fijar la fecha del próximo seguimiento.' });
      if (contactoId && !(await repo.contactoDe(participacion.cliente_id, contactoId, tx))) throw errorDeValidacion('Revisa los datos de la gestión.', { contactoId: 'Ese contacto no es de esta empresa.' });
      if (muestra) {
        if (!proyecto.articulo_id) throw errorDeValidacion('Revisa los datos de la gestión.', { muestra: 'Este proyecto no tiene artículo de muestra.' });
        if (muestra.areaId && !(await repo.areaActiva(muestra.areaId, tx))) throw errorDeValidacion('Revisa los datos de la gestión.', { 'muestra.areaId': 'Esa área ya no está disponible.' });
        if (proyecto.existencia_muestras !== null && !(await repo.descontarExistencia(tx, proyecto.id, muestra.cantidad))) {
          const quedan = await repo.existencia(tx, proyecto.id);
          throw new ErrorDeNegocio(`Solo quedan ${quedan} muestras de ${proyecto.articulo}. Entrega menos o avisa a tu supervisor.`, 409);
        }
        await repo.insertarEntrega(tx, { participacionId: participacion.id, areaId: muestra.areaId, cantidad: muestra.cantidad, usuarioId: usuario.id });
      }
      await repo.insertarGestion(tx, { participacionId: participacion.id, usuarioId: usuario.id, canalId, contactoId, resultadoId, nota, proximaEn });
      // La gestión fija la fecha vigente de seguimiento (o la despeja) y reabre la empresa si estaba perdida.
      await this._recalcular(tx, participacion.id, { ultima_gestion_en: aTexto(ahoraGT()), proxima_gestion_en: proximaEn, motivo_perdida_id: null });
    }, { bloquearProyecto: Boolean(muestra) });
  }

  // Cotización y venta comparten moneda, monto y referencia.
  async _datosDeDinero(datos, paisId) {
    const campos = {};
    const pais = await configService.pais(paisId);
    const local = pais ? pais.monedaCodigo : null;
    const porDefecto = local || 'USD';
    const moneda = limpio(datos.moneda).toUpperCase() || porDefecto;
    // Solo la moneda local del país y el dólar; un país sin moneda local (hoy Belice) trabaja en dólares.
    if (moneda !== 'USD' && moneda !== local) campos.moneda = 'Elige la moneda local del país o dólares.';
    const importe = monto(datos.monto, campos);
    const referencia = texto(datos.referencia, 60, campos, 'referencia', 'La referencia');
    const obligatoria = pais ? pais.referenciaObligatoria : true;
    if (obligatoria && !referencia && !campos.referencia) campos.referencia = 'Escribe el número; sin número no se guarda.';
    return { campos, moneda, importe, referencia };
  }

  async registrarCotizacion(usuario, id, datos = {}) {
    const previa = await repo.participacion(aEntero(id) || 0, usuario.id);
    if (!previa) throw noExiste();
    const { campos, moneda, importe, referencia } = await this._datosDeDinero(datos, previa.pais_id);
    const nota = texto(datos.nota, 500, campos, 'nota', 'La nota');
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos de la cotización.', campos);
    return this._registrar(usuario, id, datos.idempotencyKey, 'cotizacion', async ({ tx, participacion }) => {
      await repo.insertarCotizacion(tx, { participacionId: participacion.id, monto: importe, moneda, referencia, nota, usuarioId: usuario.id });
      await this._recalcular(tx, participacion.id, { motivo_perdida_id: null });
    });
  }

  async registrarVenta(usuario, id, datos = {}) {
    const previa = await repo.participacion(aEntero(id) || 0, usuario.id);
    if (!previa) throw noExiste();
    const { campos, moneda, importe, referencia } = await this._datosDeDinero(datos, previa.pais_id);
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos de la venta.', campos);
    const porConfirmar = Boolean(await configService.confirmacionVentas(previa.pais_id));
    const ficha = await this._registrar(usuario, id, datos.idempotencyKey, 'venta', async ({ tx, participacion }) => {
      // Una misma orden puede cubrir varias empresas del grupo, pero hay que decirlo: si no, se avisa y no se guarda.
      const otra = referencia ? await repo.ventaConReferencia(tx, referencia) : null;
      if (otra && datos.confirmarReferenciaRepetida !== true) {
        const error = new ErrorDeNegocio(`La orden ${referencia} ya está en la venta de «${otra.cliente}». Si cubre varias empresas del grupo, confírmalo.`, 409);
        error.codigo = 'REFERENCIA_REPETIDA';
        error.detalle = { referencia, cliente: otra.cliente, fecha: sinHora(otra.creado_en) };
        throw error;
      }
      await repo.insertarVenta(tx, { participacionId: participacion.id, monto: importe, moneda, referencia, estado: porConfirmar ? 'por_confirmar' : 'confirmada', usuarioId: usuario.id });
      await this._recalcular(tx, participacion.id, { motivo_perdida_id: null });
    });
    // Con la confirmación de ventas encendida, los supervisores de las tiendas del proyecto se enteran de que hay una venta esperando.
    if (porConfirmar && !ficha.repetida) {
      try {
        await avisosService.notificar('venta_por_confirmar', { proyectoId: previa.proyecto_id, autorId: usuario.id, referenciaId: previa.id, mensaje: `Venta por confirmar de «${previa.nombre}»${referencia ? ` (${referencia})` : ''}.` });
      } catch (error) { console.error('[Proyectos] No se pudo avisar de la venta por confirmar:', error.message); }
    }
    return ficha;
  }

  async marcarPerdida(usuario, id, datos = {}) {
    const campos = {};
    const motivoId = aEntero(datos.motivoId);
    if (!motivoId) campos.motivoId = 'Elige el motivo.';
    const nota = texto(datos.nota, 255, campos, 'nota', 'La nota');
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos.', campos);
    return this._registrar(usuario, id, datos.idempotencyKey, 'perdida', async ({ tx, participacion, proyecto, bloqueada }) => {
      if (bloqueada.estado === 'vendida') throw new ErrorDeNegocio('Esta empresa ya compró: no se puede marcar como perdida.', 409);
      if (!(await repo.motivoActivo(motivoId, tx))) throw errorDeValidacion('Revisa los datos.', { motivoId: 'Ese motivo ya no está disponible.' });
      await repo.actualizar(tx, participacion.id, { estado: 'perdida', motivo_perdida_id: motivoId, proxima_gestion_en: null });
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'marcar_perdida', detalle: { participacionId: participacion.id, motivoId, nota } });
    });
  }

  async descartar(usuario, id, datos = {}) {
    const campos = {};
    const motivo = texto(datos.motivo, 255, campos, 'motivo', 'El motivo');
    if (!motivo && !campos.motivo) campos.motivo = 'Cuenta por qué se descarta la empresa.';
    if (Object.keys(campos).length) throw errorDeValidacion('Revisa los datos.', campos);
    return this._registrar(usuario, id, datos.idempotencyKey, 'descartar', async ({ tx, participacion, proyecto, bloqueada }) => {
      if (bloqueada.estado === 'vendida') throw new ErrorDeNegocio('Esta empresa ya compró: no se puede descartar.', 409);
      await repo.actualizar(tx, participacion.id, { estado: 'descartada', proxima_gestion_en: null });
      await proyectoRepository.registrarHistorial(tx, { proyectoId: proyecto.id, usuarioId: usuario.id, accion: 'descartar_empresa', detalle: { participacionId: participacion.id, motivo } });
    });
  }
}

module.exports = new GestionService();
