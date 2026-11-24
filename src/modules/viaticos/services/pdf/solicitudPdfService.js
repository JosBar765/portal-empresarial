// src/modules/viaticos/services/pdf/solicitudPdfService.js
// PDF «SOLICITUD DE VIÁTICOS»: misma apariencia que el vale de arte (Carta, estilo recibo en blanco y negro).
// Es una función pura del detalle de la solicitud: no lee la base ni Storage (eso lo hace documentoService).
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { ErrorDeNegocio } = require('../../../../core/utils/erroresHttp');
const { ahoraUTC6 } = require('../../../../core/calendario/calendarioLaboral');
const { MODALIDADES, ESTADOS, NIVELES_RESALTADOS, MIME_IMAGEN_PDF } = require('../../constantes');
const { aCentavos } = require('../../dinero');
const { msg, CATALOGO } = require('../../mensajes');
const { sumarTramos, calcularCombustible, calcularDepreciacion, calcularHospedaje, calcularOtrosGastos } = require('../calculoService');
const {
  PAGINA, ANCHO_CONTENIDO, ALTURA_MAYUSCULA, COLOR, partirEnLineas, formatearFecha, formatearNumero, formatearDinero, capitalizar,
  ancho, texto, textoDerecha, textoMulticolor, linea
} = require('./pdfHelpers');

const RUTA_LOGO = path.join(__dirname, '../../../../../public/assets/logos/LOGO_GP_isotipo.png');
const TAMANO_TITULO_REFERENCIA = 18;
const COLUMNAS_IMAGENES = 3;
const SEPARACION_IMAGENES = 10;
const ALTO_FILA = 14;
const ALTO_LOGO_MAX = 38;
const ALTO_TOTAL_FILA = 16;
const SEPARACION_GUIA = 4;
// Aire entre secciones: medido desde la última línea base (o regla de cierre) hasta el tope de la siguiente; es el que ya tenía «LECTURA ODÓMETRO».
const SEPARACION_SECCIONES = 12;
const ALTO_DESGLOSE = 18;
// Las firmas viven siempre a esta altura (sobre el pie «n/total»); el cierre no baja de LIMITE_CIERRE.
const Y_FIRMAS = PAGINA.ALTO_PIE + 30;
const LIMITE_CIERRE = Y_FIRMAS + 16;

const t = (clave, params) => msg(`pdf.${clave}`, params);

let juegoDeCaracteres = null;
const INVISIBLE = new RegExp('[\\p{Cc}\\p{Cf}\\p{Z}]', 'u');
const mostrarCaracter = c => (INVISIBLE.test(c) ? `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}` : c);

async function caracteresDibujables() {
  if (!juegoDeCaracteres) {
    const doc = await PDFDocument.create();
    juegoDeCaracteres = new Set((await doc.embedFont(StandardFonts.Helvetica)).getCharacterSet());
  }
  return juegoDeCaracteres;
}

// Errores {campo, mensaje} por cada texto con caracteres que Helvetica no dibuja (emoji, flechas, chino…).
async function erroresDeTextos(campos) {
  const dibujables = await caracteresDibujables();
  const errores = [];
  for (const { campo, etiqueta, valor } of campos) {
    const malos = [...new Set([...String(valor ?? '')].filter(c => {
      const cp = c.codePointAt(0);
      return !dibujables.has(cp) && cp !== 9 && cp !== 10 && cp !== 13;
    }))];
    if (malos.length) errores.push({ campo, mensaje: t('textoInvalido', { etiqueta, caracteres: malos.slice(0, 5).map(mostrarCaracter).join(' ') }) });
  }
  return errores;
}

async function validarTextos(campos) {
  const [primero] = await erroresDeTextos(campos);
  if (primero) throw new ErrorDeNegocio(primero.mensaje, 400);
}

// El título ocupa el mismo ancho que «VALE DE ARTE» a 18 pt: la letra se achica en proporción.
function calcularTamanoTitulo(fontBold) {
  const objetivo = fontBold.widthOfTextAtSize(t('tituloReferencia'), TAMANO_TITULO_REFERENCIA);
  return TAMANO_TITULO_REFERENCIA * objetivo / fontBold.widthOfTextAtSize(t('titulo'), TAMANO_TITULO_REFERENCIA);
}

function nuevaPagina(ctx) {
  ctx.page = ctx.pdfDoc.addPage([PAGINA.ANCHO, PAGINA.ALTO]);
  ctx.y = PAGINA.ALTO - PAGINA.MARGEN;
  dibujarEncabezado(ctx);
}

// Si no cabe `alto`, sigue en una hoja nueva con su encabezado.
function asegurarEspacio(ctx, alto) {
  if (ctx.y - alto < PAGINA.LIMITE_INFERIOR) nuevaPagina(ctx);
}

