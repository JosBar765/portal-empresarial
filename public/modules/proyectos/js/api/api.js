// Un fetch simple por endpoint de /api/proyectos; el error conserva el mensaje y el detalle por campo.
export async function pedir(url, opciones) {
  let res;
  try {
    res = await fetch(url, opciones);
  } catch (e) {
    throw new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data === null) {
    const error = new Error((data && data.error) || `No se pudo completar la acción (código ${res.status}).`);
    error.status = res.status;
    error.campos = data && data.campos;
    error.codigo = data && data.codigo;
    error.duplicados = data && data.duplicados;
    error.detalle = data && data.detalle;
    throw error;
  }
  return data;
}

const enJson = (method, payload) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const consulta = (parametros) => {
  const limpios = Object.entries(parametros).filter(([, v]) => v !== '' && v != null);
  return limpios.length ? `?${new URLSearchParams(limpios)}` : '';
};

// Sesión
export const sessionCheck = () => fetch('/api/auth.php?action=session_check').then(r => r.json());
export const logout = () => fetch('/api/auth.php?action=logout');
export const refreshToken = () => fetch('/api/auth/refresh', { method: 'POST' });

const BASE = '/api/proyectos';

// Centro de configuración
export const obtenerResumen = () => pedir(`${BASE}/config/resumen`);
export const listarParametros = () => pedir(`${BASE}/config/parametros`);
export const guardarParametros = (cambios) => pedir(`${BASE}/config/parametros`, enJson('PUT', { cambios }));
export const listarReglas = () => pedir(`${BASE}/config/reglas`);
export const guardarReglas = (cambios) => pedir(`${BASE}/config/reglas`, enJson('PUT', { cambios }));
export const restaurarAjuste = (clave) => pedir(`${BASE}/config/ajustes/${encodeURIComponent(clave)}/restaurar`, { method: 'POST' });
export const listarPaises = () => pedir(`${BASE}/config/paises`);
export const guardarPais = (paisId, datos) => pedir(`${BASE}/config/paises/${paisId}`, enJson('PUT', datos));
export const listarHistorial = (filtros) => pedir(`${BASE}/config/historial${consulta(filtros)}`);
export const restaurarCambio = (id) => pedir(`${BASE}/config/historial/${id}/restaurar`, { method: 'POST' });

// Catálogos
export const listarCatalogo = (catalogo) => pedir(`${BASE}/catalogos/${catalogo}`);
export const crearEnCatalogo = (catalogo, datos) => pedir(`${BASE}/catalogos/${catalogo}`, enJson('POST', datos));
export const editarEnCatalogo = (catalogo, id, datos) => pedir(`${BASE}/catalogos/${catalogo}/${encodeURIComponent(id)}`, enJson('PUT', datos));
export const cambiarActivoEnCatalogo = (catalogo, id, activo) => pedir(`${BASE}/catalogos/${catalogo}/${encodeURIComponent(id)}/activo`, enJson('PATCH', { activo }));

// Empresas de la base global
export const obtenerOpcionesClientes = () => pedir(`${BASE}/clientes/opciones`);
export const listarClientes = (filtros) => pedir(`${BASE}/clientes${consulta(filtros)}`);
export const listarClientesGanados = (filtros) => pedir(`${BASE}/clientes-ganados${consulta(filtros)}`);
export const obtenerCliente = (id) => pedir(`${BASE}/clientes/${encodeURIComponent(id)}`);
export const revisarDuplicados = (datos) => pedir(`${BASE}/clientes/duplicados`, enJson('POST', datos));
export const crearCliente = (datos, confirmarDuplicado) => pedir(`${BASE}/clientes`, enJson('POST', { ...datos, confirmarDuplicado }));
export const editarCliente = (id, datos, confirmarDuplicado) => pedir(`${BASE}/clientes/${encodeURIComponent(id)}`, enJson('PUT', { ...datos, confirmarDuplicado }));
export const cambiarEstadoCliente = (id, datos) => pedir(`${BASE}/clientes/${encodeURIComponent(id)}/estado`, enJson('POST', datos));
export const agregarContacto = (clienteId, datos) => pedir(`${BASE}/clientes/${encodeURIComponent(clienteId)}/contactos`, enJson('POST', datos));
export const editarContacto = (contactoId, datos) => pedir(`${BASE}/clientes/contactos/${encodeURIComponent(contactoId)}`, enJson('PUT', datos));
export const cambiarActivoContacto = (contactoId, activo) => pedir(`${BASE}/clientes/contactos/${encodeURIComponent(contactoId)}/activo`, enJson('PATCH', { activo }));

