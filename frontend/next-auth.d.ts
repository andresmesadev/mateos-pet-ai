import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    tenantId?: string | null;
    isSuperAdmin?: boolean;
  }
  interface Session {
    user: {
      email: string;
      name: string;
      tenantId: string | null;
      isSuperAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId?: string | null;
    isSuperAdmin?: boolean;
  }
}
