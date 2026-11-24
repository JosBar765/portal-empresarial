// src/modules/proyectos/repositories/plantillaRepository.js
// Plantillas de proyecto (`proy_plantillas`) y sus etapas (`proy_plantilla_etapas`). Todo el SQL de A4 vive aquí.
const db = require('../../../config/database');

// MySQL entrega la columna JSON ya convertida; MariaDB (producción) la entrega como texto.
const dato = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

const COLUMNAS = `p.id, p.nombre, p.descripcion, p.activa, p.predeterminada, p.duracion_semanas, p.articulo_id, a.nombre AS articulo,
  p.existencia_sugerida, p.tope_por_asesor, p.meta_monto, p.meta_moneda, p.controles`;

const aPlantilla = (f) => ({
  id: f.id, nombre: f.nombre, descripcion: f.descripcion, activa: Boolean(f.activa), predeterminada: Boolean(f.predeterminada),
  duracionSemanas: f.duracion_semanas, articuloId: f.articulo_id, articulo: f.articulo || null, existenciaSugerida: f.existencia_sugerida,
  topePorAsesor: f.tope_por_asesor, metaMonto: f.meta_monto === null || f.meta_monto === undefined ? null : Number(f.meta_monto),
  metaMoneda: f.meta_moneda, controles: f.controles ? dato(f.controles) : {}, etapas: []
});

class PlantillaRepository {
  async listar() {
    const filas = await db.query(`SELECT ${COLUMNAS} FROM proy_plantillas p LEFT JOIN proy_articulos a ON a.id = p.articulo_id ORDER BY p.predeterminada DESC, p.activa DESC, p.nombre`, [], 'proyectos_plantilla:listar');
    const etapas = await db.query('SELECT plantilla_id, orden, nombre, descripcion, duracion_dias_habiles FROM proy_plantilla_etapas ORDER BY plantilla_id, orden', [], 'proyectos_plantilla:etapas');
    return filas.map(f => ({ ...aPlantilla(f), etapas: etapas.filter(e => e.plantilla_id === f.id).map(e => ({ orden: e.orden, nombre: e.nombre, descripcion: e.descripcion, duracionDiasHabiles: e.duracion_dias_habiles })) }));
  }

  async obtener(id, ejecutor = db) {
    const filas = await ejecutor.query(`SELECT ${COLUMNAS} FROM proy_plantillas p LEFT JOIN proy_articulos a ON a.id = p.articulo_id WHERE p.id = ?`, [id], 'proyectos_plantilla:obtener');
    if (!filas[0]) return null;
    const etapas = await ejecutor.query('SELECT orden, nombre, descripcion, duracion_dias_habiles FROM proy_plantilla_etapas WHERE plantilla_id = ? ORDER BY orden', [id], 'proyectos_plantilla:etapas_de');
    return { ...aPlantilla(filas[0]), etapas: etapas.map(e => ({ orden: e.orden, nombre: e.nombre, descripcion: e.descripcion, duracionDiasHabiles: e.duracion_dias_habiles })) };
  }

  async nombreEnUso(nombre, exceptoId = 0, ejecutor = db) {
    const filas = await ejecutor.query('SELECT id FROM proy_plantillas WHERE nombre = ? AND id <> ?', [nombre, exceptoId], 'proyectos_plantilla:nombre');
    return filas.length > 0;
  }

  async insertar(tx, d) {
    const res = await tx.query(
      `INSERT INTO proy_plantillas (nombre, descripcion, activa, predeterminada, duracion_semanas, articulo_id, existencia_sugerida, tope_por_asesor, meta_monto, meta_moneda, controles)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.nombre, d.descripcion, d.activa ? 1 : 0, d.predeterminada ? 1 : 0, d.duracionSemanas, d.articuloId, d.existenciaSugerida, d.topePorAsesor, d.metaMonto, d.metaMoneda, JSON.stringify(d.controles)],
      'proyectos_plantilla:insertar'
    );
    return res.insertId;
  }

  actualizar(tx, id, d) {
    return tx.query(
      `UPDATE proy_plantillas SET nombre = ?, descripcion = ?, activa = ?, predeterminada = ?, duracion_semanas = ?, articulo_id = ?, existencia_sugerida = ?,
         tope_por_asesor = ?, meta_monto = ?, meta_moneda = ?, controles = ? WHERE id = ?`,
      [d.nombre, d.descripcion, d.activa ? 1 : 0, d.predeterminada ? 1 : 0, d.duracionSemanas, d.articuloId, d.existenciaSugerida, d.topePorAsesor, d.metaMonto, d.metaMoneda, JSON.stringify(d.controles), id],
      'proyectos_plantilla:actualizar'
    );
  }

  // Solo una plantilla es la predeterminada.
  quitarPredeterminadas(tx, exceptoId) {
    return tx.query('UPDATE proy_plantillas SET predeterminada = 0 WHERE id <> ?', [exceptoId], 'proyectos_plantilla:quitar_predeterminadas');
  }

  async reemplazarEtapas(tx, id, etapas) {
    await tx.query('DELETE FROM proy_plantilla_etapas WHERE plantilla_id = ?', [id], 'proyectos_plantilla:borrar_etapas');
    for (const [i, e] of etapas.entries()) {
      await tx.query('INSERT INTO proy_plantilla_etapas (plantilla_id, orden, nombre, descripcion, duracion_dias_habiles) VALUES (?, ?, ?, ?, ?)',
        [id, i + 1, e.nombre, e.descripcion || null, e.duracionDiasHabiles], 'proyectos_plantilla:insertar_etapa');
    }
  }
}

module.exports = new PlantillaRepository();
