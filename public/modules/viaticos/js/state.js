// Estado único del módulo; las vistas de las fases siguientes añaden aquí lo que necesiten.
export const state = {
  user: null,
  tab: null,
  // Vista con cambios sin guardar: { confirmar(): Promise<boolean>, liberar() }.
  salidaVista: null,
  socket: null,
  // Respuesta de GET /contexto: usuario, permisos viaticos.*, países, licencia y ajustes de archivo.
  contexto: null,
  // Período de las listas (desde, hasta, q); lo fija la barra de filtros de cada vista.
  ventana: null,
  // Texto del buscador de la lista abierta (sin espacios sobrantes).
  busqueda: '',
  // Gestiones lleva su propio período y búsqueda para no pisar los de Solicitudes.
  ventanaGestion: null,
  busquedaGestion: '',
  // id de solicitud -> marca de tiempo de la acción propia, para no avisarle al usuario lo que él mismo hizo.
  accionesPropias: new Map()
};
