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
      if (isLoggedIn && auth?.user.role === "vet" && (isDashboard || isPrint)) {
        if (nextUrl.pathname !== "/dashboard/consultas") {
          return Response.redirect(new URL("/dashboard/consultas", nextUrl));
        }
      }

      // Fix post-auditoría de seguridad (2026-09-07, hallazgo F1): /print
      // quedaba fuera de este gate (el default `return true` lo dejaba
      // pasar sin sesión), exponiendo historial clínico completo + datos
      // del dueño a cualquiera que tuviera el id de la mascota.
      if (isDashboard || isPrint) {
        return isLoggedIn;
      }

      if (isLogin && isLoggedIn) {
        return Response.redirect(new URL(auth?.user.role === "vet" ? "/dashboard/consultas" : "/dashboard", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.tenantId = user.tenantId ?? null;
        token.isSuperAdmin = user.isSuperAdmin ?? false;
        token.role = user.role ?? "admin";
        token.staffId = user.staffId ?? null;
        token.sessionVersion = user.sessionVersion ?? null;
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
      session.user.role = (token.role ?? "admin") as "admin" | "vet";
      session.user.staffId = (token.staffId ?? null) as string | null;
      session.user.sessionVersion = (token.sessionVersion ?? null) as number | null;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
