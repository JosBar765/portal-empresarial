// src/modules/proyectos/services/informePdfService.js
// PDF del informe de un proyecto. No calcula nada: dibuja lo que entrega `informeService.obtener` (la misma fuente que la pantalla).
// Qué secciones lleva, cuántas filas por tabla y la línea bajo el título los decide el administrador (`informe.*`).
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const informeService = require('./informeService');
const configService = require('./configService');

const ANCHO = 612; // Carta vertical
const ALTO = 792;
const MARGEN = 40;
const CONTENIDO = ANCHO - MARGEN * 2;
const LIMITE_INFERIOR = MARGEN + 20;
const LOGO = path.join(__dirname, '../../../../public/assets/logos/LOGO_GP_isotipo.png');
const NEGRO = rgb(0.06, 0.09, 0.16);
const GRIS = rgb(0.45, 0.48, 0.52);
const LINEA = rgb(0.86, 0.88, 0.9);
const FONDO = rgb(0.95, 0.96, 0.97);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SIMBOLOS = { GTQ: 'Q', USD: 'US$', HNL: 'L', NIO: 'C$', CRC: 'CRC' };

// Las fuentes estándar del PDF solo cubren Latin-1: lo demás se sustituye en vez de romper la generación.
const limpiar = (texto) => String(texto ?? '').replace(/[–—]/g, '-').replace(/→/g, 'a').replace(/[^ -ÿ]/g, '?');
const dinero = (monto, moneda) => `${SIMBOLOS[moneda] || moneda} ${Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const montos = (lista) => (lista.length ? lista.map(m => dinero(m.monto, m.moneda)).join('  ·  ') : '-');
const fechaLarga = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : '-'; };
const ETIQUETA_SEMAFORO = { verde: 'Verde', ambar: 'Ambar', rojo: 'Rojo' };

class InformePdfService {
  async generar(usuario, proyectoId) {
    const datos = await informeService.obtener(usuario, proyectoId);
    const [filasMax, secciones, encabezado] = await Promise.all([configService.obtener('informe.filas_por_tabla'), configService.obtener('informe.secciones'), configService.obtener('informe.texto_encabezado')]);
    const doc = await PDFDocument.create();
    const normal = await doc.embedFont(StandardFonts.Helvetica);
    const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
    let logo = null;
    try { logo = await doc.embedPng(await fs.readFile(LOGO)); } catch { /* sin logo: el informe sale igual */ }
    let pagina = null;
    let y = 0;

    const nuevaPagina = () => { pagina = doc.addPage([ANCHO, ALTO]); y = ALTO - MARGEN; };
    const asegurar = (alto) => { if (y - alto < LIMITE_INFERIOR) nuevaPagina(); };
    const texto = (t, x, tamano, fuente = normal, color = NEGRO) => pagina.drawText(limpiar(t), { x, y, size: tamano, font: fuente, color });
    const anchoDe = (t, tamano, fuente = normal) => fuente.widthOfTextAtSize(limpiar(t), tamano);
    const ajustar = (t, maximo, tamano, fuente = normal) => {
      let s = limpiar(t);
      if (anchoDe(s, tamano, fuente) <= maximo) return s;
      while (s.length > 1 && anchoDe(`${s}...`, tamano, fuente) > maximo) s = s.slice(0, -1);
      return `${s}...`;
    };
    // Párrafo con saltos de línea por ancho.
    const parrafo = (t, tamano = 10, color = NEGRO) => {
      for (const bloque of limpiar(t).split(/\r?\n/)) {
        let linea = '';
        for (const palabra of bloque.split(/\s+/)) {
          const prueba = linea ? `${linea} ${palabra}` : palabra;
          if (anchoDe(prueba, tamano) > CONTENIDO && linea) { asegurar(tamano + 4); texto(linea, MARGEN, tamano, normal, color); y -= tamano + 4; linea = palabra; } else linea = prueba;
        }
        asegurar(tamano + 4); texto(linea, MARGEN, tamano, normal, color); y -= tamano + 4;
      }
    };
    const titulo = (t) => { asegurar(34); y -= 8; texto(t.toUpperCase(), MARGEN, 10, negrita, GRIS); y -= 6; pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.7, color: LINEA }); y -= 14; };

    // `columnas`: [{ titulo, ancho (fracción), alinear: 'der' }]; recorta a `filasMax` y dice «y N más».
    const tabla = (columnas, filas) => {
      const visibles = filas.slice(0, filasMax);
      const total = columnas.reduce((a, c) => a + c.ancho, 0);
      const xs = []; let x = MARGEN;
      for (const c of columnas) { xs.push(x); x += (c.ancho / total) * CONTENIDO; }
      const anchoCol = (i) => (columnas[i].ancho / total) * CONTENIDO - 6;
      const celda = (t, i, fuente, color) => {
        const s = ajustar(t, anchoCol(i), 8.5, fuente);
        const px = columnas[i].alinear === 'der' ? xs[i] + anchoCol(i) - anchoDe(s, 8.5, fuente) : xs[i];
        pagina.drawText(s, { x: px, y, size: 8.5, font: fuente, color });
      };
      asegurar(30);
      pagina.drawRectangle({ x: MARGEN, y: y - 5, width: CONTENIDO, height: 17, color: FONDO });
      columnas.forEach((c, i) => celda(c.titulo, i, negrita, GRIS));
      y -= 18;
      for (const fila of visibles) {
        asegurar(16);
        fila.forEach((valor, i) => celda(valor, i, normal, NEGRO));
        y -= 14;
        pagina.drawLine({ start: { x: MARGEN, y: y + 9 }, end: { x: ANCHO - MARGEN, y: y + 9 }, thickness: 0.4, color: LINEA });
      }
      if (filas.length > visibles.length) { asegurar(14); texto(`y ${filas.length - visibles.length} mas`, MARGEN, 8.5, normal, GRIS); y -= 14; }
      y -= 4;
    };

    // --- Encabezado ---
    nuevaPagina();
    if (logo) pagina.drawImage(logo, { x: ANCHO - MARGEN - 34, y: ALTO - MARGEN - 26, width: 34, height: 34 });
    texto(`Informe: ${datos.proyecto.nombre}`, MARGEN, 18, negrita); y -= 18;
    texto(`${datos.proyecto.codigo} · ${datos.proyecto.paises || ''} · ${datos.proyecto.tiendas} tiendas`, MARGEN, 9.5, normal, GRIS); y -= 13;
    texto(datos.congelado ? `Informe congelado al cerrar el ${fechaLarga(datos.cierre && datos.cierre.en)}` : 'Informe al momento (el proyecto sigue activo)', MARGEN, 9.5, normal, GRIS); y -= 13;
    if (encabezado) { texto(encabezado, MARGEN, 9.5, normal, GRIS); y -= 13; }
    y -= 8;

    const { informe } = datos;
    const c = informe.cifras;
    if (secciones.includes('embudo')) {
      titulo('Resultados');
      tabla([{ titulo: 'Asignadas', ancho: 1 }, { titulo: 'Gestionadas', ancho: 1 }, { titulo: 'Contactadas', ancho: 1 }, { titulo: 'Interesadas', ancho: 1 }, { titulo: 'Cotizadas', ancho: 1 }, { titulo: 'Vendidas', ancho: 1 }],
        [[String(c.asignadas), `${c.gestionadas} (${c.porcentajes.gestionadas}%)`, `${c.contactadas} (${c.porcentajes.contactadas}%)`, `${c.interesadas} (${c.porcentajes.interesadas}%)`, `${c.cotizadas} (${c.porcentajes.cotizadas}%)`, `${c.vendidas} (${c.porcentajes.vendidas}%)`]]);
      texto(`Efectividad: ${informe.efectividad.porcentaje}% (${ETIQUETA_SEMAFORO[informe.efectividad.semaforo]})   ·   Perdidas: ${c.perdidas}   ·   Descartadas: ${c.descartadas}   ·   Sin gestionar: ${c.sinGestionar}`, MARGEN, 9, normal, GRIS); y -= 14;
      if (informe.perdidasPorMotivo.length) tabla([{ titulo: 'Motivo de perdida', ancho: 4 }, { titulo: 'Empresas', ancho: 1, alinear: 'der' }], informe.perdidasPorMotivo.map(p => [p.motivo, String(p.n)]));
    }
    if (secciones.includes('montos')) {
      titulo('Montos por moneda (no se mezclan)');
      tabla([{ titulo: '', ancho: 1 }, { titulo: 'Total', ancho: 4 }], [['Cotizado', montos(informe.montos.cotizado)], ['Vendido', montos(informe.montos.vendido)]]);
    }
    if (secciones.includes('canal')) {
      titulo('Presencial frente a remoto');
      parrafo(`Presencial (visita): ${informe.canales.presencial} gestiones (${informe.canales.porcentajePresencial}%)   ·   Remoto (llamada, WhatsApp, correo): ${informe.canales.remoto} gestiones (${informe.canales.porcentajeRemoto}%)`, 9.5);
    }
    if (secciones.includes('muestras')) {
      titulo('Muestras entregadas por area');
      if (informe.muestras.porArea.length) tabla([{ titulo: 'Area de contacto', ancho: 4 }, { titulo: 'Muestras', ancho: 1, alinear: 'der' }], informe.muestras.porArea.map(m => [m.area, String(m.cantidad)]));
      parrafo(informe.muestras.total !== null ? `${informe.muestras.articulo || 'Articulo'}: quedan ${informe.muestras.existencia} de ${informe.muestras.total}.` : 'Sin control de existencias.', 9.5, GRIS);
    }
    if (secciones.includes('por_asesor')) {
      titulo('Por asesor');
      tabla([{ titulo: 'Asesor', ancho: 3 }, { titulo: 'Tienda', ancho: 2 }, { titulo: 'Asig.', ancho: 1, alinear: 'der' }, { titulo: 'Gest.', ancho: 1, alinear: 'der' }, { titulo: 'Inter.', ancho: 1, alinear: 'der' }, { titulo: 'Cotiz.', ancho: 1, alinear: 'der' }, { titulo: 'Vend.', ancho: 1, alinear: 'der' }, { titulo: 'Reacc.', ancho: 1, alinear: 'der' }],
        informe.porAsesor.map(a => [a.nombre, a.tienda, String(a.asignadas), String(a.gestionadas), String(a.interesadas), String(a.cotizadas), String(a.vendidas), `${a.reaccionDias} d`]));
    }
    if (secciones.includes('por_tienda')) {
      titulo('Por tienda');
      tabla([{ titulo: 'Tienda', ancho: 3 }, { titulo: 'Asesores', ancho: 1, alinear: 'der' }, { titulo: 'Asig.', ancho: 1, alinear: 'der' }, { titulo: 'Gest.', ancho: 1, alinear: 'der' }, { titulo: 'Vend.', ancho: 1, alinear: 'der' }, { titulo: 'Cotizado', ancho: 3, alinear: 'der' }, { titulo: 'Vendido', ancho: 3, alinear: 'der' }],
        informe.porTienda.map(t => [t.empresa, String(t.asesores), String(t.asignadas), String(t.gestionadas), String(t.vendidas), montos(t.cotizado), montos(t.vendido)]));
    }

    titulo('Conclusiones del supervisor');
    parrafo(datos.conclusiones || 'Sin conclusiones todavia.', 10);
    if (datos.vistoBueno) {
      titulo('Visto bueno del gerente');
      const vb = datos.vistoBueno;
      parrafo(vb.estado === 'dado' ? `Dado por ${vb.por} el ${fechaLarga(vb.en)}.${vb.comentario ? ` "${vb.comentario}"` : ''}` : vb.estado === 'devuelto' ? `Devuelto por ${vb.por} el ${fechaLarga(vb.en)}: "${vb.comentario || ''}"` : 'Pendiente de visto bueno.', 10);
    }

    // Pie con número de página.
    const paginas = doc.getPages();
    paginas.forEach((p, i) => { p.drawText(`${datos.proyecto.codigo}  ·  Pagina ${i + 1} de ${paginas.length}`, { x: MARGEN, y: MARGEN - 8, size: 8, font: normal, color: GRIS }); });
    return { bytes: await doc.save(), nombre: `informe-${datos.proyecto.codigo}.pdf` };
  }
}

module.exports = new InformePdfService();
