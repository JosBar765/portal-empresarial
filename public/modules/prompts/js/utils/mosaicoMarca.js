// Geometría pura (sin DOM ni canvas) de la marca de agua: medidas de la baldosa y centros del mosaico rotado.

// Constantes técnicas de dibujo (no son reglas de negocio).
export const DISENO = Object.freeze({
  letra: 0.62, // alto de la letra relativo al alto de la baldosa
  hueco: 0.28 // espacio entre el logo y el texto, en altos de baldosa
});
export const MAX_BALDOSAS = 2500; // tope de baldosas: en imágenes muy alargadas se agrandan para no colgar el navegador

/**
 * Medidas de una baldosa en unidades del alto de la baldosa (alto = 1).
 * @param {{proporcionLogo: number, anchoTextoPorLetra: number}} p ancho/alto del logo y ancho del texto por cada px de letra
 */
export function medidasBaldosa({ proporcionLogo, anchoTextoPorLetra }) {
  const logo = Math.max(proporcionLogo, 0);
  const texto = anchoTextoPorLetra * DISENO.letra;
  const hueco = logo > 0 ? DISENO.hueco : 0;
  return {
    anchoPorAlto: logo + hueco + texto,
    logo: { x: 0, ancho: logo },
    texto: { x: logo + hueco, ancho: texto, letra: DISENO.letra }
  };
}

const grados = (g) => (g * Math.PI) / 180;

/**
 * Centros de las baldosas en el marco rotado (origen en el centro de la imagen, ya rotado `angulo` grados).
 * Cubre el rectángulo de la imagen rotada más una fila y una columna de margen, en filas alternadas (ladrillo).
 * @param {{ancho: number, alto: number, angulo: number, escala: number, separacion: number, anchoPorAlto: number}} p
 */
export function calcularMosaico({ ancho, alto, angulo, escala, separacion, anchoPorAlto }) {
  const rad = grados(angulo);
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const mitadX = (ancho * cos + alto * sin) / 2;
  const mitadY = (ancho * sin + alto * cos) / 2;

  let baldosaAncho = Math.max(escala * Math.min(ancho, alto), 1);
  const contar = (bAncho) => {
    const bAlto = bAncho / anchoPorAlto;
    const paso = { x: bAncho + separacion * bAlto, y: bAlto * (1 + separacion) };
    const filas = Math.ceil(mitadY / paso.y) + 1;
    const columnas = Math.ceil(mitadX / paso.x) + 1;
    return { bAlto, paso, filas, columnas, total: (2 * filas + 1) * (2 * columnas + 2) };
  };
  let m = contar(baldosaAncho);
  while (m.total > MAX_BALDOSAS) {
    baldosaAncho *= Math.sqrt(m.total / MAX_BALDOSAS) * 1.01;
    m = contar(baldosaAncho);
  }

  const centros = [];
  for (let f = -m.filas; f <= m.filas; f++) {
    const desfase = Math.abs(f) % 2 ? m.paso.x / 2 : 0;
    for (let c = -m.columnas - 1; c <= m.columnas; c++) {
      centros.push({ x: c * m.paso.x + desfase, y: f * m.paso.y });
    }
  }
  return { rad, baldosa: { ancho: baldosaAncho, alto: m.bAlto }, paso: m.paso, centros };
}
