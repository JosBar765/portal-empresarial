// Prueba sin BD ni DOM del valor múltiple del filtro de tiendas (public/js/filtroCascada.js). Sale con 1 si algo no coincide.
const { pathToFileURL } = require('url');
const path = require('path');

(async () => {
  // El módulo del front es ES; se carga con import() para no cambiar el tipo del paquete.
  const { resolverTiendaIds, paramsDeTienda, valorVigente } = await import(pathToFileURL(path.join(__dirname, '../../public/js/filtroCascada.js')).href);
  const tiendas = [
    { id: 3, pais_nombre: 'Guatemala' },
    { id: 7, pais_nombre: 'Guatemala', departamento_nombre: 'Ventas Trofex Ruta 1' },
    { id: 9, pais_nombre: 'Honduras' }
  ];
  const json = (x) => JSON.stringify(x);
  const casos = [
    ['lista resuelve a ids', json(resolverTiendaIds('3,7,9', tiendas)), '[3,7,9]'],
    ['lista descarta ids que ya no existen', json(resolverTiendaIds('3,99,9', tiendas)), '[3,9]'],
    ['lista descarta basura y repetidos', json(resolverTiendaIds('3,x,3,-1', tiendas)), '[3]'],
    ['id suelto sigue valiendo', json(resolverTiendaIds('5', tiendas)), '[5]'],
    ['país sigue valiendo', json(resolverTiendaIds('pais:Guatemala', tiendas)), '[3,7]'],
    ['grupo sigue valiendo', json(resolverTiendaIds('grupo:Ventas Trofex Ruta 1', tiendas)), '[7]'],
    ['params de lista', json(paramsDeTienda('3,7,9', tiendas)), '{"tiendaIds":"3,7,9"}'],
    ['params de id suelto', json(paramsDeTienda('3', tiendas)), '{"tiendaId":3}'],
    ['params de país', json(paramsDeTienda('pais:Honduras', tiendas)), '{"tiendaIds":"9"}'],
    ['params vacíos', json(paramsDeTienda('', tiendas)), '{}'],
    ['vigente limpia ids viejos', valorVigente('3,99,9', v => resolverTiendaIds(v, tiendas)), '3,9'],
    ['vigente vacía si ninguno existe', valorVigente('98,99', v => resolverTiendaIds(v, tiendas)), ''],
    ['vigente deja el id suelto', valorVigente('5', v => resolverTiendaIds(v, tiendas)), '5']
  ];

  let fallos = 0;
  for (const [nombre, obtenido, esperado] of casos) {
    if (obtenido === esperado) continue;
    fallos++;
    console.error(`FALLO ${nombre}: obtenido ${obtenido}, esperado ${esperado}`);
  }
  console.log(fallos ? `${fallos} fallo(s)` : `OK: ${casos.length} casos`);
  process.exit(fallos ? 1 : 0);
})();
