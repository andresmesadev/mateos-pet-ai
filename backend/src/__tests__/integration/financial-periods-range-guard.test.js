/**
 * Fix post-auditoría de seguridad (2026-09-07, hallazgo F2): un rango de
 * fechas sin límite en /financial-history (y /financial-periods) desataba
 * un fan-out de queries por día capaz de tumbar el backend (única instancia
 * en el VPS). Cubre la validación de rango agregada a nivel de ruta, antes
 * de que el request llegue a enumerateDates.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../contexts/finance", () => ({
  generateFinancialPeriod: jest.fn(),
  getFinancialPeriod: jest.fn(),
  getFinancialHistory: jest.fn().mockResolvedValue({ days: [] }),
}));

const { getFinancialHistory, generateFinancialPeriod } = require("../../contexts/finance");
const financialPeriodsRoutes = require("../../routes/dashboard/financial-periods.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: "tenant-a" };
    next();
  });
  app.use("/api/dashboard", financialPeriodsRoutes);
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe("GET /financial-history — límite de rango (hallazgo F2)", () => {
  test("rango razonable (30 días) pasa y llega al caso de uso", async () => {
    const res = await request(buildApp()).get(
      "/api/dashboard/financial-history?from=2026-01-01&to=2026-01-31"
    );
    expect(res.status).toBe(200);
    expect(getFinancialHistory).toHaveBeenCalled();
  });

  test("rango de miles de días es rechazado con 400 antes de tocar el caso de uso", async () => {
    const res = await request(buildApp()).get(
      "/api/dashboard/financial-history?from=2015-01-01&to=2026-01-01"
    );
    expect(res.status).toBe(400);
    expect(getFinancialHistory).not.toHaveBeenCalled();
  });

  test("rango extremo permitido por el regex YYYY-MM-DD (0001 a 9999) también es rechazado", async () => {
    const res = await request(buildApp()).get(
      "/api/dashboard/financial-history?from=0001-01-01&to=9999-12-31"
    );
    expect(res.status).toBe(400);
    expect(getFinancialHistory).not.toHaveBeenCalled();
  });

  test("rango invertido (to antes de from) es rechazado", async () => {
    const res = await request(buildApp()).get(
      "/api/dashboard/financial-history?from=2026-02-01&to=2026-01-01"
    );
    expect(res.status).toBe(400);
    expect(getFinancialHistory).not.toHaveBeenCalled();
  });
});

describe("POST /financial-periods — mismo límite de rango", () => {
  test("rango amplio es rechazado con 400 antes de generateFinancialPeriod", async () => {
    const res = await request(buildApp())
      .post("/api/dashboard/financial-periods")
      .send({ periodStart: "2000-01-01", periodEnd: "2026-01-01" });
    expect(res.status).toBe(400);
    expect(generateFinancialPeriod).not.toHaveBeenCalled();
  });
});
