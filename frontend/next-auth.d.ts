import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    tenantId?: string | null;
    isSuperAdmin?: boolean;
    role?: "admin" | "vet";
    staffId?: string | null;
    sessionVersion?: number | null;
  }
  interface Session {
    user: {
      email: string;
      name: string;
      tenantId: string | null;
      isSuperAdmin: boolean;
      role: "admin" | "vet";
      staffId: string | null;
      sessionVersion: number | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string | null;
    isSuperAdmin?: boolean;
    role?: "admin" | "vet";
    staffId?: string | null;
    sessionVersion?: number | null;
  }
}
