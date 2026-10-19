const EXTRA_PERMISSIONS = ['cash', 'appointment_price', 'inventory_consume', 'administration'];
const ROLES = ['admin', 'vet', 'groomer', 'receptionist'];

function validAccessPermissions(permissions) {
  return Array.isArray(permissions) && permissions.every(p => EXTRA_PERMISSIONS.includes(p));
}

// Professional identity and administrative authority are separate. Callers
// must supply the current persisted Staff, never client-supplied permissions.
function staffAccessRole(staff) {
  if (!ROLES.includes(staff?.role)) return staff?.role;
  return staff.role === 'admin' || staff.accessPermissions?.includes('administration') ? 'admin' : staff.role;
}

module.exports = { EXTRA_PERMISSIONS, ROLES, validAccessPermissions, staffAccessRole };
