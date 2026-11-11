// Genera los manuales de usuario en Word a partir de los .md de esta carpeta (uno por rol).
// Uso:  npm i --no-save docx   y luego   node .agents/modulos/proyectos/manuales/generar_word.js
// Formato de los .md: «# Capítulo» (página nueva), «## Sección», «### Subsección», listas con «-» y «1.», tablas con «|»,
// imágenes con «![Pie de foto](capturas/archivo.jpg)» y avisos con «> **Tip:** …», «> **Importante:** …», «> **Ojo:** …» o «> **Nota:** …».
const fs = require('fs');
const path = require('path');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat, AlignmentType, PageBreak, ImageRun, Footer, PageNumber } = D;

const carpeta = __dirname;
const ANCHO = 9360; // carta, márgenes de 1"
const COLOR = '7A3F5C';
const AVISOS = {
  Tip: { fondo: 'E8F5EE', borde: '2E9E6B', icono: '💡' },
  Nota: { fondo: 'E9F0FE', borde: '2563EB', icono: 'ℹ️' },
  Importante: { fondo: 'FFF4D6', borde: 'D99A00', icono: '⚠️' },
  Ojo: { fondo: 'FDECEC', borde: 'DC2626', icono: '🛑' }
};

function jpegTamano(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) { i += 1; continue; }
    const m = buf[i + 1];
    if (m === 0xC0 || m === 0xC2) return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { ancho: 1568, alto: 730 };
}

function runs(texto, opt = {}) {
  const res = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let ultimo = 0;
  let m;
  const poner = (s, o) => { if (s) res.push(new TextRun({ text: s, font: 'Arial', size: opt.size || 22, color: opt.color, ...o })); };
  while ((m = re.exec(texto))) {
    poner(texto.slice(ultimo, m.index), {});
    const x = m[0];
    if (x.startsWith('**')) poner(x.slice(2, -2), { bold: true });
    else if (x.startsWith('`')) poner(x.slice(1, -1), { font: 'Consolas', size: (opt.size || 22) - 2, shading: { type: ShadingType.CLEAR, fill: 'EEF0F4' } });
    else poner(x.slice(1, -1), { italics: true });
    ultimo = m.index + x.length;
  }
  poner(texto.slice(ultimo), {});
  return res;
}
const limpio = (t) => t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const celdas = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));

function tabla(filas) {
  const n = filas[0].length;
  const w = Math.floor(ANCHO / n);
  const cw = Array(n).fill(w);
  cw[n - 1] += ANCHO - w * n;
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'C9CED8' };
  const bordes = { top: b, bottom: b, left: b, right: b };
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA }, columnWidths: cw,
    rows: filas.map((f, i) => new TableRow({
      tableHeader: i === 0,
      children: cw.map((c, j) => new TableCell({
        width: { size: c, type: WidthType.DXA }, borders: bordes, margins: { top: 70, bottom: 70, left: 110, right: 110 },
        shading: i === 0 ? { type: ShadingType.CLEAR, fill: 'F1E6EC' } : undefined,
        children: [new Paragraph({ children: runs(limpio(f[j] || ''), { size: 20, run: i === 0 ? { bold: true } : {} }) })]
      }))
    }))
  });
}

function aviso(tipo, texto) {
  const a = AVISOS[tipo] || AVISOS.Nota;
  const lado = { style: BorderStyle.SINGLE, size: 4, color: a.fondo };
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [ANCHO],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: ANCHO, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: a.fondo }, margins: { top: 100, bottom: 100, left: 160, right: 160 },
      borders: { top: lado, bottom: lado, right: lado, left: { style: BorderStyle.SINGLE, size: 24, color: a.borde } },
      children: [new Paragraph({ children: [new TextRun({ text: `${a.icono} `, font: 'Arial', size: 22 }), new TextRun({ text: `${tipo}: `, font: 'Arial', bold: true, size: 22 }), ...runs(limpio(texto))] })]
    })] })]
  });
}

