# Correcciones 74 — Moneda de la cotización según el país de la tienda

Rama: `feat/vales-moneda-por-pais`.

## Qué cambia

- **Fin de la «Q» fija:** la cotización del vale se mostraba siempre en quetzales. Ahora usa la moneda del país de la tienda del vale (los vales de modificación `MOD-` heredan la misma tienda).
- **Dónde se ve:** el rótulo del formulario («Cotización (Q) *» pasa a «Cotización (<símbolo>) *»; al corregir o modificar usa la moneda del propio vale, y al crear la del país del asesor), el detalle del supervisor y la fila de cotización del PDF.
- **Moneda en la base:** columnas nuevas `paises.moneda_simbolo` y `paises.moneda_codigo` (ISO 4217), opcionales. Script `database/migrations/paises_moneda.sql`, aditivo e idempotente; no pisa valores ya cargados.
- **Valores iniciales:** Guatemala Q (GTQ), El Salvador $ (USD), Honduras L (HNL), Nicaragua C$ (NIO) y Costa Rica ₡ (CRC). Belice y cualquier país sin moneda configurada muestran solo la cifra, sin símbolo y sin error.
- **Un solo formateador:** `src/core/utils/moneda.js` en el servidor (`formatearMonto`, `monedaDeVale`) y `formatearMonto` en `public/modules/vales/js/utils/formato.js`. Sin símbolo cae al código ISO y, si tampoco hay, a la cifra.
- **PDF:** las fuentes estándar de pdf-lib solo codifican WinAnsi, así que el colón (₡) se imprime como «CRC 5.00».
- **Los vales ya creados** conservan su cifra; solo cambia el símbolo, según el país de su tienda.
- **Payloads:** solo ganan campos (`moneda_simbolo`, `moneda_codigo` en cada vale y en el país del catálogo); ningún endpoint cambia.
- **Prueba:** `scripts/vales/probarMonedaPais.js` (sin BD, 11 casos del formateador).

## Para quien aplique el cambio

- En desarrollo: `npm run migrate`. En staging y producción el script se aplica solo al iniciar el servidor.
- Se cambia una moneda con un `UPDATE` sobre `paises` (no hay pantalla de administración todavía).
