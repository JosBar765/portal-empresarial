// Verifica que todo JS de src/, scripts/ y public/ se pueda parsear (sin ejecutarlo).
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const { spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const CARPETAS = ['src', 'scripts', 'public'];
const IGNORAR = new Set(['node_modules', '.git']);

function listarJs(dir, salida) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) listarJs(ruta, salida);
    else if (/\.(js|mjs|cjs)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
}

// Script clásico: el envoltorio de CommonJS permite también `return` y `require` de nivel superior.
function parseaComoScript(codigo, archivo) {
  new vm.Script(Module.wrap(codigo.replace(/^#!.*/, '')), { filename: archivo });
}

// Módulo ES: node --check sobre una copia .mjs, porque vm no lo parsea sin banderas.
function parseaComoModulo(codigo, archivo) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ci-sintaxis-')), 'modulo.mjs');
  fs.writeFileSync(tmp, codigo);
  const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  if (r.status !== 0) throw new Error((r.stderr || '').split('\n').find(l => /Error/.test(l)) || 'error de sintaxis');
}

function revisar(archivo) {
  const codigo = fs.readFileSync(archivo, 'utf8');
  const esBackend = !archivo.startsWith(path.join(RAIZ, 'public'));
  try {
    parseaComoScript(codigo, archivo);
    return null;
  } catch (errorScript) {
    // Solo el frontend puede ser un módulo ES; el backend es CommonJS.
    if (esBackend) return errorScript.message;
    try {
      parseaComoModulo(codigo, archivo);
      return null;
    } catch {
      return errorScript.message;
    }
  }
}

const archivos = CARPETAS.flatMap(c => {
  const dir = path.join(RAIZ, c);
  return fs.existsSync(dir) ? listarJs(dir, []) : [];
}).sort();

const fallos = [];
for (const archivo of archivos) {
  const error = revisar(archivo);
  if (error) fallos.push({ archivo: path.relative(RAIZ, archivo), error });
}

if (fallos.length) {
  fallos.forEach(f => console.error(`[FALLO] ${f.archivo}: ${f.error}`));
  console.error(`Sintaxis: ${fallos.length} archivo(s) con error de ${archivos.length}.`);
  process.exit(1);
}
console.log(`Sintaxis: ${archivos.length} archivos JS correctos.`);
