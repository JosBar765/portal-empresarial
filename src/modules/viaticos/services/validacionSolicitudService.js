// src/modules/viaticos/services/validacionSolicitudService.js
// Reglas de una solicitud de viáticos. `normalizarDatos` valida la forma del payload; `evaluar` aplica las reglas
// de negocio sobre un contexto ya leído de la base (sin I/O). Ambas acumulan los errores en lugar de cortar en el primero.
const { MODALIDADES, LIMITES, LIMITES_SOLICITUD, SALVEDADES } = require('../constantes');
const { Validador, cuerpoObjeto } = require('../validacion');
const { fueraDelViaje, comidasSinValor } = require('./calculoService');
const { formatearFecha } = require('./pipelineService');
const { msg } = require('../mensajes');

const MODALIDADES_VALIDAS = Object.values(MODALIDADES);

// ---------------------------------------------------------------------------------------------------------------
// Forma del payload
// ---------------------------------------------------------------------------------------------------------------

function aListaDeErrores(campos) {
  return Object.entries(campos).map(([campo, mensaje]) => ({ campo, mensaje }));
}

// Valida un renglón con su propio Validador y vuelca sus fallas con el prefijo «lista[i].».
function enRenglon(v, prefijo, fn) {
  const sub = new Validador();
  const resultado = fn(sub);
  Object.entries(sub.campos).forEach(([campo, mensaje]) => v.falla(`${prefijo}.${campo}`, mensaje));
  return resultado;
}

// Devuelve los renglones (objetos) de una lista opcional; [] si no vino.
function lista(v, cuerpo, campo, etiqueta, max) {
  const valor = cuerpo[campo];
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    v.falla(campo, msg('solicitud.lista', { etiqueta }));
    return [];
  }
  if (valor.length > max) {
    v.falla(campo, msg('solicitud.listaMaxima', { etiqueta, max, cantidad: valor.length }));
    return [];
  }
  if (!valor.every(r => r && typeof r === 'object' && !Array.isArray(r))) {
    v.falla(campo, msg('solicitud.renglon', { etiqueta }));
    return [];
  }
  return valor;
}

function noAplica(v, campo, etiqueta, presente, modalidad) {
  if (presente) v.falla(campo, msg('solicitud.noAplica', { etiqueta, modalidad: msg(`modalidad.texto.${modalidad}`) }));
}

function valorMonto(v, fila, campo, etiqueta) {
  return v.decimal(fila, campo, etiqueta, { minExclusivo: true, max: LIMITES.VALOR_MAX });
}

function normalizarViajeLargo(v, cuerpo, datos) {
  datos.monedaId = v.id(cuerpo, 'monedaId', 'Moneda');
  datos.fechaSalida = v.fecha(cuerpo, 'fechaSalida', 'Fecha de salida');
  datos.fechaRegreso = v.fecha(cuerpo, 'fechaRegreso', 'Fecha de regreso');
  datos.rendimientoKmGalon = valorMonto(v, cuerpo, 'rendimientoKmGalon', 'Rendimiento (km por galón)');
  datos.precioGalon = valorMonto(v, cuerpo, 'precioGalon', 'Precio por galón');
  datos.depreciacionPorKm = v.decimal(cuerpo, 'depreciacionPorKm', 'Depreciación por km', { minExclusivo: true, max: LIMITES.VALOR_MAX, requerido: false });

  const tramos = lista(v, cuerpo, 'tramos', 'Tramos', LIMITES_SOLICITUD.MAX_TRAMOS);
  if (tramos.length === 0 && !v.campos.tramos) v.falla('tramos', msg('solicitud.tramosVacio'));
  datos.tramos = tramos.map((t, i) => enRenglon(v, `tramos[${i}]`, s => ({
    origenId: s.id(t, 'origenId', `Origen del tramo ${i + 1}`),
    destinoId: s.id(t, 'destinoId', `Destino del tramo ${i + 1}`)
  })));

  datos.hospedajes = lista(v, cuerpo, 'hospedajes', 'Hospedaje', LIMITES_SOLICITUD.MAX_HOSPEDAJES).map((h, i) => enRenglon(v, `hospedajes[${i}]`, s => ({
    hotel: s.texto(h, 'hotel', `Hotel del renglón ${i + 1}`, { max: LIMITES_SOLICITUD.HOTEL }),
    lugar: s.texto(h, 'lugar', `Lugar del renglón ${i + 1}`, { max: LIMITES_SOLICITUD.LUGAR }),
    noches: s.entero(h, 'noches', `Noches del renglón ${i + 1}`, { min: 1, max: LIMITES_SOLICITUD.MAX_NOCHES }),
    valorNoche: valorMonto(s, h, 'valorNoche', `Valor por noche del renglón ${i + 1}`)
  })));

  datos.comidas = lista(v, cuerpo, 'comidas', 'Comidas', LIMITES_SOLICITUD.MAX_COMIDAS).map((c, i) => enRenglon(v, `comidas[${i}]`, s => ({
    fecha: s.fecha(c, 'fecha', `Día de la comida ${i + 1}`),
    tipoComidaId: s.id(c, 'tipoComidaId', `Tipo de la comida ${i + 1}`)
  })));

  datos.gastos = lista(v, cuerpo, 'gastos', 'Otros gastos', LIMITES_SOLICITUD.MAX_GASTOS).map((g, i) => enRenglon(v, `gastos[${i}]`, s => ({
    tipoGastoId: s.id(g, 'tipoGastoId', `Tipo del gasto ${i + 1}`),
    descripcion: s.texto(g, 'descripcion', `Descripción del gasto ${i + 1}`, { max: LIMITES_SOLICITUD.DESCRIPCION }),
    monto: valorMonto(s, g, 'monto', `Monto del gasto ${i + 1}`)
  })));
}

