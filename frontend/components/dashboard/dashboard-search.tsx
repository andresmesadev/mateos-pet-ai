"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { proxyUrl } from "@/lib/api";
import { homeHref } from "@/lib/home-workspace";
import { formatPhone, getPetEmoji } from "@/lib/pets";

type SearchUser = { id: string; name: string | null; phone: string };
type SearchPet = { id: string; name: string; type: string; breed: string | null; owner: SearchUser };
type Results = { users: SearchUser[]; pets: SearchPet[] };

export function DashboardSearch({ tenant }: { tenant: string | null }) {
  const router = useRouter(), id = useId();
  const [query, setQuery] = useState(""), [mobileOpen, setMobileOpen] = useState(false), [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ query: string; tenant: string | null; data: Results } | null>(null);
  const [error, setError] = useState<string | null>(null), [searching, setSearching] = useState(false), [retry, setRetry] = useState(0);
  const [active, setActive] = useState(-1);
  const container = useRef<HTMLDivElement>(null), mobileInput = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const q = query.trim();
  const data = result?.query === q && result.tenant === tenant ? result.data : null;
  const options = [...(data?.users ?? []).map(user => ({ key: "user:" + user.id, label: user.name || formatPhone(user.phone), detail: user.name ? formatPhone(user.phone) : "Propietario", icon: (user.name?.[0] ?? "#").toUpperCase(), href: `/dashboard/contacto?client=${encodeURIComponent(user.id)}` })), ...(data?.pets ?? []).map(pet => ({ key: "pet:" + pet.id, label: pet.name, detail: [pet.breed, pet.owner.name || formatPhone(pet.owner.phone)].filter(Boolean).join(" · "), icon: getPetEmoji(pet.type), href: `/dashboard/contacto?view=mascotas&pet=${encodeURIComponent(pet.id)}` }))];

  useEffect(() => {
    const controller = new AbortController();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true); setError(null);
      try {
        const params = new URLSearchParams({ q }); if (tenant) params.set("tenantId", tenant);
        const response = await fetch(proxyUrl(`/api/dashboard/search?${params}`), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("No se pudo completar la búsqueda.");
        const data = await response.json() as Results;
        if (!Array.isArray(data.users) || !Array.isArray(data.pets)) throw new Error("No se pudo comprobar el resultado.");
        if (!controller.signal.aborted) { setResult({ query: q, tenant, data }); setActive(-1); }
      } catch (cause) { if (!controller.signal.aborted) { setResult(null); setError(cause instanceof Error ? cause.message : "Intenta de nuevo."); } }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 280);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, tenant, retry]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!mobileOpen && !container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [mobileOpen]);

  function change(value: string) { setQuery(value.slice(0, 80)); setOpen(true); setActive(-1); setError(null); setSearching(false); }
  function select(href: string) {
    setMobileOpen(false); setOpen(false); setQuery(""); setResult(null); setActive(-1);
    router.push(homeHref(href, tenant));
  }
  function keys(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && !mobileOpen) { setOpen(false); setQuery(""); }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
      event.preventDefault(); setOpen(true);
      setActive(value => event.key === "ArrowDown" ? (value + 1) % options.length : (value < 0 ? options.length - 1 : (value - 1 + options.length) % options.length));
    }
    if (event.key === "Enter" && q.length >= 2) { event.preventDefault(); select(options[active]?.href ?? `/dashboard/contacto?search=${encodeURIComponent(q)}`); }
  }
  function input(mobile: boolean) {
    const listId = `${id}-${mobile ? "mobile" : "desktop"}-results`;
    return <div className="relative"><Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input ref={mobile ? mobileInput : undefined} type="search" role="combobox" aria-autocomplete="list" aria-expanded={mobile || open} aria-controls={listId} aria-activedescendant={active >= 0 && options[active] ? `${listId}-${active}` : undefined} value={query} maxLength={80} onChange={event => change(event.target.value)} onKeyDown={keys} onFocus={() => setOpen(true)} placeholder="Buscar clientes o mascotas…" aria-label="Buscar clientes o mascotas" className={`min-h-11 rounded-xl border bg-muted/30 py-2 pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-primary ${mobile ? "w-full" : "w-64 md:w-80"}`} /></div>;
  }
  function results(mobile: boolean) {
    const listId = `${id}-${mobile ? "mobile" : "desktop"}-results`;
    return <div className="max-h-[min(55dvh,24rem)] overflow-y-auto">
      {q.length < 2 ? <p role="status" className="p-4 text-sm text-muted-foreground">Escribe al menos 2 caracteres del nombre o teléfono.</p> : error ? <div role="alert" className="p-4 text-sm text-amber-900"><p>{error}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => { setError(null); setRetry(value => value + 1); }}>Reintentar búsqueda</Button></div> : searching || !data ? <p role="status" className="p-4 text-sm text-muted-foreground">Buscando…</p> : !options.length ? <p role="status" className="p-4 text-sm text-muted-foreground">Sin resultados para «{q}». Prueba otro nombre o teléfono.</p> : null}
      <div id={listId} role="listbox" aria-label="Resultados de clientes y mascotas">{!error && !searching && options.map((option, index) => <button key={option.key} id={`${listId}-${index}`} type="button" role="option" aria-selected={active === index} onClick={() => select(option.href)} className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary ${active === index ? "bg-accent" : "hover:bg-muted/50"}`}><span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-full ${option.key.startsWith("pet:") ? "bg-amber-50" : "bg-violet-50 text-violet-700"}`}>{option.icon}</span><span className="min-w-0"><span className="block break-words font-semibold">{option.label}</span><span className="block break-words text-xs text-muted-foreground">{option.detail}</span></span></button>)}</div>
    </div>;
  }

  return <>
    <div ref={container} className="relative hidden sm:block">{input(false)}{open && <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-popover shadow-lg">{results(false)}</div>}</div>
    <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
      <DialogTrigger asChild><Button ref={trigger} variant="outline" size="icon" className="size-11 shrink-0 sm:hidden" aria-label="Abrir búsqueda de clientes y mascotas"><Search className="size-5" /></Button></DialogTrigger>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg p-4" onOpenAutoFocus={event => { event.preventDefault(); mobileInput.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        <DialogTitle className="pr-8 text-lg font-semibold">Buscar clientes y mascotas</DialogTitle><DialogDescription className="mt-1 text-sm text-muted-foreground">Encuentra un propietario o abre el expediente de su mascota.</DialogDescription><div className="mt-4">{input(true)}</div><div className="mt-2 rounded-xl border">{results(true)}</div>
      </DialogContent>
    </Dialog>
  </>;
}
