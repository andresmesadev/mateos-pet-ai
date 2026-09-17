CREATE TABLE "AgendaException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "startDate" VARCHAR(10) NOT NULL,
    "endDate" VARCHAR(10),
    "open" VARCHAR(5),
    "close" VARCHAR(5),
    "reason" VARCHAR(240),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaException_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgendaException_scope_check" CHECK ("scope" IN ('all', 'vet', 'grooming')),
    CONSTRAINT "AgendaException_mode_check" CHECK ("mode" IN ('closed', 'open')),
    CONSTRAINT "AgendaException_dates_check" CHECK (
      "startDate" ~ '^\\d{4}-\\d{2}-\\d{2}$'
      AND ("endDate" IS NULL OR ("endDate" ~ '^\\d{4}-\\d{2}-\\d{2}$' AND "endDate" >= "startDate"))
    ),
    CONSTRAINT "AgendaException_window_check" CHECK (
      ("mode" = 'closed' AND "open" IS NULL AND "close" IS NULL)
      OR
      ("mode" = 'open' AND "open" ~ '^([01]\\d|2[0-3]):[0-5]\\d$' AND "close" ~ '^([01]\\d|2[0-3]):[0-5]\\d$' AND "open" < "close")
    )
);

CREATE INDEX "AgendaException_tenantId_startDate_endDate_idx"
  ON "AgendaException"("tenantId", "startDate", "endDate");
CREATE INDEX "AgendaException_tenantId_scope_startDate_endDate_idx"
  ON "AgendaException"("tenantId", "scope", "startDate", "endDate");

ALTER TABLE "AgendaException"
  ADD CONSTRAINT "AgendaException_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
