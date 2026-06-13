import { Suspense } from "react";

import { ConversationsInbox } from "@/components/dashboard/conversations-inbox";
import { Skeleton } from "@/components/ui/skeleton";

function ConversationsLoading() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
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
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Conversaciones</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa qué escribió cada cliente y el historial completo del chat
        </p>
      </div>

      <Suspense fallback={<ConversationsLoading />}>
        <ConversationsInbox initialConversationId={params.conversation ?? null} />
      </Suspense>
    </section>
  );
}
