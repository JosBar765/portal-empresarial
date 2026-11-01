// Versiona los estáticos con ?v=<hash del contenido> para saltar el caché del navegador y de la CDN.
// Idempotente: sin cambios en los archivos no modifica nada. Uso: npm run estaticos:versionar
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC = path.join(__dirname, '..', 'public');
const MARCA_INICIO = '<!-- importmap:inicio -->';
const MARCA_FIN = '<!-- importmap:fin -->';

// Como postinstall solo versiona en los hosts desplegados; en local y en el CI lo omite para no ensuciar el árbol.
if (process.argv.includes('--solo-despliegue') && !['staging', 'production'].includes(process.env.NODE_ENV)) {
  console.log(`Versionado omitido (NODE_ENV=${process.env.NODE_ENV || 'sin definir'}).`);
  process.exit(0);
}

function listar(dir, extension, salida) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) listar(ruta, extension, salida);
    else if (entrada.name.endsWith(extension)) salida.push(ruta);
  }
  return salida;
}

const aUrl = ruta => '/' + path.relative(PUBLIC, ruta).split(path.sep).join('/');
const hashear = texto => crypto.createHash('sha1').update(texto).digest('hex').slice(0, 8);
const esExterna = ref => /^(https?:)?\/\//.test(ref) || ref.startsWith('data:');

// Una referencia absoluta (/css/x.css) cuelga de public; una relativa, del archivo que la cita.
function resolver(ref, desdeArchivo) {
  const limpia = ref.split(/[?#]/)[0];
  return limpia.startsWith('/') ? path.join(PUBLIC, limpia) : path.resolve(path.dirname(desdeArchivo), limpia);
}

// Los CSS se versionan hojas primero: el hash de un CSS incluye el ?v= de lo que importa.
const hashesCss = new Map();
function versionarCss(archivo) {
  if (hashesCss.has(archivo)) return hashesCss.get(archivo);
  const original = fs.readFileSync(archivo, 'utf8');
  const nuevo = original.replace(/(@import\s+url\(\s*['"]?)([^'")]+?)(\?v=[0-9a-f]+)?(['"]?\s*\))/g, (todo, antes, ref, _v, despues) => {
    if (esExterna(ref)) return todo;
    const destino = resolver(ref, archivo);
    if (!fs.existsSync(destino)) return todo;
    return `${antes}${ref}?v=${versionarCss(destino)}${despues}`;
  });
  if (nuevo !== original) fs.writeFileSync(archivo, nuevo);
  const hash = hashear(nuevo);
  hashesCss.set(archivo, hash);
  return hash;
}

const hashesJs = new Map();
const hashJs = archivo => {
  if (!hashesJs.has(archivo)) hashesJs.set(archivo, hashear(fs.readFileSync(archivo, 'utf8')));
  return hashesJs.get(archivo);
};

const hashDe = archivo => (archivo.endsWith('.css') ? versionarCss(archivo) : hashJs(archivo));

// Los import relativos de los módulos ES no se reescriben: un import map los resuelve a su URL versionada.
function bloqueImportMap(archivoHtml, eol) {
  const dirsJs = [path.join(PUBLIC, 'js'), path.join(path.dirname(archivoHtml), 'js')];
  const entradas = dirsJs
    .filter(d => fs.existsSync(d))
    .flatMap(d => listar(d, '.js', []))
    .sort()
    .map(f => `      "${aUrl(f)}": "${aUrl(f)}?v=${hashJs(f)}"`);
  return [
    '  <script type="importmap">',
    '  {',
    '    "imports": {',
    entradas.join(',' + eol),
    '    }',
    '  }',
    '  </script>'
  ].join(eol);
}

function versionarHtml(archivo) {
  const original = fs.readFileSync(archivo, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  let nuevo = original.replace(/((?:href|src)=")([^"]+?\.(?:css|js))(\?v=[0-9a-f]+)?(")/g, (todo, antes, ref, _v, despues) => {
    if (esExterna(ref)) return todo;
    const destino = resolver(ref, archivo);
    if (!fs.existsSync(destino)) return todo;
    return `${antes}${ref}?v=${hashDe(destino)}${despues}`;
  });
  const marcas = new RegExp(`${MARCA_INICIO}[\\s\\S]*?${MARCA_FIN}`);
  if (marcas.test(nuevo)) {
    nuevo = nuevo.replace(marcas, () => `${MARCA_INICIO}${eol}${bloqueImportMap(archivo, eol)}${eol}  ${MARCA_FIN}`);
  }
  if (nuevo !== original) fs.writeFileSync(archivo, nuevo);
  return nuevo !== original;
}

// Los CSS que ningún HTML cita directo (solo por @import) también deben quedar versionados.
listar(PUBLIC, '.css', []).forEach(versionarCss);
const modificados = listar(PUBLIC, '.html', []).filter(versionarHtml);

console.log(`Versionado: ${hashesCss.size} CSS revisados, ${modificados.length} HTML actualizados.`);
