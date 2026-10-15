// Verifica contra la BD local que los reportes rotulen «· Asistente» a los asistentes de CUALQUIER taller y «· Encargado» a los encargados.
// Usa los dos orígenes de datos de los reportes (listarNombres y listarDisenadores). Sale con 1 si algo falla.
const db = require('../../src/config/database');
const reporteRepository = require('../../src/modules/vales/repositories/reporteRepository');
const grupos = require('../../src/modules/vales/services/valeReporteGruposService');

let fallos = 0;
const comprobar = (nombre, cond, detalle = '') => { console.log(`${cond ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ' -> ' + detalle : ''}`); if (!cond) fallos++; };

(async () => {
  await db.listo;
  const esperado = await db.query(
    `SELECT u.id, u.nombre, r.hereda_de_rol_id AS hereda, u.rol_id
     FROM usuarios u JOIN roles r ON r.id = u.rol_id
     WHERE u.activo = 1 AND (r.hereda_de_rol_id IS NOT NULL OR u.rol_id IN (4, 5, 9, 10))
     ORDER BY u.id LIMIT 12`, [], 'prueba');
  if (!esperado.some((u) => u.hereda != null)) throw new Error('la BD local no tiene asistentes: la prueba no prueba nada');
  const ids = esperado.map((u) => u.id);

  const viaNombres = new Map((await reporteRepository.listarNombres(ids)).map((u) => [u.id, grupos.etiquetaNombre(u.nombre, u.rol_id, u.hereda_de_rol_id)]));
  const viaDisenadores = new Map((await reporteRepository.listarDisenadores()).map((u) => [u.id, grupos.etiquetaNombre(u.nombre, u.rol_id, u.hereda_de_rol_id)]));

  for (const u of esperado) {
    const sufijo = u.hereda != null ? ' · Asistente' : ' · Encargado';
    comprobar(`listarNombres: ${u.nombre} (rol ${u.rol_id}${u.hereda != null ? ', hereda ' + u.hereda : ''})`, (viaNombres.get(u.id) || '').endsWith(sufijo), viaNombres.get(u.id));
    if (viaDisenadores.has(u.id)) comprobar(`listarDisenadores: ${u.nombre}`, viaDisenadores.get(u.id).endsWith(sufijo), viaDisenadores.get(u.id));
  }
  const [dis] = await db.query("SELECT u.id, u.nombre, u.rol_id, r.hereda_de_rol_id AS hereda FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.rol_id = 6 AND u.activo = 1 LIMIT 1", [], 'prueba');
  const etDis = grupos.etiquetaNombre(dis.nombre, dis.rol_id, dis.hereda);
  comprobar('un Diseñador (rol 6) queda sin etiqueta', etDis === dis.nombre, etDis);
  console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo OK');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
