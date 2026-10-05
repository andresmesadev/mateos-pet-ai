"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OpportunitiesView } from "@/components/dashboard/opportunities-view";
import { ReactivationCampaign } from "@/components/dashboard/reactivation-campaign";
import { ChurnView } from "@/components/dashboard/churn-view";
import { RecoveryCard } from "@/components/dashboard/recovery-card";
import type { RecuperacionData } from "@/app/dashboard/recuperacion/page";
const TAB_STYLE = "min-h-11 px-4 data-active:bg-teal-700 data-active:text-white data-active:hover:text-white";

export function RecuperacionView({ data, grooming, initialTab }: { data: RecuperacionData; grooming: boolean; initialTab: string }) {
  const router = useRouter();
  const [frequency, setFrequency] = useState(initialTab === "churn");
  function unavailable(label: string) { return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold">No se pudo cargar {label}</h2><p className="my-2 text-sm">Intenta de nuevo para consultar los datos del establecimiento.</p><Button variant="outline" onClick={() => router.refresh()}>Reintentar</Button></div>; }
  return <Tabs defaultValue={grooming && ["reactivar", "churn"].includes(initialTab) ? "clientes" : initialTab === "resultados" ? "resultados" : "pendientes"} className="gap-5">
    <TabsList aria-label="Seguimiento de clientes" className="h-auto max-w-full flex-wrap justify-start gap-1 border bg-white p-1 group-data-horizontal/tabs:h-auto">
      <TabsTrigger value="pendientes" className={TAB_STYLE}>Pendientes{data.opportunities ? ` · ${data.opportunities.total}` : ""}</TabsTrigger>
      {grooming && <TabsTrigger value="clientes" className={TAB_STYLE}>Clientes por contactar</TabsTrigger>}
      <TabsTrigger value="resultados" className={TAB_STYLE}>Resultados</TabsTrigger>
    </TabsList>
    <TabsContent value="pendientes"><OpportunitiesView data={data.opportunities} /></TabsContent>
    {grooming && <TabsContent value="clientes" className="space-y-5">
      <div><h2 className="text-xl font-semibold">Continuidad de peluquería</h2><p className="mt-1 text-sm text-muted-foreground">Revisa las visitas registradas antes de contactar. Estos criterios no indican el estado de salud de la mascota.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant={frequency ? "outline" : "default"} aria-pressed={!frequency} onClick={() => setFrequency(false)}>Sin visita en más de 60 días</Button><Button variant={frequency ? "default" : "outline"} aria-pressed={frequency} onClick={() => setFrequency(true)}>Según frecuencia habitual</Button></div>
      {frequency ? data.churn ? <ChurnView clients={data.churn} /> : unavailable("la frecuencia de visitas") : data.inactive ? <ReactivationCampaign initialData={data.inactive} /> : unavailable("los clientes por contactar")}
    </TabsContent>}
    <TabsContent value="resultados" className="space-y-4"><Button variant="outline" onClick={() => router.refresh()}>Actualizar resultados</Button>{data.metrics ? <RecoveryCard metrics={data.metrics} grooming={grooming} /> : unavailable("los resultados")}</TabsContent>
  </Tabs>;
}
