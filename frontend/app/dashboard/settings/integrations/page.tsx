import Link from 'next/link';
import { Plug } from 'lucide-react';
import { auth } from '@/auth';
import { verifyBillingAdministrator, billingTenantId } from '@/lib/billing-access';
import { PageHeader } from '@/components/dashboard/page-header';
import { ProviderIntegrations } from '@/components/dashboard/provider-integrations';

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const session = await auth();
  const access = await verifyBillingAdministrator(session);
  const tenantId = billingTenantId(session,(await searchParams).tenant);
  return <div className="space-y-6">
    <PageHeader title="WhatsApp e inteligencia artificial" description="Conexión y consumo de este establecimiento" icon={Plug} />
    <Link className="text-sm font-semibold text-primary underline underline-offset-4" href={tenantId ? `/dashboard/settings?tenant=${encodeURIComponent(tenantId)}` : '/dashboard/settings'}>Volver a Administración</Link>
    {!access.allowed ? <p role="alert">Se requiere una sesión vigente de administrador. Vuelve a iniciar sesión o reintenta la verificación.</p>
      : !tenantId ? <p role="alert">Selecciona un establecimiento para consultar sus integraciones.</p> : <ProviderIntegrations key={tenantId} tenantId={tenantId} />}
  </div>;
}