function normalizarInspeccion(v, cuerpo) {
  const bruto = cuerpo.inspeccion;
  if (bruto === undefined || bruto === null) {
    v.falla('inspeccion', msg('solicitud.inspeccionFalta'));
    return null;
  }
  if (typeof bruto !== 'object' || Array.isArray(bruto)) {
    v.falla('inspeccion', msg('solicitud.objeto', { etiqueta: 'Inspección' }));
    return null;
  }
  const sub = new Validador();
  const inspeccion = { odometro: sub.decimal(bruto, 'odometro', 'Odómetro', { minExclusivo: true, max: LIMITES.VALOR_MAX }) };
  inspeccion.fluidos = lista(sub, bruto, 'fluidos', 'Fluidos', LIMITES_SOLICITUD.MAX_RENGLONES_INSPECCION).map((f, i) => enRenglon(sub, `fluidos[${i}]`, s => ({
    fluidoId: s.id(f, 'fluidoId', `Fluido ${i + 1}`),
    nivelId: s.id(f, 'nivelId', `Nivel del fluido ${i + 1}`)
  })));
  inspeccion.kit = lista(sub, bruto, 'kit', 'Kit de emergencia', LIMITES_SOLICITUD.MAX_RENGLONES_INSPECCION).map((k, i) => enRenglon(sub, `kit[${i}]`, s => ({
    kitItemId: s.id(k, 'kitItemId', `Elemento ${i + 1} del kit`),
    presente: s.booleano(k, 'presente', `Presencia del elemento ${i + 1} del kit`, { requerido: true }) === 1
  })));
  inspeccion.defectos = lista(sub, bruto, 'defectos', 'Defectos', LIMITES_SOLICITUD.MAX_DEFECTOS).map((d, i) => enRenglon(sub, `defectos[${i}]`, s => ({
    tipoDefectoId: s.id(d, 'tipoDefectoId', `Tipo del defecto ${i + 1}`),
    descripcion: s.texto(d, 'descripcion', `Descripción del defecto ${i + 1}`, { max: LIMITES_SOLICITUD.DESCRIPCION, requerido: false }),
    archivoIndice: s.entero(d, 'archivoIndice', `Foto del defecto ${i + 1}`, { min: 0, max: LIMITES_SOLICITUD.MAX_DEFECTOS - 1 })
  })));
  Object.entries(sub.campos).forEach(([campo, mensaje]) => v.falla(`inspeccion.${campo}`, mensaje));
  return inspeccion;
}

