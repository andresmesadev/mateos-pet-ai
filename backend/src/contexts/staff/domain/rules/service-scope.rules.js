function compatibleRole(staff, category) {
  return staff.role === 'admin' || staff.role === (category === 'grooming' ? 'groomer' : 'vet');
}
function canProvideService(staff, capabilities, serviceId) {
  if (staff.serviceScope === 'role') return true;
  if (staff.serviceScope !== 'selected' && capabilities.length === 0) return true;
  return capabilities.some(c => c.active && c.serviceId === serviceId);
}
module.exports = { compatibleRole, canProvideService };
