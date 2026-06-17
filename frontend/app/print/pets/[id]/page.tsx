import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { apiUrl, makeServerHeaders } from "@/lib/api";
import { PdfPrintView } from "@/components/dashboard/pet-pdf-view";

export type TimelineItem = {
  id: string;
  kind: string;
  date: string;
  title: string;
  appointmentStatus: string | null;
  staffName: string | null;
  reason: string | null;
  findings: string | null;
  diagnosis: string | null;
  treatment: string | null;
  recommendations: string | null;
  weight: number | null;
  nextControlAt: string | null;
  detail: string | null;
};

export type NextAction = {
  id: string;
  date: string;
  title: string;
  detail: string | null;
  actionType?: string;
};

export type PetReport = {
  pet: {
    id: string;
    name: string;
    type: string;
    breed: string | null;
    gender: string | null;
    birthDate: string | null;
    weight: number | null;
    sterilized: boolean | null;
    notes: string | null;
    createdAt: string;
  };
  owner: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    address: string | null;
  };
  tenant: {
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
    logoUrl: string | null;
  } | null;
  timeline: {
    items: TimelineItem[];
    nextActions: NextAction[];
  };
  weightHistory: { date: string; weight: number; title: string }[];
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tenant?: string }>;
};

export default async function PetPrintPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tenant } = await searchParams;
  const session = await auth();
  const headers = makeServerHeaders(session, tenant);

  const res = await fetch(apiUrl(`/api/dashboard/pets/${id}/report`), {
    cache: "no-store",
    headers,
  });

  if (!res.ok) notFound();

  const report: PetReport = await res.json();

  return <PdfPrintView report={report} />;
}
