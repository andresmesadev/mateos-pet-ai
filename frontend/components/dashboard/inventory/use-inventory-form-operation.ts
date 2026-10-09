"use client";

import { useRef, useState } from "react";
import { useInventoryOperation } from "@/lib/use-inventory-operation";

/** Only the operation submitted by this editor may confirm or clear its draft. */
export function useInventoryFormOperation(onConfirmed: () => void, onSaved?: () => void | Promise<void>) {
  const submittedKey = useRef<string | null>(null);
  const [preparedKey, setPreparedKey] = useState<string | null>(null);
  const operation = useInventoryOperation(async confirmed => {
    if (confirmed.key === submittedKey.current) onConfirmed();
    await onSaved?.();
  }, prepared => { submittedKey.current = prepared.key; setPreparedKey(prepared.key); });
  const ownPending = operation.pending.some(p => p.key === preparedKey);
  return { operation, ownPending };
}
