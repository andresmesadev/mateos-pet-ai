export type DashboardSearchParams = Record<string, string | string[] | undefined>;

/** Legacy URLs remain valid entry points to the canonical workspace. */
export function canonicalDashboardHref(path: string, query: DashboardSearchParams, selection: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach(item => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  for (const [key, value] of Object.entries(selection)) params.set(key, value);
  return path + (params.size ? `?${params}` : "");
}
