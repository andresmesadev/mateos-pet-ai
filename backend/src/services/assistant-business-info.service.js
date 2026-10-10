// Adapter consumes the existing tenant-filtered catalog; never invents services/prices.
const listBusinessServices = async tenantId => {
  if (!tenantId) return "Necesito verificar el establecimiento antes de consultar sus servicios.";
  try {
    const { services } = await require("../contexts/services").listAvailableServices({ tenantId });
    const names = services.slice(0, 20).map(service => `• ${service.name}`);
    return names.length ? `Servicios disponibles:\n${names.join("\n")}\n\n¿Sobre cuál necesitas ayuda? 🐾` : "No tengo un catálogo de servicios activo para confirmar esa información. El equipo puede revisarlo. 🐾";
  } catch {
    return "No pude verificar el catálogo ahora. No quiero darte información incorrecta; el equipo puede confirmarla. 🐾";
  }
};
module.exports = { listBusinessServices };