// Importación (el archivo viaja como formulario, no como JSON)
const conArchivo = (archivo, campos = {}) => {
  const formulario = new FormData();
  Object.entries(campos).forEach(([k, v]) => formulario.append(k, v));
  formulario.append('archivo', archivo, archivo.name);
  return { method: 'POST', body: formulario };
};
export const URL_PLANTILLA = `${BASE}/clientes/importar/plantilla`;
export const previsualizarImportacion = (archivo) => pedir(`${BASE}/clientes/importar/previsualizar`, conArchivo(archivo));
export const confirmarImportacion = (archivo, duplicadas, idempotencyKey) => pedir(`${BASE}/clientes/importar/confirmar`, conArchivo(archivo, { duplicadas, idempotencyKey }));

// Campos propios (A6) y alcance de usuarios (A7)
export const listarKits = () => pedir(`${BASE}/config/kits`);
export const obtenerKit = (nichoId) => pedir(`${BASE}/config/kits/${encodeURIComponent(nichoId)}`);
export const guardarKit = (nichoId, datos) => pedir(`${BASE}/config/kits/${encodeURIComponent(nichoId)}`, enJson('PUT', datos));
export const obtenerKitDeEmpresa = (participacionId) => pedir(`${BASE}/participaciones/${encodeURIComponent(participacionId)}/kit`);
export const listarCampos = () => pedir(`${BASE}/config/campos`);
export const crearCampo = (datos) => pedir(`${BASE}/config/campos`, enJson('POST', datos));
export const editarCampo = (id, datos) => pedir(`${BASE}/config/campos/${encodeURIComponent(id)}`, enJson('PUT', datos));
export const cambiarActivoCampo = (id, activo) => pedir(`${BASE}/config/campos/${encodeURIComponent(id)}/activo`, enJson('PATCH', { activo }));
export const listarAlcance = (filtros) => pedir(`${BASE}/config/alcance${consulta(filtros || {})}`);
export const guardarAlcance = (usuarioId, paises) => pedir(`${BASE}/config/alcance/${encodeURIComponent(usuarioId)}`, enJson('PUT', { paises }));

// Plantillas de proyecto (A4 y A4b) y proyectos (aprobación)
export const listarPlantillas = () => pedir(`${BASE}/config/plantillas`);
export const crearPlantilla = (datos) => pedir(`${BASE}/config/plantillas`, enJson('POST', datos));
export const editarPlantilla = (id, datos) => pedir(`${BASE}/config/plantillas/${encodeURIComponent(id)}`, enJson('PUT', datos));
export const cambiarActivaPlantilla = (id, activa) => pedir(`${BASE}/config/plantillas/${encodeURIComponent(id)}/activa`, enJson('PATCH', { activa }));
export const listarProyectos = (filtros) => pedir(`${BASE}/proyectos${consulta(filtros || {})}`);
export const obtenerProyecto = (id) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}`);
export const vistaPreviaProyecto = (id) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/vista-previa`, { method: 'POST' });
export const aprobarProyecto = (id, idempotencyKey) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/aprobar`, enJson('POST', { idempotencyKey }));
export const rechazarProyecto = (id, comentario) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/rechazar`, enJson('POST', { comentario }));

// Asistente de proyectos
export const obtenerOpcionesProyectos = () => pedir(`${BASE}/proyectos/opciones`);
export const candidatosDeTiendas = (tiendaIds) => pedir(`${BASE}/proyectos/candidatos`, enJson('POST', { tiendaIds }));
export const crearProyecto = (datos) => pedir(`${BASE}/proyectos`, enJson('POST', datos));
export const editarProyecto = (id, datos) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}`, enJson('PUT', datos));
export const activarProyecto = (id, idempotencyKey) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/activar`, enJson('POST', { idempotencyKey }));
export const pedirAprobacionProyecto = (id) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/pedir-aprobacion`, { method: 'POST' });
export const cancelarProyecto = (id, motivo) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/cancelar`, enJson('POST', { motivo }));

