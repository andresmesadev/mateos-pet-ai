"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type EditState = { dirty: boolean; saving: boolean };
type EditGuard = {
  register: (id: string, state: EditState) => () => void;
  discard: (action: () => void, dirty: boolean) => void;
};
const EditGuardContext = createContext<EditGuard | null>(null);

/** Protect every editor inside this dialog, including Escape and backdrop dismissal. */
export function ProtectedDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const editors = useRef(new Map<string, EditState>());
  const [pending, setPending] = useState<(() => void) | null>(null);
  const register = useCallback((id: string, state: EditState) => {
    editors.current.set(id, state);
    return () => { editors.current.delete(id); };
  }, []);
  const discard = useCallback((action: () => void, dirty: boolean) => {
    if ([...editors.current.values()].some((editor) => editor.saving)) return;
    if (dirty) setPending(() => action);
    else action();
  }, []);
  const guard = useMemo(() => ({ register, discard }), [register, discard]);

  return <EditGuardContext.Provider value={guard}>
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) onOpenChange(true);
      else discard(() => onOpenChange(false), [...editors.current.values()].some((editor) => editor.dirty));
    }}>{children}</Dialog>
    <AlertDialog.Root open={Boolean(open && pending)} onOpenChange={(nextOpen) => { if (!nextOpen) setPending(null); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">¿Salir sin guardar?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">Tienes cambios pendientes. Puedes seguir editando o descartarlos; los datos ya guardados se conservan.</AlertDialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild><Button variant="outline">Seguir editando</Button></AlertDialog.Cancel>
            <AlertDialog.Action asChild><Button variant="destructive" onClick={() => { const action = pending; setPending(null); action?.(); }}>Descartar cambios</Button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </EditGuardContext.Provider>;
}

export function useDialogEditGuard(dirty: boolean, saving: boolean) {
  const guard = useContext(EditGuardContext);
  const id = useId();
  useEffect(() => guard?.register(id, { dirty, saving }), [guard, id, dirty, saving]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty, saving]);
  return (action: () => void, changed = dirty) => {
    if (saving) return;
    if (guard) guard.discard(action, changed);
    else action();
  };
}

export function SavedChangesStatus({ dirty, saving, savedAt }: { dirty: boolean; saving: boolean; savedAt: Date | null }) {
  return <p role="status" aria-live="polite" className={`text-sm ${dirty ? "text-amber-800" : "text-muted-foreground"}`}>
    {saving ? "Guardando cambios…" : dirty ? "Cambios sin guardar" : savedAt ? `Cambios guardados a las ${savedAt.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" })}` : ""}
  </p>;
}
