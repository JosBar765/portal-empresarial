// scripts/proyectos/verificar-aprobadores.js
// Verifica que quién aprueba la activación y quién da el visto bueno se asigna por persona (no por rol): solo las personas de la
// lista tienen esos permisos en la sesión, el rol ya no los da, solo el administrador cambia la lista, cada cambio queda en el
// historial, los avisos llegan a esas personas y quien no es candidato no se puede asignar.
//
// Uso (base DESECHABLE con las migraciones aplicadas; devuelve la lista como estaba al terminar):
//   node scripts/proyectos/verificar-aprobadores.js
const express = require('express');
const db = require('../../src/config/database');
const { requirePermission } = require('../../src/core/permissions/permissionMiddleware');
const rutas = require('../../src/modules/proyectos/routes');
const aprobadorService = require('../../src/modules/proyectos/services/aprobadorService');
const avisosService = require('../../src/modules/proyectos/services/avisosService');

let buenas = 0;
let malas = 0;
const prueba = (nombre, condicion, detalle = '') => {
  condicion ? buenas++ : malas++;
  console.log(`  ${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${detalle}`}`);
};

const ADMIN = ['proyectos.ver', 'proyectos.administrar'];
// Un rol que todavía trae los permisos viejos asignados: ya no deben valer.
const ROL_VIEJO = ['proyectos.ver', 'proyectos.ver_gerencia', 'proyectos.dar_visto_bueno', 'proyectos.aprobar_activacion'];

async function verificar() {
  const app = express();
  app.use(express.json());
  app.use((req, res, siguiente) => {
    req.user = { id: Number(req.headers['x-usuario']), nombre: 'Prueba', permissions: (req.headers['x-permisos'] || '').split(',').filter(Boolean) };
    siguiente();
  });
  app.use('/api/proyectos', requirePermission('proyectos.ver'), rutas);
  const servidor = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/proyectos`;
  const llamar = async (metodo, ruta, usuario, permisos, cuerpo) => {
    const res = await fetch(base + ruta, { method: metodo, headers: { 'x-usuario': String(usuario), 'x-permisos': permisos.join(','), 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return { estado: res.status, cuerpo: await res.json().catch(() => ({})) };
  };

  const [{ id: admin }] = await db.query('SELECT id FROM usuarios WHERE rol_id = 1 AND activo = 1 ORDER BY id LIMIT 1', [], 'apr:admin');
  const personas = await db.query("SELECT u.id FROM usuarios u WHERE u.activo = 1 AND u.id <> ? AND u.rol_id IN (2, 3, 8) ORDER BY u.id LIMIT 2", [admin], 'apr:personas');
  const [ana, luis] = personas.map(p => p.id);
  const original = await db.query('SELECT usuario_id, paso, creado_por FROM proy_aprobadores', [], 'apr:original');
  await db.query('DELETE FROM proy_aprobadores', [], 'apr:limpiar');
  const [{ id: sinAcceso }] = await db.query("SELECT u.id FROM usuarios u WHERE u.activo = 1 AND NOT EXISTS (SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = u.rol_id AND p.codigo = 'proyectos.ver') ORDER BY u.id LIMIT 1", [], 'apr:sinacceso');

  try {
    console.log('Sin nadie asignado, el rol ya no da los permisos');
    let r = await llamar('GET', '/yo', ana, ROL_VIEJO);
    prueba('aunque el rol traiga los permisos viejos, la sesión no los tiene', !r.cuerpo.permisos.includes('proyectos.dar_visto_bueno') && !r.cuerpo.permisos.includes('proyectos.aprobar_activacion'), JSON.stringify(r.cuerpo));
    prueba('lo demás del rol se conserva', r.cuerpo.permisos.includes('proyectos.ver_gerencia'));
    r = await llamar('POST', '/proyectos/1/aprobar', ana, ROL_VIEJO, {});
    prueba('aprobar una activación → 403 si no está en la lista', r.estado === 403, String(r.estado));
    r = await llamar('POST', '/proyectos/1/visto-bueno', ana, ROL_VIEJO, {});
    prueba('dar el visto bueno → 403 si no está en la lista', r.estado === 403, String(r.estado));

    console.log('Quién puede cambiar la lista');
    r = await llamar('GET', '/config/aprobadores', ana, ROL_VIEJO);
    prueba('solo el administrador la ve (los demás reciben 403)', r.estado === 403, String(r.estado));
    r = await llamar('PUT', '/config/aprobadores', ana, ['proyectos.ver', 'proyectos.configurar'], { activacion: [ana] });
    prueba('quien solo configura no puede cambiarla → 403', r.estado === 403, String(r.estado));
    r = await llamar('GET', '/config/aprobadores', admin, ADMIN);
    prueba('el administrador la ve vacía y con candidatos', r.estado === 200 && r.cuerpo.activacion.length === 0 && r.cuerpo.vistoBueno.length === 0 && r.cuerpo.candidatos.length > 0, JSON.stringify(r.cuerpo).slice(0, 200));

    console.log('Asignar por persona');
    r = await llamar('PUT', '/config/aprobadores', admin, ADMIN, { activacion: [ana], vistoBueno: [ana, luis] });
    prueba('el administrador asigna a Ana (ambos pasos) y a Luis (visto bueno)', r.estado === 200 && r.cuerpo.activacion.length === 1 && r.cuerpo.vistoBueno.length === 2, JSON.stringify(r.cuerpo).slice(0, 200));
    r = await llamar('GET', '/yo', ana, ['proyectos.ver']);
    prueba('Ana tiene los dos permisos aunque su rol no los traiga', r.cuerpo.permisos.includes('proyectos.aprobar_activacion') && r.cuerpo.permisos.includes('proyectos.dar_visto_bueno'));
    r = await llamar('GET', '/yo', luis, ['proyectos.ver']);
    prueba('Luis solo tiene el visto bueno', !r.cuerpo.permisos.includes('proyectos.aprobar_activacion') && r.cuerpo.permisos.includes('proyectos.dar_visto_bueno'));
    r = await llamar('PUT', '/config/aprobadores', admin, ADMIN, { activacion: [sinAcceso] });
    prueba('alguien sin acceso a Proyectos no se puede asignar → 400', r.estado === 400 || r.estado === 422, String(r.estado));
    r = await llamar('PUT', '/config/aprobadores', admin, ADMIN, { activacion: 'no' });
    prueba('una lista mal formada se rechaza', r.estado === 400 || r.estado === 422, String(r.estado));

    console.log('Avisos y historial');
    const tipos = await db.query('SELECT COUNT(*) AS n FROM notificaciones', [], 'apr:contar');
    prueba('las dos aprobaciones se avisan a las personas de su paso', JSON.stringify(await aprobadorService.idsDe('activacion')) === JSON.stringify([ana]) && (await aprobadorService.idsDe('visto_bueno')).sort().join() === [ana, luis].sort().join());
    const avisados = await avisosService.notificar('activacion_pedida', { proyectoId: null, autorId: null, mensaje: 'Prueba de aprobador', referenciaTipo: 'proyecto', referenciaId: 1 });
    prueba('«Activación pedida» llega solo a quien aprueba la activación', avisados.length === 1 && avisados[0] === ana, JSON.stringify(avisados));
    const cierre = await avisosService.notificar('cierre_pendiente', { proyectoId: null, autorId: null, mensaje: 'Prueba de cierre', referenciaTipo: 'proyecto', referenciaId: 1 });
    prueba('«Cierre pendiente» llega a quien da el visto bueno', cierre.length === 2 && cierre.includes(ana) && cierre.includes(luis), JSON.stringify(cierre));
    await db.query("DELETE FROM notificaciones WHERE mensaje IN ('Prueba de aprobador', 'Prueba de cierre')", [], 'apr:limpiarAvisos');
    r = await llamar('GET', '/config/historial?area=aprobadores', admin, ADMIN);
    prueba('los cambios quedaron en el historial, con el nombre de las personas', r.estado === 200 && r.cuerpo.items.length >= 2 && JSON.stringify(r.cuerpo.items[0].cambios).includes('Personas'), JSON.stringify(r.cuerpo).slice(0, 220));

    console.log('Quitar');
    r = await llamar('PUT', '/config/aprobadores', admin, ADMIN, { vistoBueno: [luis] });
    prueba('quitar a Ana del visto bueno la deja solo como aprobadora de activación', r.estado === 200 && r.cuerpo.vistoBueno.length === 1 && r.cuerpo.activacion.length === 1);
    r = await llamar('GET', '/yo', ana, ['proyectos.ver']);
    prueba('al instante Ana ya no puede dar el visto bueno', !r.cuerpo.permisos.includes('proyectos.dar_visto_bueno') && r.cuerpo.permisos.includes('proyectos.aprobar_activacion'));
    void tipos;
  } finally {
    await db.query('DELETE FROM proy_aprobadores', [], 'apr:restaurar0');
    for (const f of original) await db.query('INSERT INTO proy_aprobadores (usuario_id, paso, creado_por) VALUES (?, ?, ?)', [f.usuario_id, f.paso, f.creado_por], 'apr:restaurar');
    servidor.close();
  }
}

verificar()
  .then(() => { console.log(`\n${buenas} OK, ${malas} fallas`); process.exit(malas ? 1 : 0); })
  .catch((error) => { console.error('Error inesperado:', error); process.exit(1); });
