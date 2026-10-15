import { Suspense } from "react";
import { AssistantsWorkspace } from "@/components/dashboard/assistants/assistants-workspace";
export default function AssistantsPage() {
  return <Suspense fallback={<div role="status" className="rounded-2xl border bg-white p-6">Preparando tus asistentes…</div>}><AssistantsWorkspace /></Suspense>;
}