// Devuelve { datos, errores }: `datos` solo es confiable si `errores` viene vacío.
function normalizarDatos(cuerpoCrudo) {
  const cuerpo = cuerpoObjeto(cuerpoCrudo);
  const v = new Validador();
  const modalidad = cuerpo.modalidad;
  if (!MODALIDADES_VALIDAS.includes(modalidad)) v.falla('modalidad', msg('solicitud.modalidad', { valor: String(modalidad) }));
  const datos = {
    modalidad,
    paisId: v.id(cuerpo, 'paisId', 'País'),
    vehiculoId: v.id(cuerpo, 'vehiculoId', 'Vehículo'),
    motivoId: v.id(cuerpo, 'motivoId', 'Motivo del viaje'),
    monedaId: null, fechaSalida: null, fechaRegreso: null,
    rendimientoKmGalon: null, precioGalon: null, depreciacionPorKm: null,
    tramos: [], hospedajes: [], comidas: [], gastos: [], inspeccion: null
  };
  if (modalidad === MODALIDADES.MAS_DE_UN_DIA) {
    normalizarViajeLargo(v, cuerpo, datos);
    noAplica(v, 'inspeccion', 'Inspección', cuerpo.inspeccion !== undefined && cuerpo.inspeccion !== null, modalidad);
  } else if (modalidad === MODALIDADES.HASTA_UN_DIA) {
    datos.fechaSalida = v.fechaHora(cuerpo, 'fechaSalida', 'Fecha y hora de salida');
    datos.inspeccion = normalizarInspeccion(v, cuerpo);
    [['tramos', 'Tramos'], ['hospedajes', 'Hospedaje'], ['comidas', 'Comidas'], ['gastos', 'Otros gastos']]
      .forEach(([campo, etiqueta]) => noAplica(v, campo, etiqueta, Array.isArray(cuerpo[campo]) && cuerpo[campo].length > 0, modalidad));
  }
  return { datos, errores: aListaDeErrores(v.campos) };
}

// ---------------------------------------------------------------------------------------------------------------
// Reglas de negocio
// ---------------------------------------------------------------------------------------------------------------

const claveDePar = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;

function validarPais(datos, ctx, errores) {
  if (ctx.paisIds.length === 0) errores.push({ campo: 'paisId', mensaje: msg('solicitud.sinPaises') });
  else if (!ctx.paisIds.includes(datos.paisId)) errores.push({ campo: 'paisId', mensaje: msg('solicitud.paisNoAsignado') });
}

function validarCatalogosSimples(datos, ctx, errores) {
  if (datos.modalidad === MODALIDADES.MAS_DE_UN_DIA) {
    if (!ctx.moneda) errores.push({ campo: 'monedaId', mensaje: msg('solicitud.monedaNoExiste') });
    else if (!ctx.moneda.activo) errores.push({ campo: 'monedaId', mensaje: msg('solicitud.monedaInactiva', { nombre: ctx.moneda.nombre }) });
  }
  if (!ctx.motivo) errores.push({ campo: 'motivoId', mensaje: msg('solicitud.motivoNoExiste') });
  else if (!ctx.motivo.activo) errores.push({ campo: 'motivoId', mensaje: msg('solicitud.motivoInactivo', { nombre: ctx.motivo.nombre }) });
}

// Devuelve true si el vehículo es utilizable (las demás reglas del vehículo dependen de ello).
function validarVehiculo(datos, ctx, hoy, errores) {
  const veh = ctx.vehiculo;
  if (!veh) {
    errores.push({ campo: 'vehiculoId', mensaje: msg('solicitud.vehiculoNoExiste') });
    return false;
  }
  const falla = mensaje => errores.push({ campo: 'vehiculoId', mensaje });
  const placa = veh.placa;
  const esCorto = datos.modalidad === MODALIDADES.HASTA_UN_DIA;
  let valido = true;
  if (!veh.activo) { falla(msg('solicitud.vehiculoInactivo', { placa })); valido = false; }
  if (veh.paisId !== datos.paisId) { falla(msg('solicitud.vehiculoOtroPais', { placa })); valido = false; }
  if (veh.propietarioId !== null && veh.propietarioId !== ctx.usuarioId) { falla(msg('solicitud.vehiculoAjeno', { placa })); valido = false; }
  if (esCorto && veh.propietarioId !== null) { falla(msg('solicitud.vehiculoPropioViajeCorto', { placa })); valido = false; }
  if (esCorto && veh.tarjetaVenceEl < hoy) { falla(msg('solicitud.tarjetaVencida', { placa, fecha: formatearFecha(veh.tarjetaVenceEl) })); valido = false; }
  if (!esCorto && veh.propietarioId !== null && !(datos.depreciacionPorKm > 0)) {
    errores.push({ campo: 'depreciacionPorKm', mensaje: msg('solicitud.depreciacionObligatoria') });
  }
  return valido;
}

