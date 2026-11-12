// src/modules/proyectos/repositories/clienteRepository.js
// Empresas de la base global (`proy_clientes`), sus contactos y el historial de cambios de estado. Todo el SQL del
// módulo de empresas vive aquí. Las consultas que lee una persona filtran siempre por los países de su alcance.
const db = require('../../../config/database');

const COLUMNAS_LISTA = `c.id, c.datos_extra, c.nombre, c.nicho_id, n.nombre AS nicho, c.pais_id, p.nombre AS pais, c.ciudad, c.telefono,
  c.estructura_id, es.nombre AS estructura, c.estado,
  EXISTS (SELECT 1 FROM proy_participaciones pa WHERE pa.cliente_id = c.id AND pa.abierta = 1) AS en_proyecto,
  (SELECT COUNT(*) FROM proy_contactos ct WHERE ct.cliente_id = c.id AND ct.activo = 1) AS contactos`;

const DESDE_LISTA = `FROM proy_clientes c
  JOIN proy_nichos n ON n.id = c.nicho_id
  JOIN paises p ON p.id = c.pais_id
  JOIN proy_estructuras es ON es.id = c.estructura_id`;

const escaparLike = (texto) => String(texto).replace(/[\\%_]/g, '\\$&');

// Arma el WHERE del listado: alcance + búsqueda por nombre o teléfono + filtros. Nada del texto entra al SQL sin `?`.
function filtros({ paisIds, busqueda, nichoId, paisId, estado, extras = [] }) {
  const donde = [];
  const params = [];
  donde.push('c.pais_id IN (?)');
  params.push(paisIds.length ? paisIds : [0]);
  if (paisId) { donde.push('c.pais_id = ?'); params.push(paisId); }
  if (nichoId) { donde.push('c.nicho_id = ?'); params.push(nichoId); }
  if (estado) { donde.push('c.estado = ?'); params.push(estado); }
  // Campo propio: la clave solo lleva a-z, 0-9 y _ (la valida camposPropios) y viaja como parámetro; sí/no se guarda como true/false.
  for (const { clave, valor } of extras) {
    donde.push('JSON_UNQUOTE(JSON_EXTRACT(c.datos_extra, ?)) = ?');
    params.push(`$."${clave}"`, valor);
  }
  if (busqueda) {
    const digitos = busqueda.replace(/\D/g, '');
    const piezas = ['c.nombre LIKE ?'];
    params.push(`%${escaparLike(busqueda)}%`);
    if (digitos.length >= 3) { piezas.push('c.telefono LIKE ?'); params.push(`%${digitos}%`); }
    donde.push(`(${piezas.join(' OR ')})`);
  }
  return { donde: donde.join(' AND '), params };
}

class ClienteRepository {
  async listar(consulta, limite, desplazamiento) {
    const { donde, params } = filtros(consulta);
    const [filas, total] = await Promise.all([
      db.query(`SELECT ${COLUMNAS_LISTA} ${DESDE_LISTA} WHERE ${donde} ORDER BY c.nombre, c.id LIMIT ? OFFSET ?`,
        [...params, limite, desplazamiento], 'proyectos_clientes:listar'),
      db.query(`SELECT COUNT(*) AS n FROM proy_clientes c WHERE ${donde}`, params, 'proyectos_clientes:contar')
    ]);
    return { filas, total: Number(total[0].n) };
  }

  // Una empresa dentro del alcance; `null` si no existe o es de un país que la persona no ve.
  async obtener(id, paisIds, ejecutor = db) {
    const filas = await ejecutor.query(
      `SELECT ${COLUMNAS_LISTA}, c.direccion, c.sitio_web, c.origen, c.tienda_origen_id, c.creado_en, c.actualizado_en,
              u.nombre AS creado_por_nombre, t.codigo AS tienda_origen
       ${DESDE_LISTA}
       JOIN usuarios u ON u.id = c.creado_por
       LEFT JOIN tiendas t ON t.id = c.tienda_origen_id
       WHERE c.id = ? AND c.pais_id IN (?)`,
      [id, paisIds.length ? paisIds : [0]], 'proyectos_clientes:obtener'
    );
    return filas[0] || null;
  }

  // Posibles duplicados: del mismo país con una palabra en común con el nombre, o con el mismo teléfono.
  // El servicio decide cuáles se parecen de verdad (`duplicados.js`).
  candidatosDeDuplicado({ paisIds, paisId, palabra, telefono, excluirId }) {
    const condiciones = [];
    const params = [];
    if (palabra) { condiciones.push('(c.pais_id = ? AND c.nombre_normalizado LIKE ?)'); params.push(paisId, `%${escaparLike(palabra)}%`); }
    if (telefono) { condiciones.push('c.telefono = ?'); params.push(telefono); }
    if (!condiciones.length) return Promise.resolve([]);
    return db.query(
      `SELECT c.id, c.nombre, c.nombre_normalizado, c.ciudad, c.telefono, c.pais_id, c.estado, p.nombre AS pais, n.nombre AS nicho
       FROM proy_clientes c JOIN paises p ON p.id = c.pais_id JOIN proy_nichos n ON n.id = c.nicho_id
       WHERE c.pais_id IN (?) AND (${condiciones.join(' OR ')}) ${excluirId ? 'AND c.id <> ?' : ''}
       ORDER BY c.nombre LIMIT 200`,
      [paisIds.length ? paisIds : [0], ...params, ...(excluirId ? [excluirId] : [])], 'proyectos_clientes:candidatos'
    );
  }

