import { Skeleton } from "@/components/ui/skeleton";

type LoadingKind = "list" | "home" | "calendar" | "sale" | "chat";

/** Neutral placeholders: no financial values, patient details or empty-state claims. */
export function DashboardLoading({ title = "tu espacio de trabajo", kind = "list" }: { title?: string; kind?: LoadingKind }) {
  return <section aria-busy="true" aria-label={`Cargando ${title}`} className="mx-auto w-full max-w-[1500px] space-y-6">
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Cargando {title}…</p>
    <div aria-hidden="true" className="space-y-6 [&_[data-slot=skeleton]]:motion-reduce:animate-none">
      <div className="space-y-3"><Skeleton className="h-8 w-3/4 max-w-xs" /><Skeleton className="h-4 w-full max-w-md" /></div>
      {kind === "home" && <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map(index => <div key={index} className="rounded-2xl border bg-card p-5"><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-8 w-16" /></div>)}</div>}
      <div className={`grid gap-5 ${kind === "home" || kind === "sale" ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : kind === "chat" ? "md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : ""}`}>
        <div className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="mb-6 flex flex-wrap gap-3"><Skeleton className="h-10 w-full max-w-xs" /><Skeleton className="h-10 w-24" /></div>
          {kind === "calendar" ? <div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-64 w-full" />)}</div>
            : <div className="space-y-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="flex items-center gap-3 rounded-xl border p-3"><Skeleton className="size-10 shrink-0 rounded-xl" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-4/5" /></div></div>)}</div>}
        </div>
        {(kind === "home" || kind === "sale" || kind === "chat") && <div className="min-w-0 space-y-5 rounded-2xl border bg-card p-6"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-28 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div>}
      </div>
    </div>
  </section>;
}
