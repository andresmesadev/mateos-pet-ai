"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiUrl } from "@/lib/api";

type Tenant = {
  id: string;
  name: string;
  slug: string;
};

export function TenantSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTenant = searchParams.get("tenant") ?? "";
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/dashboard/tenants"), { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTenants(data);
      })
      .catch(() => {});
  }, []);

  if (tenants.length === 0) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("tenant", e.target.value);
    } else {
      params.delete("tenant");
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={currentTenant}
      onChange={handleChange}
      className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Todos los tenants</option>
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
