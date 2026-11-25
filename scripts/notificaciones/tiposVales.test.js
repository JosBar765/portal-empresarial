// Cada aviso de Vales lleva un `tipo`: sin él no se puede categorizar ni elegir como notificación del sistema.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const { categoriasDe, categoriaDeTipo, SOLO_CAMPANA } = require(path.join(SRC, 'core/notifications/categorias'));

const archivos = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const ruta = path.join(dir, e.name);
  return e.isDirectory() ? archivos(ruta) : (ruta.endsWith('.js') ? [ruta] : []);
});

// El texto de cada llamada a `valeEvents.notificar(...)`, equilibrando paréntesis.
function llamadas() {
  const fuentes = [...archivos(path.join(SRC, 'modules/vales')), path.join(SRC, 'modules/admin/services/supervisionAsesorService.js')];
  return fuentes.flatMap(archivo => {
    const codigo = fs.readFileSync(archivo, 'utf8');
    const halladas = [];
    for (const m of codigo.matchAll(/valeEvents\.notificar\(/g)) {
      let nivel = 1;
      let i = m.index + m[0].length;
      for (; i < codigo.length && nivel; i++) nivel += codigo[i] === '(' ? 1 : codigo[i] === ')' ? -1 : 0;
      const linea = codigo.slice(0, m.index).split('\n').length;
      halladas.push({ donde: `${path.relative(SRC, archivo)}:${linea}`, texto: codigo.slice(m.index, i), codigo });
    }
    return halladas;
  });
}

const literales = (texto) => [...texto.matchAll(/(?<![A-Za-z_])tipo: '([A-Z_]+)'/g)].map(m => m[1]);

// Los de rechazo de propuesta llegan como parámetro a una función común.
function emitidos() {
  const todas = llamadas();
  const porParametro = todas.flatMap(l => literales(l.codigo).filter(t => t.startsWith('RECHAZO_PROPUESTA_')));
  return new Set([...todas.flatMap(l => literales(l.texto)), ...porParametro]);
}

test('toda llamada de aviso de Vales lleva tipo', () => {
  const todas = llamadas();
  assert.ok(todas.length >= 30, `solo se hallaron ${todas.length} llamadas`);
  assert.deepStrictEqual(todas.filter(l => !/(?<![A-Za-z_])tipo\b/.test(l.texto)).map(l => l.donde), []);
});

test('todo tipo emitido tiene categoría o queda solo en la campana', () => {
  const sueltos = [...emitidos()].filter(t => !categoriaDeTipo('vales', t) && !SOLO_CAMPANA.vales.includes(t));
  assert.deepStrictEqual(sueltos, []);
});

test('todo tipo del catálogo y de la campana se emite en el código', () => {
  const hay = emitidos();
  const esperados = [...categoriasDe('vales').flatMap(c => c.tipos), ...SOLO_CAMPANA.vales];
  assert.deepStrictEqual(esperados.filter(t => !hay.has(t)), []);
});

test('los tipos caben en la columna de 30 caracteres', () => {
  assert.deepStrictEqual([...emitidos()].filter(t => t.length > 30), []);
});