// Trabajo del asesor
export const obtenerMiProyecto = () => pedir(`${BASE}/mi-proyecto`);
export const obtenerParaHoy = () => pedir(`${BASE}/mi-proyecto/para-hoy`);
export const listarMisEmpresas = (filtros) => pedir(`${BASE}/participaciones${consulta(filtros)}`);
export const obtenerFichaDeEmpresa = (id) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}`);
export const obtenerOpcionesDeGestion = () => pedir(`${BASE}/participaciones/opciones`);
export const registrarGestion = (id, datos) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}/gestiones`, enJson('POST', datos));
export const registrarCotizacion = (id, datos) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}/cotizaciones`, enJson('POST', datos));
export const registrarVenta = (id, datos) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}/ventas`, enJson('POST', datos));
export const marcarEmpresaPerdida = (id, datos) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}/perdida`, enJson('POST', datos));
export const descartarEmpresa = (id, datos) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}/descartar`, enJson('POST', datos));
export const listarMisProyectosAnteriores = () => pedir(`${BASE}/mis-proyectos-anteriores`);

// Seguimiento del supervisor
export const listarProyectosEnSeguimiento = () => pedir(`${BASE}/seguimiento/proyectos`);
export const obtenerSeguimiento = (id) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/seguimiento`);
export const obtenerSeguimientoPorAsesor = (id) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/seguimiento/asesores`);
export const obtenerSeguimientoPorTienda = (id) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/seguimiento/tiendas`);
export const obtenerEstancados = (id, todos) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/seguimiento/estancados${todos ? '?todos=1' : ''}`);
export const obtenerDestinosDeReasignacion = (id) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/seguimiento/destinos`);
export const reasignarEmpresas = (id, datos) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/reasignar`, enJson('POST', datos));
export const obtenerSupervision = (id) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}/supervision`);
export const anularCotizacion = (id, cotizacionId, datos) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}/cotizaciones/${encodeURIComponent(cotizacionId)}/anular`, enJson('POST', datos));
export const anularGestion = (id, gestionId, datos) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}/gestiones/${encodeURIComponent(gestionId)}/anular`, enJson('POST', datos));
export const anularVenta = (id, ventaId, datos) => pedir(`${BASE}/participaciones/${encodeURIComponent(id)}/ventas/${encodeURIComponent(ventaId)}/anular`, enJson('POST', datos));
export const listarVentasPorConfirmar = (estado) => pedir(`${BASE}/ventas${consulta({ estado })}`);
export const confirmarVenta = (id, idempotencyKey) => pedir(`${BASE}/ventas/${encodeURIComponent(id)}/confirmar`, enJson('POST', { idempotencyKey }));
export const rechazarVenta = (id, datos) => pedir(`${BASE}/ventas/${encodeURIComponent(id)}/rechazar`, enJson('POST', datos));

// Cierre, informe, visto bueno y panel gerencial
export const obtenerInforme = (id) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/informe`);
export const cerrarProyectoConInforme = (id, datos) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/cerrar`, enJson('POST', datos));
export const darVistoBueno = (id, datos) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/visto-bueno`, enJson('POST', datos));
export const devolverCierre = (id, datos) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/devolver`, enJson('POST', datos));
export const reenviarCierre = (id, datos) => pedir(`${BASE}/proyectos/${encodeURIComponent(id)}/reenviar`, enJson('POST', datos));
export const obtenerPanelGerencial = (filtros) => pedir(`${BASE}/gerencia/panel${consulta(filtros)}`);
export const listarPorDarVistoBueno = () => pedir(`${BASE}/gerencia/visto-bueno`);

// Notificaciones (matriz de avisos)
export const obtenerAvisos = () => pedir(`${BASE}/config/avisos`);
export const guardarAvisos = (cambios) => pedir(`${BASE}/config/avisos`, enJson('PUT', cambios));
export const restaurarAvisos = () => pedir(`${BASE}/config/avisos/restaurar`, { method: 'POST' });
