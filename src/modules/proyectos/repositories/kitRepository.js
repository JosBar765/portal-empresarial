// src/modules/proyectos/repositories/kitRepository.js
// Kit del nicho: guion de llamada y mensajes por nicho. Todo el SQL vive aquí. Las tablas vienen de la migración de configuración;
// el canal de cada mensaje es una fila del catálogo `proy_canales`: aquí solo se usan «WhatsApp» y «Correo».
const db = require('../../../config/database');

class KitRepository {
  // Todos los nichos activos con lo que tiene su kit (para la lista de A9).
  nichos() {
    return db.query(
      `SELECT n.id, n.nombre, k.id AS kit_id, k.activo AS kit_activo, (k.guion IS NOT NULL AND k.guion <> '') AS tiene_guion,
              (SELECT COUNT(*) FROM proy_kit_mensajes m WHERE m.kit_id = k.id AND m.activo = 1) AS mensajes
       FROM proy_nichos n LEFT JOIN proy_kits k ON k.nicho_id = n.id WHERE n.activo = 1 ORDER BY n.nombre`,
      [], 'proyectos_kit:nichos'
    );
  }

  async nicho(id, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, nombre, activo FROM proy_nichos WHERE id = ?', [id], 'proyectos_kit:nicho');
    return filas[0] || null;
  }

  async kitDelNicho(nichoId, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id, nicho_id, guion, activo FROM proy_kits WHERE nicho_id = ?', [nichoId], 'proyectos_kit:kit');
    return filas[0] || null;
  }

  // Los mensajes con su canal como `whatsapp` o `correo`; un mensaje de otro canal del catálogo no se usa.
  mensajes(kitId, ejecutor = db) {
    return ejecutor.query(
      `SELECT m.id, CASE c.nombre WHEN 'WhatsApp' THEN 'whatsapp' WHEN 'Correo' THEN 'correo' END AS canal, m.titulo, m.texto, m.activo, m.orden
       FROM proy_kit_mensajes m JOIN proy_canales c ON c.id = m.canal_id WHERE m.kit_id = ? AND c.nombre IN ('WhatsApp', 'Correo') ORDER BY m.orden, m.id`,
      [kitId], 'proyectos_kit:mensajes'
    );
  }

  // Los ids del catálogo de canales para WhatsApp y correo; falta alguno si alguien renombró o quitó el canal.
  async canales(ejecutor = db) {
    const filas = await ejecutor.query("SELECT id, nombre FROM proy_canales WHERE nombre IN ('WhatsApp', 'Correo')", [], 'proyectos_kit:canales');
    return { whatsapp: (filas.find(f => f.nombre === 'WhatsApp') || {}).id || null, correo: (filas.find(f => f.nombre === 'Correo') || {}).id || null };
  }

  // Crea el kit del nicho si no existe y devuelve su id (el índice único evita duplicados si dos personas guardan a la vez).
  async asegurarKit(tx, nichoId) {
    await tx.query('INSERT IGNORE INTO proy_kits (nicho_id) VALUES (?)', [nichoId], 'proyectos_kit:asegurar');
    const filas = await tx.query('SELECT id FROM proy_kits WHERE nicho_id = ? FOR UPDATE', [nichoId], 'proyectos_kit:bloquear');
    return filas[0].id;
  }

  actualizarKit(tx, kitId, { guion, activo }) {
    return tx.query('UPDATE proy_kits SET guion = ?, activo = ? WHERE id = ?', [guion, activo ? 1 : 0, kitId], 'proyectos_kit:actualizar');
  }

  // Reemplaza los mensajes del kit por la lista recibida (la pantalla guarda el kit completo).
  async reemplazarMensajes(tx, kitId, mensajes, canales) {
    await tx.query('DELETE FROM proy_kit_mensajes WHERE kit_id = ?', [kitId], 'proyectos_kit:borrar_mensajes');
    if (mensajes.length) {
      await tx.query('INSERT INTO proy_kit_mensajes (kit_id, canal_id, titulo, texto, activo, orden) VALUES ?',
        [mensajes.map((m, i) => [kitId, canales[m.canal], m.titulo, m.texto, m.activo ? 1 : 0, i + 1])], 'proyectos_kit:insertar_mensajes');
    }
  }
}

module.exports = new KitRepository();