// Cierra una sección dejando SEPARACION_SECCIONES bajo su última línea base (o regla de cierre).
function separarSeccion(ctx, yReferencia) {
  ctx.y = yReferencia - SEPARACION_SECCIONES;
}

// Bloque de dos líneas (arriba: altura de mayúscula; abajo: línea base) centrado en el eje `yCentro`.
function dibujarBloqueCentrado(ctx, yCentro, x, superior, inferior, separacion) {
  const altoBloque = ALTURA_MAYUSCULA * superior.size + separacion;
  const baseSuperior = yCentro + altoBloque / 2 - ALTURA_MAYUSCULA * superior.size;
  texto(ctx, superior.valor, x, baseSuperior, superior);
  texto(ctx, inferior.valor, x, baseSuperior - separacion, inferior);
}

// El tope del logo queda a MARGEN del borde (igual que el margen izquierdo); los textos se centran en su eje.
function dibujarEncabezado(ctx) {
  const yTop = ctx.y;
  const dims = ctx.logo ? ctx.logo.scaleToFit(ANCHO_CONTENIDO * 0.14, ALTO_LOGO_MAX) : { width: 0, height: ALTO_LOGO_MAX };
  const yCentro = yTop - dims.height / 2;
  dibujarBloqueCentrado(ctx, yCentro, PAGINA.MARGEN,
    { valor: t('titulo'), size: ctx.tamanoTitulo, bold: true },
    { valor: t('subtitulo', { fecha: ctx.fechaTexto }), size: 8, color: COLOR.etiqueta }, 14);
  dibujarBloqueCentrado(ctx, yCentro, PAGINA.MARGEN + ANCHO_CONTENIDO * 0.44,
    { valor: t('correlativo'), size: 7, bold: true, color: COLOR.etiqueta },
    { valor: ctx.correlativo, size: 13, bold: true }, 16);
  if (ctx.logo) {
    ctx.page.drawImage(ctx.logo, { x: PAGINA.MARGEN + ANCHO_CONTENIDO - dims.width, y: yTop - dims.height, width: dims.width, height: dims.height });
  }
  const yLinea = yTop - dims.height - 6;
  linea(ctx, yLinea, { grosor: 1, color: COLOR.divisorFuerte });
  ctx.y = yLinea - 14;
}

// Grilla «etiqueta gris sobre valor» con una línea fina tras cada fila (igual que el vale de arte).
function dibujarSeccionCampos(ctx, titulo, filas) {
  const MAX_LINEAS = 3;
  const preparadas = filas.map(fila => {
    let maxLineasFila = 1;
    const celdas = fila.map(campo => {
      const w = ANCHO_CONTENIDO * campo.proporcion;
      const valor = campo.valor === null || campo.valor === undefined || campo.valor === '' ? '-' : String(campo.valor);
      const lineas = partirEnLineas(valor, s => ancho(ctx, s, 9), w - 8, MAX_LINEAS);
      maxLineasFila = Math.max(maxLineasFila, lineas.length);
      return { campo, lineas };
    });
    return { celdas, alto: Math.max(26, 15 + maxLineasFila * 11) };
  });
  asegurarEspacio(ctx, 22 + preparadas[0].alto + 8);
  texto(ctx, titulo, PAGINA.MARGEN, ctx.y - 10, { size: 10.5, bold: true });
  ctx.y -= 20;
  preparadas.forEach(fila => {
    asegurarEspacio(ctx, fila.alto);
    let x = PAGINA.MARGEN;
    fila.celdas.forEach(({ campo, lineas }) => {
      texto(ctx, campo.etiqueta, x, ctx.y - 7, { size: 6.5, bold: true, color: COLOR.etiqueta });
      lineas.forEach((l, i) => texto(ctx, l, x, ctx.y - 19 - i * 11, { size: 9 }));
      x += ANCHO_CONTENIDO * campo.proporcion;
    });
    ctx.y -= fila.alto;
    linea(ctx, ctx.y);
  });
  separarSeccion(ctx, ctx.y);
}

// Título de subsección a la izquierda y su cálculo (opcional, texto o partes de color) a la derecha.
function dibujarSubtitulo(ctx, titulo, calculo) {
  texto(ctx, titulo, PAGINA.MARGEN, ctx.y - 10, { size: 10.5, bold: true });
  const derecha = PAGINA.MARGEN + ANCHO_CONTENIDO;
  if (typeof calculo === 'string') textoDerecha(ctx, calculo, derecha, ctx.y - 10, { size: 9, bold: true });
  else if (Array.isArray(calculo)) textoMulticolor(ctx, calculo.map(p => ({ bold: true, ...p })), derecha, ctx.y - 10);
  ctx.y -= 18;
}

