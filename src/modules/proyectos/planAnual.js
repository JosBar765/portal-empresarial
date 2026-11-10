// src/modules/proyectos/planAnual.js
// Reglas puras del plan del año (sin base de datos): cuándo toca activar el proyecto de un mes y cuál es la próxima activación.
// Todas las fechas son AAAA-MM-DD en la hora de Guatemala; la hora es HH:MM de 24 horas.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const aFecha = (anio, mes, dia) => new Date(Date.UTC(anio, mes - 1, dia)).toISOString().slice(0, 10);

// El día de la semana (0 = domingo) de una fecha AAAA-MM-DD.
const diaDeSemana = (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay();
const esHabil = (fecha) => diaDeSemana(fecha) !== 0 && diaDeSemana(fecha) !== 6;

// La misma fecha si es día hábil (lunes a viernes); si no, el siguiente hábil.
function proximoHabil(fecha) {
  const d = new Date(`${fecha}T00:00:00Z`);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// El día en que se activa el proyecto de un mes: `dia` 0 = el primer día hábil; si no, ese día del mes (1 a 28) o, si cae en fin de
// semana, el siguiente día hábil.
function fechaDeActivacion(anio, mes, dia) {
  return proximoHabil(aFecha(anio, mes, dia >= 1 ? Math.min(dia, 28) : 1));
}

// «martes 1 de diciembre» para mostrarlo en pantalla.
function fechaLarga(fecha) {
  const [, m, d] = fecha.split('-').map(Number);
  return `${DIAS[diaDeSemana(fecha)]} ${d} de ${MESES[m - 1]}`;
}

// La próxima activación a partir de `ahora` ({ fecha, hora } en Guatemala). `yaTienenProyecto`: meses (anio-mes) que ya tienen un proyecto,
// porque ese mes no se activa otra vez. Mira el mes en curso y los dos siguientes; devuelve { anio, mes, fecha, hora } o null.
function proximaActivacion(ahora, { dia, hora }, yaTienenProyecto = new Set()) {
  for (let i = 0; i < 3; i += 1) {
    const base = new Date(Date.UTC(Number(ahora.fecha.slice(0, 4)), Number(ahora.fecha.slice(5, 7)) - 1 + i, 1));
    const anio = base.getUTCFullYear();
    const mes = base.getUTCMonth() + 1;
    if (yaTienenProyecto.has(`${anio}-${mes}`)) continue;
    const fecha = fechaDeActivacion(anio, mes, dia);
    if (fecha > ahora.fecha || (fecha === ahora.fecha && hora >= ahora.hora)) return { anio, mes, fecha, hora };
    // El momento de este mes ya pasó y el mes sigue sin proyecto: hoy mismo se intentará (el vigilante lo hace cada 15 minutos).
    if (i === 0) return { anio, mes, fecha: ahora.fecha, hora: ahora.hora, pendiente: true };
  }
  return null;
}

module.exports = { MESES, DIAS, aFecha, esHabil, proximoHabil, fechaDeActivacion, fechaLarga, proximaActivacion };
