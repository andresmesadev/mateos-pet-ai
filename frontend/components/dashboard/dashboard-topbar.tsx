"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Calendar, MessageCircle, Search } from "lucide-react";
import { useTenant } from "@/lib/use-tenant";
import { proxyUrl } from "@/lib/api";
import { formatPhone, getPetEmoji } from "@/lib/pets";

type SearchUser = { id: string; name: string | null; phone: string };
type SearchPet = {
  id: string;
  name: string;
  type: string;
  breed: string | null;
  owner: SearchUser;
};
type SearchResults = { users: SearchUser[]; pets: SearchPet[] };

function todayLabel(): string {
  const s = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function DashboardTopbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const tenant = useTenant();
  const isHome = pathname === "/dashboard";

  const PAGE_NAMES: Record<string, string> = {
    "/dashboard/calendar": "Agenda",
    "/dashboard/contacto": "Clientes",
    "/dashboard/conversations": "WhatsApp",
    "/dashboard/pos": "Caja / Ventas",
    "/dashboard/recuperacion": "Recuperación",
    "/dashboard/settings": "Administración",
  };
  const currentPageName = Object.entries(PAGE_NAMES).find(([key]) =>
    pathname.startsWith(key)
  )?.[1];

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 280);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults(null);
        setOpen(false);
        return;
      }
      setSearching(true);
      try {
        const params = new URLSearchParams({ q });
        if (tenant) params.set("tenantId", tenant);
        const url = proxyUrl(`/api/dashboard/search?${params.toString()}`);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json() as SearchResults;
        setResults(data);
        setOpen(true);
      } catch {
        setResults(null);
      } finally {
        setSearching(false);
      }
    },
    [tenant]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void search(debouncedQuery);
  }, [debouncedQuery, search]);

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(href: string) {
    router.push(href);
    setQuery("");
    setOpen(false);
    setResults(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (q) {
        router.push(`/dashboard/contacto?search=${encodeURIComponent(q)}`);
        setQuery("");
        setOpen(false);
      }
    }
  }

  const hasResults = results && (results.users.length > 0 || results.pets.length > 0);
  const rawName = session?.user?.name ?? "";
  const firstName = rawName.split(" ")[0] || "de nuevo";

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-white/[0.06] bg-background/70 px-4 py-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-8 md:py-4" style={{ boxShadow: "0 1px 0 oklch(1 0 0 / 5%) inset, 0 1px 20px -4px rgba(0,0,0,0.4)" }}>
      {/* Saludo (solo en Inicio; en el resto cada página tiene su PageHeader) */}
      <div className="pl-12 lg:pl-0">
        {isHome ? (
          <>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              Hola, <span className="gradient-text">{firstName}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Aquí tienes el resumen de tu operación de hoy.
            </p>
          </>
        ) : currentPageName ? (
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">
            {currentPageName}
          </h1>
        ) : (
          <p className="text-sm text-muted-foreground">
            Mateos Pet AI · Panel operativo
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Buscador con dropdown */}
        <div ref={containerRef} className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (hasResults) setOpen(true); }}
            placeholder="Buscar clientes o mascotas…"
            aria-label="Buscar clientes o mascotas"
            className="h-10 w-64 rounded-xl border border-white/[0.08] bg-white/[0.05] pl-9 pr-3 text-sm placeholder:text-muted-foreground backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all md:w-80"
          />

          {/* Dropdown de resultados */}
          {open && (
            <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              {searching && (
                <div className="px-4 py-3 text-sm text-muted-foreground">Buscando…</div>
              )}

              {!searching && !hasResults && query.length >= 2 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Sin resultados para &ldquo;{query}&rdquo;
                </div>
              )}

              {!searching && hasResults && (
                <>
                  {results!.users.length > 0 && (
                    <div>
                      <p className="border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Propietarios
                      </p>
                      {results!.users.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelect(`/dashboard/contacto?search=${encodeURIComponent(u.phone)}`)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-semibold text-violet-400">
                            {(u.name?.trim()?.[0] ?? "#").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{u.name ?? formatPhone(u.phone)}</div>
                            {u.name && (
                              <div className="truncate text-xs text-muted-foreground">{formatPhone(u.phone)}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {results!.pets.length > 0 && (
                    <div className={results!.users.length > 0 ? "border-t border-border" : ""}>
                      <p className="border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Mascotas
                      </p>
                      {results!.pets.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelect(`/dashboard/contacto?pet=${p.id}`)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-base">
                            {getPetEmoji(p.type)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{p.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {p.breed ? `${p.breed} · ` : ""}
                              {p.owner.name ?? formatPhone(p.owner.phone)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <Link
          href="/dashboard/conversations"
          title="Conversaciones de WhatsApp"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/8 text-emerald-400 transition-all hover:bg-emerald-500/15 hover:shadow-[0_0_12px_rgba(16,185,129,0.25)]"
        >
          <MessageCircle className="h-5 w-5" />
        </Link>

        <button
          type="button"
          title="Notificaciones"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
        </button>

        <Link
          href="/dashboard/calendar"
          title="Agenda"
          className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden font-medium md:inline">{todayLabel()}</span>
        </Link>
      </div>
    </header>
  );
}
