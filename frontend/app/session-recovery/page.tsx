import { SessionRecovery } from '@/components/auth/session-recovery';

export default async function SessionRecoveryPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <SessionRecovery reason={reason === 'session' ? 'session' : 'unavailable'} />;
}
