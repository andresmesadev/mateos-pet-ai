const prisma = require("../lib/prisma");

const listServices = async (tenantId) => {
  return prisma.service.findMany({
    where: { tenantId, active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
};

const getService = async (id) => {
  return prisma.service.findUnique({ where: { id } });
};

const createService = async (tenantId, data) => {
  return prisma.service.create({
    data: { ...data, tenantId },
  });
};

const updateService = async (id, data) => {
  return prisma.service.update({ where: { id }, data });
};

const deleteService = async (id) => {
  return prisma.service.update({ where: { id }, data: { active: false } });
};

module.exports = { listServices, getService, createService, updateService, deleteService };
