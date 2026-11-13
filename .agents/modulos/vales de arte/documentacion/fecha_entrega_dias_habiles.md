# Fecha de entrega con días hábiles

Regla del dueño (2026-11-13): se acabó la entrega de hoy para hoy. La fecha de entrega mínima se cuenta en **días de trabajo** del taller. Código: `src/core/calendario/calendarioLaboral.js` (reglas puras), `valeHelpers.js` (constantes y `opcionesFechaEntrega`). Contexto general: §5.1 de `flujo_vale_de_arte.md`.

## Regla

- **Día hábil:** el que la configuración marca «Recibe vales de arte» (`horarios_laborales`) y no es feriado del país del vale. Ningún día de la semana está escrito en el código.
- **Día de ingreso:** cuenta como el primer día de trabajo solo si el vale entra **antes de la hora máxima de recibimiento** del taller. Si entra a esa hora o después, el primer día es el siguiente día hábil. Un ingreso en un día no hábil (sábado, domingo, feriado) también cuenta desde el siguiente día hábil, como si entrara antes de la hora.
- **Fecha mínima:** el día hábil siguiente al último día de trabajo contado. Nunca es hoy.
- **Días de trabajo:** vale normal 3 (`DIAS_HABILES_VALE`); urgente 1 (`DIAS_HABILES_VALE_URGENTE`); modificación básica 1, media 2, avanzada 3 y urgente 1 (`DIAS_HABILES_MODIFICACION`). El cálculo de las modificaciones no cambió.
- **Varios talleres:** rige el más restrictivo (la mínima más tardía; cada taller con su hora máxima).
- **Feriados:** los del país de la tienda del asesor (el mismo país que usa el Diseño Local entre países). Sin tienda (p. ej. un administrador) rige el país del primer taller.
- **Reenvío y autorización** (creación y modificación): solo se exige que la fecha sea posterior a hoy y caiga en un día que reciba vales sin feriado; no se vuelven a exigir los días mínimos.
- **Sin cambios:** el plazo de 4 horas laborales (vigencia y adjuntos) sigue usando el país del taller.

## Ejemplos (hora máxima 12:00, lunes a viernes)

| Ingreso | Normal (3) | Urgente (1) |
|---|---|---|
| Lunes 9:00 | Jueves | Martes |
| Lunes 15:00 | Viernes | Miércoles |
| Viernes 9:00 | Miércoles | Lunes |
| Viernes 15:00 | Jueves | Martes |
| Sábado 10:00 | Jueves | Martes |
| Lunes 9:00 con el martes feriado | Viernes | Miércoles |

## Mensajes y motivos

`GET /api/vales/fechas-entrega` responde `{ minima, horaMaxima, diasHabiles: { normal, urgente }, noDisponibles }`. Motivos nuevos: `ENTREGA_HOY` (no hay entrega de hoy para hoy; reemplaza a `HOY_MODIFICACION`), `REQUIERE_URGENTE` (solo con «Urgente») y `ANTES_DE_MINIMA` (menos días hábiles que el mínimo). Los errores dicen qué falló, la regla con números y cómo corregirlo.

## Supuestos (el dueño puede corregirlos)

1. Reenvío y autorización exigen solo «no hoy ni pasada» (más día que reciba vales y sin feriado).
2. Un ingreso en día no hábil cuenta desde el siguiente día hábil. Para las modificaciones se conservó el cálculo anterior, que en ese caso (ingreso antes de la hora en día no hábil) entrega un día hábil antes.
3. El plazo de 4 horas laborales no cambia.
4. Los feriados son los del país de la tienda del asesor.
