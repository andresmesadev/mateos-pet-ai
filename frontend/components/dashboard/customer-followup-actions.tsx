"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NewAppointmentDialog } from "@/components/dashboard/new-appointment-dialog";
import { useDashboardAccess } from "@/components/dashboard/dashboard-access-provider";
import { proxyUrl } from "@/lib/api";
import { tenantQuery, useTenant } from "@/lib/use-tenant";

export function CustomerFollowupActions({ ownerId, petId, conversationId, category }: {
  ownerId: string | null; petId?: string; conversationId?: string | null;
  category?: "grooming" | "veterinary";
}) {
  const tenant = useTenant();
  const router = useRouter();
  const access = useDashboardAccess();
  const [appointment, setAppointment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suffix = tenant ? `&tenant=${encodeURIComponent(tenant)}` : "";
  async function openChat() {
    if (!ownerId) return;
    setLoading(true); setError(null);
    try {
      let id = conversationId;
      if (!id) {
        const res = await fetch(proxyUrl(`/api/dashboard/clients/${encodeURIComponent(ownerId)}${tenantQuery(tenant)}`), { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo consultar la conversación. Intenta de nuevo.");
        id = (await res.json()).latestConversationId;
      }
      if (!id) { setError("Este cliente aún no tiene una conversación de WhatsApp en el establecimiento."); return; }
      router.push(`/dashboard/conversations?conversation=${encodeURIComponent(id)}${suffix}`);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo abrir WhatsApp."); }
    finally { setLoading(false); }
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild><Link href={petId ? `/dashboard/contacto?view=mascotas&pet=${encodeURIComponent(petId)}${suffix}` : `/dashboard/contacto?client=${encodeURIComponent(ownerId ?? "")}${suffix}`}>{petId ? "Ver expediente" : "Ver cliente"}</Link></Button>
      {access?.capabilities.chat && ownerId && <Button variant="outline" size="sm" disabled={loading} onClick={openChat}>{loading ? "Abriendo…" : "WhatsApp"}</Button>}
      {access?.capabilities.schedule && ownerId && <Button variant="outline" size="sm" onClick={() => setAppointment(true)}>Agendar cita</Button>}
    </div>
    {error && <p role="status" className="max-w-lg text-sm text-amber-800">{error}</p>}
    {appointment && <NewAppointmentDialog initialDate={new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date())} initialClientId={ownerId ?? undefined} initialPetId={petId} serviceCategory={category} onClose={() => setAppointment(false)} onCreated={() => { setAppointment(false); router.refresh(); }} />}
  </div>;
}
