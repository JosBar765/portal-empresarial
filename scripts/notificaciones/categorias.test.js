// node --test scripts/notificaciones/  (sin base de datos ni red)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const categorias = require(path.join(SRC, 'core/notifications/categorias'));

const usuario = (permisos, rolId = 99) => ({ id: 1, rolId, permissions: permisos });
const visibles = (modulo, permisos, rolId) => categorias.categoriasVisibles(modulo, usuario(permisos, rolId)).map(c => c.id);

test('cada módulo tiene las categorías aprobadas', () => {
  const total = m => categorias.categoriasDe(m).length;
  assert.deepStrictEqual([total('vales'), total('viaticos'), total('incidencias'), total('proyectos')], [10, 4, 4, 6]);
  assert.deepStrictEqual([total('admin'), total('prompts'), total('tiempos')], [0, 0, 0]);
});

test('ids, nombres y descripciones completos; ningún tipo en dos categorías; tipos de hasta 30 caracteres', () => {
  for (const modulo of ['vales', 'viaticos', 'incidencias', 'proyectos']) {
    const lista = categorias.categoriasDe(modulo);
    assert.strictEqual(new Set(lista.map(c => c.id)).size, lista.length);
    for (const c of lista) {
      assert.ok(c.nombre && c.descripcion && c.tipos.length, `${modulo}/${c.id} incompleta`);
      assert.ok(c.id.length <= 40, c.id);
    }
    const tipos = lista.flatMap(c => c.tipos);
    assert.strictEqual(new Set(tipos).size, tipos.length, `tipos repetidos en ${modulo}`);
    assert.ok(tipos.every(t => t.length <= 30), `tipo demasiado largo en ${modulo}`);
  }
});

test('los avisos que quedan solo en la campana no tienen categoría', () => {
  for (const tipo of ['CORREGIDO', 'TOMADO', 'PAUSADO', 'REANUDADO']) {
    assert.strictEqual(categorias.categoriaDeTipo('vales', tipo), null);
    assert.ok(categorias.SOLO_CAMPANA.vales.includes(tipo));
  }
  assert.strictEqual(categorias.categoriaDeTipo('vales', null), null);
  assert.strictEqual(categorias.categoriaDeTipo('admin', 'CREADO'), null);
});

test('categoriaDeTipo respeta el módulo', () => {
  assert.strictEqual(categorias.categoriaDeTipo('vales', 'PROCESO_CANCELADO'), 'avance_diseno');
  assert.strictEqual(categorias.categoriaDeTipo('vales', 'REENVIADO'), 'pendientes_autorizacion');
  assert.strictEqual(categorias.categoriaDeTipo('viaticos', 'solicitud_nueva'), 'por_autorizar');
  assert.strictEqual(categorias.categoriaDeTipo('incidencias', 'solicitud_nueva'), null);
});

test('visibilidad según permisos', () => {
  assert.deepStrictEqual(visibles('viaticos', ['viaticos.ver', 'viaticos.gestionar']), ['autorizadas_rechazadas', 'vencimientos']);
  assert.deepStrictEqual(visibles('viaticos', ['viaticos.ver', 'viaticos.autorizar']), ['por_autorizar']);
  assert.deepStrictEqual(visibles('viaticos', ['viaticos.ver', 'viaticos.liquidar']), ['liquidadas']);
  assert.deepStrictEqual(visibles('incidencias', ['incidencias.ver', 'incidencias.reportar']), ['avance', 'verificacion_cierre', 'comentarios']);
  assert.deepStrictEqual(visibles('proyectos', ['proyectos.ver', 'proyectos.gestionar']), ['reparto', 'seguimiento', 'ventas']);
  assert.ok(!visibles('vales', ['vales.ver', 'vales.supervisar']).includes('mensajes'));
  assert.ok(visibles('vales', ['vales.ver', 'vales.supervisar']).includes('pendientes_autorizacion'));
  assert.ok(!visibles('vales', ['vales.ver', 'vales.trabajar']).includes('pendientes_autorizacion'));
});

test('el administrador ve todas las de Vales; sin permiso de ver el módulo no hay ninguna', () => {
  assert.strictEqual(visibles('vales', ['vales.ver'], 1).length, 10);
  assert.deepStrictEqual(visibles('vales', ['vales.crear']), []);
  assert.deepStrictEqual(visibles('admin', ['admin.ver'], 1), []);
});

test('Viáticos: todos sus tipos tienen categoría', () => {
  const { NOTIFICACION } = require(path.join(SRC, 'modules/viaticos/constantes'));
  const tipos = Object.entries(NOTIFICACION).filter(([k]) => k.startsWith('TIPO_')).map(([, v]) => v);
  assert.ok(tipos.length >= 7);
  for (const t of tipos) assert.ok(categorias.categoriaDeTipo('viaticos', t), t);
});

test('Proyectos: todos sus eventos tienen categoría', () => {
  const { EVENTOS } = require(path.join(SRC, 'modules/proyectos/eventos'));
  for (const e of [...EVENTOS.map(x => x.clave), 'activacion_automatica_fallo']) assert.ok(categorias.categoriaDeTipo('proyectos', e), e);
});

test('Incidencias: todos sus tipos tienen categoría', () => {
  const dir = path.join(SRC, 'modules/incidencias/services');
  const codigo = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  // El tipo llega como tercer argumento de _aviso (tras el actor) o como propiedad tipo.
  const tipos = new Set([...codigo.matchAll(/(?:usuario, |tipo: )'(incidencia_[a-z_]+)'/g)].map(m => m[1]));
  assert.ok(tipos.size >= 13, `solo se hallaron ${tipos.size}`);
  for (const t of tipos) assert.ok(categorias.categoriaDeTipo('incidencias', t), t);
});
