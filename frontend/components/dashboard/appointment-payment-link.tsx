"use client";
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { useDashboardAccess } from './dashboard-access-provider';
import { useTenant } from '@/lib/use-tenant';
import { homeHref } from '@/lib/home-workspace';
import type { TodayAppointment } from '@/lib/appointments';

export function AppointmentPaymentLink({ appointment }: { appointment: TodayAppointment }) {
  const access = useDashboardAccess(); const tenant = useTenant();
  if (!access?.capabilities.cash || appointment.status !== 'completed' || !appointment.payment) return null;
  const label = appointment.payment.status === 'pending' ? 'Registrar pago' : appointment.payment.needsReview ? 'Revisar pago' : 'Ver pago';
  return <div className="flex flex-wrap items-center gap-2">{appointment.payment.status === 'pending' && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">Pendiente de pago</span>}<Link prefetch={false} href={homeHref(`/dashboard/pos?tab=${appointment.payment.status === 'pending' ? 'venta' : 'caja'}&appointmentId=${encodeURIComponent(appointment.id)}${appointment.payment.needsReview ? '&review=1' : ''}`, tenant)} aria-label={`${label}: ${appointment.petName}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50"><Wallet aria-hidden="true" className="size-4" />{label}</Link></div>;
}
