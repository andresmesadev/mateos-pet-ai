import { Suspense } from "react";

import { WhatsAppWebView } from "@/components/dashboard/whatsapp-web-view";
import { Skeleton } from "@/components/ui/skeleton";

function ConversationsLoading() {
  return <Skeleton className="h-[calc(100dvh-190px)] min-h-[480px] w-full rounded-xl" />;
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
    <section className="overflow-hidden">
      <h1 className="sr-only">WhatsApp</h1>
      <Suspense fallback={<ConversationsLoading />}>
        <WhatsAppWebView initialConversationId={params.conversation ?? null} />
      </Suspense>
    </section>
  );
}
