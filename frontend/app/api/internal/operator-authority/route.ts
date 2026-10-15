import { liveOperatorReply } from "@/lib/operator-channel/authority";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > 8192) throw Error("INVALID_AUTHORITY_REQUEST");
    return Response.json(await liveOperatorReply(JSON.parse(text), "/api/internal/operator-authority"), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ code: "OPERATOR_AUTHORITY_UNAVAILABLE" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}
