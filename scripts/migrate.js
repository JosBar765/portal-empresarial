// Aplica (o, con --estado, solo lista) las migraciones sobre la base configurada en el .env.
const config = require('../src/config/env');
const migraciones = require('../src/core/migrations/ejecutor');

const soloEstado = process.argv.includes('--estado');

(async () => {
  const { host, port, database } = config.db;
  console.log(`[Migraciones] Base de datos: ${database} en ${host}:${port} (NODE_ENV=${config.nodeEnv})`);

  if (soloEstado) {
    const { aplicadas, pendientes, modificadas } = await migraciones.estado({ conexion: config.db });
    console.log(`Aplicadas (${aplicadas.length}): ${aplicadas.join(', ') || 'ninguna'}`);
    console.log(`Pendientes (${pendientes.length}): ${pendientes.join(', ') || 'ninguna'}`);
    console.log(`Modificadas tras aplicarse (${modificadas.length}): ${modificadas.join(', ') || 'ninguna'}`);
  } else {
    await migraciones.ejecutar({ conexion: config.db });
  }
  process.exit(0);
})().catch(error => {
  console.error(`[Migraciones] ERROR: ${error.message}`);
  process.exit(1);
});
