"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HistoryPage } from "@/lib/financial-history-page";

export function HistoryPages({ data, onPage, onSize }: { data: HistoryPage<unknown>; onPage: (page: number) => void; onSize: (size: number) => void }) {
  const { page, pageSize, total, totalPages } = data;
  return <nav aria-label="Páginas del historial" className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-sm">
    <div className="flex flex-wrap items-center gap-3">
      <p>{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} de {total} · Página {page} de {totalPages}</p>
      <label className="flex items-center gap-2">Por página<select value={pageSize} onChange={event => onSize(Number(event.target.value))} className="h-10 rounded-lg border bg-white px-2"><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
    </div>
    <div className="flex flex-wrap gap-2">
      {totalPages > 2 && <Button variant="ghost" disabled={page === 1} onClick={() => onPage(1)}>Primera</Button>}
      <Button variant="outline" aria-label="Página anterior" disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft aria-hidden className="h-4 w-4" />Anterior</Button>
      <Button variant="outline" aria-label="Página siguiente" disabled={page === totalPages} onClick={() => onPage(page + 1)}>Siguiente<ChevronRight aria-hidden className="h-4 w-4" /></Button>
      {totalPages > 2 && <Button variant="ghost" disabled={page === totalPages} onClick={() => onPage(totalPages)}>Última</Button>}
    </div>
  </nav>;
}
