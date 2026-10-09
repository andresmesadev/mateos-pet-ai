"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListContinuity } from "@/lib/use-list-continuity";
import { homePriorityFilters } from "@/lib/home-adaptability";

type AttentionItem = { id: string; unavailable: boolean; content: ReactNode };

export function AttentionList({ items }: { items: AttentionItem[] }) {
  const [pageSize, setPageSize] = useState(3);
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);
  const unavailable = items.filter(item => item.unavailable).length;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const continuity = useListContinuity("home-priorities", { priorityPage: "1" }, raw => homePriorityFilters(raw, pages));
  const current = Number(continuity.filters.priorityPage) - 1;
  const first = current * pageSize;

  useEffect(() => {
    const node = list.current;
    const grid = node?.closest('[data-home-section="attention"]')?.parentElement;
    if (!node || !grid) return;
    const observer = new ResizeObserver(() => {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      setPageSize(columns > 1 ? Math.max(1, Math.min(3, Math.floor(node.clientHeight / 170))) : 3);
    });
    observer.observe(node); observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  function select(next: number) {
    continuity.update({ priorityPage: String(next + 1) });
    list.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  if (!items.length) return null;
  return <div className="flex min-h-0 flex-1 flex-col">
    {unavailable > 0 && <p role="status" className="shrink-0 border-b bg-amber-50 px-5 py-3 text-xs font-medium text-amber-900">{unavailable} {unavailable === 1 ? "revisión no disponible" : "revisiones no disponibles"}. Revisa las páginas o actualiza Inicio.</p>}
    <div ref={list} id={listId} tabIndex={0} aria-label="Lista de prioridades" className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700">
      {items.map((item, index) => <article key={item.id} hidden={index < first || index >= first + pageSize} data-home-task={item.id} data-unavailable={item.unavailable} className={`break-words p-5 ${item.unavailable ? "bg-amber-50/60" : ""}`}>
        {item.content}
      </article>)}
    </div>
    {pages > 1 && <nav aria-label="Páginas de prioridades" className="shrink-0 border-t p-3">
      <p role="status" className="mb-2 text-center text-xs text-muted-foreground">{first + 1}–{Math.min(first + pageSize, items.length)} de {items.length} prioridades · Página {current + 1} de {pages}</p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button type="button" size="icon" variant="outline" className="size-11" aria-label="Página anterior de prioridades" disabled={current === 0} onClick={() => select(current - 1)}><ChevronLeft aria-hidden="true" /></Button>
        {Array.from({ length: pages }, (_, index) => <Button key={index} type="button" size="icon" variant={index === current ? "default" : "outline"} className="size-11" aria-label={`Página ${index + 1} de prioridades`} aria-current={index === current ? "page" : undefined} aria-controls={listId} onClick={() => select(index)}>{index + 1}</Button>)}
        <Button type="button" size="icon" variant="outline" className="size-11" aria-label="Página siguiente de prioridades" disabled={current === pages - 1} onClick={() => select(current + 1)}><ChevronRight aria-hidden="true" /></Button>
      </div>
    </nav>}
  </div>;
}
