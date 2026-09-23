// Bootstrap a fresh, disposable development installation after migrations.
// The WhatsApp phone-number ID is read from the existing server environment.
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const prisma = require("../lib/prisma");
const { provisionDefaultDigitalEmployees } = require("../services/tenant-provisioning.service");

async function main() {
  const phone = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!/^\d+$/.test(phone)) throw new Error("WHATSAPP_PHONE_NUMBER_ID is missing or invalid");

  let tenant = await prisma.tenant.findUnique({ where: { phone } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: "Mateos Pet AI", slug: "mateos-pet-ai", phone },
    });
  }

  const provisioning = await provisionDefaultDigitalEmployees(tenant.id);
  const failed = provisioning.results.filter((result) => result.error);
  if (failed.length) throw new Error(`Digital employee provisioning failed: ${failed.map((result) => result.specialization).join(", ")}`);

  console.log(JSON.stringify({ tenantId: tenant.id, digitalEmployees: provisioning.results.length }));
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

