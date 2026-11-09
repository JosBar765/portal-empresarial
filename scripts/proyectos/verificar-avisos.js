// scripts/proyectos/verificar-avisos.js
// Verifica los avisos configurables (fase 6c): la matriz A8 (valores por defecto, cambios, validaciones, historial y restaurar),
// que cada evento avise a quien dice la matriz y nunca al autor, y el vigilante (seguimiento que vence o venció, proyecto por
// cerrar y vencido), que avisa una sola vez.
//
// Uso (base DESECHABLE con las migraciones aplicadas; crea datos de prueba y los borra al terminar):
//   node scripts/proyectos/verificar-avisos.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const PERM_ADMIN = ['proyectos.ver', 'proyectos.administrar', 'proyectos.activar'];
const PERM_SUPERVISOR = ['proyectos.ver', 'proyectos.activar', 'proyectos.supervisar', 'proyectos.reasignar', 'proyectos.corregir', 'proyectos.confirmar_ventas'];
const PERM_GERENTE = ['proyectos.ver', 'proyectos.ver_gerencia', 'proyectos.dar_visto_bueno', 'proyectos.aprobar_activacion'];
const PERM_ASESOR = ['proyectos.ver', 'proyectos.gestionar'];

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

const gt = (desfaseDias = 0) => new Date(Date.now() - 6 * 3600 * 1000 + desfaseDias * 86400000).toISOString().slice(0, 10);

