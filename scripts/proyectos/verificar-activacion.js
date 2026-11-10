// scripts/proyectos/verificar-activacion.js
// Verifica la activación de Proyectos (fase 8): asigna el mapa de permisos de la propuesta con la MISMA función que usa la pantalla de
// Roles de Administración, comprueba que el módulo aparezca solo en los roles previstos y recorre, por HTTP contra las rutas reales y con
// los permisos que cada rol recibe de verdad, qué puede y qué no puede hacer cada uno. Al final prueba a dos supervisores activando a
// la vez la misma tienda. Deja la base como la encontró.
//
// Uso (base DESECHABLE con las migraciones aplicadas):
//   node scripts/proyectos/verificar-activacion.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const adminService = require('../../src/modules/admin/services/adminService');
const authService = require('../../src/core/auth/authService');
const { PERMISOS_POR_ROL, TODOS, comparar, sqlDeActivacion } = require('../../src/modules/proyectos/permisosPorRol');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

async function levantar() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: Number(req.headers['x-usuario']), permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    next();
  });
  app.use('/api/proyectos', requirePermission('proyectos.ver'), rutas);
  return new Promise(resolver => { const s = app.listen(0, '127.0.0.1', () => resolver(s)); });
}

async function verificar() {
  const configService = require('../../src/modules/proyectos/services/configService');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'act:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'act:ajustes_antes');
  const permisos = await db.query('SELECT id, codigo, modulo FROM permisos', [], 'act:permisos');
  const idsProyectos = new Set(permisos.filter(p => p.modulo === 'proyectos').map(p => p.id));
  const idDe = (codigo) => (permisos.find(p => p.codigo === codigo) || {}).id;
  const roles = [1, 2, 3, 4, 5, 6, 7, 8];
  const originales = new Map();
  for (const rol of roles) originales.set(rol, (await db.query('SELECT permiso_id FROM rol_permisos WHERE rol_id = ?', [rol], 'act:original')).map(f => f.permiso_id));
  const usuarioDe = async (rol) => (await db.query('SELECT id FROM usuarios WHERE rol_id = ? AND activo = 1 ORDER BY id LIMIT 1', [rol], 'act:usuario'))[0].id;
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'act:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'act:estructura');
  const [{ pais_id: paisTienda4 }] = await db.query('SELECT e.pais_id FROM tiendas t JOIN empresas e ON e.id = t.empresa_id WHERE t.id = 4', [], 'act:pais_tienda');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'act:admin');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'act:articulo');
  const proyectosCreados = [];

  console.log('Mapa de permisos (pruebas puras)');
  prueba('el mapa cubre los 14 permisos del módulo y ninguno sobra', TODOS.length === 14 && TODOS.every(c => idDe(c)) && Object.values(PERMISOS_POR_ROL).flat().every(c => TODOS.includes(c)), TODOS.filter(c => !idDe(c)).join());
  prueba('la migración creó los 14 permisos con modulo = proyectos', idsProyectos.size === 14);
  prueba('comparar detecta lo que falta y lo que sobra', (() => { const r = comparar([{ rol_id: 2, codigo: 'proyectos.ver' }, { rol_id: 2, codigo: 'proyectos.administrar' }]); return !r.ok && r.faltan[2].includes('proyectos.gestionar') && r.sobran[2].includes('proyectos.administrar'); })());
  prueba('el SQL de activación es idempotente (INSERT IGNORE) y no borra nada', /INSERT IGNORE/.test(sqlDeActivacion()) && !/DELETE|TRUNCATE|DROP/i.test(sqlDeActivacion()));

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, usuario, permisosDelRol, cuerpo) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisosDelRol.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    return res.status;
  };

  try {
    console.log('Asignar con la función de la pantalla de Roles');
    for (const rol of roles) {
      const sinProyectos = originales.get(rol).filter(id => !idsProyectos.has(id));
      const matriz = (PERMISOS_POR_ROL[rol] || []).map(idDe);
      await adminService.actualizarPermisosRol(rol, [...sinProyectos, ...matriz]);
    }
    const filas = await db.query(`SELECT rp.rol_id, p.codigo FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE p.modulo = 'proyectos'`, [], 'act:filas');
    const diferencias = comparar(filas);
    prueba('los permisos de la base coinciden con el mapa de la propuesta, rol por rol', diferencias.ok, JSON.stringify(diferencias));

    const sesion = {};
    for (const rol of roles) sesion[rol] = await authService._cargarPermisosYRol(rol);
    const conModulo = roles.filter(r => sesion[r].modules.includes('proyectos'));
    prueba('el módulo aparece solo para Administrador, Asesor, Supervisor y Gerente', JSON.stringify(conModulo) === JSON.stringify([1, 2, 3, 8]), JSON.stringify(conModulo));
    prueba('diseñadores, encargados y asistentes no lo ven', [4, 5, 6, 7].every(r => !sesion[r].modules.includes('proyectos') && !sesion[r].permissions.some(p => p.startsWith('proyectos.'))));

    console.log('Qué puede hacer cada rol (con los permisos que recibe de verdad)');
    const quien = { admin: [await usuarioDe(1), sesion[1].permissions], asesor: [49, sesion[2].permissions], supervisor: [13, sesion[3].permissions], gerente: [12, sesion[8].permissions], disenador: [await usuarioDe(6), sesion[6].permissions], encargado: [await usuarioDe(4), sesion[4].permissions] };
    const probar = async (nombre, metodo, ruta, esperado, cuerpo) => {
      const obtenidos = {};
      for (const [rol, [uid, perms]] of Object.entries(quien)) obtenidos[rol] = await llamar(metodo, ruta, uid, perms, cuerpo);
      const fallos = Object.entries(esperado).filter(([rol, e]) => (e === 'permitido' ? obtenidos[rol] === 403 || obtenidos[rol] === 401 : obtenidos[rol] !== 403));
      prueba(nombre, !fallos.length, JSON.stringify({ esperado, obtenidos }));
    };
    const si = 'permitido';
    const no = 403;
    await probar('entrar a la cartera: los cuatro roles previstos sí; diseñadores y encargados no', 'GET', '/clientes', { admin: si, asesor: si, supervisor: si, gerente: si, disenador: no, encargado: no });
    await probar('Mi proyecto: solo quien gestiona (asesor y supervisor)', 'GET', '/mi-proyecto', { asesor: si, supervisor: si, admin: no, gerente: no, disenador: no });
    await probar('crear proyectos: supervisor y administrador', 'GET', '/proyectos/opciones', { supervisor: si, admin: si, asesor: no, gerente: no, disenador: no });
    await probar('seguimiento: supervisor, gerencia y administrador', 'GET', '/seguimiento/proyectos', { supervisor: si, gerente: si, admin: si, asesor: no, disenador: no });
    await probar('reasignar: supervisor y administrador (no gerencia ni asesor)', 'POST', '/proyectos/99999999/reasignar', { supervisor: si, admin: si, asesor: no, gerente: no }, {});
    await probar('anular: supervisor y administrador', 'POST', '/participaciones/99999999/ventas/1/anular', { supervisor: si, admin: si, asesor: no, gerente: no }, {});
    await probar('ventas por confirmar: supervisor y administrador', 'GET', '/ventas', { supervisor: si, admin: si, asesor: no, gerente: no });
    await probar('panel gerencial: gerente y administrador', 'GET', '/gerencia/panel', { gerente: si, admin: si, supervisor: no, asesor: no });
    await probar('dar el visto bueno: solo el gerente', 'POST', '/proyectos/99999999/visto-bueno', { gerente: si, supervisor: no, asesor: no, admin: no }, {});
    await probar('aprobar una activación: gerente y administrador', 'POST', '/proyectos/99999999/aprobar', { gerente: si, admin: si, supervisor: no, asesor: no }, {});
    await probar('el Centro de configuración: solo el administrador', 'GET', '/config/parametros', { admin: si, asesor: no, supervisor: no, gerente: no, disenador: no });
    await probar('importar empresas: supervisor y administrador', 'GET', '/clientes/importar/plantilla', { supervisor: si, admin: si, asesor: no, gerente: no });

    console.log('Dos supervisores activando a la vez la misma tienda');
    const supervisores = [16, 17];
    const permsSupervisor = sesion[3].permissions;
    await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por) VALUES ?',
      [Array.from({ length: 8 }, (_, i) => [`ACT Hospital ${i}`, `act hospital ${i}`, nichoId, paisTienda4, estructuraId, 'activa', admin])], 'act:empresas');
    const crear = async (uid, mes) => {
      const res = await fetch(`${base}/proyectos`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-usuario': String(uid), 'x-permisos': permsSupervisor.join(',') }, body: JSON.stringify({ nichoId, anio: 2026, mes, tiendaIds: [4], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId: articulo, existenciaMuestras: 10, topePorAsesor: 100 }) });
      const datos = await res.json();
      if (datos.id) proyectosCreados.push(datos.id);
      return datos.id;
    };
    const [p1, p2] = [await crear(supervisores[0], 10), await crear(supervisores[1], 11)];
    prueba('los dos supervisores arman su borrador para la misma tienda', Boolean(p1) && Boolean(p2) && p1 !== p2);
    const activar = async (uid, id) => {
      const res = await fetch(`${base}/proyectos/${id}/activar`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-usuario': String(uid), 'x-permisos': permsSupervisor.join(',') }, body: JSON.stringify({ idempotencyKey: `act-${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }) });
      return { status: res.status, datos: await res.json() };
    };
    const [ra, rb] = await Promise.all([activar(supervisores[0], p1), activar(supervisores[1], p2)]);
    const estados = [ra.status, rb.status].sort().join();
    const perdedor = ra.status === 200 ? rb : ra;
    prueba('exactamente uno gana (200) y el otro recibe 409', estados === '200,409', JSON.stringify([ra.status, rb.status]));
    prueba('el que pierde sabe qué tienda falló y qué proyecto la bloquea', perdedor.status === 409 && /Una tienda, un proyecto activo a la vez/.test(perdedor.datos.error || ''), JSON.stringify(perdedor.datos));
    prueba('la base queda con un solo proyecto activo en esa tienda', Number((await db.query("SELECT COUNT(*) AS n FROM proy_proyecto_tiendas pt JOIN proy_proyectos y ON y.id = pt.proyecto_id WHERE pt.tienda_id = 4 AND pt.proyecto_abierto = 1 AND y.id IN (?)", [proyectosCreados], 'act:abiertos'))[0].n) === 1);
  } finally {
    // Limpieza, pase lo que pase: los permisos vuelven a como estaban y no queda nada de la prueba.
    for (const rol of roles) await adminService.actualizarPermisosRol(rol, originales.get(rol));
    if (proyectosCreados.length) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id IN (?))';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones', 'proy_vales']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [proyectosCreados], `act:limpiar_${tabla}`);
      }
    }
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por IN (16, 17)', [inicio], 'act:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'ACT %'", [], 'act:limpiar_clientes');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'act:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE (idempotency_key LIKE 'proy-%' OR idempotency_key LIKE 'vig:%') AND creado_en >= ?", [inicio], 'act:limpiar_claves');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'act:limpiar_ajustes');
    for (const { clave: k, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [k, valor], 'act:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'act:limpiar_historial');
    configService.invalidar();
    servidor.close();
  }
}

(async () => {
  await db.listo;
  await verificar();
  console.log(malas ? `\n${malas} verificación(es) fallaron (${buenas} correctas).` : `\nTodo correcto (${buenas} verificaciones).`);
  process.exit(malas ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
