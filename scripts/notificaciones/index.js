// Punto de entrada de `node --test scripts/notificaciones/`: carga todas las pruebas de la carpeta.
const fs = require('fs');

fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).forEach(f => require(`./${f}`));
