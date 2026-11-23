// src/modules/tiempos/datos/tablaV5.js
// La Tabla de tiempos tal como está impresa (Ver. 5.0, 27/07/2026): es la carga inicial de la base y se puede revisar fila por fila.
// Cada rango trae los días de sus etapas y `cliente`, el número impreso en la tabla; el módulo NO guarda `cliente`: lo calcula
// (suma de etapas + margen) y `scripts/tiempos/verificar-datos.js` compara el calculado con el impreso.
// Un rango sin `hasta` es «en adelante» y se carga como «tiempo a convenir».

const VERSION = { numero: '5.0', fecha: '2026-07-27', nota: 'Carga inicial desde la tabla de tiempos impresa' };

const ETAPAS = [
  ['diseno', 'Diseño'], ['piloto', 'Piloto'], ['fundicion', 'Fundición'], ['corte', 'Corte'], ['molde', 'Molde'], ['tres_d', '3D'],
  ['fabrica', 'Fábrica'], ['produccion', 'Producción'], ['costura', 'Costura'], ['ensamble', 'Ensamble']
];

const LINEAS = [['produccion', 'Producción'], ['mundi', 'Mundi'], ['protextil', 'Protextil']];

// rangos: [desde, hasta, [días por etapa en el orden de `etapas`], cliente impreso]
const PRODUCTOS = [
  // ---------------------------------------------------------------- Producción · Piezas fundidas
  { clave: 'fundida-antique-sin-color', linea: 'produccion', grupo: 'Piezas fundidas', nombre: 'Antique sin color', moldes: true, lanyard: true, etapas: ['piloto', 'fundicion', 'fabrica', 'ensamble'],
    rangos: [[75, 500, [2, 2, 3, 1], 9], [501, 1000, [2, 2, 4, 1], 10], [1001, 2000, [2, 2, 4, 2], 11], [2001, 3000, [2, 3, 5, 2], 13], [3001, null]] },
  { clave: 'fundida-antique-accesorio-sin-color', linea: 'produccion', grupo: 'Piezas fundidas', nombre: 'Antique con accesorio o giratoria, sin color', moldes: true, lanyard: true, etapas: ['piloto', 'fundicion', 'fabrica', 'ensamble'],
    rangos: [[75, 250, [2, 2, 5, 1], 11], [251, 500, [2, 2, 6, 1], 12], [501, 1500, [2, 2, 7, 2], 14], [1501, 3000, [2, 3, 8, 2], 16], [3001, null]] },
  { clave: 'fundida-antique-con-color', linea: 'produccion', grupo: 'Piezas fundidas', nombre: 'Antique con color', moldes: true, lanyard: true, etapas: ['piloto', 'fundicion', 'fabrica', 'ensamble'],
    rangos: [[75, 500, [2, 2, 5, 1], 11], [501, 1000, [2, 2, 6, 1], 12], [1001, 2000, [2, 2, 7, 2], 14], [2001, 3000, [2, 3, 8, 2], 16], [3001, null]] },
  { clave: 'fundida-antique-accesorio-con-color', linea: 'produccion', grupo: 'Piezas fundidas', nombre: 'Antique con accesorio o giratoria, con color', moldes: true, lanyard: true, etapas: ['piloto', 'fundicion', 'fabrica', 'ensamble'],
    rangos: [[75, 250, [2, 2, 8, 1], 14], [251, 500, [2, 2, 9, 1], 15], [501, 1500, [2, 2, 10, 2], 17], [1501, 3000, [2, 3, 11, 2], 19], [3001, null]] },
  { clave: 'fundida-brillante-sin-color', linea: 'produccion', grupo: 'Piezas fundidas', nombre: 'Brillante sin color', moldes: true, lanyard: true, etapas: ['piloto', 'fundicion', 'fabrica', 'ensamble'],
    rangos: [[75, 250, [2, 2, 8, 1], 14], [251, 500, [2, 2, 11, 1], 17], [501, 1500, [2, 2, 12, 2], 19], [1501, 3000, [2, 3, 14, 2], 22], [3001, null]] },
  { clave: 'fundida-brillante-accesorio-sin-color', linea: 'produccion', grupo: 'Piezas fundidas', nombre: 'Brillante con accesorio o giratoria, sin color', moldes: true, lanyard: true, etapas: ['piloto', 'fundicion', 'fabrica', 'ensamble'],
    rangos: [[75, 250, [2, 2, 10, 1], 16], [251, 500, [2, 2, 13, 1], 19], [501, 1500, [2, 2, 14, 2], 21], [1501, 3000, [2, 3, 17, 2], 25], [3001, null]] }, // OJO: impreso Fábrica 16 y Cliente 25 (la suma da 24): se carga Fábrica 17 para respetar el Cliente impreso; por confirmar
  { clave: 'fundida-brillante-con-color', linea: 'produccion', grupo: 'Piezas fundidas', nombre: 'Brillante con color', moldes: true, lanyard: true, etapas: ['piloto', 'fundicion', 'fabrica', 'ensamble'],
    rangos: [[75, 250, [2, 2, 10, 1], 16], [251, 500, [2, 2, 13, 1], 19], [501, 1500, [2, 2, 15, 2], 22], [1501, 3000, [2, 3, 17, 2], 25], [3001, null]] },
  { clave: 'fundida-brillante-accesorio-con-color', linea: 'produccion', grupo: 'Piezas fundidas', nombre: 'Brillante con accesorio o giratoria, con color', moldes: true, lanyard: true, etapas: ['piloto', 'fundicion', 'fabrica', 'ensamble'],
    rangos: [[75, 250, [2, 2, 12, 1], 18], [251, 500, [2, 2, 15, 1], 21], [501, 1500, [2, 2, 17, 2], 24], [1501, 3000, [2, 3, 19, 2], 27], [3001, null]] },
  // ---------------------------------------------------------------- Producción · Fotograbado
  { clave: 'fotograbado-laton', linea: 'produccion', grupo: 'Fotograbado', nombre: 'Fotograbado / latón calado o niquelado', etapas: ['diseno', 'fabrica', 'ensamble'],
    rangos: [[1, 100, [1, 5, 1], 8], [101, 500, [1, 8, 1], 11], [501, 1500, [1, 11, 2], 15], [1501, 2500, [1, 15, 2], 19], [2501, null]] },
  { clave: 'fotograbado-encajuelado', linea: 'produccion', grupo: 'Fotograbado', nombre: 'Encajuelado / soldado', etapas: ['diseno', 'fabrica', 'ensamble'],
    rangos: [[1, 5, [1, 6, 1], 9], [6, 15, [1, 8, 1], 11], [16, 25, [1, 10, 2], 14], [26, null]] },
  { clave: 'fotograbado-vinil', linea: 'produccion', grupo: 'Fotograbado', nombre: 'Vinil con revestimiento / lámina impresa precortada', etapas: ['diseno', 'fabrica', 'ensamble'],
    rangos: [[25, 150, [1, 2, 1], 5], [151, 500, [2, 2, 1], 6], [501, 1000, [3, 3, 1], 8], [1001, 2500, [4, 4, 2], 11], [2501, null]] },
  // ---------------------------------------------------------------- Producción · Metal y carpintería
  { clave: 'metal-corte-plasma', linea: 'produccion', grupo: 'Metal', nombre: 'Corte plasma', etapas: ['corte', 'fabrica', 'ensamble'],
    rangos: [[1, 50, [1, 3, 1], 6], [51, 150, [1, 4, 2], 8], [151, 300, [2, 5, 2], 10], [301, null]] },
  { clave: 'carpinteria', linea: 'produccion', grupo: 'Carpintería', nombre: 'Carpintería', etapas: ['fabrica', 'ensamble'],
    rangos: [[1, 25, [3, 1], 5], [26, 50, [5, 1], 7], [51, 100, [7, 2], 10], [101, null]] },
  // ---------------------------------------------------------------- Producción · Vidrio y mármol
  { clave: 'vidrio-blanco-waterjet', linea: 'produccion', grupo: 'Vidrio / Mármol', nombre: 'Vidrio en blanco / Waterjet', etapas: ['fabrica', 'ensamble'],
    rangos: [[1, 25, [3, 1], 5], [26, 75, [5, 1], 7], [76, 100, [6, 2], 9], [101, null]] },
  { clave: 'vidrio-marmol-grabado', linea: 'produccion', grupo: 'Vidrio / Mármol', nombre: 'Vidrio / Mármol grabado', etapas: ['diseno', 'fabrica', 'ensamble'],
    aviso: 'Verifica que haya planchas de mármol en existencia.',
    rangos: [[1, 10, [1, 3, 1], 6], [11, 25, [1, 4, 1], 7], [26, 50, [1, 5, 1], 8], [51, 100, [1, 8, 2], 12], [101, null]] },
  { clave: 'vidrio-pintado-acrilico', linea: 'produccion', grupo: 'Vidrio / Mármol', nombre: 'Vidrio pintado / acrílico pulido', etapas: ['diseno', 'fabrica', 'ensamble'],
    rangos: [[1, 10, [1, 4, 1], 7], [11, 25, [1, 5, 1], 8], [26, 50, [1, 7, 1], 10], [51, 100, [1, 10, 2], 14], [101, null]] },
  // ---------------------------------------------------------------- Producción · Resina (molde nuevo)
  { clave: 'resina-pintada', linea: 'produccion', grupo: 'Resina (molde nuevo)', nombre: 'Resina pintada', etapas: ['molde', 'fabrica', 'ensamble'],
    rangos: [[1, 25, [7, 4, 1], 13], [26, 50, [7, 6, 2], 16], [51, 100, [10, 10, 2], 23], [101, null]] },
  { clave: 'resina-cromo', linea: 'produccion', grupo: 'Resina (molde nuevo)', nombre: 'Resina cromo / metalizado', etapas: ['molde', 'fabrica', 'ensamble'],
    rangos: [[1, 5, [7, 6, 1], 15], [6, 15, [7, 7, 1], 16], [16, 25, [7, 8, 1], 17], [26, 50, [7, 9, 2], 19], [51, null]] },
  // ---------------------------------------------------------------- Producción · 3D
  { clave: '3d-resina-pintada', linea: 'produccion', grupo: '3D', nombre: 'Resina 3D pintada', etapas: ['tres_d', 'fabrica', 'ensamble'],
    rangos: [[1, 2, [4, 3, 1], 9], [3, 5, [8, 3, 1], 13], [6, null]] },
  { clave: '3d-filamento-pintado', linea: 'produccion', grupo: '3D', nombre: 'Filamento pintado', aviso: 'Consulta si hay filamento en existencia.', etapas: ['tres_d', 'fabrica', 'ensamble'],
    rangos: [[1, 5, [3, 3, 1], 8], [6, 10, [3, 4, 1], 9], [11, null]] },
  { clave: '3d-resina-cromada', linea: 'produccion', grupo: '3D', nombre: 'Resina 3D cromada', etapas: ['tres_d', 'fabrica', 'ensamble'],
    rangos: [[1, 2, [4, 5, 1], 11], [3, 5, [8, 5, 1], 15], [6, null]] },
  { clave: '3d-filamento-cromado', linea: 'produccion', grupo: '3D', nombre: 'Filamento cromado', aviso: 'Consulta si hay filamento en existencia.', etapas: ['tres_d', 'fabrica', 'ensamble'],
    rangos: [[1, 5, [3, 5, 1], 10], [6, 10, [3, 6, 1], 11], [11, null]] },
  // ---------------------------------------------------------------- Mundi
  { clave: 'mundi-medallas', linea: 'mundi', grupo: null, nombre: 'Medallas, láminas, stickers y botones', etapas: ['diseno', 'ensamble'],
    rangos: [[1, 100, [1, 1], 3], [101, 200, [2, 1], 4], [201, 500, [2, 2], 5], [501, 1000, [2, 3], 6], [1001, null]] },
  { clave: 'mundi-trofeos-personalizados', linea: 'mundi', grupo: null, nombre: 'Trofeos personalizados', etapas: ['diseno', 'ensamble'],
    rangos: [[6, 50, [1, 3], 5], [51, 100, [2, 4], 7], [101, 250, [3, 6], 10], [251, 500, [4, 8], 13], [501, null]] },
  { clave: 'mundi-plaquetas', linea: 'mundi', grupo: null, nombre: 'Plaquetas / Vidrio con lámina', etapas: ['diseno', 'ensamble'],
    rangos: [[1, 25, [1, 1], 3], [26, 100, [2, 1], 4], [101, 200, [2, 2], 5], [201, 350, [3, 2], 6], [351, null]] },
  { clave: 'mundi-cristales-3d', linea: 'mundi', grupo: null, nombre: 'Cristales 3D', etapas: ['diseno'],
    rangos: [[1, 12, [4], 5], [13, 25, [6], 7], [26, null]] },
  { clave: 'mundi-acrilico', linea: 'mundi', grupo: null, nombre: 'Acrílico corte simple / con grabación', etapas: ['diseno', 'ensamble'],
    rangos: [[1, 10, [3, 1], 5], [11, 25, [4, 2], 7], [26, 50, [6, 2], 9], [51, null]] },
  { clave: 'mundi-laser', linea: 'mundi', grupo: null, nombre: 'Grabación láser / pantógrafo', etapas: ['diseno', 'ensamble'],
    rangos: [[1, 10, [2, 1], 4], [11, 25, [3, 1], 5], [26, 50, [4, 1], 6], [51, null]] },
  { clave: 'mundi-comandos', linea: 'mundi', grupo: null, nombre: 'Comandos', etapas: ['fabrica', 'ensamble'],
    rangos: [[1, 25, [2, 2], 5], [26, 50, [3, 2], 6], [51, 150, [5, 3], 9], [151, null]] },
  { clave: 'mundi-trofeos-genericos', linea: 'mundi', grupo: null, nombre: 'Trofeos genéricos / tazas', etapas: ['diseno', 'ensamble'],
    rangos: [[1, 25, [1, 1], 3], [26, 50, [1, 2], 4], [51, 100, [1, 3], 5], [101, 250, [1, 5], 7], [251, 500, [2, 6], 9], [501, null]] },
  { clave: 'mundi-3d-filamento', linea: 'mundi', grupo: '3D', nombre: 'Filamento (piezas de hasta 8")', aviso: 'Consulta si hay filamento en existencia. Para piezas de otros tamaños, consulta el tiempo.', etapas: ['produccion', 'ensamble'],
    rangos: [[1, 10, [3, 1], 5], [11, 25, [5, 1], 7], [26, 35, [7, 1], 9], [36, 50, [9, 1], 11], [51, null]] },
  { clave: 'mundi-3d-llavero-nfc', linea: 'mundi', grupo: '3D', nombre: 'Llavero de filamento con NFC', aviso: 'Consulta si hay filamento en existencia.', etapas: ['produccion', 'ensamble'],
    rangos: [[50, 100, [5, 1], 7], [101, 250, [7, 1], 9], [251, 500, [10, 2], 13], [501, 1000, [14, 3], 18], [1001, null]] },
  // ---------------------------------------------------------------- Protextil
  { clave: 'protextil-bandana', linea: 'protextil', grupo: null, nombre: 'Bandana / buff / manga', etapas: ['produccion'],
    rangos: [[25, 250, [6], 7], [251, 500, [8], 9], [501, 1000, [12], 13], [1001, 2500, [19], 20], [2501, null]] },
  { clave: 'protextil-delantal', linea: 'protextil', grupo: null, nombre: 'Delantal largo', etapas: ['produccion'],
    rangos: [[25, 250, [7], 8], [251, 500, [9], 10], [501, 1000, [13], 14], [1001, 2500, [20], 21], [2501, null]] },
  { clave: 'protextil-liston', linea: 'protextil', grupo: null, nombre: 'Listón sublimado / seda', aviso: 'Consulta si hay listón de seda en existencia.', etapas: ['produccion', 'costura'],
    rangos: [[25, 250, [2, 1], 4], [251, 500, [3, 1], 5], [501, 1000, [4, 2], 7], [1001, 2500, [5, 3], 9], [2501, null]] },
  { clave: 'protextil-mouse-pad', linea: 'protextil', grupo: null, nombre: 'Mouse pad', etapas: ['produccion'],
    rangos: [[25, 250, [5], 6], [251, 500, [8], 9], [501, 1000, [12], 13], [1001, 2500, [15], 16], [2501, null]] },
  { clave: 'protextil-tafeta', linea: 'protextil', grupo: null, nombre: 'Tafeta / bolsa compacta / estuche - cosmetiquera', etapas: ['produccion'],
    rangos: [[25, 250, [9], 10], [251, 500, [11], 12], [501, 1000, [15], 16], [1001, 2500, [22], 23], [2501, null]] },
  { clave: 'protextil-lanyard', linea: 'protextil', grupo: null, nombre: 'Lanyard', etapas: ['produccion', 'costura'],
    rangos: [[50, 250, [5, 1], 7], [251, 500, [6, 1], 8], [501, 1000, [7, 2], 10], [1001, 2500, [9, 3], 13], [2501, null]] }
];