// columnas: { etiqueta, x, w (fracciones del ancho), alinear: 'izq'|'der', valor(fila), color?(fila), dibujar?(ctx, fila, x, y) }.
function dibujarTabla(ctx, columnas, filas, { encabezado = true, reservaFinal = 0, guia = false } = {}) {
  const borde = fraccion => PAGINA.MARGEN + fraccion * ANCHO_CONTENIDO;
  const preparar = fila => {
    // Una celda vacía queda en blanco (no «-»).
    const celdas = columnas.map(c => {
      if (c.dibujar) return [''];
      const valor = c.valor(fila);
      return valor === '' || valor === null || valor === undefined ? [] : partirEnLineas(valor, s => ancho(ctx, s, 9), c.w * ANCHO_CONTENIDO - 8, 2);
    });
    return { celdas, alto: Math.max(1, ...celdas.map(l => l.length)) * 11 + 3 };
  };
  if (encabezado) {
    columnas.forEach(c => {
      if (c.alinear === 'der') textoDerecha(ctx, c.etiqueta, borde(c.x + c.w), ctx.y - 7, { size: 6.5, bold: true, color: COLOR.etiqueta });
      else texto(ctx, c.etiqueta, borde(c.x), ctx.y - 7, { size: 6.5, bold: true, color: COLOR.etiqueta });
    });
    ctx.y -= 11;
    linea(ctx, ctx.y);
    ctx.y -= 2;
  }
  let yBase = ctx.y;
  filas.forEach((fila, indice) => {
    const { celdas, alto } = preparar(fila);
    // La última fila viaja con la fila de total para que la suma no quede sola en otra hoja.
    asegurarEspacio(ctx, alto + (indice === filas.length - 1 ? reservaFinal : 0));
    columnas.forEach((c, i) => {
      if (c.dibujar) { c.dibujar(ctx, fila, borde(c.x), ctx.y - 10); return; }
      const opciones = { size: 9, color: c.color ? c.color(fila) : COLOR.texto };
      celdas[i].forEach((l, n) => {
        if (c.alinear === 'der') textoDerecha(ctx, l, borde(c.x + c.w), ctx.y - 10 - n * 11, opciones);
        else texto(ctx, l, borde(c.x), ctx.y - 10 - n * 11, opciones);
      });
    });
    if (guia) dibujarGuia(ctx, columnas, celdas, borde);
    yBase = ctx.y - 10 - (Math.max(...celdas.map(l => l.length), 1) - 1) * 11;
    ctx.y -= alto;
  });
  // Con fila de total, la tabla solo deja su aire interno; la sección se cierra tras el total.
  if (reservaFinal) ctx.y -= 4;
  else separarSeccion(ctx, yBase);
}

// Línea punteada entre el nombre (primera columna) y el valor (última, a la derecha); se omite si no cabe.
function dibujarGuia(ctx, columnas, celdas, borde) {
  const ultima = columnas.length - 1;
  const nombre = celdas[0][0];
  const valor = celdas[ultima][0];
  if (!nombre || !valor) return;
  const desde = borde(columnas[0].x) + ancho(ctx, nombre, 9) + SEPARACION_GUIA;
  const hasta = borde(columnas[ultima].x + columnas[ultima].w) - ancho(ctx, valor, 9) - SEPARACION_GUIA;
  if (hasta - desde < 6) return;
  ctx.page.drawLine({
    start: { x: desde, y: ctx.y - 10 }, end: { x: hasta, y: ctx.y - 10 }, thickness: 0.6, color: COLOR.guia, dashArray: [1, 2]
  });
}

// Fila final «TOTAL  <valor>» pegada al borde derecho, con una regla fina encima.
function dibujarFilaTotal(ctx, valor) {
  const derecha = PAGINA.MARGEN + ANCHO_CONTENIDO;
  linea(ctx, ctx.y + 1, { grosor: 0.75, color: COLOR.texto });
  textoDerecha(ctx, valor, derecha, ctx.y - 10, { size: 9, bold: true });
  textoDerecha(ctx, t('total'), derecha - ancho(ctx, valor, 9, true) - 10, ctx.y - 10, { size: 9, bold: true });
  separarSeccion(ctx, ctx.y - 10);
}

// Subsección completa: el título viaja con su cabecera y la primera fila para no quedar huérfano.
// `opciones.total` es el texto de la suma, que se dibuja al final de la sección (nunca en la fila del título).
function dibujarSubseccion(ctx, titulo, calculo, columnas, filas, opciones = {}) {
  const conEncabezado = opciones.encabezado !== false && filas.length > 0;
  // Con una sola fila, título, fila y total no se parten entre hojas.
  asegurarEspacio(ctx, 18 + (conEncabezado ? 13 : 0) + ALTO_FILA + 6 + (opciones.total && filas.length === 1 ? ALTO_TOTAL_FILA : 0));
  dibujarSubtitulo(ctx, titulo, calculo);
  if (filas.length === 0) {
    if (opciones.vacio !== false) {
      texto(ctx, t('sinRegistros'), PAGINA.MARGEN, ctx.y - 10, { size: 9, color: COLOR.etiqueta });
      separarSeccion(ctx, ctx.y - 10);
    } else {
      separarSeccion(ctx, ctx.y + 8); // la línea base del título está 10 pt bajo su tope
    }
    return;
  }
  dibujarTabla(ctx, columnas, filas, { encabezado: conEncabezado, reservaFinal: opciones.total ? ALTO_TOTAL_FILA : 0, guia: opciones.guia });
  if (opciones.total) dibujarFilaTotal(ctx, opciones.total);
}

