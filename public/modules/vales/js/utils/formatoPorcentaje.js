// Porcentajes de Reportes con hasta dos decimales y punto decimal. Funciones puras (sin DOM ni estado).
// Sin toLocaleString: su salida cambia según el navegador y el idioma.
export function formatearPorcentaje(n) {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '—';
  // Redondeo a 2 decimales; String() ya omite los ceros sobrantes.
  const redondeado = Math.round(Number(n) * 100) / 100;
  return String(Object.is(redondeado, -0) ? 0 : redondeado);
}

export const conSimboloPorcentaje = (n) => {
  const texto = formatearPorcentaje(n);
  return texto === '—' ? texto : `${texto} %`;
};
