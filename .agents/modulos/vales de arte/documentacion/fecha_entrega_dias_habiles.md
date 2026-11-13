# Fecha de entrega con días hábiles

Regla del dueño (2026-11-13): se acabó la entrega de hoy para hoy. La fecha de entrega mínima se cuenta en **días de trabajo** del taller. Código: `src/core/calendario/calendarioLaboral.js` (reglas puras), `valeHelpers.js` (constantes y `opcionesFechaEntrega`). Contexto general: §5.1 de `flujo_vale_de_arte.md`.

## Regla

- **Día hábil:** el que la configuración marca «Recibe vales de arte» (`horarios_laborales`) y no es feriado del país del vale. Ningún día de la semana está escrito en el código.
- **Día de ingreso:** cuenta como el primer día de trabajo solo si el vale entra **antes de la hora máxima de recibimiento** del taller. Si entra a esa hora o después, el primer día es el siguiente día hábil. Un ingreso en un día no hábil (sábado, domingo, feriado) también cuenta desde el siguiente día hábil: un sábado a las 10:00 equivale a un viernes por la tarde, para vales normales y modificaciones.
- **Fecha mínima:** el día hábil siguiente al último día de trabajo contado. Nunca es hoy.
- **Días de trabajo:** vale normal 3 (`DIAS_HABILES_VALE`); urgente 1 (`DIAS_HABILES_VALE_URGENTE`); modificación básica 1, media 2, avanzada 3 y urgente 1 (`DIAS_HABILES_MODIFICACION`). Las modificaciones conservan sus mínimos por tipo; solo cambió cómo se cuenta el ingreso en día no hábil.
- **Varios talleres:** rige el más restrictivo (la mínima más tardía; cada taller con su hora máxima).
- **Feriados y horarios:** los del país del taller (los generales, Guatemala; un Diseño Local, el país de su sede). Con varios talleres, el del primero.
- **Reenvío y autorización** (creación y modificación): se vuelve a exigir la regla completa con la hora de ese momento (mismo cálculo que al crear: vale normal 3, urgente 1, modificación su mínimo). Ejemplo (hora máxima 12:00): vale normal creado el martes 17:30 con entrega el lunes; autorizado el miércoles 10:00 se acepta; el miércoles 14:00 la mínima pasa al martes siguiente y el lunes se rechaza (el supervisor rechaza el vale para que el asesor cambie la fecha).
- **Sin cambios:** el plazo de 4 horas laborales (vigencia y adjuntos) sigue usando el país del taller.

## Ejemplos (hora máxima 12:00, lunes a viernes)

| Ingreso | Normal (3) | Urgente (1) |
|---|---|---|
| Lunes 9:00 | Jueves | Martes |
| Lunes 15:00 | Viernes | Miércoles |
| Viernes 9:00 | Miércoles | Lunes |
| Viernes 15:00 | Jueves | Martes |
| Sábado 10:00 (= viernes 15:00) | Jueves | Martes |
| Lunes 9:00 con el martes feriado | Viernes | Miércoles |

## Mensajes y motivos

`GET /api/vales/fechas-entrega` responde `{ minima, horaMaxima, diasHabiles: { normal, urgente }, noDisponibles }`. Motivos nuevos: `ENTREGA_HOY` (no hay entrega de hoy para hoy; reemplaza a `HOY_MODIFICACION`), `REQUIERE_URGENTE` (solo con «Urgente») y `ANTES_DE_MINIMA` (menos días hábiles que el mínimo). Los errores dicen qué falló, la regla con números y cómo corregirlo.

## Supuestos (el dueño puede corregirlos)

1. Reenvío y autorización re-verifican la regla completa con el reloj de ese momento.
2. Un ingreso en día no hábil cuenta desde el siguiente día hábil, igual que un viernes por la tarde, para todos los vales (modificaciones incluidas).
3. El plazo de 4 horas laborales no cambia.
4. Los feriados y horarios son los del país del taller, no los de la tienda del asesor.
