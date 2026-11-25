// node --test scripts/security/destinoLogin.test.js (sin base de datos ni red).
// El login conserva a qué módulo se iba, y solo acepta rutas propias del portal.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const { destinoSeguro, rutaDeLogin } = require(path.join(RAIZ, 'src/core/permissions/destinoLogin'));

const VALIDAS = [
  ['/modules/vales/', '/modules/vales/'],
  ['/modules/vales', '/modules/vales/'],
  ['/modules/viaticos/index.html', '/modules/viaticos/'],
  ['/modules/vales/?x=1', '/modules/vales/'],
  ['/dashboard/', '/dashboard/']
];
const AJENAS = [
  'https://evil.com/modules/vales/', '//evil.com/modules/vales/', '/\\evil.com', '/modules/../api/', '/modules/vales/js/app.js',
  '/api/vales', 'javascript:alert(1)', '/modules/vales/%2e%2e', '', undefined, null, ['/modules/vales/']
];

test('acepta módulos y dashboard, normalizados', () => {
  for (const [entrada, salida] of VALIDAS) assert.strictEqual(destinoSeguro(entrada), salida, entrada);
});

test('rechaza todo lo que no sea una página propia del portal', () => {
  for (const entrada of AJENAS) assert.strictEqual(destinoSeguro(entrada), null, String(entrada));
});

test('la redirección al login lleva el destino solo si es un módulo', () => {
  assert.strictEqual(rutaDeLogin('/modules/vales/'), '/login/?expired=true&destino=%2Fmodules%2Fvales%2F');
  assert.strictEqual(rutaDeLogin('/dashboard/'), '/login/?expired=true');
  assert.strictEqual(rutaDeLogin('/otra'), '/login/?expired=true');
});

test('la página de login aplica la misma regla y no deja destinos fijos', () => {
  const html = fs.readFileSync(path.join(RAIZ, 'public/login/index.html'), 'utf8');
  const fuente = html.match(/function destinoTrasLogin\(busqueda\) \{[\s\S]*?\n {6}\}/);
  assert.ok(fuente, 'falta destinoTrasLogin');
  const destinoTrasLogin = new Function(`${fuente[0]}; return destinoTrasLogin;`)();
  const con = (d) => destinoTrasLogin(`?expired=true&destino=${encodeURIComponent(d)}`);
  assert.strictEqual(con('/modules/vales/'), '/modules/vales/');
  for (const ajena of AJENAS.filter(a => typeof a === 'string')) assert.strictEqual(con(ajena), '/dashboard/', ajena);
  assert.strictEqual(destinoTrasLogin(''), '/dashboard/');
  assert.ok(!/location\.href = '\/dashboard\/'/.test(html), 'queda una redirección fija al dashboard');
});
