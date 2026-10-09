"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import { WorkspaceSessionBoundary } from "./workspace-session-boundary";

export function Providers({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    // Connectivity is a browser signal and is initialized after hydration.
    update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return <SessionProvider refetchOnWindowFocus={online} refetchWhenOffline={false}><WorkspaceSessionBoundary />{children}</SessionProvider>;
}
