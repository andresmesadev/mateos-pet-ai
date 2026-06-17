const prisma = require("../lib/prisma");

const listStaff = async (tenantId) => {
  return prisma.staff.findMany({
    where: { tenantId, active: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
};

const getStaff = async (id) => {
  return prisma.staff.findUnique({ where: { id } });
};

const createStaff = async (tenantId, data) => {
  return prisma.staff.create({ data: { ...data, tenantId } });
};

const updateStaff = async (id, data) => {
  return prisma.staff.update({ where: { id }, data });
};

const deleteStaff = async (id) => {
  return prisma.staff.update({ where: { id }, data: { active: false } });
};

module.exports = { listStaff, getStaff, createStaff, updateStaff, deleteStaff };