  async insertar(tx, d) {
    const res = await tx.query(
      `INSERT INTO proy_clientes (nombre, nombre_normalizado, nicho_id, pais_id, ciudad, direccion, sitio_web, telefono,
         datos_extra, estructura_id, estado, origen, tienda_origen_id, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?, ?, ?)`,
      [d.nombre, d.nombreNormalizado, d.nichoId, d.paisId, d.ciudad, d.direccion, d.sitioWeb, d.telefono,
        d.datosExtra ? JSON.stringify(d.datosExtra) : null, d.estructuraId, d.origen || 'asesor', d.tiendaOrigenId, d.creadoPor],
      'proyectos_clientes:insertar'
    );
    return res.insertId;
  }

  // `cambios`: { columna: valor } con columnas de una lista fija (nunca de la petición).
  async actualizar(tx, id, cambios) {
    const columnas = Object.keys(cambios);
    if (!columnas.length) return;
    await tx.query(
      `UPDATE proy_clientes SET ${columnas.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
      [...columnas.map(c => cambios[c]), id], 'proyectos_clientes:actualizar'
    );
  }

  async cambiarEstado(tx, id, estado) {
    await tx.query('UPDATE proy_clientes SET estado = ? WHERE id = ?', [estado, id], 'proyectos_clientes:estado');
  }

  registrarEvento(tx, { clienteId, usuarioId, accion, estadoAnterior, estadoNuevo, motivo, nota }) {
    return tx.query(
      `INSERT INTO proy_cliente_eventos (cliente_id, usuario_id, accion, estado_anterior, estado_nuevo, motivo, nota)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clienteId, usuarioId, accion, estadoAnterior, estadoNuevo, motivo || null, nota || null], 'proyectos_clientes:evento'
    );
  }

  listarEventos(clienteId) {
    return db.query(
      `SELECT e.id, e.accion, e.estado_anterior, e.estado_nuevo, e.motivo, e.nota, e.creado_en, u.nombre AS usuario
       FROM proy_cliente_eventos e JOIN usuarios u ON u.id = e.usuario_id WHERE e.cliente_id = ? ORDER BY e.id DESC LIMIT 50`,
      [clienteId], 'proyectos_clientes:eventos'
    );
  }

  // --- Contactos ---

  listarContactos(clienteId, ejecutor = db) {
    return ejecutor.query(
      `SELECT ct.id, ct.cliente_id, ct.area_id, a.nombre AS area, ct.nombre, ct.cargo, ct.telefono, ct.correo, ct.principal, ct.activo
       FROM proy_contactos ct JOIN proy_areas_contacto a ON a.id = ct.area_id
       WHERE ct.cliente_id = ? ORDER BY ct.activo DESC, ct.principal DESC, a.orden, ct.nombre`,
      [clienteId], 'proyectos_clientes:contactos'
    );
  }

  async obtenerContacto(id, ejecutor = db) {
    const filas = await ejecutor.query(
      'SELECT id, cliente_id, area_id, nombre, cargo, telefono, correo, principal, activo FROM proy_contactos WHERE id = ?',
      [id], 'proyectos_clientes:contacto'
    );
    return filas[0] || null;
  }

  async insertarContacto(tx, d) {
    const res = await tx.query(
      `INSERT INTO proy_contactos (cliente_id, area_id, nombre, cargo, telefono, correo, principal, activo, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [d.clienteId, d.areaId, d.nombre, d.cargo, d.telefono, d.correo, d.principal ? 1 : 0, d.creadoPor], 'proyectos_clientes:insertar_contacto'
    );
    return res.insertId;
  }

  actualizarContacto(tx, id, d) {
    return tx.query(
      'UPDATE proy_contactos SET area_id = ?, nombre = ?, cargo = ?, telefono = ?, correo = ?, principal = ? WHERE id = ?',
      [d.areaId, d.nombre, d.cargo, d.telefono, d.correo, d.principal ? 1 : 0, id], 'proyectos_clientes:actualizar_contacto'
    );
  }

  cambiarActivoContacto(tx, id, activo) {
    // Un contacto inactivo deja de ser el principal.
    return tx.query('UPDATE proy_contactos SET activo = ?, principal = IF(? = 1, principal, 0) WHERE id = ?', [activo ? 1 : 0, activo ? 1 : 0, id], 'proyectos_clientes:activo_contacto');
  }

  quitarPrincipales(tx, clienteId, excepto = 0) {
    return tx.query('UPDATE proy_contactos SET principal = 0 WHERE cliente_id = ? AND id <> ?', [clienteId, excepto], 'proyectos_clientes:quitar_principales');
  }

  async contarContactosActivos(clienteId, ejecutor = db) {
    const filas = await ejecutor.query('SELECT COUNT(*) AS n FROM proy_contactos WHERE cliente_id = ? AND activo = 1', [clienteId], 'proyectos_clientes:contar_contactos');
    return Number(filas[0].n);
  }

  // Bloquea la empresa y devuelve los datos que la importación puede completar.
  async bloquearParaCompletar(tx, clienteId) {
    const filas = await tx.query('SELECT id, ciudad, direccion, sitio_web, telefono, datos_extra FROM proy_clientes WHERE id = ? FOR UPDATE', [clienteId], 'proyectos_importacion:existente');
    return filas[0] || null;
  }

  async registrarImportacion(tx, d) {
    await tx.query(
      'INSERT INTO proy_importaciones (usuario_id, archivo, filas, creadas, actualizadas, duplicadas, con_error) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [d.usuarioId, d.archivo, d.filas, d.creadas, d.actualizadas, d.duplicadas, d.conError], 'proyectos_importacion:registrar');
  }
}

module.exports = new ClienteRepository();
