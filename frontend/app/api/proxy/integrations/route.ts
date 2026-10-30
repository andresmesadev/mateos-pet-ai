import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { apiUrl, makeServerHeaders } from '@/lib/api';
import { billingTenantId, verifyBillingAdministrator } from '@/lib/billing-access';

const paths: Record<string,string> = { start: '/whatsapp/start', complete: '/whatsapp/complete', disconnect: '/whatsapp/disconnect', limit: '/ai/limit', reconcile: '/ai/reconcile' };
async function route(req: NextRequest, method: 'GET' | 'POST') {
  const session = await auth();
  const access = await verifyBillingAdministrator(session);
  if (!access.allowed) return NextResponse.json({ code: 'ADMINISTRATOR_REQUIRED' }, { status: access.status });
  let body: Record<string, unknown> = {};
  if (method === 'POST') {
    const trusted = new URL(process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).origin;
    if (req.headers.get('origin') !== trusted || !req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ code: 'INVALID_ORIGIN' }, { status: 403 });
    try { body = await req.json(); } catch { return NextResponse.json({ code: 'INVALID_REQUEST' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.action !== 'string' || !Object.hasOwn(paths,body.action)) return NextResponse.json({ code: 'INVALID_ACTION' }, { status: 400 });
    if (['limit','reconcile'].includes(body.action) && (!session?.user.isSuperAdmin || session.user.staffId)) return NextResponse.json({ code: 'PLATFORM_ADMINISTRATOR_REQUIRED' }, { status: 403 });
  }
  const tenantId = billingTenantId(session, method === 'POST' ? body.tenantId : req.nextUrl.searchParams.get('tenant'));
  if (!tenantId) return NextResponse.json({ code: 'TENANT_REQUIRED' }, { status: 403 });
  const endpoint = method === 'GET' ? '/status' : paths[String(body.action)];
  const forwarded = { state: body.state, code: body.code, wabaId: body.wabaId, phoneNumberId: body.phoneNumberId,
    expectedVersion: body.expectedVersion, monthlyLimit: body.monthlyLimit, entryId: body.entryId, accepted: body.accepted, receiptRef: body.receiptRef };
  try {
    const response = await fetch(apiUrl('/api/integrations' + endpoint), { method, headers: makeServerHeaders(session,tenantId), cache: 'no-store',
      ...(method === 'POST' ? { body: JSON.stringify(forwarded) } : {}), signal: AbortSignal.timeout(method === 'GET' ? 10000 : 45000) });
    return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ code: 'INTEGRATION_UNAVAILABLE' }, { status: 503 }); }
}
export const GET = (req: NextRequest) => route(req,'GET');
export const POST = (req: NextRequest) => route(req,'POST');
