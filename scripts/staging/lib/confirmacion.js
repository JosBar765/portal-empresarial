// Confirmación escrita: el operador teclea el nombre exacto de la base (o lo pasa con --confirmar).
const readline = require('readline');

function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(texto, r => { rl.close(); resolve(r.trim()); }));
}

async function confirmarNombre(args, destino) {
  const escrito = args.confirmar !== null
    ? args.confirmar
    : await preguntar(`Escribe el nombre exacto de la base DESTINO (${destino.db}) para continuar: `);
  if (escrito !== destino.db) throw new Error(`La confirmación «${escrito}» no coincide con la base DESTINO «${destino.db}». No se tocó nada.`);
}

module.exports = { confirmarNombre, preguntar };
