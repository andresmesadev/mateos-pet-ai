"use client";

import { useRef } from "react";
import { DropdownMenu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

type Action = { label: string; disabled?: boolean; onSelect: () => void };

export function GroomingSecondaryActions({ actions, disabled }: { actions: Action[]; disabled: boolean }) {
  const opensDialog = useRef(false);
  if (actions.length === 1) return <Button variant="outline" className="min-h-11" disabled={disabled || actions[0].disabled} onClick={actions[0].onSelect}>{actions[0].label}</Button>;
  return <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild><Button variant="outline" className="min-h-11" disabled={disabled}><MoreHorizontal className="size-4" /> Acciones</Button></DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 max-w-[calc(100vw-2rem)] rounded-xl border bg-white p-1.5 text-sm shadow-lg" onCloseAutoFocus={(event) => { if (opensDialog.current) { event.preventDefault(); opensDialog.current = false; } }}>
        {actions.map((action) => <DropdownMenu.Item key={action.label} disabled={action.disabled} className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 font-medium outline-none data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50" onSelect={() => { opensDialog.current = true; action.onSelect(); }}>{action.label}</DropdownMenu.Item>)}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
