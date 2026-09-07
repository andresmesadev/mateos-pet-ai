import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isPrint = nextUrl.pathname.startsWith("/print");
      const isLogin = nextUrl.pathname === "/login";

      // Fix post-auditoría de seguridad (2026-09-07, hallazgo F1): /print
      // quedaba fuera de este gate (el default `return true` lo dejaba
      // pasar sin sesión), exponiendo historial clínico completo + datos
      // del dueño a cualquiera que tuviera el id de la mascota.
      if (isDashboard || isPrint) {
        return isLoggedIn;
      }

      if (isLogin && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.tenantId = user.tenantId ?? null;
        token.isSuperAdmin = user.isSuperAdmin ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (token.email) {
        session.user.email = token.email as string;
      }
      if (token.name) {
        session.user.name = token.name as string;
      }
      session.user.tenantId = (token.tenantId ?? null) as string | null;
      session.user.isSuperAdmin = (token.isSuperAdmin ?? false) as boolean;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
