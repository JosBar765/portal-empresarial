// Los avisos siguen las tiendas marcadas. Sin base de datos ni red.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const SRC = path.join(RAIZ, 'src');
const sustituir = (relativo, exports) => {
  const id = require.resolve(path.join(SRC, relativo));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
const cargado = (relativo) => require.cache[require.resolve(path.join(SRC, relativo))];
// Todas las pruebas de la carpeta comparten proceso: solo se sustituye lo que otra no haya sustituido ya.
if (!cargado('config/env')) sustituir('config/env', { nodeEnv: 'production', push: { habilitado: false } });
if (!cargado('config/database')) sustituir('config/database', { query: async () => [] });
if (!cargado('core/websocket/socketManager')) sustituir('core/websocket/socketManager', { sendToRooms() {} });
const db = require(path.join(SRC, 'config/database'));

const alcance = require(path.join(RAIZ, 'public/js/alcanceAvisos'));
const { visibleSql } = require(path.join(SRC, 'core/notifications/alcanceSql'));
const notificacionService = require(path.join(SRC, 'core/notifications/notificacionService'));

let consultas = [];
// Captura las consultas de este archivo sin romper las de los demás.
async function conBase(responder, tarea) {
  const original = { query: db.query, transaccion: db.transaccion };
  consultas = [];
  db.query = async (sql, params, tag) => { consultas.push({ sql, params, tag }); return responder(tag, params); };
  db.transaccion = async (fn) => fn({ query: db.query });
  try { return await tarea(); } finally { Object.assign(db, original); }
}
const porTag = (tag) => consultas.filter(c => c.tag === tag);

test('la condición deja pasar: sin selección, sin tienda, lo propio y lo marcado', () => {
  const sql = visibleSql({ usuario: 'n.usuario_id', modulo: 'n.modulo', tienda: 'n.tienda_id', asesor: 'n.asesor_id' });
  assert.match(sql, /n\.tienda_id IS NULL/);
  assert.match(sql, /n\.asesor_id <=> n\.usuario_id/);
  assert.match(sql, /NOT EXISTS/);
  assert.match(sql, /clase = 'tienda'[\s\S]*clase = 'asesor'/);
});

test('registrar guarda la tienda y el asesor del aviso', async () => {
  await conBase((tag) => (tag === 'notificacion:insert_varias' ? { insertId: 1 } : []), async () => {
    await notificacionService.registrar([7], { modulo: 'vales', tipo: 'ATRASO', mensaje: 'x', tiendaId: 3, asesorId: 9 });
    const [insert] = porTag('notificacion:insert_varias');
    assert.match(insert.sql, /tienda_id, asesor_id/);
    assert.deepStrictEqual(insert.params[0][0].slice(-2), [3, 9]);
  });
});

test('la lista, el contador, el resumen y «marcar todas» aplican la selección', async () => {
  const responder = (tag) => {
    if (tag === 'notificacion:count_no_leidas') return [{ n: 2 }];
    if (tag === 'alcance:activo') return [{ n: 1 }];
    if (tag === 'notificacion:fuera') return [{ tienda_id: 4, tienda: 'Xela', asesor_id: 9, asesor: 'Dalia', n: 3 }];
    return [];
  };
  await conBase(responder, async () => {
    const data = await notificacionService.listar(7, { modulo: 'vales' });
    assert.strictEqual(data.filtrada, true);
    assert.deepStrictEqual(data.fuera, [{ tiendaId: 4, tienda: 'Xela', asesorId: 9, asesor: 'Dalia', noLeidas: 3 }]);
    await notificacionService.resumen(7);
    await notificacionService.marcarTodasLeidas(7, 'vales');
    for (const tag of ['notificacion:list', 'notificacion:count_no_leidas', 'notificacion:count_por_modulo', 'notificacion:marcar_todas']) {
      assert.match(porTag(tag)[0].sql, /notificacion_filtros/, tag);
    }
  });
});

test('sin selección no se consulta lo de fuera', async () => {
  await conBase((tag) => (tag === 'notificacion:count_no_leidas' || tag === 'alcance:activo' ? [{ n: 0 }] : []), async () => {
    const data = await notificacionService.listar(7, { modulo: 'vales' });
    assert.deepStrictEqual([data.filtrada, data.fuera], [false, []]);
    assert.strictEqual(porTag('notificacion:fuera').length, 0);
  });
});

const TIENDAS = [{ id: 1, nombre: 'Zona 10' }, { id: 4, nombre: 'Xela' }, { id: 5, nombre: 'Antigua' }];
const ASESORES = [{ id: 12, nombre: 'Julio' }];

test('en el navegador: qué avisos suenan, qué rótulo se muestra y cómo se agrupa lo de fuera', () => {
  const sel = { tiendas: [1], asesores: [12] };
  const permite = (d) => alcance.permite(sel, d, 7);
  assert.strictEqual(permite({ tiendaId: 1, asesorId: 3 }), true);
  assert.strictEqual(permite({ tiendaId: 4, asesorId: 3 }), false);
  assert.strictEqual(permite({ tiendaId: 4, asesorId: 12 }), true);
  assert.strictEqual(permite({ tiendaId: 4, asesorId: 7 }), true, 'lo propio');
  assert.strictEqual(permite({ asesorId: 3 }), true, 'sin tienda');
  assert.strictEqual(alcance.permite({ tiendas: [], asesores: [] }, { tiendaId: 4, asesorId: 3 }, 7), true);

  assert.strictEqual(alcance.rotulo({ tiendas: [], asesores: [] }, TIENDAS, ASESORES), 'todas tus tiendas');
  assert.strictEqual(alcance.rotulo(sel, TIENDAS, ASESORES), 'Zona 10, Julio');
  assert.strictEqual(alcance.rotulo({ tiendas: [1, 4, 5], asesores: [] }, TIENDAS, ASESORES), '3 tiendas');

  const filas = [
    { tiendaId: 4, tienda: 'Xela', asesorId: 3, asesor: 'A', noLeidas: 2 },
    { tiendaId: 4, tienda: 'Xela', asesorId: 8, asesor: 'B', noLeidas: 1 },
    { tiendaId: 9, tienda: 'Ajena', asesorId: 12, asesor: 'Julio', noLeidas: 4 },
    { tiendaId: 8, tienda: 'Vieja', asesorId: 2, asesor: 'C', noLeidas: 1 }
  ];
  const grupos = alcance.grupos(filas, TIENDAS, ASESORES);
  assert.deepStrictEqual(grupos, [
    { clave: 'a12', nombre: 'Julio', noLeidas: 4, puedeVer: true },
    { clave: '4', nombre: 'Xela', noLeidas: 3, puedeVer: true },
    { clave: '8', nombre: 'Vieja', noLeidas: 1, puedeVer: false }
  ]);
  assert.strictEqual(alcance.resumenFuera(grupos), '8 sin leer en 3 tiendas que no ves');
  assert.strictEqual(alcance.resumenFuera([{ noLeidas: 1 }]), '1 sin leer en 1 tienda que no ves');
});

test('en el navegador: el valor del selector se convierte en selección y al revés', () => {
  assert.strictEqual(alcance.valorDeSeleccion({ tiendas: [1, 4], asesores: [12] }), '1,4,a12');
  assert.deepStrictEqual(alcance.agregar({ tiendas: [1], asesores: [] }, 'a12'), { tiendas: [1], asesores: [12] });
  assert.deepStrictEqual(alcance.agregar({ tiendas: [1], asesores: [] }, '4'), { tiendas: [1, 4], asesores: [] });
});

// Servicio de Vales: solo supervisores y solo sus tiendas.
const catalogo = { tiendasGerencia: TIENDAS, asesoresEspeciales: ASESORES };
const idVales = (r) => require.resolve(path.join(SRC, 'modules/vales', r));
const falsos = {
  'services/valeCatalogoService': { obtenerCatalogos: async () => catalogo },
  'services/valeHelpers': { ROL: { GERENTE: 8 }, esSupervisor: (u) => u.permissions.includes('vales.supervisar'), esAdministrador: (u) => u.rolId === 1 }
};
for (const [r, exports] of Object.entries(falsos)) require.cache[idVales(r)] = { id: idVales(r), filename: idVales(r), loaded: true, exports };
const filtro = require(path.join(SRC, 'modules/vales/services/valeFiltroAvisosService'));
const SUPERVISOR = { id: 7, rolId: 3, permissions: ['vales.supervisar'] };

test('guardar recorta a lo que el supervisor puede ver y recuerda que ya eligió', async () => {
  await conBase(() => [], async () => {
    const r = await filtro.guardar(SUPERVISOR, { tiendas: [1, 99, 'x'], asesores: [12, 50] });
    assert.deepStrictEqual(r, { aplica: true, guardado: true, tiendas: [1], asesores: [12] });
    assert.strictEqual(porTag('alcance:borrar').length, 1);
    assert.deepStrictEqual(porTag('alcance:insert')[0].params[0].map(f => f.slice(2)), [['guardado', 0], ['tienda', 1], ['asesor', 12]]);
  });
});

test('el Administrador y el Gerente también filtran su campana', async () => {
  await conBase(() => [], async () => {
    for (const usuario of [{ id: 1, rolId: 1, permissions: [] }, { id: 2, rolId: 8, permissions: [] }]) {
      assert.strictEqual((await filtro.leer(usuario)).aplica, true);
      assert.deepStrictEqual((await filtro.guardar(usuario, { tiendas: [1] })).tiendas, [1]);
    }
  });
});

test('leer ignora y limpia lo que ya no aplica; sin selector de tiendas no se filtra', async () => {
  const filas = [{ clase: 'guardado', ref_id: 0 }, { clase: 'tienda', ref_id: 1 }, { clase: 'tienda', ref_id: 99 }];
  await conBase((tag) => (tag === 'alcance:leer' ? filas : []), async () => {
    assert.deepStrictEqual(await filtro.leer(SUPERVISOR), { aplica: true, guardado: true, tiendas: [1], asesores: [] });
    assert.strictEqual(porTag('alcance:borrar').length, 1);
  });
  await conBase(() => [], async () => {
    assert.deepStrictEqual(await filtro.leer({ id: 2, rolId: 2, permissions: [] }), { aplica: false, guardado: false, tiendas: [], asesores: [] });
    assert.strictEqual(porTag('alcance:borrar').length, 1, 'no deja un filtro viejo activo');
    await assert.rejects(filtro.guardar({ id: 3, rolId: 2, permissions: [] }, { tiendas: [1] }), /filtrar/i);
  });
});

test('en la campana las tiendas se nombran con su código, como en el selector', () => {
  const conCodigo = [{ id: 1, codigo: 'SSV', nombre: 'Premia' }, { id: 4, codigo: 'MTC', nombre: 'Munditrofeos' }];
  assert.strictEqual(alcance.rotulo({ tiendas: [1], asesores: [] }, conCodigo, []), 'SSV - Premia');
  assert.strictEqual(alcance.grupos([{ tiendaId: 4, tienda: 'MTC - Munditrofeos', asesorId: 2, noLeidas: 3 }], conCodigo, [])[0].nombre, 'MTC - Munditrofeos');
});

test('un aviso sin asesor nunca deja la regla sin respuesta (NULL)', () => {
  const { visibleSql } = require(path.join(SRC, 'core/notifications/alcanceSql'));
  const regla = visibleSql({ usuario: 'u', modulo: 'm', tienda: 't', asesor: 'a' });
  assert.ok(regla.includes('a <=> u'), 'la comparación con el asesor debe ser segura ante NULL');
  assert.ok(!/OR a = u/.test(regla));
});

// C1: se guarda lo que se quiso decir (país o grupo completo), no solo los ids del momento.
const T = [
  { id: 1, codigo: 'MTC', nombre: 'Uno', pais_id: 10, pais_nombre: 'Guatemala', departamento_id: 5, departamento_nombre: 'Guatemala' },
  { id: 2, codigo: 'XEL', nombre: 'Dos', pais_id: 10, pais_nombre: 'Guatemala', departamento_id: 6, departamento_nombre: 'Quetzaltenango' },
  { id: 3, codigo: 'R11', nombre: 'Ruta a', pais_id: 20, pais_nombre: 'Honduras', departamento_id: 7, departamento_nombre: 'Ventas Trofex Ruta 1' },
  { id: 4, codigo: 'R12', nombre: 'Ruta b', pais_id: 20, pais_nombre: 'Honduras', departamento_id: 7, departamento_nombre: 'Ventas Trofex Ruta 1' },
  { id: 5, codigo: 'SPS', nombre: 'Suelta', pais_id: 20, pais_nombre: 'Honduras', departamento_id: 8, departamento_nombre: 'Cortés' }
];
const reglas = require(path.join(SRC, 'modules/vales/services/valeAlcanceReglas'));

test('un país o un grupo completo se guarda como tal; todas las tiendas, como sin filtro', () => {
  assert.deepStrictEqual(reglas.compactar([1, 2], T), { tiendas: [], paises: [10], grupos: [] });
  assert.deepStrictEqual(reglas.compactar([3, 4], T), { tiendas: [], paises: [], grupos: [7] });
  assert.deepStrictEqual(reglas.compactar([1, 3], T), { tiendas: [1, 3], paises: [], grupos: [] });
  assert.deepStrictEqual(reglas.compactar([1, 2, 3, 4, 5], T), { tiendas: [], paises: [], grupos: [] });
});

test('al leer, país y grupo se expanden a las tiendas de hoy (las nuevas entran solas)', () => {
  const filas = [{ clase: 'pais', ref_id: 10 }, { clase: 'grupo', ref_id: 7 }];
  const nueva = { ...T[0], id: 9 };
  assert.deepStrictEqual(reglas.expandir(filas, [...T, nueva]).sort(), [1, 2, 3, 4, 9]);
});

test('la regla de visibilidad entiende país y grupo', () => {
  const sql = visibleSql({ usuario: 'u', modulo: 'm', tienda: 't', asesor: 'a' });
  assert.match(sql, /f\.clase = 'pais'/);
  assert.match(sql, /f\.clase = 'grupo'/);
});

test('C2: el cambio del administrador quita las perdidas y marca las nuevas; sin filtro no cambia', () => {
  const filas = [{ clase: 'tienda', ref_id: 1 }, { clase: 'tienda', ref_id: 3 }, { clase: 'asesor', ref_id: 12 }];
  const antes = { tiendas: T.slice(0, 3), asesores: [12] };
  const despues = { tiendas: [T[0], T[4]], asesores: [30] };
  assert.deepStrictEqual(reglas.ajustar(filas, antes, despues), { tiendas: [1, 5], paises: [], grupos: [], asesores: [30] });
  assert.strictEqual(reglas.ajustar([], antes, despues), null);
  assert.strictEqual(reglas.ajustar(filas, antes, antes), null);
  // Una tienda nueva de un país ya marcado no se repite como id.
  assert.deepStrictEqual(reglas.ajustar([{ clase: 'pais', ref_id: 10 }], { tiendas: [T[0]], asesores: [] }, { tiendas: [T[0], T[1]], asesores: [] }), null);
});

test('el rótulo nombra el país o el grupo completo', () => {
  assert.strictEqual(alcance.rotulo({ tiendas: [1, 2], asesores: [] }, T, []), 'Guatemala');
  assert.strictEqual(alcance.rotulo({ tiendas: [3, 4], asesores: [] }, T, []), 'Trofex Ruta 1');
});

test('C3: abrir un aviso de una tienda no marcada la agrega a la selección', () => {
  const sel = { tiendas: [1], asesores: [] };
  assert.deepStrictEqual(alcance.incluir(sel, { tiendaId: 1 }, T, []), { cubierto: true, nueva: null });
  assert.deepStrictEqual(alcance.incluir(sel, { tiendaId: 3 }, T, []), { cubierto: true, nueva: { tiendas: [1, 3], asesores: [] } });
  assert.deepStrictEqual(alcance.incluir(sel, { tiendaId: 99, asesorId: 12 }, T, [{ id: 12 }]), { cubierto: true, nueva: { tiendas: [1], asesores: [12] } });
  assert.deepStrictEqual(alcance.incluir(sel, { tiendaId: 99, asesorId: 50 }, T, []), { cubierto: false, nueva: null });
  assert.deepStrictEqual(alcance.incluir({ tiendas: [], asesores: [] }, { tiendaId: 3 }, T, []), { cubierto: true, nueva: null });
});

test('guardar y ajustar avisan a las otras pantallas del mismo usuario', async () => {
  const socket = require(path.join(SRC, 'core/websocket/socketManager'));
  const enviados = [];
  socket.sendToUsers = (ids, evento) => enviados.push([ids, evento]);
  await conBase(() => [], () => filtro.guardar(SUPERVISOR, { tiendas: [1] }));
  assert.deepStrictEqual(enviados, [[[7], 'alcance_avisos']]);
});

test('el cambio de asignaciones del administrador ajusta la selección guardada y avisa; un fallo al ajustar no lo bloquea', async () => {
  let cubiertas = [1, 2];
  const ids = ['repositories/usuarioValeRepository', 'repositories/catalogoRepository'].map(idVales);
  const previos = ids.map(id => require.cache[id]);
  const falsosRepos = [
    { listarAsesoresPorSupervisor: async () => cubiertas.map(tienda_id => ({ tienda_id })), listarAsesoresEspeciales: async () => [] },
    { listarTiendas: async () => [1, 2, 3].map(id => ({ id, pais_id: 10, departamento_id: 20 })) }
  ];
  ids.forEach((id, i) => { require.cache[id] = { id, filename: id, loaded: true, exports: falsosRepos[i] }; });
  const socket = require(path.join(SRC, 'core/websocket/socketManager'));
  const enviados = [];
  socket.sendToUsers = (usuarios) => enviados.push(usuarios);
  const responder = (tag) => (tag === 'alcance:usuarios' ? [{ usuario_id: 7 }] : tag === 'alcance:leer' ? [{ clase: 'guardado', ref_id: 0 }, { clase: 'tienda', ref_id: 1 }] : []);
  try {
    await conBase(responder, async () => {
      assert.strictEqual(await filtro.trasCambioDeAsignaciones(async () => { cubiertas = [2, 3]; return 'hecho'; }), 'hecho');
      assert.deepStrictEqual(porTag('alcance:insert')[0].params[0].map(f => f.slice(2)), [['guardado', 0], ['tienda', 3]]);
      assert.deepStrictEqual(enviados, [[7]]);
    });
    await conBase(() => { throw new Error('sin base'); }, async () => {
      assert.strictEqual(await filtro.trasCambioDeAsignaciones(async () => 'hecho'), 'hecho');
    });
  } finally {
    ids.forEach((id, i) => { if (previos[i]) require.cache[id] = previos[i]; else delete require.cache[id]; });
  }
});