// Divisor de la parte de desglose: barra negra de todo el ancho; viaja junto con la sección que le sigue.
function dibujarDivisorDesglose(ctx, altoSiguiente) {
  asegurarEspacio(ctx, ALTO_DESGLOSE + SEPARACION_SECCIONES + altoSiguiente);
  const y = ctx.y - ALTO_DESGLOSE;
  ctx.page.drawRectangle({ x: PAGINA.MARGEN, y, width: ANCHO_CONTENIDO, height: ALTO_DESGLOSE, color: COLOR.texto });
  const rotulo = t('desglose');
  texto(ctx, rotulo, PAGINA.MARGEN + (ANCHO_CONTENIDO - ancho(ctx, rotulo, 9.5, true)) / 2, y + 5.5, { size: 9.5, bold: true, color: rgb(1, 1, 1) });
  ctx.y = y - SEPARACION_SECCIONES;
}

// Flecha vectorial: Helvetica no dibuja «→».
function dibujarFlecha(ctx, x, y) {
  const opciones = { thickness: 0.6, color: COLOR.etiqueta };
  ctx.page.drawLine({ start: { x, y }, end: { x: x + 9, y }, ...opciones });
  ctx.page.drawLine({ start: { x: x + 9, y }, end: { x: x + 6.5, y: y + 2 }, ...opciones });
  ctx.page.drawLine({ start: { x: x + 9, y }, end: { x: x + 6.5, y: y - 2 }, ...opciones });
}

function recortar(ctx, valor, size, maxAncho) {
  let s = String(valor ?? '');
  if (ancho(ctx, s, size) <= maxAncho) return s;
  while (s.length > 1 && ancho(ctx, `${s}...`, size) > maxAncho) s = s.slice(0, -1);
  return `${s}...`;
}

function dibujarRutaDeTramo(ctx, tramo, x, y) {
  const disponible = ANCHO_CONTENIDO * 0.62 - 20;
  const mitad = disponible / 2;
  const origen = recortar(ctx, tramo.origenNombre, 9, mitad);
  const destino = recortar(ctx, tramo.destinoNombre, 9, mitad);
  texto(ctx, origen, x, y);
  const xFlecha = x + ancho(ctx, origen, 9) + 6;
  dibujarFlecha(ctx, xFlecha, y + 3);
  texto(ctx, destino, xFlecha + 15, y);
}

function seccionesDeViaje(ctx, detalle) {
  const esLargo = detalle.modalidad === MODALIDADES.MAS_DE_UN_DIA;
  const { solicitante, vehiculo, piloto } = detalle;
  // Con piloto la licencia que cuenta es la suya: reemplaza a la del solicitante en la misma fila para no romper la hoja única.
  const campoLicencia = piloto
    ? { etiqueta: t('conductor'), valor: t('conductorValor', { nombre: piloto.nombre, tipo: piloto.licenciaTipo || '-', numero: piloto.licenciaNumero }), proporcion: 0.5 }
    : {
      etiqueta: t('licencia'),
      valor: solicitante.licenciaNumero ? t('licenciaValor', { tipo: solicitante.licenciaTipo || '-', numero: solicitante.licenciaNumero }) : '',
      proporcion: 0.3
    };
  dibujarSeccionCampos(ctx, t('secSolicitante'), [[
    { etiqueta: t('solicitante'), valor: solicitante.nombre, proporcion: piloto ? 0.3 : 0.4 },
    { etiqueta: t('puesto'), valor: solicitante.puesto, proporcion: piloto ? 0.2 : 0.3 },
    campoLicencia
  ]]);
  dibujarSeccionCampos(ctx, t('secVehiculo'), [
    [
      { etiqueta: t('vehiculo'), valor: t('vehiculoValor', { marca: vehiculo.marca, modelo: vehiculo.modelo, anio: vehiculo.anio }), proporcion: 0.3 },
      { etiqueta: t('placa'), valor: vehiculo.placa, proporcion: 0.14 },
      { etiqueta: t('poliza'), valor: vehiculo.polizaNumero || '', proporcion: 0.24 },
      { etiqueta: t('combustible'), valor: capitalizar(vehiculo.combustible || ''), proporcion: 0.17 },
      { etiqueta: t('empresarial'), valor: vehiculo.esPropio ? t('no') : t('si'), proporcion: 0.15 }
    ]
  ]);
  dibujarSeccionCampos(ctx, t('secViaje'), [esLargo
    ? [
      { etiqueta: t('fechaSalida'), valor: formatearFecha(detalle.fechaSalida), proporcion: 0.25 },
      { etiqueta: t('fechaRegreso'), valor: formatearFecha(detalle.fechaRegreso), proporcion: 0.25 },
      { etiqueta: t('motivo'), valor: detalle.motivo.nombre, proporcion: 0.5 }
    ]
    : [
      { etiqueta: t('fechaHoraSalida'), valor: formatearFecha(detalle.fechaSalida, true), proporcion: 0.4 },
      { etiqueta: t('motivo'), valor: detalle.motivo.nombre, proporcion: 0.6 }
    ]]);
}

