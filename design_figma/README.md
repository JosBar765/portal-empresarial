# Vales de Arte — Export para Figma

Esta carpeta contiene una réplica estática (HTML + CSS reales del proyecto,
sin JavaScript de aplicación ni llamadas a la API) de todas las pantallas del
módulo **Vales de Arte**, más el login y el dashboard. Está pensada para
importarse a Figma y editarse ahí, no para desplegarse ni usarse como parte
de la app.

No es una copia aparte del CSS: son los mismos design tokens y clases de
`public/css/global.css`, `public/css/dashboard.css`, `public/css/login.css` y
`public/modules/vales/css/styles.css` (copiados a `assets/css/`), con datos de
ejemplo fijos en vez de datos cargados por `app.js`. Cualquier cambio visual
que hagas aquí **no se refleja automáticamente en la app real** — es un punto
de partida para rediseñar en Figma, no la fuente de verdad del producto.

## Cómo importar a Figma

La forma más directa es el plugin **"html.to.design"** (gratuito, en el
Community de Figma):

1. Abre cualquier archivo `.html` de esta carpeta en Chrome (doble clic, o
   sírvelos con un servidor estático local — ver más abajo).
2. En Figma, instala/abre el plugin **html.to.design**.
3. Con la pestaña de Chrome activa en la pantalla que quieres importar, corre
   el plugin: escanea la página renderizada (incluye colores, tipografía,
   espaciados y jerarquía de capas) y la trae a Figma como capas editables.
4. Repite por cada pantalla que necesites. Los archivos ya están agrupados en
   carpetas por sección para importarlos en orden.

Alternativa sin plugin: cada `.html` puedes abrirlo directamente en el
navegador y usar "Guardar como imagen" / captura de pantalla para pegarlo en
Figma como referencia visual (pierdes la edición de capas, pero sirve para
anotar sobre la imagen).

### Nota sobre abrir los archivos directamente (`file://`)

Los archivos usan rutas relativas (`../assets/css/...`), así que abrirlos con
doble clic desde el explorador de archivos funciona bien en la mayoría de
navegadores. Si tu navegador bloquea `@import` de CSS bajo `file://`, sirve la
carpeta con cualquier servidor estático, por ejemplo:

```bash
npx serve design_figma
# o
python -m http.server 4100 --directory design_figma
```

y abre `http://localhost:<puerto>/01-login/index.html`, etc.

## Estructura

```
design_figma/
├── assets/
│   ├── css/          # Copia de los CSS reales del proyecto (global, dashboard, login, vales)
│   └── logos/         # Logo usado en headers y login
├── 01-login/
│   └── index.html
├── 02-dashboard/
│   ├── admin.html      # Ve los 4 módulos del catálogo
│   └── asesor.html     # Ve solo los módulos permitidos por su rol (Vales de Arte, Eventos y Carreras)
├── 03-vales-buzon/
│   ├── asesor.html                    # Buzón — Asesor de Ventas (rol 3), con sidebar y estados "lógicos"
│   ├── supervisor.html                # Buzón — Supervisor de Ventas (rol 4), con sidebar
│   ├── encargado.html                 # Buzón — Encargado de Diseño (rol 5/6), sin sidebar, grid de 10 contadores + botón flotante
│   ├── tecnico.html                   # Buzón — Técnico (rol 7), con sidebar
│   └── tecnico-trabajo-realizado.html # Segunda pestaña del sidebar (vendidos/cancelados)
└── 04-vales-modales/
    ├── crear-vale.html                 # Asesor: formulario completo de creación
    ├── asignar-tecnico.html            # Encargado: asignar vale a técnico
    ├── revisar-propuesta.html          # Encargado: aprobar/desaprobar propuesta
    ├── entregar-propuesta.html         # Técnico: subir propuesta PDF
    ├── propuesta-asesor-confirmar.html # Asesor: ver propuesta y confirmar venta
    ├── cancelar-o-modificar.html       # Asesor: elegir cancelar vale o solicitar modificación
    ├── solicitar-modificacion.html     # Asesor: formulario de modificación
    ├── aprobar-modificacion.html       # Supervisor: autorizar modificación solicitada
    ├── historial.html                  # Cualquier rol: línea de tiempo de trazabilidad
    └── carga-de-trabajo.html           # Encargado: widget flotante con carga por técnico
```

## Qué se dejó fuera de este export

- La pantalla del dashboard se exportó solo para Administrador y Asesor a
  modo de ejemplo (grid de módulos con 4 y 2 tarjetas respectivamente); el
  resto de roles solo cambia cuántas tarjetas ven, no el layout.
- No se incluyeron los otros módulos del portal (Generador de Prompts,
  Eventos y Carreras, Administración Central) — solo aparecen como tarjetas
  de referencia en el dashboard, ya que este export es específico de Vales de
  Arte.
- El PDF generado del vale (`valePdfService.js`) no se exportó aquí: es un
  documento aparte generado con `pdf-lib`, no parte de la interfaz web.
