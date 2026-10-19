"use client";
import { useState } from 'react';
import type { TodayAppointment } from '@/lib/appointments';
import { useTenant } from '@/lib/use-tenant';
import { GroomingAssignmentDialog } from './grooming-assignment-dialog';

export function useGroomerSelection<T extends TodayAppointment>(onUpdated: (visit: T) => void) {
  const tenant = useTenant();
  const [pending, setPending] = useState<{ visit: T; choices: { id: string; name: string }[]; resume: () => void } | null>(null);
  function ask(visit: T, payload: { code?: string; choices?: { id: string; name: string }[] } | null, resume: () => void) {
    if (payload?.code !== 'STAFF_SELECTION_REQUIRED' || !Array.isArray(payload.choices) || !payload.choices.length) return false;
    setPending({ visit, choices: payload.choices, resume });
    return true;
  }
  return { ask, dialog: pending && <GroomingAssignmentDialog visit={pending.visit} staff={pending.choices} tenantId={tenant ?? undefined} onClose={() => setPending(null)} onSaved={visit => { const resume = pending.resume; setPending(null); onUpdated(visit); resume(); }} /> };
}