// Impresión UV: días que se suman a la producción del producto trabajado.
const UV = [
  { clave: 'uv-impresion', nombre: 'Impresión UV', rangos: [[75, 250, 2], [251, 500, 3], [501, 1500, 5], [1501, 3000, 7], [3001, null]] },
  { clave: 'uv-cama-plana', nombre: 'Cama plana / DTF', aviso: 'Respeta los mínimos de los productos a trabajar.', rangos: [[1, 10, 2], [11, 150, 4], [151, 300, 6], [301, 600, 9], [601, 1000, 13], [1001, null]] },
  { clave: 'uv-vinil', nombre: 'Vinil sin revestimiento', rangos: [[1, 300, 1], [301, 600, 2], [601, 1000, 3], [1001, null]] }
];

// Reglas generales de las observaciones de la tabla.
const PARAMETROS = [
  ['margen_dias', 1, 'Días de margen que se suman al total que se promete al cliente'],
  ['colores_incluidos', 2, 'Colores que ya incluyen los tiempos de la tabla'],
  ['colores_cada', 2, 'Cada cuántos colores extra se suma el día de colores'],
  ['colores_dias', 1, 'Días que suma cada grupo de colores extra'],
  ['moldes_dias', 2, 'Días extra por moldes en piezas fundidas de más de 3.5 pulgadas']
];

const AVISOS_GENERALES = [
  'No incluye el tiempo de diseño del arte interno.',
  'Está calculado para piezas de tamaño estándar y detalle medio.',
  'Los días de producción son de lunes a viernes y el día de la orden no cuenta.',
  'Si un reconocimiento lleva dos o más piezas, cada una cuenta como individual al definir la cantidad.',
  'En impresión UV la tonalidad puede variar en producciones masivas. Logos y textos deben ser editables.'
];

module.exports = { VERSION, ETAPAS, LINEAS, PRODUCTOS, UV, PARAMETROS, AVISOS_GENERALES };