// Errores de la licencia del solicitante, con o sin vehículo elegido; el catálogo de la solicitud los reutiliza para marcar vehículos.
function erroresDeLicencia({ licencia, vehiculo, regla, paisNombre, hoy }) {
  if (!licencia) return [{ campo: 'licencia', mensaje: msg('solicitud.licenciaFaltante') }];
  if (licencia.venceEl < hoy) {
    return [{ campo: 'licencia', mensaje: msg('solicitud.licenciaVencida', { fecha: formatearFecha(licencia.venceEl), hoy: formatearFecha(hoy) }) }];
  }
  if (!vehiculo) return [];
  const base = { tipo: licencia.tipoLicenciaNombre, placa: vehiculo.placa, tipoPlaca: vehiculo.tipoPlacaNombre, pais: paisNombre };
  const falla = mensaje => [{ campo: 'vehiculoId', mensaje }];
  if (!regla) return falla(msg('solicitud.licenciaNoSirve', base));
  if (regla.tonelajeMax !== null) {
    if (vehiculo.tonelaje === null) return falla(msg('solicitud.licenciaTonelajeSinDato', { ...base, max: regla.tonelajeMax }));
    if (vehiculo.tonelaje > regla.tonelajeMax) return falla(msg('solicitud.licenciaTonelaje', { ...base, max: regla.tonelajeMax, valor: vehiculo.tonelaje }));
  }
  if (regla.pasajerosMax !== null) {
    if (vehiculo.pasajeros === null) return falla(msg('solicitud.licenciaPasajerosSinDato', { ...base, max: regla.pasajerosMax }));
    if (vehiculo.pasajeros > regla.pasajerosMax) return falla(msg('solicitud.licenciaPasajeros', { ...base, max: regla.pasajerosMax, valor: vehiculo.pasajeros }));
  }
  return [];
}

function validarLicencia(ctx, hoy, vehiculoValido, errores) {
  errores.push(...erroresDeLicencia({
    licencia: ctx.licencia, vehiculo: vehiculoValido ? ctx.vehiculo : null, regla: ctx.regla, paisNombre: ctx.pais ? ctx.pais.nombre : '', hoy
  }));
}

// Rango de días que ocupa el viaje (inclusive): [salida, regreso] o solo el día de salida.
function rangoDelViaje(datos) {
  const desde = datos.fechaSalida.slice(0, 10);
  return { desde, hasta: datos.modalidad === MODALIDADES.MAS_DE_UN_DIA ? datos.fechaRegreso : desde };
}

// Devuelve true si las fechas son coherentes (las reglas que dependen de ellas se omiten si no).
function validarFechas(datos, ctx, hoy, ahora, errores) {
  const esLargo = datos.modalidad === MODALIDADES.MAS_DE_UN_DIA;
  const salida = datos.fechaSalida.slice(0, 10);
  let coherentes = true;
  if (salida < hoy) {
    errores.push({ campo: 'fechaSalida', mensaje: msg('solicitud.fechaPasada', { etiqueta: 'Fecha de salida', fecha: formatearFecha(salida), hoy: formatearFecha(hoy) }) });
    coherentes = false;
  } else if (!esLargo && datos.fechaSalida < ahora) {
    errores.push({ campo: 'fechaSalida', mensaje: msg('solicitud.horaPasada', { fecha: datos.fechaSalida, ahora: ahora.slice(11) }) });
    coherentes = false;
  }
  if (esLargo && datos.fechaRegreso <= salida) {
    errores.push({ campo: 'fechaRegreso', mensaje: msg('solicitud.regresoAnterior', { regreso: formatearFecha(datos.fechaRegreso), salida: formatearFecha(salida) }) });
    coherentes = false;
  }
  if (coherentes && ctx.traslapes.length > 0) {
    const t = ctx.traslapes[0];
    errores.push({ campo: 'fechaSalida', mensaje: msg('solicitud.traslape', { correlativo: t.correlativo, desde: formatearFecha(t.fechaSalida), hasta: formatearFecha(t.fechaRegreso || t.fechaSalida) }) });
  }
  return coherentes;
}

