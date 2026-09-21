// Primitivas de gráficas para la vista Rendimiento: formateo numérico, escala,
// sparkline, tooltip compartido y gráfica de líneas en SVG. Sin dependencias:
// todo el color sale de tokens CSS (global.css / rendimiento.css), nunca de
// valores sueltos, y el texto nunca lleva el color de la serie.
export const fmtNum = (n, dec = 0) => (n == null ? '—' : Number(n).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: dec }));
export const fmtPct = (n) => (n == null ? '—' : `${fmtNum(n, 1)}%`);
export const fmtDias = (n) => (n == null ? '—' : `${fmtNum(n, 1)} d`);

// Techo redondo y 4-5 marcas limpias (0 / 5 / 10 / 15), en enteros cuando la
// serie cuenta cosas (vales) — nunca marcas de 0.5 vales.
export function escalaLineal(maximo, marcas = 4, entero = true) {
  if (!(maximo > 0)) return { techo: 1, ticks: [0, 1] };
  const bruto = maximo / marcas;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  let paso = [1, 2, 2.5, 5, 10].map(m => m * magnitud).find(p => p >= bruto);
  if (entero) paso = Math.max(1, Math.ceil(paso));
  const techo = Math.ceil(maximo / paso) * paso;
  const ticks = [];
  for (let t = 0; t <= techo + 1e-9; t += paso) ticks.push(Math.round(t * 1000) / 1000);
  return { techo, ticks };
}

// -----------------------------------------------------------------------
// Tooltip compartido — un solo nodo en <body>, contenido siempre vía
// textContent (nombres y etiquetas se tratan como datos no confiables).
// -----------------------------------------------------------------------
let tooltipEl = null;