// Desglose de un viaje de más de 1 día; devuelve el total solicitado.
function seccionesDeCostos(ctx, detalle) {
  const simbolo = detalle.moneda ? detalle.moneda.simbolo : '';
  const dinero = importe => formatearDinero(simbolo, importe);
  const ruta = sumarTramos(detalle.tramos);
  const combustible = calcularCombustible({ kmTotal: ruta.kmTotal, rendimientoKmGalon: detalle.rendimientoKmGalon, precioGalon: detalle.precioGalon,
    capacidadTanque: detalle.tanqueLleno ? detalle.capacidadTanqueGalones : null
  });
  const hospedaje = calcularHospedaje(detalle.hospedajes);
  const otros = calcularOtrosGastos(detalle.gastos);
  const propio = detalle.vehiculo.esPropio && detalle.depreciacionPorKm !== null && detalle.depreciacionPorKm !== undefined;
  const depreciacion = propio ? calcularDepreciacion({ kmTotal: ruta.kmTotal, depreciacionPorKm: detalle.depreciacionPorKm }) : null;

  dibujarSubseccion(ctx, t('ruta'), null, [
    { etiqueta: t('colNumero'), x: 0, w: 0.06, valor: f => String(f.orden) },
    { etiqueta: t('colOrigenDestino'), x: 0.06, w: 0.62, dibujar: (c, f, x, y) => dibujarRutaDeTramo(c, f, x, y) },
    { etiqueta: t('colHoras'), x: 0.68, w: 0.16, alinear: 'der', valor: f => t('unidadHoras', { horas: formatearNumero(f.horas) }) },
    { etiqueta: t('colKm'), x: 0.84, w: 0.16, alinear: 'der', valor: f => t('unidadKm', { km: formatearNumero(f.km) }) }
  ], detalle.tramos, { total: t('unidadKm', { km: formatearNumero(ruta.kmTotal) }) });

  // Un cálculo es una sola línea de detalle (la fórmula) y cierra con su fila TOTAL, como las demás secciones.
  const lineaDeCalculo = [{ x: 0, w: 1, valor: f => f }];
  const formulaCombustible = detalle.tanqueLleno
    ? t('calcCombustibleTanque', {
      km: formatearNumero(ruta.kmTotal), rendimiento: formatearNumero(detalle.rendimientoKmGalon),
      capacidad: formatearNumero(detalle.capacidadTanqueGalones), precio: dinero(detalle.precioGalon)
    })
    : t('calcCombustible', {
      km: formatearNumero(ruta.kmTotal), rendimiento: formatearNumero(detalle.rendimientoKmGalon), precio: dinero(detalle.precioGalon)
    });
  dibujarSubseccion(ctx, t('combustibleTitulo'), null, lineaDeCalculo, [formulaCombustible],{ encabezado: false, total: dinero(combustible.importe) });
  if (depreciacion) {
    dibujarSubseccion(ctx, t('depreciacion'), null, lineaDeCalculo, [t('calcDepreciacion', {
      km: formatearNumero(ruta.kmTotal), tasa: dinero(detalle.depreciacionPorKm)
    })], { encabezado: false, total: dinero(depreciacion.importe) });
  }

  dibujarSubseccion(ctx, t('hospedaje'), null, [
    { etiqueta: t('colNumero'), x: 0, w: 0.06, valor: (f) => String(hospedaje.lineas.indexOf(f) + 1) },
    { etiqueta: t('colHotel'), x: 0.06, w: 0.3, valor: f => f.hotel },
    { etiqueta: t('colLugar'), x: 0.38, w: 0.26, valor: f => f.lugar },
    { etiqueta: t('colNoches'), x: 0.64, w: 0.08, alinear: 'der', valor: f => String(f.noches) },
    { etiqueta: t('colValorNoche'), x: 0.72, w: 0.14, alinear: 'der', valor: f => dinero(f.valorNoche) },
    { etiqueta: t('colTotal'), x: 0.86, w: 0.14, alinear: 'der', valor: f => dinero(f.total) }
  ], hospedaje.lineas, { total: dinero(hospedaje.importe) });

  const comidas = lineasDeComidas(detalle.comidas);
  const totalComidas = comidas.reduce((s, c) => s + c.totalCentavos, 0);
  dibujarSubseccion(ctx, t('comidas'), null, [
    { etiqueta: t('colCantidad'), x: 0, w: 0.14, valor: c => String(c.cantidad) },
    { etiqueta: t('colComida'), x: 0.14, w: 0.46, valor: c => c.nombre },
    { etiqueta: t('colPresupuesto'), x: 0.6, w: 0.2, alinear: 'der', valor: c => dinero(c.valorUnitario) },
    { etiqueta: t('colTotal'), x: 0.8, w: 0.2, alinear: 'der', valor: c => formatearDinero(simbolo, c.totalCentavos / 100) }
  ], comidas, { total: formatearDinero(simbolo, totalComidas / 100) });

  dibujarSubseccion(ctx, t('otrosGastos'), null, [
    { etiqueta: t('colTipo'), x: 0, w: 0.2, valor: f => f.tipoGastoNombre },
    { etiqueta: t('colDescripcion'), x: 0.2, w: 0.6, valor: f => f.descripcion || '' },
    { etiqueta: t('colMonto'), x: 0.8, w: 0.2, alinear: 'der', valor: f => dinero(f.monto) }
  ], otros.lineas, { total: dinero(otros.importe) });

  const calculado = (combustible.importe * 100 + (depreciacion ? depreciacion.importe * 100 : 0)
    + hospedaje.importe * 100 + totalComidas + otros.importe * 100) / 100;
  return { simbolo, total: detalle.totalSolicitado > 0 ? detalle.totalSolicitado : Math.round(calculado * 100) / 100 };
}

