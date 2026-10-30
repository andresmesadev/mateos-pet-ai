'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { clearWorkspaceSession, workspaceStorage } from '@/lib/workspace-session';
import { clearSaleDrafts } from '@/lib/pos-draft';
import { ProductBrand } from '@/components/brand/product-brand';

export function SessionRecovery({ reason = 'unavailable', onRetry }: { reason?: 'session' | 'unavailable' | 'suspended'; onRetry?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function leave() {
    if (busy) return;
    setBusy(true); setError('');
    clearWorkspaceSession(workspaceStorage());
    try { clearSaleDrafts(sessionStorage); } catch { /* Blocked storage must not prevent signing out. */ }
    try { await signOut({ callbackUrl: '/login' }); }
    catch { setBusy(false); setError('No se pudo cerrar la sesión. Usa el enlace de cierre alternativo o vuelve a intentarlo.'); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#f5f9f8] px-4 py-8 text-foreground">
    <section aria-labelledby="session-recovery-title" className="w-full max-w-md space-y-5 rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
      <ProductBrand size="md" />
      <div className="space-y-2"><h1 id="session-recovery-title" className="text-2xl font-bold">{reason === 'session' ? 'Vuelve a iniciar sesión' : reason === 'suspended' ? 'Acceso del negocio suspendido' : 'No pudimos comprobar tu acceso'}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{reason === 'session' ? 'Tu sesión anterior ya no es válida. Si cambiaron tu contraseña o tu acceso, cierra esta sesión y entra con tus datos actuales.' : reason === 'suspended' ? 'Pide al administrador del establecimiento que revise su suscripción. La operación seguirá bloqueada mientras el negocio esté suspendido.' : 'Puede ser un problema temporal de conexión. Reintenta o cierra la sesión para volver a entrar.'}</p></div>
      <div className="space-y-3">
        <button type="button" disabled={busy} onClick={() => void leave()} className="min-h-12 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{busy ? 'Cerrando sesión…' : 'Cerrar sesión y volver a entrar'}</button>
        <button type="button" disabled={busy} onClick={() => onRetry ? onRetry() : router.replace('/dashboard')} className="min-h-12 w-full rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-60">Reintentar acceso</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <form action="/api/auth/signout" method="get"><input type="hidden" name="callbackUrl" value="/login" /><button type="submit" className="inline-flex min-h-11 items-center text-sm font-medium text-teal-700 underline underline-offset-4">Abrir cierre de sesión alternativo</button></form>
    </section>
  </main>;
}
