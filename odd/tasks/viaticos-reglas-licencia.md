# Viáticos: reglas de licencia de seis países

Rama: `fix/viaticos-reglas-licencias`. Alcance elegido: solo datos.

- [x] T1 Migración `55_viaticos_reglas_licencia.sql`: Panamá, placas, tipos de licencia con prefijo de país y reglas (tonelaje y pasajeros).
- [x] T2 Docs: README y `modelo_datos.md`.
- [ ] T3 Aplicar y verificar en la base local (pendiente de autorización).

Supuestos: Nicaragua según la tabla del dueño (cat. 3 = 3.5 t y 9 pasajeros; 6A = 18 t; 1 y 2 motos sin límite; sin cat. 8 agrícola); placa GT «M» para registrar motos; GT-M sin límites pero solo con la placa M (confirmado por el dueño); ejes y carga peligrosa no importan (flota: moto, auto, SUV y panel); licencias de pasajeros sin cifra, sin límite.