async function verificar() {
  const configService = require('../../src/modules/proyectos/services/configService');
  const avisosService = require('../../src/modules/proyectos/services/avisosService');
  const vigilante = require('../../src/modules/proyectos/proyectosWatcher');
  const { EVENTOS } = require('../../src/modules/proyectos/eventos');
  const inicio = (await db.query('SELECT NOW() - INTERVAL 2 SECOND AS t', [], 'avi:inicio'))[0].t;
  const ajustesAntes = await db.query('SELECT clave, valor FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'avi:ajustes_antes');
  const [{ id: nichoId }] = await db.query("SELECT id FROM proy_nichos WHERE nombre = 'Hospitales'", [], 'avi:nicho');
  const [{ id: estructuraId }] = await db.query('SELECT id FROM proy_estructuras ORDER BY id LIMIT 1', [], 'avi:estructura');
  const [{ id: paisGT }] = await db.query("SELECT id FROM paises WHERE codigo = 'GT'", [], 'avi:pais');
  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 ORDER BY id LIMIT 1', [], 'avi:admin');
  const [{ id: gerente }] = await db.query("SELECT id FROM usuarios WHERE email = 'gerente@grupopremia.com'", [], 'avi:gerente');
  const [{ id: articulo }] = await db.query('SELECT id FROM proy_articulos WHERE activo = 1 ORDER BY id LIMIT 1', [], 'avi:articulo');
  const paisAntes = (await db.query('SELECT moneda_codigo, referencia_obligatoria, confirmacion_ventas FROM proy_pais_config WHERE pais_id = ?', [paisGT], 'avi:pais_antes'))[0];
  const SUP = 13;
  // Quién es «gerencia» lo dicen los permisos del rol: la prueba se los da al rol del gerente si la base no los trae, y los quita al terminar.
  const [{ rol_id: rolGerente }] = await db.query('SELECT rol_id FROM usuarios WHERE id = ?', [gerente], 'avi:rol_gerente');
  const permisoGerencia = (await db.query("SELECT id FROM permisos WHERE codigo = 'proyectos.ver_gerencia'", [], 'avi:permiso'))[0].id;
  const yaTenia = (await db.query('SELECT 1 AS ya FROM rol_permisos WHERE rol_id = ? AND permiso_id = ?', [rolGerente, permisoGerencia], 'avi:ya_tenia')).length > 0;
  if (!yaTenia) await db.query('INSERT INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)', [rolGerente, permisoGerencia], 'avi:dar_permiso');
  const resultado = async (nombre) => (await db.query('SELECT id FROM proy_resultados_gestion WHERE nombre = ?', [nombre], 'avi:resultado'))[0].id;
  const rSinRespuesta = await resultado('Sin respuesta');
  const [{ id: canal }] = await db.query("SELECT id FROM proy_canales WHERE nombre = 'Llamada'", [], 'avi:canal');

  await db.query('INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, estructura_id, estado, creado_por) VALUES ?',
    [Array.from({ length: 24 }, (_, i) => [`AVI Hospital ${i}`, `avi hospital ${i}`, nichoId, paisGT, estructuraId, 'activa', admin])], 'avi:empresas');

  const servidor = await levantar();
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, { usuario, permisos, cuerpo }) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', 'x-usuario': String(usuario), 'x-permisos': permisos.join(',') }, body: cuerpo === undefined || metodo === 'GET' ? undefined : JSON.stringify(cuerpo) });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const adm = (m, r, c) => llamar(m, r, { usuario: admin, permisos: PERM_ADMIN, cuerpo: c });
  const sup = (m, r, c) => llamar(m, r, { usuario: SUP, permisos: PERM_SUPERVISOR, cuerpo: c });
  const ger = (m, r, c) => llamar(m, r, { usuario: gerente, permisos: PERM_GERENTE, cuerpo: c });
  const asesor = (m, r, c, u) => llamar(m, r, { usuario: u, permisos: PERM_ASESOR, cuerpo: c });
  const clave = () => `avi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const cuenta = async (tipo, usuario = null) => Number((await db.query(`SELECT COUNT(*) AS n FROM notificaciones WHERE modulo = 'proyectos' AND tipo = ? AND creado_en >= ?${usuario ? ' AND usuario_id = ?' : ''}`, usuario ? [tipo, inicio, usuario] : [tipo, inicio], 'avi:cuenta'))[0].n);
  const proyecto = (extra = {}) => ({ nichoId, anio: 2026, mes: 11, tiendaIds: [1], fechaInicio: '2026-11-02', fechaFin: '2026-11-27', articuloId: articulo, existenciaMuestras: 10, topePorAsesor: 100, ...extra });
  let proyectoId = null;
  let segundoId = null;

  try {
    console.log('Matriz de avisos (A8)');
    prueba('sin proyectos.administrar no se ve la matriz (403)', (await sup('GET', '/config/avisos')).status === 403);
    let r = await adm('GET', '/config/avisos');
    prueba('trae los eventos del módulo con sus roles y anticipaciones por defecto', r.status === 200 && r.datos.eventos.length === EVENTOS.length && r.datos.personalizada === false && r.datos.eventos.find(e => e.clave === 'proyecto_por_cerrar').anticipacion.valor === 3 && r.datos.eventos.find(e => e.clave === 'seguimiento_vence').anticipacion.valor === 0, JSON.stringify(r.datos).slice(0, 200));
    const reparto = r.datos.eventos.find(e => e.clave === 'reparto_recibido');
    prueba('«Reparto recibido» avisa al asesor y no aplica a los otros roles', reparto.roles.asesor.aplica && reparto.roles.asesor.activo && !reparto.roles.supervisor.aplica && !reparto.roles.gerente.aplica);
    r = await adm('PUT', '/config/avisos', { celdas: [{ evento: 'reparto_recibido', rol: 'gerente', activo: true }] });
    prueba('encender una celda que no aplica → 400', r.status === 400, JSON.stringify(r.datos));
    r = await adm('PUT', '/config/avisos', { anticipaciones: { proyecto_por_cerrar: 99 } });
    prueba('una anticipación fuera de rango → 400', r.status === 400 && !!r.datos.campos['anticipaciones.proyecto_por_cerrar']);
    r = await adm('PUT', '/config/avisos', { anticipaciones: { reparto_recibido: 2 } });
    prueba('una anticipación en un evento que no la tiene → 400', r.status === 400);
    r = await adm('PUT', '/config/avisos', { celdas: [{ evento: 'reasignada_recibe', rol: 'asesor', activo: false }], anticipaciones: { proyecto_por_cerrar: 1 } });
    prueba('apagar una celda y cambiar una anticipación se guarda', r.status === 200 && r.datos.cambio === true && r.datos.eventos.find(e => e.clave === 'reasignada_recibe').roles.asesor.activo === false && r.datos.eventos.find(e => e.clave === 'proyecto_por_cerrar').anticipacion.valor === 1 && r.datos.personalizada === true, JSON.stringify(r.datos).slice(0, 200));
    r = await adm('PUT', '/config/avisos', { celdas: [{ evento: 'reasignada_recibe', rol: 'asesor', activo: false }] });
    prueba('guardar lo mismo no cambia nada', r.status === 200 && r.datos.cambio === false);
    r = await adm('GET', '/config/historial?area=avisos');
    prueba('cada cambio queda en el historial (A10) con quién y antes/después', r.status === 200 && r.datos.items.length >= 2 && r.datos.items.every(i => i.area === 'Notificaciones') && r.datos.items.some(i => i.cambios.length && i.cambios[0].campo === 'Avisa'), JSON.stringify(r.datos.items.slice(0, 2)));

    console.log('Quién recibe cada aviso');
    const pruebaDirecta = await avisosService.notificar('reasignada_recibe', { proyectoId: null, autorId: null, explicitos: { asesor: [SUP] }, mensaje: 'prueba apagada' });
    prueba('una celda apagada no avisa a nadie', pruebaDirecta.length === 0);
    await adm('POST', '/config/avisos/restaurar');
    r = await adm('GET', '/config/avisos');
    prueba('restaurar vuelve a los valores por defecto', r.datos.personalizada === false && r.datos.eventos.find(e => e.clave === 'reasignada_recibe').roles.asesor.activo === true && r.datos.eventos.find(e => e.clave === 'proyecto_por_cerrar').anticipacion.valor === 3);
    const aSiMismo = await avisosService.notificar('reasignada_recibe', { autorId: SUP, explicitos: { asesor: [SUP] }, mensaje: 'a mí mismo' });
    prueba('nunca se avisa al autor de la acción', aSiMismo.length === 0);
    const doble = await avisosService.notificar('seguimiento_vencido', { explicitos: { asesor: [SUP], supervisor: [SUP] }, mensaje: 'doble' });
    prueba('quien cae en dos roles recibe un solo aviso', doble.length === 1);

    console.log('Reparto, aprobación y cierre avisan según la matriz');
    await configService.guardar({ 'reglas.aprobar_activacion': true }, admin);
    r = await sup('POST', '/proyectos', proyecto());
    proyectoId = r.datos.id;
    await sup('POST', `/proyectos/${proyectoId}/pedir-aprobacion`);
    prueba('pedir la activación avisa a gerencia (y no al supervisor que la pidió)', (await cuenta('activacion_pedida', gerente)) === 1 && (await cuenta('activacion_pedida', SUP)) === 0);
    r = await ger('POST', `/proyectos/${proyectoId}/aprobar`, { idempotencyKey: clave() });
    prueba('el gerente aprueba y activa el proyecto', r.status === 200 && r.datos.estado === 'activo');
    prueba('aprobar le avisa a quien pidió la activación', (await cuenta('activacion_resuelta', SUP)) === 1 && (await cuenta('activacion_resuelta', gerente)) === 0);
    const porAsesor = await db.query('SELECT asesor_id, COUNT(*) AS n FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NOT NULL GROUP BY asesor_id ORDER BY asesor_id', [proyectoId], 'avi:reparto');
    const avisosReparto = await db.query("SELECT usuario_id, mensaje FROM notificaciones WHERE modulo = 'proyectos' AND tipo = 'reparto_recibido' AND creado_en >= ?", [inicio], 'avi:avisos_reparto');
    prueba('al activar, cada asesor recibe un aviso con cuántas empresas le tocaron', avisosReparto.length === porAsesor.length && porAsesor.every(a => avisosReparto.some(v => v.usuario_id === a.asesor_id && v.mensaje.includes(`${a.n} ${Number(a.n) === 1 ? 'empresa' : 'empresas'}`))), JSON.stringify([avisosReparto.length, porAsesor.length]));
    await configService.guardar({ 'reglas.aprobar_activacion': false }, admin);

    const [A, B] = porAsesor.map(a => a.asesor_id);
    const empresas = async (u) => (await db.query('SELECT id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? ORDER BY id', [proyectoId, u], 'avi:empresas_asesor')).map(x => x.id);
    const [a1, a2, a3] = await empresas(A);
    const antesRecibe = await cuenta('reasignada_recibe');
    r = await sup('POST', `/proyectos/${proyectoId}/reasignar`, { empresaIds: [a1], aAsesorId: B, motivo: 'Prueba de avisos', idempotencyKey: clave() });
    prueba('reasignar avisa a quien recibe y a quien pierde', r.status === 200 && (await cuenta('reasignada_recibe', B)) >= 1 && (await cuenta('reasignada_pierde', A)) >= 1 && (await cuenta('reasignada_recibe')) === antesRecibe + 1);
    await configService.guardar({ 'reglas.confirmar_ventas': true }, admin);
    const antesVenta = await cuenta('venta_por_confirmar', SUP);
    r = await asesor('POST', `/participaciones/${a2}/ventas`, { monto: 500, referencia: 'OV-AVI-1', idempotencyKey: clave() }, A);
    prueba('una venta por confirmar le avisa al supervisor del proyecto', r.status === 201 && (await cuenta('venta_por_confirmar', SUP)) === antesVenta + 1);
    const venta = (await db.query("SELECT id FROM proy_ventas WHERE referencia = 'OV-AVI-1'", [], 'avi:venta'))[0].id;
    await sup('POST', `/ventas/${venta}/confirmar`, { idempotencyKey: clave() });
    prueba('confirmarla le avisa al asesor', (await cuenta('venta_revisada', A)) === 1);
    await configService.guardar({ 'reglas.confirmar_ventas': false }, admin);
    r = await sup('POST', `/proyectos/${proyectoId}/cerrar`, { conclusiones: 'Todo bien.', confirmado: true, idempotencyKey: clave() });
    prueba('cerrar avisa a gerencia que hay un visto bueno pendiente', r.status === 200 && (await cuenta('cierre_pendiente', gerente)) === 1 && (await cuenta('cierre_pendiente', SUP)) === 0);
    await ger('POST', `/proyectos/${proyectoId}/devolver`, { comentario: 'Falta detallar.', idempotencyKey: clave() });
    prueba('devolverlo le avisa al supervisor que cerró', (await cuenta('visto_bueno_resuelto', SUP)) === 1);
    await sup('POST', `/proyectos/${proyectoId}/reenviar`, { conclusiones: 'Detallado.', idempotencyKey: clave() });
    prueba('reenviarlo vuelve a avisar a gerencia', (await cuenta('cierre_pendiente', gerente)) === 2);
    await ger('POST', `/proyectos/${proyectoId}/visto-bueno`, { idempotencyKey: clave() });
    prueba('darlo le avisa al supervisor', (await cuenta('visto_bueno_resuelto', SUP)) === 2);

    console.log('Vigilante');
    r = await adm('POST', '/proyectos', proyecto({ mes: 12, fechaInicio: gt(-3), fechaFin: gt(2) }));
    segundoId = r.datos.id;
    r = await adm('POST', `/proyectos/${segundoId}/activar`, { idempotencyKey: clave() });
    prueba('un segundo proyecto se activa con la fecha de fin en dos días', r.status === 200 && r.datos.estado === 'activo', JSON.stringify(r.datos));
    const delSegundo = async (u) => (await db.query('SELECT id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id = ? ORDER BY id', [segundoId, u], 'avi:seg')).map(x => x.id);
    const asesores2 = (await db.query('SELECT DISTINCT asesor_id FROM proy_participaciones WHERE proyecto_id = ? AND asesor_id IS NOT NULL ORDER BY asesor_id', [segundoId], 'avi:asesores2')).map(x => x.asesor_id);
    const [s1, s2, s3] = await delSegundo(asesores2[0]);
    await db.query('UPDATE proy_participaciones SET proxima_gestion_en = ? WHERE id = ?', [`${gt(-1)} 10:00:00`, s1], 'avi:vencido');
    await db.query('UPDATE proy_participaciones SET proxima_gestion_en = ? WHERE id = ?', [`${gt(0)} 00:01:00`, s2], 'avi:vence');
    await db.query('UPDATE proy_participaciones SET proxima_gestion_en = ? WHERE id = ?', [`${gt(0)} 23:59:00`, s3], 'avi:mas_tarde');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND tipo = 'seguimiento_vencido'", [], 'avi:limpiar_previos'); // los de la prueba directa de arriba
    let v = await vigilante.revisar();
    prueba('la primera vuelta avisa del seguimiento vencido, del que vence ahora y del proyecto por cerrar', v && v.seguimientosVencidos === 1 && v.seguimientosPorVencer === 1 && v.porCerrar === 1 && v.vencidos === 0, JSON.stringify(v));
    prueba('el vencido avisa al asesor y al supervisor; el que vence, solo al asesor', (await cuenta('seguimiento_vencido', asesores2[0])) === 1 && (await cuenta('seguimiento_vencido', SUP)) === 1 && (await cuenta('seguimiento_vence', asesores2[0])) === 1 && (await cuenta('seguimiento_vence', SUP)) === 0);
    prueba('el proyecto por cerrar avisa al supervisor', (await cuenta('proyecto_por_cerrar', SUP)) === 1);
    v = await vigilante.revisar();
    prueba('la segunda vuelta no repite ningún aviso', v && v.seguimientosVencidos === 0 && v.seguimientosPorVencer === 0 && v.porCerrar === 0 && v.vencidos === 0 && (await cuenta('seguimiento_vencido')) === 2, JSON.stringify(v));
    await adm('PUT', '/config/avisos', { anticipaciones: { seguimiento_vence: 24 } });
    v = await vigilante.revisar();
    prueba('con más anticipación, el seguimiento de más tarde del día también avisa (una vez)', v && v.seguimientosPorVencer === 1 && (await cuenta('seguimiento_vence', asesores2[0])) === 2);
    await adm('POST', '/config/avisos/restaurar');
    await db.query("UPDATE proy_proyectos SET fecha_fin = ? WHERE id = ?", [gt(-30), segundoId], 'avi:proyecto_vencido');
    v = await vigilante.revisar();
    prueba('un proyecto pasado de fecha y de gracia avisa como vencido a supervisor y a gerencia', v && v.vencidos === 1 && (await cuenta('proyecto_vencido', SUP)) === 1 && (await cuenta('proyecto_vencido', gerente)) === 1, JSON.stringify(v));
    prueba('queda sellado en aviso_vencido_en', (await db.query('SELECT aviso_vencido_en FROM proy_proyectos WHERE id = ?', [segundoId], 'avi:sello'))[0].aviso_vencido_en !== null);
    v = await vigilante.revisar();
    prueba('no avisa dos veces del mismo vencimiento ni lo cierra solo', v && v.vencidos === 0 && (await cuenta('proyecto_vencido')) === 2 && (await db.query('SELECT estado FROM proy_proyectos WHERE id = ?', [segundoId], 'avi:estado'))[0].estado === 'activo');
    await adm('PUT', '/config/avisos', { celdas: [{ evento: 'seguimiento_vencido', rol: 'asesor', activo: false }, { evento: 'seguimiento_vencido', rol: 'supervisor', activo: false }] });
    await db.query('UPDATE proy_participaciones SET proxima_gestion_en = ? WHERE id = ?', [`${gt(-2)} 09:00:00`, s3], 'avi:otro_vencido');
    const antes = await cuenta('seguimiento_vencido');
    await vigilante.revisar();
    prueba('con la celda apagada el vigilante no avisa', (await cuenta('seguimiento_vencido')) === antes);
    void rSinRespuesta; void canal;
  } finally {
    // Limpieza, pase lo que pase: nada de esta prueba debe quedar en la base.
    for (const id of [proyectoId, segundoId].filter(Boolean)) {
      const part = '(SELECT id FROM proy_participaciones WHERE proyecto_id = ?)';
      for (const tabla of ['proy_gestiones', 'proy_entregas_muestra', 'proy_cotizaciones', 'proy_ventas', 'proy_reasignaciones']) {
        await db.query(`DELETE FROM ${tabla} WHERE participacion_id IN ${part}`, [id], `avi:limpiar_${tabla}`);
      }
    }
    await db.query('DELETE FROM proy_proyectos WHERE creado_en >= ? AND creado_por IN (?)', [inicio, [SUP, admin]], 'avi:limpiar_proyectos');
    await db.query("DELETE FROM proy_clientes WHERE nombre LIKE 'AVI %'", [], 'avi:limpiar_clientes');
    await db.query("DELETE FROM notificaciones WHERE modulo = 'proyectos' AND creado_en >= ?", [inicio], 'avi:limpiar_notificaciones');
    await db.query("DELETE FROM idempotency_keys WHERE (idempotency_key LIKE 'proy-%' OR idempotency_key LIKE 'vig:%') AND creado_en >= ?", [inicio], 'avi:limpiar_claves');
    if (!yaTenia) await db.query('DELETE FROM rol_permisos WHERE rol_id = ? AND permiso_id = ?', [rolGerente, permisoGerencia], 'avi:quitar_permiso');
    await db.query('DELETE FROM proy_avisos_config', [], 'avi:limpiar_celdas');
    await db.query('DELETE FROM proy_avisos_anticipacion', [], 'avi:limpiar_anticipaciones');
    await db.query('UPDATE proy_pais_config SET moneda_codigo = ?, referencia_obligatoria = ?, confirmacion_ventas = ? WHERE pais_id = ?', [paisAntes.moneda_codigo, paisAntes.referencia_obligatoria, paisAntes.confirmacion_ventas, paisGT], 'avi:restaurar_pais');
    await db.query('DELETE FROM parametros_sistema WHERE clave LIKE ?', ['proyectos.%'], 'avi:limpiar_ajustes');
    for (const { clave: c, valor } of ajustesAntes) await db.query('INSERT INTO parametros_sistema (clave, valor) VALUES (?, ?)', [c, valor], 'avi:restaurar_ajuste');
    await db.query('DELETE FROM proy_config_historial WHERE creado_en >= ?', [inicio], 'avi:limpiar_historial');
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
