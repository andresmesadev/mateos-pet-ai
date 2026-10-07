-- Repair doubled backslashes in the original SQL regexes.
-- Character classes avoid relying on string/backslash settings in PostgreSQL.
ALTER TABLE "AgendaException"
  DROP CONSTRAINT "AgendaException_dates_check",
  ADD CONSTRAINT "AgendaException_dates_check" CHECK (
    "startDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND ("endDate" IS NULL OR ("endDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND "endDate" >= "startDate"))
  ),
  DROP CONSTRAINT "AgendaException_window_check",
  ADD CONSTRAINT "AgendaException_window_check" CHECK (
    ("mode" = 'closed' AND "open" IS NULL AND "close" IS NULL)
    OR
    ("mode" = 'open' AND "open" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "close" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "open" < "close")
  );
