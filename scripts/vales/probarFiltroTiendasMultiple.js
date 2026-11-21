// Prueba sin BD ni DOM del valor múltiple del filtro de tiendas (public/js/filtroCascada.js). Sale con 1 si algo no coincide.
const { pathToFileURL } = require('url');
const path = require('path');

(async () => {
  // El módulo del front es ES; se carga con import() para no cambiar el tipo del paquete.
  const { resolverTiendaIds, resolverAsesorIds, paramsDeTienda, valorVigente } = await import(pathToFileURL(path.join(__dirname, '../../public/js/filtroCascada.js')).href);
  const tiendas = [
    { id: 3, pais_nombre: 'Guatemala' },
    { id: 7, pais_nombre: 'Guatemala', departamento_nombre: 'Ventas Trofex Ruta 1' },
    { id: 9, pais_nombre: 'Honduras' }
  ];
  const asesores = [{ id: 12, nombre: 'Julio' }, { id: 15, nombre: 'Ana' }];
  const json = (x) => JSON.stringify(x);
  const vigente = (v) => valorVigente(v, x => resolverTiendaIds(x, tiendas), x => resolverAsesorIds(x, asesores));
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
    ['vigente deja el id suelto', valorVigente('5', v => resolverTiendaIds(v, tiendas)), '5'],
    ['tiendas ignoran tokens de asesor', json(resolverTiendaIds('3,a12,9', tiendas)), '[3,9]'],
    ['asesores de una lista mixta', json(resolverAsesorIds('3,a12,a15,9', asesores)), '[12,15]'],
    ['asesor suelto', json(resolverAsesorIds('a12', asesores)), '[12]'],
    ['asesor que ya no existe se descarta', json(resolverAsesorIds('a12,a99,a12', asesores)), '[12]'],
    ['sin asesores en valores simples', json(resolverAsesorIds('3', asesores)), '[]'],
    ['params mixtos', json(paramsDeTienda('3,a12,a15', tiendas, asesores)), '{"tiendaIds":"3","asesorIds":"12,15"}'],
    ['params solo asesor', json(paramsDeTienda('a12', tiendas, asesores)), '{"asesorIds":"12"}'],
    ['params ignoran asesor desconocido', json(paramsDeTienda('3,a99', tiendas, asesores)), '{"tiendaIds":"3"}'],
    ['params sin asesores no cambian', json(paramsDeTienda('3,7,9', tiendas)), '{"tiendaIds":"3,7,9"}'],
    ['vigente conserva asesores y limpia viejos', vigente('3,99,a12,a99'), '3,a12'],
    ['vigente solo asesor', vigente('a15'), 'a15'],
    ['vigente descarta asesor viejo', vigente('a99'), ''],
    ['vigente sin resolver asesores los descarta', valorVigente('3,a12', v => resolverTiendaIds(v, tiendas)), '3']
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
