"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertDialog } from "radix-ui";
import { Button } from "@/components/ui/button";

type Confirmation = { description: string; title?: string; confirmLabel?: string; destructive?: boolean };

/** One pending decision; cancellation and unmount never authorize the action. */
export function useActionConfirmation() {
  const [pending, setPending] = useState<Confirmation | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const settle = useCallback((accepted: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setPending(null);
    resolve?.(accepted);
  }, []);
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);
  const confirm = useCallback((options: Confirmation | string) => {
    if (resolver.current) return Promise.resolve(false);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setPending(typeof options === "string" ? { description: options } : options);
    });
  }, []);
  const confirmation = <AlertDialog.Root open={pending !== null} onOpenChange={open => { if (!open) settle(false); }}>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" />
      <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-xl">
        <AlertDialog.Title className="text-lg font-semibold">{pending?.title ?? "Confirmar acción"}</AlertDialog.Title>
        <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{pending?.description}</AlertDialog.Description>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <AlertDialog.Cancel asChild><Button variant="outline" onClick={() => settle(false)}>Cancelar</Button></AlertDialog.Cancel>
          <Button variant={pending?.destructive ? "destructive" : "default"} onClick={() => settle(true)}>{pending?.confirmLabel ?? "Confirmar"}</Button>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
  return { confirm, confirmation };
}
