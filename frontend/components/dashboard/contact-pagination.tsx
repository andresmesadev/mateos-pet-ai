"use client";

import { Button } from "@/components/ui/button";

export function ContactPagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return <nav aria-label="Páginas de resultados" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
    <p className="text-sm text-muted-foreground">Página {page} de {pages} · {total.toLocaleString("es-CO")} resultados</p>
    <div className="flex gap-2">
      <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
      <Button variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente</Button>
    </div>
  </nav>;
}
