"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { proxyUrl } from "@/lib/api";

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

type StaffBreakdown = {
  staffId: string | null;
  staffName: string;
  count: number;
  revenue: number;
  staffShare: number;
  businessShare: number;
};

type DailyCloseSummary = {
  date: string;
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    pending: number;
  };
  commissions: {
    count: number;
    totalRevenue: number;
    totalStaffShare: number;
    totalBusinessShare: number;
    byStaff: StaffBreakdown[];
  };
  missingCommissionsCount: number;
};

function Row({ label, value, highlight = false, warn = false }: {
  label: string; value: string; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${warn ? "text-amber-500" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm font-medium tabular-nums ${highlight ? "text-foreground text-base font-bold" : warn ? "text-amber-500" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border/50 my-2" />;
}

export function DailyCloseSheet() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DailyCloseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openSheet() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(proxyUrl("/api/dashboard/daily-close"), { cache: "no-store" });
      if (!res.ok) throw new Error("Error al cargar el cierre del día");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs font-medium border-teal-500/40 text-teal-400 hover:bg-teal-500/10 hover:text-teal-300"
        onClick={openSheet}
      >
        Cerrar día
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-background shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06]">
              <div>
                <h2 className="text-base font-semibold">Cierre del día</h2>
                {data && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(`${data.date}T12:00:00Z`).toLocaleDateString("es-CO", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {loading && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Calculando cierre…
                </div>
              )}

              {error && (
                <div className="py-6 text-center text-sm text-red-400">{error}</div>
              )}

              {data && !loading && (
                <>
                  {/* Appointment summary */}
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Citas</p>
                  <Row label="Total del día" value={String(data.appointments.total)} />
                  <Row label="Completadas" value={String(data.appointments.completed)} />
                  {data.appointments.cancelled > 0 && (
                    <Row label="Canceladas" value={String(data.appointments.cancelled)} />
                  )}
                  {data.appointments.noShow > 0 && (
                    <Row label="No asistió" value={String(data.appointments.noShow)} />
                  )}
                  {data.appointments.pending > 0 && (
                    <Row label="Pendientes aún" value={String(data.appointments.pending)} warn />
                  )}

                  <Divider />

                  {/* Revenue */}
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Ingresos grooming</p>
                  {data.commissions.count === 0 ? (
                    <p className="text-sm text-muted-foreground py-1">Sin comisiones registradas hoy.</p>
                  ) : (
                    <>
                      <Row label="Total facturado" value={COP.format(data.commissions.totalRevenue)} highlight />
                      <Row label="Parte del negocio" value={COP.format(data.commissions.totalBusinessShare)} />
                      <Row label="Parte del staff" value={COP.format(data.commissions.totalStaffShare)} />
                    </>
                  )}

                  {/* Per-staff breakdown */}
                  {data.commissions.byStaff.length > 0 && (
                    <>
                      <Divider />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Por profesional</p>
                      {data.commissions.byStaff.map((s) => (
                        <div key={s.staffId ?? "__unassigned__"} className="mb-3 last:mb-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${!s.staffId ? "text-amber-500" : "text-foreground"}`}>
                              {s.staffName}
                            </span>
                            <span className="text-xs text-muted-foreground">{s.count} {s.count === 1 ? "cita" : "citas"}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs text-muted-foreground">Comisión</span>
                            <span className="text-xs font-medium tabular-nums">{COP.format(s.staffShare)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Negocio</span>
                            <span className="text-xs font-medium tabular-nums">{COP.format(s.businessShare)}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Missing commissions warning */}
                  {data.missingCommissionsCount > 0 && (
                    <>
                      <Divider />
                      <div className="flex items-start gap-2 text-amber-500 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <span>
                          {data.missingCommissionsCount} cita{data.missingCommissionsCount > 1 ? "s" : ""} completada{data.missingCommissionsCount > 1 ? "s" : ""} sin precio registrado.
                          La comisión no pudo calcularse para {data.missingCommissionsCount > 1 ? "ellas" : "ella"}.
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-3 border-t border-white/[0.06]">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