// Una línea por tipo de comida marcado: cantidad de comidas × valor guardado en cada solicitud.
function lineasDeComidas(comidas) {
  const porTipo = new Map();
  for (const c of comidas) {
    const actual = porTipo.get(c.tipoComidaId) || { tipoComidaId: c.tipoComidaId, nombreBase: c.tipoComidaNombre, valorUnitario: c.valorUnitario, cantidad: 0 };
    actual.cantidad += 1;
    porTipo.set(c.tipoComidaId, actual);
  }
  return [...porTipo.values()].sort((a, b) => a.tipoComidaId - b.tipoComidaId).map(c => {
    const clave = `pdf.comida.${c.nombreBase}`;
    return {
      ...c,
      nombre: Object.prototype.hasOwnProperty.call(CATALOGO, clave) ? msg(clave) : capitalizar(c.nombreBase),
      totalCentavos: c.cantidad * aCentavos(c.valorUnitario)
    };
  });
}

function seccionesDeInspeccion(ctx, detalle) {
  const { inspeccion } = detalle;
  const colorDeNivel = nombre => {
    const resaltado = NIVELES_RESALTADOS[nombre];
    return resaltado ? COLOR[resaltado] : COLOR.texto;
  };
  asegurarEspacio(ctx, 30);
  const yOdometro = ctx.y;
  dibujarSubtitulo(ctx, t('odometro'), t('unidadKm', { km: formatearNumero(inspeccion.odometro) }));
  separarSeccion(ctx, yOdometro - 10);

  const filaSimple = { x: 0, w: 0.7 };
  dibujarSubseccion(ctx, t('fluidos'), null, [
    { ...filaSimple, valor: f => capitalizar(f.fluidoNombre) },
    { x: 0.7, w: 0.3, alinear: 'der', valor: f => f.nivelNombre, color: f => colorDeNivel(f.nivelNombre) }
  ], inspeccion.fluidos, { encabezado: false, guia: true });

  dibujarSubseccion(ctx, t('kit'), null, [
    { ...filaSimple, valor: f => capitalizar(f.kitItemNombre) },
    { x: 0.7, w: 0.3, alinear: 'der', valor: f => (f.presente ? t('si') : t('no')), color: f => (f.presente ? COLOR.texto : COLOR.rojo) }
  ], inspeccion.kit, { encabezado: false, guia: true });

  const defectos = inspeccion.defectos;
  const resumen = defectos.length > 0
    ? [{ texto: t('siMayusculas'), color: COLOR.rojo }, { texto: ` (${defectos.length})` }]
    : [{ texto: t('noMayusculas') }];
  dibujarSubseccion(ctx, t('defectos'), resumen, [
    // La posición en la lista completa mantiene la numeración al seguir en otra hoja.
    { etiqueta: t('colNumero'), x: 0, w: 0.06, valor: f => String(defectos.indexOf(f) + 1) },
    { etiqueta: t('colTipo'), x: 0.06, w: 0.2, valor: f => f.tipoDefectoNombre },
    { etiqueta: t('colDescripcion'), x: 0.26, w: 0.3, valor: f => f.descripcion || '' },
    { etiqueta: t('colImagen'), x: 0.56, w: 0.44, alinear: 'der', valor: f => f.correlativoImagen }
  ], defectos, { vacio: false });
}

