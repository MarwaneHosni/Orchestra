"use client";

import { useParams } from "next/navigation";
import { SummaryView } from "@/components/interview/summary-view";

export default function SummaryPage() {
  const params = useParams();
  const sessionId = params.id as string;

  return (
    <div className="py-4">
      <SummaryView sessionId={sessionId} />
    </div>
  );
}
