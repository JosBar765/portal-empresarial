// src/modules/vales/services/valeCatalogoService.js
// Catálogos para el formulario de creación y resolución de "mi taller"
// (clon operativo del Asistente de Diseño) — usado por Detalle, Buzón y
// Taller además de por este mismo archivo.
const tallerRepository = require('../repositories/tallerRepository');
const catalogoRepository = require('../repositories/catalogoRepository');
const usuarioValeRepository = require('../repositories/usuarioValeRepository');
const { ROL, esAsistenteDeDiseno } = require('./valeHelpers');

class ValeCatalogoService {
  // `talleres` sigue devolviendo el catálogo COMPLETO (lo usan todos los
  // roles para resolver nombres de taller — encargados, técnicos, admin,
  // tablas del buzón — no solo el asesor eligiendo destino al crear).
  // `miTiendaId` es un dato adicional para que el FRONTEND filtre las
  // opciones que le ofrece al asesor (su propio Diseño Local, nunca el de
  // otra tienda) sin tener que meter tienda_id en el JWT — la validación
  // real e inapelable sigue siendo server-side, en `validarTalleresIds`.
  async obtenerCatalogos(usuario) {
    const [tiendas, paises, talleres] = await Promise.all([
      catalogoRepository.listarTiendas(),
      catalogoRepository.listarPaises(),
      tallerRepository.listarActivos()
    ]);
    const solicitante = usuario ? await usuarioValeRepository.obtenerPorId(usuario.id) : null;
    // `tiendasGerencia` es el conjunto de tiendas que el filtro de tienda
    // (vista Rendimiento y buzón) le puede ofrecer a ESTE usuario — el catálogo completo para
    // Administrador/Gerente, solo las de sus asesores cubiertos para el
    // Supervisor (mismo alcance que su buzón).
    let tiendasGerencia = tiendas;
    if (usuario && usuario.rolId === ROL.SUPERVISOR) {
      const asesores = await usuarioValeRepository.listarAsesoresPorSupervisor(usuario.id);
      const idsTienda = new Set(asesores.map(a => a.tienda_id).filter(Boolean));
      tiendasGerencia = tiendas.filter(t => idsTienda.has(t.id));
    }
    // producto/material/tecnica/acabado no son catálogo — son texto libre.
    return { tiendas, paises, talleres, miTiendaId: (solicitante && solicitante.tienda_id) || null, tiendasGerencia };
  }

  async obtenerTalleres() {
    return tallerRepository.listarActivos();
  }

  // El Asistente de Diseño opera un taller como si fuera su propio
  // encargado_id, sin serlo. Todo sitio que compara
  // `talleres.encargado_id === usuario.id` para resolver "mi taller"/"mis
  // técnicos" pasa por AQUÍ en su lugar, para que la excepción viva en un
  // solo punto en vez de repetirse en cada servicio. A QUÉ taller "clona" el
  // Asistente sale de `taller_tecnicos` (mismo mecanismo que usa un
  // Técnico), asignable desde "Editar usuario".
  async idEncargadoEfectivo(usuario) {
    if (!esAsistenteDeDiseno(usuario)) return usuario.id;
    const asistente = await usuarioValeRepository.obtenerPorId(usuario.id);
    if (!asistente || !asistente.taller_id) return usuario.id;
    const talleres = await tallerRepository.listarActivos();
    const taller = talleres.find(t => t.id === asistente.taller_id);
    return taller ? taller.encargado_id : usuario.id;
  }

  // Sala de socket a notificar cuando un vale queda listo para fusión. Se
  // ancla al taller "Diseño" (el único con `vales.aprobar_general` fijo por
  // rol — el Encargado de Diseño y su clon, el Asistente, ya están unidos a
  // `taller:<id>` de ese taller, sin importar qué taller disparó la
  // transición a APROBADO_DEPARTAMENTO). Solo es configurable A QUÉ taller
  // clona el Asistente su BUZÓN — si el negocio algún día reasigna también
  // la fusión a otro taller, esta sala fija tendría que revisarse aparte.
  async salaFusion() {
    const talleres = await tallerRepository.listarActivos();
    const diseno = talleres.find(t => t.nombre === 'Diseño');
    return diseno ? `taller:${diseno.id}` : 'vales:admin';
  }
}

module.exports = new ValeCatalogoService();
