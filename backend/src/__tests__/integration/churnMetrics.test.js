const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  user: { findMany: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const dashboardRoutes = require("../../routes/dashboard.routes");

const TENANT_ID = "tenant-a";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: TENANT_ID };
    next();
  });
  app.use("/api/dashboard", dashboardRoutes);
  return app;
}

const app = buildApp();

// Helper: genera citas completadas con intervalos fijos
function makeAppts(dates) {
  return dates.map((d) => ({
    date: new Date(d),
    petName: "Max",
  }));
}

describe("GET /api/dashboard/metrics/churn", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with empty array when no users", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/dashboard/metrics/churn");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("excludes clients with fewer than 2 completed appointments", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Ana",
        phone: "573001111111",
        appointments: [{ date: new Date("2026-01-01T00:00:00Z"), petName: "Lola" }],
      },
    ]);
    const res = await request(app).get("/api/dashboard/metrics/churn");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("flags client as high risk when overdue >= 2x their cycle", async () => {
    // 2 citas con 30 días de diferencia → avgInterval = 30 days
    // Last visit = 90 days ago → overdueRatio = 3.0 → high
    const now = Date.now();
    const MS_DAY = 86400000;
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Carlos",
        phone: "573002222222",
        appointments: makeAppts([
          new Date(now - 90 * MS_DAY).toISOString(),
          new Date(now - 60 * MS_DAY).toISOString(),
        ]),
      },
    ]);
    const res = await request(app).get("/api/dashboard/metrics/churn");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].riskLevel).toBe("high");
    expect(res.body[0].name).toBe("Carlos");
  });

  it("flags client as medium risk when overdue 1.3x–2x their cycle", async () => {
    const now = Date.now();
    const MS_DAY = 86400000;
    // avgInterval = 30 days, last visit = 45 days ago → ratio = 1.5 → medium
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u2",
        name: "Maria",
        phone: "573003333333",
        appointments: makeAppts([
          new Date(now - 75 * MS_DAY).toISOString(),
          new Date(now - 45 * MS_DAY).toISOString(),
        ]),
      },
    ]);
    const res = await request(app).get("/api/dashboard/metrics/churn");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].riskLevel).toBe("medium");
  });

  it("excludes clients still within their normal visit window", async () => {
    const now = Date.now();
    const MS_DAY = 86400000;
    // avgInterval = 60 days, last visit = 30 days ago → ratio = 0.5 → not at risk
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u3",
        name: "Luis",
        phone: "573004444444",
        appointments: makeAppts([
          new Date(now - 90 * MS_DAY).toISOString(),
          new Date(now - 30 * MS_DAY).toISOString(),
        ]),
      },
    ]);
    const res = await request(app).get("/api/dashboard/metrics/churn");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("sorts results by overdueRatio descending", async () => {
    const now = Date.now();
    const MS_DAY = 86400000;
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Medium",
        phone: "573001111111",
        // avgInterval=30, lastVisit=45 days ago → ratio 1.5
        appointments: makeAppts([
          new Date(now - 75 * MS_DAY).toISOString(),
          new Date(now - 45 * MS_DAY).toISOString(),
        ]),
      },
      {
        id: "u2",
        name: "High",
        phone: "573002222222",
        // avgInterval=30, lastVisit=90 days ago → ratio 3.0
        appointments: makeAppts([
          new Date(now - 120 * MS_DAY).toISOString(),
          new Date(now - 90 * MS_DAY).toISOString(),
        ]),
      },
    ]);
    const res = await request(app).get("/api/dashboard/metrics/churn");
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("High");
    expect(res.body[1].name).toBe("Medium");
  });

  it("respects ?limit param", async () => {
    const now = Date.now();
    const MS_DAY = 86400000;
    const users = Array.from({ length: 5 }, (_, i) => ({
      id: `u${i}`,
      name: `Client ${i}`,
      phone: `5730000000${i}`,
      appointments: makeAppts([
        new Date(now - (120 + i) * MS_DAY).toISOString(),
        new Date(now - (90 + i) * MS_DAY).toISOString(),
      ]),
    }));
    prisma.user.findMany.mockResolvedValue(users);
    const res = await request(app).get("/api/dashboard/metrics/churn?limit=3");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(3);
  });

  it("returns 500 on database error", async () => {
    prisma.user.findMany.mockRejectedValue(new Error("db down"));
    const res = await request(app).get("/api/dashboard/metrics/churn");
    expect(res.status).toBe(500);
  });
});