function alturaDeSalvedades(ctx, salvedades) {
  const lineas = salvedades.map(s => partirEnLineas(s.textoPdf, m => ancho(ctx, m, 9), ANCHO_CONTENIDO - 12, 3));
  return { lineas, alto: 22 + lineas.reduce((s, l) => s + l.length * 13, 0) + 6 + 22 };
}

const ALTO_CAJA_TOTAL = 30;
// Alto reservado bajo el cierre para que nunca invada la zona fija de las firmas.
const ALTO_FIRMAS = LIMITE_CIERRE - PAGINA.LIMITE_INFERIOR;

// Total + salvedades + firmas van siempre juntos: si no caben en la hoja actual, pasan juntos a la siguiente.
function dibujarCierre(ctx, detalle, total) {
  const salvedades = alturaDeSalvedades(ctx, detalle.salvedades);
  const altoTotal = total ? ALTO_CAJA_TOTAL + SEPARACION_SECCIONES : 4;
  asegurarEspacio(ctx, altoTotal + (detalle.salvedades.length ? salvedades.alto : 0) + ALTO_FIRMAS);

  if (!total) ctx.y -= 4;
  if (total) {
    const y = ctx.y - ALTO_CAJA_TOTAL;
    ctx.page.drawRectangle({ x: PAGINA.MARGEN, y, width: ANCHO_CONTENIDO, height: ALTO_CAJA_TOTAL, borderColor: COLOR.texto, borderWidth: 1 });
    texto(ctx, t('totalSolicitado'), PAGINA.MARGEN + 14, y + 11, { size: 10.5, bold: true });
    textoDerecha(ctx, formatearDinero(total.simbolo, total.total), PAGINA.MARGEN + ANCHO_CONTENIDO - 14, y + 11, { size: 13, bold: true });
    ctx.y = y - SEPARACION_SECCIONES;
  }

  if (detalle.salvedades.length) {
    texto(ctx, t('salvedades'), PAGINA.MARGEN, ctx.y - 10, { size: 10.5, bold: true });
    ctx.y -= 22;
    salvedades.lineas.forEach(lineas => lineas.forEach((l, i) => {
      if (i === 0) texto(ctx, '•', PAGINA.MARGEN, ctx.y - 9, { size: 9 });
      texto(ctx, l, PAGINA.MARGEN + 10, ctx.y - 9, { size: 9 });
      ctx.y -= 13;
    }));
    ctx.y -= 6;
    texto(ctx, t('tomarEnCuenta'), PAGINA.MARGEN, ctx.y - 9, { size: 9, bold: true });
    const anchoTexto = ancho(ctx, t('tomarEnCuenta'), 9, true);
    [ctx.y - 12, ctx.y - 14.5].forEach(yy => ctx.page.drawLine({
      start: { x: PAGINA.MARGEN, y: yy }, end: { x: PAGINA.MARGEN + anchoTexto, y: yy }, thickness: 0.7, color: COLOR.texto
    }));
    ctx.y -= 22;
  }

  const yFirma = Y_FIRMAS;
  const anchoCaja = 240;
  const xAdministracion = PAGINA.MARGEN + ANCHO_CONTENIDO - anchoCaja;
  // El nombre va sobre la línea; el de administración aparece cuando la solicitud ya fue autorizada.
  const autorizacion = [...(detalle.historial || [])].reverse().find(h => h.estado === ESTADOS.AUTORIZADA);
  [[PAGINA.MARGEN, t('firmaSolicitante'), detalle.solicitante.nombre], [xAdministracion, t('firmaAdministracion'), autorizacion && autorizacion.usuarioNombre]].forEach(([x, etiqueta, nombre]) => {
    ctx.page.drawLine({ start: { x, y: yFirma }, end: { x: x + anchoCaja, y: yFirma }, thickness: 1, color: COLOR.texto });
    texto(ctx, etiqueta, x, yFirma - 9, { size: 6.5, bold: true, color: COLOR.etiqueta });
    if (nombre) texto(ctx, recortar(ctx, nombre, 9, anchoCaja), x, yFirma + 4, { size: 9 });
  });
  ctx.y = yFirma - 24;
}

