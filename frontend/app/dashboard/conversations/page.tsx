import { Suspense } from "react";
import { MessageSquare } from "lucide-react";

import { ConversationsInbox } from "@/components/dashboard/conversations-inbox";
import { EscalationsPanel } from "@/components/dashboard/escalations-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";

function ConversationsLoading() {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

type DashboardConversationsPageProps = {
  searchParams: Promise<{
    conversation?: string;
  }>;
};

export default async function DashboardConversationsPage({
  searchParams,
}: DashboardConversationsPageProps) {
  const params = await searchParams;

  return (
    <section>
      <PageHeader
        title="WhatsApp"
        description="Atención humana e historial completo de los chats"
        icon={MessageSquare}
        tint="bg-emerald-500/15 text-emerald-400"
      />

      <div className="space-y-6">
        <EscalationsPanel />

        <Suspense fallback={<ConversationsLoading />}>
          <ConversationsInbox initialConversationId={params.conversation ?? null} />
        </Suspense>
      </div>
    </section>
  );
}
