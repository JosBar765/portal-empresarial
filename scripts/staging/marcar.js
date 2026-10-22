// Pone la marca entorno = 'staging' en la base DESTINO. Se ejecuta una vez desde el PC del dueño; nunca escribe en ORIGEN.
const { leerArgumentos, cargarConfig, describir, exigirDestinoNoProduccion } = require('./lib/config');
const { conectar, cerrar } = require('./lib/conexiones');
const { confirmarNombre } = require('./lib/confirmacion');
const marca = require('./lib/marca');

const log = mensaje => console.log(`[Marca] ${mensaje}`);

(async () => {
  const args = leerArgumentos(process.argv.slice(2));
  const { destino: cfg } = cargarConfig(args.archivo, ['DESTINO']);
  exigirDestinoNoProduccion(cfg);

  let conn = null;
  let codigo = 0;
  try {
    conn = await conectar(cfg);
    const consultar = marca.consultaDe(conn);
    log(`DESTINO: ${describir(cfg)}`);
    log(`Contenido actual: ${marca.textoResumen(await marca.resumenBase(consultar, cfg.db))}`);
    if (!(await marca.tablaExiste(consultar, cfg.db))) {
      throw new Error('La base no tiene la tabla parametros_sistema: no es una base del portal (o falta importar database/migrations). No se escribió nada.');
    }
    log(`Marca actual: ${(await marca.leerMarca(consultar)) || 'sin marca'}`);

    await confirmarNombre(args, cfg);
    await marca.escribirMarca(consultar);
    log(`Listo: ${cfg.db} quedó marcada como entorno = ${await marca.leerMarca(consultar)}.`);
  } catch (error) {
    console.error(`[Marca] ERROR: ${error.sqlMessage || error.message}`);
    codigo = 1;
  } finally {
    await cerrar(conn);
  }
  process.exit(codigo);
})().catch(error => {
  console.error(`[Marca] ERROR: ${error.message}`);
  process.exit(1);
});
