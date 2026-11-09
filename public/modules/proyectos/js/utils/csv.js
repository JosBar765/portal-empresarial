// Escritura de CSV en el navegador (el archivo de errores de la importación). Una celda que parece fórmula se
// neutraliza con un apóstrofo para que Excel no la ejecute.
export function celdaCsv(valor) {
  let texto = String(valor == null ? '' : valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[",\n\r;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function descargarCsv(nombre, filas) {
  const contenido = `\uFEFF${filas.map(f => f.map(celdaCsv).join(',')).join('\r\n')}\r\n`;
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}