// Devuelve los tramos resueltos (con km y horas del catálogo) en el orden del viaje.
function validarRuta(datos, ctx, errores) {
  const resueltos = [];
  datos.tramos.forEach((tramo, i) => {
    const numero = i + 1;
    const origen = ctx.ubicaciones.get(tramo.origenId);
    const destino = ctx.ubicaciones.get(tramo.destinoId);
    const campo = `tramos[${i}]`;
    if (!origen || !destino) {
      errores.push({ campo, mensaje: msg('solicitud.ubicacionNoExiste', { numero }) });
      return;
    }
    if (tramo.origenId === tramo.destinoId) {
      errores.push({ campo, mensaje: msg('solicitud.tramoMismoLugar', { numero, nombre: origen.nombre }) });
      return;
    }
    const anterior = datos.tramos[i - 1];
    if (anterior && anterior.destinoId !== tramo.origenId) {
      const esperado = ctx.ubicaciones.get(anterior.destinoId);
      errores.push({ campo, mensaje: msg('solicitud.tramoEncadenado', { numero, esperado: esperado ? esperado.nombre : String(anterior.destinoId), origen: origen.nombre }) });
    }
    const catalogo = ctx.tramosPorPar.get(claveDePar(tramo.origenId, tramo.destinoId));
    const nombres = { numero, origen: origen.nombre, destino: destino.nombre };
    if (!catalogo) errores.push({ campo, mensaje: msg('solicitud.tramoNoExiste', nombres) });
    else if (!catalogo.activo) errores.push({ campo, mensaje: msg('solicitud.tramoInactivo', nombres) });
    else resueltos.push({ orden: numero, tramoId: catalogo.id, origenId: tramo.origenId, origenNombre: origen.nombre, destinoId: tramo.destinoId, destinoNombre: destino.nombre, km: catalogo.km, horas: catalogo.horas });
  });
  return resueltos;
}

function validarComidas(datos, ctx, errores) {
  const vistas = new Set();
  datos.comidas.forEach((comida, i) => {
    const campo = `comidas[${i}]`;
    const tipo = ctx.tiposComida.find(t => t.id === comida.tipoComidaId);
    if (!tipo) {
      errores.push({ campo, mensaje: msg('solicitud.tipoComidaNoExiste') });
      return;
    }
    if (fueraDelViaje(comida.fecha, datos.fechaSalida, datos.fechaRegreso)) {
      errores.push({ campo, mensaje: msg('solicitud.comidaFueraDeFechas', { fecha: formatearFecha(comida.fecha), salida: formatearFecha(datos.fechaSalida), regreso: formatearFecha(datos.fechaRegreso) }) });
    }
    const clave = `${comida.fecha}|${comida.tipoComidaId}`;
    if (vistas.has(clave)) errores.push({ campo, mensaje: msg('solicitud.comidaRepetida', { comida: tipo.nombre, fecha: formatearFecha(comida.fecha) }) });
    vistas.add(clave);
  });
  if (!ctx.moneda) return;
  const conocidas = datos.comidas.filter(c => ctx.tiposComida.some(t => t.id === c.tipoComidaId));
  comidasSinValor(conocidas, ctx.valoresPorTipo, ctx.tiposComida).forEach(tipo => {
    errores.push({ campo: 'comidas', mensaje: msg('solicitud.comidaSinValor', { comida: tipo.nombre, moneda: ctx.moneda ? ctx.moneda.nombre : '' }) });
  });
}

function validarGastos(datos, ctx, errores) {
  datos.gastos.forEach((gasto, i) => {
    const campo = `gastos[${i}]`;
    const tipo = ctx.tiposGasto.get(gasto.tipoGastoId);
    if (!tipo) errores.push({ campo, mensaje: msg('solicitud.tipoGastoNoExiste') });
    else if (!tipo.activo) errores.push({ campo, mensaje: msg('solicitud.tipoGastoInactivo', { nombre: tipo.nombre }) });
    else if (!tipo.seleccionableEnGastos) errores.push({ campo, mensaje: msg('solicitud.tipoGastoNoSeleccionable', { nombre: tipo.nombre }) });
  });
}

