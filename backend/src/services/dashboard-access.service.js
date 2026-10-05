const MODULES = ["veterinary", "grooming", "retail"];
const EXTRA_PERMISSIONS = ["cash", "appointment_price", "inventory_consume"];
const ROLES = ["admin", "vet", "groomer", "receptionist"];

function effectiveAccess(actor, modules) {
  const role = actor?.type ?? "admin";
  const activeModules = [...new Set((modules ?? ["veterinary", "grooming"]).filter(m => MODULES.includes(m)))];
  const known = ROLES.includes(role);
  const admin = known && role === "admin";
  const services = activeModules.some(m => m !== "retail");
  const extras = (actor?.accessPermissions ?? []).filter(p => EXTRA_PERMISSIONS.includes(p));
  const clinical = activeModules.includes("veterinary") && (admin || role === "vet");
  const grooming = activeModules.includes("grooming") && (admin || role === "groomer");
  const cash = known && (admin || role === "receptionist" || extras.includes("cash"));
  const inventoryConsume = (clinical || grooming) && (admin || extras.includes("inventory_consume"));
  const capabilities = {
    administration: admin, finance: admin, chat: known,
    contacts: admin || role === "receptionist",
    agenda: services && (admin || role === "receptionist" || clinical || grooming),
    schedule: services && (admin || role === "receptionist"),
    clinical, grooming, cash,
    appointmentPrice: services && (admin || extras.includes("appointment_price")),
    retail: activeModules.includes("retail"),
    services,
    inventory_read: admin || (cash && activeModules.includes("retail")) || inventoryConsume,
    inventory_manage: admin,
    inventory_consume: inventoryConsume,
  };
  const navigation = ["/dashboard"];
  if (capabilities.agenda) navigation.push("/dashboard/calendar");
  if (clinical) navigation.push("/dashboard/consultas");
  if (grooming) navigation.push("/dashboard/peluqueria");
  if (capabilities.contacts) navigation.push("/dashboard/contacto", "/dashboard/clients", "/dashboard/pets");
  if (known) navigation.push("/dashboard/conversations");
  if (cash) navigation.push("/dashboard/pos");
  if (capabilities.inventory_read) navigation.push("/dashboard/inventory");
  if (admin) navigation.push("/dashboard/settings", "/dashboard/staff", "/dashboard/services", "/dashboard/billing", "/dashboard/recuperacion", "/dashboard/churn", "/dashboard/opportunities", "/dashboard/reactivation", "/dashboard/revenue", "/dashboard/reports", "/dashboard/admin/tenants-overview");
  return { role, staffId: actor?.staffId ?? null, activeModules, accessPermissions: extras, capabilities, navigation: known ? navigation : [] };
}

function actorSnapshot(actor, prefix) {
  return { [`${prefix}ActorId`]: actor?.staffId ? `staff:${actor.staffId}` : actor?.email ? `admin:${actor.email}` : null,
    [`${prefix}ActorName`]: actor?.name || null, [`${prefix}ActorRole`]: actor?.type || null };
}

function serviceModule(row) {
  const category = row?.service?.category?.name ?? row?.category?.name;
  if (category === "grooming" || category === "veterinary") return category;
  const type = String(row?.availabilityBucket || row?.serviceType || "").toLowerCase();
  if (/groom|baño|bath|corte|peluquer|spa|deslan|antipulgas|colorimetr/.test(type)) return "grooming";
  if (/vet|consult|vacun|despar|cirug|ecograf|laboratorio|rayos|urgenc/.test(type)) return "veterinary";
  return null;
}

function moduleAllowsAppointment(access, row) {
  const module = serviceModule(row);
  return module ? access.activeModules.includes(module) : access.capabilities.services;
}

function operationalPet(pet) {
  return { id: pet.id, name: pet.name, type: pet.type, breed: pet.breed ?? null, gender: pet.gender ?? null,
    birthDate: pet.birthDate ?? null, ownerId: pet.ownerId, owner: pet.owner,
    operationalAlerts: pet.operationalAlerts ?? null, _count: { appointments: pet._count?.appointments ?? 0 } };
}

module.exports = { MODULES, EXTRA_PERMISSIONS, ROLES, effectiveAccess, actorSnapshot, serviceModule, moduleAllowsAppointment, operationalPet };
