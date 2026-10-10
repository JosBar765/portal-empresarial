// scripts/recalcular-vencimientos.js
// Recalcula los plazos que ya estaban guardados con la regla antigua de 24 h: a cada vale con plazo (en espera de
// autorización, solicitud de modificación o rechazado) y a cada taller con adjuntos rechazados le fija un plazo nuevo
// de N horas laborales contado desde el momento de ejecutar el script, y reinicia su aviso de «por vencer».
// Así ningún vale se elimina de golpe al desplegar. No toca vales sin plazo ni de otros estados.
//
// Uso:  node scripts/recalcular-vencimientos.js --dry-run   (solo muestra lo que cambiaría)
//       node scripts/recalcular-vencimientos.js             (aplica los cambios en una transacción)
// Ejecutarlo una vez al desplegar: cada ejecución vuelve a dar N horas completas desde ese momento.
const db = require('../src/config/database');
const calendarioService = require('../src/core/calendario/calendarioService');
const { ahoraUTC6 } = require('../src/core/calendario/calendarioLaboral');

const ESTADOS_CON_PLAZO = ['ESPERANDO_AUTORIZACION', 'SOLICITANDO_MODIFICACION', 'RECHAZADO'];

async function main() {
  const simulacro = process.argv.includes('--dry-run');
  await db.listo;
  const ahora = ahoraUTC6();
  const horas = await calendarioService.horasVencimiento();
  console.log(`${simulacro ? '[SIMULACRO] ' : ''}Plazo: ${horas} h laborales desde ${ahora.toISOString().slice(0, 19).replace('T', ' ')}`);

  const vales = await db.query(
    `SELECT v.id, v.correlativo, v.vigencia_hasta, v.talleres_solicitados
     FROM vales v JOIN estados_vale ev ON ev.id = v.estado_id
     WHERE v.vigencia_hasta IS NOT NULL AND ev.nombre IN (?)`,
    [ESTADOS_CON_PLAZO], 'recalcular:vales'
  );
  const filas = await db.query(
    `SELECT vt.id, vt.taller_id, vt.adjuntos_vence_en, v.correlativo
     FROM vale_talleres vt
     JOIN estados_taller et ON et.id = vt.estado_id
     JOIN vales v ON v.id = vt.vale_id
     WHERE vt.activo = 1 AND et.nombre = 'ADJUNTOS_RECHAZADOS' AND vt.adjuntos_vence_en IS NOT NULL`,
    [], 'recalcular:adjuntos'
  );

  const cambiosVales = [];
  for (const v of vales) {
    const nuevo = await calendarioService.vencimientoPlazo(calendarioService.idsDeCsv(v.talleres_solicitados), ahora);
    cambiosVales.push({ id: v.id, nuevo });
    console.log(`Vale ${v.correlativo}: ${v.vigencia_hasta} -> ${nuevo}`);
  }
  const cambiosFilas = [];
  for (const f of filas) {
    const nuevo = await calendarioService.vencimientoPlazo([f.taller_id], ahora);
    cambiosFilas.push({ id: f.id, nuevo });
    console.log(`Adjuntos de ${f.correlativo} (taller ${f.taller_id}): ${f.adjuntos_vence_en} -> ${nuevo}`);
  }
  console.log(`${cambiosVales.length} vale(s) y ${cambiosFilas.length} taller(es) con adjuntos rechazados.`);

  if (!simulacro) {
    await db.transaccion(async (tx) => {
      for (const c of cambiosVales) {
        await tx.query('UPDATE vales SET vigencia_hasta = ?, vigencia_aviso_en = NULL WHERE id = ?', [c.nuevo, c.id], 'recalcular:vale');
      }
      for (const c of cambiosFilas) {
        await tx.query('UPDATE vale_talleres SET adjuntos_vence_en = ?, adjuntos_aviso_en = NULL WHERE id = ?', [c.nuevo, c.id], 'recalcular:adjuntos_fila');
      }
    });
    console.log('Plazos recalculados.');
  } else {
    console.log('Simulacro: no se cambió nada.');
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('Error recalculando vencimientos:', error.message);
  process.exit(1);
});