function validarInspeccion(datos, ctx, errores) {
  const insp = datos.inspeccion;
  if (!insp) return;
  const vistos = new Set();
  insp.fluidos.forEach((f, i) => {
    const campo = `inspeccion.fluidos[${i}]`;
    const fluido = ctx.fluidos.find(x => x.id === f.fluidoId);
    const nivel = ctx.niveles.get(f.nivelId);
    if (!fluido) return errores.push({ campo, mensaje: msg('solicitud.fluidoNoExiste') });
    if (vistos.has(fluido.id)) errores.push({ campo, mensaje: msg('solicitud.fluidoRepetido', { fluido: fluido.nombre }) });
    vistos.add(fluido.id);
    if (!nivel) errores.push({ campo, mensaje: msg('solicitud.nivelNoExiste') });
    else if (nivel.esNoAplica && !fluido.permiteNoAplica) errores.push({ campo, mensaje: msg('solicitud.nivelNoAplica', { nivel: nivel.nombre, fluido: fluido.nombre }) });
  });
  ctx.fluidos.filter(f => !vistos.has(f.id)).forEach(f => {
    errores.push({ campo: 'inspeccion.fluidos', mensaje: msg('solicitud.fluidoFaltante', { fluido: f.nombre }) });
  });
  const kitVistos = new Set();
  insp.kit.forEach((k, i) => {
    const item = ctx.kitItems.get(k.kitItemId);
    if (!item) return errores.push({ campo: `inspeccion.kit[${i}]`, mensaje: msg('solicitud.kitNoExiste') });
    if (kitVistos.has(item.id)) errores.push({ campo: `inspeccion.kit[${i}]`, mensaje: msg('solicitud.kitRepetido', { item: item.nombre }) });
    kitVistos.add(item.id);
  });
  insp.defectos.forEach((d, i) => {
    const campo = `inspeccion.defectos[${i}]`;
    const tipo = ctx.tiposDefecto.get(d.tipoDefectoId);
    if (!tipo) errores.push({ campo, mensaje: msg('solicitud.defectoNoExiste') });
    else if (!tipo.activo) errores.push({ campo, mensaje: msg('solicitud.defectoInactivo', { nombre: tipo.nombre }) });
    else if (tipo.esOtros && !d.descripcion) errores.push({ campo, mensaje: msg('solicitud.defectoDescripcion', { nombre: tipo.nombre, max: LIMITES_SOLICITUD.DESCRIPCION }) });
  });
}

// Advertencias: no bloquean y se guardan como salvedades. `fin` es el último día del viaje.
function calcularAdvertencias(ctx, hoy, fin) {
  const salida = [];
  const agregar = (clave, claveMensaje, params) => salida.push({ clave, salvedadId: ctx.salvedades.get(clave) ?? null, mensaje: msg(claveMensaje, params) });
  const lic = ctx.licencia;
  if (lic && lic.venceEl >= hoy && lic.venceEl <= fin) agregar(SALVEDADES.LICENCIA, 'advertencia.licenciaVence', { fecha: formatearFecha(lic.venceEl) });
  const veh = ctx.vehiculo;
  if (veh) {
    const params = fecha => ({ placa: veh.placa, fecha: formatearFecha(fecha) });
    if (veh.tarjetaVenceEl < hoy) agregar(SALVEDADES.TARJETA_CIRCULACION, 'advertencia.tarjetaVencida', params(veh.tarjetaVenceEl));
    else if (veh.tarjetaVenceEl <= fin) agregar(SALVEDADES.TARJETA_CIRCULACION, 'advertencia.tarjetaVence', params(veh.tarjetaVenceEl));
    if (veh.polizaVenceEl) {
      if (veh.polizaVenceEl < hoy) agregar(SALVEDADES.SEGURO, 'advertencia.seguroVencido', params(veh.polizaVenceEl));
      else if (veh.polizaVenceEl <= fin) agregar(SALVEDADES.SEGURO, 'advertencia.seguroVence', params(veh.polizaVenceEl));
    }
  }
  return salida;
}

// Aplica las reglas de negocio. `hoy` es «AAAA-MM-DD» y `ahora` «AAAA-MM-DD HH:mm», ambos de Guatemala.
// Devuelve { errores, advertencias, tramos, vehiculoPropio }; `tramos` trae km y horas del catálogo.
function evaluar({ datos, ctx, hoy, ahora }) {
  const errores = [];
  validarPais(datos, ctx, errores);
  validarCatalogosSimples(datos, ctx, errores);
  const vehiculoValido = validarVehiculo(datos, ctx, hoy, errores);
  validarLicencia(ctx, hoy, vehiculoValido, errores);
  const fechasCoherentes = validarFechas(datos, ctx, hoy, ahora, errores);
  let tramos = [];
  if (datos.modalidad === MODALIDADES.MAS_DE_UN_DIA) {
    tramos = validarRuta(datos, ctx, errores);
    validarComidas(datos, ctx, errores);
    validarGastos(datos, ctx, errores);
  } else {
    validarInspeccion(datos, ctx, errores);
  }
  const advertencias = fechasCoherentes ? calcularAdvertencias(ctx, hoy, rangoDelViaje(datos).hasta) : [];
  return { errores, advertencias, tramos, vehiculoPropio: Boolean(ctx.vehiculo && ctx.vehiculo.propietarioId !== null) };
}

module.exports = { normalizarDatos, evaluar, erroresDeLicencia, rangoDelViaje, claveDePar };
