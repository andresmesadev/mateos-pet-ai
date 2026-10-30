const prisma = require("../lib/prisma");
const { hashPassword, normalizeEmail, validPassword } = require("./staff-credential.service");

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MODULES = ["veterinary", "grooming", "retail"];
const FIELDS = new Set(["name", "slug", "ownerName", "email", "password", "activeModules"]);

function invalid(message, field) {
  return Object.assign(new Error(message), { status: 400, field });
}

function validSlug(slug) {
  return typeof slug === "string" && slug.length >= 2 && slug.length <= 63 && SLUG.test(slug);
}

function registrationInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !FIELDS.has(key))) {
    throw invalid("Revisa los datos del formulario.");
  }
  const text = value => typeof value === "string" ? value.trim() : "";
  const name = text(body.name);
  const slug = text(body.slug).toLowerCase();
  const ownerName = text(body.ownerName);
  const email = normalizeEmail(body.email);
  if (name.length < 2 || name.length > 120) throw invalid("Escribe un nombre de negocio de entre 2 y 120 caracteres.", "name");
  if (!validSlug(slug)) throw invalid("Usa entre 2 y 63 letras minúsculas, números y guiones, sin guiones al inicio o al final.", "slug");
  if (ownerName.length < 2 || ownerName.length > 100) throw invalid("Escribe tu nombre, entre 2 y 100 caracteres.", "ownerName");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid("Escribe un correo electrónico válido.", "email");
  if (!validPassword(body.password)) throw invalid("La contraseña debe tener entre 12 y 128 caracteres.", "password");
  const activeModules = body.activeModules;
  if (!Array.isArray(activeModules) || !activeModules.length || activeModules.length > MODULES.length ||
      activeModules.some(module => !MODULES.includes(module)) || new Set(activeModules).size !== activeModules.length) {
    throw invalid("Selecciona al menos una actividad del negocio.", "activeModules");
  }
  return { name, slug, ownerName, email, password: body.password, activeModules };
}

async function registerTenantAdministrator(body) {
  const input = registrationInput(body);
  if (process.env.ADMIN_EMAIL && normalizeEmail(process.env.ADMIN_EMAIL) === input.email) {
    throw Object.assign(new Error("El correo ya tiene un acceso reservado."), { status: 409 });
  }
  const passwordHash = await hashPassword(input.password);
  // Nested writes are atomic. No caller-supplied role or tenant is accepted.
  return prisma.tenant.create({
    data: {
      name: input.name, slug: input.slug, email: input.email,
      plan: "free", activeModules: input.activeModules,
      // A new business chooses its own opening hours instead of inheriting
      // the legacy 11–17 fallback used by existing establishments.
      businessHours: Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => [day, { active: false, open: "", close: "" }])),
      staff: { create: {
        name: input.ownerName, email: input.email, role: "admin",
        serviceScope: "selected", generatesCommission: false,
        credential: { create: { email: input.email, passwordHash } },
      } },
    },
    select: { id: true, name: true, slug: true, plan: true },
  });
}

module.exports = { validSlug, registrationInput, registerTenantAdministrator };
