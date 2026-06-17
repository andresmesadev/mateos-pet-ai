import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim();
        const password = credentials?.password?.toString();

        const adminEmail = process.env.ADMIN_EMAIL?.trim();
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword || !email || !password) {
          return null;
        }

        if (email === adminEmail && password === adminPassword) {
          return {
            id: "admin",
            email: adminEmail,
            name: "Administrador",
            tenantId: null,
            isSuperAdmin: true,
          };
        }

        return null;
      },
    }),
  ],
});