// Hoja(s) de imágenes: 3 por fila a todo el ancho, con su correlativo debajo.
async function dibujarImagenes(ctx, detalle, imagenes) {
  nuevaPagina(ctx);
  texto(ctx, t('imagenes'), PAGINA.MARGEN, ctx.y - 10, { size: 10.5, bold: true });
  ctx.y -= 26;
  const lado = (ANCHO_CONTENIDO - SEPARACION_IMAGENES * (COLUMNAS_IMAGENES - 1)) / COLUMNAS_IMAGENES;
  const defectos = detalle.inspeccion.defectos;
  for (let i = 0; i < defectos.length; i += COLUMNAS_IMAGENES) {
    asegurarEspacio(ctx, lado + 24);
    for (const [j, defecto] of defectos.slice(i, i + COLUMNAS_IMAGENES).entries()) {
      const x = PAGINA.MARGEN + j * (lado + SEPARACION_IMAGENES);
      const yCaja = ctx.y - lado;
      const origen = imagenes.find(im => im.defectoId === defecto.id);
      ctx.page.drawRectangle({ x, y: yCaja, width: lado, height: lado, borderColor: COLOR.marco, borderWidth: 1 });
      const incrustada = origen ? await incrustarImagen(ctx, origen) : null;
      if (incrustada) {
        const dims = incrustada.scaleToFit(lado, lado);
        ctx.page.drawImage(incrustada, { x: x + (lado - dims.width) / 2, y: yCaja + (lado - dims.height) / 2, width: dims.width, height: dims.height });
      } else {
        const aviso = t('imagenNoDisponible');
        texto(ctx, aviso, x + (lado - ancho(ctx, aviso, 8)) / 2, yCaja + lado / 2, { size: 8, color: COLOR.etiqueta });
      }
      const pie = defecto.correlativoImagen;
      texto(ctx, pie, x + (lado - ancho(ctx, pie, 7.5)) / 2, yCaja - 11, { size: 7.5 });
    }
    ctx.y -= lado + 24;
  }
}

async function incrustarImagen(ctx, { buffer, mimeType }) {
  try {
    if (mimeType === MIME_IMAGEN_PDF.PNG) return await ctx.pdfDoc.embedPng(buffer);
    if (mimeType === MIME_IMAGEN_PDF.JPEG) return await ctx.pdfDoc.embedJpg(buffer);
  } catch (error) {
    console.error('[Viáticos] No se pudo incrustar una imagen en el PDF:', error.message);
  }
  return null;
}

// «n/total» en todas las hojas.
function dibujarPies(pdfDoc, font) {
  const total = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((page, idx) => {
    page.drawRectangle({ x: 0, y: 0, width: PAGINA.ANCHO, height: PAGINA.ALTO_PIE, color: rgb(1, 1, 1) });
    const numero = `${idx + 1}/${total}`;
    page.drawText(numero, { x: PAGINA.ANCHO - PAGINA.MARGEN - font.widthOfTextAtSize(numero, 8), y: 10, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  });
}

/**
 * @param {object} detalle detalle de la solicitud (solicitudService.obtener) más puesto y licencia del solicitante,
 *   póliza y combustible del vehículo, y `correlativoImagen` en cada defecto.
 * @param {{ imagenes?: Array<{defectoId:number, buffer:Buffer, mimeType:string}>, fechaGeneracion?: string }} [opciones]
 * @returns {Promise<Buffer>}
 */
async function generarPdfSolicitud(detalle, { imagenes = [], fechaGeneracion } = {}) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let logo = null;
  try {
    logo = await pdfDoc.embedPng(await fs.readFile(RUTA_LOGO));
  } catch {
    logo = null; // El logo es decorativo: sin él el PDF se genera igual.
  }
  const [anio, mes, dia] = (fechaGeneracion || ahoraUTC6().toISOString()).slice(0, 10).split('-');
  const ctx = {
    pdfDoc, font, fontBold, logo, page: null, y: 0, caracteres: new Set(font.getCharacterSet()),
    correlativo: detalle.correlativo, fechaTexto: `${dia}/${mes}/${anio}`, tamanoTitulo: calcularTamanoTitulo(fontBold)
  };
  nuevaPagina(ctx);
  seccionesDeViaje(ctx, detalle);

  const esLargo = detalle.modalidad === MODALIDADES.MAS_DE_UN_DIA;
  let total = null;
  // El divisor va en ambas modalidades y viaja con la primera sección que le sigue (ruta u odómetro).
  dibujarDivisorDesglose(ctx, esLargo ? 18 + 13 + ALTO_FILA + ALTO_TOTAL_FILA + 6 : 30);
  if (esLargo) total = seccionesDeCostos(ctx, detalle);
  else seccionesDeInspeccion(ctx, detalle);
  dibujarCierre(ctx, detalle, total);
  if (!esLargo && detalle.inspeccion.defectos.length > 0) await dibujarImagenes(ctx, detalle, imagenes);

  dibujarPies(pdfDoc, font);
  return Buffer.from(await pdfDoc.save());
}

module.exports = { generarPdfSolicitud, validarTextos, erroresDeTextos, calcularTamanoTitulo };
