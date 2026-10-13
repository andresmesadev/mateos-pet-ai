// The application currently uses API routes, not Server Actions. Reject page
// POSTs before Next parses action references in headers or form/multipart bodies.
export function rejectsPageAction(method: string, pathname: string, headers: Headers): boolean {
  if (headers.has("next-action")) return true;
  const api = pathname === "/api" || pathname.startsWith("/api/");
  const internal = pathname === "/_next" || pathname.startsWith("/_next/");
  return method === "POST" && !api && !internal;
}
