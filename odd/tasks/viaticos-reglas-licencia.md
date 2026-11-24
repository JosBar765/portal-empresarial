# Viáticos: reglas de licencia de siete países

Rama: `fix/viaticos-reglas-licencias`. Alcance: solo datos; sin cambios de esquema ni de código.

Flotilla: moto, automóvil, SUV y panel. Reglas: moto y 4 ruedas separadas (placa «M» solo con licencia de moto); en Guatemala GT-C solo con placa P, GT-B y GT-A con P, C y A; sin límites de tonelaje ni pasajeros (decisión del dueño, regla no contrastada con la ley de cada país).

- [x] T1 Migración `55_viaticos_reglas_licencia.sql` (Panamá, placas, licencias con prefijo de país, reglas; Belice incluido).
- [x] T2 Docs: README y `modelo_datos.md`.
- [ ] T3 Reaplicar en la base local y verificar (pendiente: la 55 ya estaba aplicada con las reglas anteriores).

No cubierto: licencia Profesional de Nicaragua con placa comercial, camiones, buses, ejes, carga peligrosa y agrícolas.