function convertir(archivo) {
  const L = fs.readFileSync(path.join(carpeta, archivo), 'utf8').replace(/\r/g, '').split('\n');
  const hijos = [];
  let i = 0;
  let portada = null;
  let primerH1 = true;
  let m;
  while (i < L.length) {
    const l = L[i];
    if ((m = l.match(/^#\s+(.*)/)) && i === 0) { portada = m[1]; i += 1; continue; }
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) {
      const nivel = m[1].length;
      const texto = m[2].replace(/[`*]/g, '');
      if (nivel === 1) {
        if (!primerH1) hijos.push(new Paragraph({ children: [new PageBreak()] }));
        primerH1 = false;
        hijos.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: texto, font: 'Arial', bold: true, size: 36, color: COLOR })] }));
      } else {
        hijos.push(new Paragraph({ heading: nivel === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: [new TextRun({ text: texto, font: 'Arial', bold: true, size: nivel === 2 ? 28 : 24 })] }));
      }
      i += 1; continue;
    }
    if ((m = l.match(/^!\[([^\]]*)\]\(([^)]+)\)/))) {
      const ruta = path.join(carpeta, m[2]);
      if (fs.existsSync(ruta)) {
        const datos = fs.readFileSync(ruta);
        const { ancho, alto } = jpegTamano(datos);
        const w = 600;
        hijos.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, keepNext: true, children: [new ImageRun({ type: 'jpg', data: datos, transformation: { width: w, height: Math.round((w * alto) / ancho) } })] }));
        hijos.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: m[1], font: 'Arial', italics: true, size: 18, color: '64748B' })] }));
      } else { console.warn('Falta la imagen', m[2]); }
      i += 1; continue;
    }
    if (/^\|/.test(l) && i + 1 < L.length && /^\|?[\s:|-]+\|?$/.test(L[i + 1]) && L[i + 1].includes('-')) {
      const filas = [celdas(l)];
      i += 2;
      while (i < L.length && /^\|/.test(L[i])) { filas.push(celdas(L[i])); i += 1; }
      hijos.push(tabla(filas));
      hijos.push(new Paragraph({ children: [] }));
      continue;
    }
    if ((m = l.match(/^>\s*\*\*(Tip|Nota|Importante|Ojo):\*\*\s*(.*)/))) {
      let texto = m[2];
      i += 1;
      while (i < L.length && /^>\s?/.test(L[i]) && !/^>\s*\*\*(Tip|Nota|Importante|Ojo):/.test(L[i])) { texto += ` ${L[i].replace(/^>\s?/, '')}`; i += 1; }
      hijos.push(aviso(m[1], texto));
      hijos.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      continue;
    }
    if ((m = l.match(/^(\s*)[-*]\s+(.*)/))) {
      hijos.push(new Paragraph({ numbering: { reference: 'vin', level: Math.min(Math.floor(m[1].length / 2), 2) }, spacing: { after: 60 }, children: runs(limpio(m[2])) }));
      i += 1; continue;
    }
    if ((m = l.match(/^\s*(\d+)\.\s+(.*)/))) {
      hijos.push(new Paragraph({ indent: { left: 460, hanging: 360 }, spacing: { after: 70 }, children: [new TextRun({ text: `${m[1]}.  `, font: 'Arial', bold: true, size: 22, color: COLOR }), ...runs(limpio(m[2]))] }));
      i += 1; continue;
    }
    if (l.trim() === '' || /^---+$/.test(l.trim())) { i += 1; continue; }
    hijos.push(new Paragraph({ spacing: { after: 110 }, children: runs(limpio(l)) }));
    i += 1;
  }

  const [rol, ...resto] = (portada || archivo).split('·');
  const portadaNodos = [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({ children: [new TextRun({ text: 'Portal Empresarial · MundiTrofeos S.A.', font: 'Arial', size: 24, color: '64748B' })] }),
    new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: 'Módulo Proyectos', font: 'Arial', bold: true, size: 64, color: COLOR })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: `Manual de usuario${rol ? ` · ${rol.trim()}` : ''}`, font: 'Arial', bold: true, size: 40 })] }),
    new Paragraph({ children: [new TextRun({ text: resto.join('·').trim() || 'Guía paso a paso para usar el módulo con confianza.', font: 'Arial', size: 26, color: '475569' })] }),
    new Paragraph({ spacing: { before: 1600 }, children: [new TextRun({ text: 'Versión del 11 de noviembre de 2026', font: 'Arial', size: 20, color: '64748B' })] }),
    new Paragraph({ children: [new PageBreak()] })
  ];

  const vin = (n, ind) => ({ level: n, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: ind, hanging: 260 } } } });
  const doc = new Document({
    creator: 'MundiTrofeos S.A.', title: portada || archivo,
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 36, bold: true, color: COLOR }, paragraph: { spacing: { before: 240, after: 200 }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 28, bold: true }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 24, bold: true }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, outlineLevel: 2 } }
      ]
    },
    numbering: { config: [{ reference: 'vin', levels: [vin(0, 540), vin(1, 900), vin(2, 1260)] }] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Módulo Proyectos · Manual${rol ? ` ${rol.trim().toLowerCase()}` : ''} · Página `, font: 'Arial', size: 18, color: '64748B' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '64748B' })] })] }) },
      children: [...portadaNodos, ...hijos]
    }]
  });
  return Packer.toBuffer(doc);
}

(async () => {
  for (const archivo of fs.readdirSync(carpeta).filter(f => /^manual_.*\.md$/.test(f)).sort()) {
    const buf = await convertir(archivo);
    const salida = path.join(carpeta, archivo.replace(/\.md$/, '.docx'));
    fs.writeFileSync(salida, buf);
    console.log('ok', path.basename(salida), Math.round(buf.length / 1024), 'KB');
  }
})();