function asegurarTooltip() {
  if (tooltipEl && tooltipEl.isConnected) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'chart-tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

export function mostrarTooltip({ titulo, filas }, x, y) {
  const el = asegurarTooltip();
  el.replaceChildren();
  if (titulo) {
    const t = document.createElement('div');
    t.className = 'chart-tooltip-titulo';
    t.textContent = titulo;
    el.appendChild(t);
  }
  filas.forEach(f => {
    const fila = document.createElement('div');
    fila.className = 'chart-tooltip-fila';
    if (f.color) {
      const llave = document.createElement('span');
      llave.className = 'chart-tooltip-llave';
      llave.style.background = f.color;
      fila.appendChild(llave);
    }
    const etiqueta = document.createElement('span');
    etiqueta.className = 'chart-tooltip-etiqueta';
    etiqueta.textContent = f.etiqueta;
    const valor = document.createElement('strong');
    valor.className = 'chart-tooltip-valor';
    valor.textContent = f.valor;
    fila.append(etiqueta, valor);
    el.appendChild(fila);
  });
  el.hidden = false;
  const margen = 12;
  const { width, height } = el.getBoundingClientRect();
  let left = x + margen;
  let top = y + margen;
  if (left + width > window.innerWidth - 8) left = x - width - margen;
  if (top + height > window.innerHeight - 8) top = y - height - margen;
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${Math.max(8, top)}px`;
}

export function ocultarTooltip() {
  if (tooltipEl) tooltipEl.hidden = true;
}

// Cualquier elemento HTML con `data-tip` (JSON) se vuelve una marca con
// tooltip: la propia marca es el blanco del hover y del foco de teclado.
export function conectarTooltips(raiz) {
  raiz.querySelectorAll('[data-tip]').forEach(el => {
    const datos = () => JSON.parse(el.dataset.tip);
    el.addEventListener('pointermove', (e) => mostrarTooltip(datos(), e.clientX, e.clientY));
    el.addEventListener('pointerleave', ocultarTooltip);
    el.addEventListener('focus', () => {
      const r = el.getBoundingClientRect();
      mostrarTooltip(datos(), r.left + r.width / 2, r.top);
    });
    el.addEventListener('blur', ocultarTooltip);
  });
}

// -----------------------------------------------------------------------
// Sparkline: línea gris recesiva con el punto más reciente en el acento.
// -----------------------------------------------------------------------
export function sparkline(valores, { ancho = 96, alto = 28 } = {}) {
  const puntos = valores.map((v, i) => ({ v, i })).filter(p => p.v != null);
  if (puntos.length < 2) return '';
  const min = Math.min(...puntos.map(p => p.v));
  const max = Math.max(...puntos.map(p => p.v));
  const rango = max - min || 1;
  const pad = 4;
  const n = valores.length - 1 || 1;
  const x = (i) => pad + (i / n) * (ancho - pad * 2);
  const y = (v) => (max === min ? alto / 2 : alto - pad - ((v - min) / rango) * (alto - pad * 2));
  const trazo = puntos.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const ultimo = puntos[puntos.length - 1];
  return `<svg class="spark" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" aria-hidden="true" focusable="false">
    <path d="${trazo}" fill="none" stroke="var(--rend-spark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x(ultimo.i).toFixed(1)}" cy="${y(ultimo.v).toFixed(1)}" r="4" fill="var(--color-primary)" stroke="var(--color-surface)" stroke-width="2"/>
  </svg>`;
}

// -----------------------------------------------------------------------
// Gráfica de líneas (varias series, UNA sola escala). Crosshair que se
// ajusta al X más cercano + tooltip con todas las series; navegable con
// flechas. Se redibuja al cambiar el ancho del contenedor.
// -----------------------------------------------------------------------
export function graficaLineas(contenedor, { fechasTitulo, etiquetasX, series, alto = 240, entero = true, ariaLabel, ultimoParcial = false }) {
  const n = etiquetasX.length;
  let indiceActivo = null;
  let geometria = null;

  function segmentos(valores, x, y) {
    const partes = [];
    let actual = [];
    valores.forEach((v, i) => {
      if (v == null) { if (actual.length) partes.push(actual); actual = []; return; }
      actual.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    });
    if (actual.length) partes.push(actual);
    return partes.map(p => `M${p.join(' L')}`).join(' ');
  }

  function dibujar() {
    const ancho = Math.max(280, Math.floor(contenedor.clientWidth));
    const m = { t: 12, r: 40, b: 28, l: 34 };
    const w = ancho - m.l - m.r;
    const h = alto - m.t - m.b;
    const maximo = Math.max(1, ...series.flatMap(s => s.valores.filter(v => v != null)));
    const { techo, ticks } = escalaLineal(maximo, 4, entero);
    const x = (i) => m.l + (n === 1 ? w / 2 : (i / (n - 1)) * w);
    const y = (v) => m.t + h - (v / techo) * h;
    const paso = Math.ceil(n / 7);

    const rejilla = ticks.map(t => `
      <line x1="${m.l}" x2="${m.l + w}" y1="${y(t)}" y2="${y(t)}" class="chart-grid"/>
      <text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" class="chart-tick">${fmtNum(t)}</text>`).join('');
    // Las marcas se anclan al final para que el último período (hoy) siempre
    // tenga su etiqueta.
    const ejeX = etiquetasX.map((et, i) => ((n - 1 - i) % paso === 0
      ? `<text x="${x(i)}" y="${alto - 8}" text-anchor="middle" class="chart-tick">${et}</text>` : '')).join('');

    const ultimos = series.map(s => {
      let i = s.valores.length - 1;
      while (i >= 0 && s.valores[i] == null) i--;
      return i >= 0 ? { s, i, v: s.valores[i] } : null;
    }).filter(Boolean);
    // Las etiquetas finales solo van si no se pisan; si convergen, la leyenda
    // y el tooltip cargan la identidad (nada de apilarlas a la fuerza).
    const separadas = ultimos.every((a, ia) => ultimos.every((b, ib) => ia === ib || Math.abs(y(a.v) - y(b.v)) >= 16));

    // El último tramo va punteado cuando ese período aún no termina.
    const trazo = (d, punteado) => `<path d="${d}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${punteado ? ' stroke-dasharray="3 5"' : ''}`;
    const lineas = series.map(s => {
      if (!(ultimoParcial && n >= 2)) return `${trazo(segmentos(s.valores, x, y))} stroke="${s.color}"/>`;
      const previo = s.valores[n - 2];
      const ultimo = s.valores[n - 1];
      const firme = segmentos(s.valores.map((v, i) => (i === n - 1 ? null : v)), x, y);
      const tramo = previo != null && ultimo != null ? `M${x(n - 2).toFixed(1)},${y(previo).toFixed(1)} L${x(n - 1).toFixed(1)},${y(ultimo).toFixed(1)}` : '';
      return `${trazo(firme)} stroke="${s.color}"/>${tramo ? `${trazo(tramo, true)} stroke="${s.color}"/>` : ''}`;
    }).join('');
    const finales = ultimos.map(u => `
      <circle cx="${x(u.i)}" cy="${y(u.v)}" r="4" fill="${u.s.color}" stroke="var(--color-surface)" stroke-width="2"/>
      ${separadas ? `<text x="${x(u.i) + 10}" y="${y(u.v) + 4}" class="chart-endlabel">${fmtNum(u.v)}</text>` : ''}`).join('');
    const puntosHover = series.map((s, k) => `<circle class="chart-hover-dot" data-serie="${k}" r="4" fill="${s.color}" stroke="var(--color-surface)" stroke-width="2" visibility="hidden"/>`).join('');

    contenedor.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="${ariaLabel}">
        ${rejilla}${ejeX}${lineas}${finales}
        <line class="chart-crosshair" y1="${m.t}" y2="${m.t + h}" visibility="hidden"/>
        ${puntosHover}
        <rect class="chart-overlay" x="${m.l}" y="${m.t}" width="${w}" height="${h}" fill="transparent"/>
      </svg>`;
    geometria = { x, y, m, w, h, n };

    const svg = contenedor.querySelector('svg');
    const overlay = svg.querySelector('.chart-overlay');
    overlay.addEventListener('pointermove', (e) => {
      const caja = svg.getBoundingClientRect();
      const px = e.clientX - caja.left - m.l;
      mostrarEn(Math.max(0, Math.min(n - 1, Math.round((px / w) * (n - 1)))));
    });
    overlay.addEventListener('pointerleave', ocultar);
    if (indiceActivo != null) mostrarEn(indiceActivo);
  }

  function mostrarEn(i) {
    if (!geometria) return;
    indiceActivo = i;
    const svg = contenedor.querySelector('svg');
    const cross = svg.querySelector('.chart-crosshair');
    cross.setAttribute('x1', geometria.x(i));
    cross.setAttribute('x2', geometria.x(i));
    cross.setAttribute('visibility', 'visible');
    let yRef = null;
    svg.querySelectorAll('.chart-hover-dot').forEach(dot => {
      const v = series[Number(dot.dataset.serie)].valores[i];
      if (v == null) { dot.setAttribute('visibility', 'hidden'); return; }
      dot.setAttribute('cx', geometria.x(i));
      dot.setAttribute('cy', geometria.y(v));
      dot.setAttribute('visibility', 'visible');
      if (yRef == null) yRef = geometria.y(v);
    });
    const caja = svg.getBoundingClientRect();
    mostrarTooltip({
      titulo: fechasTitulo[i],
      filas: series.map(s => ({ color: s.color, etiqueta: s.etiqueta, valor: s.formato(s.valores[i]) }))
    }, caja.left + geometria.x(i), caja.top + (yRef ?? geometria.m.t));
  }

  function ocultar() {
    indiceActivo = null;
    ocultarTooltip();
    const svg = contenedor.querySelector('svg');
    if (!svg) return;
    svg.querySelector('.chart-crosshair').setAttribute('visibility', 'hidden');
    svg.querySelectorAll('.chart-hover-dot').forEach(d => d.setAttribute('visibility', 'hidden'));
  }

  contenedor.tabIndex = 0;
  contenedor.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const siguiente = (indiceActivo ?? (e.key === 'ArrowRight' ? -1 : n)) + (e.key === 'ArrowRight' ? 1 : -1);
    mostrarEn(Math.max(0, Math.min(n - 1, siguiente)));
  });
  contenedor.addEventListener('blur', ocultar);

  dibujar();
  let anchoPrevio = contenedor.clientWidth;
  const observador = new ResizeObserver(() => {
    if (Math.abs(contenedor.clientWidth - anchoPrevio) < 2) return;
    anchoPrevio = contenedor.clientWidth;
    dibujar();
  });
  observador.observe(contenedor);
  return { destruir: () => { observador.disconnect(); ocultarTooltip(); } };
}
